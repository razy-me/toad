import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { renderToBuffer } from '../src/engine/canvasRenderer.js';
import { compileToad } from '../src/build.js';
import { formatToad } from '../src/tools/formatter.js';
import { lintDocument } from '../src/tools/linter.js';
import { Lexer } from '../src/parser/lexer.js';
import { Parser } from '../src/parser/parser.js';

async function layout(src: string, name = 'test.toad') {
  const doc = parseToad(src, name);
  const resolved = await resolveImportsAndComponents(doc, name);
  return solveLayout(resolved);
}

function findNode(layout: any, id: string) {
  return layout.nodes.find((n: any) => n.id === id);
}

describe('Fix campaign regressions', () => {
  it('1. previous anchor resolves to preceding sibling (top level and chained)', async () => {
    const l = await layout(`
      canvas { size: 400px 200px; fill: #fff; }
      rect #a { at: 20px 20px; size: 50px 50px; fill: #f00; }
      rect #b { at: right of previous; size: 50px 50px; fill: #00f; }
      text #c { at: below previous; text: "x"; font-size: 10px; fill: #000; }
    `);
    expect(findNode(l, 'b').x).toBe(70);
    expect(findNode(l, 'b').y).toBe(20);
    expect(findNode(l, 'c').x).toBe(70);
    expect(findNode(l, 'c').y).toBe(70);
    expect(l.warnings.filter((w: string) => w.includes('previous'))).toHaveLength(0);
  });

  it('2. wrapped text honors size Wpx auto height (no zero-height overlap)', async () => {
    const l = await layout(`
      canvas { size: 400px 400px; fill: #fff; }
      text #t { at: 10px 10px; size: 120px auto; text: "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor"; font-size: 16px; fill: #000; }
      rect #r { at: below previous; size: 40px 40px; fill: #0f0; }
    `);
    const t = findNode(l, 't');
    expect(t.height).toBeGreaterThan(16);
    expect(findNode(l, 'r').y).toBeGreaterThanOrEqual(t.y + t.height - 0.5);
  });

  it('3. positioned container keeps its centered origin; children anchor inside', async () => {
    const l = await layout(`
      canvas { size: 800px 600px; }
      group #g { at: center;
        rect #card { size: 240px 240px; fill: #fff; }
        icon #ic { iconName: 'check'; size: 80px 80px; at: center; }
      }
    `);
    const g = findNode(l, 'g');
    expect(g.x).toBe(280);
    expect(g.y).toBe(180);
    expect(g.width).toBe(240);
    const card = findNode(l, 'card');
    expect([card.x, card.y]).toEqual([280, 180]);
    const ic = findNode(l, 'ic');
    expect(ic.x).toBe(360);
    expect(ic.y).toBe(260);
  });

  it('4. nested element without at anchors to container origin', async () => {
    const l = await layout(`
      canvas { size: 500px 500px; }
      group #g { at: 100px 100px;
        rect #inner { size: 60px 60px; fill: #000; }
      }
    `);
    const inner = findNode(l, 'inner');
    expect([inner.x, inner.y]).toEqual([100, 100]);
  });

  it('5. hsla accepts percentage alpha', async () => {
    const { parseColorToRgba } = await import('../src/engine/drawUtils.js');
    const c = parseColorToRgba('hsla(200, 50%, 50%, 50%)');
    expect(c.a).toBeCloseTo(0.5, 5);
  });

  it('6. drop-shadow filter actually renders (pixel-different from plain)', async () => {
    const plain = 'canvas { size: 200px 200px; fill: #ffffff; } rect #a { at: 50px 50px; size: 80px 80px; fill: #3b82f6; }';
    const shadowed = 'canvas { size: 200px 200px; fill: #ffffff; } rect #a { at: 50px 50px; size: 80px 80px; fill: #3b82f6; filter: drop-shadow(10px 10px 8px rgba(0,0,0,0.9)); }';
    const a = await renderToBuffer(await layout(plain), { format: 'png' });
    const b = await renderToBuffer(await layout(shadowed), { format: 'png' });
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it('7. --bleed accepts physical units converted at canvas dpi', async () => {
    const result = await compileToad(process.cwd() + '/tests/fixtures/mobile_mockup.toad', {
      bleed: '3mm',
      outDir: process.cwd() + '/tests/dist/fixcamp-bleed'
    });
    // 3mm at the fixture's canvas dpi (96 unless declared): 3 * dpi / 25.4
    const dpi = result.canvas.dpi || 96;
    expect(result.layout.canvas.bleed).toBeCloseTo(3 * dpi / 25.4, 1);
  }, 30000);

  it('8. unknown --format tokens are warned and skipped', async () => {
    const warns: string[] = [];
    const origWarn = console.warn;
    console.warn = (m: string) => warns.push(m);
    try {
      const result = await compileToad(process.cwd() + '/tests/fixtures/mobile_mockup.toad', {
        format: 'png,bogus',
        outDir: process.cwd() + '/tests/dist/fixcamp-bogus'
      });
      expect(result.outputFiles.some((f: string) => f.endsWith('.png'))).toBe(true);
      expect(result.outputFiles.some((f: string) => f.endsWith('.bogus'))).toBe(false);
    } finally {
      console.warn = origWarn;
    }
    expect(warns.some(w => w.includes("'bogus'"))).toBe(true);
  }, 30000);

  it('9. radial-gradient preamble parses as hints, not bogus stops', async () => {
    const doc = parseToad("rect { size: 100px 100px; fill: radial-gradient(circle at center, #ff0000, #0000ff); }", 'r.toad');
    const prop = doc.elements[0].properties.find((p: any) => p.name === 'fill');
    const json = JSON.stringify(prop.value);
    expect(json).not.toContain('"at"');
  });

  it('10. formatter preserves block-comment interiors and escaped quotes', () => {
    const src = [
      '/**',
      ' * Design tokens : version 2 ;',
      ' */',
      'rect #a {',
      '  label: "quote \\\\" stays ";',
      '  size : 10px 20px ;',
      '}'
    ].join('\n');
    const out = formatToad(src);
    expect(out).toContain('* Design tokens : version 2 ;');
    expect(out).toContain('size: 10px 20px;');
  });

  it('11. grid percentage heights resolve against one row', async () => {
    const l = await layout(`
      canvas { size: 400px 400px; }
      grid #g { at: 0px 0px; size: 400px 400px; columns: 2;
        rect #c1 { fill: #f00; }
        rect #c2 { fill: #0f0; }
        rect #c3 { fill: #00f; }
        rect #c4 { fill: #ff0; }
      }
    `);
    const c1 = findNode(l, 'c1');
    expect(c1.width).toBe(200);
    expect(c1.height).toBe(200);
  });

  it('12. multi-canvas pages are independent', async () => {
    const l = await layout(`
      canvas "Front" { size: 100px 100px; rect #frontOnly { at: 10px 10px; size: 20px 20px; } }
      canvas "Back" { size: 100px 100px; }
    `);
    expect(l.canvases).toHaveLength(2);
    expect(l.canvases[1].nodes).toHaveLength(0);
    expect(l.canvases[1].warnings.join(' ')).toContain('renders empty');
  });

  it('13. linter flags unknown units (LINT-UNKNOWN-UNIT)', async () => {
    const src = 'canvas { size: 100px 100px; } rect { size: 200xp 50px; }';
    const parser = new Parser(new Lexer(src, 'u.toad').tokenize(), 'u.toad');
    const ast = parser.parse();
    const diags = lintDocument(ast);
    expect(diags.some(d => d.code === 'LINT-UNKNOWN-UNIT')).toBe(true);
  });

  it('14. em/rem convert at 16px root size', async () => {
    const l = await layout(`
      canvas { size: 400px 400px; }
      rect #e { at: 0px 0px; size: 2em 1rem; fill: #000; }
    `);
    const e = findNode(l, 'e');
    expect(e.width).toBe(32);
    expect(e.height).toBe(16);
  });

  it('15. duplicate ids warn; last definition wins', async () => {
    const l = await layout(`
      canvas { size: 100px 100px; }
      rect #dup { size: 10px 10px; fill: #000; }
      rect #dup { size: 20px 20px; fill: #111; }
    `);
    expect(l.warnings.some((w: string) => w.includes('Duplicate element id'))).toBe(true);
  });

  it('16. vw/vh resolve against available space', async () => {
    const l = await layout(`
      canvas { size: 800px 600px; }
      rect #v { size: 50vw 25vh; fill: #000; }
    `);
    const v = findNode(l, 'v');
    expect(v.width).toBe(400);
    expect(v.height).toBe(150);
  });
});
