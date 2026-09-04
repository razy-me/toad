import { describe, it, expect } from 'vitest';
import { parseColorToRgba, cmykToRgb } from '../../src/engine/drawUtils.js';
import { exportToSvg } from '../../src/engine/svgExporter.js';
import { exportToPsd } from '../../src/engine/psdExporter.js';
import { solveLayout } from '../../src/parser/math.js';
import { parseToad } from '../../src/parser/parser.js';
import { resolveImportsAndComponents } from '../../src/parser/importResolver.js';
import { readPsd } from 'ag-psd';

describe('Phase 3 Rendering & Exporter Regression Suite', () => {
  it('correctly parses small CMYK percentages (e.g. 1%) without treating them as 100%', () => {
    const rgba1pct = parseColorToRgba('cmyk(1%, 0, 0, 0)');
    // 1% cyan should produce red channel ~ 252 (not 0!)
    expect(rgba1pct.r).toBeGreaterThan(245);
    expect(rgba1pct.g).toBe(255);
    expect(rgba1pct.b).toBe(255);

    const rgba50pct = parseColorToRgba('cmyk(50%, 0, 0, 0)');
    // 50% cyan should produce red channel ~ 128
    expect(rgba50pct.r).toBeGreaterThan(120);
    expect(rgba50pct.r).toBeLessThan(135);
  });

  it('SVG exporter converts CMYK colors to standard SVG colors without raw cmyk() in XML', async () => {
    const src = `
      rect #box {
        size: 100px 100px;
        fill: cmyk(0, 100%, 100%, 0);
        stroke: cmyk(100%, 0, 0, 0);
      }
    `;
    const doc = await resolveImportsAndComponents(parseToad(src, 'test.toad'), 'test.toad');
    const layout = await solveLayout(doc);
    const svg = await exportToSvg(layout);

    expect(svg).not.toContain('cmyk(');
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('stroke="#00ffff"');
  });

  it('SVG exporter avoids emitting duplicate clip-path attributes on the same element', async () => {
    const src = `
      rect #mask {
        size: 100px 100px;
        clip: true;
      }
      rect #target {
        size: 100px 100px;
        mask: #mask;
      }
    `;
    const doc = await resolveImportsAndComponents(parseToad(src, 'test.toad'), 'test.toad');
    const layout = await solveLayout(doc);
    const svg = await exportToSvg(layout);

    const targetLine = svg.split('\n').find(l => l.includes('target') || l.includes('clip-path'));
    expect(targetLine).toBeDefined();
    // Count occurrences of clip-path=
    const matches = targetLine!.match(/clip-path=/g);
    expect(matches ? matches.length : 0).toBeLessThanOrEqual(1);
  });

  it('PSD exporter sets correct light angle for shadow and does not double-bold bold fonts', async () => {
    const src = `
      rect #card {
        size: 200px 200px;
        shadow: 10px 10px 5px rgba(0, 0, 0, 0.5);
      }
      text #title {
        font: bold 20px "Arial";
        letter-spacing: 2px;
        content: "Title";
      }
    `;
    const doc = await resolveImportsAndComponents(parseToad(src, 'test.toad'), 'test.toad');
    const layout = await solveLayout(doc);

    // Test 1x
    const psdBuffer1x = await exportToPsd(layout, { scale: 1 });
    const psd1x = readPsd(psdBuffer1x);

    const textLayer = psd1x.children?.find(c => c.name === 'Title');
    expect(textLayer).toBeDefined();
    expect(textLayer?.text?.style?.font?.name).toBe('Arial-BoldMT');
    // PostScript font is already bold -> fauxBold should be undefined or false
    expect(textLayer?.text?.style?.fauxBold).toBeFalsy();
    // Tracking is 2px / 20px * 1000 = 100
    const tracking1x = textLayer?.text?.style?.tracking;
    expect(tracking1x).toBe(100);

    // Test 2x scale: tracking should remain 100, not shrink to 50!
    const psdBuffer2x = await exportToPsd(layout, { scale: 2 });
    const psd2x = readPsd(psdBuffer2x);
    const textLayer2x = psd2x.children?.find(c => c.name === 'Title');
    expect(textLayer2x?.text?.style?.tracking).toBe(100);

    // Check shadow light angle: for +10px, +10px (bottom-right shadow), light comes from top-left (135 degrees)
    const cardLayer = psd1x.children?.find(c => c.name === 'card');
    expect(cardLayer).toBeDefined();
    const shadowEffect = cardLayer?.effects?.dropShadow?.[0];
    expect(shadowEffect).toBeDefined();
    expect(shadowEffect?.angle).toBe(135);
  });
});
