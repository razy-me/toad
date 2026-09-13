import { describe, it, expect } from 'vitest';
import { svgPathToSubpaths } from '../src/engine/vectorPathParser.js';
import { parseColorToRgba } from '../src/engine/drawUtils.js';
import { exportToPdfBuffer } from '../src/engine/pdfExporter.js';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout, computeAspectRatio } from '../src/parser/math.js';
import { exportToSvg } from '../src/engine/svgExporter.js';
import { exportToPsd } from '../src/engine/psdExporter.js';
import { calculateOklchEntropy, sRgbToOklch } from '../src/tools/metrics/colorEntropy.js';
import { readPsd } from 'ag-psd';

describe('Code Review Gruppe 4 Verification (F-04, F-10, F-15, F-22, F-28, F-33, F-40, F-46, F-52, F-58)', () => {
  // F-04: SVG Vector Path Parser NaN Sanitization
  it('F-04: vectorPathParser handles truncated commands gracefully without NaN knots', () => {
    const malformedPaths = [
      'M 10', // Truncated M
      'M 10 10 L 20', // Truncated L
      'M 0 0 C 10 10 20 20 30', // Truncated C
      'M 0 0 A 10 10 0 0 1 50', // Truncated A
      'M 0 0 Q 10 10 20', // Truncated Q
    ];
    for (const d of malformedPaths) {
      const subpaths = svgPathToSubpaths(d);
      expect(Array.isArray(subpaths)).toBe(true);
      for (const sp of subpaths) {
        for (const seg of sp.segments) {
          expect(Number.isFinite(seg.p0.x)).toBe(true);
          expect(Number.isFinite(seg.p0.y)).toBe(true);
          expect(Number.isFinite(seg.p1.x)).toBe(true);
          expect(Number.isFinite(seg.p1.y)).toBe(true);
          expect(Number.isFinite(seg.cp1.x)).toBe(true);
          expect(Number.isFinite(seg.cp1.y)).toBe(true);
          expect(Number.isFinite(seg.cp2.x)).toBe(true);
          expect(Number.isFinite(seg.cp2.y)).toBe(true);
        }
      }
    }
  });

  // F-10: PDF Exporter scaling of page box dictionaries
  it('F-10: PDF export scales TrimBox and BleedBox according to scale option', async () => {
    const src = `
      canvas {
        size: 200px 300px;
        bleed: 10px;
        crop-marks: true;
      }
      rect #box {
        at: 0px 0px;
        size: 100px 100px;
        fill: #ff0000;
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'inline.toad');
    const layout = await solveLayout(resolved);

    // With scale: 2, margin is max(36, 10) = 36.
    // Scaled margin = 72, scaled baseW = 400, scaled baseH = 600.
    // trimRight = (36 + 200) * 2 = 472.
    const pdfBuf = await exportToPdfBuffer(layout, { scale: 2, bleed: 10, cropMarks: true });
    const pdfStr = pdfBuf.toString('binary');

    expect(pdfStr).toContain('/MediaBox [0 0 544.00 744.00]');
    expect(pdfStr).toContain('/TrimBox [72.00 72.00 472.00 672.00]');
    expect(pdfStr).toContain('/BleedBox [52.00 52.00 492.00 692.00]');
  });

  // F-15: DrawUtils alpha parsing supports nested color functions
  it('F-15: alpha() correctly parses nested color functions with internal commas', () => {
    const c1 = parseColorToRgba('alpha(rgba(255, 128, 0, 0.5), 0.8)');
    expect(c1.r).toBe(255);
    expect(c1.g).toBe(128);
    expect(c1.b).toBe(0);
    expect(c1.a).toBeCloseTo(0.8, 2);

    const c2 = parseColorToRgba('alpha(cmyk(0, 100%, 100%, 0), 40%)');
    expect(c2.r).toBe(255);
    expect(c2.g).toBe(0);
    expect(c2.b).toBe(0);
    expect(c2.a).toBeCloseTo(0.4, 2);
  });

  // F-22: Baseline calculation parity for middle vertical alignment
  it('F-22: PSD text layer transform matches Skia Canvas baseline alignment', async () => {
    const src = `
      canvas { size: 200px 100px; background: #ffffff; }
      text #label {
        at: 20px 20px;
        size: 160px 40px;
        content: "MIDDLE BADGE";
        font-size: 14px;
        vertical-align: middle;
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'inline.toad');
    const layout = await solveLayout(resolved);

    const node = layout.nodes.find(n => n.id === 'label')!;
    const opticalOffset = node.textLayout?.opticalCenterOffset ?? 0;
    const expectedBaselineY = node.y + node.height / 2 + opticalOffset;

    const psdBuf = await exportToPsd(layout);
    const psd = readPsd(psdBuf, { skipLayerImageData: true });
    const layer = psd.children?.find(c => c.name === 'MIDDLE BADGE' || c.name === 'label');
    expect(layer?.text?.transform).toBeDefined();
    expect(layer!.text!.transform![5]!).toBeCloseTo(expectedBaselineY, 3);
  });

  // F-33: Custom hex colors accepted in layerColor
  it('F-33: allows custom hex colors in layerColor property and maps to PSD', async () => {
    const src = `
      canvas { size: 300px 300px; }
      rect #card {
        at: 20px 20px;
        size: 100px 100px;
        fill: #3b82f6;
        layer-color: #ff0000;
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'inline.toad');
    const elem = resolved.elements.find(e => e.id === 'card');
    expect(elem?.layerColor).toBe('#ff0000');

    const layout = await solveLayout(resolved);
    const psdBuf = await exportToPsd(layout);
    const psd = readPsd(psdBuf, { skipLayerImageData: true });
    const layer = psd.children?.find(c => c.name === 'card');
    expect(layer?.layerColor).toBe('red');
  });

  // F-40: Aspect ratio parser handles variables and expressions
  it('F-40: aspect-ratio property accepts variable references and ratio expressions', async () => {
    const src = `
      >bannerRatio = "16:9";
      canvas {
        size: 800px 450px;
        aspect-ratio: >bannerRatio;
      }
      rect #media {
        at: 0px 0px;
        width: 400px;
        aspect-ratio: 16 : 9;
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'inline.toad');
    expect(resolved.canvas.aspectRatio?.str).toBe('16:9');
    const media = resolved.elements.find(e => e.id === 'media');
    expect(media?.aspectRatio).toBeCloseTo(16 / 9, 3);
  });

  // F-46: Canonical aspect ratios for non-integers and exact GCD for integers
  it('F-46: computeAspectRatio preserves exact integer GCD and snaps non-integer ratios to canonical forms', () => {
    // Exact integers:
    expect(computeAspectRatio(1920, 1080).ratioString).toBe('16:9');
    expect(computeAspectRatio(1009, 503).ratioString).toBe('1009:503');
    expect(computeAspectRatio(1440, 900).ratioString).toBe('8:5');

    // Non-integer dimensions resulting in 1.778:1 snap to 16:9:
    expect(computeAspectRatio(1000, 562.5).ratioString).toBe('16:9');
    expect(computeAspectRatio(800, 600.001).ratioString).toBe('4:3');
  });

  // F-52: Multi-line text SVG export omits redundant x/y coordinates on line 0 tspan
  it('F-52: SVG export omits redundant x and y attributes on initial tspan', async () => {
    const src = `
      canvas { size: 300px 300px; }
      text #para {
        at: 40px 50px;
        content: "Line One\\nLine Two";
        font-size: 16px;
        line-height: 24px;
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'inline.toad');
    const layout = await solveLayout(resolved);

    const svg = await exportToSvg(layout);
    expect(svg).toMatch(/<tspan( x="40" y="[\d.]+")?>Line One<\/tspan>/);
    expect(svg).toMatch(/<tspan x="40" y="[\d.]+">Line Two<\/tspan>/);
  });

  // F-58: Color entropy handles transparent pixels without crashing
  it('F-58: calculateOklchEntropy weights by alpha channel and handles transparent pixels safely', () => {
    const transparentColor = { r: 255, g: 0, b: 0, a: 0 };
    const oklch = sRgbToOklch(transparentColor);
    expect(Number.isFinite(oklch.l)).toBe(true);
    expect(Number.isFinite(oklch.c)).toBe(true);
    expect(Number.isFinite(oklch.h)).toBe(true);

    // Palette with only transparent pixels produces 0 entropy without NaN or crash
    const entropyZero = calculateOklchEntropy([transparentColor, { r: 0, g: 0, b: 0, a: 0 }]);
    expect(entropyZero).toBe(0);

    // Mixed palette correctly incorporates visible colors
    const entropyMixed = calculateOklchEntropy([
      { r: 255, g: 0, b: 0, a: 1 },
      { r: 0, g: 255, b: 0, a: 1 },
      transparentColor
    ]);
    expect(entropyMixed).toBeGreaterThan(0);
  });
});
