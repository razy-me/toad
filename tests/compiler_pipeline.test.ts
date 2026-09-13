import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileToad } from '../src/build.js';
import { AstCache } from '../src/engine/buildCache.js';

describe('Compiler Pipeline Robustness & Defect Verification', () => {
  const sandboxDir = path.resolve(process.cwd(), 'tests/dist/pipeline_sandbox');

  beforeEach(() => {
    AstCache.getInstance().clear();
    fs.mkdirSync(sandboxDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    } catch {}
  });

  it('preserves non-fatal parser diagnostic warnings in build result', async () => {
    const filePath = path.join(sandboxDir, 'diag.toad');
    fs.writeFileSync(filePath, `
      canvas {
        size: 400px 300px;
      }
      rect {
        at: 10px 10px;
        size: 50px 50px;
        fill: #ff0000;
      }
    `);

    const res = await compileToad(filePath, { dryRun: true });
    expect(res.success).toBe(true);
    expect(Array.isArray(res.warnings)).toBe(true);
  });

  it('injects CLI options.dpi and options.bleed into canvas before layout solve occurs', async () => {
    const filePath = path.join(sandboxDir, 'dpi_calc.toad');
    fs.writeFileSync(filePath, `
      canvas {
        size: 800px 600px;
      }
      rect #box {
        at: 0 0;
        size: 100px 100px;
        fill: #00ff00;
      }
    `);

    // Solve at default 96 DPI
    const res96 = await compileToad(filePath, { dryRun: true, dpi: 96 });
    expect(res96.canvas.dpi).toBe(96);

    // Solve with explicit 300 DPI and bleed
    AstCache.getInstance().clear();
    const res300 = await compileToad(filePath, { dryRun: true, dpi: 300, bleed: '3mm' });
    expect(res300.canvas.dpi).toBe(300);
    expect(res300.canvas.hasExplicitDpi).toBe(true);
    expect(res300.canvas.bleed).toBeCloseTo((3 / 25.4) * 300, 1);
  });

  it('correctly resolves transitive @font paths declared in imported subdirectories', async () => {
    const subDir = path.join(sandboxDir, 'tokens');
    fs.mkdirSync(subDir, { recursive: true });

    // Dummy font file in subfolder
    const fontFile = path.join(subDir, 'CustomFont.ttf');
    fs.writeFileSync(fontFile, 'fake-font-content');

    const importedToad = path.join(subDir, 'typography.toad');
    fs.writeFileSync(importedToad, `
      @font "./CustomFont.ttf" as "CustomBrand";
      >headingFont: "CustomBrand";
    `);

    const mainToad = path.join(sandboxDir, 'main.toad');
    fs.writeFileSync(mainToad, `
      @import "./tokens/typography.toad";
      canvas {
        size: 400px 300px;
      }
      text "Hello" {
        at: 20px 20px;
        font: 24px >headingFont;
      }
    `);

    const res = await compileToad(mainToad, { dryRun: true });
    expect(res.success).toBe(true);
    // The registered font source should point to the actual file in the subfolder
    const registeredFont = res.layout.fonts.find(f => f.family === 'CustomBrand');
    expect(registeredFont).toBeDefined();
    expect(path.normalize(registeredFont!.source)).toBe(path.normalize(fontFile));

    // And it should be present in dependencies
    expect(res.dependencies.some(d => path.normalize(d) === path.normalize(fontFile))).toBe(true);
  });

  it('tracks canvas photoSrc as asset dependency for watch mode', async () => {
    const bgImg = path.join(sandboxDir, 'bg.jpg');
    fs.writeFileSync(bgImg, 'fake-image-bytes');

    const filePath = path.join(sandboxDir, 'photo.toad');
    fs.writeFileSync(filePath, `
      canvas "Hero" {
        mode: photo;
        photo: "./bg.jpg";
        size: 800px 600px;
      }
    `);

    const res = await compileToad(filePath, { dryRun: true });
    expect(res.success).toBe(true);
    expect(res.dependencies.some(d => path.normalize(d) === path.normalize(bgImg))).toBe(true);
  });

  it('preserves warnings and rootNodes across multi-canvas pages', async () => {
    const filePath = path.join(sandboxDir, 'multicanvas.toad');
    fs.writeFileSync(filePath, `
      canvas "Page1" {
        size: 400px 400px;
        rect #p1_box {
          size: 100px 100px;
        }
      }
      canvas "Page2" {
        size: 500px 500px;
      }
    `);

    const res = await compileToad(filePath, { dryRun: true });
    expect(res.success).toBe(true);
    expect(res.layout.canvases).toBeDefined();
    expect(res.layout.canvases!.length).toBe(2);

    // Page 2 declares no elements of its own and triggers empty warning
    const page2 = res.layout.canvases![1]!;
    expect(page2.warnings?.some(w => w.includes('declares no elements of its own'))).toBe(true);
    expect(page2.rootNodes).toBeDefined();
  });
});
