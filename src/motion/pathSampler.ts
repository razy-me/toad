/**
 * src/motion/pathSampler.ts
 * High-precision parametric path sampling and border tracing for TOAD Motion.
 * Supports constant-speed arc-length parameterization, normal offsets, and auto-rotation.
 */

import { CubicSegment, svgPathToSubpaths, polygonToRoundedSvgPath } from '../engine/vectorPathParser.js';
import { LayoutNode } from '../parser/math.js';

export { CubicSegment };

export interface Point {
  x: number;
  y: number;
}

export interface SampledPoint {
  x: number;
  y: number;
  angleRad: number;
  angleDeg: number;
  tangent: Point;
  normal: Point;
}

interface LutEntry {
  cumLength: number;
  segIndex: number;
  t: number;
}

/**
 * Standard cubic Bézier evaluation: B(t) for t in [0, 1]
 */
export function evaluateCubic(p0: Point, cp1: Point, cp2: Point, p1: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p1.x,
    y: mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p1.y
  };
}

/**
 * First derivative B'(t) of cubic Bézier
 */
export function evaluateCubicDerivative(p0: Point, cp1: Point, cp2: Point, p1: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: 3 * mt2 * (cp1.x - p0.x) + 6 * mt * t * (cp2.x - cp1.x) + 3 * t2 * (p1.x - cp2.x),
    y: 3 * mt2 * (cp1.y - p0.y) + 6 * mt * t * (cp2.y - cp1.y) + 3 * t2 * (p1.y - cp2.y)
  };
}

/**
 * Approximates length of a single cubic segment using 16-step Simpson's numerical integration.
 */
export function segmentLength(p0: Point, cp1: Point, cp2: Point, p1: Point): number {
  const steps = 16;
  let len = 0;
  let prev = evaluateCubic(p0, cp1, cp2, p1, 0);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const curr = evaluateCubic(p0, cp1, cp2, p1, t);
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    len += Math.sqrt(dx * dx + dy * dy);
    prev = curr;
  }
  return len;
}

/**
 * Creates a list of cubic segments representing the outer border of an element.
 */
