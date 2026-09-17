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
      return createCanvas(width, height) as unknown as HTMLCanvasElement;
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

  // Remove common Adobe / Monotype / System PostScript suffixes
  let clean = psName.replace(/(MT|PSMT|PS|Std|Pro|OTF|TTF)$/i, '');

  let familyPart = clean;
  let stylePart = '';

  if (clean.includes('-')) {
    const parts = clean.split('-');
    familyPart = parts[0]!;
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
  } else if ('k' in color && typeof color.k === 'number') {
    const val = Math.round((1 - color.k / 100) * 255);
    r = val; g = val; b = val;
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
  input: string | Buffer,
  options: PsdImportOptions = {}
): Promise<PsdImportResult> {
  ensurePsdCanvas();

  let buffer: Buffer;
  let inputFileDir: string | undefined;
  let inputBaseName = 'document';

  if (typeof input === 'string') {
    const resolvedPath = path.resolve(process.cwd(), input);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`PSD file not found: ${resolvedPath}`);
    }
    buffer = fs.readFileSync(resolvedPath);
    inputFileDir = path.dirname(resolvedPath);
    inputBaseName = path.basename(resolvedPath, path.extname(resolvedPath));
  } else {
    buffer = input;
  }

  const psd: Psd = readPsd(buffer as any, { skipThumbnail: true });
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

  // 1. Canvas Definition
  const canvasName = psd.name || inputBaseName;
  lines.push(`canvas "${canvasName}" {`);
  lines.push(`  size: ${docWidth}px ${docHeight}px;`);

  // Detect canvas background fill if layer 0 is a full-bleed background
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
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        const hex = psdColorToToad({ r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] / 255 });
        lines.push(`  fill: ${hex};`);
        startIndex = 1; // Handled as canvas background
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
  function processLayer(layer: Layer, indent = ''): void {
    if (layer.hidden && !options.includeHidden) {
      return;
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
      lines.push(`${indent}group #${id} "${layerName}" {`);
      for (const prop of commonProps) {
        lines.push(`${indent}  ${prop}`);
      }
      for (const child of layer.children) {
        processLayer(child, indent + '  ');
      }
      lines.push(`${indent}}`);
      lines.push('');
      return;
    }

    // B. Text Layer
    if (layer.text) {
      stats.textCount++;
      const textRaw = layer.text.text || '';
      const textJson = JSON.stringify(textRaw);

      const postScriptName = layer.text.style?.font?.name;
      const { fontFamily, fontWeight } = parsePostScriptFont(postScriptName);

      const rawFontSize = layer.text.style?.fontSize || 16;
      const fontSizePx = dpi !== 72 ? Math.round((rawFontSize * dpi) / 72) : Math.round(rawFontSize);

      const textColor = psdColorToToad(layer.text.style?.fillColor, '#000000');

      lines.push(`${indent}text #${id} ${textJson} {`);
      lines.push(`${indent}  at: ${left}px ${top}px;`);
      lines.push(`${indent}  font-family: "${fontFamily}";`);
      lines.push(`${indent}  font-size: ${fontSizePx}px;`);
      if (fontWeight !== 400) {
        lines.push(`${indent}  font-weight: ${fontWeight};`);
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
      if (layer.text.style?.leading && layer.text.style.leading > 0) {
        const lh = dpi !== 72
          ? Math.round((layer.text.style.leading * dpi) / 72)
          : Math.round(layer.text.style.leading);
        lines.push(`${indent}  line-height: ${lh}px;`);
      }

      for (const prop of commonProps) {
        lines.push(`${indent}  ${prop}`);
      }

      lines.push(`${indent}}`);
      lines.push('');
      return;
    }

    // C. Vector Shape Layer
    if (layer.vectorMask?.paths && layer.vectorMask.paths.length > 0) {
      stats.vectorCount++;
      const firstPath = layer.vectorMask.paths[0]!;
      const rectCheck = isAxisAlignedRect(firstPath);

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
      const strokeProp = strokeEffect && strokeEffect.enabled !== false
        ? `border: ${strokeEffect.size?.value ?? 1}px ${psdColorToToad(strokeEffect.color)};`
        : null;

      if (rectCheck && rectCheck.isRect) {
        // Output clean rect
        lines.push(`${indent}rect #${id} "${layerName}" {`);
        lines.push(`${indent}  at: ${Math.round(rectCheck.x)}px ${Math.round(rectCheck.y)}px;`);
        lines.push(`${indent}  size: ${Math.round(rectCheck.w)}px ${Math.round(rectCheck.h)}px;`);
        lines.push(`${indent}  fill: ${fillColor};`);
        if (strokeProp) lines.push(`${indent}  ${strokeProp}`);
        for (const prop of commonProps) lines.push(`${indent}  ${prop}`);
        lines.push(`${indent}}`);
        lines.push('');
        return;
      } else {
        // Output SVG vector path
        const d = bezierPathToSvgD(firstPath);
        lines.push(`${indent}path #${id} "${layerName}" {`);
        lines.push(`${indent}  d: "${d}";`);
        lines.push(`${indent}  fill: ${fillColor};`);
        if (strokeProp) lines.push(`${indent}  ${strokeProp}`);
        for (const prop of commonProps) lines.push(`${indent}  ${prop}`);
        lines.push(`${indent}}`);
        lines.push('');
        return;
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

        lines.push(`${indent}image #${id} "${layerName}" {`);
        lines.push(`${indent}  src: "${relAssetPath}";`);
        lines.push(`${indent}  at: ${left}px ${top}px;`);
        lines.push(`${indent}  size: ${w}px ${h}px;`);
        lines.push(`${indent}  fit: cover;`);
        for (const prop of commonProps) lines.push(`${indent}  ${prop}`);
        lines.push(`${indent}}`);
        lines.push('');
      } catch (err: any) {
        warnings.push(`Failed to export raster layer '${layerName}': ${err.message}`);
      }
      return;
    }

    // Fallback: Empty container or unknown layer
    if (w > 0 && h > 0) {
      lines.push(`${indent}rect #${id} "${layerName}" {`);
      lines.push(`${indent}  at: ${left}px ${top}px;`);
      lines.push(`${indent}  size: ${w}px ${h}px;`);
      lines.push(`${indent}  fill: transparent;`);
      for (const prop of commonProps) lines.push(`${indent}  ${prop}`);
      lines.push(`${indent}}`);
      lines.push('');
    }
  }

  // Traverse top-level layers
  const topLayers = psd.children || [];
  for (let i = startIndex; i < topLayers.length; i++) {
    processLayer(topLayers[i]!);
  }

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
