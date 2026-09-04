import { describe, it, expect } from 'vitest';
import { PsdExporter } from '../src/engine/psdExporter.js';
import { LayoutResult } from '../src/parser/math.js';
import { readPsd } from 'ag-psd';

describe('PSD Exporter Layer Properties, Effects & Typography', () => {
  it('exports layerColor, lock (protected), knockout and fillOpacity correctly', async () => {
    const layout: LayoutResult = {
      canvas: {
        width: 500,
        height: 500,
        background: '#111827',
        guides: [
          { location: 50, direction: 'horizontal' },
          { location: 250, direction: 'vertical' }
        ],
        globalLight: { angle: 135, altitude: 45 }
      } as any,
      nodes: [
        {
          id: 'card',
          type: 'rect',
          name: 'Glass Card',
          x: 50,
          y: 50,
          width: 300,
          height: 200,
          fill: '#ffffff',
          style: {
            fill: '#ffffff',
            fillOpacity: 0.15,
            layerColor: 'blue',
            lock: 'position',
            knockout: true,
            shadows: [
              { offsetX: 0, offsetY: 4, blur: 6, color: '#00000040', useGlobalLight: true, noise: 5 },
              { offsetX: 0, offsetY: 20, blur: 25, color: '#00000080', useGlobalLight: true }
            ],
            gradientOverlay: {
              type: 'linear',
              angle: 90,
              stops: [
                { color: '#ffffff40', position: 0 },
                { color: '#00000000', position: 1 }
              ]
            }
          },
          box: { x: 50, y: 50, w: 300, h: 200 }
        } as any
      ]
    };

    const buffer = await PsdExporter.export(layout);
    const psd = readPsd(buffer, { skipLayerImageData: true });

    // 1. Guides & Global Light in ImageResources
    expect(psd.imageResources).toBeDefined();
    expect(psd.imageResources?.gridAndGuidesInformation?.guides?.length).toBe(2);
    expect(psd.imageResources?.globalAngle).toBe(135);
    expect(psd.imageResources?.globalAltitude).toBe(45);

    // 2. Layer attributes
    const cardLayer = psd.children?.find(l => l.name === 'Glass Card');
    expect(cardLayer).toBeDefined();
    expect(cardLayer?.layerColor).toBe('blue');
    expect(cardLayer?.fillOpacity).toBeCloseTo(0.15, 2);
    expect(cardLayer?.knockout).toBe(true);
    expect(cardLayer?.protected?.position).toBe(true);

    // 3. Multi drop shadow effects & gradient overlay
    expect(cardLayer?.effects?.dropShadow).toBeDefined();
    expect(cardLayer?.effects?.dropShadow?.length).toBe(2);
    expect(cardLayer?.effects?.dropShadow?.[0]!.useGlobalLight).toBe(true);
    expect(cardLayer?.effects?.dropShadow?.[0]!.noise).toBe(5);

    expect(cardLayer?.effects?.gradientOverlay).toBeDefined();
    expect(cardLayer?.effects?.gradientOverlay?.length).toBe(1);
  });

  it('exports typography flags: fontCaps, spaceAfter, firstLineIndent, ligatures', async () => {
    const layout: LayoutResult = {
      canvas: { width: 400, height: 200 },
      nodes: [
        {
          id: 'title',
          type: 'text',
          name: 'Main Title',
          x: 20,
          y: 20,
          width: 360,
          height: 60,
          style: {
            color: '#ffffff',
            textTransform: 'uppercase',
            spaceAfter: 12,
            firstLineIndent: 24,
            ligatures: true
          } as any,
          textLayout: {
            lines: ['Header text'],
            width: 360,
            height: 60,
            fontSize: 24,
            lineHeight: 30,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            fontStyle: 'normal',
            ascent: 20,
            descent: 4
          },
          box: { x: 20, y: 20, w: 360, h: 60 }
        } as any
      ]
    };

    const buffer = await PsdExporter.export(layout);
    const psd = readPsd(buffer, { skipLayerImageData: true });
    const textLayer = psd.children?.find(l => l.name.includes('Header text'));

    expect(textLayer).toBeDefined();
    expect(textLayer?.text?.style?.fontCaps).toBe(1); // 1 = All Caps
    expect(textLayer?.text?.style?.ligatures).toBe(true);
    expect(textLayer?.text?.paragraphStyle?.spaceAfter).toBe(12);
    expect(textLayer?.text?.paragraphStyle?.firstLineIndent).toBe(24);
  });
});
