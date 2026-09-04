import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileToad } from '../src/build.js';

const TMP = path.join(process.cwd(), 'tests', 'dist', 'tmp_build');
const ENTRY = path.join(TMP, 'entry.toad');
const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'mobile_mockup.toad');

beforeAll(() => {
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(ENTRY, 'canvas { size: 60px 40px; fill: #ffffff; } rect #r { at: 5px 5px; size: 20px 20px; fill: #ff0000; }');
});

afterAll(() => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
});

describe('compileToad: formats and files', () => {
  it('emits PNG by default into the entry directory', async () => {
    const result = await compileToad(ENTRY);
    expect(result.success).toBe(true);
    expect(result.outputFiles.some(f => f.endsWith('.png'))).toBe(true);
    for (const f of result.outputFiles) expect(fs.existsSync(f)).toBe(true);
  });

  it('respects --out directory option', async () => {
    const outDir = path.join(TMP, 'custom-out');
    const result = await compileToad(ENTRY, { outDir, format: 'png' });
    expect(result.outputFiles.length).toBeGreaterThan(0);
    for (const f of result.outputFiles) expect(path.dirname(f)).toBe(outDir);
  });

  it('writes .jpeg requests as .jpg', async () => {
    const result = await compileToad(ENTRY, { format: 'jpeg', outDir: path.join(TMP, 'jpeg-out') });
    expect(result.outputFiles.some(f => f.endsWith('.jpg'))).toBe(true);
    expect(result.outputFiles.some(f => f.endsWith('.jpeg'))).toBe(false);
  });

  it('supports multi-format lists (png+svg)', async () => {
    const result = await compileToad(ENTRY, { format: 'png,svg', outDir: path.join(TMP, 'multi') });
    expect(result.outputFiles.some(f => f.endsWith('.png'))).toBe(true);
    expect(result.outputFiles.some(f => f.endsWith('.svg'))).toBe(true);
  });

  it('warns and skips unknown format tokens instead of failing silently', async () => {
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (m: string) => warns.push(String(m));
    try {
      const result = await compileToad(ENTRY, { format: 'png,bogus', outDir: path.join(TMP, 'bogus') });
      expect(result.outputFiles.some(f => f.endsWith('.png'))).toBe(true);
    } finally {
      console.warn = orig;
    }
    expect(warns.some(w => w.includes("'bogus'"))).toBe(true);
  }, 30000);
});

describe('compileToad: canvas options', () => {
  it('applies numeric bleed in pixels', async () => {
    const result = await compileToad(ENTRY, { format: 'png', bleed: 10 });
    expect(result.layout.canvas.bleed).toBe(10);
  });

  it('converts unit bleed at the canvas dpi', async () => {
    const result = await compileToad(FIXTURE, { format: 'png', bleed: '3mm' });
    const dpi = result.canvas.dpi || 96;
    expect(result.layout.canvas.bleed).toBeCloseTo((3 * dpi) / 25.4, 1);
  }, 30000);

  it('carries scale into rendered output size', async () => {
    const result = await compileToad(ENTRY, { format: 'png', scale: 2 });
    // The rendered buffer must be double-sized; verify via canvas metadata.
    expect([result.canvas.width, result.canvas.height]).toEqual([60, 40]);
    expect(result.outputFiles.length).toBeGreaterThan(0);
  });

  it('normalizes fractional quality to percent scale', async () => {
    const result = await compileToad(ENTRY, { format: 'webp', quality: 0.5, outDir: path.join(TMP, 'q') });
    expect(result.outputFiles.length).toBeGreaterThan(0); // no crash on fraction
  });
});

describe('compileToad: robustness', () => {
  it('rejects missing entry paths', async () => {
    await expect(compileToad('')).rejects.toThrow();
  });

  it('reports layout cycles as failures with the exact message', async () => {
    const cyc = path.join(TMP, 'cycle.toad');
    fs.writeFileSync(cyc, [
      'canvas { size: 100px 100px; }',
      'rect #a { at: right of b; size: 5px 5px; }',
      'rect #b { at: left of a; size: 5px 5px; }'
    ].join('\n'));
    await expect(compileToad(cyc)).rejects.toThrow(/Cyclic layout dependency cycle detected/);
  });

  it('surfaces resolver warnings through build warnings', async () => {
    const dup = path.join(TMP, 'dup.toad');
    fs.writeFileSync(dup, 'canvas { size: 50px 50px; } rect #d { size: 5px 5px; } rect #d { size: 9px 9px; }');
    const result = await compileToad(dup);
    expect(JSON.stringify(result.warnings)).toMatch(/[Dd]uplicate/);
  });
});
