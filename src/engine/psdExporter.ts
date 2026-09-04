/**
 * src/engine/psdExporter.ts
 * Native layered Photoshop PSD exporter powered by ag-psd and @napi-rs/canvas.
 * Generates layered documents with groups, clipping masks, editable text layers,
 * and raster fallbacks.
 */

import { initializeCanvas, writePsdBuffer, Psd, Layer, ColorMode, LayerVectorMask, BezierKnot, BezierPath, VectorContent, LayerEffectsInfo } from 'ag-psd';
import { createCanvas, Canvas, CanvasRenderingContext2D, loadImage, Image, Path2D } from '@napi-rs/canvas';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LayoutResult, LayoutNode } from '../parser/math.js';
import {
  drawRect,
  drawCircle,
  drawPolygon,
  createCanvasGradient,
  distributeGradientStops,
  mapBlendModeToPsd,
  parseColorToRgba,
  drawImageWithFit
} from './drawUtils.js';
import { FontLoader } from './fontLoader.js';
import { resolveSharedImage, splitUnsafeFilterFns, sanitizeFilterCss } from './imageCache.js';
import { svgPathToBezierPaths } from './vectorPathParser.js';

/**
 * Extracts polygon vertices from a straight-line SVG path (M/L/Z commands
 * only — the format generateShapePath emits). Returns LOCAL coordinates, or
 * null when the path contains curve commands we cannot map to knots.
 */
function parsePolygonPointsFromPathD(d: string): Array<{ x: number; y: number }> | null {
  if (!d) return null;
  const tokens = d.match(/[MLZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!tokens) return null;
  const pts: Array<{ x: number; y: number }> = [];
  let i = 0;
  let cmd = '';
  while (i < tokens.length) {
    const t = tokens[i];
    if (!t) break;
    if (/^[A-Za-z]$/.test(t)) {
      cmd = t.toUpperCase();
      i++;
      if (cmd === 'Z') continue;
      continue;
    }
    if ((cmd === 'M' || cmd === 'L') && i + 1 < tokens.length) {
      pts.push({ x: parseFloat(tokens[i]), y: parseFloat(tokens[i + 1]) });
      i += 2;
      // Subsequent coordinate pairs after M implicitly become L.
      if (cmd === 'M') cmd = 'L';
    } else {
      return null; // unexpected token: curves or malformed data
    }
  }
  return pts.length >= 3 ? pts : null;
}

// Initialize ag-psd with @napi-rs/canvas
let isInitialized = false;
function initPsdCanvas(): void {
  if (!isInitialized) {
    initializeCanvas((width: number, height: number) => {
      return createCanvas(width, height) as unknown as HTMLCanvasElement;
    });
    isInitialized = true;
  }
}

export interface Matrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export const IDENTITY_MATRIX: Matrix2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

export function isMatrixIdentity(m: Matrix2D): boolean {
  return Math.abs(m.a - 1) < 1e-6 &&
         Math.abs(m.b) < 1e-6 &&
         Math.abs(m.c) < 1e-6 &&
         Math.abs(m.d - 1) < 1e-6 &&
         Math.abs(m.tx) < 1e-6 &&
         Math.abs(m.ty) < 1e-6;
}

export function multiplyMatrix(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
    ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty,
  };
}

export function transformPoint(m: Matrix2D, x: number, y: number): { x: number; y: number } {
  return {
    x: m.a * x + m.c * y + m.tx,
    y: m.b * x + m.d * y + m.ty,
  };
}

export function getNodeLocalMatrix(node: LayoutNode): Matrix2D | null {
  const hasTransform = !!(node.style.rotation || node.style.scale !== undefined || node.style.skewX || node.style.skewY);
  if (!hasTransform) return null;

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

  const rad = node.style.rotation ? (node.style.rotation * Math.PI) / 180 : 0;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  let sx = 1;
  let sy = 1;
  if (node.style.scale !== undefined) {
    sx = typeof node.style.scale === 'number' ? node.style.scale : (node.style.scale.x ?? 1);
    sy = typeof node.style.scale === 'number' ? node.style.scale : (node.style.scale.y ?? 1);
  }

  const kx = node.style.skewX ? Math.tan((node.style.skewX * Math.PI) / 180) : 0;
  const ky = node.style.skewY ? Math.tan((node.style.skewY * Math.PI) / 180) : 0;

  const a = cos * sx - sin * sy * ky;
  const b = sin * sx + cos * sy * ky;
  const c = cos * sx * kx - sin * sy;
  const d = sin * sx * kx + cos * sy;

  const tx = originX - a * originX - c * originY;
  const ty = originY - b * originX - d * originY;

  return { a, b, c, d, tx, ty };
}

/**
 * Converts a CSS gradient angle (0deg = to top, clockwise) into the Photoshop
 * gradient convention ag-psd expects (90deg points up, measured
 * counterclockwise from the +x axis).
 */
export function cssGradientAngleToPhotoshop(css?: number | string): number {
  let cssAngle: number | undefined = undefined;
  if (typeof css === 'number' && Number.isFinite(css)) {
    cssAngle = css;
  } else if (typeof css === 'string') {
    const dir = css.toLowerCase().trim();
    if (dir === 'to top' || dir === 'to top center') cssAngle = 0;
    else if (dir === 'to right' || dir === 'to right center') cssAngle = 90;
    else if (dir === 'to bottom' || dir === 'to bottom center') cssAngle = 180;
    else if (dir === 'to left' || dir === 'to left center') cssAngle = 270;
    else if (dir.includes('top') && dir.includes('right')) cssAngle = 45;
    else if (dir.includes('bottom') && dir.includes('right')) cssAngle = 135;
    else if (dir.includes('bottom') && dir.includes('left')) cssAngle = 225;
    else if (dir.includes('top') && dir.includes('left')) cssAngle = 315;
  }
  if (cssAngle === undefined) cssAngle = 180; // CSS default direction: to bottom
  return (((90 - cssAngle) % 360) + 360) % 360;
}

export interface PsdExportOptions {
  scale?: number;
  dpi?: number;
  basePath?: string;
  generateThumbnail?: boolean;
}