export function extractBorderSegments(node: LayoutNode): CubicSegment[] {
  const x = node.box.x ?? 0;
  const y = node.box.y ?? 0;
  const w = node.box.w ?? (node.box as any).width ?? 0;
  const h = node.box.h ?? (node.box as any).height ?? 0;
  const segments: CubicSegment[] = [];

  // Magic constant for quarter-circle cubic approximation: 4 * (sqrt(2) - 1) / 3
  const KAPPA = 0.5522847498307936;

  switch (node.type) {
    case 'circle': {
      const rx = w / 2;
      const ry = h / 2;
      const cx = x + rx;
      const cy = y + ry;
      const kx = rx * KAPPA;
      const ky = ry * KAPPA;

      // Quarter 1: Top to Right (Clockwise)
      segments.push({
        p0: { x: cx, y: cy - ry },
        cp1: { x: cx + kx, y: cy - ry },
        cp2: { x: cx + rx, y: cy - ky },
        p1: { x: cx + rx, y: cy }
      });
      // Quarter 2: Right to Bottom
      segments.push({
        p0: { x: cx + rx, y: cy },
        cp1: { x: cx + rx, y: cy + ky },
        cp2: { x: cx + kx, y: cy + ry },
        p1: { x: cx, y: cy + ry }
      });
      // Quarter 3: Bottom to Left
      segments.push({
        p0: { x: cx, y: cy + ry },
        cp1: { x: cx - kx, y: cy + ry },
        cp2: { x: cx - rx, y: cy + ky },
        p1: { x: cx - rx, y: cy }
      });
      // Quarter 4: Left to Top
      segments.push({
        p0: { x: cx - rx, y: cy },
        cp1: { x: cx - rx, y: cy - ky },
        cp2: { x: cx - kx, y: cy - ry },
        p1: { x: cx, y: cy - ry }
      });
      break;
    }

    case 'polygon': {
      const points = (node as any).points as Array<{ x: number; y: number }> | undefined;
      if (points && points.length >= 3) {
        // Adjust points to absolute coordinates
        const absPoints = points.map(p => ({ x: x + p.x, y: y + p.y }));
        const r = typeof node.style.borderRadius === 'number' ? node.style.borderRadius : 0;
        const d = polygonToRoundedSvgPath(absPoints, r);
        const subpaths = svgPathToSubpaths(d);
        for (const sp of subpaths) {
          segments.push(...sp.segments);
        }
      }
      break;
    }

    case 'path': {
      const d = (node as any).d as string | undefined;
      if (d) {
        const subpaths = svgPathToSubpaths(d);
        for (const sp of subpaths) {
          // Offset to node coordinates
          for (const seg of sp.segments) {
            segments.push({
              p0: { x: seg.p0.x + x, y: seg.p0.y + y },
              cp1: { x: seg.cp1.x + x, y: seg.cp1.y + y },
              cp2: { x: seg.cp2.x + x, y: seg.cp2.y + y },
              p1: { x: seg.p1.x + x, y: seg.p1.y + y }
            });
          }
        }
      }
      break;
    }

    case 'rect':
    case 'group':
    default: {
      // Rounded Rectangle or standard Box
      let r = 0;
      if (typeof node.style.borderRadius === 'number') {
        r = Math.min(node.style.borderRadius, w / 2, h / 2);
      } else if (Array.isArray(node.style.borderRadius) && node.style.borderRadius.length > 0) {
        r = Math.min(node.style.borderRadius[0] ?? 0, w / 2, h / 2);
      }

      if (r <= 0) {
        // 4 straight lines (represented as straight cubic segments)
        // Top edge
        segments.push({
          p0: { x, y },
          cp1: { x: x + w / 3, y },
          cp2: { x: x + (2 * w) / 3, y },
          p1: { x: x + w, y }
        });
        // Right edge
        segments.push({
          p0: { x: x + w, y },
          cp1: { x: x + w, y: y + h / 3 },
          cp2: { x: x + w, y: y + (2 * h) / 3 },
          p1: { x: x + w, y: y + h }
        });
        // Bottom edge
        segments.push({
          p0: { x: x + w, y: y + h },
          cp1: { x: x + (2 * w) / 3, y: y + h },
          cp2: { x: x + w / 3, y: y + h },
          p1: { x, y: y + h }
        });
        // Left edge
        segments.push({
          p0: { x, y: y + h },
          cp1: { x, y: y + (2 * h) / 3 },
          cp2: { x, y: y + h / 3 },
          p1: { x, y }
        });
      } else {
        const kr = r * KAPPA;
        // Top edge
        segments.push({
          p0: { x: x + r, y },
          cp1: { x: x + r + (w - 2 * r) / 3, y },
          cp2: { x: x + r + (2 * (w - 2 * r)) / 3, y },
          p1: { x: x + w - r, y }
        });
        // Top-Right Corner
        segments.push({
          p0: { x: x + w - r, y },
          cp1: { x: x + w - r + kr, y },
          cp2: { x: x + w, y: y + r - kr },
          p1: { x: x + w, y: y + r }
        });
        // Right edge
        segments.push({
          p0: { x: x + w, y: y + r },
          cp1: { x: x + w, y: y + r + (h - 2 * r) / 3 },
          cp2: { x: x + w, y: y + r + (2 * (h - 2 * r)) / 3 },
          p1: { x: x + w, y: y + h - r }
        });
        // Bottom-Right Corner
        segments.push({
          p0: { x: x + w, y: y + h - r },
          cp1: { x: x + w, y: y + h - r + kr },
          cp2: { x: x + w - r + kr, y: y + h },
          p1: { x: x + w - r, y: y + h }
        });
        // Bottom edge
        segments.push({
          p0: { x: x + w - r, y: y + h },
          cp1: { x: x + w - r - (w - 2 * r) / 3, y: y + h },
          cp2: { x: x + w - r - (2 * (w - 2 * r)) / 3, y: y + h },
          p1: { x: x + r, y: y + h }
        });
        // Bottom-Left Corner
        segments.push({
          p0: { x: x + r, y: y + h },
          cp1: { x: x + r - kr, y: y + h },
          cp2: { x, y: y + h - r + kr },
          p1: { x, y: y + h - r }
        });
        // Left edge
        segments.push({
          p0: { x, y: y + h - r },
          cp1: { x, y: y + h - r - (h - 2 * r) / 3 },
          cp2: { x, y: y + h - r - (2 * (h - 2 * r)) / 3 },
          p1: { x, y: y + r }
        });
        // Top-Left Corner
        segments.push({
          p0: { x, y: y + r },
          cp1: { x, y: y + r - kr },
          cp2: { x: x + r - kr, y },
          p1: { x: x + r, y }
        });
      }
      break;
    }
  }

  return segments;
}

