import { describe, it, expect } from 'vitest';
import { readPsd } from 'ag-psd';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { exportToPsd, cssGradientAngleToPhotoshop } from '../src/engine/psdExporter.js';

async function psdOf(src: string, opts: any = {}) {
  const l = await solveLayout(await resolveImportsAndComponents(parseToad(src, 'p.toad'), 'p.toad'));
  return readPsd(await exportToPsd(l, opts));
}

const CANVAS = 'canvas { size: 200px 100px; background: #ffffff; }';

function flatten(layers: any[], depth = 0): any[] {
  const out: any[] = [];
  for (const l of layers || []) {
    out.push({ ...l, _depth: depth });
    if (l.children) out.push(...flatten(l.children, depth + 1));
  }
  return out;
}

describe('PSD exporter: document structure', () => {
  it('writes RGB color mode (3) and exact canvas dimensions', async () => {
    const psd = await psdOf(`${CANVAS} rect #r { at: 10px 10px; size: 30px 30px; fill: #f00; }`);
    expect(psd.colorMode).toBe(3); // 3 == RGB
    expect(psd.width).toBe(200);
    expect(psd.height).toBe(100);
  });

  it('scales canvas dimensions with the scale option', async () => {
    const psd = await psdOf(CANVAS, { scale: 2 });
    expect(psd.width).toBe(400);
    expect(psd.height).toBe(200);
  });

  it('creates one layer per element plus a background layer', async () => {
    const psd = await psdOf(`
      ${CANVAS}
      rect #a { at: 5px 5px; size: 20px 20px; fill: #f00; }
      circle #b { at: 40px 5px; size: 20px 20px; fill: #0f0; }
      star #c { at: 70px 5px; size: 24px 24px; fill: #00f; }
    `);
    const names = (psd.children || []).map((c: any) => c.name);
    expect(names).toContain('a');
    expect(names).toContain('b');
    expect(names).toContain('c');
  });

  it('preserves group hierarchy', async () => {
    const psd = await psdOf(`
      ${CANVAS}
      group #grp { at: 0px 0px;
        rect #inner1 { at: 5px 5px; size: 20px 20px; fill: #f00; }
        rect #inner2 { at: 35px 5px; size: 20px 20px; fill: #0f0; }
      }
    `);
    const grp = (psd.children || []).find((c: any) => c.name === 'grp');
    expect(grp).toBeDefined();
    expect(grp.children.map((c: any) => c.name).sort()).toEqual(['inner1', 'inner2']);
  });
});

describe('PSD exporter: vector masks and strokes', () => {
  it('gives native shapes a vector mask', async () => {
    const psd = await psdOf(`
      ${CANVAS}
      rect #rectEl { at: 4px 4px; size: 20px 20px; fill: #f00; }
      circle #circEl { at: 34px 4px; size: 20px 20px; fill: #0f0; }
      star #starEl { at: 64px 4px; size: 24px 24px; fill: #00f; }
      triangle #triEl { at: 100px 4px; size: 24px 24px; fill: #ff0; }
      arrow #arrEl { at: 134px 4px; size: 24px 24px; fill: #f0f; }
      cross #crossEl { at: 168px 4px; size: 24px 24px; fill: #0ff; }
    `);
    const flat = flatten(psd.children || []);
    for (const name of ['rectEl', 'circEl', 'starEl', 'triEl', 'arrEl', 'crossEl']) {
      const layer = flat.find((l: any) => l.name === name);
      expect(layer, name).toBeDefined();
      expect(layer.vectorMask, `${name} vectorMask`).toBeDefined();
    }
  });

  it('maps element stroke to vectorStroke data', async () => {
    const psd = await psdOf(`${CANVAS} rect #stroked { at: 8px 8px; size: 30px 30px; fill: #fff; stroke: #000000 4px; }`);
    const layer = flatten(psd.children || []).find((l: any) => l.name === 'stroked');
    expect(layer).toBeDefined();
    expect(layer.vectorStroke).toBeDefined();
  });

  it('maps layer-stroke property to an FrFX stroke effect', async () => {
    const psd = await psdOf(`${CANVAS} circle #fx { at: 8px 8px; size: 30px 30px; fill: #fff; layer-stroke: 3px #ff00ff; }`);
    const layer = flatten(psd.children || []).find((l: any) => l.name === 'fx');
    expect(layer).toBeDefined();
    const effects: any = layer.effects || {};
    // ag-psd represents FrFX as an enabled stroke effect entry.
    expect(Array.isArray(effects.stroke) ? effects.stroke.some((s: any) => s.enabled) : !!effects.stroke)
      .toBe(true);
  });
});

describe('PSD exporter: text layers', () => {
  it('creates a text layer with the exact string content', async () => {
    const psd = await psdOf(`${CANVAS} text #lbl { at: 10px 60px; text: "Hello PSD"; font-size: 14px; font-family: "Arial"; color: #000000; }`);
    // Text layers are named after their CONTENT (Photoshop convention).
    const lbl = flatten(psd.children || []).find((l: any) => l.text && l.text.text === 'Hello PSD');
    expect(lbl).toBeDefined();
    expect(lbl.text.text).toBe('Hello PSD');
  });

  it('keeps letter-spacing as tracking in the text style', async () => {
    const psd = await psdOf(`${CANVAS} text #tracked { at: 10px 60px; text: "spaced"; font-size: 14px; letter-spacing: 1.4px; color: #000; font-family: "Arial"; }`);
    const tracked = flatten(psd.children || []).find((l: any) => l.text && l.text.text === 'spaced');
    expect(tracked).toBeDefined();
    // tracking is stored in 1/1000 em: 1.4px / 14px * 1000 = 100
    expect(tracked.text.style.tracking).toBe(100);
  });
});

describe('PSD exporter: misc', () => {
  it('defaults every layer to normal blend mode', async () => {
    const psd = await psdOf(`${CANVAS} rect #plain { at: 5px 5px; size: 20px 20px; fill: #f00; }`);
    for (const l of psd.children || []) {
      expect(['normal', undefined]).toContain(l.blendMode);
    }
  });

  it('applies non-normal blend modes when requested', async () => {
    const psd = await psdOf(`${CANVAS} rect #mult { at: 5px 5px; size: 40px 40px; fill: #f00; blend-mode: multiply; }`);
    const mult = (psd.children || []).find((c: any) => c.name === 'mult');
    expect(mult.blendMode?.toLowerCase()).toBe('multiply');
  });

  it('converts CSS gradient angles to Photoshop coordinates exactly', () => {
    // Verified mapping: PSD = (90 - CSS + 360) mod 360.
    expect(cssGradientAngleToPhotoshop(0)).toBe(90);
    expect(cssGradientAngleToPhotoshop(90)).toBe(0);
    expect(cssGradientAngleToPhotoshop(180)).toBe(270);
    expect(cssGradientAngleToPhotoshop(270)).toBe(180);
  });

  it('never crashes on empty documents', async () => {
    const psd = await psdOf('canvas { size: 50px 50px; }');
    expect(psd.width).toBe(50);
  });
});
