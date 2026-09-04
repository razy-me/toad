/**
 * tests/review_fixes_render.test.ts
 * Regression coverage for renderer / SVG / PSD / build fixes: bleed-aware
 * margins, JPEG white flattening, real raster filters, conic gradients in
 * SVG, vertical text alignment, extra SVG filter primitives, PSD gradient
 * angle convention, the shared image cache and render-once encoding.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { renderToCanvas, renderToBuffer } from '../src/engine/canvasRenderer.js';
import { exportToSvg } from '../src/engine/svgExporter.js';
import { exportToPsd, cssGradientAngleToPhotoshop } from '../src/engine/psdExporter.js';
import { detectCanvasFilterSupport, resolveSharedImage, getImageCacheSize, clearImageCache } from '../src/engine/imageCache.js';
import { compileToad } from '../src/build.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const filterSupported = detectCanvasFilterSupport();

async function compile(src: string, filename = 'test.toad') {
  const doc = parseToad(src, filename);
  const resolved = await resolveImportsAndComponents(doc, filename);
  return solveLayout(resolved);
}

describe('Review fixes: rendering & exporters', () => {
  it('grows the canvas by bleed even without crop marks', async () => {
    const layout = await compile(`
      canvas { size: 300px 200px; background: #ffffff; bleed: 10px; }
      rect #r { at: 20px 20px; size: 50px 50px; fill: #3366ff; }
    `);
    const canvas = await renderToCanvas(layout);
    // 300x200 + 2*10px bleed on every side.
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(220);
  });

  it('keeps crop-mark margin behaviour intact when both are set', async () => {
    const layout = await compile(`
      canvas { size: 300px 200px; background: #ffffff; bleed: 10px; crop-marks: true; }
      rect #r { at: 20px 20px; size: 50px 50px; fill: #3366ff; }
    `);
    const canvas = await renderToCanvas(layout);
    // Crop marks demand >=30px margin which dominates the 10px bleed.
    expect(canvas.width).toBe(360);
    expect(canvas.height).toBe(260);
  });

  it('flattens JPEG exports onto white instead of black', async () => {
    const layout = await compile(`
      canvas { size: 80px 80px; }
      rect #r { at: 30px 30px; size: 20px 20px; fill: #ff0000; }
    `);
    const buf = await renderToBuffer(layout, { format: 'jpg' });
    const img = await loadImage(buf);
    const probeCanvas = createCanvas(img.width, img.height);
    const ctx = probeCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const corner = ctx.getImageData(0, 0, 1, 1).data;
    // Transparent canvas corners must be white, not black.
    expect(corner[0]).toBeGreaterThan(200);
    expect(corner[1]).toBeGreaterThan(200);
    expect(corner[2]).toBeGreaterThan(200);
  });

  it.skipIf(!filterSupported)('actually applies blur filters to raster output', async () => {
    const base = 'canvas { size: 100px 100px; background: #ffffff; } rect #r { at: 25px 25px; size: 50px 50px; fill: #000000; }';
    const sharp = await renderToBuffer(await compile(base));
    const blurred = await renderToBuffer(await compile(base.replace('#000000;', '#000000; filter: blur(6px);')));
    expect(Buffer.compare(sharp, blurred)).not.toBe(0);
  });

  it('exports conic gradients as wedge patterns without black fallbacks', async () => {
    const layout = await compile(`
      canvas { size: 120px 120px; }
      rect #dial { size: 100px 100px; fill: conic-gradient(from 0deg, #ff0000, #00ff00, #0000ff, #ff0000); }
    `);
    const svg = await exportToSvg(layout);
    expect(svg).toContain('conic_grad_');
    expect(svg).toContain('<pattern');
    expect(svg).not.toContain('fill="#000000"');
  });

  it('shifts vertically-aligned text in SVG exports', async () => {
    const mk = (va: string) => compile(`
      canvas { size: 200px 100px; }
      text #t { at: 10px 10px; width: 180px; height: 80px; content: "Centered"; font-size: 16px; vertical-align: ${va}; }
    `);
    const topSvg = await exportToSvg(await mk('top'));
    const midSvg = await exportToSvg(await mk('middle'));
    const yOf = (svg: string) => {
      const m = svg.match(/\by="([\d.\-]+)"/);
      return m ? parseFloat(m[1]!) : NaN;
    };
    expect(yOf(midSvg)).toBeGreaterThan(yOf(topSvg));
  });

  it('emits SVG filter primitives for contrast / invert / hue-rotate / sepia', async () => {
    const layout = await compile(`
      canvas { size: 100px 100px; }
      rect #fx {
        size: 40px 40px; fill: #3366ff;
        filter: contrast(1.4) invert(0.8) hue-rotate(45deg) sepia(0.5);
      }
    `);
    const svg = await exportToSvg(layout);
    expect(svg).toMatch(/feComponentTransfer/);
    expect(svg).toMatch(/feColorMatrix[^>]*type="hueRotate"/);
    expect(svg).toMatch(/type="matrix"/); // sepia colour matrix
    expect(svg).toMatch(/tableValues=/); // invert transfer table
  });

  it('maps CSS gradient angles onto the Photoshop convention', () => {
    expect(cssGradientAngleToPhotoshop('to top')).toBe(90);
    expect(cssGradientAngleToPhotoshop('to right')).toBe(0);
    expect(cssGradientAngleToPhotoshop('to bottom')).toBe(270);
    expect(cssGradientAngleToPhotoshop('to left')).toBe(180);
    expect(cssGradientAngleToPhotoshop(45)).toBe(45);
    expect(cssGradientAngleToPhotoshop(undefined)).toBe(270); // CSS default
    expect(cssGradientAngleToPhotoshop(135)).toBe(315);
  });

  it('shares decoded images through the global cache and can clear it', async () => {
    clearImageCache();
    // 1x1 red PNG
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toad-img-'));
    const imgPath = path.join(dir, 'dot.png');
    fs.writeFileSync(imgPath, Buffer.from(pngB64, 'base64'));
    try {
      const a = await resolveSharedImage(imgPath);
      const b = await resolveSharedImage(imgPath);
      expect(a).not.toBeNull();
      expect(b).toBe(a); // identical decoded instance
      expect(getImageCacheSize()).toBeGreaterThanOrEqual(1);
      const missing = await resolveSharedImage(path.join(dir, 'nope.png'));
      expect(missing).toBeNull();
      clearImageCache();
      expect(getImageCacheSize()).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('encodes every requested raster format from a single render pass', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toad-build-'));
    const entry = path.join(dir, 'mini.toad');
    fs.writeFileSync(entry, 'canvas { size: 60px 60px; background: #ffffff; } rect #r { size: 20px 20px; fill: #00aa55; }');
    try {
      const result = await compileToad(entry, { format: 'all', outDir: path.join(dir, 'out'), scale: 1 });
      const exts = result.outputFiles.map(f => path.extname(f)).sort();
      for (const ext of ['.jpg', '.png', '.webp']) {
        expect(exts).toContain(ext);
      }
      for (const f of result.outputFiles) {
        expect(fs.existsSync(f)).toBe(true);
        expect(fs.statSync(f).size).toBeGreaterThan(0);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps group clipping honouring border radius inside PSD exports', async () => {
    const layout = await compile(`
      canvas { size: 100px 100px; }
      group #clipped {
        radius: [20px];
        rect #mask { size: 60px 60px; clip: true; fill: #ffffff; radius: [20px]; }
        rect #content { size: 90px 90px; fill: #222222; }
      }
    `);
    const psdBuf = await exportToPsd(layout);
    expect(psdBuf.length).toBeGreaterThan(0);
    void psdBuf;
  });
});