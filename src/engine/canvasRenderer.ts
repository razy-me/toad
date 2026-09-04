/**
 * src/engine/canvasRenderer.ts
 * Multi-scale raster rendering engine powered by @napi-rs/canvas.
 * Renders resolved LayoutResult trees into Canvas instances and PNG/JPEG Buffers.
 */

import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D, SKRSContext2D, Image, Path2D } from '@napi-rs/canvas';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LayoutResult, LayoutNode } from '../parser/math.js';
import {
  drawRect,
  drawCircle,
  drawPolygon,
  createCanvasGradient,
  mapBlendMode,
  parseAndApplyFilter,
  drawImageWithFit,
  applyPhotographicGrading,
  drawVignette,
  PhotoAdjustParams
} from './drawUtils.js';
import { FontLoader } from './fontLoader.js';
import { resolveSharedImage, detectCanvasFilterSupport, estimateFilterPad, normalizeFilterCss, splitUnsafeFilterFns, sanitizeFilterCss } from './imageCache.js';

export interface RenderOptions {
  scale?: number;
  format?: 'png' | 'jpg' | 'jpeg' | 'webp';
  quality?: number; // 0 - 100 for JPEG/WebP
  basePath?: string;
}

export class CanvasRenderer {
  /**
   * Renders a layout result to a Canvas instance at specified scale.
   */
  public static async renderToCanvas(layout: LayoutResult, options: RenderOptions = {}): Promise<Canvas> {
    const scale = options.scale && options.scale > 0 ? options.scale : 1;
    const bleed = layout.canvas.bleed || 0;
    const cropMarks = layout.canvas.cropMarks === true;
    const margin = Math.max(cropMarks ? 30 : 0, bleed > 0 ? bleed : 0);

    const baseW = layout.canvas.width;
    const baseH = layout.canvas.height;
    const totalW = baseW + 2 * margin;
    const totalH = baseH + 2 * margin;

    const canvasW = Math.max(1, Math.round(totalW * scale));
    const canvasH = Math.max(1, Math.round(totalH * scale));

    // 1. Register fonts if any
    if (layout.fonts && layout.fonts.length > 0) {
      FontLoader.registerFontDirectives(layout.fonts, options.basePath);
    }

    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d');

    // 2. Setup scale transform
    ctx.scale(scale, scale);

    // If margin is active, translate origin so (0, 0) is the Trim Box origin
    if (margin > 0) {
      ctx.translate(margin, margin);
    }

    // 3. Render Canvas Background (spanning across bleed if bleed > 0)
    if (layout.canvas.mode === 'photo' && layout.canvas.photoSrc) {
      ctx.save();
      const bgX = -bleed;
      const bgY = -bleed;
      const bgW = baseW + 2 * bleed;
      const bgH = baseH + 2 * bleed;

      const img = await this.resolveImage(layout.canvas.photoSrc, options.basePath);
      if (img) {
        // Draw photo onto offscreen canvas for per-pixel grading if photoParams specified
        if (layout.canvas.photoParams) {
          const photoCanvas = createCanvas(Math.round(bgW), Math.round(bgH));
          const pctx = photoCanvas.getContext('2d');
          drawImageWithFit(pctx, img, 'cover', 0, 0, photoCanvas.width, photoCanvas.height);

          try {
            const imgData = pctx.getImageData(0, 0, photoCanvas.width, photoCanvas.height);
            applyPhotographicGrading(imgData.data, layout.canvas.photoParams);
            pctx.putImageData(imgData, 0, 0);
            ctx.drawImage(photoCanvas, bgX, bgY, bgW, bgH);
          } catch {
            // Fallback if getImageData not supported
            drawImageWithFit(ctx, img, 'cover', bgX, bgY, bgW, bgH);
          }
        } else {
          drawImageWithFit(ctx, img, 'cover', bgX, bgY, bgW, bgH);
        }

        // Apply Vignette if specified
        if (layout.canvas.photoParams?.vignette) {
          drawVignette(ctx, bgW, bgH, layout.canvas.photoParams.vignette);
        }
      }
      ctx.restore();
    } else if (layout.canvas.background) {
      ctx.save();
      const bgX = -bleed;
      const bgY = -bleed;
      const bgW = baseW + 2 * bleed;
      const bgH = baseH + 2 * bleed;
      const box = { x: bgX, y: bgY, w: bgW, h: bgH };
      if (typeof layout.canvas.background === 'string') {
        ctx.fillStyle = layout.canvas.background;
      } else {
        ctx.fillStyle = createCanvasGradient(ctx, layout.canvas.background as any, box);
      }
      ctx.fillRect(bgX, bgY, bgW, bgH);
      ctx.restore();
    }

    // 4. Render Layout Nodes
    const rootNodes = layout.nodes.filter(n => !n.parentId && !n.parent);
    for (const node of (rootNodes.length > 0 ? rootNodes : layout.nodes)) {
      await this.renderNode(ctx, node, options.basePath, false, undefined, layout.canvas);
    }

    // 5. Draw Crop Marks if enabled
    if (cropMarks) {
      const { drawCropMarks } = await import('./drawUtils.js');
      drawCropMarks(ctx, baseW, baseH, bleed, margin);
    }

    return canvas;
  }

