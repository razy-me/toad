import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { renderToCanvas } from '../src/engine/canvasRenderer.js';
import { exportToSvg } from '../src/engine/svgExporter.js';
import { exportToPsd } from '../src/engine/psdExporter.js';
import { createCanvas } from '@napi-rs/canvas';
import { readPsd } from 'ag-psd';

async function compile(src: string, filename = 'test.toad') {
  const doc = parseToad(src, filename);
  const resolved = await resolveImportsAndComponents(doc, filename);
  return solveLayout(resolved);
}

describe('Optical Text Centering & Top-Baseline Bias Elimination', () => {
  it('achieves <= 1px pixel symmetry in a 24px container with vertical-align: middle', async () => {
    const layout = await compile(`
      canvas { size: 100px 24px; background: #ffffff; }
      text #label {
        at: 10px 0px;
        size: (80px, 24px);
        content: "HELLO";
        font-size: 11px;
        color: #000000;
        vertical-align: middle;
      }
    `);

    // Render directly to Canvas for exact pixel scanning
    const canvas = await renderToCanvas(layout);
    const ctx = canvas.getContext('2d');

    const imgData = ctx.getImageData(0, 0, 100, 24).data;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (y * 100 + x) * 4;
        const r = imgData[idx]!;
        if (r < 128) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    expect(minY).toBeLessThan(Infinity);
    const topGap = minY;
    const bottomGap = 24 - (maxY + 1);
    const asymmetry = Math.abs(topGap - bottomGap);

    expect(asymmetry).toBeLessThanOrEqual(1);
  });

  it('achieves <= 1px pixel symmetry in an auto-layout stack with align: center', async () => {
    const layout = await compile(`
      canvas { size: 200px 24px; background: #ffffff; }
      stack #pill {
        at: 0px 0px;
        direction: horizontal;
        align: center;
        size: (180px, 24px);
        text #badge {
          content: "COMPILED • 0 ERRORS";
          font-size: 11px;
          color: #000000;
        }
      }
    `);

    const canvas = await renderToCanvas(layout);
    const ctx = canvas.getContext('2d');

    const imgData = ctx.getImageData(0, 0, 200, 24).data;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 200; x++) {
        const idx = (y * 200 + x) * 4;
        const r = imgData[idx]!;
        if (r < 128) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    expect(minY).toBeLessThan(Infinity);
    const topGap = minY;
    const bottomGap = 24 - (maxY + 1);
    const asymmetry = Math.abs(topGap - bottomGap);

    expect(asymmetry).toBeLessThanOrEqual(1);
  });

  it('achieves <= 1px pixel symmetry with relational positioning at: center of #bg', async () => {
    const layout = await compile(`
      canvas { size: 120px 24px; background: #ffffff; }
      rect #bg {
        at: 0px 0px;
        size: (120px, 24px);
        fill: #ffffff;
      }
      text #label {
        content: "HELLO";
        font-size: 11px;
        color: #000000;
        at: center of #bg;
      }
    `);

    const canvas = await renderToCanvas(layout);
    const ctx = canvas.getContext('2d');

    const imgData = ctx.getImageData(0, 0, 120, 24).data;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 120; x++) {
        const idx = (y * 120 + x) * 4;
        const r = imgData[idx]!;
        if (r < 128) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    expect(minY).toBeLessThan(Infinity);
    const topGap = minY;
    const bottomGap = 24 - (maxY + 1);
    const asymmetry = Math.abs(topGap - bottomGap);

    expect(asymmetry).toBeLessThanOrEqual(1);
  });

  it('supports trim: both to trim intrinsic bounding box to actual glyph envelope', async () => {
    const layout = await compile(`
      canvas { size: 100px 50px; }
      text #trimmed {
        at: 0px 0px;
        content: "HELLO";
        font-size: 16px;
        trim: both;
      }
      text #untrimmed {
        at: 0px 0px;
        content: "HELLO";
        font-size: 16px;
      }
    `);

    const trimmedNode = layout.nodes.find(n => n.id === 'trimmed')!;
    const untrimmedNode = layout.nodes.find(n => n.id === 'untrimmed')!;

    expect(trimmedNode.height).toBeLessThan(untrimmedNode.height);
    expect(trimmedNode.height).toBeLessThanOrEqual(14);
    expect(untrimmedNode.height).toBeGreaterThanOrEqual(20);
  });

  it('guarantees baseline parity between Skia Canvas, SVG Vector, and PSD Exporter', async () => {
    const layout = await compile(`
      canvas { size: 200px 60px; }
      text #btn {
        at: 10px 10px;
        size: (120px, 32px);
        content: "Save Changes";
        font-size: 14px;
        vertical-align: middle;
        align: center;
      }
    `);

    const node = layout.nodes.find(n => n.id === 'btn')!;
    const opticalOffset = node.textLayout!.opticalCenterOffset!;
    const expectedBaselineY = node.y + node.height / 2 + opticalOffset;

    // 1. Verify SVG baseline output matches expectedBaselineY
    const svgStr = await exportToSvg(layout);
    const svgMatch = svgStr.match(/<text[^>]*\by="([\d.]+)"/);
    expect(svgMatch).toBeDefined();
    const svgBaselineY = parseFloat(svgMatch![1]!);
    expect(svgBaselineY).toBeCloseTo(expectedBaselineY, 4);

    // 2. Verify PSD editable text layer transform ty matches expectedBaselineY
    const psdBuffer = await exportToPsd(layout);
    const psd = readPsd(psdBuffer, { skipLayerImageData: true });
    const textLayer = psd.children?.find(l => l.name.includes('Save Changes') || l.name === 'btn')!;
    expect(textLayer).toBeDefined();
    expect(textLayer.text).toBeDefined();
    expect(textLayer.text?.transform).toBeDefined();
    const psdTy = textLayer.text!.transform![5]!;
    expect(psdTy).toBeCloseTo(expectedBaselineY, 4);
  });

  it('optically centers multi-line text blocks with vertical-align: middle', async () => {
    const layout = await compile(`
      canvas { size: 200px 100px; }
      text #multiline {
        at: 10px 10px;
        size: (180px, 80px);
        content: "First Line\\nSecond Line";
        font-size: 14px;
        line-height: 20px;
        vertical-align: middle;
      }
    `);

    const svgStr = await exportToSvg(layout);
    const svgMatch = svgStr.match(/<text[^>]*\by="([\d.]+)"/);
    expect(svgMatch).toBeDefined();
    const firstLineY = parseFloat(svgMatch![1]!);

    const node = layout.nodes.find(n => n.id === 'multiline')!;
    const opticalOffset = node.textLayout!.opticalCenterOffset!;
    const expectedFirstLineY = 10 + 30 + opticalOffset;

    expect(firstLineY).toBeCloseTo(expectedFirstLineY, 4);
  });
});
