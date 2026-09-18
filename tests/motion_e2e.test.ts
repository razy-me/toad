import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { parseMotion } from '../src/motion/parser.js';
import { loadMotionScene } from '../src/motion/sceneLoader.js';
import { MotionSolver } from '../src/motion/motionSolver.js';
import { exportMotionVideo } from '../src/motion/videoExporter.js';
import { createCanvas } from '@napi-rs/canvas';

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

  it('isolates container bitmaps to prevent container ghosting of animatable children', async () => {
    const fixtureToad = path.resolve('tests/fixtures/hero_banner.toad');
    const scene = await loadMotionScene(fixtureToad);

    const containerEl = scene.getElement('#heroContent');
    expect(containerEl).toBeDefined();

    // Since #heroContent has no fill or border of its own, its isolated canvas should be empty
    // and NOT contain baked raster graphics of its children (such as #heroTitle text)
    const testCanvas = createCanvas(containerEl!.box.width, containerEl!.box.height);
    const ctx = testCanvas.getContext('2d');
    containerEl!.render(ctx as any, 1.0);
    const imgData = ctx.getImageData(0, 0, testCanvas.width, testCanvas.height).data;
    let nonZeroAlpha = 0;
    for (let i = 3; i < imgData.length; i += 4) {
      if (imgData[i] > 0) nonZeroAlpha++;
    }
    expect(nonZeroAlpha).toBe(0);
  });

  it('combines along path motion with translation offsets (txDelta and tyDelta)', async () => {
    const fixtureToad = path.resolve('tests/fixtures/hero_banner.toad');
    const scene = await loadMotionScene(fixtureToad);
    const toadmCode = `
      @import "${fixtureToad.replace(/\\/g, '/')}" as hero;

      motion "Delta Motion" {
        scene: hero;
        duration: 1.0s;
        fps: 30;
        dimensions: 1600px 900px;

        timeline {
          #heroBadge {
            0.0s: {
              along: border of #heroContent;
              progress: 0%;
              translateX: 25px;
              translateY: -15px;
            }
          }
        }
      }
    `;
    const doc = parseMotion(toadmCode);
    const solver = new MotionSolver(doc, scene);
    const badgeEl = scene.getElement('#heroBadge')!;
    const state = solver.evaluateElement(badgeEl, 0);

    const pathSampler = (solver as any).getPathSampler('#heroContent');
    const pt = pathSampler.sample(0, 0);
    expect(state.x).toBeCloseTo(pt.x - badgeEl.box.width / 2 + 25);
    expect(state.y).toBeCloseTo(pt.y - badgeEl.box.height / 2 - 15);
  });

  it('loads standalone SVG scenes and isolates individual elements for animation', async () => {
    const svgDir = path.resolve('tests/dist/svg_test');
    if (!fs.existsSync(svgDir)) {
      fs.mkdirSync(svgDir, { recursive: true });
    }
    const svgFile = path.join(svgDir, 'icons.svg');
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
        <rect id="bgRect" x="0" y="0" width="400" height="300" fill="#111827" />
        <path id="star" d="M 50 10 L 60 40 L 90 40 L 65 60 L 75 90 L 50 70 L 25 90 L 35 60 L 10 40 L 40 40 Z" fill="#F59E0B" />
      </svg>
    `;
    fs.writeFileSync(svgFile, svgContent, 'utf8');

    const scene = await loadMotionScene(svgFile);
    expect(scene.width).toBe(400);
    expect(scene.height).toBe(300);
    expect(scene.getElement('#bgRect')).toBeDefined();
    expect(scene.getElement('#star')).toBeDefined();

    const toadmCode = `
      @import "${svgFile.replace(/\\/g, '/')}" as icons;

      motion "Svg Animation" {
        scene: icons;
        duration: 1.0s;
        fps: 30;
        dimensions: 400px 300px;

        timeline {
          #star {
            0.0s: { opacity: 0; scale: 0.5; }
            1.0s: { opacity: 1; scale: 1.0; }
          }
        }
      }
    `;
    const doc = parseMotion(toadmCode);
    const solver = new MotionSolver(doc, scene);
    const frame = solver.renderFrame(0.5);
    expect(frame.width).toBe(400);
    expect(frame.height).toBe(300);

    const starEl = scene.getElement('#star')!;
    const state0 = solver.evaluateElement(starEl, 0);
    expect(state0.opacity).toBeCloseTo(0);
    expect(state0.scaleX).toBeCloseTo(0.5);
  });

  it('throws descriptive error when toadm scene alias does not match imported alias', async () => {
    const { compileMotion } = await import('../src/motion/index.js');
    const testDir = path.resolve('tests/dist/alias_test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    const fixtureToad = path.resolve('tests/fixtures/hero_banner.toad');
    const toadmFile = path.join(testDir, 'invalid_alias.toadm');
    const toadmCode = `
      @import "${fixtureToad.replace(/\\/g, '/')}" as hero;

      motion "Invalid Scene" {
        scene: nonExistentAlias;
        duration: 1.0s;
        fps: 30;
        dimensions: 800px 600px;
      }
    `;
    fs.writeFileSync(toadmFile, toadmCode, 'utf8');

    await expect(compileMotion(toadmFile)).rejects.toThrow(
      /Scene alias 'nonExistentAlias' specified in motion block was not found in @imports/
    );
  });
});
