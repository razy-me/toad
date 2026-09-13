import { describe, it, expect } from 'vitest';
import { readPsd } from 'ag-psd';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { exportToPsd, PsdExporter } from '../src/engine/psdExporter.js';

async function parseAndExportPsd(src: string, opts: any = {}) {
  const doc = parseToad(src);
  const resolved = await resolveImportsAndComponents(doc, 'main.toad');
  const layout = await solveLayout(resolved);
  const buf = await exportToPsd(layout, opts);
  return readPsd(buf, { readLayers: true, readVectorMask: true });
}

describe('PSD Export Maximum Vector Fidelity & Lossless Layer Retention', () => {
  it('exports canvas background as a native Vector Shape layer with vectorMask, vectorFill and vectorOrigination', async () => {
    const psd = await parseAndExportPsd(`
      canvas {
        size: 500px 400px;
        background: #2563eb;
      }
      rect #box {
        at: 50px 50px;
        size: 100px 100px;
        fill: #ffffff;
      }
    `);

    const bgLayer = psd.children?.find(l => l.name === 'Background');
    expect(bgLayer).toBeDefined();
    expect(bgLayer?.vectorMask).toBeDefined();
    expect(bgLayer?.vectorMask?.paths).toHaveLength(1);
    expect(bgLayer?.vectorMask?.paths[0]?.knots).toHaveLength(4); // Sharp 4-knot rectangle for canvas bounds
    expect(bgLayer?.vectorFill).toBeDefined();
    expect(bgLayer?.vectorFill?.type).toBe('color');
    expect(bgLayer?.vectorOrigination).toBeDefined();
    expect(bgLayer?.vectorOrigination?.keyDescriptorList[0]?.keyOriginType).toBe(1); // Sharp rectangle
  });

  it('generates non-destructive vectorMask for image elements with radius', async () => {
    const psd = await parseAndExportPsd(`
      canvas { size: 400px 400px; }
      image #avatar {
        at: 50px 50px;
        size: 120px 120px;
        radius: 24px;
      }
    `);

    const imgLayer = psd.children?.find(l => l.name === 'avatar');
    expect(imgLayer).toBeDefined();
    expect(imgLayer?.vectorMask).toBeDefined();
    expect(imgLayer?.vectorMask?.paths[0]?.knots).toHaveLength(8); // 8-knot rounded rect
    expect(imgLayer?.vectorOrigination?.keyDescriptorList[0]?.keyOriginType).toBe(2); // Rounded rect
    expect(imgLayer?.vectorOrigination?.keyDescriptorList[0]?.keyOriginRRectRadii?.topLeft?.value).toBe(24);
  });

  it('generates native vectorMask on container groups with clip or borderRadius', async () => {
    const psd = await parseAndExportPsd(`
      canvas { size: 600px 600px; }
      group #cardGroup {
        at: 50px 50px;
        size: 300px 200px;
        radius: 16px;
        clip: true;

        rect #inner {
          at: 0 0;
          size: 100px 100px;
          fill: #ff0000;
        }
      }
    `);

    const groupLayer = psd.children?.find(l => l.name === 'cardGroup');
    expect(groupLayer).toBeDefined();
    expect(groupLayer?.children).toBeDefined();
    expect(groupLayer?.vectorMask).toBeDefined();
    expect(groupLayer?.vectorMask?.paths[0]?.knots).toHaveLength(8);
  });

  it('automatically synchronizes fillOpacity for semi-transparent colors in vector layers', async () => {
    const psd = await parseAndExportPsd(`
      canvas { size: 400px 400px; }
      rect #semiBox {
        at: 20px 20px;
        size: 150px 100px;
        fill: rgba(59, 130, 246, 0.45);
      }
    `);

    const boxLayer = psd.children?.find(l => l.name === 'semiBox');
    expect(boxLayer).toBeDefined();
    expect(boxLayer?.vectorFill).toBeDefined();
    expect(boxLayer?.fillOpacity).toBeCloseTo(0.45, 2);
  });

  it('preserves dashed and dotted stroke styles in vectorStroke.lineDashSet', async () => {
    const psd = await parseAndExportPsd(`
      canvas { size: 500px 500px; }
      rect #dashedBox {
        at: 20px 20px;
        size: 100px 100px;
        fill: #ffffff;
        stroke: #000000 2px;
        stroke-style: dashed;
      }
      rect #dottedBox {
        at: 150px 20px;
        size: 100px 100px;
        fill: #ffffff;
        stroke: #000000 2px;
        stroke-style: dotted;
      }
    `);

    const dashed = psd.children?.find(l => l.name === 'dashedBox');
    expect(dashed?.vectorStroke?.lineDashSet).toBeDefined();
    expect(dashed?.vectorStroke?.lineDashSet).toHaveLength(2);
    expect(dashed?.vectorStroke?.lineDashSet[0].value).toBe(6);

    const dotted = psd.children?.find(l => l.name === 'dottedBox');
    expect(dotted?.vectorStroke?.lineDashSet).toBeDefined();
    expect(dotted?.vectorStroke?.lineDashSet).toHaveLength(2);
    expect(dotted?.vectorStroke?.lineDashSet[0].value).toBe(2);
    expect(dotted?.vectorStroke?.lineCapType).toBe('round');
  });

  it('preserves inside and outside stroke alignment in vectorStroke', async () => {
    const psd = await parseAndExportPsd(`
      canvas { size: 400px 400px; }
      rect #insideBox {
        at: 20px 20px;
        size: 100px 100px;
        fill: #ffffff;
        stroke: #ff0000 4px;
        stroke-align: inside;
      }
      rect #outsideBox {
        at: 150px 20px;
        size: 100px 100px;
        fill: #ffffff;
        stroke: #00ff00 4px;
        stroke-align: outside;
      }
    `);

    const inside = psd.children?.find(l => l.name === 'insideBox');
    expect(inside?.vectorStroke?.lineAlignment).toBe('inside');

    const outside = psd.children?.find(l => l.name === 'outsideBox');
    expect(outside?.vectorStroke?.lineAlignment).toBe('outside');
  });

  it('exports multi-line and wrapped text as native Paragraph / Box text with boxBounds', async () => {
    const psd = await parseAndExportPsd(`
      canvas { size: 500px 400px; }
      text #headline {
        at: 30px 40px;
        size: 300px 100px;
        font-size: 20px;
        wrap-width: 300px;
        content: "First line of text\nSecond line with automatic wrap";
      }
    `);

    const textLayer = psd.children?.find(l => l.text !== undefined);
    expect(textLayer).toBeDefined();
    expect(textLayer?.text?.shapeType).toBe('box');
    expect(textLayer?.text?.boxBounds).toBeDefined();
    expect(textLayer?.text?.boxBounds?.[2]).toBeGreaterThan(0); // width in points
    expect(textLayer?.text?.boxBounds?.[3]).toBeGreaterThan(0); // height in points
    expect(textLayer?.text?.antiAlias).toBe('smooth');
  });

  it('generates smooth rounded Bezier knots for polygons with borderRadius', async () => {
    const psd = await parseAndExportPsd(`
      canvas { size: 400px 400px; }
      polygon #roundedTri {
        at: 50px 50px;
        size: 200px 200px;
        points: 100 0, 200 200, 0 200;
        radius: 16px;
        fill: #10b981;
      }
    `);

    const triLayer = psd.children?.find(l => l.name === 'roundedTri');
    expect(triLayer).toBeDefined();
    expect(triLayer?.vectorMask).toBeDefined();
    // A sharp triangle has 3 knots. A rounded triangle with smooth corner arcs has more knots
    expect(triLayer?.vectorMask?.paths[0]?.knots.length).toBeGreaterThan(3);
  });
});
