import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import {
  solveLayout,
  evaluateCalc,
  resolveDimension,
  computeAspectRatio,
  computeGcd
} from '../src/parser/math.js';

async function layout(src: string, name = 'l.toad') {
  return solveLayout(await resolveImportsAndComponents(parseToad(src, name), name));
}

function findNode(l: any, id: string) {
  return l.nodes.find((n: any) => n.id === id);
}

describe('Pure math helpers', () => {
  it('evaluateCalc handles arithmetic with units and percentages', () => {
    expect(evaluateCalc('calc(100px - 2 * 10px)', 400)).toBe(80);
    expect(evaluateCalc('50% + 10px', 200)).toBe(110);
    expect(evaluateCalc('calc(2 * 30px + 5px)', 100)).toBe(65);
  });

  it('resolveDimension covers every unit family', () => {
    expect(resolveDimension('50vw', 800, 0)).toBe(400);
    expect(resolveDimension('25vh', 200, 0)).toBe(50);
    expect(resolveDimension('2em', 0, 0)).toBe(32);
    expect(resolveDimension('1.5rem', 0, 0)).toBe(24);
    expect(resolveDimension('50%', 300, 0)).toBe(150);
    expect(resolveDimension(42, 999, 0)).toBe(42);
    expect(resolveDimension('auto', 100, 55)).toBe(55); // intrinsic passthrough
    expect(resolveDimension(undefined, 100, 7)).toBe(7); // intrinsic fallback
    expect(resolveDimension('fill', 250, 0)).toBe(250);
  });

  it('computes aspect ratios reduced to lowest terms', () => {
    const a = computeAspectRatio(1920, 1080);
    expect(a.ratioString).toBe('16:9');
    expect(a.ratioX).toBe(16);
    expect(computeGcd(1920, 1080)).toBe(120);
  });
});

describe('Layout solver: positioning', () => {
  it('places plain coordinates in canvas space at top level', async () => {
    const l = await layout('canvas { size: 400px 400px; } rect #a { at: 20px 30px; size: 10px 10px; }');
    const a = findNode(l, 'a');
    expect([a.x, a.y]).toEqual([20, 30]);
  });

  it('applies margins to positioned elements', async () => {
    const l = await layout('canvas { size: 400px 400px; } rect #m { at: 20px 20px; size: 50px 50px; margin: 5px 10px; }');
    const m = findNode(l, 'm');
    expect([m.x, m.y]).toEqual([30, 25]);
  });

  it('shrinks fill/%-sized elements by their margins', async () => {
    const l = await layout('canvas { size: 200px 100px; } rect #f { size: fill fill; margin: 10px; }');
    const f = findNode(l, 'f');
    expect(f.width).toBe(180);
    expect(f.height).toBe(80);
  });

  it('resolves percentage sizes against the canvas at top level', async () => {
    const l = await layout('canvas { size: 400px 200px; } rect #p { size: 50% 50%; }');
    const p = findNode(l, 'p');
    expect([p.width, p.height]).toEqual([200, 100]);
  });

  it('warns when an element has no position', async () => {
    const l = await layout('canvas { size: 100px 100px; } rect #orphan { size: 10px 10px; }');
    expect(l.warnings.some((w: string) => w.includes("no 'at:'"))).toBe(true);
    expect([findNode(l, 'orphan').x, findNode(l, 'orphan').y]).toEqual([0, 0]);
  });
});

