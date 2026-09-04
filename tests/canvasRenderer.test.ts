import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import {
  renderToCanvas,
  renderToBuffer,
  CanvasRenderer
} from '../src/engine/canvasRenderer.js';
import {
  distributeGradientStops,
  parseFilterString,
  mapBlendMode,
  parseColor,
  parseColorToRgba,
  drawImageWithFit
} from '../src/engine/drawUtils.js';
import { createCanvas } from '@napi-rs/canvas';

describe('Canvas Renderer Engine (@napi-rs/canvas)', () => {
  // ==========================================================================
  // 1. Multi-Scale Rendering & Encoding (1x, 2x, 4x)
  // ==========================================================================
  describe('Multi-Scale Rendering & Encoding', () => {
    it('renders a layout to a Canvas object at 1x, 2x, and 4x scale', async () => {
      const src = `
        canvas {
          width: 200px;
          height: 150px;
          background: #ffffff;
        }
        rect #box {
          at: 10px 10px;
          size: 80px 60px;
          fill: #3b82f6;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const canvas1x = await renderToCanvas(layout, { scale: 1 });
      expect(canvas1x.width).toBe(200);
      expect(canvas1x.height).toBe(150);

      const canvas2x = await renderToCanvas(layout, { scale: 2 });
      expect(canvas2x.width).toBe(400);
      expect(canvas2x.height).toBe(300);

      const canvas4x = await renderToCanvas(layout, { scale: 4 });
      expect(canvas4x.width).toBe(800);
      expect(canvas4x.height).toBe(600);
    });

    it('encodes rendered layout to PNG buffer with valid magic bytes', async () => {
      const src = `
        canvas { width: 100px; height: 100px; }
        rect { size: 50px 50px; fill: #10b981; }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const buf = await renderToBuffer(layout, { format: 'png' });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
      // PNG header: 0x89 0x50 0x4E 0x47
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4E);
      expect(buf[3]).toBe(0x47);
    });

    it('encodes rendered layout to JPEG buffer with valid magic bytes and quality option', async () => {
      const src = `
        canvas { width: 100px; height: 100px; }
        rect { size: 50px 50px; fill: #ef4444; }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const buf = await renderToBuffer(layout, { format: 'jpg', quality: 85 });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
      // JPEG header: 0xFF 0xD8
      expect(buf[0]).toBe(0xFF);
      expect(buf[1]).toBe(0xD8);
    });
  });

  // ==========================================================================
  // 2. Gradients & Distributed Stop Algorithm
  // ==========================================================================
  describe('Gradients & Stop Distribution', () => {
    it('distributes missing stop positions evenly between anchors', () => {
      const stops = [{ color: '#ff0000' }, { color: '#00ff00' }, { color: '#0000ff' }];
      const distributed = distributeGradientStops(stops);
      expect(distributed).toHaveLength(3);
      expect(distributed[0]!.position).toBe(0);
      expect(distributed[1]!.position).toBeCloseTo(0.5, 2);
      expect(distributed[2]!.position).toBe(1);
    });

    it('preserves explicitly defined stop offsets and distributes intermediate stops', () => {
      const stops = [
        { color: '#000', position: 0.2 },
        { color: '#111' },
        { color: '#222', position: 0.8 }
      ];
      const distributed = distributeGradientStops(stops);
      expect(distributed[0]!.position).toBe(0.2);
      expect(distributed[1]!.position).toBeCloseTo(0.5, 2);
      expect(distributed[2]!.position).toBe(0.8);
    });

    it('renders linear and radial gradient fills without crashing', async () => {
      const src = `
        canvas {
          width: 400px;
          height: 300px;
          background: linear-gradient(to bottom, #1e293b, #0f172a);
        }
        rect #linearBox {
          at: 20px 20px;
          size: 150px 100px;
          fill: linear-gradient(45deg, #f59e0b, #ef4444 80%, #7c3aed);
        }
        circle #radialCircle {
          at: 200px 20px;
          size: 100px 100px;
          fill: radial-gradient(circle, #3b82f6, #1e3a8a);
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const buf = await renderToBuffer(layout, { format: 'png' });
      expect(buf.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 3. Color Parsing & Blend Modes
  // ==========================================================================
  describe('Color Parsing & Blend Mode Mapping', () => {
    it('parses hex, rgb, rgba, hsl, and named colors', () => {
      expect(parseColorToRgba('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
      expect(parseColorToRgba('#00ff0080').a).toBeCloseTo(0.5, 1);
      expect(parseColorToRgba('rgb(59, 130, 246)')).toEqual({ r: 59, g: 130, b: 246, a: 1 });
      expect(parseColorToRgba('rgba(16, 185, 129, 0.75)')).toEqual({ r: 16, g: 185, b: 129, a: 0.75 });
      expect(parseColorToRgba('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColorToRgba('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });

      const parsed = parseColor('#3b82f6');
      expect(parsed.hex).toBe('#3b82f6');
      expect(parsed.rgba).toBe('rgba(59, 130, 246, 1)');
    });

    it('maps DSL blend mode names to Canvas globalCompositeOperation', () => {
      expect(mapBlendMode('normal')).toBe('source-over');
      expect(mapBlendMode('multiply')).toBe('multiply');
      expect(mapBlendMode('screen')).toBe('screen');
      expect(mapBlendMode('overlay')).toBe('overlay');
      expect(mapBlendMode('color-dodge')).toBe('color-dodge');
      expect(mapBlendMode('color dodge')).toBe('color-dodge');
      expect(mapBlendMode('soft-light')).toBe('soft-light');
      expect(mapBlendMode('difference')).toBe('difference');
    });
  });

  // ==========================================================================
  // 4. CSS Filters & Parsing
  // ==========================================================================
  describe('CSS Filters', () => {
    it('parses multiple space-separated CSS filter functions', () => {
      const filters = parseFilterString('blur(4px) saturate(1.5) brightness(1.2) drop-shadow(0 4px 8px #00000080)');
      expect(filters).toHaveLength(4);
      expect(filters[0]!.name).toBe('blur');
      expect(filters[0]!.args).toEqual(['4px']);
      expect(filters[1]!.name).toBe('saturate');
      expect(filters[2]!.name).toBe('brightness');
      expect(filters[3]!.name).toBe('drop-shadow');
    });

    it('renders elements with CSS filters without throwing', async () => {
      const src = `
        canvas { width: 300px; height: 200px; }
        rect {
          at: 20px 20px;
          size: 100px 100px;
          fill: #3b82f6;
          filter: blur(5px) saturate(2);
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const buf = await renderToBuffer(layout);
      expect(buf.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 5. Image Fit Modes (fill, cover, contain, none)
  // ==========================================================================
  describe('Image Fit Modes', () => {
    it('calculates clipping and destination coordinates for cover, contain, and fill', () => {
      const canvas = createCanvas(200, 200);
      const ctx = canvas.getContext('2d');

      const dummyImg = { width: 400, height: 200 };
      expect(() => drawImageWithFit(ctx, dummyImg, 'fill', 0, 0, 100, 100)).not.toThrow();
      expect(() => drawImageWithFit(ctx, dummyImg, 'cover', 0, 0, 100, 100)).not.toThrow();
      expect(() => drawImageWithFit(ctx, dummyImg, 'contain', 0, 0, 100, 100)).not.toThrow();
      expect(() => drawImageWithFit(ctx, dummyImg, 'none', 0, 0, 100, 100)).not.toThrow();
    });
  });

  // ==========================================================================
  // 6. Clipping Masks & Hierarchy
  // ==========================================================================
  describe('Clipping Masks & Nested Groups', () => {
    it('renders group clipping masks cleanly', async () => {
      const src = `
        canvas { width: 400px; height: 400px; }
        group #maskedGroup {
          at: 20px 20px;
          rect #maskShape {
            size: 150px 150px;
            clip: true;
          }
          rect #clippedRect {
            at: 0px 0px;
            size: 300px 300px;
            fill: #ef4444;
          }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const buf = await renderToBuffer(layout);
      expect(buf.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 7. Polygons, Text & Transforms
  // ==========================================================================
  describe('Polygons, Text & Rotation Transforms', () => {
    it('renders center-relative polygons and rotated elements', async () => {
      const src = `
        canvas { width: 500px; height: 500px; }
        polygon #tri {
          at: 50px 50px;
          size: 120px 120px;
          points: [ (0, -60), (60, 60), (-60, 60) ];
          fill: #f59e0b;
        }
        text #headline {
          at: 50px 200px;
          content: "Declarative Typography";
          font-size: 28px;
          fill: #0f172a;
        }
        rect #rotatedBox {
          at: 50px 300px;
          size: 100px 50px;
          fill: #8b5cf6;
          rotation: 45deg;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const buf = await renderToBuffer(layout);
      expect(buf.length).toBeGreaterThan(0);
    });
  });
});
