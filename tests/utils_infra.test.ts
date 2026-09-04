import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { findToadFiles, resolveEntryFile } from '../src/utils/fileFinder.js';
import {
  sanitizeFilterCss,
  splitUnsafeFilterFns,
  normalizeFilterCss,
  estimateFilterPad
} from '../src/engine/imageCache.js';
import {
  parseColorToRgba,
  parseColor,
  cmykToRgb,
  mapBlendMode,
  mapBlendModeToPsd,
  parseFilterString,
  distributeGradientStops,
  applyAlpha,
  lightenColor,
  darkenColor
} from '../src/engine/drawUtils.js';

describe('fileFinder', () => {
  const root = path.join(process.cwd(), 'tests', 'tmp_finder');

  beforeAll(() => {
    fs.mkdirSync(path.join(root, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(root, 'alpha.toad'), 'canvas { size: 1px 1px; }');
    fs.writeFileSync(path.join(root, 'nested', 'gamma.toad'), 'canvas { size: 1px 1px; }');
  });

  afterAll(() => {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  });

  it('resolves an exact relative path directly', async () => {
    const p = await resolveEntryFile(path.join('tests', 'tmp_finder', 'alpha.toad'));
    expect(p).not.toBeNull();
    expect(p!.toLowerCase().endsWith('alpha.toad')).toBe(true);
  });

  it('appends the .toad extension when missing', async () => {
    const p = await resolveEntryFile(path.join('tests', 'tmp_finder', 'alpha'));
    expect(p).not.toBeNull();
    expect(p!.toLowerCase().endsWith('alpha.toad')).toBe(true);
  });

  it('finds files by document name through the tiered search', async () => {
    const hits = await findToadFiles('alpha');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some(h => h.toLowerCase().endsWith('alpha.toad'))).toBe(true);
  });

  it('returns null for hopeless queries instead of throwing', async () => {
    const p = await resolveEntryFile('definitely-does-not-exist-anywhere-xyz');
    expect(p).toBeNull();
  });
});

describe('Filter CSS sanitizers (Skia abort guards)', () => {
  it('sanitizeFilterCss passes well-formed chains through', () => {
    expect(sanitizeFilterCss('blur(4px) saturate(1.2)')).toBe('blur(4px) saturate(1.2)');
  });

  it('sanitizeFilterCss rejects unknown function names', () => {
    expect(sanitizeFilterCss('frobnicate(3px)')).toBe('none');
  });

  it('sanitizeFilterCss rejects empty-argument functions', () => {
    expect(sanitizeFilterCss('blur()')).toBe('none');
    expect(sanitizeFilterCss('blur() opacity(50%)')).toBe('none');
  });

  it('sanitizeFilterCss rejects garbage and none-passthrough', () => {
    expect(sanitizeFilterCss('total garbage')).toBe('none');
    expect(sanitizeFilterCss('none')).toBe('none');
    expect(sanitizeFilterCss(undefined)).toBe('none');
  });

  it('splitUnsafeFilterFns extracts drop-shadow with intact rgba color', () => {
    const r = splitUnsafeFilterFns('drop-shadow(10px 10px 8px rgba(0, 0, 0, 0.9)) blur(4px)');
    expect(r.shadow).toEqual({ offsetX: 10, offsetY: 10, blur: 8, color: 'rgba(0, 0, 0, 0.9)' });
    expect(r.safeCss).toContain('blur(4px)');
    expect(r.safeCss).not.toContain('drop-shadow');
  });

  it('splitUnsafeFilterFns multiplies stacked opacity factors', () => {
    const r = splitUnsafeFilterFns('opacity(50%) opacity(50%)');
    expect(r.opacityFactor).toBeCloseTo(0.25, 5);
    expect(r.safeCss).toBe('none');
  });

  it('splitUnsafeFilterFns drops malformed empty functions from safeCss', () => {
    const r = splitUnsafeFilterFns('blur() saturate(1.5)');
    expect(r.safeCss).toBe('saturate(1.5)');
  });

  it('normalizeFilterCss appends units to unitless filter values', () => {
    expect(normalizeFilterCss('blur(4)')).toBe('blur(4px)');
    expect(normalizeFilterCss('hue-rotate(90)')).toBe('hue-rotate(90deg)');
    // brightness is not in UNIT_FILTERS (unitless is valid), so it stays verbatim.
    expect(normalizeFilterCss('brightness(1.2)')).toBe('brightness(1.2)');
  });

  it('estimateFilterPad grows with blur radius and is clamped', () => {
    expect(estimateFilterPad('blur(0px)')).toBe(8);
    expect(estimateFilterPad('blur(4px)')).toBeGreaterThanOrEqual(12);
    expect(estimateFilterPad('blur(10000px)')).toBeLessThanOrEqual(400);
  });
});

