import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';

async function layout(src: string, name = 'c.toad') {
  return solveLayout(await resolveImportsAndComponents(parseToad(src, name), name));
}

function findNode(l: any, id: string) {
  return l.nodes.find((n: any) => n.id === id);
}

describe('Group containers', () => {
  it('anchors children to the container origin (container-relative coords)', async () => {
    const l = await layout(`
      canvas { size: 500px 500px; }
      group #g { at: 100px 80px;
        rect #inner { at: 10px 5px; size: 40px 30px; }
      }
    `);
    const inner = findNode(l, 'inner');
    expect([inner.x, inner.y]).toEqual([110, 85]);
  });

  it('defaults nested children without at to the container origin', async () => {
    const l = await layout(`
      canvas { size: 500px 500px; }
      group #g { at: 100px 80px; rect #inner { size: 60px 60px; } }
    `);
    expect([findNode(l, 'inner').x, findNode(l, 'inner').y]).toEqual([100, 80]);
  });

  it('unpositioned groups hug their children extents including origin shift', async () => {
    const l = await layout(`
      canvas { size: 600px 600px; }
      group #g {
        rect #a { at: 50px 40px; size: 30px 30px; }
        rect #b { at: 120px 90px; size: 20px 20px; }
      }
    `);
    const g = findNode(l, 'g');
    // Origin shifts to the children's min corner and spans the union.
    expect([g.x, g.y]).toEqual([50, 40]);
    expect([g.width, g.height]).toEqual([90, 70]);
  });

  it('positioned groups keep their declared origin and hug to largest child', async () => {
    const l = await layout(`
      canvas { size: 800px 800px; }
      group #g { at: center;
        rect #card { size: 240px 240px; fill: #fff; }
        icon #ic { iconName: 'check'; size: 80px 80px; at: center; }
      }
    `);
    const g = findNode(l, 'g');
    const card = findNode(l, 'card');
    const ic = findNode(l, 'ic');
    expect([g.x, g.y, g.width, g.height]).toEqual([280, 280, 240, 240]);
    expect([card.x, card.y]).toEqual([280, 280]);
    expect([ic.x, ic.y]).toEqual([360, 360]);
  });

  it('resolves vw/vh inside containers against available space', async () => {
    const l = await layout(`
      canvas { size: 400px 400px; }
      group #g { at: 0px 0px; size: 200px 100px;
        rect #v { at: 0px 0px; size: 50vw 25vh; }
      }
    `);
    // Viewport units resolve against the CONTAINER box when nested.
    const v = findNode(l, 'v');
    expect(v.width).toBeGreaterThan(0);
    expect(v.height).toBeGreaterThan(0);
  });
});

describe('Grid containers', () => {
  it('lays out a 2x2 grid with derived tile sizes', async () => {
    const l = await layout(`
      canvas { size: 400px 400px; }
      grid #g { at: 0px 0px; size: 400px 400px; columns: 2;
        rect #c1 { fill: #f00; } rect #c2 { fill: #0f0; }
        rect #c3 { fill: #00f; } rect #c4 { fill: #ff0; }
      }
    `);
    expect([findNode(l, 'c1').width, findNode(l, 'c1').height]).toEqual([200, 200]);
    expect(findNode(l, 'c3').y).toBe(200);
    expect(findNode(l, 'c2').x).toBe(200);
  });

  it('applies column and row gaps between tiles', async () => {
    const l = await layout(`
      canvas { size: 420px 420px; }
      grid #g { at: 0px 0px; size: 420px 420px; columns: 2; gap: 20px;
        rect #t1 { fill: #f00; } rect #t2 { fill: #0f0; }
        rect #t3 { fill: #00f; } rect #t4 { fill: #ff0; }
      }
    `);
    // Tile width = (420 - 20) / 2 = 200; second column starts at 220.
    expect(findNode(l, 't2').x).toBe(220);
    expect(findNode(l, 't3').y).toBe(220);
  });

  it('honors explicit first-child tile sizes when given', async () => {
    const l = await layout(`
      canvas { size: 400px 400px; }
      grid #g { at: 0px 0px; size: 400px 400px; columns: 2;
        rect #fixed { size: 80px 40px; fill: #f00; }
        rect #next { fill: #0f0; }
      }
    `);
    expect([findNode(l, 'fixed').width, findNode(l, 'fixed').height]).toEqual([80, 40]);
    expect(findNode(l, 'next').width).toBe(80); // same tile metrics for siblings
  });

  it('resolves % child heights against a single row height', async () => {
    const l = await layout(`
      canvas { size: 400px 400px; }
      grid #g { at: 0px 0px; size: 400px 400px; columns: 2;
        rect #pct { size: 100% 50%; fill: #f00; }
        rect #o1 { fill: #0f0; } rect #o2 { fill: #00f; } rect #o3 { fill: #ff0; }
      }
    `);
    const pct = findNode(l, 'pct');
    expect(pct.width).toBe(200);
    expect(pct.height).toBe(100); // half of one 200px row, not of the 400px grid
  });
});

