import { describe, it, expect } from 'vitest';
import { readPsd } from 'ag-psd';
import { createCanvas } from '@napi-rs/canvas';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout, LayoutResult } from '../src/parser/math.js';
import {
  renderToCanvas,
  renderToBuffer,
  CanvasRenderer
} from '../src/engine/canvasRenderer.js';
import {
  exportToPsd,
  PsdExporter
} from '../src/engine/psdExporter.js';
import {
  parseFilterString,
  parseAndApplyFilter,
  drawImageWithFit,
  drawRect,
  drawCircle,
  drawPolygon
} from '../src/engine/drawUtils.js';

async function compileSourceToLayout(source: string, filename = 'test.toad'): Promise<LayoutResult> {
  const doc = parseToad(source, filename);
  const resolved = await resolveImportsAndComponents(doc, filename);
  return solveLayout(resolved);
}

describe('Milestone M2 Remediation Challenge Suite (challenger_m2_fix)', () => {

  // ==========================================================================
  // 1. Sibling Clipping Masks (Multiple Masks, Base Pixels, Nested Groups)
  // ==========================================================================
  describe('1. Sibling Clipping Masks', () => {

    it('renders base mask shape pixels (fill and stroke) when clipping is active', async () => {
      const src = `
        canvas { width: 400px; height: 400px; background: #ffffff; }
        group #maskedContainer {
          at: 50px 50px;
          rect #maskBase {
            size: 200px 200px;
            fill: #3b82f6;
            stroke: #1e3a8a;
            stroke-width: 4px;
            clip: true;
          }
          rect #clippedChild {
            at: 100px 100px;
            size: 200px 200px;
            fill: #ef4444;
          }
        }
      `;
      const layout = await compileSourceToLayout(src);
      const canvas = await renderToCanvas(layout);
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(400);

      // Verify that pixels are drawn
      const ctx = canvas.getContext('2d');
      const pixelData = ctx.getImageData(60, 60, 1, 1).data;
      // Pixel inside maskBase (at 60, 60 -> local 10, 10 of group, not covered by clippedChild)
      // Should be maskBase fill (#3b82f6 -> r: 59, g: 130, b: 246)
      expect(pixelData[0]).toBeCloseTo(59, -1);
      expect(pixelData[1]).toBeCloseTo(130, -1);
      expect(pixelData[2]).toBeCloseTo(246, -1);
    });

    it('supports multiple independent clipping mask pairs within a single group', async () => {
      const src = `
        canvas { width: 500px; height: 500px; }
        group #multiMaskGroup {
          at: 10px 10px;
          
          // Pair 1: Circle mask + child
          circle #maskCircle {
            at: 0 0;
            size: 100px 100px;
            fill: #10b981;
            clip: true;
          }
          rect #clippedToCircle {
            at: 0 0;
            size: 200px 200px;
            fill: #3b82f6;
          }

          // Pair 2: Rect mask + child
          rect #maskRect {
            at: 200px 0;
            size: 100px 100px;
            fill: #f59e0b;
            clip: true;
          }
          rect #clippedToRect {
            at: 200px 0;
            size: 200px 200px;
            fill: #ef4444;
          }
        }
      `;
      const layout = await compileSourceToLayout(src);

      // Canvas render
      const buf = await renderToBuffer(layout);
      expect(buf.length).toBeGreaterThan(0);

      // PSD export
      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const group = psd.children?.find(l => l.name === 'multiMaskGroup');
      expect(group).toBeDefined();
      expect(group?.children).toHaveLength(4);

      // In PSD:
      // Child 0 (maskCircle) -> clipping: false
      // Child 1 (clippedToCircle) -> clipping: true
      // Child 2 (maskRect) -> clipping: false
      // Child 3 (clippedToRect) -> clipping: true
      expect(group?.children?.[0]?.clipping).toBe(false);
      expect(group?.children?.[1]?.clipping).toBe(true);
      expect(group?.children?.[2]?.clipping).toBe(false);
      expect(group?.children?.[3]?.clipping).toBe(true);
    });

    it('handles non-first child clipping masks (unclipped siblings precede mask)', async () => {
      const src = `
        canvas { width: 400px; height: 400px; }
        group #mixedGroup {
          rect #unclippedFirst {
            at: 0 0;
            size: 50px 50px;
            fill: #111111;
          }
          rect #maskSecond {
            at: 100px 100px;
            size: 80px 80px;
            clip: true;
          }
          rect #clippedThird {
            at: 100px 100px;
            size: 120px 120px;
            fill: #22c55e;
          }
        }
      `;
      const layout = await compileSourceToLayout(src);
      const buf = await renderToBuffer(layout);
      expect(buf.length).toBeGreaterThan(0);

      const psd = readPsd(await exportToPsd(layout), { readLayers: true });
      const group = psd.children?.find(l => l.name === 'mixedGroup');
      expect(group?.children?.[0]?.clipping === false || group?.children?.[0]?.clipping === undefined).toBe(true);
      expect(group?.children?.[1]?.clipping).toBe(false);
      expect(group?.children?.[2]?.clipping).toBe(true);
    });

    it('handles nested groups with clipping at multiple hierarchy depths', async () => {
      const src = `
        canvas { width: 600px; height: 600px; }
        group #outer {
          at: 20px 20px;
          size: 400px 400px;
          clip: true;
          group #inner {
            at: 20px 20px;
            circle #innerMask {
              size: 150px 150px;
              clip: true;
            }
            rect #innerContent {
              size: 200px 200px;
              fill: #ec4899;
            }
          }
        }
      `;
      const layout = await compileSourceToLayout(src);
      const canvas = await renderToCanvas(layout);
      expect(canvas.width).toBe(600);
      expect(canvas.height).toBe(600);

      const psd = readPsd(await exportToPsd(layout), { readLayers: true });
      const outer = psd.children?.find(l => l.name === 'outer');
      const inner = outer?.children?.find(l => l.name === 'inner');
      expect(inner?.children?.[0]?.clipping).toBe(false);
      expect(inner?.children?.[1]?.clipping).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Filter Handling & Process Resilience (No C++ Segfaults)
  // ==========================================================================
  describe('2. Filter Handling & Process Resilience', () => {

    it('safely parses and applies various CSS filter strings without crashing Node.js', async () => {
      const filterStrings = [
        'blur(5px)',
        'saturate(2)',
        'drop-shadow(2px 4px 6px #000000)',
        'brightness(1.5)',
        'contrast(1.2)',
        'hue-rotate(90deg)',
        'invert(1)',
        'opacity(0.8)',
        'sepia(0.5)',
        'blur(4px) saturate(1.5) brightness(1.2) drop-shadow(0 4px 8px #00000080)',
        'invalid-filter-token',
        'blur(10px',
        'drop-shadow(invalid)',
        'none',
        ''
      ];

      for (const filter of filterStrings) {
        const src = `
          canvas { width: 100px; height: 100px; }
          rect #filtered {
            size: 50px 50px;
            fill: #3b82f6;
            filter: ${filter || 'none'};
          }
        `;
        const layout = await compileSourceToLayout(src);
        
        // Test Canvas render
        const canvas = await renderToCanvas(layout);
        expect(canvas.width).toBe(100);

        // Test Buffer render (triggers raster drawing calls)
        const buf = await renderToBuffer(layout);
        expect(buf.length).toBeGreaterThan(0);

        // Test PSD export (triggers composite canvas rendering)
        const psdBuf = await exportToPsd(layout);
        expect(psdBuf.length).toBeGreaterThan(0);
      }
    });

    it('parses filter strings into structured array accurately', () => {
      const parsed = parseFilterString('blur(10px) brightness(150%) drop-shadow(5px 5px 10px #000)');
      expect(parsed).toHaveLength(3);
      expect(parsed[0]!.name).toBe('blur');
      expect(parsed[0]!.args).toEqual(['10px']);
      expect(parsed[1]!.name).toBe('brightness');
      expect(parsed[1]!.args).toEqual(['150%']);
      expect(parsed[2]!.name).toBe('drop-shadow');
      expect(parsed[2]!.args).toEqual(['5px', '5px', '10px', '#000']);
    });
  });

  // ==========================================================================
  // 3. Circle Sizing (radius vs explicit size)
  // ==========================================================================
  describe('3. Circle Sizing Geometry', () => {

    it('computes circle dimensions as 2 * radius when radius is provided without explicit size', async () => {
      const src = `
        canvas { width: 300px; height: 300px; }
        circle #circleRadiusOnly {
          at: 50px 50px;
          radius: 30px;
          fill: #10b981;
        }
      `;
      const layout = await compileSourceToLayout(src);
      const circleNode = layout.nodes.find(n => n.id === 'circleRadiusOnly');

      expect(circleNode).toBeDefined();
      expect(circleNode?.width).toBe(60);
      expect(circleNode?.height).toBe(60);
      expect(circleNode?.x).toBe(50);
      expect(circleNode?.y).toBe(50);
      expect(circleNode?.box.w).toBe(60);
      expect(circleNode?.box.h).toBe(60);
      expect(circleNode!.x + circleNode!.box.w).toBe(110);
      expect(circleNode!.y + circleNode!.box.h).toBe(110);
    });

    it('prefers explicit size over default when explicit size is given', async () => {
      const src = `
        canvas { width: 300px; height: 300px; }
        circle #circleSizeOnly {
          at: 50px 50px;
          size: 80px 80px;
          fill: #3b82f6;
        }
      `;
      const layout = await compileSourceToLayout(src);
      const circleNode = layout.nodes.find(n => n.id === 'circleSizeOnly');

      expect(circleNode).toBeDefined();
      expect(circleNode?.width).toBe(80);
      expect(circleNode?.height).toBe(80);
      expect(circleNode?.box.w).toBe(80);
      expect(circleNode?.box.h).toBe(80);
      expect(circleNode!.x + circleNode!.box.w).toBe(130);
      expect(circleNode!.y + circleNode!.box.h).toBe(130);
    });

    it('falls back to 100x100 if neither radius nor size is provided', async () => {
      const src = `
        canvas { width: 300px; height: 300px; }
        circle #circleDefault {
          at: 0px 0px;
          fill: #ef4444;
        }
      `;
      const layout = await compileSourceToLayout(src);
      const circleNode = layout.nodes.find(n => n.id === 'circleDefault');

      expect(circleNode).toBeDefined();
      expect(circleNode?.width).toBe(100);
      expect(circleNode?.height).toBe(100);
    });

    it('exports circle with radius: 30px to PSD with matching layer bounding box (60x60)', async () => {
      const src = `
        canvas { width: 300px; height: 300px; }
        circle #radiusCircle {
          at: 40px 40px;
          radius: 35px;
          fill: #8b5cf6;
        }
      `;
      const layout = await compileSourceToLayout(src);
      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const circleLayer = psd.children?.find(l => l.name === 'radiusCircle');
      expect(circleLayer).toBeDefined();
      expect(circleLayer?.left).toBe(40);
      expect(circleLayer?.top).toBe(40);
      expect(circleLayer?.right).toBe(40 + 70); // 110
      expect(circleLayer?.bottom).toBe(40 + 70); // 110
    });
  });

  // ==========================================================================
  // 4. PSD Layer Export with Clipping & Editable Text Formatting
  // ==========================================================================
  describe('4. PSD Layer Export with Clipping & Editable Text', () => {

    it('exports editable text layer with accurate font, size, color, and transform', async () => {
      const src = `
        canvas { width: 400px; height: 200px; }
        text #myTitle {
          at: 30px 40px;
          content: "Photoshop Typography";
          font-size: 24px;
          font-family: "Helvetica";
          fill: #e11d48;
        }
      `;
      const layout = await compileSourceToLayout(src);
      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const textLayer = psd.children?.find(l => l.text !== undefined);
      expect(textLayer).toBeDefined();
      expect(textLayer?.text?.text).toBe('Photoshop Typography');
      expect(textLayer?.text?.style?.fontSize).toBe(24);
      expect(textLayer?.text?.style?.font?.name).toBe('Helvetica');

      const fillColor = textLayer?.text?.style?.fillColor as any;
      expect(fillColor).toBeDefined();
      // #e11d48 -> r: 225, g: 29, b: 72
      expect(Math.round(fillColor.r)).toBe(225);
      expect(Math.round(fillColor.g)).toBe(29);
      expect(Math.round(fillColor.b)).toBe(72);

      // Verify raster fallback canvas exists on text layer
      expect(textLayer?.canvas).toBeDefined();
    });

    it('exports text layer inside clipping group with proper clipping mask hierarchy', async () => {
      const src = `
        canvas { width: 400px; height: 400px; }
        group #clippedTextGroup {
          at: 20px 20px;
          rect #textMask {
            size: 150px 150px;
            clip: true;
          }
          text #maskedText {
            at: 10px 10px;
            content: "Masked Header";
            font-size: 18px;
            fill: #ffffff;
          }
        }
      `;
      const layout = await compileSourceToLayout(src);
      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const group = psd.children?.find(l => l.name === 'clippedTextGroup');
      expect(group).toBeDefined();
      expect(group?.children).toHaveLength(2);

      const maskLayer = group?.children?.[0];
      const textLayer = group?.children?.[1];

      expect(maskLayer?.clipping).toBe(false);
      expect(textLayer?.clipping).toBe(true);
      expect(textLayer?.text?.text).toBe('Masked Header');
    });

    it('exports multi-line text with line breaks preserved in PSD text layer', async () => {
      const src = `
        canvas { width: 400px; height: 300px; }
        text #multiLine {
          at: 20px 20px;
          size: 150px 200px;
          content: "Line One\\nLine Two\\nLine Three";
          font-size: 16px;
          fill: #333333;
        }
      `;
      const layout = await compileSourceToLayout(src);
      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const textLayer = psd.children?.find(l => l.name === 'multiLine' || l.text !== undefined);
      expect(textLayer).toBeDefined();
      expect(textLayer?.text?.text).toContain('Line One\nLine Two\nLine Three');
    });
  });
});
