import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';

describe('Advanced Layout Flow (Feature 1 & 6)', () => {
  it('solves stack with distribution: space-between', async () => {
    const src = `
      canvas { size: 500px 500px; background: #ffffff; }
      stack #mainStack {
        at: 0px 0px;
        size: 400px 100px;
        direction: horizontal;
        distribution: space-between;
        rect #box1 { size: 50px 50px; fill: #ff0000; }
        rect #box2 { size: 50px 50px; fill: #00ff00; }
        rect #box3 { size: 50px 50px; fill: #0000ff; }
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const layout = await solveLayout(resolved);

    const b1 = layout.nodes.find(n => n.id === 'box1')!;
    const b2 = layout.nodes.find(n => n.id === 'box2')!;
    const b3 = layout.nodes.find(n => n.id === 'box3')!;

    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    expect(b3).toBeDefined();

    // Box 1 should be at left edge = 0
    expect(b1.x).toBe(0);
    // Total free space = 400 - (3 * 50) = 250px.
    // 2 gaps -> 125px each.
    // Box 2 x = 50 + 125 = 175
    expect(b2.x).toBe(175);
    // Box 3 x = 175 + 50 + 125 = 350 (touching right edge: 350 + 50 = 400)
    expect(b3.x).toBe(350);
  });

  it('solves stack with distribution: space-evenly', async () => {
    const src = `
      canvas { size: 500px 500px; background: #ffffff; }
      stack #mainStack {
        at: 0px 0px;
        size: 300px 100px;
        direction: horizontal;
        distribution: space-evenly;
        rect #box1 { size: 50px 50px; fill: #ff0000; }
        rect #box2 { size: 50px 50px; fill: #00ff00; }
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const layout = await solveLayout(resolved);

    const b1 = layout.nodes.find(n => n.id === 'box1')!;
    const b2 = layout.nodes.find(n => n.id === 'box2')!;

    // Free space = 300 - 100 = 200px.
    // 3 gaps for space-evenly -> 200 / 3 = 66.666px.
    const gap = 200 / 3;
    expect(b1.x).toBeCloseTo(gap, 1);
    expect(b2.x).toBeCloseTo(gap + 50 + gap, 1);
  });

  it('locks aspect-ratio on elements when one dimension is defined', async () => {
    const src = `
      canvas { size: 800px 800px; background: #ffffff; }
      rect #card {
        at: 10px 10px;
        width: 320px;
        ratio: 16:9;
        fill: #3b82f6;
      }
      rect #square {
        at: 10px 200px;
        height: 150px;
        ratio: 1/1;
        fill: #10b981;
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const layout = await solveLayout(resolved);

    const card = layout.nodes.find(n => n.id === 'card')!;
    expect(card.width).toBe(320);
    expect(card.height).toBeCloseTo(320 / (16 / 9), 1); // 180px

    const square = layout.nodes.find(n => n.id === 'square')!;
    expect(square.height).toBe(150);
    expect(square.width).toBe(150);
  });

  it('supports fit-content intrinsic sizing', async () => {
    const src = `
      canvas { size: 600px 600px; background: #ffffff; }
      text #label {
        at: 0px 0px;
        size: fit-content;
        content: "Hello World";
        font-size: 20px;
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const layout = await solveLayout(resolved);

    const label = layout.nodes.find(n => n.id === 'label')!;
    expect(label.width).toBeGreaterThan(50);
    expect(label.height).toBeGreaterThan(15);
  });

  it('calculates capHeight and opticalCenterOffset accurately', async () => {
    const src = `
      canvas { size: 400px 400px; background: #ffffff; }
      text #heading {
        at: 20px 20px;
        content: "HELLO";
        font-size: 32px;
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const layout = await solveLayout(resolved);

    const heading = layout.nodes.find(n => n.id === 'heading')!;
    expect(heading.textLayout).toBeDefined();
    expect(heading.textLayout!.capHeight).toBeGreaterThan(15);
    expect(heading.textLayout!.opticalCenterOffset).toBeGreaterThanOrEqual(0);
  });
});