export class PsdExporter {
  /**
   * Exports a LayoutResult to a native layered Photoshop PSD buffer.
   */
  public static async export(layout: LayoutResult, options: PsdExportOptions = {}): Promise<Buffer> {
    initPsdCanvas();

    const scale = options.scale && options.scale > 0 ? options.scale : 1;
    const docWidth = Math.max(1, Math.round(layout.canvas.width * scale));
    const docHeight = Math.max(1, Math.round(layout.canvas.height * scale));

    // Register fonts if any
    if (layout.fonts && layout.fonts.length > 0) {
      FontLoader.registerFontDirectives(layout.fonts, options.basePath);
    }

    const psdChildren: Layer[] = [];

    // 1. Background layer if canvas defines background fill
    if (layout.canvas.background) {
      const bgCanvas = createCanvas(docWidth, docHeight);
      const bgCtx = bgCanvas.getContext('2d');
      bgCtx.scale(scale, scale);

      const box = { x: 0, y: 0, w: layout.canvas.width, h: layout.canvas.height };
      if (typeof layout.canvas.background === 'string') {
        bgCtx.fillStyle = layout.canvas.background;
      } else {
        bgCtx.fillStyle = createCanvasGradient(bgCtx, layout.canvas.background as any, box);
      }
      bgCtx.fillRect(0, 0, layout.canvas.width, layout.canvas.height);

      const bgLayer: Layer = {
        name: 'Background',
        top: 0,
        left: 0,
        right: docWidth,
        bottom: docHeight,
        opacity: 1,
        blendMode: 'normal',
        canvas: bgCanvas as unknown as HTMLCanvasElement
      };
      psdChildren.push(bgLayer);
    }

    const effectiveDpi = options.dpi ?? 72;

    // 2. Build PSD Layers for Layout Nodes
    const rootNodes = layout.nodes.filter(n => !n.parentId && !n.parent);
    for (const node of (rootNodes.length > 0 ? rootNodes : layout.nodes)) {
      const layer = await this.buildPsdLayer(node, scale, options.basePath, effectiveDpi);
      if (layer) {
        psdChildren.push(layer);
      }
    }

    // 3. Construct PSD document with ImageResources (Resolution, Guides & Global Light)
    const imageResources: any = {};

    imageResources.resolutionInfo = {
      horizontalResolution: effectiveDpi,
      horizontalResolutionUnit: 'PPI',
      widthUnit: 'Inches',
      verticalResolution: effectiveDpi,
      verticalResolutionUnit: 'PPI',
      heightUnit: 'Inches'
    };

    if (layout.canvas.guides && layout.canvas.guides.length > 0) {
      imageResources.gridAndGuidesInformation = {
        guides: layout.canvas.guides.map(g => ({
          location: Math.round(g.location * scale),
          direction: g.direction
        }))
      };
    }

    if (layout.canvas.globalLight) {
      imageResources.globalAngle = layout.canvas.globalLight.angle;
      if (layout.canvas.globalLight.altitude !== undefined) {
        imageResources.globalAltitude = layout.canvas.globalLight.altitude;
      }
    }

    const psd: Psd = {
      width: docWidth,
      height: docHeight,
      channels: 3,
      bitsPerChannel: 8,
      colorMode: ColorMode.RGB,
      children: psdChildren,
      ...(Object.keys(imageResources).length > 0 ? { imageResources } : {})
    };

    // 4. Render composite canvas for PSD document preview
    const compositeCanvas = createCanvas(docWidth, docHeight);
    const compCtx = compositeCanvas.getContext('2d');
    compCtx.scale(scale, scale);

    if (layout.canvas.background) {
      compCtx.save();
      const box = { x: 0, y: 0, w: layout.canvas.width, h: layout.canvas.height };
      if (typeof layout.canvas.background === 'string') {
        compCtx.fillStyle = layout.canvas.background;
      } else {
        compCtx.fillStyle = createCanvasGradient(compCtx, layout.canvas.background as any, box);
      }
      compCtx.fillRect(0, 0, layout.canvas.width, layout.canvas.height);
      compCtx.restore();
    }

    for (const node of (rootNodes.length > 0 ? rootNodes : layout.nodes)) {
      await this.renderNodeToContext(compCtx, node, options.basePath);
    }

    psd.canvas = compositeCanvas as unknown as HTMLCanvasElement;

    // 5. Encode PSD buffer
    const buffer = writePsdBuffer(psd, {
      generateThumbnail: options.generateThumbnail ?? true
    });

    return buffer;
  }

  /**
   * Converts a single LayoutNode into an ag-psd Layer structure.
   */
  private static async buildPsdLayer(
    node: LayoutNode,
    scale: number,
    basePath?: string,
    dpi = 72,
    parentMatrix: Matrix2D = IDENTITY_MATRIX
  ): Promise<Layer | null> {
    const layer = await this.buildPsdLayerInternal(node, scale, basePath, dpi, parentMatrix);
    if (!layer || !node.maskNode) return layer;

    // Create a clipping mask group
    // In Photoshop, a clipping mask needs a base layer and a clipped layer.
    const maskLayer = await this.buildPsdLayerInternal(node.maskNode, scale, basePath, dpi, parentMatrix);
    if (!maskLayer) return layer;
    
    maskLayer.clipping = false; // Base mask layer
    layer.clipping = true; // Clipped layer
    
    return {
      name: `Mask Group (${layer.name})`,
      opened: true,
      children: [maskLayer, layer]
    };
  }

