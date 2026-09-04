/**
 * src/engine/imageCache.ts
 * Shared decoded-image cache and CSS-filter support helpers.
 * Both the raster renderer and the PSD exporter resolve images through this
 * module so a given source image is decoded at most once per mtime.
 */

import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import * as fs from 'node:fs';
import * as path from 'node:path';

const imageCache = new Map<string, { img: Image; mtime: number }>();
const MAX_CACHE_ENTRIES = 100;

export function getImageCacheSize(): number {
  return imageCache.size;
}

export function clearImageCache(): void {
  imageCache.clear();
}

export async function resolveSharedImage(imgSrc: string, basePath?: string): Promise<Image | null> {
  try {
    const resolvedPath = basePath ? path.resolve(path.dirname(basePath), imgSrc) : path.resolve(imgSrc);

    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    const stat = fs.statSync(resolvedPath);
    const mtime = stat.mtimeMs;

    const cached = imageCache.get(resolvedPath);
    if (cached && cached.mtime === mtime) {
      return cached.img;
    }

    const buf = fs.readFileSync(resolvedPath);
    const img = await loadImage(buf);

    if (imageCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = imageCache.keys().next().value;
      if (firstKey) imageCache.delete(firstKey);
    }
    imageCache.set(resolvedPath, { img, mtime });

    return img;
  } catch {
    return null;
  }
}

let filterSupportProbe: boolean | null = null;

/**
 * Feature-detect ctx.filter support. On some native backends assigning a
 * filter string can throw synchronously; we degrade to unfiltered rendering
 * instead of crashing.
 */
export function detectCanvasFilterSupport(): boolean {
  if (filterSupportProbe !== null) return filterSupportProbe;
  try {
    const c = createCanvas(4, 4);
    const ctx = c.getContext('2d');
    ctx.filter = 'blur(1px)';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 2, 2);
    ctx.filter = 'none';
    filterSupportProbe = true;
  } catch {
    filterSupportProbe = false;
  }
  return filterSupportProbe;
}

/**
 * Padding required around a node when rendering it into an isolated layer:
 * Gaussian blur spreads roughly 3 sigma, and drop-shadow offsets shift pixels.
 */
export function estimateFilterPad(filterStr: string): number {
  let maxPx = 0;
  const re = /(-?[0-9.]+)px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(filterStr)) !== null) {
    maxPx = Math.max(maxPx, parseFloat(m[1]!));
  }
  return Math.min(400, Math.max(8, Math.ceil(maxPx * 3)));
}

/**
 * Final safety net before handing a CSS filter string to Skia: only known,
 * well-formed function chains survive; anything malformed becomes 'none'.
 * (Skia aborts the whole process on unparsable values — JS try/catch cannot
 * intercept that.)
 */
export function sanitizeFilterCss(css?: string): string {
  const s = (css || '').trim();
  if (!s || s === 'none') return 'none';
  const re = /(^|\s)([a-zA-Z][a-zA-Z0-9-]*)\(((?:[^()]|\([^()]*\))*)\)(?=\s|$)/g;
  const KNOWN = new Set(['blur', 'saturate', 'brightness', 'contrast', 'grayscale', 'sepia', 'invert', 'hue-rotate', 'drop-shadow', 'opacity']);
  let ok = true;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (!KNOWN.has(m[2]!.toLowerCase())) { ok = false; break; }
    // A known function with NO arguments (e.g. "blur()") is still malformed
    // CSS and aborts Skia just as hard as an unknown name.
    if ((m[3] || '').trim() === '') { ok = false; break; }
  }
  if (!ok) return 'none';
  const leftover = s.replace(re, ' ');
  if (/[^\s]/.test(leftover)) return 'none';
  return s;
}

const UNIT_FILTERS = new Set(['blur', 'drop-shadow', 'hue-rotate']);

export interface SplitFilterResult {
  safeCss: string;
  shadow?: { offsetX: number; offsetY: number; blur: number; color: string };
  opacityFactor: number;
}

/**
 * Splits drop-shadow()/opacity() out of a filter chain. The remaining
 * functions are Skia-safe for direct ctx.filter assignment (Skia aborts the
 * process on drop-shadow inside ctx.filter); the extracted effects are meant
 * to be applied by the caller at composite time.
 */
export function splitUnsafeFilterFns(css?: string): SplitFilterResult {
  if (!css || css.trim() === '' || css.trim() === 'none') {
    return { safeCss: 'none', opacityFactor: 1 };
  }
  let shadow: SplitFilterResult['shadow'] | undefined;
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
    const after = args.slice(lastEnd).trim().replace(/^,\s*/, '');
    // CSS accepts the color before OR after the lengths.
    const color = before ? before : (after || 'rgba(0,0,0,0.5)');
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

  let safeCss = css
    // Malformed zero-argument functions must never survive into ctx.filter.
    .replace(/\b[a-zA-Z][a-zA-Z0-9-]*\(\s*\)/g, '')
    .replace(dsRe, '').replace(opRe, '').replace(/,\s*,+/g, ', ').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();

  return { safeCss: safeCss || 'none', shadow, opacityFactor };
}

/** Append missing CSS units so unitless resolver output satisfies ctx.filter. */
export function normalizeFilterCss(filterStr: string): string {
  return filterStr.replace(/\b(blur|drop-shadow|hue-rotate|brightness|contrast|saturate|grayscale|sepia|invert)\(\s*(-?[0-9.]+)\s*\)/g, (full: string, fn: string, num: string) => {
    if (!UNIT_FILTERS.has(fn)) return full;
    const unit = fn === 'hue-rotate' ? 'deg' : 'px';
    return fn + '(' + num + unit + ')';
  });
}