/**
 * ParametricPath creates a constant-speed arc-length parameterized sampler
 * over an arbitrary sequence of cubic segments.
 */
export class ParametricPath {
  private segments: CubicSegment[];
  private lut: LutEntry[] = [];
  public totalLength = 0;
  public isOpen: boolean;

  constructor(segments: CubicSegment[], samplesPerSegment = 20, isOpen = false) {
    this.segments = segments;
    this.isOpen = isOpen;
    this.buildLut(samplesPerSegment);
  }

  private buildLut(samplesPerSegment: number): void {
    if (this.segments.length === 0) return;

    let cum = 0;
    this.lut.push({ cumLength: 0, segIndex: 0, t: 0 });

    for (let sIdx = 0; sIdx < this.segments.length; sIdx++) {
      const seg = this.segments[sIdx]!;
      let prev = evaluateCubic(seg.p0, seg.cp1, seg.cp2, seg.p1, 0);

      for (let step = 1; step <= samplesPerSegment; step++) {
        const t = step / samplesPerSegment;
        const pt = evaluateCubic(seg.p0, seg.cp1, seg.cp2, seg.p1, t);
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        cum += Math.sqrt(dx * dx + dy * dy);
        this.lut.push({ cumLength: cum, segIndex: sIdx, t });
        prev = pt;
      }
    }

    this.totalLength = cum;
  }

  /**
   * Samples a point along the path at normalized progress progress in [0, 1].
   * @param progress 0.0 (start) to 1.0 (end)
   * @param offset Pixel distance normal to the path (+ is outward, - is inward)
   */
  public sample(progress: number, offset = 0): SampledPoint {
    if (this.segments.length === 0 || this.totalLength === 0) {
      return {
        x: 0,
        y: 0,
        angleRad: 0,
        angleDeg: 0,
        tangent: { x: 1, y: 0 },
        normal: { x: 0, y: -1 }
      };
    }

    // Wrap for closed loops / clamp for open paths
    let p: number;
    if (this.isOpen) {
      p = Math.max(0, Math.min(1, progress));
    } else {
      p = progress % 1;
      if (p < 0) p += 1;
      if (progress === 1) p = 1;
    }

    if (this.lut.length <= 1) {
      const seg = this.segments[0] ?? { p0: { x: 0, y: 0 }, cp1: { x: 0, y: 0 }, cp2: { x: 0, y: 0 }, p1: { x: 0, y: 0 } };
      return {
        x: seg.p0.x,
        y: seg.p0.y,
        angleRad: 0,
        angleDeg: 0,
        tangent: { x: 1, y: 0 },
        normal: { x: 0, y: -1 }
      };
    }

    const targetDist = p * this.totalLength;

    // Binary search in LUT
    let low = 0;
    let high = this.lut.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.lut[mid]!.cumLength < targetDist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.min(Math.max(low, 1), this.lut.length - 1);
    const e0 = this.lut[idx - 1]!;
    const e1 = this.lut[idx]!;

    const span = e1.cumLength - e0.cumLength;
    const localRatio = span > 1e-6 ? (targetDist - e0.cumLength) / span : 0;
    const t = e0.t + localRatio * (e1.t - e0.t);
    const seg = this.segments[e1.segIndex]!;

    const pt = evaluateCubic(seg.p0, seg.cp1, seg.cp2, seg.p1, t);
    const deriv = evaluateCubicDerivative(seg.p0, seg.cp1, seg.cp2, seg.p1, t);

    let dLen = Math.sqrt(deriv.x * deriv.x + deriv.y * deriv.y);
    let tx = 1;
    let ty = 0;
    if (dLen >= 1e-6) {
      tx = deriv.x / dLen;
      ty = deriv.y / dLen;
    } else {
      // F-102: Fallback to chord vector seg.p1 - seg.p0 to avoid collapsing tangent and normal jump
      const chordX = seg.p1.x - seg.p0.x;
      const chordY = seg.p1.y - seg.p0.y;
      const chordLen = Math.hypot(chordX, chordY);
      if (chordLen >= 1e-6) {
        tx = chordX / chordLen;
        ty = chordY / chordLen;
      }
    }

    // Unit outward normal: for clockwise path, normal = (ty, -tx)
    const nx = ty;
    const ny = -tx;

    // Apply offset along normal
    const finalX = pt.x + offset * nx;
    const finalY = pt.y + offset * ny;

    const angleRad = Math.atan2(ty, tx);
    const angleDeg = (angleRad * 180) / Math.PI;

    return {
      x: finalX,
      y: finalY,
      angleRad,
      angleDeg,
      tangent: { x: tx, y: ty },
      normal: { x: nx, y: ny }
    };
  }
}