describe('Layout solver: relational anchors', () => {
  it('supports every directional relation against a declared id', async () => {
    const l = await layout(`
      canvas { size: 800px 800px; }
      rect #base { at: 100px 100px; size: 60px 40px; }
      rect #right { at: right of base; size: 10px 10px; }
      rect #left { at: left of base; size: 10px 10px; }
      rect #above { at: above base; size: 10px 10px; }
      rect #below { at: below base; size: 10px 10px; }
      rect #inside { at: inside base offset 5px; size: 10px 10px; }
    `);
    expect(findNode(l, 'right').x).toBe(160);
    expect(findNode(l, 'left').x).toBe(90);
    expect(findNode(l, 'above').y).toBe(90);
    expect(findNode(l, 'below').y).toBe(140);
    const inside = findNode(l, 'inside');
    expect([inside.x, inside.y]).toEqual([105, 105]);
  });

  it('anchors to the canvas itself', async () => {
    const l = await layout('canvas { size: 300px 200px; } rect #c { at: center of canvas; size: 50px 50px; }');
    const c = findNode(l, 'c');
    expect([c.x, c.y]).toEqual([125, 75]);
  });

  it('applies corner anchors with offsets', async () => {
    const l = await layout(`
      canvas { size: 500px 500px; }
      rect #tl { at: top-left of canvas offset 10px 20px; size: 10px 10px; }
      rect #tr { at: top-right of canvas offset 10px; size: 10px 10px; }
      rect #br { at: bottom-right of canvas offset 10px; size: 10px 10px; }
    `);
    expect([findNode(l, 'tl').x, findNode(l, 'tl').y]).toEqual([10, 20]);
    expect(findNode(l, 'tr').x).toBe(480);
    expect([findNode(l, 'br').x, findNode(l, 'br').y]).toEqual([480, 480]);
  });

  it('chains previous anchors through document order', async () => {
    const l = await layout(`
      canvas { size: 600px 600px; }
      rect #a { at: 20px 20px; size: 50px 50px; }
      circle #b { at: right of previous offset 8px; size: 20px 20px; }
      text #c { at: below previous; text: "t"; font-size: 10px; color: #000; }
    `);
    expect([findNode(l, 'b').x, findNode(l, 'b').y]).toEqual([78, 20]);
    expect(findNode(l, 'c').y).toBeGreaterThan(findNode(l, 'b').y + 19);
  });

  it('warns and defaults to origin when previous has no sibling', async () => {
    const l = await layout('canvas { size: 100px 100px; } rect #first { at: right of previous; size: 10px 10px; }');
    expect(l.warnings.some((w: string) => w.includes('previous'))).toBe(true);
    expect([findNode(l, 'first').x, findNode(l, 'first').y]).toEqual([0, 0]);
  });

  it('throws CyclicDependencyError with the exact message for impossible cycles', async () => {
    await expect(layout(`
      canvas { size: 100px 100px; }
      rect #a { at: right of b; size: 5px 5px; }
      rect #b { at: left of a; size: 5px 5px; }
    `)).rejects.toThrow(/Cyclic layout dependency cycle detected: .*#?a.*#?b.*#?a/s);
  });

  it('resolves missing anchor targets to origin with a warning (no crash)', async () => {
    const l = await layout('canvas { size: 100px 100px; } rect #g { at: right of ghost; size: 5px 5px; }');
    expect(JSON.stringify(l.warnings)).toMatch(/ghost/i);
    expect(findNode(l, 'g')).toBeDefined();
  });
});

describe('Layout solver: z-order and multi-canvas', () => {
  it('sorts nodes by zIndex for rendering', async () => {
    const l = await layout(`
      canvas { size: 100px 100px; }
      rect #low { at: 0px 0px; size: 10px 10px; z-index: 1; }
      rect #high { at: 1px 1px; size: 10px 10px; z-index: 9; }
    `);
    const flat = l.nodes.filter((n: any) => n.id === 'low' || n.id === 'high');
    expect(flat[flat.length - 1].id).toBe('high');
  });

  it('keeps pages independent and warns on empty later pages', async () => {
    const l = await layout(`
      canvas "Front" { size: 100px 100px; rect #frontOnly { at: 5px 5px; size: 10px 10px; } }
      canvas "Back" { size: 100px 100px; }
    `);
    expect(l.canvases).toHaveLength(2);
    expect(l.canvases[1].nodes).toHaveLength(0);
    expect(l.canvases[1].warnings.join(' ')).toContain('renders empty');
  });
});
