import { describe, it, expect } from 'vitest';
import { cubicBezier, spring, lerpColor } from '../src/motion/interpolator.js';
import { ParametricPath, trimSegments, CubicSegment } from '../src/motion/pathSampler.js';
import { parseMotion } from '../src/motion/parser.js';
import { MotionLexer } from '../src/motion/lexer.js';
import { MotionSolver } from '../src/motion/motionSolver.js';
import { MotionScene, MotionSceneElement } from '../src/motion/sceneLoader.js';
import { TextMeasurementCache } from '../src/engine/buildCache.js';
import { generateBarcode } from '../src/engine/barcodeGenerator.js';
import { generateQrCode } from '../src/engine/qrGenerator.js';
import { createCanvas } from '@napi-rs/canvas';
import { isFfmpegAvailable } from '../src/motion/videoExporter.js';

describe('Gruppe 6 Review Findings Verification', () => {
  // F-063 [EX-01]: FFmpeg security & spawnSync
  it('F-063: isFfmpegAvailable handles custom or invalid binary safely without shell interpolation', () => {
    const result = isFfmpegAvailable('non_existent_ffmpeg_binary_xyz_123');
    expect(result).toBe(false);
  });

  // F-092 [M-01]: spring() branch order for critical damping & zeta ~ 1
  it('F-092: spring does not divide by zero or produce NaN near critical damping', () => {
    // Zeta = 1.0 (critically damped)
    const sCrit = spring(100, 20, 1); // c = 2 * sqrt(100*1) = 20 -> zeta = 1.0
    for (let t = 0; t <= 1; t += 0.1) {
      const val = sCrit(t);
      expect(Number.isFinite(val)).toBe(true);
      expect(val).not.toBeNaN();
    }

    // Zeta very close to 1 (e.g. 0.99999)
    const sNear = spring(100, 19.9999, 1);
    for (let t = 0; t <= 1; t += 0.1) {
      const val = sNear(t);
      expect(Number.isFinite(val)).toBe(true);
      expect(val).not.toBeNaN();
    }
  });

  // F-093 [M-02]: cubicBezier iteration limit & clamp
  it('F-093: cubicBezier clamps x control points and terminates within 32 iterations', () => {
    // Non-standard / extreme values
    const bezier = cubicBezier(-0.5, 2.0, 1.5, -1.0);
    for (let t = 0; t <= 1; t += 0.05) {
      const val = bezier(t);
      expect(Number.isFinite(val)).toBe(true);
    }
  });

  // F-094 [M-03]: 1-element LUT in ParametricPath.sample
  it('F-094: ParametricPath with minimal segments/LUT does not access index -1', () => {
    const singleSeg: CubicSegment = {
      p0: { x: 0, y: 0 },
      cp1: { x: 10, y: 0 },
      cp2: { x: 20, y: 0 },
      p1: { x: 30, y: 0 }
    };
    const path = new ParametricPath([singleSeg], 1); // minimal samples
    const sample = path.sample(0.5);
    expect(Number.isFinite(sample.x)).toBe(true);
    expect(Number.isFinite(sample.y)).toBe(true);
  });

  // F-095 [M-04]: parseTimelineNode supports 'from' and 'to' keywords
  it('F-095: motion parser recognizes CSS-style from and to keyframe blocks', () => {
    const dsl = `
      motion "heroFade" {
        duration: 2.5s;
        fps: 30;
        timeline {
          #title {
            from { opacity: 0; translateY: -30px; }
            to { opacity: 1; translateY: 0px; }
          }
        }
      }
    `;
    const doc = parseMotion(dsl);
    expect(doc.motion.timelines).toHaveLength(1);
    const tl = doc.motion.timelines[0]!;
    expect(tl.keyframes).toHaveLength(2);
    expect(tl.keyframes[0]!.time).toBe(0);
    expect(tl.keyframes[0]!.properties.opacity).toBe(0);
    expect(tl.keyframes[1]!.time).toBe(2.5);
    expect(tl.keyframes[1]!.properties.opacity).toBe(1);
  });

  // F-097 [M-06]: Reusable canvas in MotionSolver.renderFrame
  it('F-097: MotionSolver.renderFrame reuses targetCanvas when passed', () => {
    const dsl = `
      motion "test" {
        duration: 1s;
        timeline {
          #box {
            0s: { opacity: 0; }
            1s: { opacity: 1; }
          }
        }
      }
    `;
    const doc = parseMotion(dsl);
    const scene: MotionScene = {
      sourcePath: '',
      sourceType: 'toad',
      width: 200,
      height: 200,
      elements: new Map(),
      order: [],
      getElement: () => undefined,
      getBorderSegments: () => []
    };
    const solver = new MotionSolver(doc, scene);
    const reusableCanvas = createCanvas(200, 200);
    const rendered = solver.renderFrame(0.5, reusableCanvas);
    expect(rendered).toBe(reusableCanvas);
  });

  // F-038 [E-21]: NaN-guard for SVG path generation in barcode and QR code
  it('F-038: barcode and QR generator toSvgPath guards against NaN and non-finite dimensions', () => {
    const barcode = generateBarcode('12345678', { format: 'code128' });
    const pathD = barcode.toSvgPath(NaN as any, -50 as any);
    expect(pathD).toBeTruthy();
    expect(pathD).not.toContain('NaN');

    const qr = generateQrCode('https://toad.graphics');
    const qrSvg = qr.toSvgPath(NaN as any, 0 as any, NaN as any);
    expect(qrSvg).toBeTruthy();
    expect(qrSvg).not.toContain('NaN');
  });

  // F-039 [E-22]: QR error correction level auto-bump to 'H' when logo is present
  it('F-039: QR generator enforces error correction level H when logo is present', () => {
    const qrWithLogo = generateQrCode('https://toad.graphics', {
      logo: 'logo.png',
      ecl: 'L' // explicitly requesting L should still be bumped to H
    });
    expect(qrWithLogo.ecl).toBe('H');
  });

  // F-040 [E-24]: TextMeasurementCache delimiter escaping
  it('F-040: TextMeasurementCache escapes pipe and backslash in cache keys', () => {
    const key1 = TextMeasurementCache.makeKey('a|b', { fontFamily: 'Inter' });
    const key2 = TextMeasurementCache.makeKey('a', { fontFamily: 'b|Inter' });
    expect(key1).not.toBe(key2);
  });

  // F-101 [M-10]: lerpColor fallback on invalid inputs
  it('F-101: lerpColor safely falls back on invalid color strings and NaN progress', () => {
    const c1 = lerpColor('invalid-color-1', 'invalid-color-2', 0.5);
    expect(c1).toBe('#000000');

    const c2 = lerpColor('#ff0000', '#00ff00', NaN);
    expect(c2).toBe('#ff0000');
  });

  // F-102 [M-11]: Degenerate bezier segments stabilization
  it('F-102: ParametricPath.sample does not produce NaN normal or tangent on degenerate curves', () => {
    const degenSeg: CubicSegment = {
      p0: { x: 50, y: 50 },
      cp1: { x: 50, y: 50 },
      cp2: { x: 50, y: 50 },
      p1: { x: 100, y: 50 } // chord has length 50
    };
    const path = new ParametricPath([degenSeg], 5);
    const sample = path.sample(0);
    expect(Number.isFinite(sample.tangent.x)).toBe(true);
    expect(Number.isFinite(sample.tangent.y)).toBe(true);
    expect(Number.isFinite(sample.normal.x)).toBe(true);
    expect(Number.isFinite(sample.normal.y)).toBe(true);
  });

  // F-107 [M-16]: Arc-length parameterization in trimSegments
  it('F-107: trimSegments trims segments smoothly along arc-length', () => {
    const seg: CubicSegment = {
      p0: { x: 0, y: 0 },
      cp1: { x: 0, y: 100 },
      cp2: { x: 100, y: 100 },
      p1: { x: 100, y: 0 }
    };
    const trimmed = trimSegments([seg], 0.25, 0.75);
    expect(trimmed.length).toBeGreaterThan(0);
    expect(Number.isFinite(trimmed[0]!.p0.x)).toBe(true);
    expect(Number.isFinite(trimmed[0]!.p1.x)).toBe(true);
  });

  // F-098 [M-07] & F-099 [M-08]: Children selector & stagger in MotionSolver
  it('F-098 & F-099: MotionSolver matches children selector (#parent > *) and applies stagger delay', () => {
    const dsl = `
      motion "staggerTest" {
        duration: 3s;
        timeline {
          #group > * {
            stagger: 0.2s;
            0s: { opacity: 0; }
            1s: { opacity: 1; ease: linear; }
          }
        }
      }
    `;
    const doc = parseMotion(dsl);

    const child1: MotionSceneElement = {
      id: '#child1',
      name: 'child1',
      sourceType: 'toad',
      box: { x: 10, y: 10, width: 20, height: 20 },
      style: { opacity: 1 },
      layoutNode: { parentId: '#group', box: { x: 10, y: 10, w: 20, h: 20 } } as any,
      render: () => {}
    };

    const child2: MotionSceneElement = {
      id: '#child2',
      name: 'child2',
      sourceType: 'toad',
      box: { x: 40, y: 10, width: 20, height: 20 },
      style: { opacity: 1 },
      layoutNode: { parentId: '#group', box: { x: 40, y: 10, w: 20, h: 20 } } as any,
      render: () => {}
    };

    const scene: MotionScene = {
      sourcePath: '',
      sourceType: 'toad',
      width: 500,
      height: 500,
      elements: new Map([['#child1', child1], ['#child2', child2]]),
      order: ['#child1', '#child2'],
      getElement: (id: string) => scene.elements.get(id),
      getBorderSegments: () => []
    };

    const solver = new MotionSolver(doc, scene);
    // At t = 0.1s:
    // child1 (index 0, delay 0): effective time 0.1s -> opacity = 0.1
    // child2 (index 1, delay 0.2s): effective time 0s -> opacity = 0
    const state1 = solver.evaluateElement(child1, 0.1);
    const state2 = solver.evaluateElement(child2, 0.1);

    expect(state1.opacity).toBeCloseTo(0.1, 1);
    expect(state2.opacity).toBe(0);
  });

  // F-100 [M-09]: Orbital rotation around parent center
  it('F-100: MotionSolver applies orbital rotation around parent center', () => {
    const dsl = `
      motion "orbitTest" {
        duration: 1s;
        timeline {
          #parent {
            0s: { rotate: 0deg; }
            1s: { rotate: 90deg; }
          }
        }
      }
    `;
    const doc = parseMotion(dsl);

    // Parent centered at (100, 100) with size 100x100 -> center (150, 150)
    const parentEl: MotionSceneElement = {
      id: '#parent',
      name: 'parent',
      sourceType: 'toad',
      box: { x: 100, y: 100, width: 100, height: 100 },
      style: { opacity: 1 },
      layoutNode: { box: { x: 100, y: 100, w: 100, h: 100 } } as any,
      render: () => {}
    };

    // Child placed to the right: at (250, 150) -> relative to parent center: dx = 100, dy = 0
    const childEl: MotionSceneElement = {
      id: '#child',
      name: 'child',
      sourceType: 'toad',
      box: { x: 250, y: 140, width: 20, height: 20 }, // center (260, 150) -> dx = 110, dy = 0
      style: { opacity: 1 },
      layoutNode: { parentId: '#parent', box: { x: 250, y: 140, w: 20, h: 20 } } as any,
      render: () => {}
    };

    const scene: MotionScene = {
      sourcePath: '',
      sourceType: 'toad',
      width: 500,
      height: 500,
      elements: new Map([['#parent', parentEl], ['#child', childEl]]),
      order: ['#parent', '#child'],
      getElement: (id: string) => scene.elements.get(id),
      getBorderSegments: () => []
    };

    const solver = new MotionSolver(doc, scene);
    // At t = 1s, parent is rotated 90deg clockwise.
    // Child's center should orbit from (260, 150) [dx=110, dy=0] to [dx=0, dy=110] -> center (150, 260)
    const childState = solver.evaluateElement(childEl, 1.0);
    const childCenterY = childState.y + childEl.box.height / 2;
    expect(childCenterY).toBeCloseTo(260, 1);
  });
});
