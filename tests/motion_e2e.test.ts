import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { parseMotion } from '../src/motion/parser.js';
import { loadMotionScene } from '../src/motion/sceneLoader.js';
import { MotionSolver } from '../src/motion/motionSolver.js';
import { exportMotionVideo } from '../src/motion/videoExporter.js';

describe('TOAD Motion: End-to-End Scene & Frame Rendering', () => {
  it('loads a .toad scene, applies motion along border, and renders frames', async () => {
    const fixtureToad = path.resolve('tests/fixtures/hero_banner.toad');
    expect(fs.existsSync(fixtureToad)).toBe(true);

    const scene = await loadMotionScene(fixtureToad);
    expect(scene.width).toBe(1600);
    expect(scene.height).toBe(900);
    expect(scene.elements.size).toBeGreaterThan(0);

    const badgeEl = scene.getElement('#heroBadge');
    expect(badgeEl).toBeDefined();

    // Create a .toadm definition that moves a satellite along the border of #heroBadge
    const toadmCode = `
      @import "${fixtureToad.replace(/\\/g, '/')}" as hero;

      motion "Hero Motion" {
        scene: hero;
        duration: 2.0s;
        fps: 30;
        dimensions: 1600px 900px;

        timeline {
          #heroTitle {
            0.0s: { opacity: 0; translateY: 50px; }
            1.0s: { opacity: 1; translateY: 0px; ease: ease-out; }
          }

          #heroBadge {
            0.0s: {
              along: border of #heroContent;
              progress: 0%;
              offset: 10px;
            }
            2.0s: {
              along: border of #heroContent;
              progress: 100%;
              offset: 10px;
              auto-rotate: true;
            }
          }
        }
      }
    `;

    const doc = parseMotion(toadmCode);
    const solver = new MotionSolver(doc, scene);

    // Frame at t=0
    const frame0 = solver.renderFrame(0);
    expect(frame0.width).toBe(1600);
    expect(frame0.height).toBe(900);

    // Evaluate state at t=0
    const titleEl = scene.getElement('#heroTitle')!;
    const state0 = solver.evaluateElement(titleEl, 0);
    expect(state0.opacity).toBeCloseTo(0);
    expect(state0.y).toBeCloseTo(titleEl.box.y + 50);

    // Evaluate state at t=1.0
    const state1 = solver.evaluateElement(titleEl, 1.0);
    expect(state1.opacity).toBeCloseTo(1);
    expect(state1.y).toBeCloseTo(titleEl.box.y);

    // Test along border motion
    const badgeState0 = solver.evaluateElement(badgeEl!, 0);
    const badgeStateMid = solver.evaluateElement(badgeEl!, 1.0);
    // Badge coordinates must change as it travels along the border!
    expect(badgeState0.x !== badgeStateMid.x || badgeState0.y !== badgeStateMid.y).toBe(true);

    // Test Frame Sequence Export
    const outDir = path.resolve('tests/dist/motion_test_frames');
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }

    const exportedDir = await exportMotionVideo(solver, 0.2, 10, {
      outputPath: path.join(outDir, 'frame.png'),
      format: 'frames',
      fps: 10
    });

    expect(fs.existsSync(exportedDir)).toBe(true);
    const files = fs.readdirSync(exportedDir);
    expect(files.length).toBe(2); // 0.2s * 10fps = 2 frames
    expect(files[0]).toBe('frame_00000.png');
    expect(files[1]).toBe('frame_00001.png');
  });
});