  private static async buildPsdLayerInternal(
    node: LayoutNode,
    scale: number,
    basePath?: string,
    dpi = 72,
    parentMatrix: Matrix2D = IDENTITY_MATRIX
  ): Promise<Layer | null> {
    const localMat = getNodeLocalMatrix(node);
    const currentMat = localMat ? multiplyMatrix(parentMatrix, localMat) : parentMatrix;
    const isIdentity = isMatrixIdentity(currentMat);

    let left: number;
    let top: number;
    let right: number;
    let bottom: number;
    let width: number;
    let height: number;

    if (isIdentity) {
      left = Math.round(node.x * scale);
      top = Math.round(node.y * scale);
      width = Math.max(1, Math.round(node.width * scale));
      height = Math.max(1, Math.round(node.height * scale));
      right = left + width;
      bottom = top + height;
    } else {
      const corners = [
        transformPoint(currentMat, node.x, node.y),
        transformPoint(currentMat, node.x + node.width, node.y),
        transformPoint(currentMat, node.x + node.width, node.y + node.height),
        transformPoint(currentMat, node.x, node.y + node.height),
      ];
      const minX = Math.min(...corners.map(c => c.x));
      const maxX = Math.max(...corners.map(c => c.x));
      const minY = Math.min(...corners.map(c => c.y));
      const maxY = Math.max(...corners.map(c => c.y));
      left = Math.round(minX * scale);
      top = Math.round(minY * scale);
      right = Math.round(maxX * scale);
      bottom = Math.round(maxY * scale);
      width = Math.max(1, right - left);
      height = Math.max(1, bottom - top);
    }

    const defaultName = node.type.charAt(0).toUpperCase() + node.type.slice(1);
    const layerName = node.name || node.id || defaultName;
    const opacity = node.opacity ?? 1;
    const blendMode = mapBlendModeToPsd(node.style.blendMode);

    // Photoshop Layer Metadata: layerColor, lock, fillOpacity, knockout
    const layerColor = node.style.layerColor || (node as any).layerColor;
    const fillOpacity = typeof node.style.fillOpacity === 'number' ? node.style.fillOpacity : (node as any).fillOpacity;
    const knockout = node.style.knockout ?? (node as any).knockout;
    const lockVal = node.style.lock || (node as any).lock;
    const protectedFlags = lockVal ? {
      composite: lockVal === 'all',
      position: lockVal === 'all' || lockVal === 'position',
      transparency: lockVal === 'all' || lockVal === 'transparency'
    } : undefined;

    // Group / Grid / Stack Container
    if (node.type === 'group' || node.type === 'grid' || node.type === 'stack') {
      const childLayers: Layer[] = [];
      if (node.children && node.children.length > 0) {
        let isCurrentMaskActive = false;

        for (let i = 0; i < node.children.length; i++) {
          const childNode = node.children[i]!;
          const isMask = childNode.style.clip === true || (childNode as any).clip === true;
          const childLayer = await this.buildPsdLayer(childNode, scale, basePath, dpi, currentMat);
          if (childLayer) {
            // Apply Photoshop clipping mask hierarchy
            if (isMask) {
              childLayer.clipping = false; // Base mask layer
              isCurrentMaskActive = true;
            } else if (isCurrentMaskActive) {
              childLayer.clipping = true;  // Clipped to base mask layer
            }
            childLayers.push(childLayer);
          }
        }
      }

      // If container defines fill/stroke background, add a background rect layer inside the group
      if (node.style.fill || node.style.stroke) {
        const bgNode: LayoutNode = {
          ...node,
          type: 'rect',
          name: `${layerName} Background`,
          children: undefined
        };
        const bgLayer = await this.buildPsdLayerInternal(bgNode, scale, basePath, dpi, currentMat);
        if (bgLayer) {
          childLayers.unshift(bgLayer);
        }
      }

      const groupLayer: Layer = {
        name: layerName,
        opened: true,
        opacity,
        blendMode,
        children: childLayers,
        ...(layerColor ? { layerColor: layerColor as any } : {}),
        ...(protectedFlags ? { protected: protectedFlags } : {}),
        ...(knockout !== undefined ? { knockout: !!knockout } : {})
      };

      return groupLayer;
    }

    // Text Element: Native Editable Photoshop Text Layer + Raster Fallback
    if (node.type === 'text') {
      const textContent = node.textLayout ? node.textLayout.lines.join('\n') : (node.name || 'Text');
      const baseFontSize = node.textLayout?.fontSize || 16;
      const fontSizePx = baseFontSize * scale;
      // Photoshop Type Tool font size and leading are measured in points (1 pt = 1/72 inch).
      // Converting through 72 / dpi ensures exact pixel parity when edited in Photoshop or Photopea.
      const fontSizePt = Number(((fontSizePx * 72) / dpi).toFixed(2));
      const fillColorStr = typeof node.fill === 'string' ? node.fill : node.style.fill && typeof node.style.fill === 'string' ? node.style.fill : node.style.color || '#000000';
      const rgba = parseColorToRgba(fillColorStr);
      const fontFamily = node.textLayout?.fontFamily || 'Arial';
      const fontWeight = node.textLayout?.fontWeight || 'normal';
      const fontStyle = node.textLayout?.fontStyle || 'normal';
      const postScriptFontName = this.mapFontFamilyToPostScript(fontFamily, fontWeight, fontStyle);
      // leading must live in the SCALED coordinate space of the layer in points.
      const baseLineHeight = node.textLayout?.lineHeight || (node.textLayout?.fontSize || 16) * 1.25;
      const lineHeightPx = baseLineHeight * scale;
      const lineHeightPt = Number(((lineHeightPx * 72) / dpi).toFixed(2));
      // Photoshop tracking is expressed in 1/1000 em, which is scale-independent.
      const lsRaw = typeof node.style.letterSpacing === 'number'
        ? node.style.letterSpacing
        : typeof (node as any).letterSpacingPx === 'number'
          ? (node as any).letterSpacingPx
          : 0;
      const tracking = baseFontSize > 0 && typeof lsRaw === 'number' && lsRaw !== 0
        ? Math.round((lsRaw / baseFontSize) * 1000)
        : undefined;
      const numericWeight = typeof fontWeight === 'number' ? fontWeight
        : /^[0-9]+$/.test(String(fontWeight)) ? parseInt(String(fontWeight), 10) : null;
      const isBold = fontWeight === 'bold' || fontWeight === 'bolder' || (numericWeight !== null && numericWeight >= 600);
      const isItalic = fontStyle === 'italic' || fontStyle === 'oblique';
      // Only set fauxBold if the font doesn't already have a dedicated bold PostScript cut
      const fauxBold = isBold && !/bold|black|heavy/i.test(postScriptFontName);
      const fauxItalic = isItalic && !/italic|oblique/i.test(postScriptFontName);

      const textCanvas = await this.renderNodeToIsolatedCanvasAsync(
        node,
        scale,
        width,
        height,
        basePath,
        currentMat,
        left,
        top
      );

      let justification: any = 'left';
      if (node.style.align === 'center') justification = 'center';
      if (node.style.align === 'right') justification = 'right';
      if (node.style.align === 'justify') justification = 'justifyLeft';

      // Insertion anchor point in unscaled node space
      let anchorX = node.x;
      if (justification === 'center') {
        anchorX = node.x + node.width / 2;
      } else if (justification === 'right') {
        anchorX = node.x + node.width;
      }
      const baselineY = node.y + (node.textLayout?.ascent || baseFontSize);

      const transformedAnchor = transformPoint(currentMat, anchorX, baselineY);
      const tx = transformedAnchor.x * scale;
      const ty = transformedAnchor.y * scale;

      const textTransform = [
        currentMat.a,
        currentMat.b,
        currentMat.c,
        currentMat.d,
        tx,
        ty
      ];

      const effects = this.buildLayerEffects(node, scale);

      const textLayer: Layer = {
        name: textContent.slice(0, 30) || layerName,
        top,
        left,
        right,
        bottom,
        opacity,
        blendMode,
        clipping: node.style.clip === true || (node as any).clip === true ? false : undefined,
        ...(effects ? { effects } : {}),
        text: {
          text: textContent,
          transform: textTransform,
          top,
          left,
          bottom,
          right,
          style: {
            font: { name: postScriptFontName },
            fontSize: fontSizePt,
            fillColor: rgba.a < 1
              ? { r: Math.round(rgba.r), g: Math.round(rgba.g), b: Math.round(rgba.b), a: Math.round(rgba.a * 255) }
              : { r: Math.round(rgba.r), g: Math.round(rgba.g), b: Math.round(rgba.b) },
            leading: lineHeightPt,
            ...(tracking !== undefined && tracking !== 0 ? { tracking } : {}),
            ...(fauxBold ? { fauxBold: true } : {}),
            ...(fauxItalic ? { fauxItalic: true } : {}),
            ...(node.style.textTransform === 'uppercase' ? { fontCaps: 1 } : {}),
            ...(node.style.textTransform === 'lowercase' ? { fontCaps: 2 } : {}),
            ...((node.style as any).baselineShift ? { baselineShift: (node.style as any).baselineShift * scale } : {}),
            ...((node.style as any).strikethrough ? { strikethrough: true } : {}),
            ...((node.style as any).underline ? { underline: true } : {}),
            ...((node.style as any).ligatures !== undefined ? { ligatures: !!(node.style as any).ligatures } : {}),
            ...((node.style as any).dLigatures !== undefined ? { dLigatures: !!(node.style as any).dLigatures } : {})
          },
          paragraphStyle: {
            justification,
            ...((node.style as any).spaceBefore ? { spaceBefore: (node.style as any).spaceBefore * scale } : {}),
            ...((node.style as any).spaceAfter ? { spaceAfter: (node.style as any).spaceAfter * scale } : {}),
            ...((node.style as any).firstLineIndent ? { firstLineIndent: (node.style as any).firstLineIndent * scale } : {}),
            ...((node.style as any).autoHyphenate !== undefined ? { autoHyphenate: !!(node.style as any).autoHyphenate } : {})
          }
        },
        canvas: textCanvas as unknown as HTMLCanvasElement,
        ...(layerColor ? { layerColor: layerColor as any } : {}),
        ...(protectedFlags ? { protected: protectedFlags } : {}),
        ...(knockout !== undefined ? { knockout: !!knockout } : {})
      };

      if (node.filters && node.filters.length > 0) {
        const filterLayers = await this.buildFilterLayers(node.filters, node, scale, width, height, basePath);
        return {
          name: layerName,
          opened: true,
          opacity,
          blendMode,
          clipping: node.style.clip === true || (node as any).clip === true ? false : undefined,
          children: [textLayer, ...filterLayers]
        };
      }

      return textLayer;
    }

    // Shapes & Images: Isolated Raster Canvas Layer + Native Vector Shape Data
    const hasFilters = node.filters && node.filters.length > 0;
    const cleanNode = hasFilters
      ? { ...node, style: { ...node.style, filter: undefined }, filters: undefined }
      : node;

    const layerCanvas = await this.renderNodeToIsolatedCanvasAsync(
      cleanNode,
      scale,
      width,
      height,
      basePath,
      currentMat,
      left,
      top
    );
    const vectorData = this.buildVectorShape(cleanNode, scale, width, height, currentMat);
    const effects = this.buildLayerEffects(cleanNode, scale);

    const baseLayer: Layer = {
      name: hasFilters ? `${layerName} (Base)` : layerName,
      top,
      left,
      right,
      bottom,
      opacity,
      blendMode,
      clipping: node.style.clip === true || (node as any).clip === true ? false : undefined,
      canvas: layerCanvas as unknown as HTMLCanvasElement,
      ...(effects ? { effects } : {}),
      ...(vectorData.vectorMask ? { vectorMask: vectorData.vectorMask } : {}),
      ...(vectorData.vectorFill ? { vectorFill: vectorData.vectorFill } : {}),
      ...(vectorData.vectorStroke ? { vectorStroke: vectorData.vectorStroke } : {}),
      ...(vectorData.vectorOrigination ? { vectorOrigination: vectorData.vectorOrigination } : {}),
      ...(fillOpacity !== undefined ? { fillOpacity } : {}),
      ...(layerColor ? { layerColor: layerColor as any } : {}),
      ...(protectedFlags ? { protected: protectedFlags } : {}),
      ...(knockout !== undefined ? { knockout: !!knockout } : {})
    };

    if (hasFilters) {
      const filterLayers = await this.buildFilterLayers(node.filters!, cleanNode, scale, width, height, basePath);
      return {
        name: layerName,
        opened: true,
        opacity,
        blendMode,
        clipping: node.style.clip === true || (node as any).clip === true ? false : undefined,
        children: [baseLayer, ...filterLayers]
      };
    }

    return baseLayer;
  }

