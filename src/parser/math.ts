/**
 * src/parser/math.ts
 * Geometry solver, bounding box computations, Skia text measurement,
 * currentColor cascade, and relational positioning engine.
 */

import { createCanvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveSharedImage } from '../engine/imageCache.js';
import {
  ResolvedDocumentNode,
  ResolvedElementNode,
  ResolvedGradient,
  ResolvedStroke,
  ResolvedFont,
  ResolvedFilter,
  FontDirectiveNode
} from './ast.js';
import { DependencyGraph } from './dependencyGraph.js';
import { getIconPath } from '../engine/iconRegistry.js';
import { generateShapePath } from '../engine/shapeGenerators.js';

// ============================================================================
// Layout Data Types
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface LayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ShadowStyle {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface GradientStop {
  color: string;
  position: number; // 0.0 to 1.0
}

export interface GradientStyle {
  type: 'linear' | 'radial' | 'conic';
  angle?: number;
  direction?: string;
  shape?: 'circle' | 'ellipse';
  stops: GradientStop[];
}

export interface ComputedStyle {
  color: string;
  fill?: string | GradientStyle;
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  strokeCap?: 'round' | 'square' | 'butt';
  strokeJoin?: 'miter' | 'round' | 'bevel';
  letterSpacing?: number;
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  align?: 'left' | 'center' | 'right' | 'justify';
  opacity?: number;
  borderRadius?: number | [number, number, number, number];
  shadow?: ShadowStyle;
  filter?: string;
  blendMode?: string;
  rotation?: number;
  scale?: number | { x: number, y: number };
  skewX?: number;
  skewY?: number;
  transformOrigin?: { x: number | string, y: number | string };
  clip?: boolean;
  innerShadow?: ShadowStyle;
  outerGlow?: import('./ast.js').GlowStyle;
  innerGlow?: import('./ast.js').GlowStyle;
  bevel?: import('./ast.js').BevelStyle;
  layerStroke?: import('./ast.js').LayerStrokeStyle;
  colorOverlay?: string;
  gradientOverlay?: GradientStyle;
  fontFeatures?: string | string[];
  fontVariation?: Record<string, number> | string;
  hangingPunctuation?: boolean;
  backdropFilter?: string;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  fillOpacity?: number;
  layerColor?: 'none' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'gray';
  lock?: 'all' | 'position' | 'transparency' | 'composite';
  knockout?: boolean;
  shadows?: Array<{ offsetX: number; offsetY: number; blur: number; color: string; useGlobalLight?: boolean; noise?: number }>;
}

export interface TextLayoutResult {
  lines: string[];
  width: number;
  actualWidth?: number;
  height: number;
  lineHeight: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string | number;
  fontStyle: string;
  ascent: number;
  descent: number;
}

export interface LayoutNode {
  id?: string;
  name: string;
  type: 'rect' | 'circle' | 'polygon' | 'path' | 'text' | 'image' | 'adjust' | 'group' | 'grid' | 'stack' | 'icon' | 'star' | 'triangle' | 'arrow' | 'cross' | 'shape' | 'slot';
  box: LayoutBox;
  style: ComputedStyle;

  // Direct convenience accessors
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string | GradientStyle;
  stroke?: string;
  strokeColor?: string;
  opacity?: number;
  fit?: 'fill' | 'cover' | 'contain' | 'none';
  zIndex?: number;
  mask?: string;
  maskNode?: LayoutNode;

  // Type-specific layout data
  textLayout?: TextLayoutResult;
  polygonLayout?: {
    canvasPoints: Point[];
  };
  pathLayout?: {
    d: string;
  };
  stackLayout?: {
    direction: 'horizontal' | 'vertical';
    gap: number;
    padding: [number, number, number, number];
    align: 'start' | 'center' | 'end';
  };
  imageLayout?: {
    src?: string;
    fit: 'fill' | 'cover' | 'contain' | 'none';
  };
  adjustLayout?: {
    radius: number;
    feather: number;
    params: {
      exposure?: number;
      contrast?: number;
      brightness?: number;
      saturation?: number;
      warmth?: number;
      highlights?: number;
      shadows?: number;
    };
  };
  filters?: Array<{ type: string; value: number | string }>;

  parentId?: string;
  parent?: string;
  children?: LayoutNode[];
}

export interface LayoutCanvasResult {
  name?: string;
  mode?: 'graphic' | 'photo';
  photoSrc?: string;
  photoParams?: {
    exposure?: number;
    contrast?: number;
    brightness?: number;
    saturation?: number;
    warmth?: number;
    vignette?: number;
    highlights?: number;
    shadows?: number;
  };
  width: number;
  height: number;
  aspectRatio: string;
  background?: string | GradientStyle;
  dpi: number;
  hasExplicitDpi?: boolean;
  bleed?: number;
  cropMarks?: boolean;
  colorMode?: 'rgb' | 'cmyk';
  exports?: string[];
  scales?: number[];
  resolution?: number | string;
  ratio?: string;
  quality?: number;
  guides?: Array<{ location: number; direction: 'horizontal' | 'vertical' }>;
  globalLight?: { angle: number; altitude?: number };
}

export interface LayoutResult {
  canvas: LayoutCanvasResult;
  canvases?: Array<{ canvas: LayoutCanvasResult; nodes: LayoutNode[] }>;
  fonts: Array<{ family: string; source: string; weight?: string | number; style?: string }>;
  nodes: LayoutNode[];
  warnings: string[];
  dependencies: string[];
}

// ============================================================================
// Math Utilities
// ============================================================================

export function computeGcd(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || isNaN(a) || isNaN(b)) {
    return 1;
  }
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0 && !isNaN(y)) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x === 0 || isNaN(x) ? 1 : x;
}

export function computeAspectRatio(width: number, height: number): { ratioX: number; ratioY: number; ratioString: string } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { ratioX: 1, ratioY: 1, ratioString: '1:1' };
  }
  const gcd = computeGcd(width, height);
  const ratioX = Math.round(width) / gcd;
  const ratioY = Math.round(height) / gcd;
  return {
    ratioX,
    ratioY,
    ratioString: `${ratioX}:${ratioY}`
  };
}

/**
 * Fast synchronous dimension extractor for PNG, JPEG, and WebP files.
 */
export function readImageDimensions(filePath: string): { width: number; height: number } | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(131072);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    fs.closeSync(fd);
    if (bytesRead < 16) return null;
    const buf = buffer.subarray(0, bytesRead);

    // PNG: 8-byte signature, IHDR chunk width at offset 16, height at offset 20
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }

    // JPEG: Starts with 0xFFD8
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let offset = 2;
      while (offset < buf.length - 8) {
        if (buf[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buf[offset + 1];
        // SOF0 (0xC0) to SOF2 (0xC2) markers contain height and width
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = buf.readUInt16BE(offset + 5);
          const width = buf.readUInt16BE(offset + 7);
          if (width > 0 && height > 0) return { width, height };
        }
        const blockLen = buf.readUInt16BE(offset + 2);
        offset += 2 + blockLen;
      }
    }

    // WebP: RIFF ... WEBP VP8 / VP8L / VP8X
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      const format = buffer.toString('ascii', 12, 16);
      if (format === 'VP8 ') {
        // Lossy VP8
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        if (width > 0 && height > 0) return { width, height };
      } else if (format === 'VP8L') {
        // Lossless VP8L
        const b0 = buffer[21];
        const b1 = buffer[22];
        const b2 = buffer[23];
        const b3 = buffer[24];
        const width = 1 + (((b1 & 0x3f) << 8) | b0);
        const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        if (width > 0 && height > 0) return { width, height };
      } else if (format === 'VP8X') {
        // Extended VP8X
        const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
        const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
        if (width > 0 && height > 0) return { width, height };
      }
    }
  } catch {}
  return null;
}

