import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { Parser } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { CanvasRenderer } from '../src/engine/canvasRenderer.js';
import { exportToPsd } from '../src/engine/psdExporter.js';
import { readPsd } from 'ag-psd';

describe('Layer Effects (Photoshop Layer FX)', () => {
  it('parses and resolves inner shadow, outer/inner glow, bevel, layer stroke, and overlays', async () => {
    const dsl = `
      canvas {
        size: 800px 600px;
        fill: #111827;
      }

      rect "card" {
        at: 50px 50px;
        size: 300px 200px;
        fill: #3b82f6;
        radius: 12px;
        inner-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
        glow: 16px #60a5fa;
        inner-glow: 8px #ffffff;
        bevel: inner-bevel 6px;
        stroke-style: inside 3px #1e3a8a;
        overlay: #2563eb;
      }
    `;

    const entryPath = path.resolve(process.cwd(), 'effects_test.toad');
    const parser = new Parser(dsl, entryPath);
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, entryPath);
    const layout = await solveLayout(resolved);

    const cardNode = layout.nodes.find(n => n.name === 'card');
    expect(cardNode).toBeDefined();
    expect(cardNode?.style.innerShadow).toEqual({
      offsetX: 0,
      offsetY: 4,
      blur: 10,
      color: 'rgba(0, 0, 0, 0.4)'
    });
    expect(cardNode?.style.outerGlow).toEqual({
      size: 16,
      color: '#60a5fa',
      opacity: 1
    });
    expect(cardNode?.style.innerGlow).toEqual({
      size: 8,
      color: '#ffffff',
      opacity: 1
    });
    expect(cardNode?.style.bevel).toEqual({
      type: 'inner-bevel',
      size: 6,
      depth: 100,
      soften: 0,
      direction: 'up'
    });
    expect(cardNode?.style.layerStroke).toEqual({
      position: 'inside',
      width: 3,
      color: '#1e3a8a'
    });
    expect(cardNode?.style.colorOverlay).toBe('#2563eb');
  });

  it('renders to Canvas buffer with layer effects without errors', async () => {
    const dsl = `
      canvas {
        size: 400px 300px;
        fill: #0f172a;
      }

      rect "button" {
        at: 50px 50px;
        size: 200px 60px;
        fill: #3b82f6;
        radius: 8px;
        shadow: 0 4px 8px rgba(0,0,0,0.3);
        inner-shadow: 0 2px 4px rgba(255,255,255,0.4);
        glow: 12px #38bdf8;
        inner-glow: 6px #ffffff;
        stroke-style: inside 2px #1d4ed8;
      }
    `;

    const entryPath = path.resolve(process.cwd(), 'canvas_fx.toad');
    const parser = new Parser(dsl, entryPath);
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, entryPath);
    const layout = await solveLayout(resolved);

    const buf = await CanvasRenderer.renderToBuffer(layout, { format: 'png' });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it('exports Photoshop Layer Effects directly into native PSD structure', async () => {
    const dsl = `
      canvas {
        size: 500px 400px;
        fill: #ffffff;
      }

      rect "fxCard" {
        at: 40px 40px;
        size: 250px 150px;
        fill: #10b981;
        radius: 8px;
        shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
        inner-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
        glow: 14px #34d399;
        inner-glow: 8px #ffffff;
        bevel: inner-bevel 4px;
        stroke-style: inside 2px #047857;
        overlay: #059669;
      }
    `;

    const entryPath = path.resolve(process.cwd(), 'psd_fx.toad');
    const parser = new Parser(dsl, entryPath);
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, entryPath);
    const layout = await solveLayout(resolved);

    const psdBuffer = await exportToPsd(layout);
    expect(psdBuffer).toBeInstanceOf(Buffer);

    const parsedPsd = readPsd(psdBuffer);
    expect(parsedPsd.width).toBe(500);
    expect(parsedPsd.height).toBe(400);

    const cardLayer = parsedPsd.children?.find(c => c.name === 'fxCard');
    expect(cardLayer).toBeDefined();
    expect(cardLayer?.effects).toBeDefined();
    expect(cardLayer?.effects?.dropShadow).toBeDefined();
    expect(cardLayer?.effects?.innerShadow).toBeDefined();
    expect(cardLayer?.effects?.outerGlow).toBeDefined();
    expect(cardLayer?.effects?.innerGlow).toBeDefined();
    expect(cardLayer?.effects?.bevel).toBeDefined();
    expect(cardLayer?.effects?.stroke).toBeDefined();
    expect(cardLayer?.effects?.solidFill).toBeDefined();
  });
});
