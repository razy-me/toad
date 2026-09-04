/**
 * src/engine/drawUtils.ts
 * Shared drawing routines, color parsing, gradient interpolation,
 * blend mode mapping, CSS filter parsing, and image fit math.
 */

import { CanvasRenderingContext2D, SKRSContext2D } from '@napi-rs/canvas';
import { BlendMode } from 'ag-psd';

export interface ColorRgba {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
  a: number; // 0 - 1
}

export interface ParsedColor extends ColorRgba {
  hex: string;
  rgba: string;
}

export interface GradientStopInput {
  color: string;
  position?: number;
  offset?: number;
}

export interface DistributedGradientStop {
  color: string;
  position: number;
  offset: number;
}

export interface ParsedFilter {
  name: string;
  args: string[];
  raw?: string;
}

export interface ShapeBoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ============================================================================
// 1. Color Parsing & Normalization
// ============================================================================

const NAMED_COLORS: Record<string, ColorRgba> = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  red: { r: 255, g: 0, b: 0, a: 1 },
  green: { r: 0, g: 128, b: 0, a: 1 },
  blue: { r: 0, g: 0, b: 255, a: 1 },
  yellow: { r: 255, g: 255, b: 0, a: 1 },
  cyan: { r: 0, g: 255, b: 255, a: 1 },
  magenta: { r: 255, g: 0, b: 255, a: 1 },
  gray: { r: 128, g: 128, b: 128, a: 1 },
  grey: { r: 128, g: 128, b: 128, a: 1 },
  silver: { r: 192, g: 192, b: 192, a: 1 },
  maroon: { r: 128, g: 0, b: 0, a: 1 },
  olive: { r: 128, g: 128, b: 0, a: 1 },
  purple: { r: 128, g: 0, b: 128, a: 1 },
  teal: { r: 0, g: 128, b: 128, a: 1 },
  navy: { r: 0, g: 0, b: 128, a: 1 },
  orange: { r: 255, g: 165, b: 0, a: 1 },
  pink: { r: 255, g: 192, b: 203, a: 1 },
  lime: { r: 0, g: 255, b: 0, a: 1 },
  brown: { r: 165, g: 42, b: 42, a: 1 },
  gold: { r: 255, g: 215, b: 0, a: 1 }
};

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s > 1 ? s / 100 : s));
  l = Math.max(0, Math.min(1, l > 1 ? l / 100 : l));

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0, g1 = 0, b1 = 0;
  if (h >= 0 && h < 60) {
    r1 = c; g1 = x; b1 = 0;
  } else if (h >= 60 && h < 120) {
    r1 = x; g1 = c; b1 = 0;
  } else if (h >= 120 && h < 180) {
    r1 = 0; g1 = c; b1 = x;
  } else if (h >= 180 && h < 240) {
    r1 = 0; g1 = x; b1 = c;
  } else if (h >= 240 && h < 300) {
    r1 = x; g1 = 0; b1 = c;
  } else if (h >= 300 && h < 360) {
    r1 = c; g1 = 0; b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

export function cmykToRgb(c: number, m: number, y: number, k: number, a = 1): ColorRgba {
  c = Math.max(0, Math.min(1, c > 1 ? c / 100 : c));
  m = Math.max(0, Math.min(1, m > 1 ? m / 100 : m));
  y = Math.max(0, Math.min(1, y > 1 ? y / 100 : y));
  k = Math.max(0, Math.min(1, k > 1 ? k / 100 : k));
  a = Math.max(0, Math.min(1, a > 1 ? a / 100 : a));

  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));

  return { r, g, b, a };
}

