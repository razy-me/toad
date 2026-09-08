/**
 * src/engine/svgExporter.ts
 * High-performance, standalone SVG Exporter for the "toad" declarative design DSL.
 * Generates clean, scalable, standards-compliant SVG documents with support for
 * shapes, multi-corner radii, rounded polygons, gradients, typography, and embedded images.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { LayoutResult, LayoutNode, ComputedStyle, GradientStyle } from '../parser/math.js';
import { distributeGradientStops, parseFilterString, parseColorToRgba } from './drawUtils.js';
import { resolveSharedImage } from './imageCache.js';
import { resolveHumanLayerName, LayerNamingContext } from '../utils/layerNaming.js';
import { FontLoader } from './fontLoader.js';

export function parseSvgColorAndOpacity(colorStr?: string): { color: string; opacity?: number } {
  if (!colorStr) return { color: 'none' };
  const trimmed = colorStr.trim();
  if (trimmed.toLowerCase() === 'transparent' || trimmed.toLowerCase() === 'none') {
    return { color: 'none' };
  }
  if (trimmed.startsWith('url(#')) {
    return { color: trimmed };
  }
  try {
    const rgba = parseColorToRgba(trimmed);
    const hex = ((1 << 24) + (rgba.r << 16) + (rgba.g << 8) + rgba.b).toString(16).slice(1);
    if (rgba.a < 1) {
      return { color: `#${hex}`, opacity: Number(rgba.a.toFixed(3)) };
    }
    return { color: `#${hex}` };
  } catch {
    return { color: colorStr };
  }
}

function formatColorForSvg(color: string): string {
  if (!color) return color;
  return parseSvgColorAndOpacity(color).color;
}

function formatStopAttributes(color: string): string {
  if (!color) return 'stop-color="#000000"';
  const parsed = parseSvgColorAndOpacity(color);
  if (parsed.color === 'none') {
    return 'stop-color="#000000" stop-opacity="0"';
  }
  if (parsed.opacity !== undefined && parsed.opacity < 1) {
    return `stop-color="${parsed.color}" stop-opacity="${parsed.opacity}"`;
  }
  return `stop-color="${parsed.color}"`;
}

function rgbStr(c: { r: number; g: number; b: number }): string {
  return `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
}

export interface SvgExportOptions {
  scale?: number;
  basePath?: string;
  embedImages?: boolean;
  humanizeLayerNames?: boolean;
  textToPath?: boolean;
}

export class SvgExporter {
  private defs: string[] = [];
  private gradientCounter = 0;
  private filterCounter = 0;
  private clipCounter = 0;
  /** Sibling-clipping model: clip:true elements become the clip base for the
   * NEXT sibling within the same parent (parity with raster & PSD output). */
  private pendingClipByParent = new Map<string, string>();
  private basePath?: string;
  private embedImages: boolean;
  private humanizeLayerNames: boolean;
  private textToPath: boolean;

  constructor(options: SvgExportOptions = {}) {
    this.basePath = options.basePath;
    this.embedImages = options.embedImages !== false;
    this.humanizeLayerNames = options.humanizeLayerNames === true;
    this.textToPath = options.textToPath === true;
  }

  /**
   * Exports a LayoutResult to an SVG XML string.
   */
  public async export(layout: LayoutResult, scale = 1, options?: SvgExportOptions): Promise<string> {
    this.defs = [];
    this.gradientCounter = 0;
    this.filterCounter = 0;
    this.clipCounter = 0;
    this.pendingClipByParent.clear();

    // 0. Embedded Fonts
    if (layout.fonts && layout.fonts.length > 0) {
      const fontFaces: string[] = [];
      for (const f of layout.fonts) {
        const fontPath = f.source || (f as any).path;
        if (!fontPath) continue;
        let resolvedPath: string;
        if (this.basePath) {
          const isDir = fs.existsSync(this.basePath) && fs.statSync(this.basePath).isDirectory();
          resolvedPath = isDir ? path.resolve(this.basePath, fontPath) : path.resolve(path.dirname(this.basePath), fontPath);
        } else {
          resolvedPath = path.resolve(fontPath);
        }

        if (fs.existsSync(resolvedPath)) {
          try {
            const ext = path.extname(resolvedPath).toLowerCase();
            const mime = ext === '.woff2' ? 'font/woff2' : ext === '.woff' ? 'font/woff' : ext === '.otf' ? 'font/otf' : 'font/ttf';
            const base64 = fs.readFileSync(resolvedPath).toString('base64');
            const weightProp = f.weight ? `font-weight: ${f.weight}; ` : '';
            const styleProp = f.style ? `font-style: ${f.style}; ` : '';
            fontFaces.push(`@font-face { font-family: "${this.escapeAttr(f.family)}"; ${weightProp}${styleProp}src: url("data:${mime};base64,${base64}"); }`);
            const psName = FontLoader.resolvePostScriptName(f.family, f.weight, f.style);
            if (psName && psName.toLowerCase() !== f.family.toLowerCase()) {
              fontFaces.push(`@font-face { font-family: "${this.escapeAttr(psName)}"; ${weightProp}${styleProp}src: url("data:${mime};base64,${base64}"); }`);
            }
          } catch {}
        }
      }
      if (fontFaces.length > 0) {
        this.defs.push(`<style>\n${fontFaces.map(ff => `      ${ff}`).join('\n')}\n    </style>`);
      }
    }

    const width = layout.canvas.width;
    const height = layout.canvas.height;
    const scaledW = width * scale;
    const scaledH = height * scale;

    const elementsMarkup: string[] = [];

    // 1. Canvas Background
    if (layout.canvas.background && layout.canvas.background !== 'transparent' && layout.canvas.background !== 'none') {
      const bgBox = { x: 0, y: 0, w: width, h: height };
      const bgFill = this.processFill(layout.canvas.background, bgBox);
      const parsedBg = parseSvgColorAndOpacity(bgFill);
      if (parsedBg.color !== 'none') {
        const op = parsedBg.opacity !== undefined && parsedBg.opacity < 1 ? ` fill-opacity="${parsedBg.opacity}"` : '';
        elementsMarkup.push(`  <rect width="100%" height="100%" fill="${parsedBg.color}"${op} />`);
      }
    }

    // 2. Render Nodes
    const rootNodes = layout.nodes.filter(n => !n.parentId && !n.parent);
    const nodesToRender = rootNodes.length > 0 ? rootNodes : layout.nodes;
    const rootSiblingCounts = new Map<string, number>();
    for (const n of nodesToRender) {
      rootSiblingCounts.set(n.type, (rootSiblingCounts.get(n.type) || 0) + 1);
    }

    for (let i = 0; i < nodesToRender.length; i++) {
      const node = nodesToRender[i]!;
      const rootContext: LayerNamingContext = {
        parentName: layout.canvas.name || 'Canvas',
        parentType: 'canvas',
        siblingIndex: i,
        totalSiblings: nodesToRender.length,
        siblingCountsByType: rootSiblingCounts,
        humanizeLayerNames: this.humanizeLayerNames,
      };
      const markup = await this.renderNode(node, '  ', rootContext);
      if (markup) {
        elementsMarkup.push(markup);
      }
    }

    // 3. Assemble SVG
    const defsBlock = this.defs.length > 0
      ? `  <defs>\n${this.defs.map(d => `    ${d}`).join('\n')}\n  </defs>\n`
      : '';

    const rawSvg = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 ${width} ${height}" width="${scaledW}" height="${scaledH}">`,
      defsBlock + elementsMarkup.join('\n'),
      `</svg>`
    ].filter(Boolean).join('\n');

    const shouldConvertTextToPath = (options?.textToPath ?? this.textToPath)
      || Boolean(layout.canvas.properties?.textToPath)
      || Boolean(layout.canvas.properties?.['text-to-path'])
      || Boolean(layout.canvas.properties?.textAsPath)
      || Boolean(layout.canvas.properties?.['text-as-path']);

    if (shouldConvertTextToPath) {
      try {
        const effectiveBasePath = options?.basePath || this.basePath;
        if (layout.fonts && layout.fonts.length > 0) {
          FontLoader.registerFontDirectives(layout.fonts, effectiveBasePath);
        }
        const { convertSVGTextToPath } = await import('@napi-rs/canvas');
        const textRegex = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
        return rawSvg.replace(textRegex, (match, attrs) => {
          try {
            const idMatch = attrs.match(/\bid="([^"]+)"/);
            const dataNameMatch = attrs.match(/\bdata-name="([^"]+)"/);
            const labelMatch = attrs.match(/\binkscape:label="([^"]+)"/);

            const idAttr = idMatch ? ` id="${idMatch[1]}"` : '';
            const dataNameAttr = dataNameMatch ? ` data-name="${dataNameMatch[1]}"` : '';
            const labelAttr = labelMatch ? ` inkscape:label="${labelMatch[1]}"` : '';

            const miniSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${match}</svg>`;
            const convertedMini = convertSVGTextToPath(Buffer.from(miniSvg)).toString('utf-8');

            const paths = convertedMini.match(/<path[^>]+>/g);
            if (!paths || paths.length === 0) {
              return match;
            }

            return `<g${idAttr}${dataNameAttr}${labelAttr}>\n        ${paths.join('\n        ')}\n      </g>`;
          } catch (itemErr: any) {
            console.warn(`[SvgExporter] text-to-path conversion failed for text element: ${itemErr?.message || String(itemErr)}`);
            return match;
          }
        });
      } catch (err: any) {
        console.warn(`[SvgExporter] text-to-path conversion failed: ${err?.message || String(err)}. Falling back to raw text SVG.`);
        return rawSvg;
      }
    }

    return rawSvg;
  }

  private async renderNode(node: LayoutNode, indent = '  ', context?: LayerNamingContext): Promise<string> {
    const attrs: string[] = [];

    const layerName = resolveHumanLayerName(node, {
      ...context,
      humanizeLayerNames: this.humanizeLayerNames,
    });

    if (node.id && !node.id.startsWith('__auto_')) {
      attrs.push(`id="${this.escapeAttr(node.id)}"`);
    }

    if (this.humanizeLayerNames) {
      attrs.push(`data-name="${this.escapeAttr(layerName)}"`);
      attrs.push(`inkscape:label="${this.escapeAttr(layerName)}"`);
    }

    if (node.style.opacity !== undefined && node.style.opacity < 1) {
      attrs.push(`opacity="${node.style.opacity}"`);
    }

    const transforms: string[] = [];
    if (node.style.rotation || node.style.scale !== undefined || node.style.skewX || node.style.skewY) {
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
      
      transforms.push(`translate(${originX} ${originY})`);
      if (node.style.rotation) {
        transforms.push(`rotate(${node.style.rotation})`);
      }
      if (node.style.scale !== undefined) {
        const sx = typeof node.style.scale === 'number' ? node.style.scale : (node.style.scale.x ?? 1);
        const sy = typeof node.style.scale === 'number' ? node.style.scale : (node.style.scale.y ?? 1);
        transforms.push(`scale(${sx} ${sy})`);
      }
      if (node.style.skewX || node.style.skewY) {
        const kx = node.style.skewX ? Math.tan((node.style.skewX * Math.PI) / 180) : 0;
        const ky = node.style.skewY ? Math.tan((node.style.skewY * Math.PI) / 180) : 0;
        transforms.push(`matrix(1 ${ky} ${kx} 1 0 0)`);
      }
      transforms.push(`translate(${-originX} ${-originY})`);
    }

    if (transforms.length > 0) {
      attrs.push(`transform="${transforms.join(' ')}"`);
    }

    if (node.style.backdropFilter) {
      // CSS backdrop-filter is the most reliable way in modern browsers for SVG
      attrs.push(`style="backdrop-filter: ${this.escapeAttr(node.style.backdropFilter)}; -webkit-backdrop-filter: ${this.escapeAttr(node.style.backdropFilter)};"`);
    }

    const filterId = this.createFilterAndShadowDef(node.style.filter, node.style.shadow, node.style.outerGlow);
    if (filterId) {
      attrs.push(`filter="url(#${filterId})"`);
    }

    const parentKey = node.parentId || 'root';
    if (node.style.clip === true) {
      // This element IS the clip base for the following sibling (raster/PSD
      // parity); it does not clip itself.
      const ownClipId = this.createClipPathDef(node);
      const chained = this.pendingClipByParent.get(parentKey);
      if (chained) {
        attrs.push(`clip-path="url(#${chained})"`);
      }
      this.pendingClipByParent.set(parentKey, ownClipId);
    } else {
      const pendingClip = this.pendingClipByParent.get(parentKey);
      let effectiveClip = pendingClip;
      this.pendingClipByParent.delete(parentKey);

      if (node.maskNode) {
        const maskClipId = this.createClipPathDef(node.maskNode);
        if (effectiveClip) {
          const compositeId = `clip_composite_${++this.clipCounter}`;
          this.defs.push(
            `<clipPath id="${compositeId}" clip-path="url(#${effectiveClip})">\n      <use href="#${maskClipId}" />\n    </clipPath>`
          );
          effectiveClip = compositeId;
        } else {
          effectiveClip = maskClipId;
        }
      }

      if (effectiveClip) {
        attrs.push(`clip-path="url(#${effectiveClip})"`);
      }
    }

    const fillAttr = this.getFillAttr(node);
    const strokeAttrs = this.getStrokeAttrs(node);

    switch (node.type) {
      case 'rect': {
        const r = node.style.borderRadius;
        if (typeof r === 'number' && r > 0) {
          return `${indent}<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${r}" ry="${r}" ${fillAttr} ${strokeAttrs} ${attrs.join(' ')} />`.replace(/\s+/g, ' ');
        } else if (Array.isArray(r) && r.length === 4) {
          const [tl = 0, tr = 0, br = 0, bl = 0] = r;
          const x = node.x;
          const y = node.y;
          const w = node.width;
          const h = node.height;
          const pathD = `M ${x + tl} ${y} H ${x + w - tr} A ${tr} ${tr} 0 0 1 ${x + w} ${y + tr} V ${y + h - br} A ${br} ${br} 0 0 1 ${x + w - br} ${y + h} H ${x + bl} A ${bl} ${bl} 0 0 1 ${x} ${y + h - bl} V ${y + tl} A ${tl} ${tl} 0 0 1 ${x + tl} ${y} Z`;
          return `${indent}<path d="${pathD}" ${fillAttr} ${strokeAttrs} ${attrs.join(' ')} />`.replace(/\s+/g, ' ');
        } else {
          return `${indent}<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" ${fillAttr} ${strokeAttrs} ${attrs.join(' ')} />`.replace(/\s+/g, ' ');
        }
      }

      case 'circle': {
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        const rx = node.width / 2;
        const ry = node.height / 2;

        if (Math.abs(rx - ry) < 0.001) {
          return `${indent}<circle cx="${cx}" cy="${cy}" r="${rx}" ${fillAttr} ${strokeAttrs} ${attrs.join(' ')} />`.replace(/\s+/g, ' ');
        } else {
          return `${indent}<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${fillAttr} ${strokeAttrs} ${attrs.join(' ')} />`.replace(/\s+/g, ' ');
        }
      }

      case 'polygon': {
        const points = node.polygonLayout?.canvasPoints;
        if (!points || points.length === 0) return '';

        const radius = typeof node.style.borderRadius === 'number'
          ? node.style.borderRadius
          : Array.isArray(node.style.borderRadius) && node.style.borderRadius.length > 0
            ? node.style.borderRadius[0]
            : 0;

        if (!radius || radius <= 0) {
          const ptsStr = points.map(p => `${p.x},${p.y}`).join(' ');
          return `${indent}<polygon points="${ptsStr}" ${fillAttr} ${strokeAttrs} ${attrs.join(' ')} />`.replace(/\s+/g, ' ');
        } else {
          const pathD = this.buildRoundedPolygonSvgPath(points, radius);
          return `${indent}<path d="${pathD}" ${fillAttr} ${strokeAttrs} ${attrs.join(' ')} />`.replace(/\s+/g, ' ');
        }
      }

      case 'text': {
        const fontSize = node.textLayout?.fontSize || 16;
        const fontFamily = node.textLayout?.fontFamily || 'sans-serif';
        const lineHeight = node.textLayout?.lineHeight || Math.round(fontSize * 1.25);
        const lines = node.textLayout?.lines || [(node as any).text || ''];

        const align = node.style.align || 'left';
        let anchorX = node.x;
        let textAnchor = 'start';
        if (align === 'center') {
          anchorX = node.x + node.width / 2;
          textAnchor = 'middle';
        } else if (align === 'right') {
          anchorX = node.x + node.width;
          textAnchor = 'end';
        }

        const tlHeightSvg = node.textLayout?.height ?? 0;
        const opticalOffsetSvg = node.textLayout?.opticalCenterOffset ?? 0;
        const lineCountSvg = lines.length || 1;
        const isMiddleSvg = node.style.verticalAlign === 'middle';

        const rawFamily = node.textLayout?.fontFamily || 'sans-serif';
        // Extract clean primary family name for SVG presentation attribute (Photopea, Illustrator, Inkscape)
        const primaryFamily = rawFamily.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '') || 'sans-serif';

        // Helper to format CSS font-family stack with proper quoting for multi-word fonts
        const formatCssFamily = (fam: string): string => {
          return fam.split(',').map(part => {
            const trimmed = part.trim();
            if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system)$/i.test(trimmed)) {
              return trimmed;
            }
            const unquoted = trimmed.replace(/^['"]|['"]$/g, '');
            return `'${unquoted}'`;
          }).join(', ');
        };

        const formattedCssFontFamily = rawFamily.includes(',')
          ? formatCssFamily(rawFamily)
          : (primaryFamily === 'sans-serif' || primaryFamily === 'serif' || primaryFamily === 'monospace'
              ? primaryFamily
              : `'${primaryFamily}', sans-serif`);

        const fontWeight = node.textLayout?.fontWeight ? String(node.textLayout.fontWeight) : '';
        const fontStyle = node.textLayout?.fontStyle ? String(node.textLayout.fontStyle) : '';

        // Resolve exact PostScript font name (e.g. SegoeUI-Bold, Consolas-Bold) for Photopea, Photoshop, and Illustrator
        const postScriptName = FontLoader.resolvePostScriptName(primaryFamily, fontWeight, fontStyle);
        const lowerFam = primaryFamily.toLowerCase();
        const isMono = lowerFam.includes('mono') || lowerFam.includes('consolas') || lowerFam.includes('courier') || lowerFam.includes('code');
        const isSerif = (lowerFam.includes('serif') || lowerFam.includes('times') || lowerFam.includes('georgia') || lowerFam.includes('garamond') || lowerFam.includes('merriweather') || lowerFam.includes('playfair')) && !lowerFam.includes('sans');
        const genericFallback = isMono ? 'monospace' : (isSerif ? 'serif' : 'sans-serif');

        let familyAttr = primaryFamily;
        if (postScriptName && postScriptName.toLowerCase() !== primaryFamily.toLowerCase()) {
          familyAttr = `${postScriptName}, '${primaryFamily}', ${genericFallback}`;
        } else if (rawFamily.includes(',')) {
          familyAttr = rawFamily;
        }

        const fontStyles: string[] = [];
        if (postScriptName && postScriptName.toLowerCase() !== primaryFamily.toLowerCase()) {
          fontStyles.push(`font-family: ${postScriptName}, '${primaryFamily}', ${genericFallback};`);
        }
        if (fontWeight) fontStyles.push(`font-weight: ${fontWeight};`);
        if (fontStyle) fontStyles.push(`font-style: ${fontStyle};`);
        if (node.style.letterSpacing) fontStyles.push(`letter-spacing: ${node.style.letterSpacing}px;`);
        if (node.style.fontFeatures) {
          fontStyles.push(`font-feature-settings: ${Array.isArray(node.style.fontFeatures) ? node.style.fontFeatures.map(f => `"${f}" 1`).join(', ') : node.style.fontFeatures};`);
        }
        if (node.style.fontVariation) {
          fontStyles.push(`font-variation-settings: ${typeof node.style.fontVariation === 'object' ? Object.entries(node.style.fontVariation).map(([k, v]) => `"${k}" ${v}`).join(', ') : node.style.fontVariation};`);
        }
        const styleAttr = fontStyles.length > 0 ? `style="${this.escapeAttr(fontStyles.join(' '))}"` : '';

        // Exact Skia Canvas parity:
        let baselineY: number;
        if (isMiddleSvg) {
          baselineY = node.y + (node.height - (lineCountSvg - 1) * lineHeight) / 2 + opticalOffsetSvg;
        } else {
          const valignShiftSvg = node.style.verticalAlign === 'bottom'
            ? Math.max(0, node.height - tlHeightSvg)
            : 0;
          const ascent = node.textLayout?.ascent ?? Math.round(fontSize * 0.8);
          baselineY = node.y + valignShiftSvg + ascent;
        }

        const textAttrs = [
          `x="${anchorX}"`,
          `y="${baselineY}"`,
          `font-family="${this.escapeAttr(familyAttr)}"`,
          `font-size="${fontSize}"`,
          fontWeight ? `font-weight="${this.escapeAttr(fontWeight)}"` : '',
          fontStyle ? `font-style="${this.escapeAttr(fontStyle)}"` : '',
          `text-anchor="${textAnchor}"`,
          node.style.letterSpacing ? `letter-spacing="${node.style.letterSpacing}"` : '',
          node.style.textTransform && node.style.textTransform !== 'none' ? `text-transform="${this.escapeAttr(node.style.textTransform)}"` : '',
          'xml:space="preserve"',
          styleAttr,
          fillAttr,
          strokeAttrs,
          ...attrs
        ].filter(Boolean).join(' ');

        if (lines.length <= 1) {
          return `${indent}<text ${textAttrs}>${this.escapeXml(lines[0] || '')}</text>`;
        }

        const tspans = lines.map((l, i) => {
          if (i === 0) {
            return `<tspan>${this.escapeXml(l)}</tspan>`;
          }
          const lineY = baselineY + i * lineHeight;
          return `<tspan x="${anchorX}" y="${lineY}">${this.escapeXml(l)}</tspan>`;
        }).join('');

        return `${indent}<text ${textAttrs}>${tspans}</text>`;
      }

      case 'image': {
        let href = node.imageLayout?.src || (node as any).src || '';
        if (this.embedImages && href && !href.startsWith('data:') && !href.startsWith('http')) {
          href = this.resolveAndEncodeImage(href);
        }

        const fit = node.imageLayout?.fit || (node as any).fit || 'fill';
        if (fit === 'none') {
          // Raster draws the image at its NATURAL size centered in the box
          // and clips — reproduce that with a nested <svg> viewport.
          try {
            const img = await resolveSharedImage(node.imageLayout?.src || (node as any).src || '', this.basePath);
            const iw = img?.width ?? 0;
            const ih = img?.height ?? 0;
            if (iw > 0 && ih > 0) {
              const cx = node.x + node.width / 2;
              const cy = node.y + node.height / 2;
              return `${indent}<svg x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" viewBox="${node.x} ${node.y} ${node.width} ${node.height}" overflow="hidden">\n` +
                `${indent}  <image x="${cx - iw / 2}" y="${cy - ih / 2}" width="${iw}" height="${ih}" href="${href}" preserveAspectRatio="none" />\n${indent}</svg>`;
            }
          } catch { /* fall through to stretched image */ }
        }
        const preserveAspect = fit === 'cover' ? 'xMidYMid slice' : fit === 'contain' ? 'xMidYMid meet' : fit === 'none' ? 'none' : 'none';
        return `${indent}<image x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" href="${href}" preserveAspectRatio="${preserveAspect}" ${attrs.join(' ')} />`.replace(/\s+/g, ' ');
      }

      case 'path':
      case 'shape':
      case 'icon':
      case 'star':
      case 'triangle':
      case 'arrow':
      case 'cross': {
        const d = node.pathLayout?.d;
        if (!d) return '';
        const pathTransforms: string[] = [];
        if (transforms.length > 0) {
          pathTransforms.push(...transforms);
        }
        pathTransforms.push(`translate(${node.x} ${node.y})`);
        if (node.type === 'icon') {
          pathTransforms.push(`scale(${node.width / 24} ${node.height / 24})`);
        }
        const filteredAttrs = attrs.filter(a => !a.startsWith('transform='));
        return `${indent}<path d="${d}" transform="${pathTransforms.join(' ')}" ${fillAttr} ${strokeAttrs} ${filteredAttrs.join(' ')} />`.replace(/\s+/g, ' ');
      }

      case 'stack':
      case 'group':
      case 'grid': {
        const childrenMarkup: string[] = [];
        if (node.style.fill || node.style.stroke) {
          const r = node.style.borderRadius;
          let bgMarkup = '';
          if (typeof r === 'number' && r > 0) {
            bgMarkup = `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${r}" ry="${r}" ${this.getFillAttr(node)} ${this.getStrokeAttrs(node)} />`;
          } else if (Array.isArray(r) && r.length === 4) {
            const [tl = 0, tr = 0, br = 0, bl = 0] = r;
            const x = node.x;
            const y = node.y;
            const w = node.width;
            const h = node.height;
            const pathD = `M ${x + tl} ${y} H ${x + w - tr} A ${tr} ${tr} 0 0 1 ${x + w} ${y + tr} V ${y + h - br} A ${br} ${br} 0 0 1 ${x + w - br} ${y + h} H ${x + bl} A ${bl} ${bl} 0 0 1 ${x} ${y + h - bl} V ${y + tl} A ${tl} ${tl} 0 0 1 ${x + tl} ${y} Z`;
            bgMarkup = `<path d="${pathD}" ${this.getFillAttr(node)} ${this.getStrokeAttrs(node)} />`;
          } else {
            bgMarkup = `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" ${this.getFillAttr(node)} ${this.getStrokeAttrs(node)} />`;
          }
          childrenMarkup.push(indent + '  ' + bgMarkup.replace(/\s+/g, ' '));
        }
        if (node.children && node.children.length > 0) {
          const childCountsByType = new Map<string, number>();
          for (const child of node.children) {
            childCountsByType.set(child.type, (childCountsByType.get(child.type) || 0) + 1);
          }

          for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i]!;
            const childContext: LayerNamingContext = {
              parentName: layerName,
              parentType: node.type,
              siblingIndex: i,
              totalSiblings: node.children.length,
              siblingCountsByType: childCountsByType,
              humanizeLayerNames: this.humanizeLayerNames,
            };
            const childSvg = await this.renderNode(child, indent + '  ', childContext);
            if (childSvg) childrenMarkup.push(childSvg);
          }
        }
        const titleTag = this.humanizeLayerNames ? `${indent}  <title>${this.escapeXml(layerName)}</title>\n` : '';
        return `${indent}<g ${attrs.join(' ')}>\n${titleTag}${childrenMarkup.join('\n')}\n${indent}</g>`;
      }

      default:
        return '';
    }
  }

  private buildRoundedPolygonSvgPath(points: Array<{ x: number; y: number }>, radius: number): string {
    const n = points.length;
    if (n < 3) return '';

    const pathParts: string[] = [];
    const midX = (points[n - 1]!.x + points[0]!.x) / 2;
    const midY = (points[n - 1]!.y + points[0]!.y) / 2;
    pathParts.push(`M ${midX} ${midY}`);

    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n]!;
      const curr = points[i]!;
      const next = points[(i + 1) % n]!;

      // Vector prev -> curr
      const v1x = prev.x - curr.x;
      const v1y = prev.y - curr.y;
      const len1 = Math.hypot(v1x, v1y) || 1;
      const u1x = v1x / len1;
      const u1y = v1y / len1;

      // Vector next -> curr
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      const len2 = Math.hypot(v2x, v2y) || 1;
      const u2x = v2x / len2;
      const u2y = v2y / len2;

      // Cosine of angle between vectors
      const dot = u1x * u2x + u1y * u2y;
      const clampedDot = Math.max(-0.999, Math.min(0.999, dot));
      const angle = Math.acos(clampedDot);
      const halfAngle = angle / 2;

      const d = radius / Math.tan(halfAngle);
      const maxD = Math.min(len1 / 2, len2 / 2);
      const actualD = Math.min(d, maxD);
      const actualR = actualD * Math.tan(halfAngle);

      const pInX = curr.x + u1x * actualD;
      const pInY = curr.y + u1y * actualD;
      const pOutX = curr.x + u2x * actualD;
      const pOutY = curr.y + u2y * actualD;

      // Cross product of incoming and outgoing edge vectors determines turning direction (CW vs CCW)
      const sweepFlag = (v1y * v2x - v1x * v2y) >= 0 ? 1 : 0;

      pathParts.push(`L ${pInX} ${pInY}`);
      pathParts.push(`A ${actualR} ${actualR} 0 0 ${sweepFlag} ${pOutX} ${pOutY}`);
    }

    pathParts.push('Z');
    return pathParts.join(' ');
  }

  private getFillAttr(node: LayoutNode): string {
    const fill = node.style.fill || node.fill;
    if (!fill) {
      if (node.type === 'text') {
        const parsed = parseSvgColorAndOpacity(node.style.color || '#000000');
        if (parsed.color === 'none') return 'fill="none"';
        let res = `fill="${this.escapeAttr(parsed.color)}"`;
        if (parsed.opacity !== undefined && parsed.opacity < 1) {
          res += ` fill-opacity="${parsed.opacity}"`;
        }
        return res;
      }
      return 'fill="none"';
    }
    const val = this.processFill(fill, node.box);
    const parsed = parseSvgColorAndOpacity(val);
    if (parsed.color === 'none') return 'fill="none"';
    let res = `fill="${this.escapeAttr(parsed.color)}"`;
    if (parsed.opacity !== undefined && parsed.opacity < 1) {
      res += ` fill-opacity="${parsed.opacity}"`;
    }
    return res;
  }

  private getStrokeAttrs(node: LayoutNode): string {
    const stroke = node.style.stroke;
    // Parity with raster rendering: a stroke color without an explicit width
    // strokes at 1px instead of disappearing.
    const strokeWidth = node.style.strokeWidth ?? 1;
    if (!stroke || strokeWidth <= 0) return '';

    const parsed = parseSvgColorAndOpacity(stroke);
    if (parsed.color === 'none') return '';
    let res = `stroke="${this.escapeAttr(parsed.color)}" stroke-width="${strokeWidth}"`;
    if (parsed.opacity !== undefined && parsed.opacity < 1) {
      res += ` stroke-opacity="${parsed.opacity}"`;
    }
    if (node.style.strokeCap) {
      res += ` stroke-linecap="${this.escapeAttr(node.style.strokeCap)}"`;
    }
    if (node.style.strokeJoin) {
      res += ` stroke-linejoin="${this.escapeAttr(node.style.strokeJoin)}"`;
    }
    if (node.style.strokeStyle === 'dashed') {
      res += ` stroke-dasharray="${strokeWidth * 3},${strokeWidth * 2}"`;
    } else if (node.style.strokeStyle === 'dotted') {
      res += ` stroke-dasharray="${strokeWidth},${strokeWidth}"`;
    }
    return res;
  }

  private processFill(fill: string | GradientStyle | any, box: { x: number; y: number; w: number; h: number }): string {
    if (typeof fill === 'string') {
      return fill;
    }

    if (typeof fill === 'object' && fill.type === 'linear') {
      const gradId = `lin_grad_${++this.gradientCounter}`;
      let angle = fill.angle;
      if (angle === undefined && fill.direction) {
        const dir = fill.direction.toLowerCase().trim();
        if (dir === 'to right') angle = 90;
        else if (dir === 'to bottom') angle = 180;
        else if (dir === 'to left') angle = 270;
        else if (dir === 'to top') angle = 0;
        else if (dir.includes('bottom') && dir.includes('right')) angle = 135;
        else if (dir.includes('top') && dir.includes('right')) angle = 45;
        else if (dir.includes('bottom') && dir.includes('left')) angle = 225;
        else if (dir.includes('top') && dir.includes('left')) angle = 315;
      }
      if (angle === undefined) angle = 180;

      const rad = ((angle - 90) * Math.PI) / 180;
      const x1 = Math.round(50 + Math.cos(rad + Math.PI) * 50);
      const y1 = Math.round(50 + Math.sin(rad + Math.PI) * 50);
      const x2 = Math.round(50 + Math.cos(rad) * 50);
      const y2 = Math.round(50 + Math.sin(rad) * 50);

      const distributedStops = distributeGradientStops(fill.stops || []);
      const stopsXml = distributedStops.map(s => {
        const offsetPct = Math.round(s.position * 100);
        return `<stop offset="${offsetPct}%" ${formatStopAttributes(s.color)} />`;
      }).join('\n      ');

      this.defs.push(
        `<linearGradient id="${gradId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%" color-interpolation="sRGB">\n      ${stopsXml}\n    </linearGradient>`
      );
      return `url(#${gradId})`;
    }

    if (typeof fill === 'object' && fill.type === 'radial') {
      const gradId = `rad_grad_${++this.gradientCounter}`;
      const distributedStops = distributeGradientStops(fill.stops || []);
      const stopsXml = distributedStops.map(s => {
        const offsetPct = Math.round(s.position * 100);
        return `<stop offset="${offsetPct}%" ${formatStopAttributes(s.color)} />`;
      }).join('\n      ');

      this.defs.push(
        `<radialGradient id="${gradId}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%" color-interpolation="sRGB">\n      ${stopsXml}\n    </radialGradient>`
      );
      return `url(#${gradId})`;
    }

    if (typeof fill === 'object' && fill.type === 'conic') {
      // SVG has no native conic gradient: approximate with a wedge pattern
      // sampled around the box center (6-degree segments, lerped stop colors).
      const patId = `conic_grad_${++this.gradientCounter}`;
      const stops = distributeGradientStops(fill.stops || []);
      const rgbaStops = stops.map(s => ({ pos: s.position, c: parseColorToRgba(s.color) }));
      const ccx = box.x + box.w / 2;
      const ccy = box.y + box.h / 2;
      const radius = Math.sqrt(
        Math.pow(Math.max(ccx - box.x, box.x + box.w - ccx), 2) +
        Math.pow(Math.max(ccy - box.y, box.y + box.h - ccy), 2)
      ) * 1.05 + 2;
      let startDeg = typeof fill.angle === 'number' ? fill.angle : 0;
      if (startDeg === 0 && typeof fill.direction === 'string' && fill.direction.trim() !== '') {
        const dir = fill.direction.toLowerCase().trim();
        if (dir === 'to right') startDeg = 90;
        else if (dir === 'to bottom') startDeg = 180;
        else if (dir === 'to left') startDeg = 270;
      }
      const SEG = 6;
      const colAt = (t: number): string => {
        if (rgbaStops.length === 0) return '#000000';
        const firstStop = rgbaStops[0];
        const lastStop = rgbaStops[rgbaStops.length - 1];
        if (t <= firstStop.pos) return rgbStr(firstStop.c);
        if (t >= lastStop.pos) return rgbStr(lastStop.c);
        for (let si = 0; si < rgbaStops.length - 1; si++) {
          const a = rgbaStops[si];
          const b = rgbaStops[si + 1];
          if (t <= b.pos) {
            const f = b.pos === a.pos ? 0 : (t - a.pos) / (b.pos - a.pos);
            return rgbStr({
              r: a.c.r + (b.c.r - a.c.r) * f,
              g: a.c.g + (b.c.g - a.c.g) * f,
              b: a.c.b + (b.c.b - a.c.b) * f
            });
          }
        }
        return rgbStr(lastStop.c);
      };
      const wedges: string[] = [];
      for (let d = 0; d < 360; d += SEG) {
        const a0 = ((startDeg - 90 + d) * Math.PI) / 180;
        const a1 = ((startDeg - 90 + d + SEG) * Math.PI) / 180;
        const x0 = (ccx + Math.cos(a0) * radius).toFixed(2);
        const y0 = (ccy + Math.sin(a0) * radius).toFixed(2);
        const x1 = (ccx + Math.cos(a1) * radius).toFixed(2);
        const y1 = (ccy + Math.sin(a1) * radius).toFixed(2);
        wedges.push(`<path d="M ${ccx} ${ccy} L ${x0} ${y0} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${x1} ${y1} Z" fill="${colAt((d + SEG / 2) / 360)}" />`);
      }
      const pw = Math.max(1, box.w);
      const ph = Math.max(1, box.h);
      this.defs.push(
        `<pattern id="${patId}" patternUnits="userSpaceOnUse" x="${box.x}" y="${box.y}" width="${pw}" height="${ph}">
      <rect x="${box.x}" y="${box.y}" width="${pw}" height="${ph}" fill-opacity="0" />
      ${wedges.join('\n      ')}
    </pattern>`
      );
      return `url(#${patId})`;
    }

    return '#000000';
  }

  private createClipPathDef(node: LayoutNode): string {
    const clipId = `clip_${++this.clipCounter}`;
    let innerContent = '';

    if (node.type === 'circle') {
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      const rx = node.width / 2;
      const ry = node.height / 2;
      innerContent = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" />`;
    } else if (node.type === 'polygon' && node.polygonLayout) {
      const pts = node.polygonLayout.canvasPoints.map(p => `${p.x},${p.y}`).join(' ');
      innerContent = `<polygon points="${this.escapeAttr(pts)}" />`;
    } else if ((node.type === 'path' || node.type === 'shape' || ['star', 'triangle', 'arrow', 'cross'].includes(node.type)) && node.pathLayout) {
      // Path data is generated in LOCAL coordinates; anchor it at the node's
      // position (parity with raster clipping).
      innerContent = `<path d="${this.escapeAttr(node.pathLayout.d)}" transform="translate(${node.x} ${node.y})" />`;
    } else if (node.type === 'icon' && node.pathLayout) {
      const sx = node.width / 24;
      const sy = node.height / 24;
      innerContent = `<path d="${this.escapeAttr(node.pathLayout.d)}" transform="translate(${node.x} ${node.y}) scale(${sx} ${sy})" />`;
    } else {
      const r = node.style.borderRadius;
      if (typeof r === 'number' && r > 0) {
        innerContent = `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${r}" ry="${r}" />`;
      } else {
        innerContent = `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" />`;
      }
    }

    this.defs.push(
      `<clipPath id="${clipId}">\n      ${innerContent}\n    </clipPath>`
    );
    return clipId;
  }

  private createFilterAndShadowDef(
    filterStr?: string,
    shadow?: { offsetX: number; offsetY: number; blur: number; color: string },
    outerGlow?: { color?: string; size?: number; opacity?: number }
  ): string | null {
    const parsed = filterStr ? parseFilterString(filterStr) : [];
    if (parsed.length === 0 && !shadow && !outerGlow) return null;

    const filterId = `filter_${++this.filterCounter}`;
    const feElements: string[] = [];

    /** Numeric arg reader: accepts "1.5", "150%", "10px", "90deg". */
    const numArg = (raw: string | undefined, def: number): number => {
      if (raw === undefined || raw === '') return def;
      const m = String(raw).match(/(-?[0-9]*\.?[0-9]+)/);
      if (!m) return def;
      const v = parseFloat(m[1]);
      return /%\s*$/.test(String(raw)) ? v / 100 : v;
    };

    for (const f of parsed) {
      if (f.name === 'blur') {
        const val = numArg(f.args[0], 0);
        feElements.push(`<feGaussianBlur stdDeviation="${val / 2}" />`);
      } else if (f.name === 'drop-shadow') {
        // args: <dx> <dy> <blur> <color>
        const dx = numArg(f.args[0], 0);
        const dy = numArg(f.args[1], 0);
        const blur = numArg(f.args[2], 0);
        const color = f.args[3] || 'rgba(0,0,0,0.5)';
        feElements.push(`<feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${blur / 2}" flood-color="${this.escapeAttr(color)}" />`);
      } else if (f.name === 'opacity') {
        const val = Math.max(0, Math.min(1, numArg(f.args[0], 1)));
        feElements.push(`<feComponentTransfer><feFuncA type="linear" slope="${val}"/></feComponentTransfer>`);
      } else if (f.name === 'brightness') {
        const val = parseFloat(f.args[0] || '1') || 1;
        feElements.push(`<feComponentTransfer><feFuncR type="linear" slope="${val}"/><feFuncG type="linear" slope="${val}"/><feFuncB type="linear" slope="${val}"/></feComponentTransfer>`);
      } else if (f.name === 'contrast') {
        const cv = Math.max(0, numArg(f.args[0], 1));
        const intercept = 0.5 - 0.5 * cv;
        feElements.push(`<feComponentTransfer><feFuncR type="linear" slope="${cv}" intercept="${intercept}"/><feFuncG type="linear" slope="${cv}" intercept="${intercept}"/><feFuncB type="linear" slope="${cv}" intercept="${intercept}"/></feComponentTransfer>`);
      } else if (f.name === 'saturate') {
        const sv = Math.max(0, numArg(f.args[0], 1));
        feElements.push(`<feColorMatrix type="saturate" values="${sv}"/>`);
      } else if (f.name === 'grayscale') {
        const gv = Math.min(1, Math.max(0, numArg(f.args[0], 1)));
        feElements.push(`<feColorMatrix type="saturate" values="${1 - gv}"/>`);
      } else if (f.name === 'sepia') {
        const svv = Math.min(1, Math.max(0, numArg(f.args[0], 1)));
        const k = 1 - svv;
        feElements.push(`<feColorMatrix type="matrix" values="${(0.393 + 0.607 * k).toFixed(4)} ${(0.769 - 0.769 * k).toFixed(4)} ${(0.189 - 0.189 * k).toFixed(4)} 0 0 ${(0.349 - 0.349 * k).toFixed(4)} ${(0.686 + 0.314 * k).toFixed(4)} ${(0.168 - 0.168 * k).toFixed(4)} 0 0 ${(0.272 - 0.272 * k).toFixed(4)} ${(0.534 - 0.534 * k).toFixed(4)} ${(0.131 + 0.869 * k).toFixed(4)} 0 0 0 0 0 1 0" />`);
      } else if (f.name === 'invert') {
        const iv = Math.min(1, Math.max(0, numArg(f.args[0], 1)));
        const tv = `${iv} ${1 - iv}`;
        feElements.push(`<feComponentTransfer><feFuncR type="table" tableValues="${tv}"/><feFuncG type="table" tableValues="${tv}"/><feFuncB type="table" tableValues="${tv}"/></feComponentTransfer>`);
      } else if (f.name === 'hue-rotate') {
        const dv = parseFloat(f.args[0] || '0') || 0;
        feElements.push(`<feColorMatrix type="hueRotate" values="${dv}"/>`);
      }
    }

    if (shadow) {
      const parsedShadow = parseSvgColorAndOpacity(shadow.color);
      const op = parsedShadow.opacity !== undefined && parsedShadow.opacity < 1 ? ` flood-opacity="${parsedShadow.opacity}"` : '';
      feElements.push(
        `<feDropShadow dx="${shadow.offsetX}" dy="${shadow.offsetY}" stdDeviation="${shadow.blur / 2}" flood-color="${this.escapeAttr(parsedShadow.color)}"${op} />`
      );
    }

    if (outerGlow) {
      const parsedGlow = parseSvgColorAndOpacity(outerGlow.color || '#ffffff');
      const size = (outerGlow.size || 10) / 2;
      const effectiveOpacity = outerGlow.opacity !== undefined ? outerGlow.opacity : (parsedGlow.opacity !== undefined ? parsedGlow.opacity : 1);
      const op = effectiveOpacity < 1 ? ` flood-opacity="${effectiveOpacity}"` : '';
      feElements.push(
        `<feDropShadow dx="0" dy="0" stdDeviation="${size}" flood-color="${this.escapeAttr(parsedGlow.color)}"${op} />`
      );
    }

    if (feElements.length === 0) return null;

    this.defs.push(
      `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">\n      ${feElements.join('\n      ')}\n    </filter>`
    );
    return filterId;
  }

  private resolveAndEncodeImage(src: string): string {
    try {
      const targetPath = this.basePath
        ? path.resolve(path.dirname(this.basePath), src)
        : path.resolve(src);

      if (fs.existsSync(targetPath)) {
        const buf = fs.readFileSync(targetPath);
        const ext = path.extname(targetPath).toLowerCase();
        let mime = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
        else if (ext === '.svg') mime = 'image/svg+xml';
        else if (ext === '.webp') mime = 'image/webp';
        return `data:${mime};base64,${buf.toString('base64')}`;
      }
    } catch {}
    return src;
  }

  private escapeXml(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeAttr(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

/**
 * Convenience function to export a LayoutResult to an SVG string.
 */
export async function exportToSvg(layout: LayoutResult, options?: SvgExportOptions): Promise<string> {
  const exporter = new SvgExporter(options);
  return exporter.export(layout, options?.scale ?? 1, options);
}

/**
 * Convenience function to export a LayoutResult to an SVG Buffer.
 */
export async function exportToSvgBuffer(layout: LayoutResult, options?: SvgExportOptions): Promise<Buffer> {
  const svgStr = await exportToSvg(layout, options);
  return Buffer.from(svgStr, 'utf-8');
}
