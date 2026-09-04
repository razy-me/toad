import { describe, it, expect } from 'vitest';
import { svgPathToBezierPaths } from '../src/engine/vectorPathParser.js';

describe('vectorPathParser: SVG to Photoshop BezierPaths', () => {
  it('converts simple rectangle path to closed BezierPath', () => {
    const d = 'M 0 0 L 100 0 L 100 50 L 0 50 Z';
    const paths = svgPathToBezierPaths(d, { scale: 1 });
    expect(paths.length).toBe(1);
    expect(paths[0]!.open).toBe(false);
    expect(paths[0]!.knots.length).toBe(4);
    // Knot 0: (0, 0)
    expect(paths[0]!.knots[0]!.points[2]).toBe(0);
    expect(paths[0]!.knots[0]!.points[3]).toBe(0);
    // Knot 1: (100, 0)
    expect(paths[0]!.knots[1]!.points[2]).toBe(100);
    expect(paths[0]!.knots[1]!.points[3]).toBe(0);
  });

  it('converts cubic curve C command with control points', () => {
    const d = 'M 10 10 C 20 20, 40 20, 50 10 Z';
    const paths = svgPathToBezierPaths(d, { scale: 1 });
    expect(paths.length).toBe(1);
    expect(paths[0]!.knots.length).toBeGreaterThanOrEqual(2);
    // First knot anchor is (10, 10), forward control point is (20, 20)
    const k0 = paths[0]!.knots[0]!;
    expect(k0.points[2]).toBe(10); // anchor x
    expect(k0.points[3]).toBe(10); // anchor y
    expect(k0.points[4]).toBe(20); // forward cp x
    expect(k0.points[5]).toBe(20); // forward cp y

    // Second knot anchor is (50, 10), backward control point is (40, 20)
    const k1 = paths[0]!.knots[1]!;
    expect(k1.points[0]).toBe(40); // backward cp x
    expect(k1.points[1]).toBe(20); // backward cp y
    expect(k1.points[2]).toBe(50); // anchor x
    expect(k1.points[3]).toBe(10); // anchor y
  });

  it('handles quadratic Q command converted to cubic', () => {
    const d = 'M 0 0 Q 50 100 100 0';
    const paths = svgPathToBezierPaths(d, { scale: 1 });
    expect(paths.length).toBe(1);
    expect(paths[0]!.open).toBe(true);
    expect(paths[0]!.knots.length).toBe(2);
    // End anchor (100, 0)
    const kEnd = paths[0]!.knots[1]!;
    expect(kEnd.points[2]).toBe(100);
    expect(kEnd.points[3]).toBe(0);
  });

  it('converts elliptical arc A command into smooth cubic segments', () => {
    // Semi-circle arc
    const d = 'M 0 50 A 50 50 0 0 1 100 50';
    const paths = svgPathToBezierPaths(d, { scale: 1 });
    expect(paths.length).toBe(1);
    expect(paths[0]!.knots.length).toBeGreaterThanOrEqual(2);
    const lastKnot = paths[0]!.knots[paths[0]!.knots.length - 1]!;
    expect(Math.round(lastKnot.points[2])).toBe(100);
    expect(Math.round(lastKnot.points[3])).toBe(50);
  });

  it('handles multi-subpath / compound paths (e.g. donut hole)', () => {
    // Outer square and inner cut-out square
    const d = 'M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 75 25 L 75 75 L 25 75 Z';
    const paths = svgPathToBezierPaths(d, { scale: 1, fillRule: 'even-odd' });
    expect(paths.length).toBe(2);
    expect(paths[0]!.fillRule).toBe('even-odd');
    expect(paths[1]!.fillRule).toBe('even-odd');
    expect(paths[0]!.knots.length).toBe(4);
    expect(paths[1]!.knots.length).toBe(4);
  });

  it('scales and offsets knots correctly', () => {
    const d = 'M 0 0 L 10 10 Z';
    const paths = svgPathToBezierPaths(d, { scale: 2, offsetX: 5, offsetY: 10 });
    expect(paths.length).toBe(1);
    // p0: (0 + 5) * 2 = 10, (0 + 10) * 2 = 20
    expect(paths[0]!.knots[0]!.points[2]).toBe(10);
    expect(paths[0]!.knots[0]!.points[3]).toBe(20);
    // p1: (10 + 5) * 2 = 30, (10 + 10) * 2 = 40
    expect(paths[0]!.knots[1]!.points[2]).toBe(30);
    expect(paths[0]!.knots[1]!.points[3]).toBe(40);
  });
});
