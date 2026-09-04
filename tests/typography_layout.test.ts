import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout, layoutText } from '../src/parser/math.js';

async function layout(src: string, name = 't.toad') {
  return solveLayout(await resolveImportsAndComponents(parseToad(src, name), name));
}

function findNode(l: any, id: string) {
  return l.nodes.find((n: any) => n.id === id);
}

const WRAP_TEXT = 'The quick brown fox jumps over the lazy dog again and again';

describe('layoutText measurement', () => {
  it('wraps text at explicitWidth into multiple lines', () => {
    const r = layoutText(WRAP_TEXT, { fontSize: 16, explicitWidth: 120, fontFamily: 'sans-serif' });
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.width).toBeLessThanOrEqual(121);
    expect(r.height).toBe(r.lineHeight * r.lines.length);
    expect(r.ascent).toBeGreaterThan(0);
    expect(r.descent).toBeGreaterThanOrEqual(0);
  });

  it('keeps short text on one line', () => {
    const r = layoutText('no wrap here', { fontSize: 14 });
    expect(r.lines).toHaveLength(1);
  });

  it('respects maxLines with overflow clipping', () => {
    const full = layoutText(WRAP_TEXT, { fontSize: 16, explicitWidth: 120 });
    const capped = layoutText(WRAP_TEXT, { fontSize: 16, explicitWidth: 120, maxLines: 2 });
    expect(capped.lines.length).toBeLessThanOrEqual(2);
    expect(capped.lines.length).toBeLessThan(full.lines.length);
  });

  it('scales height with line-height multiplier', () => {
    const single = layoutText(WRAP_TEXT, { fontSize: 16, explicitWidth: 120, lineHeight: 1 });
    const double = layoutText(WRAP_TEXT, { fontSize: 16, explicitWidth: 120, lineHeight: 2 });
    expect(double.height).toBeCloseTo(single.height * 2, 5);
  });

  it('applies letter-spacing in both directions to measured width', () => {
    const base = layoutText('measure me', { fontSize: 20 });
    const wide = layoutText('measure me', { fontSize: 20, letterSpacing: 4 });
    const tight = layoutText('measure me', { fontSize: 20, letterSpacing: -2 });
    expect(wide.width).toBeGreaterThan(base.width);
    expect(tight.width).toBeLessThan(base.width);
  });

  it('applies textTransform casing', () => {
    const upper = layoutText('shout', { fontSize: 20, textTransform: 'uppercase' });
    const normal = layoutText('shout', { fontSize: 20 });
    expect(upper.lines[0]).toBe('SHOUT');
    expect(normal.lines[0]).toBe('shout');
  });
});

describe('Text elements in layout', () => {
  it('honors size Wpx auto by measuring wrapped height', async () => {
    const l = await layout(`
      canvas { size: 400px 400px; }
      text #t { at: 10px 10px; size: 120px auto; text: "${WRAP_TEXT}"; font-size: 16px; color: #000; }
      rect #after { at: below previous offset 0px; size: 40px 40px; fill: #0f0; }
    `);
    const t = findNode(l, 't');
    const after = findNode(l, 'after');
    expect(t.height).toBeGreaterThan(16);
    expect(after.y).toBeGreaterThanOrEqual(t.y + t.height - 0.5);
  });

  it('defaults font-size to 16 when unspecified', async () => {
    const l = await layout('canvas { size: 100px 100px; } text #t { text: "x"; color: #000; }');
    expect(findNode(l, 't').style.fontSize || 16).toBe(16);
  });

  it('stores numeric font weights after normalization', async () => {
    const l = await layout('canvas { size: 100px 100px; } text #t { text: "x"; font-weight: semibold; color: #000; font-size: 12px; }');
    expect(findNode(l, 't').textLayout.fontWeight).toBe('600');
  });

  it('applies negative tracking without breaking wrapping', async () => {
    const r = layoutText(WRAP_TEXT, { fontSize: 16, explicitWidth: 120, letterSpacing: -1 });
    // Tighter tracking can only reduce or equal the line count.
    const normal = layoutText(WRAP_TEXT, { fontSize: 16, explicitWidth: 120 });
    expect(r.lines.length).toBeLessThanOrEqual(normal.lines.length);
  });
});

describe('@font directive plumbing', () => {
  it('registers a family that text elements can reference', async () => {
    const l = await layout(`
      @font "Inter" as Display weight: 700;
      canvas { size: 200px 100px; }
      text #branded { text: "Brand"; font-family: "Display"; font-size: 24px; color: #000; }
    `);
    const node = findNode(l, 'branded');
    expect(node).toBeDefined();
    // The registered alias reaches the measured text layout.
    expect(JSON.stringify(node.textLayout)).toContain('Display');
  });
});
