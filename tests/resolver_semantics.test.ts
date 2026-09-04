import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseToad } from '../src/parser/parser.js';
import {
  resolveImportsAndComponents,
  convertDimensionToPx,
  CircularImportError,
  CircularVariableError,
  ComponentRecursionLimitError
} from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';

async function layout(src: string, name = 'r.toad') {
  const resolved = await resolveImportsAndComponents(parseToad(src, name), name);
  return solveLayout(resolved);
}

async function resolveDoc(src: string, name = 'r.toad') {
  return resolveImportsAndComponents(parseToad(src, name), name);
}

function findNode(l: any, id: string) {
  return l.nodes.find((n: any) => n.id === id);
}

describe('Unit conversion', () => {
  it('converts physical units at the 96 DPI CSS reference', () => {
    expect(convertDimensionToPx(1, 'in')).toBe(96);
    expect(convertDimensionToPx(1, 'pt')).toBeCloseTo(96 / 72, 5);
    expect(convertDimensionToPx(25.4, 'mm')).toBeCloseTo(96, 5);
    expect(convertDimensionToPx(2.54, 'cm')).toBeCloseTo(96, 5);
    expect(convertDimensionToPx(100)).toBe(100); // unitless passthrough
  });

  it('honors custom DPI for print bleed math', () => {
    expect(convertDimensionToPx(1, 'in', 300)).toBe(300);
    expect(convertDimensionToPx(25.4, 'mm', 300)).toBeCloseTo(300, 5);
  });
});

describe('Variable interpolation and weight normalization', () => {
  it('substitutes >var references in property values', async () => {
    const l = await layout(`
      >brand = #ff0000;
      canvas { size: 100px 100px; }
      rect #a { size: 40px 40px; fill: >brand; }
      rect #b { size: 40px 40px; fill: >brand; at: 50px 0px; }
    `);
    expect(findNode(l, 'a').style.fill).toBe('#ff0000');
    expect(findNode(l, 'b').style.fill).toBe('#ff0000');
  });

  it('normalizes descriptive font weights to numbers', async () => {
    const cases: Array<[string, string]> = [
      ['thin', '100'], ['light', '300'], ['regular', '400'], ['medium', '500'],
      ['semibold', '600'], ['extrabold', '800'], ['black', '900'],
      // 'bold' is preserved verbatim so downstream faux-bold handling can
      // detect it; every other descriptive word becomes its numeric weight.
      ['bold', 'bold']
    ];
    for (const [word, expected] of cases) {
      const l = await layout(`canvas { size: 100px 100px; } text #t { text: "x"; font-size: 12px; font-weight: ${word}; color: #000; }`);
      expect(String(findNode(l, 't').textLayout.fontWeight), word).toBe(expected);
    }
  });
});

describe('Canvas presets and resolution', () => {
  it('resolves named presets to exact dimensions', async () => {
    const og = await layout('canvas { preset: og-image; }');
    expect([og.canvas.width, og.canvas.height]).toEqual([1200, 630]);

    const banner = await layout('canvas { preset: banner; }');
    expect([banner.canvas.width, banner.canvas.height]).toEqual([1920, 1080]);
  });

  it('resolves resolution tokens (fhd / uhd) with a ratio', async () => {
    const fhd = await layout('canvas { resolution: fhd; ratio: 16:9; }');
    expect([fhd.canvas.width, fhd.canvas.height]).toEqual([1920, 1080]);

    const fourK = await layout('canvas { resolution: 4k; ratio: 16:9; }');
    expect(fourK.canvas.width).toBeGreaterThanOrEqual(3000);

    const tokenForm = await layout('canvas { resolution: 1080p; ratio: 16:9; }');
    expect([tokenForm.canvas.width, tokenForm.canvas.height]).toEqual([1920, 1080]);
  });

  it('warns on unknown presets via the resolved document', async () => {
    const resolved = await resolveDoc('canvas { preset: definitely-not-a-preset; size: 200px 200px; }');
    expect(JSON.stringify(resolved.warnings)).toMatch(/Unknown canvas preset/);
    const l = await solveLayout(resolved);
    expect([l.canvas.width, l.canvas.height]).toEqual([200, 200]);
  });

  it('defaults dpi metadata to 96', async () => {
    const l = await layout('canvas { size: 100px 100px; }');
    expect(l.canvas.dpi).toBe(96);
  });

  it('falls back to 16:9 with a warning on invalid ratios', async () => {
    const resolved = await resolveDoc('canvas { size: 500px 500px; ratio: not-a-ratio; }');
    expect(JSON.stringify(resolved.warnings)).toMatch(/Invalid canvas ratio/);
  });
});

