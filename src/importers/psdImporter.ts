/**
 * src/importers/psdImporter.ts
 * High-fidelity Adobe Photoshop .psd to TOAD DSL (.toad) converter.
 *
 * Reads layered Photoshop binary files via ag-psd and @napi-rs/canvas,
 * extracts text, vectors, groups, layer styles, and raster images,
 * and compiles them into clean, syntactically valid .toad code.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { initializeCanvas, readPsd, Psd, Layer, BezierPath, Color } from 'ag-psd';
import { createCanvas } from '@napi-rs/canvas';
import { parseToad } from '../parser/parser.js';
import { formatToad } from '../tools/formatter.js';

let isPsdCanvasInitialized = false;
function ensurePsdCanvas(): void {
  if (!isPsdCanvasInitialized) {
    initializeCanvas((width: number, height: number) => {
      return createCanvas(Math.max(1, width), Math.max(1, height)) as unknown as HTMLCanvasElement;
    });
    isPsdCanvasInitialized = true;
  }
}

export interface PsdImportOptions {
  /** Output .toad file path. If omitted and input was a file path, defaults to <file>.toad */
  outPath?: string;
  /** Directory where extracted bitmap/raster assets are saved (default: ./assets) */
  assetsDir?: string;
  /** Whether to export pixel/bitmap layers as PNG image files (default: true) */
  extractImages?: boolean;
  /** Include hidden layers in generated code (default: false) */
  includeHidden?: boolean;
  /** Format generated code using TOAD code formatter (default: true) */
  formatCode?: boolean;
  /** Target resolution DPI for font/unit conversion (default: 72) */
  dpi?: number;
}

export interface ExtractedAsset {
  layerName: string;
  filePath: string;
  relativePath: string;
  width: number;
  height: number;
}

export interface PsdImportResult {
  toadCode: string;
  outputFile?: string;
  assets: ExtractedAsset[];
  warnings: string[];
  stats: {
    layersCount: number;
    textCount: number;
    vectorCount: number;
    imageCount: number;
    groupCount: number;
  };
}

/**
 * Parses PostScript font names (e.g. 'Inter-SemiBold', 'Arial-BoldItalicMT', 'HelveticaNeue-Medium')
 * into human-readable family names, weights, and styles.
 */
export function parsePostScriptFont(psName?: string): { fontFamily: string; fontWeight: number; isItalic: boolean } {
  if (!psName) {
    return { fontFamily: 'Inter', fontWeight: 400, isItalic: false };
  }

  const vendorSuffixRegex = /(MT|PSMT|PS|Std|Pro|OTF|TTF)$/i;
  // Remove common Adobe / Monotype / System PostScript suffixes
  let clean = psName.replace(vendorSuffixRegex, '');

  let familyPart = clean;
  let stylePart = '';

  if (clean.includes('-')) {
    const parts = clean.split('-');
    familyPart = parts[0]!.replace(vendorSuffixRegex, '');
    stylePart = parts.slice(1).join('-');
  }

  // Restore camelCase spaces (e.g., "HelveticaNeue" -> "Helvetica Neue")
  const fontFamily = familyPart.replace(/([a-z])([A-Z])/g, '$1 $2').trim();

  const lowerStyle = (stylePart || clean).toLowerCase();
  const isItalic = lowerStyle.includes('italic') || lowerStyle.includes('oblique');

  let fontWeight = 400;
  if (lowerStyle.includes('thin') || lowerStyle.includes('hairline')) fontWeight = 100;
  else if (lowerStyle.includes('extralight') || lowerStyle.includes('ultralight')) fontWeight = 200;
  else if (lowerStyle.includes('light')) fontWeight = 300;
  else if (lowerStyle.includes('medium')) fontWeight = 500;
  else if (lowerStyle.includes('semibold') || lowerStyle.includes('demibold')) fontWeight = 600;
  else if (lowerStyle.includes('extrabold') || lowerStyle.includes('ultrabold')) fontWeight = 800;
  else if (lowerStyle.includes('black') || lowerStyle.includes('heavy')) fontWeight = 900;
  else if (lowerStyle.includes('bold')) fontWeight = 700;

  return { fontFamily, fontWeight, isItalic };
}

