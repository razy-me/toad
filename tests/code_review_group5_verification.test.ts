import { describe, it, expect } from 'vitest';
import { generateBarcode } from '../src/engine/barcodeGenerator.js';
import { parseMotion } from '../src/motion/parser.js';
import { svgPathToSubpaths, polygonToRoundedSvgPath } from '../src/engine/vectorPathParser.js';
import { resolveSharedImage, clearImageCache } from '../src/engine/imageCache.js';
import path from 'path';

describe('Gruppe 5 Review Verification Tests', () => {
  it('F-026: barcode generation handles invalid characters gracefully with placeholder', () => {
    // Character outside ASCII 32-126 for Code 128 (e.g. \u0000 or invalid EAN)
    const res = generateBarcode('invalid \u0001 char', { format: 'code128' });
    expect(res).toBeDefined();
    expect(res.bars.length).toBeGreaterThan(0);
    expect(res.totalModules).toBeGreaterThan(0);
    const svgPath = res.toSvgPath(200, 100);
    expect(svgPath).not.toContain('NaN');
    expect(svgPath.length).toBeGreaterThan(0);
  });

  it('F-103: motion parser tolerates optional semicolons after timeline target blocks', () => {
    const src = `
      motion "testMotion" {
        duration: 2s;
        fps: 60;
        timeline {
          #hero {
            0s: { opacity: 0; }
            1s: { opacity: 1; }
          };
          #badge {
            0s: { scale: 0.8; }
            1s: { scale: 1; }
          };
        }
      }
    `;
    const doc = parseMotion(src, 'test.toadm');
    expect(doc.motion.timelines).toHaveLength(2);
    expect(doc.motion.timelines[0]!.targetId).toBe('#hero');
    expect(doc.motion.timelines[1]!.targetId).toBe('#badge');
  });

  it('F-104: motion parser consumes offset and auto-rotate in along path syntax', () => {
    const src = `
      motion "alongMotion" {
        duration: 2s;
        fps: 60;
        timeline {
          #tracker {
            0s: { along: border of #shape offset 10px auto-rotate true; }
            1s: { along: border of #shape offset 50px auto-rotate false; }
          }
        }
      }
    `;
    const doc = parseMotion(src, 'along.toadm');
    expect(doc.motion.timelines).toHaveLength(1);
    const kf0 = doc.motion.timelines[0]!.keyframes[0]!;
    expect(kf0.properties.along).toBeDefined();
    expect(kf0.properties.along!.targetId).toBe('#shape');
    expect(kf0.properties.along!.offset).toBe(10);
    expect(kf0.properties.along!.autoRotate).toBe(true);

    const kf1 = doc.motion.timelines[0]!.keyframes[1]!;
    expect(kf1.properties.along!.offset).toBe(50);
    expect(kf1.properties.along!.autoRotate).toBe(false);
  });

  it('F-035: svgPathToSubpaths isolates multiple subpaths closed with Z', () => {
    const d = 'M 0 0 L 10 0 L 10 10 Z M 20 20 L 30 20 L 30 30 Z';
    const subpaths = svgPathToSubpaths(d);
    expect(subpaths).toHaveLength(2);
    expect(subpaths[0]!.closed).toBe(true);
    expect(subpaths[1]!.closed).toBe(true);
  });

  it('F-036: polygonToRoundedSvgPath evaluates local corner curvature without crashing', () => {
    // L-shaped concave polygon
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 100 }
    ];
    const pathD = polygonToRoundedSvgPath(points, 5);
    expect(pathD).toBeDefined();
    expect(pathD).not.toContain('NaN');
    expect(pathD.startsWith('M ')).toBe(true);
    expect(pathD.endsWith('Z')).toBe(true);
  });
});