export function parseColorToRgba(colorStr?: string): ColorRgba {
  if (!colorStr) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  const str = colorStr.trim().toLowerCase();

  if (str === 'currentcolor') {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  if (NAMED_COLORS[str]) {
    return { ...NAMED_COLORS[str] };
  }

  // Hex format: #rgb, #rgba, #rrggbb, #rrggbbaa
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      return { r, g, b, a: 1 };
    }
    if (hex.length === 4) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      const a = parseInt(hex[3]! + hex[3]!, 16) / 255;
      return { r, g, b, a };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b, a: 1 };
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      return { r, g, b, a };
    }
  }

  // CMYK format: cmyk(c, m, y, k) or cmyk(c%, m%, y%, k%) or cmyk(c, m, y, k, a)
  const cmykMatch = str.match(/cmyk\s*\(\s*([0-9.]+)(%?)[,\s]+([0-9.]+)(%?)[,\s]+([0-9.]+)(%?)[,\s]+([0-9.]+)(%?)(?:[,\s/]+([0-9.]+)(%?))?\s*\)/i);
  if (cmykMatch) {
    const parseCmykVal = (val: string, hasPct: string) => {
      const n = parseFloat(val);
      if (hasPct === '%') return n / 100;
      return n > 1 ? n / 100 : n;
    };
    const c = parseCmykVal(cmykMatch[1]!, cmykMatch[2]!);
    const m = parseCmykVal(cmykMatch[3]!, cmykMatch[4]!);
    const y = parseCmykVal(cmykMatch[5]!, cmykMatch[6]!);
    const k = parseCmykVal(cmykMatch[7]!, cmykMatch[8]!);
    const a = cmykMatch[9] !== undefined ? parseCmykVal(cmykMatch[9]!, cmykMatch[10] || '') : 1;
    return cmykToRgb(c, m, y, k, a);
  }

  // RGB / RGBA format: rgb(r, g, b) | rgba(r, g, b, a) | rgb(r g b / a) | percentages allowed
  const rgbMatch = str.match(/rgba?\s*\(\s*([0-9.]+%?)[,\s]+([0-9.]+%?)[,\s]+([0-9.]+%?)(?:\s*[\/,]\s*([0-9.]+%?))?\s*\)/i);
  if (rgbMatch) {
    const ch = (raw: string, max: number) => {
      let v: number;
      if (raw.endsWith('%')) {
        v = (parseFloat(raw.slice(0, -1)) / 100) * max;
      } else {
        v = parseFloat(raw);
      }
      return Math.min(max, Math.max(0, v));
    };
    const r = ch(rgbMatch[1]!, 255);
    const g = ch(rgbMatch[2]!, 255);
    const b = ch(rgbMatch[3]!, 255);
    const a = rgbMatch[4] !== undefined ? ch(rgbMatch[4], 1) : 1;
    return { r, g, b, a };
  }

  // HSL / HSLA format: hsl(h, s%, l%) or hsla(h, s%, l%, a)
  const hslMatch = str.match(/hsla?\s*\(\s*(-?[0-9.]+)(?:deg)?[,\s]+([-0-9.]+)%?[,\s]+([-0-9.]+)%?(?:\s*[\/,]\s*([0-9.]+%?))?\s*\)/i);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]!);
    const s = parseFloat(hslMatch[2]!);
    const l = parseFloat(hslMatch[3]!);
    let a = 1;
    if (hslMatch[4] !== undefined) {
      // Accept both fractional and percentage alpha (parity with rgba()).
      const raw = hslMatch[4].endsWith('%')
        ? parseFloat(hslMatch[4]) / 100
        : parseFloat(hslMatch[4]);
      a = Math.min(1, Math.max(0, isNaN(raw) ? 1 : raw));
    }
    const { r, g, b } = hslToRgb(h, s, l);
    return { r, g, b, a };
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

export function parseColor(colorStr?: string): ParsedColor {
  const rgbaObj = parseColorToRgba(colorStr);
  const rRound = Math.max(0, Math.min(255, Math.round(rgbaObj.r)));
  const gRound = Math.max(0, Math.min(255, Math.round(rgbaObj.g)));
  const bRound = Math.max(0, Math.min(255, Math.round(rgbaObj.b)));
  const rHex = rRound.toString(16).padStart(2, '0');
  const gHex = gRound.toString(16).padStart(2, '0');
  const bHex = bRound.toString(16).padStart(2, '0');

  let hex = `#${rHex}${gHex}${bHex}`;
  if (rgbaObj.a < 1) {
    const aHex = Math.round(rgbaObj.a * 255).toString(16).padStart(2, '0');
    hex = `#${rHex}${gHex}${bHex}${aHex}`;
  }

  const rgba = `rgba(${rgbaObj.r}, ${rgbaObj.g}, ${rgbaObj.b}, ${rgbaObj.a})`;

  return {
    ...rgbaObj,
    hex,
    rgba
  };
}