  /**
   * Renders a layout result to an encoded Buffer (PNG or JPG).
   */
  public static async renderToBuffer(layout: LayoutResult, options: RenderOptions = {}): Promise<Buffer> {
    const canvas = await this.renderToCanvas(layout, options);
    const format = (options.format || 'png').toLowerCase();

    if (format === 'webp') {
      const quality = this.normalizeQuality(options.quality);
      return canvas.encode('webp', quality);
    }

    if (format === 'jpg' || format === 'jpeg') {
      const quality = this.normalizeQuality(options.quality);
      // JPEG has no alpha channel: flatten onto white instead of producing black.
      const flattened = createCanvas(canvas.width, canvas.height);
      const fctx = flattened.getContext('2d');
      fctx.fillStyle = '#ffffff';
      fctx.fillRect(0, 0, flattened.width, flattened.height);
      fctx.drawImage(canvas, 0, 0);
      return flattened.encode('jpeg', quality);
    }

    return canvas.encode('png');
  }

  /** Quality normalizer: accepts 0-1 fractions and 1-100 percents. The
   * pipeline default is 92 everywhere (direct API previously used 90). */
  private static normalizeQuality(q: number | undefined): number {
    const raw = q ?? 92;
    const pct = raw > 0 && raw <= 1 ? raw * 100 : raw;
    return Math.round(Math.min(100, Math.max(1, pct)));
  }

