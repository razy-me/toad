import { describe, it, expect } from 'vitest';
import { readPsd } from 'ag-psd';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { exportToPsd, PsdExporter } from '../src/engine/psdExporter.js';

describe('PSD Exporter Engine (ag-psd)', () => {
  // ==========================================================================
  // 1. PSD Document Generation & Signature
  // ==========================================================================
  describe('PSD Document Generation', () => {
    it('exports layout to a valid PSD buffer with 8BPS signature', async () => {
      const src = `
        canvas {
          width: 400px;
          height: 300px;
          background: #ffffff;
        }
        rect #box {
          at: 20px 20px;
          size: 100px 80px;
          fill: #3b82f6;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      expect(Buffer.isBuffer(psdBuf)).toBe(true);
      expect(psdBuf.length).toBeGreaterThan(0);

      // PSD Magic Signature: '8BPS'
      expect(psdBuf[0]).toBe(0x38); // '8'
      expect(psdBuf[1]).toBe(0x42); // 'B'
      expect(psdBuf[2]).toBe(0x50); // 'P'
      expect(psdBuf[3]).toBe(0x53); // 'S'
    });

    it('creates PSD document with matching dimensions at 1x and 2x scale', async () => {
      const src = `
        canvas { width: 300px; height: 200px; }
        rect { size: 50px 50px; }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const psd1x = await exportToPsd(layout, { scale: 1 });
      const parsed1x = readPsd(psd1x);
      expect(parsed1x.width).toBe(300);
      expect(parsed1x.height).toBe(200);

      const psd2x = await exportToPsd(layout, { scale: 2 });
      const parsed2x = readPsd(psd2x);
      expect(parsed2x.width).toBe(600);
      expect(parsed2x.height).toBe(400);
    });
  });

  // ==========================================================================
  // 2. Layer Groups & Hierarchy Preservation
  // ==========================================================================
  describe('Layer Groups & Structure', () => {
    it('preserves group hierarchy, layer names, opacity, and blend modes', async () => {
      const src = `
        canvas {
          width: 500px;
          height: 400px;
          background: #0f172a;
        }

        group #headerGroup {
          rect #headerBg {
            at: 0 0;
            size: 500px 60px;
            fill: #1e293b;
            opacity: 0.8;
            blend-mode: multiply;
          }
          rect #logo {
            at: 20px 15px;
            size: 30px 30px;
            fill: #38bdf8;
          }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      expect(psd.children).toBeDefined();
      expect(psd.children!.length).toBeGreaterThanOrEqual(2); // Background + headerGroup

      const group = psd.children!.find(l => l.name === 'headerGroup');
      expect(group).toBeDefined();
      expect(group?.opened).toBe(true);
      expect(group?.children).toBeDefined();
      expect(group?.children!.length).toBe(2);

      const bgLayer = group?.children?.find(c => c.name === 'headerBg');
      expect(bgLayer).toBeDefined();
      expect(bgLayer?.opacity).toBeCloseTo(0.8, 1);
      expect(bgLayer?.blendMode).toBe('multiply');
    });

    it('supports deeply nested layer group hierarchies', async () => {
      const src = `
        canvas { width: 400px; height: 400px; }
        group #level1 {
          group #level2 {
            rect #innerBox { size: 50px 50px; fill: #10b981; }
          }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const l1 = psd.children?.find(l => l.name === 'level1');
      expect(l1).toBeDefined();
      const l2 = l1?.children?.find(l => l.name === 'level2');
      expect(l2).toBeDefined();
      const box = l2?.children?.find(l => l.name === 'innerBox');
      expect(box).toBeDefined();
    });
  });

  // ==========================================================================
  // 3. Native Editable Photoshop Text Layers
  // ==========================================================================
  describe('Native Editable Text Layers & Raster Fallback', () => {
    it('exports text elements as editable Photoshop text layers with formatting', async () => {
      const src = `
        canvas { width: 600px; height: 300px; }
        text #headline {
          at: 30px 40px;
          content: "Pixel Perfect Design DSL";
          font-family: "Arial";
          font-size: 32px;
          fill: #ef4444;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const textLayer = psd.children?.find(l => l.text !== undefined || l.name.includes('Pixel Perfect'));
      expect(textLayer).toBeDefined();
      expect(textLayer?.text).toBeDefined();
      expect(textLayer?.text?.text).toBe('Pixel Perfect Design DSL');
      expect(textLayer?.text?.style?.fontSize).toBe(32);
      expect(textLayer?.text?.style?.fillColor).toBeDefined();
      expect(Math.round((textLayer?.text?.style?.fillColor as any).r)).toBe(239);
    });

    it('exports multi-line text with preserved line breaks', async () => {
      const src = `
        canvas { width: 500px; height: 300px; }
        text #multiLine {
          at: 20px 20px;
          content: "Line One\\nLine Two\\nLine Three";
          font-size: 18px;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const textLayer = psd.children?.find(l => l.text !== undefined);
      expect(textLayer).toBeDefined();
      expect(textLayer?.text?.text).toContain('Line One');
      expect(textLayer?.text?.text).toContain('Line Two');
      expect(textLayer?.text?.text).toContain('Line Three');
    });
  });

  // ==========================================================================
  // 4. Photoshop Clipping Masks
  // ==========================================================================
  describe('PSD Clipping Masks', () => {
    it('sets clipping flag on layers masked by preceding shape', async () => {
      const src = `
        canvas { width: 400px; height: 400px; }
        group #avatarCard {
          rect #maskShape {
            size: 100px 100px;
            clip: true;
          }
          rect #avatarFill {
            size: 150px 150px;
            fill: #3b82f6;
          }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const group = psd.children?.find(l => l.name === 'avatarCard');
      expect(group).toBeDefined();
      expect(group?.children).toHaveLength(2);

      const baseMask = group?.children?.[0];
      const clippedLayer = group?.children?.[1];

      expect(baseMask?.clipping).toBe(false);
      expect(clippedLayer?.clipping).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Vector Shapes & Isolated Canvases
  // ==========================================================================
  describe('Vector Shapes & Canvas Fallbacks', () => {
    it('exports vector shapes (circles, polygons) with isolated layer bounds', async () => {
      const src = `
        canvas { width: 400px; height: 400px; }
        circle #myCircle {
          at: 50px 50px;
          radius: 30px;
          fill: #10b981;
        }
        polygon #myPoly {
          at: 150px 50px;
          size: 60px 60px;
          points: [ (0, -30), (30, 30), (-30, 30) ];
          fill: #f59e0b;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const circle = psd.children?.find(l => l.name === 'myCircle');
      expect(circle).toBeDefined();
      expect(circle?.left).toBe(50);
      expect(circle?.top).toBe(50);
      expect(circle?.right).toBe(110);
      expect(circle?.bottom).toBe(110);

      const poly = psd.children?.find(l => l.name === 'myPoly');
      expect(poly).toBeDefined();
      expect(poly?.left).toBe(150);
      expect(poly?.top).toBe(50);
    });

    it('generates native Photoshop vectorMask and live corner radius descriptor', async () => {
      const src = `
        canvas { width: 500px; height: 500px; }
        rect #roundedCard {
          at: 40px 40px;
          size: 200px 100px;
          radius: 16px;
          fill: #3b82f6;
          stroke: #1d4ed8 2px;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true, readVectorMask: true });

      const card = psd.children?.find(l => l.name === 'roundedCard');
      expect(card).toBeDefined();
      expect(card?.vectorMask).toBeDefined();
      expect(card?.vectorMask?.paths).toHaveLength(1);
      expect(card?.vectorMask?.paths[0]?.knots).toHaveLength(8); // 8 bezier knots for rounded rect
      expect(card?.vectorFill).toBeDefined();
      expect(card?.vectorStroke).toBeDefined();
      expect(card?.vectorOrigination).toBeDefined();
      expect(card?.vectorOrigination?.keyDescriptorList[0]?.keyOriginType).toBe(2); // 2 = rounded rect
      expect(card?.vectorOrigination?.keyDescriptorList[0]?.keyOriginRRectRadii?.topLeft?.value).toBe(16);
    });

    it('generates native Photoshop Drop Shadow Layer Effects and Gradient Fills', async () => {
      const src = `
        canvas { width: 500px; height: 500px; }
        rect #shadowCard {
          at: 50px 50px;
          size: 300px 200px;
          fill: linear-gradient(to bottom, #3b82f6, #1d4ed8);
          shadow: 0px 10px 25px rgba(0, 0, 0, 0.5);
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true, readVectorMask: true, readEffects: true });

      const card = psd.children?.find(l => l.name === 'shadowCard');
      expect(card).toBeDefined();
      expect(card?.vectorFill).toBeDefined();
      expect((card?.vectorFill as any)?.type).toBe('solid'); // Gradient fill descriptor in ag-psd
      expect(card?.effects).toBeDefined();
      expect(card?.effects?.dropShadow).toBeDefined();
      expect(card?.effects?.dropShadow?.[0]?.enabled).toBe(true);
      expect(card?.effects?.dropShadow?.[0]?.opacity).toBe(0.5);
      expect(card?.effects?.dropShadow?.[0]?.distance?.value).toBe(10);
      expect(card?.effects?.dropShadow?.[0]?.size?.value).toBe(25);
    });

    it('exports CSS filter chains as individual toggleable filter and adjustment layers', async () => {
      const src = `
        canvas { size: 500px 500px; }
        rect #filterCard {
          at: 50px 50px;
          size: 300px 200px;
          fill: #3b82f6;
          radius: 16px;
          filter: blur(12px) brightness(1.2) contrast(1.1) saturate(1.5);
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true, readVectorMask: true, readEffects: true });

      const group = psd.children?.find(l => l.name === 'filterCard');
      expect(group).toBeDefined();
      expect(group?.children).toBeDefined();
      expect(group?.children?.length).toBe(5); // Base shape + 4 filter layers

      const baseShape = group?.children?.find(l => l.name === 'filterCard (Base)');
      expect(baseShape).toBeDefined();
      expect(baseShape?.vectorMask).toBeDefined();
      expect(baseShape?.vectorOrigination).toBeDefined();

      const blurLayer = group?.children?.find(l => l.name.includes('Blur'));
      expect(blurLayer).toBeDefined();
      expect(blurLayer?.clipping).toBe(true);

      const brightnessLayer = group?.children?.find(l => l.name.includes('Brightness'));
      expect(brightnessLayer).toBeDefined();
      expect(brightnessLayer?.clipping).toBe(true);
      expect((brightnessLayer as any)?.adjustment?.type).toBe('brightness/contrast');

      const contrastLayer = group?.children?.find(l => l.name.includes('Contrast'));
      expect(contrastLayer).toBeDefined();
      expect(contrastLayer?.clipping).toBe(true);
      expect((contrastLayer as any)?.adjustment?.type).toBe('brightness/contrast');

      const satLayer = group?.children?.find(l => l.name.includes('Saturation'));
      expect(satLayer).toBeDefined();
      expect(satLayer?.clipping).toBe(true);
      expect((satLayer as any)?.adjustment?.type).toBe('hue/saturation');
    });
  });
});