export function applyAlpha(colorStr: string, alphaVal: number): string {
  const parsed = parseColor(colorStr);
  const a = Math.max(0, Math.min(1, alphaVal > 1 ? alphaVal / 100 : alphaVal));
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${a})`;
}

export function lightenColor(colorStr: string, amount: number): string {
  const parsed = parseColor(colorStr);
  const r = parsed.r / 255;
  const g = parsed.g / 255;
  const b = parsed.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  const amt = amount > 1 ? amount / 100 : amount;
  l = Math.max(0, Math.min(1, l + amt));

  const hue2rgb = (p: number, q: number, t: number) => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm -= 1;
    if (tNorm < 1/6) return p + (q - p) * 6 * tNorm;
    if (tNorm < 1/2) return q;
    if (tNorm < 2/3) return p + (q - p) * (2/3 - tNorm) * 6;
    return p;
  };

  let newR: number, newG: number, newB: number;
  if (s === 0) {
    newR = newG = newB = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    newR = hue2rgb(p, q, h + 1/3);
    newG = hue2rgb(p, q, h);
    newB = hue2rgb(p, q, h - 1/3);
  }

  return `rgba(${Math.round(newR * 255)}, ${Math.round(newG * 255)}, ${Math.round(newB * 255)}, ${parsed.a})`;
}

export function darkenColor(colorStr: string, amount: number): string {
  const amt = amount > 1 ? amount / 100 : amount;
  return lightenColor(colorStr, -amt);
}

// ============================================================================
// 2. Gradient Stop Evenly-Spaced Interpolation
// ============================================================================

/**
 * Distributes missing gradient stop offsets evenly between adjacent defined stops.
 * Guarantees that the first stop defaults to 0 and the last stop to 1 if unspecified.
 */
export function distributeGradientStops(stops: GradientStopInput[]): DistributedGradientStop[] {
  if (!stops || stops.length === 0) return [];
  if (stops.length === 1) {
    const pos = stops[0]!.position ?? stops[0]!.offset ?? 0;
    return [{ color: stops[0]!.color, position: pos, offset: pos }];
  }

  const result: DistributedGradientStop[] = stops.map(s => {
    const p = s.position ?? s.offset ?? -1;
    return {
      color: s.color,
      position: p,
      offset: p
    };
  });

  if (result[0]!.position === -1) {
    result[0]!.position = 0;
    result[0]!.offset = 0;
  }
  if (result[result.length - 1]!.position === -1) {
    result[result.length - 1]!.position = 1;
    result[result.length - 1]!.offset = 1;
  }

  let lastDefinedIdx = 0;
  for (let i = 1; i < result.length; i++) {
    if (result[i]!.position !== -1) {
      const startPos = result[lastDefinedIdx]!.position;
      const endPos = result[i]!.position;
      const span = i - lastDefinedIdx;
      const step = (endPos - startPos) / span;

      for (let k = lastDefinedIdx + 1; k < i; k++) {
        const computedPos = startPos + step * (k - lastDefinedIdx);
        result[k]!.position = computedPos;
        result[k]!.offset = computedPos;
      }
      lastDefinedIdx = i;
    }
  }

  return result;
}

// ============================================================================
// 3. Canvas Gradient Construction
// ============================================================================

export function createCanvasGradient(
  ctx: CanvasRenderingContext2D | SKRSContext2D,
  grad: {
    type: 'linear' | 'radial' | 'conic';
    angleDeg?: number;
    direction?: string;
    shape?: 'circle' | 'ellipse';
    stops: GradientStopInput[];
  },
  box: ShapeBoundingBox
): CanvasGradient {
  const distributedStops = distributeGradientStops(grad.stops).sort((a, b) => a.position - b.position);
  const angle = typeof grad.angleDeg === 'number' ? grad.angleDeg : typeof (grad as any).angle === 'number' ? (grad as any).angle : undefined;

  if (grad.type === 'conic') {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    // @napi-rs/canvas supports createConicGradient(startAngle, x, y)
    // startAngle is in radians. CSS conic-gradient starts at 12 o'clock, which is -PI/2.
    // CSS angle increases clockwise.
    let startAngle = -Math.PI / 2;
    if (angle !== undefined) {
      startAngle = (angle - 90) * (Math.PI / 180);
    }
    const canvasGrad = (ctx as any).createConicGradient(startAngle, cx, cy);
    for (const s of distributedStops) {
      const offset = Math.min(1, Math.max(0, s.position));
      canvasGrad.addColorStop(offset, s.color);
    }
    return canvasGrad;
  }

  if (grad.type === 'radial') {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const radius = Math.max(box.w, box.h) / 2 || 1;
    const canvasGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);

    for (const s of distributedStops) {
      const offset = Math.min(1, Math.max(0, s.position));
      canvasGrad.addColorStop(offset, s.color);
    }
    return canvasGrad;
  }

  // Linear Gradient. Per CSS, a linear-gradient without angle or direction
  // defaults to "to bottom" (matches the SVG exporter's default).
  let x0 = box.x;
  let y0 = box.y;
  let x1 = box.x;
  let y1 = box.y + box.h;

  if (grad.direction) {
    const dir = grad.direction.toLowerCase().trim();
    if (dir === 'to right') {
      x0 = box.x; y0 = box.y; x1 = box.x + box.w; y1 = box.y;
    } else if (dir === 'to bottom') {
      x0 = box.x; y0 = box.y; x1 = box.x; y1 = box.y + box.h;
    } else if (dir === 'to left') {
      x0 = box.x + box.w; y0 = box.y; x1 = box.x; y1 = box.y;
    } else if (dir === 'to top') {
      x0 = box.x; y0 = box.y + box.h; x1 = box.x; y1 = box.y;
    } else if (dir === 'to bottom right' || dir === 'to right bottom') {
      x0 = box.x; y0 = box.y; x1 = box.x + box.w; y1 = box.y + box.h;
    } else if (dir === 'to top right' || dir === 'to right top') {
      x0 = box.x; y0 = box.y + box.h; x1 = box.x + box.w; y1 = box.y;
    } else if (dir === 'to bottom left' || dir === 'to left bottom') {
      x0 = box.x + box.w; y0 = box.y; x1 = box.x; y1 = box.y + box.h;
    } else if (dir === 'to top left' || dir === 'to left top') {
      x0 = box.x + box.w; y0 = box.y + box.h; x1 = box.x; y1 = box.y;
    }
  } else if (typeof angle === 'number') {
    // CSS gradient angle: 0deg = to top, 90deg = to right, 180deg = to bottom
    const angleRad = ((angle - 90) * Math.PI) / 180;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const len = (Math.abs(box.w * Math.cos(angleRad)) + Math.abs(box.h * Math.sin(angleRad))) / 2;

    x0 = cx - Math.cos(angleRad) * len;
    y0 = cy - Math.sin(angleRad) * len;
    x1 = cx + Math.cos(angleRad) * len;
    y1 = cy + Math.sin(angleRad) * len;
  }

  const canvasGrad = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const s of distributedStops) {
    const offset = Math.min(1, Math.max(0, s.position));
    canvasGrad.addColorStop(offset, s.color);
  }

  return canvasGrad;
}

// ============================================================================
// 4. Blend Mode Mapping
// ============================================================================

export function mapBlendMode(mode?: string): GlobalCompositeOperation {
  if (!mode) return 'source-over';
  const m = mode.trim().toLowerCase();

  switch (m) {
    case 'normal':
    case 'source-over':
      return 'source-over';
    case 'multiply':
      return 'multiply';
    case 'screen':
      return 'screen';
    case 'overlay':
      return 'overlay';
    case 'darken':
      return 'darken';
    case 'lighten':
      return 'lighten';
    case 'color-dodge':
    case 'color dodge':
      return 'color-dodge';
    case 'color-burn':
    case 'color burn':
      return 'color-burn';
    case 'hard-light':
    case 'hard light':
      return 'hard-light';
    case 'soft-light':
    case 'soft light':
      return 'soft-light';
    case 'difference':
      return 'difference';
    case 'exclusion':
      return 'exclusion';
    case 'hue':
      return 'hue';
    case 'saturation':
      return 'saturation';
    case 'color':
      return 'color';
    case 'luminosity':
      return 'luminosity';
    default:
      return 'source-over';
  }
}

export function mapBlendModeToPsd(mode?: string): BlendMode {
  if (!mode) return 'normal';
  const m = mode.trim().toLowerCase();

  switch (m) {
    case 'normal':
    case 'source-over':
      return 'normal';
    case 'multiply':
      return 'multiply';
    case 'screen':
      return 'screen';
    case 'overlay':
      return 'overlay';
    case 'darken':
      return 'darken';
    case 'lighten':
      return 'lighten';
    case 'color-dodge':
    case 'color dodge':
      return 'color dodge';
    case 'color-burn':
    case 'color burn':
      return 'color burn';
    case 'hard-light':
    case 'hard light':
      return 'hard light';
    case 'soft-light':
    case 'soft light':
      return 'soft light';
    case 'difference':
      return 'difference';
    case 'exclusion':
      return 'exclusion';
    case 'hue':
      return 'hue';
    case 'saturation':
      return 'saturation';
    case 'color':
      return 'color';
    case 'luminosity':
      return 'luminosity';
    default:
      return 'normal';
  }
}

// ============================================================================
// 5. CSS Filter String Parsing & Application
// ============================================================================

export function parseFilterString(filterStr?: string): ParsedFilter[] {
  if (!filterStr || filterStr.trim() === 'none' || filterStr.trim() === '') {
    return [];
  }

  const results: ParsedFilter[] = [];
  // Balanced-paren capture so color arguments like rgba(0, 0, 0, 0.9) do not
  // terminate the match early.
  const regex = /([a-zA-Z][a-zA-Z0-9\-]*)\(((?:[^()]|\([^()]*\))*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(filterStr)) !== null) {
    const name = match[1]!.trim();
    const argContent = match[2]!.trim();
    // Depth-aware tokenization: split on top-level whitespace/commas only,
    // so nested color functions like rgba(0, 0, 0, 0.9) stay intact.
    const args: string[] = [];
    if (argContent.length > 0) {
      let cur = '';
      let depth = 0;
      for (const ch of argContent) {
        if (ch === '(') {
          depth++;
          cur += ch;
        } else if (ch === ')') {
          depth = Math.max(0, depth - 1);
          cur += ch;
        } else if (depth === 0 && (ch === ',' || /\s/.test(ch))) {
          if (cur) {
            args.push(cur);
            cur = '';
          }
        } else {
          cur += ch;
        }
      }
      if (cur) args.push(cur);
    }

    results.push({
      name,
      args,
      raw: match[0]
    });
  }

  return results;
}

export function parseAndApplyFilter(ctx: CanvasRenderingContext2D | SKRSContext2D, filterStr?: string): void {
  if (!filterStr || filterStr.trim() === 'none' || filterStr.trim() === '') {
    try {
      (ctx as any).filter = 'none';
    } catch {}
    return;
  }

  // Parse filter functions to validate syntax
  const parsed = parseFilterString(filterStr);
  if (parsed.length === 0) {
    try {
      (ctx as any).filter = 'none';
    } catch {}
    return;
  }

  // Note: On Windows with @napi-rs/canvas, setting ctx.filter to CSS filter strings causes
  // an unhandled native C++ access violation/segfault when drawing operations (fill/stroke)
  // are executed. To protect against process termination while safely supporting DSL filters,
  // we guard filter assignment.
  try {
    (ctx as any).filter = 'none';
  } catch {
    (ctx as any).filter = 'none';
  }
}

// ============================================================================
// 6. Image Fit Calculations
// ============================================================================

export function drawImageWithFit(
  ctx: CanvasRenderingContext2D | SKRSContext2D,
  img: any,
  fit: 'fill' | 'cover' | 'contain' | 'none' = 'fill',
  bx: number,
  by: number,
  bw: number,
  bh: number
): void {
  const iw = img.width || bw || 1;
  const ih = img.height || bh || 1;

  if (fit === 'fill') {
    try {
      (ctx as SKRSContext2D).drawImage(img, bx, by, bw, bh);
    } catch {}
    return;
  }

  let scale = 1.0;
  if (fit === 'cover') {
    scale = Math.max(bw / iw, bh / ih);
  } else if (fit === 'contain') {
    scale = Math.min(bw / iw, bh / ih);
  } else if (fit === 'none') {
    scale = 1.0;
  }

  const dw = iw * scale;
  const dh = ih * scale;
  const dx = bx + (bw - dw) / 2;
  const dy = by + (bh - dh) / 2;

  if (fit === 'cover' || fit === 'none') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();
    try {
      (ctx as SKRSContext2D).drawImage(img, dx, dy, dw, dh);
    } catch {}
    ctx.restore();
  } else {
    try {
      (ctx as SKRSContext2D).drawImage(img, dx, dy, dw, dh);
    } catch {}
  }
}

// ============================================================================
// 7. Shape Drawing Helpers
// ============================================================================

export function drawRect(
  ctx: CanvasRenderingContext2D | SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius?: number | [number, number, number, number]
): void {
  ctx.beginPath();
  if (typeof radius === 'number' && radius > 0) {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, radius);
    } else {
      const r = Math.min(radius, w / 2, h / 2);
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
  } else if (Array.isArray(radius) && radius.length === 4) {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, radius);
    } else {
      const [tl = 0, tr = 0, br = 0, bl = 0] = radius;
      ctx.moveTo(x + tl, y);
      ctx.lineTo(x + w - tr, y);
      ctx.arcTo(x + w, y, x + w, y + tr, tr);
      ctx.lineTo(x + w, y + h - br);
      ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
      ctx.lineTo(x + bl, y + h);
      ctx.arcTo(x, y + h, x, y + h - bl, bl);
      ctx.lineTo(x, y + tl);
      ctx.arcTo(x, y, x + tl, y, tl);
      ctx.closePath();
    }
  } else {
    ctx.rect(x, y, w, h);
  }
}

export function drawCircle(
  ctx: CanvasRenderingContext2D | SKRSContext2D,
  cx: number,
  cy: number,
  r: number | { rx: number; ry: number }
): void {
  ctx.beginPath();
  if (typeof r === 'number') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else {
    ctx.ellipse(cx, cy, r.rx, r.ry, 0, 0, Math.PI * 2);
  }
}

export function drawPolygon(
  ctx: CanvasRenderingContext2D | SKRSContext2D,
  points: Array<{ x: number; y: number }>,
  radius?: number | [number, number, number, number] | number[]
): void {
  if (!points || points.length === 0) return;
  const n = points.length;
  if (n < 3) return;

  const radNum = typeof radius === 'number' ? radius : Array.isArray(radius) && radius.length > 0 ? radius[0] : 0;
  if (!radNum || radNum <= 0) {
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < n; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.closePath();
    return;
  }

  // Draw smoothly rounded polygon using arcTo
  ctx.beginPath();
  const midX = (points[n - 1]!.x + points[0]!.x) / 2;
  const midY = (points[n - 1]!.y + points[0]!.y) / 2;
  ctx.moveTo(midX, midY);

  for (let i = 0; i < n; i++) {
    const current = points[i]!;
    const next = points[(i + 1) % n]!;
    const cornerR = Array.isArray(radius) && typeof radius[i] === 'number' ? radius[i] : radNum;
    ctx.arcTo(current.x, current.y, next.x, next.y, cornerR);
  }
  ctx.closePath();
}

/**
 * Draws professional print crop marks, bleed lines, and registration targets (Passkreuze).
 */
export function drawCropMarks(
  ctx: CanvasRenderingContext2D | SKRSContext2D,
  width: number,
  height: number,
  bleed = 0,
  margin = 30
): void {
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.5;
  ctx.lineCap = 'square';

  // 1. Corner Crop Lines (horizontal & vertical ticks marking the Trim Box)
  // Lines must stop outside the bleed box to avoid printing into the bleed area.
  const stopGap = bleed + 2;

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(-margin, 0);
  ctx.lineTo(-stopGap, 0);
  ctx.moveTo(0, -margin);
  ctx.lineTo(0, -stopGap);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(width + stopGap, 0);
  ctx.lineTo(width + margin, 0);
  ctx.moveTo(width, -margin);
  ctx.lineTo(width, -stopGap);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(-margin, height);
  ctx.lineTo(-stopGap, height);
  ctx.moveTo(0, height + stopGap);
  ctx.lineTo(0, height + margin);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(width + stopGap, height);
  ctx.lineTo(width + margin, height);
  ctx.moveTo(width, height + stopGap);
  ctx.lineTo(width, height + margin);
  ctx.stroke();

  // 2. Registration Targets (Passkreuze) at midpoints outside bleed
  const drawTarget = (cx: number, cy: number, r = 6) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r - 4, cy);
    ctx.lineTo(cx + r + 4, cy);
    ctx.moveTo(cx, cy - r - 4);
    ctx.lineTo(cx, cy + r + 4);
    ctx.stroke();
  };

  if (margin >= 20) {
    drawTarget(width / 2, -margin / 2);
    drawTarget(width / 2, height + margin / 2);
    drawTarget(-margin / 2, height / 2);
    drawTarget(width + margin / 2, height / 2);
  }

  ctx.restore();
}

// ============================================================================
// 9. Photographic Adjustments & Grading Engine
// ============================================================================

export interface PhotoAdjustParams {
  exposure?: number;    // Ev adjustment (-3.0 to +3.0)
  contrast?: number;    // Multiplier (1.0 = normal, 1.2 = +20%)
  brightness?: number;  // Multiplier (1.0 = normal, 1.1 = +10%)
  saturation?: number;  // Multiplier (0.0 = B&W, 1.0 = normal, 1.5 = +50%)
  warmth?: number;      // -1.0 to +1.0 (warm amber vs cool blue)
  highlights?: number;  // -1.0 to +1.0
  shadows?: number;     // -1.0 to +1.0
}

/**
 * Applies high-precision per-pixel photographic tone and color adjustments to an ImageData buffer.
 */
export function applyPhotographicGrading(data: Uint8ClampedArray, params: PhotoAdjustParams): void {
  const exposure = params.exposure ?? 0;
  const contrast = params.contrast ?? 1;
  const brightness = params.brightness ?? 1;
  const saturation = params.saturation ?? 1;
  const warmth = params.warmth ?? 0;
  const highlights = params.highlights ?? 0;
  const shadows = params.shadows ?? 0;

  // Precompute exposure factor (2^Ev)
  const expFactor = exposure !== 0 ? Math.pow(2, exposure) : 1;
  const contrastFactor = contrast;
  const brightnessFactor = brightness;

  // Warmth shifts: warm adds red and slight green, subtracts blue; cool is inverse
  const warmR = 1 + warmth * 0.18;
  const warmG = 1 + warmth * 0.05;
  const warmB = 1 - warmth * 0.18;

  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    let r = data[i]!;
    let g = data[i + 1]!;
    let b = data[i + 2]!;

    // 1. Exposure compensation
    if (expFactor !== 1) {
      r *= expFactor;
      g *= expFactor;
      b *= expFactor;
    }

    // 2. Brightness multiplier
    if (brightnessFactor !== 1) {
      r *= brightnessFactor;
      g *= brightnessFactor;
      b *= brightnessFactor;
    }

    // 3. Contrast adjustment centered at mid-gray 128
    if (contrastFactor !== 1) {
      r = (r - 128) * contrastFactor + 128;
      g = (g - 128) * contrastFactor + 128;
      b = (b - 128) * contrastFactor + 128;
    }

    // 4. Highlights and Shadows
    if (highlights !== 0 || shadows !== 0) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const normLum = Math.max(0, Math.min(1, lum / 255));
      if (highlights !== 0 && normLum > 0.5) {
        const weight = (normLum - 0.5) * 2;
        const shift = highlights * 40 * weight;
        r += shift;
        g += shift;
        b += shift;
      }
      if (shadows !== 0 && normLum < 0.5) {
        const weight = (0.5 - normLum) * 2;
        const shift = shadows * 40 * weight;
        r += shift;
        g += shift;
        b += shift;
      }
    }

    // 5. Warmth / White Balance
    if (warmth !== 0) {
      r *= warmR;
      g *= warmG;
      b *= warmB;
    }

    // 6. Saturation (Rec.709 relative luminance)
    if (saturation !== 1) {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = gray + (r - gray) * saturation;
      g = gray + (g - gray) * saturation;
      b = gray + (b - gray) * saturation;
    }

    data[i] = r < 0 ? 0 : r > 255 ? 255 : (r | 0);
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : (g | 0);
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : (b | 0);
  }
}

/**
 * Draws a radial vignette overlay smoothly darkening edges.
 */
export function drawVignette(
  ctx: CanvasRenderingContext2D | SKRSContext2D,
  width: number,
  height: number,
  amount: number
): void {
  const normAmount = Math.max(0, Math.min(1, amount > 1 ? amount / 100 : amount));
  if (normAmount <= 0) return;

  ctx.save();
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.hypot(width, height) / 2;

  const grad = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.7, `rgba(0, 0, 0, ${(normAmount * 0.4).toFixed(3)})`);
  grad.addColorStop(1, `rgba(0, 0, 0, ${normAmount.toFixed(3)})`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
