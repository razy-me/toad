import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { exportToSvg } from '../src/engine/svgExporter.js';
import { calculateWhitespaceDistribution } from '../src/tools/metrics/spatialDistribution.js';
import { auditDesign } from '../src/tools/designAuditor.js';
import { LayoutNode } from '../src/parser/math.js';

describe('Review Fixes - Tranche 4', () => {
  // --------------------------------------------------------------------------
  // F-06: Stack hug + fill circular sizing fallback
  // --------------------------------------------------------------------------
  it('F-06: stack with hug main axis and fill child does not collapse child to 0px', async () => {
    const src = `
      canvas { size: 800px 600px; }
      stack #myStack {
        direction: horizontal;
        size: hug 100px;
        text #lbl { content: "Hello World"; font-size: 20px; size: fill 40px; }
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'test.toad');
    const layout = await solveLayout(resolved);

    const lbl = layout.nodes.find(n => n.id === 'lbl');
    const myStack = layout.nodes.find(n => n.id === 'myStack');

    expect(lbl).toBeDefined();
    expect(myStack).toBeDefined();
    expect(lbl!.width).toBeGreaterThan(0);
    expect(myStack!.width).toBeGreaterThan(0);
  });

  it('F-06: vertical stack with hug height and fill child does not collapse to 0px', async () => {
    const src = `
      canvas { size: 800px 600px; }
      stack #vStack {
        direction: vertical;
        size: 300px hug;
        rect #box { size: 100px fill; }
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'test.toad');
    const layout = await solveLayout(resolved);

    const box = layout.nodes.find(n => n.id === 'box');
    const vStack = layout.nodes.find(n => n.id === 'vStack');

    expect(box).toBeDefined();
    expect(vStack).toBeDefined();
    expect(box!.height).toBeGreaterThan(0);
    expect(vStack!.height).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // F-19: SvgExporter textToPath option
  // --------------------------------------------------------------------------
  it('F-19: exportToSvg respects textToPath option and converts text to paths', async () => {
    const src = `
      canvas { size: 400px 200px; }
      text #title { content: "Antigravity"; at: 20px 50px; font-size: 24px; }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'test.toad');
    const layout = await solveLayout(resolved);

    // With textToPath: false
    const normalSvg = await exportToSvg(layout, { textToPath: false });
    expect(normalSvg).toContain('<text');

    // With textToPath: true
    const pathSvg = await exportToSvg(layout, { textToPath: true });
    expect(pathSvg).toContain('<path');
  });

  // --------------------------------------------------------------------------
  // F-21: Voronoi whitespace excludes transparent layout containers
  // --------------------------------------------------------------------------
  it('F-21: Voronoi whitespace excludes transparent group and stack containers', () => {
    const transparentGroup: LayoutNode = {
      id: 'grp',
      name: 'grp',
      type: 'group',
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      box: { x: 100, y: 100, w: 200, h: 200 },
      style: { color: '#000000' },
      children: [
        {
          id: 'child1',
          name: 'child1',
          type: 'rect',
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          box: { x: 100, y: 100, w: 50, h: 50 },
          fill: '#ff0000',
          style: { color: '#000000', fill: '#ff0000' }
        } as any
      ]
    };

    const rect2: LayoutNode = {
      id: 'rect2',
      name: 'rect2',
      type: 'rect',
      x: 400,
      y: 200,
      width: 60,
      height: 60,
      box: { x: 400, y: 200, w: 60, h: 60 },
      fill: '#00ff00',
      style: { color: '#000000', fill: '#00ff00' }
    };

    const rect3: LayoutNode = {
      id: 'rect3',
      name: 'rect3',
      type: 'rect',
      x: 200,
      y: 500,
      width: 70,
      height: 70,
      box: { x: 200, y: 500, w: 70, h: 70 },
      fill: '#0000ff',
      style: { color: '#000000', fill: '#0000ff' }
    };

    const nodes = [transparentGroup, transparentGroup.children![0]!, rect2, rect3];
    const res = calculateWhitespaceDistribution(nodes, 800, 800, 80);

    expect(res).toBeDefined();
    expect(res.voronoiGini).toBeGreaterThan(0);
    expect(res.voronoiGini).toBeLessThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // F-22: Negative space grid occupancy prevents false Horror Vacui alerts
  // --------------------------------------------------------------------------
  it('F-22: 2D sample grid prevents false Horror-Vacui alerts when bounding boxes overlap', async () => {
    const src = `
      canvas { size: 1000px 1000px; background: #ffffff; }
      rect #card1 { at: 100px 100px; size: 500px 500px; fill: #f0f0f0; }
      rect #card2 { at: 200px 200px; size: 500px 500px; fill: #e0e0e0; }
      text #t1 { at: 120px 120px; content: "One"; }
      text #t2 { at: 120px 150px; content: "Two"; }
      text #t3 { at: 120px 180px; content: "Three"; }
      text #t4 { at: 120px 210px; content: "Four"; }
      text #t5 { at: 120px 240px; content: "Five"; }
      text #t6 { at: 120px 270px; content: "Six"; }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'test.toad');
    const layout = await solveLayout(resolved);

    const audit = auditDesign(layout, doc);
    const horrorVacui = audit.findings.find(f => f.code === 'SLOP-WEB-008');

    expect(horrorVacui).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // F-23: Parser panic recovery advances token stream to prevent infinite loop
  // --------------------------------------------------------------------------
  it('F-23: parseToad recovers gracefully from syntax errors without hanging', () => {
    const malformed = `
      canvas { size: 500px 500px; }
      ; ; ; invalid_garbage_token ???
      rect #box { size: 100px 100px; }
    `;
    const doc = parseToad(malformed);
    expect(doc).toBeDefined();
    expect(doc.elements.some(e => e.id === 'box')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // F-24: ImportResolver evaluates calc expressions safely
  // --------------------------------------------------------------------------
  it('F-24: calc expressions in element properties evaluate safely', async () => {
    const src = `
      canvas { size: 600px 600px; }
      rect #r1 {
        at: 10px 10px;
        size: 100px 100px;
        opacity: 0.8;
        rotation: calc(45 + 45);
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'test.toad');
    const layout = await solveLayout(resolved);

    const r1 = layout.nodes.find(n => n.id === 'r1');
    expect(r1).toBeDefined();
    expect(r1!.style.rotation).toBe(90);
  });
});
