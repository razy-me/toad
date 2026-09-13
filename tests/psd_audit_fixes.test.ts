import { describe, it, expect } from 'vitest';
import { PsdExporter } from '../src/engine/psdExporter';
import { readPsd } from 'ag-psd';
import { LayoutResult } from '../src/types';

describe('PSD Exporter Critical Audit Fixes', () => {
  it('serializes gradient stops correctly without double-scaling location in raw binary buffer', async () => {
    const layout: LayoutResult = {
      canvas: { width: 200, height: 200 },
      nodes: [
        {
          id: 'grad-rect',
          type: 'rect',
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          style: {
            fill: {
              type: 'linear',
              stops: [
                { color: '#ff0000', offset: 0 },
                { color: '#00ff00', offset: 0.5 },
                { color: '#0000ff', offset: 1 }
              ]
            }
          },
          box: { x: 0, y: 0, w: 200, h: 200 }
        } as any
      ]
    };

    const buffer = await PsdExporter.export(layout);
    expect(buffer).toBeDefined();

    const psd = readPsd(buffer);
    const layer = psd.children?.[0];
    expect(layer).toBeDefined();

    let searchOffset = 0;
    const lctnBytes = Buffer.from('Lctn');
    let lctnFound = 0;

    while (searchOffset < buffer.length - 8) {
      const idx = buffer.indexOf(lctnBytes, searchOffset);
      if (idx === -1) break;
      if (buffer.toString('ascii', idx + 4, idx + 8) === 'long') {
        const val = buffer.readInt32BE(idx + 8);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(4096);
        lctnFound++;
      }
      searchOffset = idx + 4;
    }

    expect(lctnFound).toBeGreaterThan(0);
  });

  it('correctly maps fontCaps: 2 for uppercase and 1 for small-caps/lowercase', async () => {
    const layout: LayoutResult = {
      canvas: { width: 300, height: 100 },
      nodes: [
        {
          id: 'text-upper',
          type: 'text',
          name: 'Upper Text',
          x: 10,
          y: 10,
          width: 120,
          height: 30,
          style: { textTransform: 'uppercase' },
          textLayout: { lines: ['UPPER'], fontSize: 16 },
          box: { x: 10, y: 10, w: 120, h: 30 }
        } as any,
        {
          id: 'text-small',
          type: 'text',
          name: 'SmallCaps Text',
          x: 10,
          y: 50,
          width: 120,
          height: 30,
          style: { textTransform: 'small-caps' },
          textLayout: { lines: ['Small'], fontSize: 16 },
          box: { x: 10, y: 50, w: 120, h: 30 }
        } as any
      ]
    };

    const buffer = await PsdExporter.export(layout);
    const psd = readPsd(buffer, { skipLayerImageData: true });

    const upperLayer = psd.children?.find(l => l.name === 'UPPER');
    const smallLayer = psd.children?.find(l => l.name === 'Small');

    expect(upperLayer?.text?.style?.fontCaps).toBe(2);
    expect(smallLayer?.text?.style?.fontCaps).toBe(1);
  });

  it('converts typographic metrics to points based on document DPI', async () => {
    const layout: LayoutResult = {
      canvas: { width: 300, height: 100 },
      nodes: [
        {
          id: 'text-node',
          type: 'text',
          name: 'Metrics Test',
          x: 10,
          y: 10,
          width: 200,
          height: 50,
          style: {
            baselineShift: 10,
            spaceBefore: 20,
            spaceAfter: 30,
            firstLineIndent: 40
          },
          textLayout: { lines: ['Hello'], fontSize: 20 },
          box: { x: 10, y: 10, w: 200, h: 50 }
        } as any
      ]
    };

    const buffer144 = await PsdExporter.export(layout, { dpi: 144 });
    const psd144 = readPsd(buffer144, { skipLayerImageData: true });
    const layer144 = psd144.children?.find(l => l.name === 'Hello');

    expect(layer144?.text?.style?.baselineShift).toBeCloseTo(5, 1);
    expect(layer144?.text?.paragraphStyle?.spaceBefore).toBeCloseTo(10, 1);
    expect(layer144?.text?.paragraphStyle?.spaceAfter).toBeCloseTo(15, 1);
    expect(layer144?.text?.paragraphStyle?.firstLineIndent).toBeCloseTo(20, 1);
  });

  it('resets clipping mask chain when a subsequent sibling has clip: false', async () => {
    const layout: LayoutResult = {
      canvas: { width: 400, height: 400 },
      nodes: [
        {
          id: 'grp',
          type: 'group',
          name: 'Group With Reset',
          x: 0,
          y: 0,
          width: 400,
          height: 400,
          style: {},
          box: { x: 0, y: 0, w: 400, h: 400 },
          children: [
            {
              id: 'mask-base',
              type: 'circle',
              name: 'Base Circle',
              x: 50,
              y: 50,
              width: 100,
              height: 100,
              style: { clip: true, fill: '#ff0000' },
              box: { x: 50, y: 50, w: 100, h: 100 }
            } as any,
            {
              id: 'clipped-item',
              type: 'rect',
              name: 'Clipped Rect',
              x: 60,
              y: 60,
              width: 80,
              height: 80,
              style: { fill: '#00ff00' },
              box: { x: 60, y: 60, w: 80, h: 80 }
            } as any,
            {
              id: 'unclipped-item',
              type: 'rect',
              name: 'Unclipped Rect',
              x: 200,
              y: 200,
              width: 80,
              height: 80,
              style: { clip: false, fill: '#0000ff' },
              box: { x: 200, y: 200, w: 80, h: 80 }
            } as any,
            {
              id: 'normal-item',
              type: 'rect',
              name: 'Normal Rect',
              x: 300,
              y: 300,
              width: 50,
              height: 50,
              style: { fill: '#ffff00' },
              box: { x: 300, y: 300, w: 50, h: 50 }
            } as any
          ]
        } as any
      ]
    };

    const buffer = await PsdExporter.export(layout);
    const psd = readPsd(buffer, { skipLayerImageData: true });
    const grp = psd.children?.[0];
    expect(grp?.children).toBeDefined();

    const base = grp?.children?.find(c => c.name === 'Base Circle');
    const clipped = grp?.children?.find(c => c.name === 'Clipped Rect');
    const unclipped = grp?.children?.find(c => c.name === 'Unclipped Rect');
    const normal = grp?.children?.find(c => c.name === 'Normal Rect');

    expect(base?.clipping).toBe(false);
    expect(clipped?.clipping).toBe(true);
    expect(unclipped?.clipping).toBeFalsy();
    expect(normal?.clipping).toBeFalsy();
  });

  it('ensures stroke-only vector shapes emit vectorFill with fillEnabled: false for vscg compliance', async () => {
    const layout: LayoutResult = {
      canvas: { width: 200, height: 200 },
      nodes: [
        {
          id: 'stroke-rect',
          type: 'rect',
          name: 'Outlined Rect',
          x: 20,
          y: 20,
          width: 100,
          height: 100,
          style: {
            stroke: '#ff00ff',
            strokeWidth: 4
          },
          box: { x: 20, y: 20, w: 100, h: 100 }
        } as any
      ]
    };

    const buffer = await PsdExporter.export(layout);
    const psd = readPsd(buffer, { skipLayerImageData: true });
    const layer = psd.children?.find(l => l.name === 'Outlined Rect');

    expect(layer).toBeDefined();
    expect(layer?.vectorStroke).toBeDefined();
    expect(layer?.vectorStroke?.strokeEnabled).toBe(true);
    expect(layer?.vectorStroke?.fillEnabled).toBe(false);
    expect(layer?.vectorFill).toBeDefined();
  });

  it('renders canvas.photoSrc on the background layer and composite canvas', async () => {
    const layout: LayoutResult = {
      canvas: {
        width: 100,
        height: 100,
        photoSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      },
      nodes: []
    };

    const buffer = await PsdExporter.export(layout);
    const psd = readPsd(buffer);

    expect(psd.children).toHaveLength(1);
    expect(psd.children?.[0]?.name).toBe('Background');
    expect(psd.canvas).toBeDefined();
  });
});
