import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { renderToBuffer } from '../src/engine/canvasRenderer.js';
import { compileToad } from '../src/build.js';

async function writeTemp(name: string, content: string): Promise<string> {
  const dir = path.join(process.cwd(), 'tests', 'dist', 'rp-tmp');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name + '.toad');
  fs.writeFileSync(p, content);
  return p;
}

async function layout(src: string) {
  return solveLayout(await resolveImportsAndComponents(parseToad(src, 'px.toad'), 'px.toad'));
}

async function png(src: string, opts: any = {}) {
  return renderToBuffer(await layout(src), { format: 'png', ...opts });
}

const CANVAS = 'canvas { size: 200px 200px; fill: #ffffff; }';

describe('Raster rendering: pixel-difference guards', () => {
  it('renders opacity as an actual visual change', async () => {
    const a = await png(`${CANVAS} rect #r { at: 50px 50px; size: 80px 80px; fill: #3b82f6; }`);
    const b = await png(`${CANVAS} rect #r { at: 50px 50px; size: 80px 80px; fill: #3b82f6; opacity: 0.4; }`);
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it('renders blur filters', async () => {
    const a = await png(`${CANVAS} rect #r { at: 60px 60px; size: 60px 60px; fill: #000000; }`);
    const b = await png(`${CANVAS} rect #r { at: 60px 60px; size: 60px 60px; fill: #000000; filter: blur(6px); }`);
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it('renders drop-shadow via the composite pipeline', async () => {
    const a = await png(`${CANVAS} rect #r { at: 40px 40px; size: 80px 80px; fill: #3b82f6; }`);
    const b = await png(`${CANVAS} rect #r { at: 40px 40px; size: 80px 80px; fill: #3b82f6; filter: drop-shadow(10px 10px 8px rgba(0, 0, 0, 0.9)); }`);
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it('renders element shadows', async () => {
    const a = await png(`${CANVAS} rect #r { at: 40px 40px; size: 80px 80px; fill: #ffffff; shadow: 8px 8px 12px #000000ff; }`);
    const plain = await png(`${CANVAS} rect #r { at: 40px 40px; size: 80px 80px; fill: #ffffff; }`);
    expect(Buffer.compare(a, plain)).not.toBe(0);
  });

  it('scales shadow offsets with the -s zoom factor', async () => {
    const one = await png(`${CANVAS} rect #r { at: 40px 40px; size: 80px 80px; fill: #ffffff; shadow: 20px 20px 20px #000000cc; }`, { scale: 1 });
    const two = await png(`${CANVAS} rect #r { at: 40px 40px; size: 80px 80px; fill: #ffffff; shadow: 20px 20px 20px #000000cc; }`, { scale: 2 });
    expect(one.length).toBeGreaterThan(0);
    expect(two.length).toBeGreaterThan(one.length); // bigger canvas => bigger PNG
  });

  it('renders linear gradients and honors direction changes', async () => {
    const vertical = await png(`${CANVAS} rect #r { at: 0px 0px; size: 200px 200px; fill: linear-gradient(#ff0000, #0000ff); }`);
    const angled = await png(`${CANVAS} rect #r { at: 0px 0px; size: 200px 200px; fill: linear-gradient(180deg, #ff0000, #0000ff); }`);
    // Default (no preamble) must equal explicit "to bottom" = 180deg.
    expect(Buffer.compare(vertical, angled)).toBe(0);

    const sideways = await png(`${CANVAS} rect #r { at: 0px 0px; size: 200px 200px; fill: linear-gradient(90deg, #ff0000, #0000ff); }`);
    expect(Buffer.compare(vertical, sideways)).not.toBe(0);
  });

  it('treats radial-gradient CSS preamble as a no-op hint', async () => {
    const bare = await png(`${CANVAS} rect #r { at: 0px 0px; size: 150px 150px; fill: radial-gradient(#ff0000, #0000ff); }`);
    const preambled = await png(`${CANVAS} rect #r { at: 0px 0px; size: 150px 150px; fill: radial-gradient(circle farthest-corner at center, #ff0000, #0000ff); }`);
    expect(Buffer.compare(bare, preambled)).toBe(0);
  });

  it('renders blend modes differently from normal compositing', async () => {
    const base = `${CANVAS} rect #bg { at: 0px 0px; size: 200px 200px; fill: #22c55e; } rect #fg { at: 60px 60px; size: 80px 80px; fill: #ef4444;`;
    const normal = await png(base + ' }');
    const blended = await png(base + ' blend-mode: multiply; }');
    expect(Buffer.compare(normal, blended)).not.toBe(0);
  });

  it('renders icons as vector paths', async () => {
    const withIcon = await png(`${CANVAS} icon #i { iconName: 'check'; size: 64px 64px; at: 68px 68px; stroke: #10b981 4px; fill: transparent; }`);
    const without = await png(CANVAS);
    expect(Buffer.compare(withIcon, without)).not.toBe(0);
  });

  it('clamps border radius larger than half the box safely', async () => {
    const rounded = await png(`${CANVAS} rect #r { at: 70px 70px; size: 60px 60px; radius: 500px; fill: #000; }`);
    expect(rounded.length).toBeGreaterThan(0); // must not throw or crash
  });
});

describe('Raster rendering: robustness', () => {
  it('never crashes on malformed filter strings', async () => {
    const buf = await png(`${CANVAS} rect #r { at: 10px 10px; size: 50px 50px; fill: #f00; filter: blur( }`);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('renders multi-canvas documents page by page', async () => {
    const doc = `canvas "A" { size: 100px 100px; fill: #ff0000; } canvas "B" { size: 100px 100px; fill: #0000ff; }`;
    const l = await layout(doc);
    expect(l.canvases.length).toBe(2);
    // Single-page rendering targets the first canvas.
    const buf = await renderToBuffer(l, { format: 'png' });
    expect(buf.length).toBeGreaterThan(0);
    // Full compilation emits one file per page, and pages differ.
    const result = await compileToad(await writeTemp('pages', doc), { format: 'png', outDir: path.join(process.cwd(), 'tests', 'dist', 'rp-pages') });
    const pngs = result.outputFiles.filter((f) => f.endsWith('.png'));
    expect(pngs.length).toBe(2);
    const [a, b] = pngs.map((f) => fs.readFileSync(f));
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it('applies quality option for lossy formats without crashing', async () => {
    const jpg = await renderToBuffer(await layout(`${CANVAS} rect { at: 10px 10px; size: 50px 50px; fill: #f00; }`), { format: 'jpg', quality: 30 });
    expect(jpg.length).toBeGreaterThan(0);
  });

  it('honors fractional quality normalization', async () => {
    const q = await renderToBuffer(await layout(`${CANVAS}`), { format: 'webp', quality: 0.9 });
    expect(q.length).toBeGreaterThan(0);
  });
});
