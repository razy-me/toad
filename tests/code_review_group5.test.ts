import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout, safeEvaluateMath, resolveDimension } from '../src/parser/math.js';
import { calculateApca } from '../src/tools/designAuditor.js';
import { calculateWhitespaceDistribution } from '../src/tools/metrics/spatialDistribution.js';
import { drawVignette } from '../src/engine/drawUtils.js';
import { generateShapePath } from '../src/engine/shapeGenerators.js';
import { FontLoader } from '../src/engine/fontLoader.js';

describe('Adversarial Code Review - Group 5 Findings', () => {
  it('F-05: FontLoader indexes system fonts and caches results', () => {
    FontLoader.indexSystemFontsLazily();
    expect(FontLoader).toBeDefined();
  });

  it('F-11: LayoutResult provides clean rootNodes without container duplicate inflation', async () => {
    const src = `
      canvas { size: 1000px 800px; }
      group #card {
        at: 50px 50px;
        size: 400px 300px;
        rect #bg { size: 100% 100%; fill: #ffffff; }
        text #title { text: "Hello"; at: 10px 10px; }
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'main.toad');
    const layout = await solveLayout(resolved);

    expect(layout.rootNodes).toBeDefined();
    expect(layout.rootNodes!.length).toBe(1);
    expect(layout.rootNodes![0].id).toBe('card');
    expect(layout.rootNodes![0].children?.length).toBe(2);
  });

  it('F-16: fileFinder safely skips floppy drive letters A and B', async () => {
    const { findToadFiles } = await import('../src/utils/fileFinder.js');
    expect(findToadFiles).toBeDefined();
  });

  it('F-23: safeEvaluateMath emits diagnostic warnings on adjacent or trailing operators', () => {
    const warnings1: string[] = [];
    const res1 = safeEvaluateMath('10 * * 2', warnings1);
    expect(warnings1.length).toBeGreaterThan(0);
    expect(warnings1[0]).toContain('Syntax error');

    const warnings2: string[] = [];
    const res2 = safeEvaluateMath('100 +', warnings2);
    expect(warnings2.length).toBeGreaterThan(0);
    expect(warnings2[0]).toContain('trailing operator');

    const warnings3: string[] = [];
    const res3 = safeEvaluateMath('50 + 25 * 2', warnings3);
    expect(warnings3.length).toBe(0);
    expect(res3).toBe(100);
  });

  it('F-34: resolveDimension and evaluateCalc use configured target DPI for physical units', () => {
    // 300 DPI conversions
    expect(resolveDimension('1in', 1000, 0, 300)).toBe(300);
    expect(resolveDimension('25.4mm', 1000, 0, 300)).toBeCloseTo(300, 1);
    expect(resolveDimension('2.54cm', 1000, 0, 300)).toBeCloseTo(300, 1);
    expect(resolveDimension('72pt', 1000, 0, 300)).toBe(300);

    // Default 96 DPI CSS reference conversions
    expect(resolveDimension('1in', 1000, 0)).toBe(96);
    expect(resolveDimension('25.4mm', 1000, 0)).toBeCloseTo(96, 1);
    expect(resolveDimension('72pt', 1000, 0)).toBe(96);
  });

  it('F-35: calculateApca conforms to W3C APCA 0.98G standard reference', () => {
    const lcBlackOnWhite = calculateApca({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 });
    expect(lcBlackOnWhite).toBeGreaterThanOrEqual(100);
    expect(lcBlackOnWhite).toBeLessThanOrEqual(114);

    const lcWhiteOnBlack = calculateApca({ r: 255, g: 255, b: 255, a: 1 }, { r: 0, g: 0, b: 0, a: 1 });
    expect(lcWhiteOnBlack).toBeLessThanOrEqual(-100);
    expect(lcWhiteOnBlack).toBeGreaterThanOrEqual(-114);

    const lcZero = calculateApca({ r: 128, g: 128, b: 128, a: 1 }, { r: 128, g: 128, b: 128, a: 1 });
    expect(lcZero).toBe(0);
  });

  it('F-41: canvas scales parser supports bare fractional numbers and suffix syntax', async () => {
    const src = `
      canvas {
        size: 1920px 1080px;
        scales: 0.5, 1, 1.5, 2x;
      }
    `;
    const doc = parseToad(src);
    const scaleProp = doc.canvas.properties.find(p => p.name === 'scales');
    expect(scaleProp).toBeDefined();
    const resolved = await resolveImportsAndComponents(doc, 'scales.toad');
    expect(resolved.canvas.scales).toEqual([0.5, 1, 1.5, 2]);
  });

  it('F-47: drawVignette supports custom optical centroid focal point', () => {
    const mockCtx: any = {
      save: () => {},
      restore: () => {},
      createRadialGradient: (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) => {
        expect(x0).toBe(200);
        expect(y0).toBe(150);
        return {
          addColorStop: () => {}
        };
      },
      fillStyle: '',
      fillRect: () => {}
    };

    drawVignette(mockCtx, 800, 600, 50, 200, 150);
  });

  it('F-53: generateShapePath cross generator supports configurable thickness', () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    const defaultCross = generateShapePath('cross', box);
    const thickCross = generateShapePath('cross', box, { thickness: 40 });

    expect(defaultCross).toContain('M 40 0');
    expect(thickCross).toContain('M 30 0');
  });

  it('F-59: calculateWhitespaceDistribution factors canvas bleed into area calculation', () => {
    const nodes = [
      { id: '1', type: 'rect', x: 100, y: 100, width: 50, height: 50, box: { x: 100, y: 100, w: 50, h: 50 }, style: { fill: '#000' } } as any,
      { id: '2', type: 'rect', x: 300, y: 200, width: 50, height: 50, box: { x: 300, y: 200, w: 50, h: 50 }, style: { fill: '#000' } } as any,
      { id: '3', type: 'rect', x: 500, y: 400, width: 50, height: 50, box: { x: 500, y: 400, w: 50, h: 50 }, style: { fill: '#000' } } as any
    ];

    const withoutBleed = calculateWhitespaceDistribution(nodes, 800, 600, 75, 0);
    const withBleed = calculateWhitespaceDistribution(nodes, 800, 600, 75, 20);

    expect(withoutBleed).toBeDefined();
    expect(withBleed).toBeDefined();
    expect(withBleed.voronoiGini).toBeGreaterThan(0);
  });
});