  /**
   * Builds separate effect and adjustment layers for each filter in a CSS filter chain.
   */
  private static async buildFilterLayers(
    filters: Array<{ type: string; value: number | string }>,
    cleanNode: LayoutNode,
    scale: number,
    widthPx: number,
    heightPx: number,
    basePath?: string
  ): Promise<Layer[]> {
    const layers: Layer[] = [];

    for (const f of filters) {
      const type = f.type.toLowerCase();
      const rawVal = f.value;

      if (type === 'blur') {
        const radiusPx = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 0;
        const blurCanvas = await this.renderFilteredCanvasAsync(cleanNode, `blur(${radiusPx * scale}px)`, scale, widthPx, heightPx, basePath);
        layers.push({
          name: `[FX] Blur (${rawVal})`,
          top: Math.round(cleanNode.y * scale),
          left: Math.round(cleanNode.x * scale),
          right: Math.round(cleanNode.x * scale) + widthPx,
          bottom: Math.round(cleanNode.y * scale) + heightPx,
          clipping: true,
          canvas: blurCanvas as unknown as HTMLCanvasElement
        });
      } else if (type === 'brightness') {
        const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 1;
        const brightnessPct = Math.max(-100, Math.min(100, Math.round((num - 1) * 100)));
        layers.push({
          name: `[Adjustment] Brightness (${num > 1 ? '+' : ''}${brightnessPct}%)`,
          clipping: true,
          adjustment: {
            type: 'brightness/contrast',
            brightness: brightnessPct,
            contrast: 0,
            meanValue: 128,
            useLegacy: false
          }
        });
      } else if (type === 'contrast') {
        const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 1;
        const contrastPct = Math.max(-100, Math.min(100, Math.round((num - 1) * 100)));
        layers.push({
          name: `[Adjustment] Contrast (${num > 1 ? '+' : ''}${contrastPct}%)`,
          clipping: true,
          adjustment: {
            type: 'brightness/contrast',
            brightness: 0,
            contrast: contrastPct,
            meanValue: 128,
            useLegacy: false
          }
        });
      } else if (type === 'saturate') {
        const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 1;
        const satPct = Math.max(-100, Math.min(100, Math.round((num - 1) * 100)));
        layers.push({
          name: `[Adjustment] Saturation (${num > 1 ? '+' : ''}${satPct}%)`,
          clipping: true,
          adjustment: {
            type: 'hue/saturation',
            master: { a: 0, b: 0, c: 0, d: 0, hue: 0, saturation: satPct, lightness: 0 }
          }
        });
      } else if (type === 'hue-rotate') {
        const deg = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 0;
        layers.push({
          name: `[Adjustment] Hue-Rotate (${deg}°)`,
          clipping: true,
          adjustment: {
            type: 'hue/saturation',
            master: { a: 0, b: 0, c: 0, d: 0, hue: Math.round(deg), saturation: 0, lightness: 0 }
          }
        });
      } else if (type === 'grayscale') {
        layers.push({
          name: `[Adjustment] Black & White`,
          clipping: true,
          adjustment: {
            type: 'black & white',
            reds: 40,
            yellows: 60,
            greens: 40,
            cyans: 60,
            blues: 20,
            magentas: 80
          }
        });
      } else if (type === 'invert') {
        layers.push({
          name: `[Adjustment] Invert`,
          clipping: true,
          adjustment: {
            type: 'invert'
          }
        });
      } else if (type === 'sepia') {
        layers.push({
          name: `[Adjustment] Sepia Filter`,
          clipping: true,
          adjustment: {
            type: 'photo filter',
            color: { r: 180, g: 120, b: 60 },
            density: 80,
            preserveLuminosity: true
          }
        });
      }
    }

    return layers;
  }

  /**
   * Renders a node to an isolated canvas with a specific CSS filter applied.
   */
  private static async renderFilteredCanvasAsync(
    node: LayoutNode,
    filterCss: string,
    scale: number,
    widthPx: number,
    heightPx: number,
    basePath?: string
  ): Promise<any> {
    const canvas = createCanvas(widthPx, heightPx);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    // Skia aborts on drop-shadow()/opacity() inside ctx.filter — split them
    // out and apply what remains. The extracted shadow is stamped through
    // ctx.shadow* (honored on vector fills) instead of crashing.
    const split = splitUnsafeFilterFns(filterCss);
    try {
      ctx.filter = split.safeCss && split.safeCss !== 'none' ? sanitizeFilterCss(split.safeCss) : 'none';
    } catch { /* backend without filter support */ }
    if (split.shadow) {
      ctx.shadowColor = split.shadow.color;
      ctx.shadowBlur = split.shadow.blur * scale;
      ctx.shadowOffsetX = split.shadow.offsetX * scale;
      ctx.shadowOffsetY = split.shadow.offsetY * scale;
    }
    ctx.globalAlpha *= split.opacityFactor;
    ctx.translate(-node.x, -node.y);
    await this.renderNodeToContext(ctx, node, basePath);
    return canvas;
  }

  private static renderNodeToIsolatedCanvas(
    node: LayoutNode,
    scale: number,
    widthPx: number,
    heightPx: number,
    basePath?: string
  ): HTMLCanvasElement {
    const canvas = createCanvas(widthPx, heightPx);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.translate(-node.x, -node.y);

    this.renderNodeDirect(ctx, node, basePath);
    return canvas as unknown as HTMLCanvasElement;
  }