/**
 * Trims a single cubic Bézier segment to parameter interval [u0, u1] in [0, 1].
 * Uses exact analytical subdivision via De Casteljau derivative evaluation.
 */
export function trimCubicSegment(seg: CubicSegment, u0: number, u1: number): CubicSegment {
  if (u0 <= 0 && u1 >= 1) return seg;
  if (u0 >= u1) {
    const pt = evaluateCubic(seg.p0, seg.cp1, seg.cp2, seg.p1, u0);
    return { p0: pt, cp1: pt, cp2: pt, p1: pt };
  }
  const p0 = evaluateCubic(seg.p0, seg.cp1, seg.cp2, seg.p1, u0);
  const p1 = evaluateCubic(seg.p0, seg.cp1, seg.cp2, seg.p1, u1);
  const d0 = evaluateCubicDerivative(seg.p0, seg.cp1, seg.cp2, seg.p1, u0);
  const d1 = evaluateCubicDerivative(seg.p0, seg.cp1, seg.cp2, seg.p1, u1);
  const dt = (u1 - u0) / 3;
  return {
    p0,
    cp1: { x: p0.x + dt * d0.x, y: p0.y + dt * d0.y },
    cp2: { x: p1.x - dt * d1.x, y: p1.y - dt * d1.y },
    p1
  };
}

function subSegmentLength(seg: CubicSegment, t0: number, t1: number): number {
  const steps = 8;
  let len = 0;
  let prev = evaluateCubic(seg.p0, seg.cp1, seg.cp2, seg.p1, t0);
  for (let i = 1; i <= steps; i++) {
    const t = t0 + (i / steps) * (t1 - t0);
    const curr = evaluateCubic(seg.p0, seg.cp1, seg.cp2, seg.p1, t);
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    len += Math.sqrt(dx * dx + dy * dy);
    prev = curr;
  }
  return len;
}

