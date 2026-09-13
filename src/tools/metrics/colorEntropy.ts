/**
 * src/tools/metrics/colorEntropy.ts
 * Computational Color Science: OKLCH conversions, Perceptual Shannon Color Entropy,
 * Slop-Triad Proximity Vector, and Muddy Gradient detection.
 */

import { ColorRgba } from '../../engine/drawUtils.js';

export interface OklchColor {
  l: number; // 0.0 to 1.0 (lightness)
  c: number; // ~0.0 to 0.4 (chroma)
  h: number; // 0.0 to 360.0 (hue in degrees)
}

export interface ColorTelemetryResult {
  shannonEntropyBits: number; // 0.0 to 5.0 (optimal: 2.0 to 3.5)
  slopTriadDistance: number; // 0.0 to 1.0 (< 0.18 = matches purple/cyan darkmode trope)
  muddyGradientCount: number;
  distinctHueSectors: number;
  paletteCharacter: string;
}

/**
 * Converts sRGB [0..255] to perceptual OKLCH color space.
 * Algorithm: sRGB -> Linear RGB -> OKLab -> OKLCH
 */
export function sRgbToOklch(rgba: ColorRgba): OklchColor {
  const sanitize = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(255, v)) : 0;
  // 1. sRGB to linear sRGB
  const s2lin = (c: number) => {
    const v = sanitize(c) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = s2lin(rgba.r);
  const g = s2lin(rgba.g);
  const b = s2lin(rgba.b);

  // 2. Linear sRGB to LMS (approx OKLab matrix M1)
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  // 3. LMS to OKLab (M2)
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_lab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  // 4. OKLab to OKLCH
  const c = Math.hypot(a, b_lab);
  let h = (Math.atan2(b_lab, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  if (isNaN(h)) h = 0;

  return {
    l: Math.max(0, Math.min(1, Number.isFinite(L) ? L : 0)),
    c: Math.max(0, Number.isFinite(c) ? c : 0),
    h: Math.max(0, Math.min(360, Number.isFinite(h) ? h : 0))
  };
}

/**
 * Calculates Shannon entropy of a palette discretized into 3D OKLCH voxels.
 * Bins: 10 Lightness steps x 6 Chroma steps x 12 Hue sectors = 720 bins.
 */
export function calculateOklchEntropy(colors: ColorRgba[]): number {
  if (colors.length === 0) return 0;

  const voxelCounts = new Map<string, number>();
  let totalWeight = 0;

  // Strided sampling for huge color arrays (e.g. 4K/8K raster pixel buffers)
  // to avoid V8 memory spikes and GC pressure while retaining statistical entropy
  const stride = colors.length > 2000 ? Math.ceil(colors.length / 2000) : 1;

  for (let i = 0; i < colors.length; i += stride) {
    const rgba = colors[i]!;
    const alpha = rgba.a !== undefined ? Math.max(0, Math.min(1, rgba.a)) : 1;
    if (alpha <= 0.001) continue;

    const oklch = sRgbToOklch(rgba);
    const lBin = Math.min(9, Math.floor(oklch.l * 10));
    const cBin = Math.min(5, Math.floor(oklch.c * 20));
    const hBin = Math.min(11, Math.floor((oklch.h / 360) * 12));
    const key = `${lBin}_${cBin}_${hBin}`;
    voxelCounts.set(key, (voxelCounts.get(key) || 0) + alpha);
    totalWeight += alpha;
  }

  if (totalWeight <= 0) return 0;

  let entropy = 0;
  for (const count of voxelCounts.values()) {
    const p = count / totalWeight;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return Math.round(entropy * 100) / 100;
}

/**
 * Archetypal AI-slop color vectors in OKLCH:
 * Base:   Deep Slate/Black (L ~ 0.08, C ~ 0.02, H ~ 260)
 * Slop 1: Electric Violet #8B5CF6 (L ~ 0.58, C ~ 0.22, H ~ 293)
 * Slop 2: Cyan #06B6D4 (L ~ 0.74, C ~ 0.16, H ~ 215)
 */
const SLOP_TROPE_TARGETS: OklchColor[] = [
  { l: 0.08, c: 0.02, h: 260 },
  { l: 0.58, c: 0.22, h: 293 },
  { l: 0.74, c: 0.16, h: 215 }
];

/**
 * Measures the normalized Euclidean distance of the palette's closest matches
 * to the archetypal "Vercel / Discord Neon Darkmode" Slop Triad.
 * Distance < 0.18 indicates high proximity to the cliché.
 */
export function calculateSlopTriadDistance(colors: ColorRgba[]): number {
  const visible = colors.filter(c => (c.a ?? 1) > 0.05);
  if (visible.length === 0) return 1.0;

  const stride = visible.length > 1000 ? Math.ceil(visible.length / 1000) : 1;
  const sampledColors: ColorRgba[] = [];
  for (let i = 0; i < visible.length; i += stride) {
    sampledColors.push(visible[i]!);
  }

  const oklchColors = sampledColors.map(sRgbToOklch);

  let sumMinDist = 0;
  for (const target of SLOP_TROPE_TARGETS) {
    let minDist = Infinity;
    for (const c of oklchColors) {
      const dL = c.l - target.l;
      const dC = (c.c - target.c) * 2.0; // scale chroma weight
      let dH = Math.abs(c.h - target.h);
      if (dH > 180) dH = 360 - dH;
      // In polar color spaces, delta H arc length is scaled by chroma: 2 * sqrt(c1 * c2) * sin(dH / 2).
      // When either color is near-neutral, hue differences have near-zero perceptual effect.
      const dHRad = (dH * Math.PI) / 180;
      const chromaWeight = Math.sqrt(Math.max(0, c.c * target.c));
      const dHMetric = 2 * chromaWeight * Math.sin(dHRad / 2);

      const dist = Math.sqrt(dL * dL + dC * dC + dHMetric * dHMetric);
      if (dist < minDist) minDist = dist;
    }
    sumMinDist += minDist;
  }

  const avgDist = sumMinDist / SLOP_TROPE_TARGETS.length;
  return Math.round(Math.min(1.0, avgDist) * 100) / 100;
}

/**
 * Analyzes overall color telemetry for the audit report.
 */
export function analyzeColorTelemetry(
  colors: ColorRgba[],
  muddyGradientCount = 0
): ColorTelemetryResult {
  const entropy = calculateOklchEntropy(colors);
  const slopDist = calculateSlopTriadDistance(colors);

  const hueSectors = new Set<number>();
  const stride = colors.length > 2000 ? Math.ceil(colors.length / 2000) : 1;
  for (let i = 0; i < colors.length; i += stride) {
    const c = colors[i]!;
    if ((c.a ?? 1) <= 0.05) continue;
    const oklch = sRgbToOklch(c);
    if (oklch.c > 0.04) {
      hueSectors.add(Math.floor((oklch.h / 360) * 8));
    }
  }

  let paletteCharacter = 'Disciplined 60-30-10 palette economy';
  if (slopDist < 0.18) {
    paletteCharacter = '🚨 Slop-Triad clone (#8B5CF6 / #06B6D4 neon darkmode)';
  } else if (entropy < 1.4) {
    paletteCharacter = 'Monotone darkmode / minimal chromatic differentiation';
  } else if (entropy > 4.2) {
    paletteCharacter = 'Chaotic color noise (uncontrolled variance)';
  } else if (hueSectors.size <= 2) {
    paletteCharacter = 'Focused monochrome / analog calm';
  }

  return {
    shannonEntropyBits: entropy,
    slopTriadDistance: slopDist,
    muddyGradientCount,
    distinctHueSectors: hueSectors.size,
    paletteCharacter
  };
}