/**
 * Converts any ag-psd Color type into a valid TOAD hex or alpha string.
 */
export function psdColorToToad(color?: Color, defaultHex = '#000000'): string {
  if (!color) return defaultHex;

  let r = 0, g = 0, b = 0, a = 1;

  if ('r' in color && 'g' in color && 'b' in color) {
    r = Math.round(color.r);
    g = Math.round(color.g);
    b = Math.round(color.b);
    if ('a' in color && typeof color.a === 'number') a = color.a;
  } else if ('fr' in color && 'fg' in color && 'fb' in color) {
    r = Math.round(color.fr * 255);
    g = Math.round(color.fg * 255);
    b = Math.round(color.fb * 255);
    if ('a' in color && typeof color.a === 'number') a = color.a;
  } else if ('c' in color && 'm' in color && 'y' in color && 'k' in color) {
    const c = typeof color.c === 'number' ? (color.c > 1 ? color.c / 100 : color.c) : 0;
    const m = typeof color.m === 'number' ? (color.m > 1 ? color.m / 100 : color.m) : 0;
    const y = typeof color.y === 'number' ? (color.y > 1 ? color.y / 100 : color.y) : 0;
    const k = typeof color.k === 'number' ? (color.k > 1 ? color.k / 100 : color.k) : 0;
    r = Math.round(255 * (1 - c) * (1 - k));
    g = Math.round(255 * (1 - m) * (1 - k));
    b = Math.round(255 * (1 - y) * (1 - k));
    if ('a' in color && typeof color.a === 'number') a = color.a;
  } else if ('l' in color && 'a' in color && 'b' in color && typeof color.l === 'number' && typeof color.a === 'number' && typeof color.b === 'number') {
    const l = color.l;
    const la = color.a;
    const lb = color.b;
    const yVal = (l + 16) / 116;
    const xVal = la / 500 + yVal;
    const zVal = yVal - lb / 200;
    const x3 = xVal * xVal * xVal;
    const y3 = yVal * yVal * yVal;
    const z3 = zVal * zVal * zVal;
    const x = (x3 > 0.008856 ? x3 : (xVal - 16 / 116) / 7.787) * 95.047;
    const y = (y3 > 0.008856 ? y3 : (yVal - 16 / 116) / 7.787) * 100.0;
    const z = (z3 > 0.008856 ? z3 : (zVal - 16 / 116) / 7.787) * 108.883;
    r = Math.round((x * 3.2406 + y * -1.5372 + z * -0.4986) * 2.55);
    g = Math.round((x * -0.9689 + y * 1.8758 + z * 0.0415) * 2.55);
    b = Math.round((x * 0.0557 + y * -0.2040 + z * 1.0570) * 2.55);
  } else if ('k' in color && typeof color.k === 'number') {
    const val = Math.round((1 - (color.k > 1 ? color.k / 100 : color.k)) * 255);
    r = val; g = val; b = val;
    if ('a' in color && typeof color.a === 'number') a = color.a;
  }

  const hex = '#' + [r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
  if (a < 0.999) {
    return `alpha(${hex.toUpperCase()}, ${Number(a.toFixed(2))})`;
  }
  return hex.toUpperCase();
}

/**
 * Converts ag-psd BezierPath knots into an SVG path 'd' string.
 */
export function bezierPathToSvgD(path: BezierPath): string {
  const knots = path.knots;
  if (!knots || knots.length === 0) return '';
  for (const k of knots) {
    if (!k || !k.points || k.points.length < 6) return '';
  }

  let d = '';
  const first = knots[0]!;
  const startX = Number(first.points[2]!.toFixed(2));
  const startY = Number(first.points[3]!.toFixed(2));
  d += `M ${startX} ${startY}`;

  const numKnots = knots.length;
  const loopCount = path.open ? numKnots - 1 : numKnots;

  for (let i = 0; i < loopCount; i++) {
    const currKnot = knots[i]!;
    const nextKnot = knots[(i + 1) % numKnots]!;

    const cp1x = Number(currKnot.points[4]!.toFixed(2));
    const cp1y = Number(currKnot.points[5]!.toFixed(2));
    const cp2x = Number(nextKnot.points[0]!.toFixed(2));
    const cp2y = Number(nextKnot.points[1]!.toFixed(2));
    const endX = Number(nextKnot.points[2]!.toFixed(2));
    const endY = Number(nextKnot.points[3]!.toFixed(2));

    const currAnchorX = Number(currKnot.points[2]!.toFixed(2));
    const currAnchorY = Number(currKnot.points[3]!.toFixed(2));

    const isLinear = Math.abs(cp1x - currAnchorX) < 0.2 && Math.abs(cp1y - currAnchorY) < 0.2 &&
                     Math.abs(cp2x - endX) < 0.2 && Math.abs(cp2y - endY) < 0.2;

    if (isLinear) {
      d += ` L ${endX} ${endY}`;
    } else {
      d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${endX} ${endY}`;
    }
  }

  if (!path.open) {
    d += ' Z';
  }

  return d.trim();
}

/**
 * Checks if a BezierPath forms an axis-aligned rectangle.
 */
function isAxisAlignedRect(path: BezierPath): { isRect: boolean; x: number; y: number; w: number; h: number } | null {
  if (path.open || !path.knots || path.knots.length !== 4) return null;
  for (const k of path.knots) {
    if (!k || !k.points || k.points.length < 6) return null;
  }

  const pts = path.knots.map(k => ({
    x: Number(k.points[2]!.toFixed(2)),
    y: Number(k.points[3]!.toFixed(2)),
    cp1x: Number(k.points[4]!.toFixed(2)),
    cp1y: Number(k.points[5]!.toFixed(2)),
    cp2x: Number(k.points[0]!.toFixed(2)),
    cp2y: Number(k.points[1]!.toFixed(2)),
  }));

  // Verify all segments are linear
  for (let i = 0; i < 4; i++) {
    const cur = pts[i]!;
    const next = pts[(i + 1) % 4]!;
    const isLinear = Math.abs(cur.cp1x - cur.x) < 0.2 && Math.abs(cur.cp1y - cur.y) < 0.2 &&
                     Math.abs(next.cp2x - next.x) < 0.2 && Math.abs(next.cp2y - next.y) < 0.2;
    if (!isLinear) return null;
  }

  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Each knot must lie on one of the 4 bounding box corners
  for (const p of pts) {
    const matchesCorner = (Math.abs(p.x - minX) < 0.5 || Math.abs(p.x - maxX) < 0.5) &&
                          (Math.abs(p.y - minY) < 0.5 || Math.abs(p.y - maxY) < 0.5);
    if (!matchesCorner) return null;
  }

  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return null;

  return { isRect: true, x: minX, y: minY, w, h };
}

/**
 * Maps Photoshop blend modes to valid TOAD / CSS blend modes.
 */
function mapPsdBlendModeToToad(blendMode?: string): string | null {
  if (!blendMode || blendMode === 'normal' || blendMode === 'pass through') return null;
  const map: Record<string, string> = {
    'multiply': 'multiply',
    'screen': 'screen',
    'overlay': 'overlay',
    'darken': 'darken',
    'lighten': 'lighten',
    'color dodge': 'color-dodge',
    'color burn': 'color-burn',
    'hard light': 'hard-light',
    'soft light': 'soft-light',
    'difference': 'difference',
    'exclusion': 'exclusion',
    'hue': 'hue',
    'saturation': 'saturation',
    'color': 'color',
    'luminosity': 'luminosity'
  };
  return map[blendMode] || blendMode.replace(/\s+/g, '-');
}

/**
 * Generates an element ID from a Photoshop layer name.
 */
function sanitizeElementId(rawName: string, usedIds: Set<string>): string {
  let clean = rawName.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+/, '');
  if (!clean || /^[0-9]/.test(clean)) clean = 'el_' + clean;
  let unique = clean;
  let counter = 2;
  while (usedIds.has(unique.toLowerCase())) {
    unique = `${clean}_${counter++}`;
  }
  usedIds.add(unique.toLowerCase());
  return unique;
}

/**
 * Imports and converts a Photoshop .psd file into TOAD DSL.
 */
export async function importPsd(
  input: string | Buffer | Psd,
  options: PsdImportOptions = {}
): Promise<PsdImportResult> {
  ensurePsdCanvas();

  function escapeDslString(str: string): string {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  let psd: Psd;
  let inputFileDir: string | undefined;
  let inputBaseName = 'document';

  if (typeof input === 'object' && input !== null && !Buffer.isBuffer(input) && 'width' in input && 'children' in input) {
    psd = input as Psd;
  } else {
    let buffer: Buffer;
    if (typeof input === 'string') {
      const resolvedPath = path.resolve(process.cwd(), input);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`PSD file not found: ${resolvedPath}`);
      }
      buffer = fs.readFileSync(resolvedPath);
      inputFileDir = path.dirname(resolvedPath);
      inputBaseName = path.basename(resolvedPath, path.extname(resolvedPath));
    } else {
      buffer = input as Buffer;
    }

    try {
      psd = readPsd(buffer as any, {
        skipThumbnail: true,
        skipCompositeImageData: true,
        skipLinkedFilesData: true,
        skipLayerImageData: options.extractImages === false
      });
    } catch (err: any) {
      throw new Error(`Failed to parse PSD file (file may be corrupted or invalid): ${err?.message || String(err)}`);
    }
  }
  const dpi = options.dpi || (psd as any).resolution || 72;

  const docWidth = Math.round(psd.width);
  const docHeight = Math.round(psd.height);

  const outPath = options.outPath
    ? path.resolve(process.cwd(), options.outPath)
    : (inputFileDir ? path.join(inputFileDir, `${inputBaseName}.toad`) : undefined);

  const outputDir = outPath ? path.dirname(outPath) : (inputFileDir || process.cwd());
  const assetsFolder = options.assetsDir
    ? path.resolve(outputDir, options.assetsDir)
    : path.join(outputDir, 'assets');

  const assets: ExtractedAsset[] = [];
  const warnings: string[] = [];
  const usedIds = new Set<string>();

  const stats = {
    layersCount: 0,
    textCount: 0,
    vectorCount: 0,
    imageCount: 0,
    groupCount: 0,
  };

  const lines: string[] = [];

  // Helper to compute deep bounds for groups
  function getLayerBounds(layer: Layer): { left: number; top: number; right: number; bottom: number } {
    if (layer.children && layer.children.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const ch of layer.children) {
        const cb = getLayerBounds(ch);
        minX = Math.min(minX, cb.left);
        minY = Math.min(minY, cb.top);
        maxX = Math.max(maxX, cb.right);
        maxY = Math.max(maxY, cb.bottom);
      }
      if (minX !== Infinity) {
        return { left: Math.round(minX), top: Math.round(minY), right: Math.round(maxX), bottom: Math.round(maxY) };
      }
    }

    const left = Math.round(layer.left ?? 0);
    const top = Math.round(layer.top ?? 0);
    const right = Math.round(layer.right ?? left);
    const bottom = Math.round(layer.bottom ?? top);
    return { left, top, right, bottom };
  }

  // 1. Canvas Definition
  const canvasName = psd.name || inputBaseName;
  lines.push(`canvas "${escapeDslString(canvasName)}" {`);
  lines.push(`  size: ${docWidth}px ${docHeight}px;`);

  // Detect canvas background fill if layer 0 is a full-bleed solid background
  let startIndex = 0;
  const firstLayer = psd.children && psd.children.length > 0 ? psd.children[0] : undefined;
  if (firstLayer && !firstLayer.hidden && firstLayer.canvas && !firstLayer.text && (!firstLayer.children || firstLayer.children.length === 0)) {
    const isFullSize = (firstLayer.left ?? 0) <= 0 &&
                       (firstLayer.top ?? 0) <= 0 &&
                       (firstLayer.right ?? 0) >= docWidth &&
                       (firstLayer.bottom ?? 0) >= docHeight;
    const isBgName = /background|hintergrund/i.test(firstLayer.name || '');

    if (isFullSize && isBgName && firstLayer.canvas) {
      try {
        const ctx = (firstLayer.canvas as any).getContext('2d');
        const cW = firstLayer.canvas.width;
        const cH = firstLayer.canvas.height;
        // 13-point distributed grid probe to verify if canvas is uniform solid background
        const probeCoords: [number, number][] = [
          [0, 0],
          [Math.max(0, cW - 1), 0],
          [0, Math.max(0, cH - 1)],
          [Math.max(0, cW - 1), Math.max(0, cH - 1)],
          [Math.floor(cW / 2), Math.floor(cH / 2)],
          [Math.floor(cW / 2), 0],
          [Math.floor(cW / 2), Math.max(0, cH - 1)],
          [0, Math.floor(cH / 2)],
          [Math.max(0, cW - 1), Math.floor(cH / 2)],
          [Math.floor(cW / 4), Math.floor(cH / 4)],
          [Math.floor((3 * cW) / 4), Math.floor(cH / 4)],
          [Math.floor(cW / 4), Math.floor((3 * cH) / 4)],
          [Math.floor((3 * cW) / 4), Math.floor((3 * cH) / 4)],
        ];

        const p0 = ctx.getImageData(probeCoords[0][0], probeCoords[0][1], 1, 1).data;
        let isUniform = true;
        for (let i = 1; i < probeCoords.length; i++) {
          const pt = ctx.getImageData(probeCoords[i][0], probeCoords[i][1], 1, 1).data;
          if (pt[0] !== p0[0] || pt[1] !== p0[1] || pt[2] !== p0[2] || pt[3] !== p0[3]) {
            isUniform = false;
            break;
          }
        }

        if (isUniform) {
          const hex = psdColorToToad({ r: p0[0], g: p0[1], b: p0[2], a: p0[3] / 255 });
          lines.push(`  fill: ${hex};`);
          startIndex = 1; // Handled cleanly as solid canvas background
        } else {
          // Complex photo, artwork, or gradient: keep canvas clean and extract layer 0 as image asset
          lines.push(`  fill: transparent;`);
          startIndex = 0;
        }
      } catch {
        lines.push(`  fill: #FFFFFF;`);
      }
    } else {
      lines.push(`  fill: #FFFFFF;`);
    }
  } else {
    lines.push(`  fill: #FFFFFF;`);
  }

  lines.push('}');
  lines.push('');

  // 2. Recursive Layer Walker
  function processLayer(layer: Layer, indent = '', parentLeft = 0, parentTop = 0, maskTargetId?: string): string | undefined {
    if (layer.hidden && !options.includeHidden) {
      return undefined;
    }

    stats.layersCount++;
    const layerName = layer.name?.trim() || 'Layer';
    const id = sanitizeElementId(layerName, usedIds);

    const left = Math.round(layer.left ?? 0);
    const top = Math.round(layer.top ?? 0);
    const right = Math.round(layer.right ?? left);
    const bottom = Math.round(layer.bottom ?? top);
    const w = Math.max(1, right - left);
    const h = Math.max(1, bottom - top);

    const localLeft = left - parentLeft;
    const localTop = top - parentTop;

    // Common layer properties (opacity, blendMode, shadow)
    const commonProps: string[] = [];
    if (typeof layer.opacity === 'number' && layer.opacity < 0.999) {
      commonProps.push(`opacity: ${Number(layer.opacity.toFixed(2))};`);
    }

    const blendMode = mapPsdBlendModeToToad(layer.blendMode);
    if (blendMode) {
      commonProps.push(`blend-mode: ${blendMode};`);
    }

    // Drop Shadow from Layer Effects
    if (layer.effects?.dropShadow && layer.effects.dropShadow.length > 0) {
      const shadow = layer.effects.dropShadow[0]!;
      if (shadow.enabled !== false) {
        const dist = typeof shadow.distance === 'number' ? shadow.distance : (shadow.distance?.value ?? 0);
        const size = typeof shadow.size === 'number' ? shadow.size : (shadow.size?.value ?? 0);
        const angleDeg = shadow.angle ?? 120;
        const angleRad = (angleDeg * Math.PI) / 180;
        const offsetX = -Math.round(dist * Math.cos(angleRad));
        const offsetY = Math.round(dist * Math.sin(angleRad));
        const choke = typeof shadow.choke === 'number' ? shadow.choke : (shadow.choke?.value ?? 0);
        const spread = Math.round(size * (choke / 100));
        const blur = Math.max(0, size - spread);
        const shadowColor = psdColorToToad(shadow.color, '#000000');
        const alphaStr = typeof shadow.opacity === 'number' && shadow.opacity < 1
          ? `alpha(${shadowColor}, ${Number(shadow.opacity.toFixed(2))})`
          : shadowColor;
        commonProps.push(`shadow: ${offsetX}px ${offsetY}px ${blur}px ${alphaStr};`);
      }
    }

    // A. Folder / Group
    if (layer.children && layer.children.length > 0) {
      stats.groupCount++;
      const bounds = getLayerBounds(layer);
      const gLeft = bounds.left;
      const gTop = bounds.top;
      const gW = Math.max(1, bounds.right - bounds.left);
      const gH = Math.max(1, bounds.bottom - bounds.top);
      const groupLocalLeft = gLeft - parentLeft;
      const groupLocalTop = gTop - parentTop;

      lines.push(`${indent}group #${id} "${escapeDslString(layerName)}" {`);
      lines.push(`${indent}  at: ${groupLocalLeft}px ${groupLocalTop}px;`);
      lines.push(`${indent}  size: ${gW}px ${gH}px;`);
      if (maskTargetId) {
        lines.push(`${indent}  mask: #${maskTargetId};`);
      }
      for (const prop of commonProps) {
        lines.push(`${indent}  ${prop}`);
      }
      processLayersList(layer.children, indent + '  ', gLeft, gTop);
      lines.push(`${indent}}`);
      lines.push('');
      return id;
    }

    // B. Text Layer
    if (layer.text) {
      stats.textCount++;
      const textRaw = (layer.text.text || '').replace(/\r\n|\r/g, '\n');
      const textJson = JSON.stringify(textRaw);

      const firstRunStyle = (layer.text as any).styleRuns?.[0]?.style;
      const effectiveStyle = layer.text.style || firstRunStyle;

      const postScriptName = effectiveStyle?.font?.name || firstRunStyle?.font?.name;
      const { fontFamily, fontWeight, isItalic } = parsePostScriptFont(postScriptName);

      const rawFontSize = effectiveStyle?.fontSize || firstRunStyle?.fontSize || 16;

      let transformScaleY = 1;
      if (Array.isArray(layer.text.transform) && layer.text.transform.length >= 4) {
        const [, b, , d] = layer.text.transform;
        const sY = Math.hypot(b || 0, d || 1);
        if (sY > 0.01 && Number.isFinite(sY)) {
          transformScaleY = sY;
        }
      }

      const effectiveFontSize = rawFontSize * transformScaleY;
      const fontSizePx = dpi !== 72 ? Math.round((effectiveFontSize * dpi) / 72) : Math.round(effectiveFontSize);

      const textColor = psdColorToToad(effectiveStyle?.fillColor || firstRunStyle?.fillColor, '#000000');

      lines.push(`${indent}text #${id} ${textJson} {`);
      lines.push(`${indent}  at: ${localLeft}px ${localTop}px;`);
      lines.push(`${indent}  font-family: "${fontFamily}";`);
      lines.push(`${indent}  font-size: ${fontSizePx}px;`);
      if (fontWeight !== 400) {
        lines.push(`${indent}  font-weight: ${fontWeight};`);
      }
      if (isItalic) {
        lines.push(`${indent}  font-style: italic;`);
      }
      lines.push(`${indent}  color: ${textColor};`);

      // Alignment
      const just = layer.text.paragraphStyle?.justification;
      if (just === 'center') {
        lines.push(`${indent}  align: center;`);
      } else if (just === 'right') {
        lines.push(`${indent}  align: right;`);
      } else if (just && just.startsWith('justify')) {
        lines.push(`${indent}  align: justify;`);
      }

      // Word-wrap / Box size
      const isMultiline = textRaw.includes('\n') || layer.text.shapeType === 'box';
      if (isMultiline && w > 0) {
        lines.push(`${indent}  width: ${w}px;`);
      }

      // Leading / Line Height
      const leadingVal = effectiveStyle?.leading || firstRunStyle?.leading;
      if (leadingVal && leadingVal > 0) {
        const effectiveLh = leadingVal * transformScaleY;
        const lh = dpi !== 72
          ? Math.round((effectiveLh * dpi) / 72)
          : Math.round(effectiveLh);
        lines.push(`${indent}  line-height: ${lh}px;`);
      }

      if (maskTargetId) {
        lines.push(`${indent}  mask: #${maskTargetId};`);
      }

      for (const prop of commonProps) {
        lines.push(`${indent}  ${prop}`);
      }

      lines.push(`${indent}}`);
      lines.push('');
      return id;
    }

    // C. Vector Shape Layer
    if (layer.vectorMask?.paths && layer.vectorMask.paths.length > 0) {
      stats.vectorCount++;
      const allPaths = layer.vectorMask.paths;
      const firstPath = allPaths[0]!;
      const rectCheck = allPaths.length === 1 ? isAxisAlignedRect(firstPath) : null;

      // Resolve shape fill color
      let fillColor = '#000000';
      const vectorContent = (layer as any).vectorContent;
      if (vectorContent && 'color' in vectorContent) {
        fillColor = psdColorToToad(vectorContent.color);
      } else if (layer.effects?.solidFill && layer.effects.solidFill.length > 0) {
        fillColor = psdColorToToad(layer.effects.solidFill[0]!.color);
      }

      // Stroke from layer effects
      const strokeEffect = layer.effects?.stroke?.[0];
      const strokeSize = typeof strokeEffect?.size === 'number'
        ? strokeEffect.size
        : (strokeEffect?.size?.value ?? 1);
      const strokeProp = strokeEffect && strokeEffect.enabled !== false
        ? `border: ${strokeSize}px ${psdColorToToad(strokeEffect.color)};`
        : null;

      if (rectCheck && rectCheck.isRect) {
        // Output clean rect
        lines.push(`${indent}rect #${id} "${escapeDslString(layerName)}" {`);
        lines.push(`${indent}  at: ${Math.round(rectCheck.x - parentLeft)}px ${Math.round(rectCheck.y - parentTop)}px;`);
        lines.push(`${indent}  size: ${Math.round(rectCheck.w)}px ${Math.round(rectCheck.h)}px;`);
        lines.push(`${indent}  fill: ${fillColor};`);
        if (strokeProp) lines.push(`${indent}  ${strokeProp}`);
        if (maskTargetId) lines.push(`${indent}  mask: #${maskTargetId};`);
        for (const prop of commonProps) lines.push(`${indent}  ${prop}`);
        lines.push(`${indent}}`);
        lines.push('');
        return id;
      } else {
        // Compute path bounds across all subpaths
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const subpath of allPaths) {
          for (const k of subpath.knots || []) {
            if (!k || !k.points || k.points.length < 6) continue;
            const kx = k.points[2]!;
            const ky = k.points[3]!;
            minX = Math.min(minX, kx);
            minY = Math.min(minY, ky);
            maxX = Math.max(maxX, kx);
            maxY = Math.max(maxY, ky);
          }
        }
        if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }
        const pathW = Math.max(1, Math.round(maxX - minX));
        const pathH = Math.max(1, Math.round(maxY - minY));
        const localPathX = Math.round(minX - parentLeft);
        const localPathY = Math.round(minY - parentTop);

        // Normalize all subpaths relative to (minX, minY) and join SVG 'd' commands
        const subDList: string[] = [];
        for (const subpath of allPaths) {
          const normalizedPath: BezierPath = {
            ...subpath,
            knots: (subpath.knots || []).filter(k => k && k.points && k.points.length >= 6).map(k => ({
              ...k,
              points: [
                k.points[0]! - minX, k.points[1]! - minY,
                k.points[2]! - minX, k.points[3]! - minY,
                k.points[4]! - minX, k.points[5]! - minY,
              ]
            }))
          };
          const subD = bezierPathToSvgD(normalizedPath);
          if (subD) subDList.push(subD);
        }

        const d = subDList.join(' ');
        lines.push(`${indent}path #${id} "${escapeDslString(layerName)}" {`);
        lines.push(`${indent}  at: ${localPathX}px ${localPathY}px;`);
        lines.push(`${indent}  size: ${pathW}px ${pathH}px;`);
        lines.push(`${indent}  d: "${d}";`);
        lines.push(`${indent}  fill: ${fillColor};`);
        if (strokeProp) lines.push(`${indent}  ${strokeProp}`);
        if (maskTargetId) lines.push(`${indent}  mask: #${maskTargetId};`);
        for (const prop of commonProps) lines.push(`${indent}  ${prop}`);
        lines.push(`${indent}}`);
        lines.push('');
        return id;
      }
    }

    // D. Raster / Bitmap / Smart Object Layer
    if (layer.canvas && options.extractImages !== false) {
      stats.imageCount++;
      if (!fs.existsSync(assetsFolder)) {
        fs.mkdirSync(assetsFolder, { recursive: true });
      }

      const assetFileName = `${id}.png`;
      const assetDiskPath = path.join(assetsFolder, assetFileName);
      const relDir = path.relative(outputDir, assetsFolder).replace(/\\/g, '/');
      const relAssetPath = relDir
        ? (relDir.startsWith('.') ? `${relDir}/${assetFileName}` : `./${relDir}/${assetFileName}`)
        : `./${assetFileName}`;

        try {
          const pngBuf = (layer.canvas as any).toBuffer('image/png');
          fs.writeFileSync(assetDiskPath, pngBuf);
          assets.push({
            layerName,
            filePath: assetDiskPath,
            relativePath: relAssetPath,
            width: w,
            height: h
          });

          // Free canvas memory immediately after saving to disk
          if (layer.canvas) {
            try {
              (layer.canvas as any).width = 1;
              (layer.canvas as any).height = 1;
            } catch {}
            layer.canvas = undefined as any;
          }

          lines.push(`${indent}image #${id} "${escapeDslString(layerName)}" {`);
          lines.push(`${indent}  src: "${relAssetPath}";`);
          lines.push(`${indent}  at: ${localLeft}px ${localTop}px;`);
          lines.push(`${indent}  size: ${w}px ${h}px;`);
          lines.push(`${indent}  fit: cover;`);
          if (maskTargetId) lines.push(`${indent}  mask: #${maskTargetId};`);
          for (const prop of commonProps) lines.push(`${indent}  ${prop}`);
          lines.push(`${indent}}`);
          lines.push('');
        } catch (err: any) {
          warnings.push(`Failed to export raster layer '${layerName}': ${err.message}`);
        }
      return id;
    }

    // Fallback: Empty container or unknown layer
    if (w > 0 && h > 0) {
      lines.push(`${indent}rect #${id} "${escapeDslString(layerName)}" {`);
      lines.push(`${indent}  at: ${localLeft}px ${localTop}px;`);
      lines.push(`${indent}  size: ${w}px ${h}px;`);
      lines.push(`${indent}  fill: transparent;`);
      if (maskTargetId) lines.push(`${indent}  mask: #${maskTargetId};`);
      for (const prop of commonProps) lines.push(`${indent}  ${prop}`);
      lines.push(`${indent}}`);
      lines.push('');
      return id;
    }

    return undefined;
  }

  // Helper to process a list of sibling layers and track clipping masks
  function processLayersList(layers: Layer[], indent = '', parentLeft = 0, parentTop = 0): void {
    let lastBaseId: string | undefined;

    for (const layer of layers) {
      if (layer.hidden && !options.includeHidden) {
        continue;
      }

      const isClipped = Boolean(layer.clipping || (layer as any).clipped);
      const layerId = processLayer(layer, indent, parentLeft, parentTop, isClipped ? lastBaseId : undefined);
      if (!isClipped && layerId) {
        lastBaseId = layerId;
      }
    }
  }

  // Traverse top-level layers
  const topLayers = psd.children || [];
  const initialLayers = topLayers.slice(startIndex);
  processLayersList(initialLayers, '', 0, 0);

  let code = lines.join('\n');

  // Format code if requested
  if (options.formatCode !== false) {
    try {
      code = formatToad(code);
    } catch {
      // Keep original code if formatter fails
    }
  }

  // Validate that generated code compiles cleanly in TOAD
  try {
    const ast = parseToad(code, outPath || 'imported.toad');
    const errors = (ast.diagnostics || []).filter(d => d.severity === 'error');
    if (errors.length > 0) {
      for (const err of errors) {
        warnings.push(`TOAD syntax diagnostic: ${err.message}`);
      }
    }
  } catch (err: any) {
    warnings.push(`TOAD parser verification warning: ${err.message}`);
  }

  // Save to disk if outPath is resolved
  if (outPath) {
    const targetDir = path.dirname(outPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(outPath, code, 'utf-8');
  }

  return {
    toadCode: code,
    outputFile: outPath,
    assets,
    warnings,
    stats
  };
}
