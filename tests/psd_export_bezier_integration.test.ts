import { describe, it, expect } from 'vitest';
import { PsdExporter } from '../src/engine/psdExporter.js';
import { LayoutResult } from '../src/parser/math.js';
import { readPsd } from 'ag-psd';

describe('PSD Exporter Vector Path Integration', () => {
  it('exports complex SVG path as native Photoshop vectorMask with Bezier knots', async () => {
    const layout: LayoutResult = {
      canvas: { width: 400, height: 400, background: '#ffffff' },
      nodes: [
        {
          id: 'curvedPath',
          type: 'path',
          name: 'Heart Path',
          x: 50,
          y: 50,
          width: 200,
          height: 200,
          fill: '#ff0055',
          pathLayout: {
            d: 'M 10 30 C 10 10, 40 10, 50 30 C 60 10, 90 10, 90 30 Q 90 60, 50 90 Q 10 60, 10 30 Z'
          },
          style: {
            fill: '#ff0055'
          },
          box: { x: 50, y: 50, w: 200, h: 200 }
        } as any
      ]
    };

    const buffer = await PsdExporter.export(layout);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const psd = readPsd(buffer, { skipLayerImageData: true });
    expect(psd.children).toBeDefined();

    // Find our layer
    const pathLayer = psd.children?.find(l => l.name === 'Heart Path');
    expect(pathLayer).toBeDefined();
    expect(pathLayer?.vectorMask).toBeDefined();
    expect(pathLayer?.vectorMask?.paths).toBeDefined();
    expect(pathLayer?.vectorMask?.paths.length).toBeGreaterThan(0);

    const mainPath = pathLayer?.vectorMask?.paths[0]!;
    expect(mainPath.knots.length).toBeGreaterThanOrEqual(4);
    // Check that control points exist and are offset correctly
    const k0 = mainPath.knots[0]!;
    expect(k0.points[2]).toBeCloseTo(60, 2); // anchor x = node.x (50) + 10 = 60
    expect(k0.points[3]).toBeCloseTo(80, 2); // anchor y = node.y (50) + 30 = 80
  });

  it('exports icon as native vectorMask scaled from 24x24 viewBox', async () => {
    const layout: LayoutResult = {
      canvas: { width: 200, height: 200 },
      nodes: [
        {
          id: 'checkIcon',
          type: 'icon',
          name: 'Checkmark Icon',
          x: 40,
          y: 40,
          width: 48,
          height: 48,
          fill: '#00cc66',
          pathLayout: {
            d: 'M 4 12 L 9 17 L 20 6'
          },
          style: {
            fill: '#00cc66'
          },
          box: { x: 40, y: 40, w: 48, h: 48 }
        } as any
      ]
    };

    const buffer = await PsdExporter.export(layout);
    const psd = readPsd(buffer, { skipLayerImageData: true });
    const iconLayer = psd.children?.find(l => l.name === 'Checkmark Icon');

    expect(iconLayer).toBeDefined();
    expect(iconLayer?.vectorMask).toBeDefined();
    const mainPath = iconLayer?.vectorMask?.paths[0]!;
    expect(mainPath).toBeDefined();
    // 48/24 = 2x scale
    // Point 0 was (4, 12) -> anchor x = 40 + 4*2 = 48, anchor y = 40 + 12*2 = 64
    const k0 = mainPath.knots[0]!;
    expect(k0.points[2]).toBeCloseTo(48, 2);
    expect(k0.points[3]).toBeCloseTo(64, 2);
  });
});
