/**
 * tests/file_exports.test.ts
 * Tests for in-file canvas export declarations, smart ratio & resolution calculation,
 * and zero-flag CLI compilation.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { compileToad } from '../src/build.js';

describe('In-File Export Configuration & Dynamic Resolution', () => {
  const tmpDir = path.resolve(__dirname, 'dist', 'file_export_test');

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  it('1. Calculates 16:9 landscape dimensions from resolution: 1080 (1920x1080)', async () => {
    const dsl = `
      canvas "Full HD Banner" {
        ratio: 16:9;
        resolution: 1080;
        export: png, svg;
        background: #0f172a;
      }

      rect #box {
        at: (100px, 100px);
        size: 200px 200px;
        fill: #38bdf8;
      }
    `;

    const ast = parseToad(dsl, 'banner.toad');
    const resolved = await resolveImportsAndComponents(ast, 'banner.toad');
    expect(resolved.canvas.width).toBe(1920);
    expect(resolved.canvas.height).toBe(1080);
    expect(resolved.canvas.exports).toEqual(['png', 'svg']);

    const layout = await solveLayout(resolved);
    expect(layout.canvas.width).toBe(1920);
    expect(layout.canvas.height).toBe(1080);
    expect(layout.canvas.exports).toEqual(['png', 'svg']);
  });

  it('2. Calculates 9:16 portrait dimensions from resolution: 1080 (1080x1920)', async () => {
    const dsl = `
      canvas "Story" {
        ratio: 9:16;
        resolution: 1080;
        export: png;
        background: #1e293b;
      }
    `;

    const ast = parseToad(dsl, 'story.toad');
    const resolved = await resolveImportsAndComponents(ast, 'story.toad');
    expect(resolved.canvas.width).toBe(1080);
    expect(resolved.canvas.height).toBe(1920);
  });

  it('3. Calculates 1:1 square dimensions from resolution: 1440 (1440x1440)', async () => {
    const dsl = `
      canvas "Square Logo" {
        ratio: 1:1;
        resolution: 1440;
        export: png, psd, svg;
      }
    `;

    const ast = parseToad(dsl, 'square.toad');
    const resolved = await resolveImportsAndComponents(ast, 'square.toad');
    expect(resolved.canvas.width).toBe(1440);
    expect(resolved.canvas.height).toBe(1440);
    expect(resolved.canvas.exports).toEqual(['png', 'psd', 'svg']);
  });

  it('4. Handles standard named resolutions (720p, 1080p, 4k, etc.)', async () => {
    const dsl = `
      canvas "4K Wallpaper" {
        ratio: 16:9;
        resolution: 4k;
        export: all;
      }
    `;

    const ast = parseToad(dsl, 'wallpaper.toad');
    const resolved = await resolveImportsAndComponents(ast, 'wallpaper.toad');
    expect(resolved.canvas.width).toBe(3840);
    expect(resolved.canvas.height).toBe(2160);
    expect(resolved.canvas.exports).toEqual(['all']);
  });

  it('5. compileToad automatically generates in-file declared formats without CLI options', async () => {
    const testFile = path.join(tmpDir, 'auto_export.toad');
    fs.writeFileSync(testFile, `
      canvas "Auto Export" {
        ratio: 16:9;
        resolution: 720;
        export: png, svg, psd;
        background: #0f172a;
      }

      circle #dot {
        at: (50px, 50px);
        radius: 40px;
        fill: #38bdf8;
      }
    `);

    // Call compileToad with NO format options
    const result = await compileToad(testFile, { outDir: tmpDir });
    expect(result.success).toBe(true);
    expect(result.canvas.width).toBe(1280);
    expect(result.canvas.height).toBe(720);

    const generatedExtensions = result.outputFiles.map(f => path.extname(f));
    expect(generatedExtensions).toContain('.png');
    expect(generatedExtensions).toContain('.svg');
    expect(generatedExtensions).toContain('.psd');

    expect(fs.existsSync(path.join(tmpDir, 'auto_export.png'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'auto_export.svg'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'auto_export.psd'))).toBe(true);
  });

  it('6. Supports in-file quality/compress declarations (e.g. quality: 80% or compress: 0.75)', async () => {
    const dsl = `
      canvas "Quality Test" {
        ratio: 16:9;
        resolution: 1080p;
        export: jpg, webp;
        quality: 85%;
      }
    `;

    const ast = parseToad(dsl, 'quality.toad');
    const resolved = await resolveImportsAndComponents(ast, 'quality.toad');
    expect(resolved.canvas.quality).toBe(85);

    const layout = await solveLayout(resolved);
    expect(layout.canvas.quality).toBe(85);

    const dslCompress = `
      canvas "Compress Test" {
        compress: 0.75;
      }
    `;
    const ast2 = parseToad(dslCompress, 'compress.toad');
    const resolved2 = await resolveImportsAndComponents(ast2, 'compress.toad');
    // compress: 75% means 25% quality (inverse)
    expect(resolved2.canvas.quality).toBe(25);
  });
});

