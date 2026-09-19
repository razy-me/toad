import { describe, it, expect } from 'vitest';
import { ParametricPath, CubicSegment } from '../src/motion/pathSampler.js';
import { parseMotion } from '../src/motion/parser.js';
import { MotionLexer, MotionTokenType } from '../src/motion/lexer.js';
import { spring } from '../src/motion/interpolator.js';
import { resolveDimension } from '../src/parser/math.js';
import { DependencyGraph } from '../src/parser/dependencyGraph.js';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';

describe('Regression Review Group 1 Verification Tests', () => {
  // REG-01: PathSampler continuity across segment boundaries
  it('REG-01: path sampler interpolates monotonically without backward jumps across segments', () => {
    // Two sequential linear segments: (0,0) -> (100,0) and (100,0) -> (200,0)
    const seg1: CubicSegment = { p0: { x: 0, y: 0 }, cp1: { x: 33, y: 0 }, cp2: { x: 66, y: 0 }, p1: { x: 100, y: 0 } };
    const seg2: CubicSegment = { p0: { x: 100, y: 0 }, cp1: { x: 133, y: 0 }, cp2: { x: 166, y: 0 }, p1: { x: 200, y: 0 } };
    const path = new ParametricPath([seg1, seg2], 20, true);

    let prevX = -1;
    // Sample densely across the 50% boundary (around progress = 0.5)
    for (let p = 0.45; p <= 0.55; p += 0.005) {
      const pt = path.sample(p);
      expect(pt.x).toBeGreaterThanOrEqual(prevX);
      prevX = pt.x;
    }
  });

  // REG-07: Motion parser PERCENT keyframes don't divide by 100 twice
  it('REG-07: keyframe with 50% evaluates to half of currentDuration', () => {
    const src = `
      motion "testPercent" {
        duration: 10s;
        fps: 60;
        timeline {
          #hero {
            0%: { opacity: 0; }
            50%: { opacity: 0.5; }
            100%: { opacity: 1; }
          }
        }
      }
    `;
    const doc = parseMotion(src, 'test.toadm');
    const tl = doc.motion.timelines[0]!;
    expect(tl.keyframes).toHaveLength(3);
    expect(tl.keyframes[0]!.time).toBe(0);
    expect(tl.keyframes[1]!.time).toBe(5); // 50% of 10s is 5s, NOT 0.05s!
    expect(tl.keyframes[2]!.time).toBe(10);
  });

  // REG-23: DependencyGraph does not throw CyclicDependencyError on deep linear chains
  it('REG-23: deep linear dependency chains > 1000 elements do not falsely throw CyclicDependencyError', () => {
    const graph = new DependencyGraph();
    // Build chain #1 -> #2 -> ... -> #1200
    for (let i = 1; i <= 1200; i++) {
      graph.addElement({
        id: `node_${i}`,
        type: 'rect',
        at: i > 1 ? { x: 0, y: 0, relational: { targetId: `node_${i - 1}`, edge: 'after' } } : { x: 0, y: 0 }
      } as any);
    }
    expect(() => graph.resolveOrder()).not.toThrow();
  });

  // REG-29: ImportResolver handles calc subtraction without space
  it('REG-29: calc variable substitution handles minus operator without space', async () => {
    const src = `
      >width = 200px;
      rect #box {
        width: calc(>width-20px);
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'test.toad');
    const box = resolved.elements.find(e => e.id === 'box');
    expect(box).toBeDefined();
    expect(box?.size?.w).toBe('calc(200px -20px)');
  });

  // REG-46: resolveDimension does not match non-numeric keywords like 'origin' as 0
  it('REG-46: resolveDimension does not treat "origin" as ending with "in" unit', () => {
    const res = resolveDimension('origin', 100, 50);
    // Should return intrinsic size (50) or 0 fallback, not 0 from NaN * dpi
    expect(res).toBe(50);
  });

  // REG-48: Spring physics settles smoothly
  it('REG-48: spring physics does not produce abrupt jump at 95% progress', () => {
    const s = spring(200, 5, 1);
    const v94 = s(0.94);
    const v96 = s(0.96);
    const v98 = s(0.98);
    const v100 = s(1.0);
    expect(Number.isFinite(v94)).toBe(true);
    expect(Number.isFinite(v96)).toBe(true);
    expect(Number.isFinite(v98)).toBe(true);
    expect(v100).toBe(1.0);
    // Delta between 94% and 96% should be smooth
    expect(Math.abs(v96 - v94)).toBeLessThan(0.5);
  });

  // REG-54: MotionLexer scans .5s, +10px, and 1e-3
  it('REG-54: motion lexer recognizes leading dot, plus, and exponents', () => {
    const lexer = new MotionLexer('.5s +10px 1e-3', 'test.toadm');
    const t1 = lexer.nextToken();
    expect(t1.type).toBe(MotionTokenType.TIME);
    expect(t1.numValue).toBe(0.5);

    const t2 = lexer.nextToken();
    expect(t2.type).toBe(MotionTokenType.PIXEL);
    expect(t2.numValue).toBe(10);

    const t3 = lexer.nextToken();
    expect(t3.type).toBe(MotionTokenType.NUMBER);
    expect(t3.numValue).toBe(0.001);
  });
});
