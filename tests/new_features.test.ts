/**
 * tests/new_features.test.ts
 * Comprehensive test suite for Path, Stack (Auto-Layout), Color Functions, and Advanced Typography/Stroke styles.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { renderToCanvas, CanvasRenderer } from '../src/engine/canvasRenderer.js';
import { exportToSvg } from '../src/engine/svgExporter.js';
import { exportToPsd } from '../src/engine/psdExporter.js';

describe('New toad Features: Path, Stack, Color Functions & Advanced Styles', () => {
  it('1. Parses and resolves color transform functions (alpha, lighten, darken)', async () => {
    const dsl = `
      >brand = #0088ff;
      >brandAlpha = alpha(>brand, 0.5);
      >brandLight = lighten(>brand, 20%);
      >brandDark = darken(>brand, 25%);

      canvas "Color Test" {
        width: 400px;
        height: 400px;
        background: >brandDark;
      }

      rect #card {
        at: (20px, 20px);
        size: 100px 100px;
        fill: >brandAlpha;
        stroke: >brandLight 2px;
      }
    `;

    const ast = parseToad(dsl, 'color_test.toad');
    const resolved = await resolveImportsAndComponents(ast, 'color_test.toad');

    // Verify canvas background is darkened rgba/hex
    expect(resolved.canvas.fill).toContain('rgba');
    // Verify rect fill has 0.5 alpha
    expect(resolved.elements[0].fill).toContain('0.5');
    // Verify rect stroke has lightened color
    expect(resolved.elements[0].stroke?.color).toBeDefined();

    const layout = await solveLayout(resolved);
    const canvas = await renderToCanvas(layout);
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(400);
  });

  it('2. Parses, lays out, and renders SVG Path element (Bézier curves & free vectors)', async () => {
    const dsl = `
      canvas "Path Canvas" {
        width: 600px;
        height: 400px;
        background: #0f172a;
      }

      path #customWave {
        at: (50px, 50px);
        size: 500px 300px;
        d: "M 0 50 Q 125 0 250 50 T 500 50";
        stroke: #38bdf8 4px;
        stroke-cap: round;
        stroke-join: round;
        fill: transparent;
      }
    `;

    const ast = parseToad(dsl, 'path_test.toad');
    const resolved = await resolveImportsAndComponents(ast, 'path_test.toad');
    expect(resolved.elements[0].type).toBe('path');
    expect(resolved.elements[0].d).toBe('M 0 50 Q 125 0 250 50 T 500 50');
    expect(resolved.elements[0].strokeCap).toBe('round');
    expect(resolved.elements[0].strokeJoin).toBe('round');

    const layout = await solveLayout(resolved);
    expect(layout.nodes[0].type).toBe('path');
    expect(layout.nodes[0].pathLayout?.d).toBe('M 0 50 Q 125 0 250 50 T 500 50');
    expect(layout.nodes[0].style.strokeCap).toBe('round');

    // Export to SVG & Verify path element exists
    const svg = await exportToSvg(layout);
    expect(svg).toContain('<path');
    expect(svg).toContain('d="M 0 50 Q 125 0 250 50 T 500 50"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('stroke-linejoin="round"');

    // Export to PSD Buffer
    const psdBuf = await exportToPsd(layout);
    expect(psdBuf.length).toBeGreaterThan(0);
  });

  it('3. Auto-Layout Stack element (vertical and horizontal sequential layout with gap & padding)', async () => {
    const dsl = `
      canvas "Stack Canvas" {
        width: 800px;
        height: 800px;
      }

      // Vertical stack
      stack #navMenu {
        at: (40px, 40px);
        direction: vertical;
        gap: 16px;
        padding: 24px;
        fill: #1e293b;
        radius: 12px;

        rect #item1 { size: 200px 40px; fill: #334155; }
        rect #item2 { size: 200px 40px; fill: #334155; }
        rect #item3 { size: 200px 40px; fill: #334155; }
      }

      // Horizontal stack
      stack #actionBar {
        at: (40px, 350px);
        direction: horizontal;
        gap: 12px;
        padding: 10px;

        rect #btn1 { size: 100px 36px; fill: #38bdf8; }
        rect #btn2 { size: 100px 36px; fill: #818cf8; }
      }
    `;

    const ast = parseToad(dsl, 'stack_test.toad');
    const resolved = await resolveImportsAndComponents(ast, 'stack_test.toad');
    const layout = await solveLayout(resolved);

    const verticalStack = layout.nodes.find(n => n.id === 'navMenu')!;
    expect(verticalStack).toBeDefined();
    expect(verticalStack.type).toBe('stack');
    expect(verticalStack.children).toHaveLength(3);

    // Item 1: at y = 40 (stack.y) + 24 (paddingTop) = 64
    expect(verticalStack.children![0].y).toBe(64);
    // Item 2: at y = 64 + 40 (height) + 16 (gap) = 120
    expect(verticalStack.children![1].y).toBe(120);
    // Item 3: at y = 120 + 40 (height) + 16 (gap) = 176
    expect(verticalStack.children![2].y).toBe(176);

    // Total vertical stack auto-height = 24 (padTop) + 40*3 + 16*2 + 24 (padBottom) = 200px
    expect(verticalStack.height).toBe(200);

    const horizontalStack = layout.nodes.find(n => n.id === 'actionBar')!;
    expect(horizontalStack).toBeDefined();
    // Btn 1: at x = 40 (stack.x) + 10 (paddingLeft) = 50
    expect(horizontalStack.children![0].x).toBe(50);
    // Btn 2: at x = 50 + 100 (width) + 12 (gap) = 162
    expect(horizontalStack.children![1].x).toBe(162);

    // Render verification
    const canvas = await renderToCanvas(layout);
    expect(canvas.width).toBe(800);
  });

  it('4. Advanced Typography & Stroke Styles (letter-spacing, text-transform)', async () => {
    const dsl = `
      canvas "Typo Canvas" {
        width: 500px;
        height: 300px;
      }

      text #badge {
        at: (50px, 50px);
        content: "declarative design";
        text-transform: uppercase;
        letter-spacing: 4px;
        font-size: 20px;
        font-weight: bold;
        color: #38bdf8;
      }
    `;

    const ast = parseToad(dsl, 'typo_test.toad');
    const resolved = await resolveImportsAndComponents(ast, 'typo_test.toad');
    const layout = await solveLayout(resolved);

    const node = layout.nodes[0];
    expect(node.textLayout).toBeDefined();
    // Verify text transformed to uppercase in layout lines
    expect(node.textLayout!.lines[0]).toBe('DECLARATIVE DESIGN');
    expect(node.style.letterSpacing).toBe(4);
    expect(node.style.textTransform).toBe('uppercase');

    const svg = await exportToSvg(layout);
    expect(svg).toContain('DECLARATIVE DESIGN');
  });

  it('5. Parses and resolves Photo Canvas Mode (auto-detects image dimensions & grading parameters)', async () => {
    const tmpDir = path.resolve('tests/dist/photo_test_suite');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const sampleImg = path.join(tmpDir, 'photo.png');
    const c = createCanvas(500, 350);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, 0, 500, 350);
    fs.writeFileSync(sampleImg, c.toBuffer('image/png'));

    const dsl = `
      canvas photo "photo.png" {
        exposure: 0.4;
        contrast: 1.1;
        saturation: 1.25;
        warmth: 0.15;
        vignette: 25%;
      }
    `;

    const entryPath = path.join(tmpDir, 'photo_mode.toad');
    const ast = parseToad(dsl, entryPath);
    expect(ast.canvas?.mode).toBe('photo');
    expect(ast.canvas?.photoSrc).toBe('photo.png');

    const resolved = await resolveImportsAndComponents(ast, entryPath);
    expect(resolved.canvas.mode).toBe('photo');

    const layout = await solveLayout(resolved);
    expect(layout.canvas.mode).toBe('photo');
    expect(layout.canvas.width).toBe(500);
    expect(layout.canvas.height).toBe(350);
    expect(layout.canvas.photoParams?.exposure).toBe(0.4);
    expect(layout.canvas.photoParams?.contrast).toBe(1.1);
    expect(layout.canvas.photoParams?.saturation).toBe(1.25);
    expect(layout.canvas.photoParams?.vignette).toBe(0.25);
  });

  it('6. Solves and renders radial Adjust elements (dodge & burn spots with feathered falloff)', async () => {
    const tmpDir = path.resolve('tests/dist/photo_test_suite');
    const sampleImg = path.join(tmpDir, 'photo.png');
    const entryPath = path.join(tmpDir, 'adjust_mode.toad');

    const dsl = `
      canvas photo "photo.png" {
        exposure: 0.1;
      }

      adjust #faceHighlight {
        at: (250px, 175px);
        radius: 80px;
        feather: 30px;
        exposure: 0.6;
        warmth: 0.2;
      }

      text #watermark {
        content: "Photo Mode v1";
        at: (30px, 30px);
        color: #ffffff;
      }
    `;

    const ast = parseToad(dsl, entryPath);
    const resolved = await resolveImportsAndComponents(ast, entryPath);
    const layout = await solveLayout(resolved);

    const adj = layout.nodes.find(n => n.id === 'faceHighlight');
    expect(adj).toBeDefined();
    expect(adj?.type).toBe('adjust');
    expect(adj?.adjustLayout?.radius).toBe(80);
    expect(adj?.adjustLayout?.feather).toBe(30);
    expect(adj?.adjustLayout?.params.exposure).toBe(0.6);

    const buf = await CanvasRenderer.renderToBuffer(layout, {
      format: 'png',
      basePath: entryPath
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
  });
});
