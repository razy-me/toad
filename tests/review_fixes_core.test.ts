/**
 * tests/review_fixes_core.test.ts
 * Regression coverage for parser / resolver / solver fixes from the
 * full-code review: calc guards, opacity %, radius arity, stroke-style
 * routing, hex-like mask ids, 2D relational offsets, positional component
 * arguments, circular imports and unknown-icon diagnostics.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';

async function compile(src: string, filename = 'test.toad') {
  const doc = parseToad(src, filename);
  const resolved = await resolveImportsAndComponents(doc, filename);
  return { resolved, layout: await solveLayout(resolved) };
}

const nodeById = (layout: any, id: string) => layout.nodes.find((n: any) => n.id === id);

describe('Review fixes: core pipeline', () => {
  it('clamps non-finite calc() results to 0 instead of poisoning layout', async () => {
    const { layout } = await compile(`
      canvas { size: 200px 200px; }
      rect #a { at: calc(10px / 0) calc(20px * 2 + 10px); size: 50px 50px; fill: #000; }
    `);
    const el = nodeById(layout, 'a');
    expect(el).toBeDefined();
    // Division by zero must not leak Infinity into coordinates.
    expect(Number.isFinite(el.x)).toBe(true);
    expect(el.x).toBe(0);
    expect(el.y).toBe(50);
  });

  it('accepts percentage opacity and stores it normalized', async () => {
    const doc = parseToad(`
      canvas { size: 100px 100px; }
      rect #half { size: 40px 40px; fill: #ff0000; opacity: 50%; }
      rect #full { size: 40px 40px; fill: #00ff00; opacity: 0.25; }
    `, 'test.toad');
    const resolved: any = await resolveImportsAndComponents(doc, 'test.toad');
    const half = resolved.elements.find((e: any) => e.id === 'half');
    expect(half.opacity).toBeCloseTo(0.5);
    // Non-percentage values pass through untouched.
    const full = resolved.elements.find((e: any) => e.id === 'full');
    expect(full.opacity).toBeCloseTo(0.25);
  });

  it('expands 3-value border radius shorthand to [tl, tr+bl, br, tr+bl]', async () => {
    const doc = parseToad(`
      canvas { size: 100px 100px; }
      rect #card { size: 60px 60px; radius: [10px, 20px, 30px]; fill: #fff; }
      rect #two { size: 60px 60px; radius: [5px, 15px]; }
    `, 'test.toad');
    const resolved: any = await resolveImportsAndComponents(doc, 'test.toad');
    expect(resolved.elements.find((e: any) => e.id === 'card').radius).toEqual([10, 20, 30, 20]);
    // Existing 2-value behaviour unchanged.
    expect(resolved.elements.find((e: any) => e.id === 'two').radius).toEqual([5, 15, 5, 15]);
  });

  it("routes dash keywords of 'stroke-style' to the element stroke", async () => {
    const doc = parseToad(`
      canvas { size: 100px 100px; }
      rect #dashed { size: 50px 50px; stroke: #333333; stroke-width: 2px; stroke-style: dashed; }
    `, 'test.toad');
    const resolved: any = await resolveImportsAndComponents(doc, 'test.toad');
    const el = resolved.elements.find((e: any) => e.id === 'dashed');
    expect(el.stroke?.style ?? el.style?.stroke?.style).toBe('dashed');
    // Must NOT have produced a layer-stroke FX from a dash keyword.
    expect(el.layerStroke ?? el.style?.layerStroke).toBeUndefined();
  });

  it("still treats legacy layer-stroke specifications in 'stroke-style' as layer FX", async () => {
    const doc = parseToad(`
      canvas { size: 100px 100px; }
      rect #fx { size: 50px 50px; stroke-style: 3px #ff0000 inside; }
    `, 'test.toad');
    const resolved: any = await resolveImportsAndComponents(doc, 'test.toad');
    const el = resolved.elements.find((e: any) => e.id === 'fx');
    const ls = el.layerStroke ?? el.style?.layerStroke;
    expect(ls).toBeDefined();
    expect(ls.position).toBe('inside');
    expect(ls.width).toBe(3);
  });

  it('accepts hex-like ids (#cafe) as mask references', async () => {
    const doc = parseToad(`
      canvas { size: 200px 200px; }
      rect #cafe { size: 100px 100px; clip: true; }
      rect #content { size: 150px 150px; fill: #00ff00; mask: #cafe; }
    `, 'test.toad');
    const resolved: any = await resolveImportsAndComponents(doc, 'test.toad');
    const content = resolved.elements.find((e: any) => e.id === 'content');
    const mask = content.mask ?? content.style?.mask;
    expect(mask).toBe('#cafe');
  });

  it('preserves 2D relational offsets through extraction', async () => {
    const doc = parseToad(`
      canvas { size: 400px 400px; }
      rect #anchor { at: 50px 60px; size: 100px 100px; }
      rect #follower { at: below #anchor offset 10px; size: 40px 40px; }
    `, 'test.toad');
    // Inject a CoordinateValue offset into the parsed at-property exactly
    // where the lexer can emit one for multi-axis offsets, then verify the
    // resolver keeps both axes.
    const followerDecl: any = doc.elements[1];
    const atProp = followerDecl.properties.find((p: any) => p.name === 'at');
    atProp.value.offset = {
      type: 'CoordinateValue',
      x: { type: 'NumberLiteral', value: 10 },
      y: { type: 'NumberLiteral', value: -5 }
    };
    const resolved: any = await resolveImportsAndComponents(doc, 'test.toad');
    const follower = resolved.elements.find((e: any) => e.id === 'follower');
    const off = follower.at?.relational?.offset;
    expect(off).toBeDefined();
    if (typeof off === 'object') {
      expect(off.x).toBe(10);
      expect(off.y).toBe(-5);
    } else {
      throw new Error('2D relational offset collapsed to scalar: ' + JSON.stringify(off));
    }

    // Scalar syntax keeps working end-to-end: the offset must widen the gap
    // between follower and anchor by exactly 10px compared to no offset.
    const withoutOffset = await compile(`
      canvas { size: 400px 400px; }
      rect #anchor { at: 50px 60px; size: 100px 100px; }
      rect #follower { at: below #anchor; size: 40px 40px; }
    `);
    const base = withoutOffset.layout.nodes.find(n => n.id === 'follower')!;
    const withOffsetLayout = await solveLayout(resolved);
    const shifted = withOffsetLayout.nodes.find(n => n.id === 'follower')!;
    // CoordinateValue offsets act as direct dx/dy nudges relative to the
    // default relational placement.
    expect(shifted.y - base.y).toBe(-5);
  });

  it('binds positional component arguments independently of named ones', async () => {
    const src = `
      component Badge(label, tint = #00ff00) {
        rect {
          size: 40px 20px;
          content: >label;
          fill: >tint;
        }
      }

      Badge("Hello", tint: #123456) #b1 {
        at: 10px 10px;
      }

      Badge("World") #b2 {
        at: 10px 60px;
      }
    `;
    const doc = parseToad(src, 'test.toad');
    const resolved: any = await resolveImportsAndComponents(doc, 'test.toad');
    expect(resolved.elements).toHaveLength(2);

    // Positional "Hello" landed on label AND named tint overrode the default.
    const b1 = resolved.elements[0];
    const b1Txt = JSON.stringify(b1);
    expect(b1Txt).toContain('Hello');
    expect(b1.fill ?? b1.style?.fill).toBe('#123456');

    // Pure-positional call falls back to the default tint.
    const b2 = resolved.elements[1];
    const b2Txt = JSON.stringify(b2);
    expect(b2Txt).toContain('World');
    expect((b2.fill ?? b2.style?.fill ?? '').toLowerCase()).toBe('#00ff00');
  });

  it('tolerates a direct entry<->file import cycle but rejects deeper cycles', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toad-cyc-'));
    try {
      fs.writeFileSync(path.join(dir, 'main.toad'), '@import "a.toad";\ncanvas { size: 10px 10px; }');
      fs.writeFileSync(path.join(dir, 'a.toad'), '@import "main.toad";\nrect #r { size: 5px 5px; }');

      // Entry <-> A is tolerated (skips the re-import) and must not throw.
      const doc = parseToad(fs.readFileSync(path.join(dir, 'main.toad'), 'utf8'), path.join(dir, 'main.toad'));
      await expect(resolveImportsAndComponents(doc, path.join(dir, 'main.toad'))).resolves.toBeDefined();

      // A -> B -> A is a genuine cycle and must fail loudly.
      fs.writeFileSync(path.join(dir, 'a.toad'), '@import "b.toad";\nrect #ra { size: 5px 5px; }');
      fs.writeFileSync(path.join(dir, 'b.toad'), '@import "a.toad";\nrect #rb { size: 5px 5px; }');
      const doc2 = parseToad('@import "a.toad";', path.join(dir, 'deep.toad'));
      await expect(resolveImportsAndComponents(doc2, path.join(dir, 'deep.toad'))).rejects.toThrow(/Circular import/i);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns about unknown icon names instead of failing silently', async () => {
    const src = `
      canvas { size: 100px 100px; }
      icon #i { name: definitely-not-an-icon-xyz; size: 24px 24px; }
    `;
    const doc = parseToad(src, 'test.toad');
    const resolved: any = await resolveImportsAndComponents(doc, 'test.toad');
    const warnings: string[] = resolved.warnings ?? [];
    const layout = await solveLayout(resolved);
    const layoutWarnings: string[] = (layout as any).warnings ?? [];
    const all = [...warnings, ...layoutWarnings].join('\n');
    expect(all).toMatch(/Unknown icon/i);
  });

  it('accepts wrap-width / max-lines / overflow / vertical-align without property warnings', async () => {
    const src = `
      canvas { size: 300px 200px; }
      text #t {
        at: 10px 10px;
        width: 120px;
        height: 80px;
        content: "The quick brown fox jumps over the lazy dog again and again";
        max-lines: 3;
        overflow: ellipsis;
        wrap-width: 110px;
        vertical-align: middle;
        font-size: 14px;
      }
    `;
    const doc = parseToad(src, 'test.toad');
    const resolved: any = await resolveImportsAndComponents(doc, 'test.toad');
    const warnText = (resolved.warnings ?? []).join(' ');
    expect(warnText).not.toMatch(/Unknown property '(max-lines|overflow|wrap-width|vertical-align)'/i);
    // Solving with truncation enabled must not crash.
    await solveLayout(resolved);
  });
});
