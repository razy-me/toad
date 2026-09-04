import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { Parser } from '../src/parser/parser.js';
import { resolveImportsAndComponents, convertDimensionToPx } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { CanvasRenderer } from '../src/engine/canvasRenderer.js';
import { parseColorToRgba, cmykToRgb } from '../src/engine/drawUtils.js';

describe('Print Prepress, CMYK & Bleed', () => {
  it('converts print dimension units (mm, cm, in, pt) to px at 96 DPI correctly', () => {
    expect(convertDimensionToPx(1, 'in', 96)).toBe(96);
    expect(convertDimensionToPx(25.4, 'mm', 96)).toBeCloseTo(96, 2);
    expect(convertDimensionToPx(2.54, 'cm', 96)).toBeCloseTo(96, 2);
    expect(convertDimensionToPx(72, 'pt', 96)).toBeCloseTo(96, 2);
    expect(convertDimensionToPx(3, 'mm', 96)).toBeCloseTo(11.34, 1);
  });

  it('parses and converts CMYK color functions accurately', () => {
    // 100% Cyan: cmyk(1, 0, 0, 0) -> rgb(0, 255, 255)
    const cyan = cmykToRgb(1, 0, 0, 0);
    expect(cyan).toEqual({ r: 0, g: 255, b: 255, a: 1 });

    // 100% Magenta: cmyk(0%, 100%, 0%, 0%) -> rgb(255, 0, 255)
    const magenta = parseColorToRgba('cmyk(0%, 100%, 0%, 0%)');
    expect(magenta).toEqual({ r: 255, g: 0, b: 255, a: 1 });

    // 100% Yellow: cmyk(0, 0, 1, 0) -> rgb(255, 255, 0)
    const yellow = parseColorToRgba('cmyk(0, 0, 1, 0)');
    expect(yellow).toEqual({ r: 255, g: 255, b: 0, a: 1 });

    // 100% Black: cmyk(0, 0, 0, 1) -> rgb(0, 0, 0)
    const black = parseColorToRgba('cmyk(0, 0, 0, 1)');
    expect(black).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('parses canvas print metadata (dpi, bleed, crop-marks, color-mode)', async () => {
    const dsl = `
      canvas {
        size: 85mm 55mm;
        dpi: 300;
        bleed: 3mm;
        crop-marks: true;
        color-mode: cmyk;
        fill: cmyk(0.1, 0.2, 0.8, 0);
      }

      rect "flyerCard" {
        at: 0 0;
        size: 100% 100%;
        fill: cmyk(0%, 50%, 100%, 0%);
      }
    `;

    const entryPath = path.resolve(process.cwd(), 'print_test.toad');
    const parser = new Parser(dsl, entryPath);
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, entryPath);
    const layout = await solveLayout(resolved);

    expect(layout.canvas.dpi).toBe(300);
    expect(layout.canvas.cropMarks).toBe(true);
    expect(layout.canvas.colorMode).toBe('cmyk');
    expect(layout.canvas.bleed).toBeCloseTo(11.34, 1);
    expect(layout.canvas.width).toBeCloseTo(321.26, 1);
    expect(layout.canvas.height).toBeCloseTo(207.87, 1);
  });

  it('renders expanded media box with crop marks and bleed margin', async () => {
    const dsl = `
      canvas {
        size: 300px 200px;
        bleed: 10px;
        crop-marks: true;
        fill: #ffffff;
      }

      rect "card" {
        at: 0 0;
        size: 300px 200px;
        fill: #ef4444;
      }
    `;

    const entryPath = path.resolve(process.cwd(), 'bleed_render.toad');
    const parser = new Parser(dsl, entryPath);
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, entryPath);
    const layout = await solveLayout(resolved);

    const canvas = await CanvasRenderer.renderToCanvas(layout);
    // Total width = 300 + 2 * margin(30) = 360px
    // Total height = 200 + 2 * margin(30) = 260px
    expect(canvas.width).toBe(360);
    expect(canvas.height).toBe(260);

    const buf = await CanvasRenderer.renderToBuffer(layout, { format: 'png' });
    expect(buf.length).toBeGreaterThan(100);
  });
});