export function evaluateCalc(expression: string, parentSize: number, dpi = 96): number {
  // Simple calc evaluator for things like "100% - 20px" or "50% + 10px"
  // Remove calc() wrapper
  let expr = expression.trim();
  if (expr.startsWith('calc(') && expr.endsWith(')')) {
    expr = expr.slice(5, -1).trim();
  }
  
  // Replace percentages with resolved pixels
  expr = expr.replace(/(-?\d+(?:\.\d+)?)%/g, (_, pct) => {
    return String(parentSize * (parseFloat(pct) / 100));
  });

  // Convert viewport relative units
  expr = expr.replace(/(-?\d+(?:\.\d+)?)(vw|vh)/gi, (_, num) => {
    return String(parentSize * (parseFloat(num) / 100));
  });

  // Convert font relative units
  expr = expr.replace(/(-?\d+(?:\.\d+)?)(em|rem)/gi, (_, num) => {
    return String(parseFloat(num) * 16);
  });

  // Convert or strip dimension units (px, mm, cm, in, pt)
  expr = expr.replace(/(-?\d+(?:\.\d+)?)(px|mm|cm|in|pt)/gi, (_, num, unit) => {
    const val = parseFloat(num);
    const u = unit.toLowerCase();
    if (u === 'in') return String(val * dpi);
    if (u === 'mm') return String(val * (dpi / 25.4));
    if (u === 'cm') return String(val * (dpi / 2.54));
    if (u === 'pt') return String(val * (dpi / 72));
    return String(val);
  });

  try {
    // A safe-ish evaluation of basic math operations (+ - * /)
    // using Function since this is an isolated, trusted AST expression
    // and we only allow numbers and basic operators.
    if (/^[0-9\.\+\-\*\/\s\(\)]+$/.test(expr)) {
      const result = new Function(`return (${expr})`)();
      // Guard against division by zero producing Infinity/NaN layouts.
      return Number.isFinite(result) ? result : 0;
    }
  } catch (e) {
    // Fallback to 0 if syntax error in calc
  }
  return 0;
}

export function resolveDimension(
  val: number | string | undefined,
  parentSize: number,
  intrinsicSize: number,
  dpi = 96
): number {
  if (val === undefined) return intrinsicSize;
  if (typeof val === 'number') return val;
  if (val === 'hug' || val === 'auto') return intrinsicSize;
  if (val === 'fill') return parentSize; // For stack layout, this will be overridden
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.endsWith('%')) {
      const pct = parseFloat(trimmed) / 100;
      return isNaN(pct) ? 0 : parentSize * pct;
    }
    if (trimmed.startsWith('calc(')) {
      return evaluateCalc(trimmed, parentSize, dpi);
    }
    if (trimmed.endsWith('vw') || trimmed.endsWith('vh')) {
      const v = parseFloat(trimmed);
      return isNaN(v) ? 0 : parentSize * (v / 100);
    }
    if (trimmed.endsWith('em') || trimmed.endsWith('rem')) {
      const v = parseFloat(trimmed);
      return isNaN(v) ? 0 : v * 16;
    }
    if (trimmed.endsWith('in')) return (parseFloat(trimmed) || 0) * dpi;
    if (trimmed.endsWith('mm')) return (parseFloat(trimmed) || 0) * (dpi / 25.4);
    if (trimmed.endsWith('cm')) return (parseFloat(trimmed) || 0) * (dpi / 2.54);
    if (trimmed.endsWith('pt')) return (parseFloat(trimmed) || 0) * (dpi / 72);
    if (trimmed.endsWith('px')) return parseFloat(trimmed) || 0;

    const num = parseFloat(trimmed);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// ============================================================================
// Skia Headless Text Measurement
// ============================================================================

let measureCanvas: any = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCanvas = createCanvas(1, 1);
    measureCtx = measureCanvas.getContext('2d');
  }
  return measureCtx!;
}