describe('Duplicate ids and slots', () => {
  it('warns on duplicate element ids and keeps the last definition', async () => {
    const l = await layout(`
      canvas { size: 100px 100px; }
      rect #dup { size: 10px 10px; fill: #000; }
      rect #dup { size: 30px 30px; fill: #111; }
    `);
    expect(l.warnings.some((w: string) => w.toLowerCase().includes('duplicate'))).toBe(true);
    expect(findNode(l, 'dup').width).toBe(30);
  });

  it('prefixes slot-projected children per component instance', async () => {
    const l = await layout(`
      canvas { size: 400px 100px; }
      component Chip { slot; }
      Chip ("a") { rect #projected { size: 20px 20px; fill: #f00; } }
      Chip ("b") { rect #projected { size: 20px 20px; fill: #0f0; } }
    `);
    const projected = l.nodes.filter((n: any) => n.id && n.id.endsWith('_projected'));
    // Two instances must produce DISTINCT prefixed ids (no collisions).
    expect(projected.length).toBeGreaterThanOrEqual(2);
    expect(new Set(projected.map((n: any) => n.id)).size).toBe(projected.length);
  });
});

describe('Import resolution', () => {
  const tmpRoot = path.join(process.cwd(), 'tests', 'dist', 'tmp_resolver');

  beforeAll(() => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'tokens.toad'), '>accent = #3366ff;');
    fs.writeFileSync(path.join(tmpRoot, 'mid.toad'), '@import "./tokens.toad";');
    fs.writeFileSync(path.join(tmpRoot, 'deep.toad'), '@import "./mid.toad";\nrect #fromDeep { size: 10px 10px; fill: >accent; }');
    // entry <-> A cycle (tolerated): a imports b AND b imports a.
    fs.writeFileSync(path.join(tmpRoot, 'cycle_a.toad'), '@import "./cycle_b.toad";\nrect #aEl { size: 8px 8px; fill: #f00; }');
    fs.writeFileSync(path.join(tmpRoot, 'cycle_b.toad'), '@import "./cycle_a.toad";\nrect #bEl { size: 8px 8px; fill: #0f0; }');
  });

  afterAll(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  it('resolves transitive imports relative to the declaring file', async () => {
    const entry = path.join(tmpRoot, 'deep.toad');
    const doc = parseToad(fs.readFileSync(entry, 'utf8'), entry);
    const resolved = await resolveImportsAndComponents(doc, entry);
    const l = await solveLayout(resolved);
    const node = findNode(l, 'fromDeep');
    expect(node).toBeDefined();
    // >accent came from tokens.toad via mid.toad.
    expect(node.style.fill).toBe('#3366ff');
  });

  it('tolerates direct entry<->file import cycles without throwing CircularImportError', async () => {
    const entry = path.join(tmpRoot, 'cycle_a.toad');
    const doc = parseToad(fs.readFileSync(entry, 'utf8'), entry);
    await expect(resolveImportsAndComponents(doc, entry)).resolves.toBeDefined();
    const resolved = await resolveImportsAndComponents(parseToad(fs.readFileSync(entry, 'utf8'), entry), entry);
    const l = await solveLayout(resolved);
    expect(findNode(l, 'aEl') || findNode(l, 'bEl')).toBeDefined();
  });

  it('keeps imports deterministic across repeated runs', async () => {
    const entry = path.join(tmpRoot, 'deep.toad');
    const snapshot = async () => {
      const r: any = await resolveImportsAndComponents(parseToad(fs.readFileSync(entry, 'utf8'), entry), entry);
      return JSON.stringify({
        keys: Object.keys(r),
        elements: (r.elements || []).map((e: any) => e.id),
        warnings: r.warnings
      });
    };
    expect(await snapshot()).toBe(await snapshot());
  });
});

describe('ImportResolver error classes', () => {
  it('exposes distinct error types for circular imports and variables', () => {
    expect(new CircularImportError('x')).toBeInstanceOf(Error);
    expect(new CircularVariableError('x')).toBeInstanceOf(Error);
    expect(new ComponentRecursionLimitError('x')).toBeInstanceOf(Error);
  });
});