  private static async renderNodeToIsolatedCanvasAsync(
    node: LayoutNode,
    scale: number,
    widthPx: number,
    heightPx: number,
    basePath?: string,
    matrix: Matrix2D = IDENTITY_MATRIX,
    layerLeftDoc = 0,
    layerTopDoc = 0
  ): Promise<HTMLCanvasElement> {
    const canvas = createCanvas(widthPx, heightPx);
    const ctx = canvas.getContext('2d');
    if (isMatrixIdentity(matrix)) {
      ctx.scale(scale, scale);
      ctx.translate(-node.x, -node.y);
      await this.renderNodeToContext(ctx, node, basePath);
    } else {
      ctx.translate(-layerLeftDoc, -layerTopDoc);
      ctx.scale(scale, scale);
      ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty);
      await this.renderNodeToContext(ctx, node, basePath, true);
    }
    return canvas as unknown as HTMLCanvasElement;
  }

  private static async renderNodeToContext(
    ctx: CanvasRenderingContext2D,
    node: LayoutNode,
    basePath?: string,
    skipLocalTransform = false
  ): Promise<void> {
    ctx.save();

    if (typeof node.opacity === 'number' && node.opacity < 1) {
      ctx.globalAlpha *= node.opacity;
    }

    // 4. 2D Transforms
    const hasTransform = !skipLocalTransform && (node.style.rotation || node.style.scale !== undefined || node.style.skewX || node.style.skewY);
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

    switch (node.type) {
      case 'rect': {
        drawRect(ctx, node.x, node.y, node.width, node.height, node.style.borderRadius);
        this.applyFillAndStroke(ctx, node);
        break;
      }
      case 'circle': {
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        drawCircle(ctx, cx, cy, { rx: node.width / 2, ry: node.height / 2 });
        this.applyFillAndStroke(ctx, node);
        break;
      }
      case 'polygon': {
        if (node.polygonLayout?.canvasPoints) {
          drawPolygon(ctx, node.polygonLayout.canvasPoints, node.style.borderRadius);
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
          const fill = node.style.fill || node.fill;
          if (fill) {
            if (typeof fill === 'string') {
              ctx.fillStyle = fill;
            } else {
              const localBox = { x: 0, y: 0, w: node.width, h: node.height };
              ctx.fillStyle = createCanvasGradient(ctx, fill as any, localBox);
            }
            ctx.fill(pathObj);
          }
          const stroke = node.style.stroke || node.stroke;
          if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = node.style.strokeWidth ?? 1;
            if (node.style.strokeCap) ctx.lineCap = node.style.strokeCap;
            if (node.style.strokeJoin) ctx.lineJoin = node.style.strokeJoin;
            if (node.style.strokeStyle === 'dashed') ctx.setLineDash([6, 6]);
            else if (node.style.strokeStyle === 'dotted') ctx.setLineDash([2, 2]);
            else ctx.setLineDash([]);
            ctx.stroke(pathObj);
          }
          ctx.restore();
        }
        break;
      }
      case 'text': {
        const fontSize = node.textLayout?.fontSize || 16;
        const fontFamily = node.textLayout?.fontFamily || 'sans-serif';
        const lineHeight = node.textLayout?.lineHeight || Math.round(fontSize * 1.25);

        ctx.font = `${fontSize}px "${fontFamily}"`;
        ctx.textBaseline = 'top';

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

        if (node.textLayout && node.textLayout.lines) {
          for (let i = 0; i < node.textLayout.lines.length; i++) {
            ctx.fillText(node.textLayout.lines[i]!, anchorX, node.y + i * lineHeight);
          }
        }
        break;
      }
      case 'image': {
        const imgSrc = node.imageLayout?.src;
        if (imgSrc) {
          const img = await this.resolveImage(imgSrc, basePath);
          if (img) {
            drawImageWithFit(ctx, img, node.fit || node.imageLayout?.fit || 'fill', node.x, node.y, node.width, node.height);
          }
        }
        break;
      }
      case 'stack':
      case 'group':
      case 'grid': {
        if (node.style.fill || node.style.stroke) {
          drawRect(ctx, node.x, node.y, node.width, node.height, node.style.borderRadius);
          this.applyFillAndStroke(ctx, node);
        }
        const hasGroupClip = node.style.clip === true || (node as any).clip === true;
        if (hasGroupClip) {
          ctx.save();
          drawRect(ctx, node.x, node.y, node.width, node.height, node.style.borderRadius);
          ctx.clip();
        }

        if (node.children && node.children.length > 0) {
          let i = 0;
          while (i < node.children.length) {
            const child = node.children[i]!;
            const isMask = child.style.clip === true || (child as any).clip === true;

            if (isMask) {
              await this.renderNodeToContext(ctx, child, basePath);

              const maskedSiblings: LayoutNode[] = [];
              let j = i + 1;
              while (j < node.children.length) {
                const nextChild = node.children[j]!;
                const nextIsMask = nextChild.style.clip === true || (nextChild as any).clip === true;
                if (nextIsMask) break;
                maskedSiblings.push(nextChild);
                j++;
              }

              if (maskedSiblings.length > 0) {
                ctx.save();
                ctx.beginPath();
                if (child.type === 'circle') {
                  const cx = child.x + child.width / 2;
                  const cy = child.y + child.height / 2;
                  drawCircle(ctx, cx, cy, { rx: child.width / 2, ry: child.height / 2 });
                } else if (child.type === 'polygon' && child.polygonLayout?.canvasPoints) {
                  drawPolygon(ctx, child.polygonLayout.canvasPoints);
                } else {
                  drawRect(ctx, child.x, child.y, child.width, child.height, child.style.borderRadius);
                }
                ctx.clip();

                for (const sibling of maskedSiblings) {
                  await this.renderNodeToContext(ctx, sibling, basePath);
                }
                ctx.restore();
              }
              i = j;
            } else {
              await this.renderNodeToContext(ctx, child, basePath);
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

  private static renderNodeDirect(
    ctx: CanvasRenderingContext2D,
    node: LayoutNode,
    _basePath?: string
  ): void {
    ctx.save();
    if (typeof node.opacity === 'number' && node.opacity < 1) {
      ctx.globalAlpha *= node.opacity;
    }

    if (node.type === 'text') {
      const fontSize = node.textLayout?.fontSize || 16;
      const fontFamily = node.textLayout?.fontFamily || 'sans-serif';
      const lineHeight = node.textLayout?.lineHeight || Math.round(fontSize * 1.25);
      const fw = node.textLayout?.fontWeight || 'normal';
      const fs = node.textLayout?.fontStyle || 'normal';
      ctx.font = `${fs === 'italic' || fs === 'oblique' ? 'italic ' : ''}${fw} ${fontSize}px "${fontFamily}"`;
      ctx.textBaseline = 'top';

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

      if (node.textLayout && node.textLayout.lines) {
        for (let i = 0; i < node.textLayout.lines.length; i++) {
          ctx.fillText(node.textLayout.lines[i]!, node.x, node.y + i * lineHeight);
        }
      }
    } else if (node.type === 'rect') {
      drawRect(ctx, node.x, node.y, node.width, node.height, node.style.borderRadius);
      this.applyFillAndStroke(ctx, node);
    } else if (node.type === 'circle') {
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      drawCircle(ctx, cx, cy, { rx: node.width / 2, ry: node.height / 2 });
      this.applyFillAndStroke(ctx, node);
    } else if (node.type === 'polygon' && node.polygonLayout?.canvasPoints) {
      drawPolygon(ctx, node.polygonLayout.canvasPoints);
      this.applyFillAndStroke(ctx, node);
    } else if (['path', 'shape', 'icon', 'star', 'triangle', 'arrow', 'cross'].includes(node.type)) {
      if (node.pathLayout?.d) {
        ctx.save();
        ctx.translate(node.x, node.y);
        if (node.type === 'icon') {
          ctx.scale(node.width / 24, node.height / 24);
        }
        const pathObj = new Path2D(node.pathLayout.d);
        
        const fill = node.style.fill || node.fill;
        if (fill) {
          if (typeof fill === 'string') {
            ctx.fillStyle = fill;
          } else {
            const localBox = { x: 0, y: 0, w: node.width, h: node.height };
            ctx.fillStyle = createCanvasGradient(ctx, fill as any, localBox);
          }
          ctx.fill(pathObj);
        }
        
        const stroke = node.style.stroke || node.stroke;
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = node.style.strokeWidth ?? 1;
          if (node.style.strokeCap) ctx.lineCap = node.style.strokeCap;
          if (node.style.strokeJoin) ctx.lineJoin = node.style.strokeJoin;
          if (node.style.strokeStyle === 'dashed') ctx.setLineDash([6, 6]);
          else if (node.style.strokeStyle === 'dotted') ctx.setLineDash([2, 2]);
          ctx.stroke(pathObj);
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private static applyFillAndStroke(ctx: CanvasRenderingContext2D, node: LayoutNode): void {
    const fill = node.style.fill || node.fill;
    if (fill) {
      if (typeof fill === 'string') {
        ctx.fillStyle = fill;
      } else {
        ctx.fillStyle = createCanvasGradient(ctx, fill as any, node.box);
      }
      ctx.fill();
    }

    const stroke = node.style.stroke || node.stroke;
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = node.style.strokeWidth ?? 1;
      if (node.style.strokeCap) ctx.lineCap = node.style.strokeCap;
      if (node.style.strokeJoin) ctx.lineJoin = node.style.strokeJoin;
      if (node.style.strokeStyle === 'dashed') ctx.setLineDash([6, 6]);
      else if (node.style.strokeStyle === 'dotted') ctx.setLineDash([2, 2]);
      else ctx.setLineDash([]);
      ctx.stroke();
    }
  }

  private static async resolveImage(imgSrc: string, basePath?: string): Promise<Image | null> {
    return resolveSharedImage(imgSrc, basePath);
  }

  private static mapFontFamilyToPostScript(fontFamily: string, fontWeight: string | number, fontStyle: string): string {
    // 1. Handle comma-separated font fallback stacks (e.g. "Inter, -apple-system, sans-serif")
    // Photoshop Type layers require a single concrete PostScript font identifier.
    let primary = fontFamily ? fontFamily.split(',')[0]!.trim() : 'sans-serif';
    // Strip surrounding quotes
    primary = primary.replace(/^['"]|['"]$/g, '').trim();
    if (!primary) primary = 'sans-serif';

    // 2. Query FontLoader first to resolve genuine PostScript name from registered or system fonts
    const fromLoader = FontLoader.resolvePostScriptName(primary, fontWeight, fontStyle);
    if (fromLoader) {
      return fromLoader;
    }

    const numericWeight = typeof fontWeight === 'number' ? fontWeight
      : /^[0-9]+$/.test(String(fontWeight)) ? parseInt(String(fontWeight), 10) : null;
    const isBold = fontWeight === 'bold' || fontWeight === 'bolder' || (numericWeight !== null && numericWeight >= 600) || String(fontWeight) === '700';
    const isItalic = fontStyle === 'italic' || fontStyle === 'oblique';

    // Granular weight suffix for variable & OpenType fonts (e.g. Inter-SemiBold)
    let weightName = 'Regular';
    if (numericWeight !== null) {
      if (numericWeight <= 150) weightName = 'Thin';
      else if (numericWeight <= 250) weightName = 'ExtraLight';
      else if (numericWeight <= 350) weightName = 'Light';
      else if (numericWeight <= 450) weightName = 'Regular';
      else if (numericWeight <= 550) weightName = 'Medium';
      else if (numericWeight <= 650) weightName = 'SemiBold';
      else if (numericWeight <= 750) weightName = 'Bold';
      else if (numericWeight <= 850) weightName = 'ExtraBold';
      else weightName = 'Black';
    } else {
      const fwLower = String(fontWeight).toLowerCase().trim();
      if (fwLower === 'thin') weightName = 'Thin';
      else if (fwLower === 'extralight') weightName = 'ExtraLight';
      else if (fwLower === 'light') weightName = 'Light';
      else if (fwLower === 'medium') weightName = 'Medium';
      else if (fwLower === 'semibold') weightName = 'SemiBold';
      else if (fwLower === 'bold' || fwLower === 'bolder') weightName = 'Bold';
      else if (fwLower === 'extrabold') weightName = 'ExtraBold';
      else if (fwLower === 'black' || fwLower === 'heavy') weightName = 'Black';
      else weightName = 'Regular';
    }

    let styleSuffix = weightName;
    if (isItalic) {
      styleSuffix = weightName === 'Regular' ? 'Italic' : `${weightName}Italic`;
    }

    // Generic CSS fallbacks mapping to standard ubiquitous PostScript fonts
    const key = primary.toLowerCase();
    const genericSans = isItalic
      ? (isBold ? 'Arial-BoldItalicMT' : 'Arial-ItalicMT')
      : (isBold ? 'Arial-BoldMT' : 'ArialMT');
    const genericSerif = isItalic
      ? (isBold ? 'TimesNewRomanPS-BoldItalicMT' : 'TimesNewRomanPS-ItalicMT')
      : (isBold ? 'TimesNewRomanPS-BoldMT' : 'TimesNewRomanPSMT');
    const genericMono = isItalic
      ? (isBold ? 'Courier-BoldOblique' : 'Courier-Oblique')
      : (isBold ? 'Courier-Bold' : 'Courier');

    if (key === 'sans-serif' || key === 'system-ui' || key === '-apple-system' || key === 'blinkmacsystemfont' || key === 'segoe ui') {
      return genericSans;
    }
    if (key === 'serif') {
      return genericSerif;
    }
    if (key === 'monospace') {
      return genericMono;
    }

    const map: Record<string, string> = {
      'arial': genericSans,
      'helvetica': `Helvetica${styleSuffix === 'Regular' ? '' : '-' + styleSuffix}`,
      'helvetica neue': `HelveticaNeue${styleSuffix === 'Regular' ? '' : '-' + styleSuffix}`,
      'times': genericSerif,
      'times new roman': genericSerif,
      'courier': genericMono,
      'courier new': `CourierNewPS${styleSuffix === 'Regular' ? 'MT' : '-' + styleSuffix + 'MT'}`,
      'inter': `Inter-${styleSuffix}`,
      'roboto': `Roboto-${styleSuffix}`,
      'poppins': `Poppins-${styleSuffix}`,
      'montserrat': `Montserrat-${styleSuffix}`,
      'open sans': `OpenSans-${styleSuffix}`,
      'lato': `Lato-${styleSuffix}`,
      'geist': `Geist-${styleSuffix}`,
      'outfit': `Outfit-${styleSuffix}`
    };

    if (map[key]) return map[key];

    // Some basic key mappings like "inter bold" in case someone still passed it inside fontFamily
    if (key === 'arial bold') return 'Arial-BoldMT';
    if (key === 'helvetica bold') return 'Helvetica-Bold';
    if (key === 'inter bold') return 'Inter-Bold';
    if (key === 'roboto bold') return 'Roboto-Bold';

    // Clean primary family name for PostScript convention: PascalCase / no spaces / no commas
    const cleanPrimary = primary.replace(/[^a-zA-Z0-9_-]/g, '');
    return `${cleanPrimary}-${styleSuffix}`;
  }

  /**
   * Generates native Photoshop Vector Shape Layer metadata:
   * vectorMask (Bezier paths & knots), vectorFill, vectorStroke, and live vectorOrigination.
   */
  private static buildVectorShape(
    node: LayoutNode,
    scale: number,
    docW: number,
    docH: number,
    matrix: Matrix2D = IDENTITY_MATRIX
  ): {
    vectorMask?: LayerVectorMask;
    vectorFill?: VectorContent;
    vectorStroke?: any;
    vectorOrigination?: any;
  } {
    // Native vector shapes: rect, circle, polygon, path, icon, star, triangle, arrow, cross, shape
    const VECTOR_TYPES = ['rect', 'circle', 'polygon', 'path', 'icon', 'star', 'triangle', 'arrow', 'cross', 'shape'];
    if (!VECTOR_TYPES.includes(node.type)) {
      return {};
    }

    const x0 = node.x * scale;
    const y0 = node.y * scale;
    const w = node.width * scale;
    const h = node.height * scale;
    const x1 = x0 + w;
    const y1 = y0 + h;

    const K = 0.5522847498307935;
    let knots: BezierKnot[] = [];
    let customPaths: BezierPath[] | undefined;
    let origination: any = undefined;

    if (node.type === 'rect') {
      const radiusVal = node.style.borderRadius ?? (node as any).radius;
      let rTL = 0, rTR = 0, rBR = 0, rBL = 0;
      if (Array.isArray(radiusVal)) {
        rTL = (radiusVal[0] || 0) * scale;
        rTR = (radiusVal[1] || 0) * scale;
        rBR = (radiusVal[2] || 0) * scale;
        rBL = (radiusVal[3] || 0) * scale;
      } else if (typeof radiusVal === 'number') {
        rTL = rTR = rBR = rBL = radiusVal * scale;
      }

      // Clamp radii to prevent self-intersection
      const maxR = Math.min(w / 2, h / 2);
      rTL = Math.min(rTL, maxR);
      rTR = Math.min(rTR, maxR);
      rBR = Math.min(rBR, maxR);
      rBL = Math.min(rBL, maxR);

      if (rTL > 0 || rTR > 0 || rBR > 0 || rBL > 0) {
        // Clockwise 8-knot rounded rectangle
        knots = [
          // 1. Top edge right
          { linked: true, points: [x1 - rTR, y0, x1 - rTR, y0, x1 - rTR + rTR * K, y0] },
          // 2. Right edge top
          { linked: true, points: [x1, y0 + rTR - rTR * K, x1, y0 + rTR, x1, y0 + rTR] },
          // 3. Right edge bottom
          { linked: true, points: [x1, y1 - rBR, x1, y1 - rBR, x1, y1 - rBR + rBR * K] },
          // 4. Bottom edge right
          { linked: true, points: [x1 - rBR + rBR * K, y1, x1 - rBR, y1, x1 - rBR, y1] },
          // 5. Bottom edge left
          { linked: true, points: [x0 + rBL, y1, x0 + rBL, y1, x0 + rBL - rBL * K, y1] },
          // 6. Left edge bottom
          { linked: true, points: [x0, y1 - rBL + rBL * K, x0, y1 - rBL, x0, y1 - rBL] },
          // 7. Left edge top
          { linked: true, points: [x0, y0 + rTL, x0, y0 + rTL, x0, y0 + rTL - rTL * K] },
          // 8. Top edge left
          { linked: true, points: [x0 + rTL - rTL * K, y0, x0 + rTL, y0, x0 + rTL, y0] }
        ];

        origination = {
          keyDescriptorList: [
            {
              keyOriginType: 2, // Rounded Rectangle
              keyOriginResolution: 72,
              keyOriginRRectRadii: {
                topLeft: { units: 'Pixels', value: rTL },
                topRight: { units: 'Pixels', value: rTR },
                bottomRight: { units: 'Pixels', value: rBR },
                bottomLeft: { units: 'Pixels', value: rBL }
              },
              keyOriginShapeBoundingBox: {
                top: { units: 'Pixels', value: y0 },
                left: { units: 'Pixels', value: x0 },
                bottom: { units: 'Pixels', value: y1 },
                right: { units: 'Pixels', value: x1 }
              },
              keyOriginBoxCorners: [
                { x: x0, y: y0 },
                { x: x1, y: y0 },
                { x: x1, y: y1 },
                { x: x0, y: y1 }
              ]
            }
          ]
        };
      } else {
        // Standard 4-knot sharp rectangle
        knots = [
          { linked: false, points: [x0, y0, x0, y0, x0, y0] },
          { linked: false, points: [x1, y0, x1, y0, x1, y0] },
          { linked: false, points: [x1, y1, x1, y1, x1, y1] },
          { linked: false, points: [x0, y1, x0, y1, x0, y1] }
        ];

        origination = {
          keyDescriptorList: [
            {
              keyOriginType: 1, // Sharp Rectangle
              keyOriginResolution: 72,
              keyOriginShapeBoundingBox: {
                top: { units: 'Pixels', value: y0 },
                left: { units: 'Pixels', value: x0 },
                bottom: { units: 'Pixels', value: y1 },
                right: { units: 'Pixels', value: x1 }
              },
              keyOriginBoxCorners: [
                { x: x0, y: y0 },
                { x: x1, y: y0 },
                { x: x1, y: y1 },
                { x: x0, y: y1 }
              ]
            }
          ]
        };
      }
    } else if (node.type === 'circle') {
      const cx = (node.x + node.width / 2) * scale;
      const cy = (node.y + node.height / 2) * scale;
      const rx = (node.width / 2) * scale;
      const ry = (node.height / 2) * scale;
      const kx = rx * K;
      const ky = ry * K;

      knots = [
        // Top
        { linked: true, points: [cx - kx, cy - ry, cx, cy - ry, cx + kx, cy - ry] },
        // Right
        { linked: true, points: [cx + rx, cy - ky, cx + rx, cy, cx + rx, cy + ky] },
        // Bottom
        { linked: true, points: [cx + kx, cy + ry, cx, cy + ry, cx - kx, cy + ry] },
        // Left
        { linked: true, points: [cx - rx, cy + ky, cx - rx, cy, cx - rx, cy - ky] }
      ];

      origination = {
        keyDescriptorList: [
          {
            keyOriginType: 5, // Ellipse (Photoshop specification: 1=rect, 2=round rect, 4=line, 5=ellipse)
            keyOriginResolution: 72,
            keyOriginShapeBoundingBox: {
              top: { units: 'Pixels', value: y0 },
              left: { units: 'Pixels', value: x0 },
              bottom: { units: 'Pixels', value: y1 },
              right: { units: 'Pixels', value: x1 }
            },
            keyOriginBoxCorners: [
              { x: x0, y: y0 },
              { x: x1, y: y0 },
              { x: x1, y: y1 },
              { x: x0, y: y1 }
            ]
          }
        ]
      };
    } else if (node.type === 'polygon' && node.polygonLayout?.canvasPoints) {
      knots = node.polygonLayout.canvasPoints.map(p => {
        const px = p.x * scale;
        const py = p.y * scale;
        return { linked: false, points: [px, py, px, py, px, py] };
      });
    } else if (['star', 'triangle', 'arrow', 'cross', 'shape', 'path', 'icon'].includes(node.type) && node.pathLayout?.d) {
      // Use the full SVG-to-Bézier parser to convert curves, arcs, and lines into native knots
      const isIcon = node.type === 'icon';
      const bezierPaths = svgPathToBezierPaths(node.pathLayout.d, {
        scale,
        offsetX: node.x,
        offsetY: node.y,
        fillRule: (node.style as any)?.fillRule === 'evenodd' ? 'even-odd' : 'non-zero',
        ...(isIcon ? { scaleWidth: node.width, scaleHeight: node.height, viewBoxWidth: 24, viewBoxHeight: 24 } : {})
      });

      if (bezierPaths.length > 0) {
        // Collect all knots across subpaths
        customPaths = bezierPaths;
      }
    }

    let vectorMask: LayerVectorMask | undefined;

    if (customPaths && customPaths.length > 0) {
      const hasTransform = !isMatrixIdentity(matrix);
      if (hasTransform) {
        origination = undefined;
        for (const bp of customPaths) {
          for (const knot of bp.knots) {
            const p0 = transformPoint(matrix, knot.points[0]! / scale, knot.points[1]! / scale);
            const p1 = transformPoint(matrix, knot.points[2]! / scale, knot.points[3]! / scale);
            const p2 = transformPoint(matrix, knot.points[4]! / scale, knot.points[5]! / scale);
            knot.points = [p0.x * scale, p0.y * scale, p1.x * scale, p1.y * scale, p2.x * scale, p2.y * scale];
          }
        }
      }
      vectorMask = {
        paths: customPaths,
        fillStartsWithAllPixels: false
      };
    } else if (knots.length > 0) {
      const hasTransform = !isMatrixIdentity(matrix);
      if (hasTransform) {
        origination = undefined; // Drop live shape properties if we apply a transform to the mask
        for (const knot of knots) {
          const p0 = transformPoint(matrix, knot.points[0]! / scale, knot.points[1]! / scale);
          const p1 = transformPoint(matrix, knot.points[2]! / scale, knot.points[3]! / scale);
          const p2 = transformPoint(matrix, knot.points[4]! / scale, knot.points[5]! / scale);
          knot.points = [p0.x * scale, p0.y * scale, p1.x * scale, p1.y * scale, p2.x * scale, p2.y * scale];
        }
      }

      vectorMask = {
        paths: [
          {
            open: false,
            operation: 'combine',
            fillRule: 'non-zero',
            knots
          }
        ],
        fillStartsWithAllPixels: false
      };
    }

    if (!vectorMask) {
      return {};
    }

    // Vector Fill
    let vectorFill: VectorContent | undefined;
    const fill = node.style.fill || node.fill;
    if (fill) {
      if (typeof fill === 'string') {
        const rgba = parseColorToRgba(fill);
        vectorFill = {
          type: 'color',
          color: { r: rgba.r, g: rgba.g, b: rgba.b }
        };
      } else if (fill.type === 'linear' || fill.type === 'radial') {
        const distributed = distributeGradientStops(fill.stops);
        const colorStops = distributed.map(s => {
          const c = parseColorToRgba(s.color);
          return {
            color: { r: c.r, g: c.g, b: c.b },
            location: Math.round(s.offset * 4096),
            midpoint: 50
          };
        });
        const opacityStops = distributed.map(s => {
          const c = parseColorToRgba(s.color);
          return {
            opacity: c.a,
            location: Math.round(s.offset * 4096),
            midpoint: 50
          };
        });
        vectorFill = {
          type: 'solid',
          name: 'Gradient Fill',
          smoothness: 1,
          colorStops,
          opacityStops,
          style: fill.type === 'radial' ? 'radial' : 'linear',
          angle: cssGradientAngleToPhotoshop(typeof fill.angle === 'number' ? fill.angle : fill.direction)
        } as any;
      }
    }

    // Vector Stroke
    let vectorStroke: any | undefined;
    const stroke = node.style.stroke || node.stroke;
    if (stroke) {
      const strokeColor = parseColorToRgba(stroke);
      vectorStroke = {
        strokeEnabled: true,
        fillEnabled: !!vectorFill,
        lineWidth: { units: 'Pixels', value: (node.style.strokeWidth ?? 1) * scale },
        lineJoinType: node.style.strokeJoin === 'round' ? 'round' : node.style.strokeJoin === 'bevel' ? 'bevel' : 'miter',
        lineCapType: node.style.strokeCap === 'round' ? 'round' : node.style.strokeCap === 'square' ? 'square' : 'butt',
        lineAlignment: 'center',
        content: {
          type: 'color',
          color: { r: strokeColor.r, g: strokeColor.g, b: strokeColor.b }
        }
      };
    }

    return {
      vectorMask,
      vectorFill,
      vectorStroke,
      vectorOrigination: origination
    };
  }

  /**
   * Generates native Photoshop Layer Effects (Drop Shadow, Inner Shadow, Glow, Bevel, Stroke, Overlays).
   */
  private static buildLayerEffects(node: LayoutNode, scale: number): LayerEffectsInfo | undefined {
    const effects: LayerEffectsInfo = {};
    let hasAnyEffect = false;

    const rawShadows = (node.style as any).shadows || (node.style.shadow ? [node.style.shadow] : (node as any).shadow ? [(node as any).shadow] : []);
    if (rawShadows.length > 0) {
      effects.dropShadow = rawShadows.map((s: any) => {
        const offsetX = (s.offsetX ?? 0) * scale;
        const offsetY = (s.offsetY ?? 0) * scale;
        const blur = (s.blur ?? 0) * scale;
        const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        const angleRad = Math.atan2(offsetY, -offsetX);
        let angleDeg = Math.round(angleRad * (180 / Math.PI));
        if (angleDeg < 0) angleDeg += 360;

        const shadowColor = parseColorToRgba(s.color || '#000000');
        return {
          enabled: true,
          color: { r: shadowColor.r, g: shadowColor.g, b: shadowColor.b },
          opacity: shadowColor.a,
          distance: { units: 'Pixels', value: dist },
          size: { units: 'Pixels', value: blur },
          angle: angleDeg,
          useGlobalLight: s.useGlobalLight ?? false,
          ...(typeof s.noise === 'number' ? { noise: s.noise } : {})
        };
      });
      hasAnyEffect = true;
    }

    // Inner Shadow
    const innerShadow = node.style.innerShadow || (node as any).innerShadow;
    if (innerShadow) {
      const offsetX = (innerShadow.offsetX ?? 0) * scale;
      const offsetY = (innerShadow.offsetY ?? 0) * scale;
      const blur = (innerShadow.blur ?? 0) * scale;
      const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      const angleRad = Math.atan2(offsetY, -offsetX);
      let angleDeg = Math.round(angleRad * (180 / Math.PI));
      if (angleDeg < 0) angleDeg += 360;

      const color = parseColorToRgba(innerShadow.color || '#000000');
      effects.innerShadow = [
        {
          enabled: true,
          color: { r: color.r, g: color.g, b: color.b },
          opacity: color.a,
          distance: { units: 'Pixels', value: dist },
          size: { units: 'Pixels', value: blur },
          angle: angleDeg,
          useGlobalLight: false
        }
      ];
      hasAnyEffect = true;
    }

    // Outer Glow
    const outerGlow = node.style.outerGlow;
    if (outerGlow) {
      const color = parseColorToRgba(outerGlow.color || '#ffffff');
      effects.outerGlow = {
        enabled: true,
        color: { r: color.r, g: color.g, b: color.b },
        opacity: outerGlow.opacity ?? color.a,
        size: { units: 'Pixels', value: (outerGlow.size || 10) * scale }
      };
      hasAnyEffect = true;
    }

    // Inner Glow
    const innerGlow = node.style.innerGlow;
    if (innerGlow) {
      const color = parseColorToRgba(innerGlow.color || '#ffffff');
      effects.innerGlow = {
        enabled: true,
        color: { r: color.r, g: color.g, b: color.b },
        opacity: innerGlow.opacity ?? color.a,
        size: { units: 'Pixels', value: (innerGlow.size || 8) * scale }
      };
      hasAnyEffect = true;
    }

    // Bevel and Emboss
    const bevel = node.style.bevel;
    if (bevel) {
      effects.bevel = {
        enabled: true,
        size: { units: 'Pixels', value: (bevel.size || 4) * scale },
        soften: { units: 'Pixels', value: (bevel.soften || 0) * scale },
        direction: bevel.direction === 'down' ? 'down' : 'up'
      };
      hasAnyEffect = true;
    }

    // Stroke Effect
    const strokeFx = node.style.layerStroke;
    if (strokeFx) {
      const color = parseColorToRgba(strokeFx.color || '#000000');
      effects.stroke = [
        {
          enabled: true,
          size: { units: 'Pixels', value: (strokeFx.width || 1) * scale },
          position: strokeFx.position || 'inside',
          fillType: 'color',
          color: { r: color.r, g: color.g, b: color.b },
          opacity: strokeFx.opacity ?? color.a
        }
      ];
      hasAnyEffect = true;
    }

    // Color Overlay (solidFill in PSD)
    if (node.style.colorOverlay) {
      const color = parseColorToRgba(node.style.colorOverlay);
      effects.solidFill = [
        {
          enabled: true,
          color: { r: color.r, g: color.g, b: color.b },
          opacity: color.a,
          blendMode: 'normal'
        }
      ];
      hasAnyEffect = true;
    }

    // Gradient Overlay (gradientFill in PSD)
    const gradOverlay = node.style.gradientOverlay || (node as any).gradientOverlay;
    if (gradOverlay && gradOverlay.stops) {
      const distributed = distributeGradientStops(gradOverlay.stops);
      const colorStops = distributed.map(s => {
        const c = parseColorToRgba(s.color);
        return {
          color: { r: c.r, g: c.g, b: c.b },
          location: Math.round(s.offset * 4096),
          midpoint: 50
        };
      });
      const opacityStops = distributed.map(s => {
        const c = parseColorToRgba(s.color);
        return {
          opacity: c.a,
          location: Math.round(s.offset * 4096),
          midpoint: 50
        };
      });

      effects.gradientOverlay = [
        {
          enabled: true,
          type: gradOverlay.type === 'radial' ? 'radial' : 'linear',
          angle: cssGradientAngleToPhotoshop(typeof gradOverlay.angle === 'number' ? gradOverlay.angle : gradOverlay.direction),
          scale: 1,
          gradient: {
            name: 'Gradient Overlay',
            type: 'solid',
            smoothness: 1,
            colorStops,
            opacityStops
          }
        }
      ];
      hasAnyEffect = true;
    }

    return hasAnyEffect ? effects : undefined;
  }
}

/**
 * Functional export for PSD export
 */
export async function exportToPsd(layout: LayoutResult, options?: PsdExportOptions): Promise<Buffer> {
  return PsdExporter.export(layout, options);
}