export function layoutText(
  content: string,
  style: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    fontStyle?: string;
    lineHeight?: number;
    letterSpacing?: number;
    textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
    explicitWidth?: number;
    maxLines?: number;
    overflow?: 'visible' | 'hidden' | 'ellipsis' | 'clip';
  }
): TextLayoutResult {
  const fontSize = style.fontSize || 16;
  const fontWeight = style.fontWeight || 'normal';
  const fontStyle = style.fontStyle || 'normal';
  const fontFamily = style.fontFamily || 'sans-serif';
  const letterSpacing = style.letterSpacing || 0;
  const lineHeight = style.lineHeight ? (style.lineHeight < 5 ? style.lineHeight * fontSize : style.lineHeight) : Math.round(fontSize * 1.25);

  if (content === undefined || content === '') {
    return {
      lines: [''],
      width: 0,
      height: 0,
      lineHeight,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      ascent: 0,
      descent: 0
    };
  }

  // Apply text-transform
  let processedContent = content;
  if (style.textTransform === 'uppercase') {
    processedContent = processedContent.toUpperCase();
  } else if (style.textTransform === 'lowercase') {
    processedContent = processedContent.toLowerCase();
  } else if (style.textTransform === 'capitalize') {
    processedContent = processedContent.replace(/\b\w/g, l => l.toUpperCase());
  }

  const ctx = getMeasureContext();
  const fontFamCanvas = fontFamily.includes(',')
    ? fontFamily.split(',').map(f => {
        const t = f.trim().replace(/^['"]+|['"]+$/g, '');
        return /^(sans-serif|serif|monospace|cursive|fantasy|system-ui)$/i.test(t) ? t.toLowerCase() : `"${t}"`;
      }).join(', ')
    : (fontFamily === 'sans-serif' ? 'sans-serif' : `"${fontFamily}"`);
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamCanvas}`;
  ctx.textBaseline = 'alphabetic';

  const measure = (str: string): number => {
    const baseW = ctx.measureText(str).width;
    if (!letterSpacing || str.length <= 1) return baseW;
    // Negative tracking must shrink measured widths just as it shrinks the
    // rendered text, otherwise wrapped lines can overflow their box.
    return Math.max(0, baseW + (str.length - 1) * letterSpacing);
  };

  const paragraphs = processedContent.split('\n');
  const finalLines: string[] = [];

  let maxAscent = Math.round(fontSize * 0.8);
  let maxDescent = Math.round(fontSize * 0.2);

  // Case A: No explicit width -> No auto-wrapping (preserve lines)
  if (style.explicitWidth === undefined || style.explicitWidth <= 0) {
    let maxWidth = 0;
    for (const para of paragraphs) {
      finalLines.push(para);
      const w = measure(para);
      if (w > maxWidth) maxWidth = w;
      const metrics = ctx.measureText(para);
      if (metrics.actualBoundingBoxAscent && metrics.actualBoundingBoxAscent > maxAscent) {
        maxAscent = metrics.actualBoundingBoxAscent;
      }
      if (metrics.actualBoundingBoxDescent && metrics.actualBoundingBoxDescent > maxDescent) {
        maxDescent = metrics.actualBoundingBoxDescent;
      }
    }

    return {
      lines: finalLines,
      width: Math.ceil(maxWidth),
      height: Math.max(finalLines.length * lineHeight, Math.ceil(maxAscent + maxDescent)),
      lineHeight,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      ascent: maxAscent,
      descent: maxDescent
    };
  }

  // Case B: Explicit width -> Greedy word wrap
  const maxW = style.explicitWidth;
  for (const para of paragraphs) {
    if (para.trim() === '') {
      finalLines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const candidate = `${currentLine} ${words[i]}`;
      if (measure(candidate) <= maxW) {
        currentLine = candidate;
      } else {
        finalLines.push(currentLine);
        currentLine = words[i] || '';
      }
    }
    finalLines.push(currentLine);
  }

  // Sample real glyph extents across the wrapped lines (Case B previously
  // kept the crude 0.8/0.2 font-size estimates).
  for (const line of finalLines) {
    if (!line) continue;
    const metrics = ctx.measureText(line);
    if (metrics.actualBoundingBoxAscent && metrics.actualBoundingBoxAscent > maxAscent) {
      maxAscent = metrics.actualBoundingBoxAscent;
    }
    if (metrics.actualBoundingBoxDescent && metrics.actualBoundingBoxDescent > maxDescent) {
      maxDescent = metrics.actualBoundingBoxDescent;
    }
  }

  let outLines = finalLines;
  const maxLines = style.maxLines;
  if (typeof maxLines === 'number' && maxLines > 0 && finalLines.length > maxLines) {
    outLines = finalLines.slice(0, maxLines);
    if (style.overflow === 'ellipsis') {
      const lastIdx = outLines.length - 1;
      let line = outLines[lastIdx] || '';
      while (line.length > 0 && measure(line + '\u2026') > maxW) {
        line = line.slice(0, -1).trimEnd();
      }
      outLines[lastIdx] = line + '\u2026';
    }
  }

  let actualMaxW = 0;
  for (const line of outLines) {
    const lw = measure(line);
    if (lw > actualMaxW) actualMaxW = lw;
  }

  return {
    lines: outLines,
    width: maxW,
    actualWidth: Math.ceil(actualMaxW),
    height: Math.max(outLines.length * lineHeight, Math.ceil(maxAscent + maxDescent)),
    ascent: maxAscent,
    descent: maxDescent,
    fontSize,
    lineHeight,
    fontFamily,
    fontWeight,
    fontStyle
  };
}

// ============================================================================
// Layout Solver Engine
// ============================================================================

export async function solveLayout(doc: ResolvedDocumentNode): Promise<LayoutResult> {
  const solver = new LayoutSolver(doc);
  return solver.solve();
}

export class LayoutSolver {
  private doc: ResolvedDocumentNode;
  private warnings: string[] = [];
  private resolvedBoxes = new Map<string, LayoutBox>();

  constructor(doc: ResolvedDocumentNode) {
    this.doc = doc;
  }

  public solve(): LayoutResult {
    let canvasWidth = this.doc.canvas.width;
    let canvasHeight = this.doc.canvas.height;

    // If photo canvas mode or photoSrc provided and dimensions are default/unset:
    if ((this.doc.canvas.mode === 'photo' || this.doc.canvas.photoSrc) && this.doc.canvas.photoSrc) {
      const pSrc = this.doc.canvas.photoSrc;
      const baseDir = this.doc.filePath ? path.dirname(this.doc.filePath) : process.cwd();
      const resolvedPhotoPath = path.isAbsolute(pSrc) ? pSrc : path.resolve(baseDir, pSrc);
      const imgDims = readImageDimensions(resolvedPhotoPath);
      if (imgDims) {
        if (!this.doc.canvas.explicitWidth) canvasWidth = imgDims.width;
        if (!this.doc.canvas.explicitHeight) canvasHeight = imgDims.height;
      }
    }

    if (!canvasWidth) canvasWidth = 800;
    if (!canvasHeight) canvasHeight = 600;

    const ar = computeAspectRatio(canvasWidth, canvasHeight);

    // 1. Static currentColor Cascade Pass
    this.resolveCurrentColorPass(this.doc.elements, '#000000');

    // 2. Dependency Graph & Topological Sorting for Relational Layout
    const graph = new DependencyGraph();
    let prevTopLevelId: string | undefined;
    for (const elem of this.doc.elements) {
      graph.addElement(elem, prevTopLevelId);
      prevTopLevelId = elem.id;
    }

    const topoOrderedElements = graph.resolveOrder();
    this.warnings.push(...graph.warnings);

    // 3. Resolve Dimensions & Positions for all elements in topological order
    for (const elem of topoOrderedElements) {
      this.resolveElementLayout(elem, canvasWidth, canvasHeight);
    }

    // 4. Build Layout Tree Nodes in topological order
    const rootNodes: LayoutNode[] = [];
    const topLevelElements = topoOrderedElements.filter(e => this.doc.elements.includes(e));
    for (const elem of topLevelElements) {
      const node = this.buildLayoutNode(elem, canvasWidth, canvasHeight);
      if (node) {
        rootNodes.push(node);
        if ((node.type === 'grid' || node.type === 'stack' || (node.type === 'group' && !elem.isComponent)) && node.children) {
          const addChildren = (children: LayoutNode[]) => {
            for (const ch of children) {
              rootNodes.push(ch);
              if (ch.children && (ch.type === 'grid' || ch.type === 'stack' || ch.type === 'group')) {
                addChildren(ch.children);
              }
            }
          };
          addChildren(node.children);
        }
      }
    }

    // Sort root nodes by z-index for rendering
    rootNodes.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    // 5. Link mask nodes
    const nodeById = new Map<string, LayoutNode>();
    const gatherIds = (nodes: LayoutNode[]) => {
      for (const n of nodes) {
        if (n.id) nodeById.set(n.id, n);
        if (n.children) gatherIds(n.children);
      }
    };
    gatherIds(rootNodes);

    const linkMasks = (nodes: LayoutNode[]) => {
      for (const n of nodes) {
        if (n.mask && nodeById.has(n.mask)) {
          n.maskNode = nodeById.get(n.mask);
        }
        if (n.children) linkMasks(n.children);
      }
    };
    linkMasks(rootNodes);

    const originalFind = rootNodes.find.bind(rootNodes);
    rootNodes.find = (predicate: any, thisArg?: any) => {
      const direct = originalFind(predicate, thisArg);
      if (direct !== undefined) return direct;
      const search = (nodes: LayoutNode[]): LayoutNode | undefined => {
        for (const n of nodes) {
          if (predicate.call(thisArg, n, 0, rootNodes)) return n;
          if (n.children) {
            const found = search(n.children);
            if (found) return found;
          }
        }
        return undefined;
      };
      return search(rootNodes);
    };

    // Canvas background
    let bgStyle: string | GradientStyle | undefined;
    if (typeof this.doc.canvas.fill === 'string') {
      bgStyle = this.doc.canvas.fill;
    } else if (this.doc.canvas.fill && typeof this.doc.canvas.fill === 'object') {
      bgStyle = this.convertGradient(this.doc.canvas.fill);
    }

    // Fonts list
    const fonts = (this.doc.fonts || []).map(f => ({
      family: f.family,
      source: f.path,
      weight: f.weight,
      style: f.style
    }));

    const photoParams = this.doc.canvas.mode === 'photo' || this.doc.canvas.photoSrc ? {
      exposure: typeof this.doc.canvas.properties.exposure === 'number' ? this.doc.canvas.properties.exposure : undefined,
      contrast: typeof this.doc.canvas.properties.contrast === 'number' ? this.doc.canvas.properties.contrast : undefined,
      brightness: typeof this.doc.canvas.properties.brightness === 'number' ? this.doc.canvas.properties.brightness : undefined,
      saturation: typeof this.doc.canvas.properties.saturation === 'number'
        ? this.doc.canvas.properties.saturation
        : typeof this.doc.canvas.properties.saturate === 'number' ? this.doc.canvas.properties.saturate : undefined,
      warmth: typeof this.doc.canvas.properties.warmth === 'number'
        ? this.doc.canvas.properties.warmth
        : typeof this.doc.canvas.properties.temperature === 'number' ? this.doc.canvas.properties.temperature : undefined,
      vignette: typeof this.doc.canvas.properties.vignette === 'number'
        ? (this.doc.canvas.properties.vignette > 1 ? this.doc.canvas.properties.vignette / 100 : this.doc.canvas.properties.vignette)
        : undefined,
      highlights: typeof this.doc.canvas.properties.highlights === 'number' ? this.doc.canvas.properties.highlights : undefined,
      shadows: typeof this.doc.canvas.properties.shadows === 'number' ? this.doc.canvas.properties.shadows : undefined,
    } : undefined;

    const primaryCanvasResult: LayoutCanvasResult = {
      name: this.doc.canvas.name,
      mode: this.doc.canvas.mode,
      photoSrc: this.doc.canvas.photoSrc,
      photoParams,
      width: canvasWidth,
      height: canvasHeight,
      aspectRatio: ar.ratioString,
      background: bgStyle,
      dpi: this.doc.canvas.dpi || 96,
      hasExplicitDpi: Boolean(this.doc.canvas.hasExplicitDpi),
      bleed: this.doc.canvas.bleed,
      cropMarks: this.doc.canvas.cropMarks,
      colorMode: this.doc.canvas.colorMode || 'rgb',
      exports: this.doc.canvas.exports,
      scales: this.doc.canvas.scales,
      resolution: this.doc.canvas.resolution,
      ratio: this.doc.canvas.ratio,
      quality: this.doc.canvas.quality,
      guides: this.doc.canvas.guides || (this.doc.canvas.properties?.guides as any),
      globalLight: this.doc.canvas.globalLight || (this.doc.canvas.properties?.globalLight as any)
    };

    let canvasesResult: Array<{ canvas: LayoutCanvasResult; nodes: LayoutNode[]; warnings: string[] }> | undefined;
    if (this.doc.canvases && this.doc.canvases.length > 1) {
      // Multi-canvas pages are independent documents: each renders ONLY its
      // own scoped elements. The "inherit top-level elements" fallback is
      // reserved for the single-canvas case where content lives outside the
      // canvas block.
      canvasesResult = [];
      for (const c of this.doc.canvases) {
        const hasOwn = Array.isArray(c.elements) && c.elements.length > 0;
        const subDoc = { ...this.doc, canvas: c, canvases: undefined, elements: hasOwn ? c.elements! : [] };
        const subSolver = new LayoutSolver(subDoc);
        const subResult = subSolver.solve();
        if (!hasOwn) {
          subResult.warnings.push(
            `Canvas '${c.name || 'unnamed'}' declares no elements of its own and renders empty. Place page content inside the canvas { ... } block.`
          );
        }
        canvasesResult.push({
          canvas: subResult.canvas,
          nodes: subResult.nodes,
          warnings: subResult.warnings
        });
      }
    }

    return {
      canvas: primaryCanvasResult,
      canvases: canvasesResult,
      fonts,
      nodes: rootNodes,
      warnings: this.warnings,
      dependencies: this.doc.dependencies || []
    };
  }

  // ==========================================================================
  // currentColor Cascade Pass
  // ==========================================================================

  private resolveCurrentColorPass(elements: ResolvedElementNode[], inheritedColor: string): void {
    for (const elem of elements) {
      let activeColor = inheritedColor;

      // Check if element defines text color or stroke color
      if (typeof elem.fill === 'string' && elem.fill !== 'currentColor') {
        activeColor = elem.fill;
      }

      if (elem.fill === 'currentColor') {
        elem.fill = activeColor;
      }

      if (elem.stroke && elem.stroke.color === 'currentColor') {
        elem.stroke.color = activeColor;
      }

      if (elem.fill && typeof elem.fill === 'object') {
        for (const stop of elem.fill.stops) {
          if (stop.color === 'currentColor') {
            stop.color = activeColor;
          }
        }
      }

      if (elem.children && elem.children.length > 0) {
        this.resolveCurrentColorPass(elem.children, activeColor);
      }
    }
  }

  private computeIntrinsicSize(
    elem: ResolvedElementNode,
    canvasW: number,
    canvasH: number
  ): { w: number; h: number } {
    let wRaw = elem.size?.w;
    let hRaw = elem.size?.h;

    // If explicit numeric sizes are given, they override intrinsic (except text, where size is wrap width)
    if (elem.type !== 'text' && typeof wRaw === 'number' && wRaw > 0 && typeof hRaw === 'number' && hRaw > 0) {
      return { w: wRaw, h: hRaw };
    }

    let w = 0;
    let h = 0;

    if (elem.type === 'text') {
      // For text width, if wRaw is 'fill' or percentage, we might have to wait for resolveElementLayout?
      // Actually, intrinsic size of 'fill' or '%' is 0 (it will expand later).
      // If we want wrapping to work, the layout phase passes explicitWidth. Here we just compute natural bounds.
      const textWidthLimit = typeof wRaw === 'number' && wRaw > 0
        ? wRaw
        : ((elem as any).wrapWidth ?? undefined);
      const tLayout = layoutText(elem.text || '', {
        fontFamily: elem.font?.family,
        fontSize: elem.font?.size,
        fontWeight: elem.font?.weight,
        fontStyle: elem.font?.style,
        lineHeight: elem.font?.lineHeight,
        letterSpacing: elem.font?.letterSpacing ?? elem.letterSpacing,
        textTransform: elem.font?.textTransform ?? elem.textTransform,
        explicitWidth: textWidthLimit,
        maxLines: (elem as any).maxLines,
        overflow: (elem as any).overflow
      });
      w = typeof wRaw === 'number' && wRaw > 0 ? wRaw : tLayout.width;
      const hasExplicitHeight = (elem as any)._hasExplicitHeight || (typeof hRaw === 'number' && hRaw > 0 && hRaw !== wRaw);
      h = hasExplicitHeight && typeof hRaw === 'number' ? hRaw : tLayout.height;
      return { w, h };
    }

    if (elem.type === 'circle' || elem.type === 'adjust') {
      const radiusVal = typeof elem.adjustRadius === 'number'
        ? elem.adjustRadius
        : typeof elem.radius === 'number' ? elem.radius : undefined;
      if (radiusVal !== undefined && radiusVal >= 0) {
        const d = radiusVal * 2;
        return {
          w: typeof wRaw === 'number' && wRaw > 0 ? wRaw : d,
          h: typeof hRaw === 'number' && hRaw > 0 ? hRaw : d
        };
      }
      const nw = typeof wRaw === 'number' ? wRaw : 0;
      const nh = typeof hRaw === 'number' ? hRaw : 0;
      if (nw > 0 && nh === 0) return { w: nw, h: nw };
      if (nh > 0 && nw === 0) return { w: nh, h: nh };
      return { w: 100, h: 100 };
    }

    if (elem.type === 'polygon') {
      if (elem.points && elem.points.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of elem.points) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const naturalW = maxX >= minX ? maxX - minX : 0;
        const naturalH = maxY >= minY ? maxY - minY : 0;
        return {
          w: typeof wRaw === 'number' && wRaw > 0 ? wRaw : naturalW,
          h: typeof hRaw === 'number' && hRaw > 0 ? hRaw : naturalH
        };
      } else {
        return {
          w: typeof wRaw === 'number' && wRaw > 0 ? wRaw : 0,
          h: typeof hRaw === 'number' && hRaw > 0 ? hRaw : 0
        };
      }
    }

    if (elem.type === 'path') {
      return {
        w: typeof wRaw === 'number' && wRaw > 0 ? wRaw : 100,
        h: typeof hRaw === 'number' && hRaw > 0 ? hRaw : 100
      };
    }

    if (elem.type === 'stack') {
      const dir = elem.direction === 'horizontal' || elem.direction === 'row' ? 'horizontal' : 'vertical';
      const gap = elem.gap || 0;
      const pad = Array.isArray(elem.padding)
        ? (elem.padding.length === 4 ? elem.padding : [elem.padding[0] || 0, elem.padding[1] || 0, elem.padding[0] || 0, elem.padding[1] || 0])
        : typeof elem.padding === 'number' ? [elem.padding, elem.padding, elem.padding, elem.padding] : [0, 0, 0, 0];

      let mainTotal = 0;
      let crossMax = 0;

      if (elem.children && elem.children.length > 0) {
        for (const child of elem.children) {
          // Intrinsic size doesn't include 'fill' size, treat fill/percentages as 0 intrinsic
          const cSize = this.computeIntrinsicSize(child, canvasW, canvasH);
          const childWRaw = child.size?.w;
          const childHRaw = child.size?.h;
          const cw = typeof childWRaw === 'number' ? childWRaw : (childWRaw === 'fill' || (typeof childWRaw === 'string' && childWRaw.endsWith('%')) ? 0 : cSize.w);
          const ch = typeof childHRaw === 'number' ? childHRaw : (childHRaw === 'fill' || (typeof childHRaw === 'string' && childHRaw.endsWith('%')) ? 0 : cSize.h);

          if (dir === 'vertical') {
            mainTotal += ch;
            if (cw > crossMax) crossMax = cw;
          } else {
            mainTotal += cw;
            if (ch > crossMax) crossMax = ch;
          }
        }
        if (elem.children.length > 1) {
          mainTotal += (elem.children.length - 1) * gap;
        }
      }

      const totalW = (dir === 'vertical' ? crossMax : mainTotal) + pad[1] + pad[3];
      const totalH = (dir === 'vertical' ? mainTotal : crossMax) + pad[0] + pad[2];

      return {
        w: typeof wRaw === 'number' && wRaw > 0 ? wRaw : totalW,
        h: typeof hRaw === 'number' && hRaw > 0 ? hRaw : totalH
      };
    }

    if (elem.type === 'grid' && elem.children && elem.children.length > 0) {
      const cols = elem.columns || 1;
      const gap = elem.gap || 0;
      const colGap = elem.columnGap ?? gap;
      const rowGap = elem.rowGap ?? gap;
      const count = elem.children.length;
      const rows = Math.ceil(count / cols);

      const firstChildSize = this.computeIntrinsicSize(elem.children[0], canvasW, canvasH);
      const fwRaw = elem.children[0].size?.w;
      const fhRaw = elem.children[0].size?.h;
      const childW = typeof fwRaw === 'number' ? fwRaw : firstChildSize.w;
      const childH = typeof fhRaw === 'number' ? fhRaw : firstChildSize.h;

      const gridW = cols * childW + (cols - 1) * colGap;
      const gridH = rows * childH + (rows - 1) * rowGap;

      return {
        w: typeof wRaw === 'number' && wRaw > 0 ? wRaw : gridW,
        h: typeof hRaw === 'number' && hRaw > 0 ? hRaw : gridH
      };
    }

    if (elem.children && elem.children.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const child of elem.children) {
        const cSize = this.computeIntrinsicSize(child, canvasW, canvasH);
        const childWRaw = child.size?.w;
        const childHRaw = child.size?.h;
        const cw = typeof childWRaw === 'number' ? childWRaw : (childWRaw === 'fill' ? 0 : cSize.w);
        const ch = typeof childHRaw === 'number' ? childHRaw : (childHRaw === 'fill' ? 0 : cSize.h);
        const cx = resolveDimension(child.at?.x, canvasW, 0);
        const cy = resolveDimension(child.at?.y, canvasH, 0);
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx + cw > maxX) maxX = cx + cw;
        if (cy + ch > maxY) maxY = cy + ch;
      }

      const intrinsicW = minX !== Infinity ? (maxX - minX > 0 ? maxX - minX : maxX > 0 ? maxX : 0) : 0;
      const intrinsicH = minY !== Infinity ? (maxY - minY > 0 ? maxY - minY : maxY > 0 ? maxY : 0) : 0;

      return {
        w: typeof wRaw === 'number' && wRaw > 0 ? wRaw : intrinsicW,
        h: typeof hRaw === 'number' && hRaw > 0 ? hRaw : intrinsicH
      };
    }

    // Default for empty group/grid or unspecified type
    if (elem.type === 'group' || elem.type === 'grid') {
      return {
        w: typeof wRaw === 'number' && wRaw > 0 ? wRaw : 0,
        h: typeof hRaw === 'number' && hRaw > 0 ? hRaw : 0
      };
    }

    return {
      w: typeof wRaw === 'number' && wRaw > 0 ? wRaw : 100,
      h: typeof hRaw === 'number' && hRaw > 0 ? hRaw : 100
    };
  }

  // ==========================================================================
  // Element Layout Resolution
  // ==========================================================================

  private resolveElementLayout(
    elem: ResolvedElementNode,
    canvasW: number,
    canvasH: number,
    parentBox?: LayoutBox,
    forceRecompute = false
  ): LayoutBox {
    if (!forceRecompute && !parentBox && elem.id && this.resolvedBoxes.has(elem.id)) {
      return this.resolvedBoxes.get(elem.id)!;
    }

    // 1. Calculate intrinsic / explicit size
    const parentW = parentBox ? parentBox.w : canvasW;
    const parentH = parentBox ? parentBox.h : canvasH;
    const intrinsic = this.computeIntrinsicSize(elem, canvasW, canvasH);

    let w = resolveDimension(elem.size?.w, parentW, intrinsic.w);
    let h = resolveDimension(elem.size?.h, parentH, intrinsic.h);

    // Re-measure text height now that we know its layout width
    if (elem.type === 'text' && typeof elem.size?.h !== 'number') {
      const textWidthLimit = typeof elem.size?.w === 'number' && elem.size.w > 0 ? elem.size.w : w;
      const tLayout = layoutText(elem.text || '', {
        fontFamily: elem.font?.family,
        fontSize: elem.font?.size,
        fontWeight: elem.font?.weight,
        fontStyle: elem.font?.style,
        lineHeight: elem.font?.lineHeight,
        letterSpacing: elem.font?.letterSpacing ?? elem.letterSpacing,
        textTransform: elem.font?.textTransform ?? elem.textTransform,
        explicitWidth: textWidthLimit,
        maxLines: (elem as any).maxLines,
        overflow: (elem as any).overflow
      });
      h = resolveDimension(elem.size?.h, parentH, tLayout.height);
    }

    if (elem.type === 'circle') {
      if (typeof elem.size?.w === 'number' && typeof elem.size?.h === 'undefined') h = w;
      if (typeof elem.size?.h === 'number' && typeof elem.size?.w === 'undefined') w = h;
    }

    // 2. Resolve Position (x, y)
    let x = 0;
    let y = 0;

    if (elem.at) {
      if (elem.at.relational) {
        const { relation, targetId, offset } = elem.at.relational;
        const targetBox = targetId === 'canvas'
          ? { x: 0, y: 0, w: canvasW, h: canvasH }
          : targetId === 'parent'
          ? (parentBox || { x: 0, y: 0, w: canvasW, h: canvasH })
          : this.resolvedBoxes.get(targetId);

        if (!targetBox) {
          this.warnings.push(
            `Element '${elem.id || elem.name}' references missing relational anchor '#${targetId}'. Defaulting to (0, 0).`
          );
          x = 0;
          y = 0;
        } else {
          const isNum = typeof offset === 'number';
          const ox = isNum ? offset : (offset?.x || 0);
          const oy = isNum ? offset : (offset?.y || 0);

          switch (relation) {
            case 'right of':
              x = targetBox.x + targetBox.w + ox;
              y = targetBox.y + (!isNum ? oy : 0);
              break;
            case 'left of':
              x = targetBox.x - w - ox;
              y = targetBox.y + (!isNum ? oy : 0);
              break;
            case 'below':
              x = targetBox.x + (!isNum ? ox : 0);
              y = targetBox.y + targetBox.h + oy;
              break;
            case 'above':
              x = targetBox.x + (!isNum ? ox : 0);
              y = targetBox.y - h - oy;
              break;
            case 'center of':
              x = targetBox.x + (targetBox.w - w) / 2 + ox;
              y = targetBox.y + (targetBox.h - h) / 2 + oy;
              break;
            case 'inside':
              x = targetBox.x + ox;
              y = targetBox.y + oy;
              break;
            case 'top-left of':
              x = targetBox.x + ox;
              y = targetBox.y + oy;
              break;
            case 'top-right of':
              x = targetBox.x + targetBox.w - w - ox;
              y = targetBox.y + oy;
              break;
            case 'bottom-left of':
              x = targetBox.x + ox;
              y = targetBox.y + targetBox.h - h - oy;
              break;
            case 'bottom-right of':
              x = targetBox.x + targetBox.w - w - ox;
              y = targetBox.y + targetBox.h - h - oy;
              break;
            default:
              x = targetBox.x + targetBox.w + ox;
              y = targetBox.y + (!isNum ? oy : 0);
              break;
          }
        }
      } else {
        // Plain coordinates are relative to the containing element's origin
        // (canvas space for top-level elements).
        const ox = resolveDimension(elem.at.x, parentW, 0);
        const oy = resolveDimension(elem.at.y, parentH, 0);
        x = (parentBox ? parentBox.x : 0) + ox;
        y = (parentBox ? parentBox.y : 0) + oy;
      }
    } else {
      // No position specified: top-level elements anchor to the canvas
      // origin; nested elements anchor to their CONTAINER's origin.
      if (!parentBox) {
        this.warnings.push(
          `Element '${elem.id || elem.name || elem.type}' has no 'at:' position specified. Defaulting to (0, 0).`
        );
        x = 0;
        y = 0;
      } else {
        x = parentBox.x;
        y = parentBox.y;
      }
    }

    // 3. Apply Margin
    if (elem.margin) {
      const m = Array.isArray(elem.margin)
        ? (elem.margin.length === 4 ? elem.margin as [number, number, number, number] : [elem.margin[0] || 0, elem.margin[1] || 0, elem.margin[0] || 0, elem.margin[1] || 0])
        : typeof elem.margin === 'number' ? [elem.margin, elem.margin, elem.margin, elem.margin] : [0, 0, 0, 0];
      
      const [mTop, mRight, mBottom, mLeft] = m;
      
      x += mLeft;
      y += mTop;
      
      // If width or height was 'fill' or '100%', subtract the margins so it doesn't overflow
      if (elem.size?.w === 'fill' || (typeof elem.size?.w === 'string' && elem.size.w.endsWith('%'))) {
        w = Math.max(0, w - (mLeft + mRight));
      }
      if (elem.size?.h === 'fill' || (typeof elem.size?.h === 'string' && elem.size.h.endsWith('%'))) {
        h = Math.max(0, h - (mTop + mBottom));
      }
    }

    const box: LayoutBox = { x, y, w, h };
    if (elem.id) {
      this.resolvedBoxes.set(elem.id, box);
    }

    // If grid, position children in tile matrix
    if (elem.type === 'grid' && elem.children && elem.children.length > 0) {
      const cols = elem.columns || 1;
      const gap = elem.gap || 0;
      const colGap = elem.columnGap ?? gap;
      const rowGap = elem.rowGap ?? gap;
      const firstChild = elem.children[0];
      const rows = Math.ceil(elem.children.length / cols);
      const cellWBase = (w - (cols - 1) * colGap) / cols;
      const rowHBase = rows > 1 ? (h - (rows - 1) * rowGap) / rows : h;
      // An explicit numeric size on the first child defines the tile;
      // otherwise tiles are derived from the grid's own box.
      const explicitW = typeof firstChild?.size?.w === 'number' && firstChild.size.w > 0;
      const explicitH = typeof firstChild?.size?.h === 'number' && firstChild.size.h > 0;
      const cellW = explicitW ? (firstChild!.size!.w as number) : cellWBase;
      // Percentage/fill heights resolve against a SINGLE row's height, not
      // the whole grid height (parity with the width/columns math).
      const cellH = explicitH ? (firstChild!.size!.h as number) : rowHBase;

      const resolveCellDim = (v: any, cell: number): number => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
          if (v.endsWith('%')) {
            const p = parseFloat(v);
            return isNaN(p) ? cell : cell * (p / 100);
          }
          const n = parseFloat(v);
          if (!isNaN(n)) return n;
        }
        return cell; // fill/auto/hug/undefined collapse to the tile size
      };

      for (let i = 0; i < elem.children.length; i++) {
        const child = elem.children[i];
        const row = Math.floor(i / cols);
        const col = i % cols;
        // Child tile origins are relative to the grid's own origin.
        const cx = col * (cellW + colGap);
        const cy = row * (cellH + rowGap);

        child.at = { x: cx, y: cy };
        child.size = {
          w: resolveCellDim(child.size?.w, cellW),
          h: resolveCellDim(child.size?.h, cellH)
        };
        this.resolveElementLayout(child, canvasW, canvasH, box);
      }
    } else if (elem.type === 'stack' && elem.children && elem.children.length > 0) {
      const dir = elem.direction === 'horizontal' || elem.direction === 'row' ? 'horizontal' : 'vertical';
      const gap = elem.gap || 0;
      const pad = Array.isArray(elem.padding)
        ? (elem.padding.length === 4 ? elem.padding : [elem.padding[0] || 0, elem.padding[1] || 0, elem.padding[0] || 0, elem.padding[1] || 0])
        : typeof elem.padding === 'number' ? [elem.padding, elem.padding, elem.padding, elem.padding] : [0, 0, 0, 0];
      const align = elem.align || 'start'; // start, center, end

      const paddingTop = pad[0] || 0;
      const paddingRight = pad[1] || 0;
      const paddingBottom = pad[2] || 0;
      const paddingLeft = pad[3] || 0;

      // First pass: Resolve child sizes and count main-axis fill elements
      let mainTotal = 0;
      let crossMax = 0;
      let fillCount = 0;

      const childSizes = elem.children.map(child => {
        const cSize = this.computeIntrinsicSize(child, canvasW, canvasH);
        
        let cw = resolveDimension(child.size?.w, w - paddingLeft - paddingRight, cSize.w);
        let ch = resolveDimension(child.size?.h, h - paddingTop - paddingBottom, cSize.h);

        const isMainFill = dir === 'horizontal' ? child.size?.w === 'fill' : child.size?.h === 'fill';
        if (isMainFill) fillCount++;

        if (!isMainFill) {
          if (dir === 'horizontal') mainTotal += cw;
          else mainTotal += ch;
        }

        const isCrossFill = dir === 'horizontal' ? child.size?.h === 'fill' : child.size?.w === 'fill';
        if (!isCrossFill) {
          if (dir === 'horizontal') {
            if (ch > crossMax) crossMax = ch;
          } else {
            if (cw > crossMax) crossMax = cw;
          }
        }

        return { cw, ch, isMainFill, isCrossFill };
      });

      mainTotal += (elem.children.length - 1) * gap;

      const wOmitted = elem.size?.w === undefined || elem.size?.w === 'hug';
      const hOmitted = elem.size?.h === undefined || elem.size?.h === 'hug';

      if (wOmitted) w = dir === 'vertical' ? crossMax + paddingLeft + paddingRight : mainTotal + paddingLeft + paddingRight;
      if (hOmitted) h = dir === 'horizontal' ? crossMax + paddingTop + paddingBottom : mainTotal + paddingTop + paddingBottom;

      const effectiveMainTotal = (dir === 'horizontal' ? w - paddingLeft - paddingRight : h - paddingTop - paddingBottom);
      const effectiveCrossTotal = (dir === 'horizontal' ? h - paddingTop - paddingBottom : w - paddingLeft - paddingRight);
      const remainingMain = Math.max(0, effectiveMainTotal - mainTotal);
      const fillSize = fillCount > 0 ? remainingMain / fillCount : 0;

      // Cursors start relative to the stack's own origin; the generic
      // coordinate path adds the stack's resolved position for us.
      let cursorX = paddingLeft;
      let cursorY = paddingTop;

      // Update the stack box dimensions so children resolve against the final size
      box.w = w;
      box.h = h;

      // Second pass: position children and apply fill size
      for (let i = 0; i < elem.children.length; i++) {
        const child = elem.children[i]!;
        let { cw, ch, isMainFill, isCrossFill } = childSizes[i]!;

        if (isMainFill) {
          if (dir === 'horizontal') cw = fillSize;
          else ch = fillSize;
        }
        if (isCrossFill) {
          if (dir === 'horizontal') ch = effectiveCrossTotal;
          else cw = effectiveCrossTotal;
        }

        let cx = cursorX;
        let cy = cursorY;

        const alignStr = String(align);
        if (dir === 'vertical') {
          if (alignStr === 'center') cx += (effectiveCrossTotal - cw) / 2;
          else if (alignStr === 'end' || alignStr === 'right') cx += (effectiveCrossTotal - cw);
        } else {
          if (alignStr === 'center') cy += (effectiveCrossTotal - ch) / 2;
          else if (alignStr === 'end' || alignStr === 'bottom') cy += (effectiveCrossTotal - ch);
        }

        child.at = { x: cx, y: cy };
        if (!child.size || child.size.w === 'fill' || child.size.h === 'fill') {
          child.size = { ...child.size, w: cw, h: ch };
        }
        
        this.resolveElementLayout(child, canvasW, canvasH, box);

        if (dir === 'vertical') {
          cursorY += ch + gap;
        } else {
          cursorX += cw + gap;
        }
      }

      box.w = w;
      box.h = h;
    } else if (elem.children && elem.children.length > 0) {
      // Resolve children of group
      for (const child of elem.children) {
        this.resolveElementLayout(child, canvasW, canvasH, box);
      }
      // If group size was not explicitly set, compute AABB based on resolved children
      const wOmitted = elem.size?.w === undefined || elem.size?.w === 'hug';
      const hOmitted = elem.size?.h === undefined || elem.size?.h === 'hug';

      if (wOmitted || hOmitted) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const child of elem.children) {
          const cBox = child.id ? this.resolvedBoxes.get(child.id) : undefined;
          if (cBox) {
            if (cBox.x < minX) minX = cBox.x;
            if (cBox.y < minY) minY = cBox.y;
            if (cBox.x + cBox.w > maxX) maxX = cBox.x + cBox.w;
            if (cBox.y + cBox.h > maxY) maxY = cBox.y + cBox.h;
          }
        }
        if (minX !== Infinity) {
          // Without its own position a container hugs its children's absolute
          // extents (origin included). A positioned container keeps its
          // declared origin and derives its size from the children, never
          // smaller than its largest direct child.
          const hadPosition = !!elem.at;
          let maxChildW = 0;
          let maxChildH = 0;
          for (const child of elem.children) {
            const cb = child.id ? this.resolvedBoxes.get(child.id) : undefined;
            if (cb) {
              if (cb.w > maxChildW) maxChildW = cb.w;
              if (cb.h > maxChildH) maxChildH = cb.h;
            }
          }
          if (wOmitted) {
            if (!hadPosition) {
              box.x = minX;
              box.w = maxX - minX;
            } else {
              box.w = Math.max(maxChildW, maxX - box.x);
            }
          }
          if (hOmitted) {
            if (!hadPosition) {
              box.y = minY;
              box.h = maxY - minY;
            } else {
              box.h = Math.max(maxChildH, maxY - box.y);
            }
          }
        }
      }
    }

    return box;
  }

  // ==========================================================================
  // Layout Node Builder
  // ==========================================================================

  private buildLayoutNode(
    elem: ResolvedElementNode,
    canvasW: number,
    canvasH: number,
    parentId?: string
  ): LayoutNode | null {
    const box = elem.id ? this.resolvedBoxes.get(elem.id) || { x: 0, y: 0, w: 0, h: 0 } : { x: 0, y: 0, w: 0, h: 0 };

    // Convert styling properties
    const style: ComputedStyle = {
      color: typeof elem.fill === 'string' ? elem.fill : '#000000',
      fill: typeof elem.fill === 'string' ? elem.fill : elem.fill ? this.convertGradient(elem.fill) : undefined,
      stroke: elem.stroke?.color,
      strokeWidth: elem.stroke?.width,
      strokeStyle: elem.stroke?.style,
      strokeCap: elem.stroke?.cap || elem.strokeCap,
      strokeJoin: elem.stroke?.join || elem.strokeJoin,
      letterSpacing: elem.font?.letterSpacing ?? elem.letterSpacing,
      textTransform: elem.font?.textTransform ?? elem.textTransform,
      align: elem.align || (elem.font as any)?.align,
      opacity: elem.opacity ?? 1,
      borderRadius: elem.radius,
      shadow: elem.shadow,
      blendMode: elem.blendMode || 'normal',
      rotation: elem.rotation || 0,
      scale: elem.scale,
      skewX: elem.skewX,
      skewY: elem.skewY,
      transformOrigin: elem.transformOrigin,
      innerShadow: elem.innerShadow,
      outerGlow: elem.outerGlow,
      innerGlow: elem.innerGlow,
      bevel: elem.bevel,
      layerStroke: elem.layerStroke,
      colorOverlay: elem.colorOverlay,
      gradientOverlay: elem.gradientOverlay ? this.convertGradient(elem.gradientOverlay) : undefined,
      fontFeatures: elem.fontFeatures || elem.font?.fontFeatures,
      fontVariation: elem.fontVariation || elem.font?.fontVariation,
      hangingPunctuation: elem.hangingPunctuation ?? elem.font?.hangingPunctuation,
      clip: elem.clip,
      verticalAlign: ((elem as any).verticalAlign || undefined) as any,
      fillOpacity: elem.fillOpacity,
      layerColor: elem.layerColor,
      lock: elem.lock,
      knockout: elem.knockout,
      shadows: elem.shadows
    };

    if (elem.filter && elem.filter.length > 0) {
      style.filter = elem.filter.map(f => `${f.type}(${f.value})`).join(' ');
    }
    if (elem.backdropFilter && elem.backdropFilter.length > 0) {
      style.backdropFilter = elem.backdropFilter.map(f => `${f.type}(${f.value})`).join(' ');
    }

    // Node layout details
    let textLayout: TextLayoutResult | undefined;
    let polygonLayout: { canvasPoints: Point[] } | undefined;
    let pathLayout: { d: string } | undefined;
    let stackLayout: { direction: 'horizontal' | 'vertical'; gap: number; padding: [number, number, number, number]; align: 'start' | 'center' | 'end' } | undefined;
    let imageLayout: { src?: string; fit: 'fill' | 'cover' | 'contain' | 'none' } | undefined;

    if (elem.type === 'text') {
      textLayout = layoutText(elem.text || '', {
        fontFamily: elem.font?.family,
        fontSize: elem.font?.size,
        fontWeight: elem.font?.weight,
        fontStyle: elem.font?.style,
        lineHeight: elem.font?.lineHeight,
        letterSpacing: style.letterSpacing,
        textTransform: style.textTransform,
        explicitWidth: box.w,
        maxLines: (elem as any).maxLines,
        overflow: (elem as any).overflow
      });
    } else if (elem.type === 'polygon' && elem.points && elem.points.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of elem.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const rawW = maxX - minX || 1;
      const rawH = maxY - minY || 1;
      const scaleX = box.w > 0 ? box.w / rawW : 1;
      const scaleY = box.h > 0 ? box.h / rawH : 1;
      const centerRawX = (minX + maxX) / 2;
      const centerRawY = (minY + maxY) / 2;
      const centerX = box.x + box.w / 2;
      const centerY = box.y + box.h / 2;

      const canvasPoints: Point[] = elem.points.map(p => ({
        x: centerX + (p.x - centerRawX) * scaleX,
        y: centerY + (p.y - centerRawY) * scaleY
      }));

      polygonLayout = { canvasPoints };
    } else if (elem.type === 'path') {
      pathLayout = { d: elem.d || '' };
    } else if (elem.type === 'icon') {
      const iconD = getIconPath(elem.iconName || elem.name || '');
      if (!iconD) {
        this.warnings.push(`Unknown icon '${elem.iconName || elem.name}' on element '${elem.id || elem.name}'.`);
      }
      pathLayout = { d: iconD };
    } else if (elem.type === 'shape' || ['star', 'triangle', 'arrow', 'cross'].includes(elem.type)) {
      const typeToGen = elem.shapeType || elem.type;
      pathLayout = { d: generateShapePath(typeToGen, box) };
    } else if (elem.type === 'stack') {
      const dir = elem.direction === 'horizontal' || elem.direction === 'row' ? 'horizontal' : 'vertical';
      const pad: [number, number, number, number] = Array.isArray(elem.padding)
        ? (elem.padding.length === 4 ? elem.padding as any : [elem.padding[0] || 0, elem.padding[1] || 0, elem.padding[0] || 0, elem.padding[1] || 0])
        : typeof elem.padding === 'number' ? [elem.padding, elem.padding, elem.padding, elem.padding] : [0, 0, 0, 0];
      stackLayout = {
        direction: dir,
        gap: elem.gap || 0,
        padding: pad,
        align: (elem.align as any) || 'start'
      };
    } else if (elem.type === 'image') {
      imageLayout = {
        src: elem.src,
        fit: elem.fit || 'fill'
      };
    }

    let adjustLayout: LayoutNode['adjustLayout'] | undefined;
    if (elem.type === 'adjust') {
      const radius = typeof elem.adjustRadius === 'number'
        ? elem.adjustRadius
        : typeof elem.radius === 'number' ? elem.radius : (box.w > 0 ? box.w / 2 : 100);
      const feather = typeof elem.feather === 'number' ? elem.feather : Math.round(radius * 0.5);
      adjustLayout = {
        radius,
        feather,
        params: elem.adjustParams || {}
      };
    }

    const childrenNodes: LayoutNode[] = [];
    if (elem.children && elem.children.length > 0) {
      const currentId = elem.id || elem.name || elem.type;
      for (const child of elem.children) {
        const cNode = this.buildLayoutNode(child, canvasW, canvasH, currentId);
        if (cNode) childrenNodes.push(cNode);
      }
    }

    return {
      id: elem.id,
      name: elem.name || elem.id || elem.type,
      type: elem.type,
      box,
      style,
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      fill: style.fill,
      stroke: style.stroke,
      strokeColor: style.stroke,
      opacity: style.opacity,
      fit: imageLayout?.fit,
      zIndex: elem.zIndex || 0,
      mask: elem.mask,
      textLayout,
      polygonLayout,
      pathLayout,
      stackLayout,
      imageLayout,
      adjustLayout,
      filters: elem.filter && elem.filter.length > 0 ? elem.filter : undefined,
      parentId,
      parent: parentId,
      children: childrenNodes.length > 0 ? childrenNodes.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)) : undefined
    };
  }

  private convertGradient(grad: ResolvedGradient): GradientStyle {
    return {
      type: grad.type,
      angle: grad.angleDeg,
      direction: grad.direction,
      shape: grad.shape,
      stops: grad.stops.map(s => ({
        color: s.color,
        position: s.offset
      }))
    };
  }
}