function arcLengthToT(seg: CubicSegment, targetDist: number, totalLen: number): number {
  if (targetDist <= 0) return 0;
  if (targetDist >= totalLen) return 1;
  if (totalLen <= 1e-6) return 0;

  let low = 0;
  let high = 1;
  for (let iter = 0; iter < 10; iter++) {
    const mid = (low + high) / 2;
    const l = subSegmentLength(seg, 0, mid);
    if (l < targetDist) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

/**
 * Trims a sequence of cubic segments (a subpath) by normalized arc-length [startProgress, endProgress] in [0, 1].
 */
export function trimSegments(
  segments: CubicSegment[],
  startProgress: number,
  endProgress: number
): CubicSegment[] {
  const pStart = Math.max(0, Math.min(1, startProgress));
  const pEnd = Math.max(0, Math.min(1, endProgress));
  if (pStart >= pEnd || segments.length === 0) return [];

  const lengths = segments.map(s => segmentLength(s.p0, s.cp1, s.cp2, s.p1));
  const totalLength = lengths.reduce((sum, l) => sum + l, 0);
  if (totalLength <= 1e-6) return [];

  const targetStart = pStart * totalLength;
  const targetEnd = pEnd * totalLength;

  const result: CubicSegment[] = [];
  let accum = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const len = lengths[i]!;
    const segStart = accum;
    const segEnd = accum + len;
    accum = segEnd;

    // Segment entirely outside interval
    if (segEnd <= targetStart || segStart >= targetEnd) {
      continue;
    }

    if (len <= 1e-6) continue;

    // F-107: Map cumulative arc lengths into Bézier curve parameter space using arcLengthToT
    const dist0 = Math.max(0, Math.min(len, targetStart - segStart));
    const dist1 = Math.max(0, Math.min(len, targetEnd - segStart));

    const u0 = arcLengthToT(seg, dist0, len);
    const u1 = arcLengthToT(seg, dist1, len);

    if (u1 > u0) {
      result.push(trimCubicSegment(seg, u0, u1));
    }
  }

  return result;
}

/**
 * Serializes a collection of subpaths (CubicSegment[][]) into an SVG path 'd' string.
 */
export function segmentsToPathD(subpaths: CubicSegment[][]): string {
  let d = '';
  for (const sp of subpaths) {
    if (sp.length === 0) continue;
    d += `M ${sp[0]!.p0.x.toFixed(2)} ${sp[0]!.p0.y.toFixed(2)} `;
    for (const seg of sp) {
      d += `C ${seg.cp1.x.toFixed(2)} ${seg.cp1.y.toFixed(2)}, ${seg.cp2.x.toFixed(2)} ${seg.cp2.y.toFixed(2)}, ${seg.p1.x.toFixed(2)} ${seg.p1.y.toFixed(2)} `;
    }
  }
  return d.trim();
}

/**
 * Trims an entire SVG path string along its length.
 * Supports:
 * - 'parallel' mode: every subpath traces simultaneously from start to end (ideal for circuit boards, network trees, flowcharts)
 * - 'sequential' mode: continuous drawing from the first subpath to the last subpath along cumulative arc length
 */
export function trimSvgPath(
  d: string,
  start: number,
  end: number,
  mode: 'parallel' | 'sequential' = 'parallel'
): string {
  if (start <= 0 && end >= 1) return d;
  if (start >= end || end <= 0) return '';

  const subpaths = svgPathToSubpaths(d);
  if (subpaths.length === 0) return '';

  if (mode === 'parallel') {
    const trimmed = subpaths.map(sp => trimSegments(sp.segments, start, end));
    return segmentsToPathD(trimmed);
  } else {
    const allLengths = subpaths.map(sp => {
      return sp.segments.reduce((acc, s) => acc + segmentLength(s.p0, s.cp1, s.cp2, s.p1), 0);
    });
    const total = allLengths.reduce((a, b) => a + b, 0);
    if (total <= 1e-6) return '';

    const targetStart = Math.max(0, Math.min(1, start)) * total;
    const targetEnd = Math.max(0, Math.min(1, end)) * total;

    let accum = 0;
    const trimmedSubpaths: CubicSegment[][] = [];
    for (let i = 0; i < subpaths.length; i++) {
      const sp = subpaths[i]!;
      const spLen = allLengths[i]!;
      const spStart = accum;
      const spEnd = accum + spLen;
      accum = spEnd;

      if (spEnd <= targetStart || spStart >= targetEnd) continue;
      if (spLen <= 1e-6) continue;

      const localStart = Math.max(0, (targetStart - spStart) / spLen);
      const localEnd = Math.min(1, (targetEnd - spStart) / spLen);
      if (localEnd > localStart) {
        trimmedSubpaths.push(trimSegments(sp.segments, localStart, localEnd));
      }
    }
    return segmentsToPathD(trimmedSubpaths);
  }
}