  /**
   * Recursive node renderer
   */
  private static async renderNode(
    ctx: CanvasRenderingContext2D | SKRSContext2D,
    node: LayoutNode,
    basePath?: string,
    skipFilter = false,
    effects?: { overrideOpacity?: number; suppressEffects?: boolean },
    layoutCanvas?: LayoutResult['canvas']
  ): Promise<void> {
    ctx.save();

    // 1. Opacity. Applied exactly ONCE: isolated layers render their subtree
    // with opacity overridden to 1 and re-composite carrying the factor.
    const ownOpacity = typeof effects?.overrideOpacity === 'number'
      ? Math.max(0, Math.min(1, effects.overrideOpacity))
      : typeof node.opacity === 'number'
        ? Math.max(0, Math.min(1, node.opacity))
        : 1;
    if (ownOpacity < 1) {
      ctx.globalAlpha *= ownOpacity;
    }

    // 2. Blend Mode
    if (node.style.blendMode) {
      ctx.globalCompositeOperation = mapBlendMode(node.style.blendMode);
    }

    const isContainer = node.type === 'group' || node.type === 'grid' || node.type === 'stack';
    const containerHasOwnEffect = isContainer &&
      Array.isArray(node.children) && node.children.length > 0 &&
      !!(node.style.shadow || node.style.outerGlow);

    // 3. CSS Filters - rendered into an isolated offscreen layer so the filter
    // applies to this node's pixels only. backdrop-filter has no canvas
    // equivalent and remains unsupported. drop-shadow()/opacity() crash the
    // Skia ctx.filter backend, so they are split out and applied at
    // composite time instead of silently skipping the whole filter chain.
    if (!skipFilter && !effects?.suppressEffects && !containerHasOwnEffect &&
        node.style.filter && this.canvasFilterSupported()) {
      await this.renderNodeIsolated(ctx, node, basePath, {}, layoutCanvas);
      ctx.restore();
      return;
    }

    // 4. Container-level shadow/glow must wrap the UNION of the children, not
    // leak onto every descendant: render the subtree into an isolated layer
    // and stamp the effect once during composition.
    if (containerHasOwnEffect && !effects?.suppressEffects) {
      await this.renderNodeIsolated(ctx, node, basePath, { containerEffect: true }, layoutCanvas);
      ctx.restore();
      return;
    }

    // 5. 2D Transforms
    const hasTransform = node.style.rotation || node.style.scale !== undefined || node.style.skewX || node.style.skewY;
    if (hasTransform) {
      let originX = node.x + node.width / 2;
      let originY = node.y + node.height / 2;
      
      if (node.style.transformOrigin) {
        const ox = node.style.transformOrigin.x;
        const oy = node.style.transformOrigin.y;
        if (typeof ox === 'number') originX = node.x + ox;
        else if (typeof ox === 'string' && ox.endsWith('%')) originX = node.x + node.width * (parseFloat(ox) / 100);
        
        if (typeof oy === 'number') originY = node.y + oy;
        else if (typeof oy === 'string' && oy.endsWith('%')) originY = node.y + node.height * (parseFloat(oy) / 100);
      }

      ctx.translate(originX, originY);
      if (node.style.rotation) {
        ctx.rotate((node.style.rotation * Math.PI) / 180);
      }
      if (node.style.scale !== undefined) {
        const sx = typeof node.style.scale === 'number' ? node.style.scale : (node.style.scale.x ?? 1);
        const sy = typeof node.style.scale === 'number' ? node.style.scale : (node.style.scale.y ?? 1);
        ctx.scale(sx, sy);
      }
      if (node.style.skewX || node.style.skewY) {
        const kx = node.style.skewX ? Math.tan((node.style.skewX * Math.PI) / 180) : 0;
        const ky = node.style.skewY ? Math.tan((node.style.skewY * Math.PI) / 180) : 0;
        ctx.transform(1, ky, kx, 1, 0, 0);
      }
      ctx.translate(-originX, -originY);
    }

    // 6. Drop Shadow & Outer Glow. Canvas shadows ignore the CTM, so blur
    // and offsets are scaled by the current zoom manually — otherwise `-s 2`
    // art keeps 1x-sized shadows.
    if (!effects?.suppressEffects) {
      const z = this.currentZoomScale(ctx);
      if (node.style.shadow) {
        ctx.shadowColor = node.style.shadow.color || 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = (node.style.shadow.blur || 0) * z;
        ctx.shadowOffsetX = (node.style.shadow.offsetX || 0) * z;
        ctx.shadowOffsetY = (node.style.shadow.offsetY || 0) * z;
      } else if (node.style.outerGlow) {
        ctx.shadowColor = node.style.outerGlow.color || '#ffffff';
        ctx.shadowBlur = (node.style.outerGlow.size || 10) * z;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    }

    // 7. Explicit Mask Clipping
    if (node.maskNode) {
      let isAlreadyClipped = false;
      ctx.beginPath();
      if (node.maskNode.type === 'circle') {
        const cx = node.maskNode.x + node.maskNode.width / 2;
        const cy = node.maskNode.y + node.maskNode.height / 2;
        drawCircle(ctx, cx, cy, { rx: node.maskNode.width / 2, ry: node.maskNode.height / 2 });
      } else if (node.maskNode.type === 'polygon' && node.maskNode.polygonLayout) {
        drawPolygon(ctx, node.maskNode.polygonLayout.canvasPoints, node.maskNode.style.borderRadius as number);
      } else if ((node.maskNode.type === 'path' || node.maskNode.type === 'shape' || node.maskNode.type === 'icon' || ['star', 'triangle', 'arrow', 'cross'].includes(node.maskNode.type)) && node.maskNode.pathLayout) {
        const p2d = new Path2D(node.maskNode.pathLayout.d);
        
        // Canvas clipping with Path2D respects current transform
        ctx.translate(node.maskNode.x, node.maskNode.y);
        if (node.maskNode.type === 'icon') {
          ctx.scale(node.maskNode.width / 24, node.maskNode.height / 24);
        }
        ctx.clip(p2d);
        if (node.maskNode.type === 'icon') {
          ctx.scale(24 / node.maskNode.width, 24 / node.maskNode.height);
        }
        ctx.translate(-node.maskNode.x, -node.maskNode.y);
        isAlreadyClipped = true;
      } else {
        drawRect(ctx, node.maskNode.x, node.maskNode.y, node.maskNode.width, node.maskNode.height, node.maskNode.style.borderRadius);
      }
      
      if (!isAlreadyClipped) {
        ctx.clip();
      }
    }

    // 8. Element Specific Drawing
    switch (node.type) {
      case 'rect': {
        drawRect(ctx, node.x, node.y, node.width, node.height, node.style.borderRadius);
        this.applyFillAndStroke(ctx, node);
        break;
      }

      case 'circle': {
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        const rx = node.width / 2;
        const ry = node.height / 2;
        drawCircle(ctx, cx, cy, { rx, ry });
        this.applyFillAndStroke(ctx, node);
        break;
      }

      case 'polygon': {
        const points = node.polygonLayout?.canvasPoints;
        if (points && points.length > 0) {
          drawPolygon(ctx, points, node.style.borderRadius);
          this.applyFillAndStroke(ctx, node);
        }
        break;
      }

      case 'path':
      case 'shape':
      case 'icon':
      case 'star':
      case 'triangle':
      case 'arrow':
      case 'cross': {
        const d = node.pathLayout?.d;
        if (d) {
          const pathObj = new Path2D(d);
          ctx.save();
          ctx.translate(node.x, node.y);
          if (node.type === 'icon') {
            ctx.scale(node.width / 24, node.height / 24);
          }

          // Fill
          const fill = node.style.fill || node.fill;
          if (fill) {
            if (typeof fill === 'string') {
              ctx.fillStyle = fill;
            } else {
              // Pass normalized box since ctx is already translated
              const localBox = { x: 0, y: 0, w: node.width, h: node.height };
              ctx.fillStyle = createCanvasGradient(ctx, fill as any, localBox);
            }
            ctx.fill(pathObj);
          }

          // Stroke
          const stroke = node.style.stroke || node.stroke || (node.type === 'icon' && !node.style.fill && !node.fill ? (node.style.color || '#000000') : undefined);
          if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = node.style.strokeWidth ?? (node.type === 'icon' ? 2 : 1);
            if (node.style.strokeCap || node.type === 'icon') ctx.lineCap = node.style.strokeCap || 'round';
            if (node.style.strokeJoin || node.type === 'icon') ctx.lineJoin = node.style.strokeJoin || 'round';
            if (node.style.strokeStyle === 'dashed') {
              ctx.setLineDash([6, 6]);
            } else if (node.style.strokeStyle === 'dotted') {
              ctx.setLineDash([2, 2]);
            } else {
              ctx.setLineDash([]);
            }
            ctx.stroke(pathObj);
          }
          ctx.restore();
        }
        break;
      }

      case 'text': {
        const fontSize = node.textLayout?.fontSize || 16;
        const fontFamily = node.textLayout?.fontFamily || 'sans-serif';
        const fontWeight = node.textLayout?.fontWeight || 'normal';
        const fontStyle = node.textLayout?.fontStyle || 'normal';
        const lineHeight = node.textLayout?.lineHeight || Math.round(fontSize * 1.25);

        const fontFamCanvas = fontFamily.includes(',')
          ? fontFamily.split(',').map(f => {
              const t = f.trim().replace(/^['"]+|['"]+$/g, '');
              return /^(sans-serif|serif|monospace|cursive|fantasy|system-ui)$/i.test(t) ? t.toLowerCase() : `"${t}"`;
            }).join(', ')
          : (fontFamily === 'sans-serif' ? 'sans-serif' : `"${fontFamily}"`);
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamCanvas}`;
        ctx.textBaseline = 'top';
        if (node.style.letterSpacing && (ctx as any).letterSpacing !== undefined) {
          (ctx as any).letterSpacing = `${node.style.letterSpacing}px`;
        }

        if (node.style.fontFeatures && (ctx as any).fontFeatureSettings !== undefined) {
          const ff = Array.isArray(node.style.fontFeatures)
            ? node.style.fontFeatures.map(f => `"${f}" 1`).join(', ')
            : String(node.style.fontFeatures);
          (ctx as any).fontFeatureSettings = ff;
        }
        if (node.style.fontVariation && (ctx as any).fontVariationSettings !== undefined) {
          const fv = typeof node.style.fontVariation === 'object'
            ? Object.entries(node.style.fontVariation).map(([k, v]) => `"${k}" ${v}`).join(', ')
            : String(node.style.fontVariation);
          (ctx as any).fontVariationSettings = fv;
        }

        if (node.style.fill || node.fill) {
          const fill = node.style.fill || node.fill;
          if (typeof fill === 'string') {
            ctx.fillStyle = fill;
          } else {
            ctx.fillStyle = createCanvasGradient(ctx, fill as any, node.box);
          }
        } else {
          ctx.fillStyle = node.style.color || '#000000';
        }

        const align = node.style.align || 'left';
        if (align === 'center') {
          ctx.textAlign = 'center';
        } else if (align === 'right') {
          ctx.textAlign = 'right';
        } else {
          ctx.textAlign = 'left';
        }

        let anchorX = node.x;
        if (align === 'center') anchorX = node.x + node.width / 2;
        if (align === 'right') anchorX = node.x + node.width;

        const tlHeight = node.textLayout?.height ?? 0;
        const valignShift = node.style.verticalAlign === 'middle'
          ? Math.max(0, (node.height - tlHeight) / 2)
          : node.style.verticalAlign === 'bottom'
            ? Math.max(0, node.height - tlHeight)
            : 0;

        if (align === 'justify' && node.textLayout && node.textLayout.lines && node.textLayout.lines.length > 0) {
          ctx.textAlign = 'left';
          for (let i = 0; i < node.textLayout.lines.length; i++) {
            const line = node.textLayout.lines[i]!;
            const lineY = node.y + valignShift + i * lineHeight;
            const words = line.split(' ');
            if (words.length > 1 && i < node.textLayout.lines.length - 1) {
              const totalWordsW = words.reduce((acc, w) => acc + ctx.measureText(w).width, 0);
              const spaceTotal = Math.max(0, node.width - totalWordsW);
              const gap = spaceTotal / (words.length - 1);
              let currX = node.x;
              for (const w of words) {
                ctx.fillText(w, currX, lineY);
                currX += ctx.measureText(w).width + gap;
              }
            } else {
              ctx.fillText(line, node.x, lineY);
            }
          }
        } else if (node.textLayout && node.textLayout.lines && node.textLayout.lines.length > 0) {
          for (let i = 0; i < node.textLayout.lines.length; i++) {
            const line = node.textLayout.lines[i]!;
            const lineY = node.y + valignShift + i * lineHeight;
            ctx.fillText(line, anchorX, lineY);
          }
        } else if (node.name) {
          ctx.fillText(node.name, anchorX, node.y);
        }
        break;
      }

      case 'image': {
        const imgSrc = node.imageLayout?.src;
        if (imgSrc) {
          const img = await this.resolveImage(imgSrc, basePath);
          if (img) {
            drawImageWithFit(ctx, img, node.fit || node.imageLayout?.fit || 'fill', node.x, node.y, node.width, node.height);
          } else {
            // Draw placeholder rectangle if image not found
            drawRect(ctx, node.x, node.y, node.width, node.height);
            ctx.fillStyle = '#e2e8f0';
            ctx.fill();
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        break;
      }

      case 'adjust': {
        if (node.adjustLayout && layoutCanvas?.photoSrc) {
          const img = await this.resolveImage(layoutCanvas.photoSrc, basePath);
          if (img) {
            const rad = node.adjustLayout.radius;
            const feather = Math.max(1, node.adjustLayout.feather);
            const cx = node.x + node.width / 2;
            const cy = node.y + node.height / 2;
            const spotW = Math.round(rad * 2);
            const spotH = Math.round(rad * 2);

            // 1. Offscreen canvas for the adjusted image patch
            const patchCanvas = createCanvas(spotW, spotH);
            const pctx = patchCanvas.getContext('2d');

            // Draw full image shifted so (cx, cy) is at center of patchCanvas
            const imgW = layoutCanvas.width;
            const imgH = layoutCanvas.height;
            const drawX = rad - cx;
            const drawY = rad - cy;
            drawImageWithFit(pctx, img, 'cover', drawX, drawY, imgW, imgH);

            // Apply photoParams + local adjustParams
            const mergedParams: PhotoAdjustParams = {
              ...(layoutCanvas.photoParams || {}),
              ...(node.adjustLayout.params || {})
            };
            // Additive adjustments
            if (layoutCanvas.photoParams?.exposure !== undefined && node.adjustLayout.params?.exposure !== undefined) {
              mergedParams.exposure = (layoutCanvas.photoParams.exposure || 0) + (node.adjustLayout.params.exposure || 0);
            }
            if (layoutCanvas.photoParams?.contrast !== undefined && node.adjustLayout.params?.contrast !== undefined) {
              mergedParams.contrast = (layoutCanvas.photoParams.contrast || 1) * (node.adjustLayout.params.contrast || 1);
            }
            if (layoutCanvas.photoParams?.brightness !== undefined && node.adjustLayout.params?.brightness !== undefined) {
              mergedParams.brightness = (layoutCanvas.photoParams.brightness || 1) * (node.adjustLayout.params.brightness || 1);
            }
            if (layoutCanvas.photoParams?.saturation !== undefined && node.adjustLayout.params?.saturation !== undefined) {
              mergedParams.saturation = (layoutCanvas.photoParams.saturation || 1) * (node.adjustLayout.params.saturation || 1);
            }
            if (layoutCanvas.photoParams?.warmth !== undefined && node.adjustLayout.params?.warmth !== undefined) {
              mergedParams.warmth = (layoutCanvas.photoParams.warmth || 0) + (node.adjustLayout.params.warmth || 0);
            }

            try {
              const pData = pctx.getImageData(0, 0, spotW, spotH);
              applyPhotographicGrading(pData.data, mergedParams);
              pctx.putImageData(pData, 0, 0);

              // 2. Soft radial feather mask via destination-in
              const maskCanvas = createCanvas(spotW, spotH);
              const mctx = maskCanvas.getContext('2d');
              const grad = mctx.createRadialGradient(rad, rad, Math.max(0, rad - feather), rad, rad, rad);
              grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
              grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              mctx.fillStyle = grad;
              mctx.fillRect(0, 0, spotW, spotH);

              pctx.globalCompositeOperation = 'destination-in';
              pctx.drawImage(maskCanvas, 0, 0);

              // 3. Stamp feathered adjustment patch onto main canvas
              (ctx as any).drawImage(patchCanvas, cx - rad, cy - rad, spotW, spotH);
            } catch {}
          }
        }
        break;
      }

      case 'stack':
      case 'group':
      case 'grid': {
        // Draw container background / border if specified
        if (node.style.fill || node.style.stroke) {
          drawRect(ctx, node.x, node.y, node.width, node.height, node.style.borderRadius);
          this.applyFillAndStroke(ctx, node);
        }

        // Handle group-level clipping
        const hasGroupClip = node.style.clip === true || (node as any).clip === true;
        if (hasGroupClip) {
          ctx.save();
          drawRect(ctx, node.x, node.y, node.width, node.height, node.style.borderRadius);
          ctx.clip();
        }

        // Check for sibling clipping masks
        if (node.children && node.children.length > 0) {
          let i = 0;
          while (i < node.children.length) {
            const child = node.children[i]!;
            const isMask = child.style.clip === true || (child as any).clip === true;

            if (isMask) {
              // 1. Draw mask shape itself (including its fill, stroke, background pixels)
              await this.renderNode(ctx, child, basePath);

              // 2. Find subsequent sibling nodes to clip until the next mask or end of children
              const maskedSiblings: LayoutNode[] = [];
              let j = i + 1;
              while (j < node.children.length) {
                const nextChild = node.children[j]!;
                const nextIsMask = nextChild.style.clip === true || (nextChild as any).clip === true;
                if (nextIsMask) {
                  break;
                }
                maskedSiblings.push(nextChild);
                j++;
              }

              if (maskedSiblings.length > 0) {
                ctx.save();
                let isAlreadyClipped = false;
                ctx.beginPath();
                if (child.type === 'circle') {
                  const cx = child.x + child.width / 2;
                  const cy = child.y + child.height / 2;
                  drawCircle(ctx, cx, cy, { rx: child.width / 2, ry: child.height / 2 });
                } else if (child.type === 'polygon' && child.polygonLayout?.canvasPoints) {
                  drawPolygon(ctx, child.polygonLayout.canvasPoints);
                } else if ((child.type === 'path' || child.type === 'shape' || child.type === 'icon' || ['star', 'triangle', 'arrow', 'cross'].includes(child.type)) && child.pathLayout) {
                  const p2d = new Path2D(child.pathLayout.d);
                  ctx.translate(child.x, child.y);
                  if (child.type === 'icon') {
                    ctx.scale(child.width / 24, child.height / 24);
                  }
                  ctx.clip(p2d);
                  if (child.type === 'icon') {
                    ctx.scale(24 / child.width, 24 / child.height);
                  }
                  ctx.translate(-child.x, -child.y);
                  isAlreadyClipped = true;
                } else {
                  drawRect(ctx, child.x, child.y, child.width, child.height, child.style.borderRadius);
                }
                if (!isAlreadyClipped) {
                  ctx.clip();
                }

                for (const sibling of maskedSiblings) {
                  await this.renderNode(ctx, sibling, basePath, false, undefined, layoutCanvas);
                }
                ctx.restore();
              }

              i = j;
            } else {
              await this.renderNode(ctx, child, basePath, false, undefined, layoutCanvas);
              i++;
            }
          }
        }

        if (hasGroupClip) {
          ctx.restore();
        }
        break;
      }
    }

    ctx.restore();
  }

  private static applyFillAndStroke(ctx: CanvasRenderingContext2D | SKRSContext2D, node: LayoutNode): void {
    // Fill
    const fill = node.style.fill || node.fill;
    if (fill) {
      if (typeof fill === 'string') {
        ctx.fillStyle = fill;
      } else {
        ctx.fillStyle = createCanvasGradient(ctx, fill as any, node.box);
      }
      ctx.fill();
    }

    // Color / Gradient Overlay
    if (node.style.colorOverlay || node.style.gradientOverlay) {
      ctx.save();
      ctx.clip();
      if (node.style.colorOverlay) {
        ctx.fillStyle = node.style.colorOverlay;
      } else if (node.style.gradientOverlay) {
        ctx.fillStyle = createCanvasGradient(ctx, node.style.gradientOverlay as any, node.box);
      }
      ctx.fillRect(node.x - 2, node.y - 2, node.width + 4, node.height + 4);
      ctx.restore();
    }

    // Inner Shadow
    if (node.style.innerShadow) {
      ctx.save();
      ctx.clip();
      const zi = this.currentZoomScale(ctx);
      ctx.shadowColor = node.style.innerShadow.color || 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = (node.style.innerShadow.blur || 4) * zi;
      ctx.shadowOffsetX = (node.style.innerShadow.offsetX || 0) * zi;
      ctx.shadowOffsetY = (node.style.innerShadow.offsetY || 0) * zi;
      ctx.lineWidth = Math.max(2, (node.style.innerShadow.blur || 4) * 2);
      ctx.strokeStyle = node.style.innerShadow.color || 'rgba(0,0,0,0.5)';
      ctx.stroke();
      ctx.restore();
    }

    // Inner Glow
    if (node.style.innerGlow) {
      ctx.save();
      ctx.clip();
      const zg = this.currentZoomScale(ctx);
      ctx.shadowColor = node.style.innerGlow.color || '#ffffff';
      ctx.shadowBlur = (node.style.innerGlow.size || 8) * zg;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = Math.max(2, node.style.innerGlow.size || 8);
      ctx.strokeStyle = node.style.innerGlow.color || '#ffffff';
      ctx.stroke();
      ctx.restore();
    }

    // Stroke: Clear shadow so shadow is not rendered twice
    const stroke = node.style.stroke || node.stroke;
    if (stroke) {
      if ((fill || node.style.outerGlow) && node.style.shadow) {
        ctx.shadowColor = 'transparent';
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = node.style.strokeWidth ?? 1;

      if (node.style.strokeCap) {
        ctx.lineCap = node.style.strokeCap;
      }
      if (node.style.strokeJoin) {
        ctx.lineJoin = node.style.strokeJoin;
      }

      if (node.style.strokeStyle === 'dashed') {
        ctx.setLineDash([6, 6]);
      } else if (node.style.strokeStyle === 'dotted') {
        ctx.setLineDash([2, 2]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
    }

    // Layer Stroke (Independent Stroke FX)
    if (node.style.layerStroke) {
      ctx.save();
      ctx.strokeStyle = node.style.layerStroke.color || '#000000';
      ctx.lineWidth = node.style.layerStroke.width || 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  private static async resolveImage(imgSrc: string, basePath?: string): Promise<Image | null> {
    return resolveSharedImage(imgSrc, basePath);
  }

  private static filterSupportProbe: boolean | null = null;

  private static canvasFilterSupported(): boolean {
    if (this.filterSupportProbe === null) {
      this.filterSupportProbe = detectCanvasFilterSupport();
    }
    return this.filterSupportProbe;
  }

  /**
   * Renders a filtered node into its own bitmap (padded for blur spread),
   * applies the CSS filter there, then composites the result back onto the
   * main context.
   */
  /** Uniform zoom factor of the current transform (rotation-safe). */
  private static currentZoomScale(ctx: CanvasRenderingContext2D | SKRSContext2D): number {
    try {
      const m = (ctx as any).getTransform();
      if (m && typeof m.a === 'number') return Math.hypot(m.a, m.b) || 1;
    } catch { /* backend without getTransform */ }
    return 1;
  }

  /**
   * Splits drop-shadow()/opacity() out of a filter chain. The remaining
   * functions are Skia-safe for ctx.filter; the extracted ones are applied
   * during composition instead of crashing the native backend.
   */
  private static splitUnsafeFilters(css: string): {
    safeCss: string;
    shadow?: { offsetX: number; offsetY: number; blur: number; color: string };
    opacityFactor: number;
  } {
    let safeCss = css;
    let shadow: { offsetX: number; offsetY: number; blur: number; color: string } | undefined;
    let opacityFactor = 1;

    const dsRe = /drop-shadow\(\s*((?:[^()]|\([^()]*\))*)\)/gi;
    let mds: RegExpExecArray | null;
    while ((mds = dsRe.exec(css)) !== null) {
      if (shadow) continue;
      const args = mds[1] || '';
      const numRe = /(-?(?:\d+\.?\d*|\.\d+))(?:px)?/g;
      const vals: number[] = [];
      let lastEnd = 0;
      let firstStart = -1;
      let nm: RegExpExecArray | null;
      while (vals.length < 3 && (nm = numRe.exec(args)) !== null) {
        if (firstStart < 0) firstStart = nm.index;
        vals.push(parseFloat(nm[1]));
        lastEnd = nm.index + nm[0].length;
      }
      if (vals.length < 3) continue;
      const before = args.slice(0, firstStart).trim().replace(/,\s*$/, '');
      let after = args.slice(lastEnd).trim().replace(/^,\s*/, '');
      // CSS accepts the color before OR after the lengths.
      const color = before ? before : (after || 'rgba(0,0,0,0.5)');
      after = '';
      shadow = {
        offsetX: vals[0],
        offsetY: vals[1],
        blur: Math.max(0, vals[2]),
        color
      };
    }

    const opRe = /opacity\(\s*(\d*\.?\d+)\s*%?\s*\)/gi;
    let mop: RegExpExecArray | null;
    while ((mop = opRe.exec(css)) !== null) {
      const v = parseFloat(mop[1]);
      opacityFactor *= v > 1 ? v / 100 : v;
    }

    safeCss = safeCss.replace(dsRe, '').replace(opRe, '').replace(/,\s*,+/g, ', ').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();

    return { safeCss: safeCss || 'none', shadow, opacityFactor };
  }

  /**
   * Renders a node (or a container subtree) into its own bitmap under the
   * CURRENT full transform, applies Skia-safe filters there, then composites
   * the result back in device space — carrying drop-shadow()/opacity() and
   * container-level shadow/glow as composite-time effects.
   */
  private static async renderNodeIsolated(
    ctx: CanvasRenderingContext2D | SKRSContext2D,
    node: LayoutNode,
    basePath: string | undefined,
    opts: { containerEffect?: boolean },
    layoutCanvas?: LayoutResult['canvas']
  ): Promise<void> {
    const anyCtx = ctx as any;
    let filterCss = 'none';
    let shadowSpec: { offsetX: number; offsetY: number; blur: number; color: string } | undefined;
    let opacityFactor = 1;
    let extraPad = 0;

    if (!opts.containerEffect && node.style.filter) {
      const split = this.splitUnsafeFilters(normalizeFilterCss(node.style.filter));
      filterCss = split.safeCss;
      opacityFactor = split.opacityFactor;
      if (split.shadow) {
        shadowSpec = split.shadow;
        extraPad = split.shadow.blur + Math.max(Math.abs(split.shadow.offsetX), Math.abs(split.shadow.offsetY));
      }
    } else if (opts.containerEffect) {
      const s = node.style.shadow;
      const g = node.style.outerGlow;
      if (s) {
        shadowSpec = { offsetX: s.offsetX || 0, offsetY: s.offsetY || 0, blur: s.blur || 0, color: s.color || 'rgba(0,0,0,0.5)' };
      } else if (g) {
        shadowSpec = { offsetX: 0, offsetY: 0, blur: g.size || 10, color: g.color || '#ffffff' };
      }
      if (shadowSpec) {
        extraPad = shadowSpec.blur + Math.max(Math.abs(shadowSpec.offsetX), Math.abs(shadowSpec.offsetY));
      }
    }

    const pad = (opts.containerEffect ? 0 : estimateFilterPad(node.style.filter || '')) + extraPad;
    const ox = node.x - pad;
    const oy = node.y - pad;
    const w = node.width + pad * 2;
    const h = node.height + pad * 2;

    // Device-space AABB of the padded box under the current full transform,
    // so translations (bleed margin), ancestor rotations and scales survive.
    let mat: { a: number; b: number; c: number; d: number; e: number; f: number } | null = null;
    let dx = 0; let dy = 0; let dw = Math.max(1, Math.ceil(w)); let dh = Math.max(1, Math.ceil(h));
    try {
      const t = anyCtx.getTransform();
      if (t && typeof t.a === 'number') {
        mat = { a: t.a, b: t.b, c: t.c, d: t.d, e: t.e, f: t.f };
        const xs = [
          mat.a * ox + mat.c * oy + mat.e,
          mat.a * (ox + w) + mat.c * oy + mat.e,
          mat.a * ox + mat.c * (oy + h) + mat.e,
          mat.a * (ox + w) + mat.c * (oy + h) + mat.e
        ];
        const ys = [
          mat.b * ox + mat.d * oy + mat.f,
          mat.b * (ox + w) + mat.d * oy + mat.f,
          mat.b * ox + mat.d * (oy + h) + mat.f,
          mat.b * (ox + w) + mat.d * (oy + h) + mat.f
        ];
        dx = Math.floor(Math.min(...xs));
        dy = Math.floor(Math.min(...ys));
        dw = Math.max(1, Math.ceil(Math.max(...xs)) - dx);
        dh = Math.max(1, Math.ceil(Math.max(...ys)) - dy);
      }
    } catch { /* backend without getTransform: legacy scale-only path */ }

    const oc = createCanvas(dw, dh);
    const octx = oc.getContext('2d');
    if (mat) {
      octx.setTransform(mat.a, mat.b, mat.c, mat.d, mat.e - dx, mat.f - dy);
    } else {
      const s = this.currentZoomScale(ctx);
      octx.setTransform(s, 0, 0, s, -ox * s, -oy * s);
    }
    try {
      if (filterCss && filterCss !== 'none') (octx as any).filter = sanitizeFilterCss(filterCss);
    } catch { /* unsupported: renders unfiltered inside the layer */ }

    await this.renderNode(octx as unknown as SKRSContext2D, node, basePath, true, {
      overrideOpacity: 1,
      suppressEffects: opts.containerEffect
    }, layoutCanvas);
    try { (octx as any).filter = 'none'; } catch { /* ignore */ }

    // Composite in device space. Skia ignores ctx.shadow* for drawImage, so
    // drop-shadow()/container shadows are stamped as a blurred tinted
    // silhouette BEFORE the layer itself.
    try {
      if (shadowSpec) {
        const z = mat ? (Math.hypot(mat.a, mat.b) || 1) : this.currentZoomScale(ctx);
        const dOffX = mat ? mat.a * shadowSpec.offsetX + mat.c * shadowSpec.offsetY : shadowSpec.offsetX * z;
        const dOffY = mat ? mat.b * shadowSpec.offsetX + mat.d * shadowSpec.offsetY : shadowSpec.offsetY * z;
        const devBlur = shadowSpec.blur * z;

        const sil = createCanvas(dw, dh);
        const silCtx = sil.getContext('2d');
        silCtx.drawImage(oc, 0, 0);
        silCtx.globalCompositeOperation = 'source-in';
        silCtx.fillStyle = shadowSpec.color;
        silCtx.fillRect(0, 0, dw, dh);

        let layer: any = sil;
        if (devBlur > 0.3) {
          const bl = createCanvas(dw, dh);
          const bctx = bl.getContext('2d');
          try { (bctx as any).filter = sanitizeFilterCss(`blur(${(devBlur / 2).toFixed(2)}px)`); } catch { /* keep sharp */ }
          bctx.drawImage(sil, 0, 0);
          layer = bl;
        }

        ctx.save();
        try {
          if (mat) anyCtx.setTransform(1, 0, 0, 1, 0, 0);
          anyCtx.drawImage(layer, dx + dOffX, dy + dOffY);
        } finally {
          if (mat) anyCtx.setTransform(mat.a, mat.b, mat.c, mat.d, mat.e, mat.f);
          ctx.restore();
        }
      }

      ctx.save();
      ctx.globalAlpha *= opacityFactor;
      try {
        if (mat) {
          anyCtx.setTransform(1, 0, 0, 1, 0, 0);
          try {
            anyCtx.drawImage(oc, dx, dy);
          } finally {
            anyCtx.setTransform(mat.a, mat.b, mat.c, mat.d, mat.e, mat.f);
          }
        } else {
          anyCtx.drawImage(oc, ox, oy, w, h);
        }
      } finally {
        ctx.restore();
      }
    } finally {
      // outer save/restore owned by renderNode's frame
    }
  }
}

/**
 * Functional exports for pipeline and tests
 */
export async function renderToCanvas(layout: LayoutResult, options?: RenderOptions): Promise<Canvas> {
  return CanvasRenderer.renderToCanvas(layout, options);
}

export async function renderToBuffer(layout: LayoutResult, options?: RenderOptions): Promise<Buffer> {
  return CanvasRenderer.renderToBuffer(layout, options);
}