describe('Color utilities', () => {
  it('parseColorToRgba handles hex 3/6/8 digit forms', () => {
    expect(parseColorToRgba('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColorToRgba('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColorToRgba('#ff000080').a).toBeCloseTo(128 / 255, 3);
  });

  it('parseColorToRgba supports rgb/rgba/hsl/hsla including percent alpha', () => {
    expect(parseColorToRgba('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    const hsla = parseColorToRgba('hsla(200, 50%, 50%, 50%)');
    expect(hsla.a).toBeCloseTo(0.5, 3);
    expect(hsla.b).toBeGreaterThan(100); // blue-ish
  });

  it('falls back to black for unparseable colors', () => {
    const c = parseColorToRgba('not-a-color');
    expect([c.r, c.g, c.b]).toEqual([0, 0, 0]);
  });

  it('parseColor exposes hex and rgba serializations', () => {
    const c: any = parseColor('#aabbcc');
    expect(c.hex).toBe('#aabbcc');
    expect(c.rgba).toContain('170');
  });

  it('cmykToRgb converts pure keys correctly', () => {
    const red = cmykToRgb(0, 1, 1, 0);
    expect(red.r).toBe(255);
    expect(red.g).toBe(0);
    const white = cmykToRgb(0, 0, 0, 0);
    expect([white.r, white.g, white.b]).toEqual([255, 255, 255]);
    const black = cmykToRgb(0, 0, 0, 1);
    expect(black.r).toBe(0);
  });

  it('applyAlpha/lighten/darken behave monotonically', () => {
    expect(applyAlpha('#ff0000', 0.5)).toMatch(/0\.5|80/);
    expect(lightenColor('#000000', 50)).not.toBe('#000000');
    expect(darkenColor('#ffffff', 50)).not.toBe('#ffffff');
  });
});

describe('Blend-mode mapping', () => {
  it('maps CSS blend names onto canvas composite operations', () => {
    expect(mapBlendMode('multiply')).toBe('multiply');
    expect(mapBlendMode()).toBe('source-over');
    expect(mapBlendMode('normal')).toBe('source-over');
  });

  it('maps blend names onto Photoshop blend enums', () => {
    expect(String(mapBlendModeToPsd('multiply')).toLowerCase()).toBe('multiply');
    expect(mapBlendModeToPsd('made-up')).toBeDefined();
  });
});

describe('Gradient stop distribution', () => {
  it('assigns implicit 0/1 positions to endpoint stops', () => {
    const stops = distributeGradientStops([
      { color: '#ff0000' },
      { color: '#ffffff' },
      { color: '#0000ff' }
    ] as any);
    expect(stops[0].position).toBe(0);
    expect(stops[stops.length - 1].position).toBe(1);
    // Middle stop lands between the endpoints.
    expect(stops[1].position).toBeGreaterThan(0);
    expect(stops[1].position).toBeLessThan(1);
  });
});

describe('parseFilterString grammar', () => {
  it('parses chains preserving argument grouping', () => {
    const parsed = parseFilterString('blur(4px) drop-shadow(5px 5px 10px #000)');
    expect(parsed.map((p: any) => p.name)).toEqual(['blur', 'drop-shadow']);
    expect(parsed[1].args).toEqual(['5px', '5px', '10px', '#000']);
  });

  it('keeps nested color functions intact inside arguments', () => {
    const parsed = parseFilterString('drop-shadow(1px 2px 3px rgba(0, 0, 0, 0.9))');
    expect(parsed[0].args[3]).toBe('rgba(0, 0, 0, 0.9)');
  });

  it('returns empty for none/empty input', () => {
    expect(parseFilterString('none')).toHaveLength(0);
    expect(parseFilterString('')).toHaveLength(0);
    expect(parseFilterString(undefined)).toHaveLength(0);
  });
});
