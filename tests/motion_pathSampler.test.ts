import { describe, it, expect } from 'vitest';
import {
  ParametricPath,
  extractBorderSegments,
  evaluateCubic,
  evaluateCubicDerivative,
  segmentLength
} from '../src/motion/pathSampler.js';
import { LayoutNode } from '../src/parser/math.js';

describe('TOAD Motion: Path & Border Sampler', () => {
  it('evaluates cubic Bézier curve endpoints and midpoint accurately', () => {
    const p0 = { x: 0, y: 0 };
    const cp1 = { x: 0, y: 100 };
    const cp2 = { x: 100, y: 100 };
    const p1 = { x: 100, y: 0 };

    const start = evaluateCubic(p0, cp1, cp2, p1, 0);
    const mid = evaluateCubic(p0, cp1, cp2, p1, 0.5);
    const end = evaluateCubic(p0, cp1, cp2, p1, 1);

    expect(start.x).toBeCloseTo(0);
    expect(start.y).toBeCloseTo(0);
    expect(end.x).toBeCloseTo(100);
    expect(end.y).toBeCloseTo(0);
    expect(mid.x).toBeCloseTo(50);
    expect(mid.y).toBeCloseTo(75);
  });

  it('calculates segment arc length accurately', () => {
    // Straight line of length 200
    const p0 = { x: 0, y: 0 };
    const cp1 = { x: 50, y: 0 };
    const cp2 = { x: 150, y: 0 };
    const p1 = { x: 200, y: 0 };

    const len = segmentLength(p0, cp1, cp2, p1);
    expect(len).toBeCloseTo(200, 1);
  });

  it('extracts border segments of a rectangle and traverses perimeter in constant speed', () => {
    const rectNode: LayoutNode = {
      name: 'card',
      type: 'rect',
      box: { x: 100, y: 100, width: 200, height: 100 },
      style: { color: '#000' }
    };

    const segments = extractBorderSegments(rectNode);
    expect(segments.length).toBe(4);

    const path = new ParametricPath(segments);
    // Perimeter = 2 * (200 + 100) = 600px
    expect(path.totalLength).toBeCloseTo(600, 1);

    // Progress 0% -> Top-Left corner (100, 100)
    const pt0 = path.sample(0);
    expect(pt0.x).toBeCloseTo(100, 1);
    expect(pt0.y).toBeCloseTo(100, 1);

    // Progress 25% -> 150px traversed -> along top edge (x = 100 + 150 = 250, y = 100)
    const pt25 = path.sample(0.25);
    expect(pt25.x).toBeCloseTo(250, 1);
    expect(pt25.y).toBeCloseTo(100, 1);
    // Tangent pointing right (1, 0), Angle 0 deg
    expect(pt25.tangent.x).toBeCloseTo(1, 1);
    expect(pt25.angleDeg).toBeCloseTo(0, 1);

    // Progress 50% -> 300px traversed -> Top edge (200) + Right edge (100) = Bottom-Right corner (300, 200)
    const pt50 = path.sample(0.5);
    expect(pt50.x).toBeCloseTo(300, 1);
    expect(pt50.y).toBeCloseTo(200, 1);
  });

  it('applies outward normal offset and auto-rotation along rectangular border', () => {
    const rectNode: LayoutNode = {
      name: 'button',
      type: 'rect',
      box: { x: 0, y: 0, width: 100, height: 100 },
      style: { color: '#000' }
    };

    const segments = extractBorderSegments(rectNode);
    const path = new ParametricPath(segments);

    // Along top edge (progress ~12.5% -> 50px along top edge):
    // Outward normal points UP: (0, -1)
    // Offset +10px shifts y to 0 - 10 = -10
    const ptWithOffset = path.sample(0.125, 10);
    expect(ptWithOffset.x).toBeCloseTo(50, 1);
    expect(ptWithOffset.y).toBeCloseTo(-10, 1);
    expect(ptWithOffset.normal.y).toBeCloseTo(-1, 1);
  });

  it('extracts circular border with 4 quarter-circle segments', () => {
    const circleNode: LayoutNode = {
      name: 'avatar',
      type: 'circle',
      box: { x: 50, y: 50, width: 100, height: 100 },
      style: { color: '#000' }
    };

    const segments = extractBorderSegments(circleNode);
    expect(segments.length).toBe(4);

    const path = new ParametricPath(segments);
    // Circumference = PI * 100 ~= 314.159
    expect(path.totalLength).toBeCloseTo(314.159, 0);

    // Sampling 0% is at top (100, 50)
    const pt0 = path.sample(0);
    expect(pt0.x).toBeCloseTo(100, 1);
    expect(pt0.y).toBeCloseTo(50, 1);

    // Sampling 25% is at right (150, 100)
    const pt25 = path.sample(0.25);
    expect(pt25.x).toBeCloseTo(150, 1);
    expect(pt25.y).toBeCloseTo(100, 1);
  });

  it('clamps progress for open paths without wrapping around modulo 1', () => {
    // Open path with a single straight line from (0, 0) to (100, 0)
    const segments = [{
      p0: { x: 0, y: 0 },
      cp1: { x: 33.3, y: 0 },
      cp2: { x: 66.6, y: 0 },
      p1: { x: 100, y: 0 }
    }];

    const openPath = new ParametricPath(segments, 20, true);
    expect(openPath.isOpen).toBe(true);

    // Progress > 1 should clamp to end point (100, 0) instead of wrapping to (20, 0)
    const ptOver = openPath.sample(1.2);
    expect(ptOver.x).toBeCloseTo(100, 1);
    expect(ptOver.y).toBeCloseTo(0, 1);

    // Progress < 0 should clamp to start point (0, 0)
    const ptUnder = openPath.sample(-0.2);
    expect(ptUnder.x).toBeCloseTo(0, 1);
    expect(ptUnder.y).toBeCloseTo(0, 1);
  });
});
