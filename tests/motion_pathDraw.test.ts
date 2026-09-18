import { describe, it, expect } from 'vitest';
import { trimCubicSegment, trimSegments, trimSvgPath, evaluateCubic } from '../src/motion/pathSampler.js';
import { parseMotion } from '../src/motion/parser.js';
import { MotionSolver } from '../src/motion/motionSolver.js';
import { MotionScene } from '../src/motion/sceneLoader.js';

describe('TOAD Motion: Path Draw & Stroke Trimming Engine', () => {
  describe('Cubic Bézier Trimming Math', () => {
    const testSeg = {
      p0: { x: 0, y: 0 },
      cp1: { x: 0, y: 50 },
      cp2: { x: 100, y: 50 },
      p1: { x: 100, y: 100 }
    };

    it('returns identity when interval is [0, 1]', () => {
      const trimmed = trimCubicSegment(testSeg, 0, 1);
      expect(trimmed.p0).toEqual(testSeg.p0);
      expect(trimmed.p1).toEqual(testSeg.p1);
    });

    it('accurately splits curve at midpoint u=0.5', () => {
      const firstHalf = trimCubicSegment(testSeg, 0, 0.5);
      const secondHalf = trimCubicSegment(testSeg, 0.5, 1);

      const midExpected = evaluateCubic(testSeg.p0, testSeg.cp1, testSeg.cp2, testSeg.p1, 0.5);

      expect(firstHalf.p0.x).toBeCloseTo(0);
      expect(firstHalf.p0.y).toBeCloseTo(0);
      expect(firstHalf.p1.x).toBeCloseTo(midExpected.x);
      expect(firstHalf.p1.y).toBeCloseTo(midExpected.y);

      expect(secondHalf.p0.x).toBeCloseTo(midExpected.x);
      expect(secondHalf.p0.y).toBeCloseTo(midExpected.y);
      expect(secondHalf.p1.x).toBeCloseTo(100);
      expect(secondHalf.p1.y).toBeCloseTo(100);
    });
  });

  describe('trimSvgPath Algorithm', () => {
    const multiPathD =
      'M 0 0 L 100 0 M 0 50 L 100 50 M 0 100 L 100 100';

    it('returns empty string when start >= end or end <= 0', () => {
      expect(trimSvgPath(multiPathD, 0, 0)).toBe('');
      expect(trimSvgPath(multiPathD, 0.5, 0.5)).toBe('');
      expect(trimSvgPath(multiPathD, 0.8, 0.2)).toBe('');
    });

    it('returns original path when start <= 0 and end >= 1', () => {
      expect(trimSvgPath(multiPathD, 0, 1)).toBe(multiPathD);
    });

    it('trims all subpaths simultaneously in parallel mode', () => {
      const halfD = trimSvgPath(multiPathD, 0, 0.5, 'parallel');
      expect(halfD).toContain('M 0.00 0.00');
      expect(halfD).toContain('M 0.00 50.00');
      expect(halfD).toContain('M 0.00 100.00');
      // In 100px lines, 50% length ends at x = 50
      expect(halfD).toContain('50.00');
    });

    it('trims across total length sequentially in sequential mode', () => {
      // Total length is 300px. At 1/3 (0.333), only first line is completed
      const oneThirdD = trimSvgPath(multiPathD, 0, 0.3333, 'sequential');
      expect(oneThirdD).toContain('M 0.00 0.00');
      // Line 2 and 3 should not be in the output at 1/3
      expect(oneThirdD).not.toContain('M 0.00 100.00');
    });
  });

  describe('Motion DSL Parser: draw and strokeEnd syntax', () => {
    it('parses draw: 0% and draw: 100%', () => {
      const code = `
        motion "Test" {
          duration: 2s;
          timeline {
            #circuit {
              0s: { draw: 0%; }
              1s: { draw: 100%; ease: ease-out; }
            }
          }
        }
      `;
      const doc = parseMotion(code);

      const tl = doc.motion.timelines[0]!;
      expect(tl.targetId).toBe('#circuit');
      expect(tl.keyframes[0]!.properties.strokeEnd).toBe(0);
      expect(tl.keyframes[0]!.properties.strokeStart).toBe(0);
      expect(tl.keyframes[1]!.properties.strokeEnd).toBe(1);
    });

    it('parses strokeStart, strokeEnd, and trimMode', () => {
      const code = `
        motion "Test" {
          duration: 2s;
          timeline {
            #path1 {
              0s: { strokeStart: 0.1; strokeEnd: 0.2; trimMode: sequential; }
              1s: { strokeStart: 0.8; strokeEnd: 1.0; }
            }
          }
        }
      `;
      const doc = parseMotion(code);

      const kf0 = doc.motion.timelines[0]!.keyframes[0]!;
      expect(kf0.properties.strokeStart).toBe(0.1);
      expect(kf0.properties.strokeEnd).toBe(0.2);
      expect(kf0.properties.trimMode).toBe('sequential');

      const kf1 = doc.motion.timelines[0]!.keyframes[1]!;
      expect(kf1.properties.strokeStart).toBe(0.8);
      expect(kf1.properties.strokeEnd).toBe(1.0);
    });
  });

  describe('Motion Solver Temporal Interpolation', () => {
    it('interpolates strokeEnd and strokeStart smoothly', () => {
      const code = `
        motion "Test" {
          duration: 2s;
          timeline {
            #wire {
              0s: { draw: 0; }
              1s: { draw: 1; ease: linear; }
            }
          }
        }
      `;
      const doc = parseMotion(code);
      const mockScene: MotionScene = {
        sourcePath: 'dummy.toad',
        sourceType: 'toad',
        width: 800,
        height: 600,
        elements: new Map([
          [
            '#wire',
            {
              id: '#wire',
              name: 'wire',
              sourceType: 'toad',
              box: { x: 10, y: 20, width: 100, height: 50 },
              style: { opacity: 1 },
              render: () => {}
            }
          ]
        ]),
        order: ['#wire'],
        getElement: id => mockScene.elements.get(id),
        getBorderSegments: () => []
      };

      const solver = new MotionSolver(doc, mockScene);
      const state0 = solver.evaluateElement(mockScene.elements.get('#wire')!, 0);
      expect(state0.strokeEnd).toBeCloseTo(0);

      const state05 = solver.evaluateElement(mockScene.elements.get('#wire')!, 0.5);
      expect(state05.strokeEnd).toBeCloseTo(0.5);

      const state1 = solver.evaluateElement(mockScene.elements.get('#wire')!, 1.0);
      expect(state1.strokeEnd).toBeCloseTo(1.0);
    });
  });
});