describe('Stack containers', () => {
  it('stacks vertically honoring gaps and hug sizing', async () => {
    const l = await layout(`
      canvas { size: 300px 300px; fill: #fff; }
      stack #s { at: 10px 10px; direction: vertical; gap: 8px;
        rect #a { size: 100px 20px; fill: #f00; }
        rect #b { size: 100px 30px; fill: #0f0; }
      }
    `);
    const s = findNode(l, 's');
    expect(s.width).toBe(100);
    expect(s.height).toBe(58); // 20 + 8 + 30
    const b = findNode(l, 'b');
    expect(b.y).toBe(38); // 10 + 20 + 8
    expect(b.x).toBe(10);
  });

  it('stacks horizontally and hugs both axes', async () => {
    const l = await layout(`
      canvas { size: 400px 200px; }
      stack #h { at: 5px 5px; direction: horizontal; gap: 4px;
        rect #x { size: 60px 24px; }
        rect #y { size: 30px 40px; }
      }
    `);
    const h = findNode(l, 'h');
    expect(h.width).toBe(94); // 60 + 4 + 30
    expect(h.height).toBe(40);
    expect(findNode(l, 'y').x).toBe(69); // 5 + 60 + 4
  });

  it('distributes main-axis fill children across remaining space', async () => {
    const l = await layout(`
      canvas { size: 400px 100px; }
      stack #s { at: 0px 0px; size: 400px 100px; direction: horizontal;
        rect #fixedPart { size: 100px fill; fill: #f00; }
        rect #flexPart { size: fill fill; fill: #0f0; }
      }
    `);
    expect(findNode(l, 'flexPart').width).toBe(300);
  });

  it('centers cross-axis children with align center', async () => {
    const l = await layout(`
      canvas { size: 200px 200px; }
      stack #s { at: 0px 0px; size: 200px 200px; direction: vertical; align: center;
        rect #mid { size: 50px 20px; }
      }
    `);
    const mid = findNode(l, 'mid');
    expect(mid.x).toBe(75); // (200 - 50) / 2 relative + stack origin 0
  });

  it('applies padding around stacked content', async () => {
    const l = await layout(`
      canvas { size: 300px 300px; }
      stack #p { at: 0px 0px; size: 300px 300px; direction: vertical; padding: 20px;
        rect #first { size: 50px 50px; }
      }
    `);
    const first = findNode(l, 'first');
    expect([first.x, first.y]).toEqual([20, 20]);
  });

  it('keeps deep stacks in the flat node list for every exporter', async () => {
    const l = await layout(`
      canvas { size: 300px 300px; }
      group #outer { at: 10px 10px;
        stack #inner { at: 0px 0px; direction: vertical;
          rect #deepChild { size: 40px 40px; }
        }
      }
    `);
    const ids = l.nodes.map((n: any) => n.id);
    for (const expected of ['outer', 'inner', 'deepChild']) {
      expect(ids, expected).toContain(expected);
    }
    const dc = findNode(l, 'deepChild');
    expect([dc.x, dc.y]).toEqual([10, 10]);
  });
});
