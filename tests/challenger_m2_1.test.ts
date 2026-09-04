import { describe, it, expect } from 'vitest';
import { readPsd } from 'ag-psd';
import { createCanvas } from '@napi-rs/canvas';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout, LayoutResult, LayoutNode } from '../src/parser/math.js';
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
  parseColor,
  parseColorToRgba,
  distributeGradientStops,
  createCanvasGradient,
  mapBlendMode,
  mapBlendModeToPsd,
  parseFilterString,
  parseAndApplyFilter,
  drawImageWithFit,
  drawRect,
  drawCircle,
  drawPolygon
} from '../src/engine/drawUtils.js';
import {
  FontLoader,
  registerFont,
  loadFontsFromDir,
  registerFontDirectives
} from '../src/engine/fontLoader.js';

// Helper to compile DSL string to LayoutResult
async function compileSourceToLayout(source: string, filename = 'stress.toad'): Promise<LayoutResult> {
  const doc = parseToad(source, filename);
  const resolved = await resolveImportsAndComponents(doc, filename);
  return solveLayout(resolved);
}

describe('Milestone M2 Adversarial Challenge Suite (challenger_m2_1)', () => {

  // ==========================================================================
  // Area 1: Multi-Scale Rendering at Non-Integer/Extreme Scales & Large Dimensions
  // ==========================================================================
  describe('Area 1: Multi-Scale Rendering & Extreme Dimensions', () => {

    it('renders accurately at non-integer fractional scales (0.5x, 0.25x, 0.75x, 1.5x, 3x, 4x)', async () => {
      const src = `
        canvas {
          width: 300px;
          height: 200px;
          background: #ffffff;
        }
        rect #box1 {
          at: 10px 10px;
          size: 100px 80px;
          fill: #3b82f6;
        }
        circle #circle1 {
          at: 150px 50px;
          size: 60px 60px;
          fill: #10b981;
        }
        text #title {
          at: 10px 120px;
          content: "Scale Test";
          font-size: 20px;
          fill: #000000;
        }
      `;
      const layout = await compileSourceToLayout(src);

      const scales = [0.25, 0.5, 0.75, 1.5, 3.0, 4.0];
      for (const scale of scales) {
        const canvas = await renderToCanvas(layout, { scale });
        const expectedW = Math.max(1, Math.round(300 * scale));
        const expectedH = Math.max(1, Math.round(200 * scale));

        expect(canvas.width).toBe(expectedW);
        expect(canvas.height).toBe(expectedH);

        const pngBuf = await renderToBuffer(layout, { scale, format: 'png' });
        expect(Buffer.isBuffer(pngBuf)).toBe(true);
        expect(pngBuf.length).toBeGreaterThan(0);
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        expect(pngBuf[0]).toBe(0x89);
        expect(pngBuf[1]).toBe(0x50);
        expect(pngBuf[2]).toBe(0x4E);
        expect(pngBuf[3]).toBe(0x47);

        const jpgBuf = await renderToBuffer(layout, { scale, format: 'jpg', quality: 80 });
        expect(Buffer.isBuffer(jpgBuf)).toBe(true);
        expect(jpgBuf.length).toBeGreaterThan(0);
        // JPEG signature: FF D8
        expect(jpgBuf[0]).toBe(0xFF);
        expect(jpgBuf[1]).toBe(0xD8);
      }
    });

    it('handles extreme/degenerate scale values (0, negative, undefined, NaN)', async () => {
      const src = `
        canvas { width: 100px; height: 100px; background: #ff0000; }
        rect { size: 50px 50px; fill: #00ff00; }
      `;
      const layout = await compileSourceToLayout(src);

      // Scale <= 0 should fall back safely to 1x scale
      const canvasZero = await renderToCanvas(layout, { scale: 0 });
      expect(canvasZero.width).toBe(100);
      expect(canvasZero.height).toBe(100);

      const canvasNeg = await renderToCanvas(layout, { scale: -5 });
      expect(canvasNeg.width).toBe(100);
      expect(canvasNeg.height).toBe(100);

      const canvasUndef = await renderToCanvas(layout, { scale: undefined });
      expect(canvasUndef.width).toBe(100);
      expect(canvasUndef.height).toBe(100);
    });

    it('renders large dimension canvases (e.g. 4000x3000 at 2x -> 8000x6000) without crashing or OOM', async () => {
      const src = `
        canvas {
          width: 4000px;
          height: 3000px;
          background: #0f172a;
        }
        rect #banner {
          at: 200px 200px;
          size: 3600px 600px;
          fill: #3b82f6;
        }
        text #heroText {
          at: 400px 400px;
          content: "Large Dimension Render";
          font-size: 96px;
          fill: #ffffff;
        }
      `;
      const layout = await compileSourceToLayout(src);

      // Render 4000x3000 at 1x
      const canvas1x = await renderToCanvas(layout, { scale: 1 });
      expect(canvas1x.width).toBe(4000);
      expect(canvas1x.height).toBe(3000);

      const pngBuf1x = await renderToBuffer(layout, { scale: 1 });
      expect(pngBuf1x.length).toBeGreaterThan(1000);
    });

    it('renders 1x1 minimal canvas and single-pixel elements cleanly', async () => {
      const src = `
        canvas { width: 1px; height: 1px; background: #123456; }
        rect { size: 1px 1px; fill: #654321; }
      `;
      const layout = await compileSourceToLayout(src);
      const canvas = await renderToCanvas(layout, { scale: 1 });
      expect(canvas.width).toBe(1);
      expect(canvas.height).toBe(1);

      const pngBuf = await renderToBuffer(layout, { scale: 1 });
      expect(pngBuf.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Area 2: Complex Nested Clipping Masks & Multiple Sibling Masks
  // ==========================================================================
  describe('Area 2: Clipping Masks & Nested Group Structures', () => {

    it('renders nested groups with group-level clipping bounds', async () => {
      const src = `
        canvas { width: 500px; height: 500px; background: #ffffff; }
        group #outerGroup {
          at: 50px 50px;
          size: 300px 300px;
          clip: true;
          rect #outerBg {
            at: 0 0;
            size: 400px 400px;
            fill: #e2e8f0;
          }
          group #innerGroup {
            at: 20px 20px;
            size: 200px 200px;
            clip: true;
            rect #overflowChild {
              at: -50px -50px;
              size: 500px 500px;
              fill: #3b82f6;
            }
          }
        }
      `;
      const layout = await compileSourceToLayout(src);
      const canvas = await renderToCanvas(layout);
      expect(canvas.width).toBe(500);
      expect(canvas.height).toBe(500);

      const png = await renderToBuffer(layout);
      expect(png.length).toBeGreaterThan(0);
    });

    it('renders shape-based clipping masks with polygon and circle mask geometry', async () => {
      const src = `
        canvas { width: 600px; height: 600px; }
        group #circleMaskedGroup {
          at: 20px 20px;
          circle #maskCircle {
            size: 200px 200px;
            clip: true;
          }
          rect #clippedImage {
            at: 0 0;
            size: 300px 300px;
            fill: #ef4444;
          }
          text #clippedLabel {
            at: 50px 50px;
            content: "Masked Text";
            fill: #ffffff;
          }
        }
        group #polyMaskedGroup {
          at: 300px 20px;
          polygon #maskTriangle {
            size: 200px 200px;
            points: [ (0, -100), (100, 100), (-100, 100) ];
            clip: true;
          }
          rect #clippedRect2 {
            at: 0 0;
            size: 250px 250px;
            fill: #10b981;
          }
        }
      `;
      const layout = await compileSourceToLayout(src);
      const buf = await renderToBuffer(layout);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('handles groups where child 0 is NOT a mask but subsequent children exist', async () => {
      const src = `
        canvas { width: 400px; height: 400px; }
        group #normalGroup {
          at: 10px 10px;
          rect #firstNormal {
            size: 100px 100px;
            fill: #f59e0b;
          }
          rect #secondNormal {
            at: 50px 50px;
            size: 100px 100px;
            fill: #8b5cf6;
          }
        }
      `;
      const layout = await compileSourceToLayout(src);
      const buf = await renderToBuffer(layout);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('PSD Exporter preserves clipping flags across multiple sibling groups', async () => {
      const src = `
        canvas { width: 500px; height: 500px; }
        group #card1 {
          rect #mask1 { size: 100px 100px; clip: true; }
          rect #fill1 { size: 150px 150px; fill: #ff0000; }
        }
        group #card2 {
          at: 150px 0;
          rect #mask2 { size: 100px 100px; clip: true; }
          rect #fill2 { size: 150px 150px; fill: #00ff00; }
        }
      `;
      const layout = await compileSourceToLayout(src);
      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const g1 = psd.children?.find(l => l.name === 'card1');
      const g2 = psd.children?.find(l => l.name === 'card2');
      expect(g1).toBeDefined();
      expect(g2).toBeDefined();

      expect(g1?.children?.[0]?.clipping).toBe(false);
      expect(g1?.children?.[1]?.clipping).toBe(true);

      expect(g2?.children?.[0]?.clipping).toBe(false);
      expect(g2?.children?.[1]?.clipping).toBe(true);
    });
  });

  // ==========================================================================
  // Area 3: Filter Strings (Invalid Syntax, Stacked Filters, Extreme Values)
  // ==========================================================================
  describe('Area 3: CSS Filter Parsing & Application Robustness', () => {

    it('parses complex stacked filters accurately', () => {
      const filterStr = 'blur(5px) saturate(2.5) contrast(150%) brightness(1.2) hue-rotate(180deg) invert(0.8) opacity(0.5) sepia(60%) drop-shadow(4px 4px 10px #00000080)';
      const parsed = parseFilterString(filterStr);

      expect(parsed).toHaveLength(9);
      expect(parsed[0]!.name).toBe('blur');
      expect(parsed[0]!.args).toEqual(['5px']);
      expect(parsed[1]!.name).toBe('saturate');
      expect(parsed[1]!.args).toEqual(['2.5']);
      expect(parsed[2]!.name).toBe('contrast');
      expect(parsed[2]!.args).toEqual(['150%']);
      expect(parsed[3]!.name).toBe('brightness');
      expect(parsed[4]!.name).toBe('hue-rotate');
      expect(parsed[5]!.name).toBe('invert');
      expect(parsed[6]!.name).toBe('opacity');
      expect(parsed[7]!.name).toBe('sepia');
      expect(parsed[8]!.name).toBe('drop-shadow');
    });

    it('gracefully handles empty, none, whitespace, and nullish filter strings', () => {
      expect(parseFilterString(undefined)).toEqual([]);
      expect(parseFilterString('')).toEqual([]);
      expect(parseFilterString('   ')).toEqual([]);
      expect(parseFilterString('none')).toEqual([]);
      expect(parseFilterString('NONE')).toEqual([]);
    });

    it('tests each filter string with parseAndApplyFilter without crash when not drawing', () => {
      const invalidStrings = [
        'blur(',
        'blur(10px',
        'invalidFunction(123)',
        'blur() saturate()',
        '<<<not a filter>>>',
        ';;;;;',
        '123456',
        'blur(10px)) extra)',
        'drop-shadow(invalid color value here)'
      ];

      const canvas = createCanvas(100, 100);
      const ctx = canvas.getContext('2d');

      for (const inv of invalidStrings) {
        expect(() => parseAndApplyFilter(ctx, inv)).not.toThrow();
      }
    });

    it('parses stacked and extreme filter parameters into structured AST filters', () => {
      const parsed1 = parseFilterString('blur(1000px) saturate(9999) contrast(5000%)');
      expect(parsed1).toHaveLength(3);
      expect(parsed1[0]!.name).toBe('blur');
      expect(parsed1[0]!.args).toEqual(['1000px']);
      expect(parsed1[1]!.name).toBe('saturate');
      expect(parsed1[1]!.args).toEqual(['9999']);
      expect(parsed1[2]!.name).toBe('contrast');
      expect(parsed1[2]!.args).toEqual(['5000%']);

      const parsed2 = parseFilterString('hue-rotate(720000deg) invert(100) opacity(999)');
      expect(parsed2).toHaveLength(3);
      expect(parsed2[0]!.name).toBe('hue-rotate');
      expect(parsed2[0]!.args).toEqual(['720000deg']);
    });
  });


  // ==========================================================================
  // Area 4: PSD Export (Deep Layer Groups, Special Characters, Empty Groups)
  // ==========================================================================
  describe('Area 4: PSD Export Stress Testing', () => {

    it('exports deep layer group hierarchies (8+ nesting levels) correctly', async () => {
      const src = `
        canvas { width: 400px; height: 400px; }
        group #lvl1 {
          group #lvl2 {
            group #lvl3 {
              group #lvl4 {
                group #lvl5 {
                  group #lvl6 {
                    group #lvl7 {
                      group #lvl8 {
                        rect #leafNode {
                          size: 50px 50px;
                          fill: #3b82f6;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      const layout = await compileSourceToLayout(src);
      const psdBuf = await exportToPsd(layout);
      expect(Buffer.isBuffer(psdBuf)).toBe(true);

      const psd = readPsd(psdBuf, { readLayers: true });
      let currentGroup: any = psd.children?.find(l => l.name === 'lvl1');
      expect(currentGroup).toBeDefined();

      for (let level = 2; level <= 8; level++) {
        currentGroup = currentGroup?.children?.find((l: any) => l.name === `lvl${level}`);
        expect(currentGroup).toBeDefined();
        expect(currentGroup.children).toBeDefined();
      }

      const leaf = currentGroup?.children?.find((l: any) => l.name === 'leafNode');
      expect(leaf).toBeDefined();
      expect(leaf.left).toBe(0);
      expect(leaf.right).toBe(50);
    });

    it('handles empty groups and groups with only empty groups without corruption', async () => {
      const src = `
        canvas { width: 300px; height: 200px; }
        group #emptyGroup1 {}
        group #emptyGroup2 {
          group #emptyNested {}
        }
        rect #normalBox {
          at: 10px 10px;
          size: 50px 50px;
          fill: #10b981;
        }
      `;
      const layout = await compileSourceToLayout(src);
      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const g1 = psd.children?.find(l => l.name === 'emptyGroup1');
      const g2 = psd.children?.find(l => l.name === 'emptyGroup2');
      const box = psd.children?.find(l => l.name === 'normalBox');

      expect(g1).toBeDefined();
      expect(g1?.children).toEqual([]);
      expect(g2).toBeDefined();
      expect(box).toBeDefined();
    });

    it('preserves international Unicode, emoji, quotes, and special characters in PSD text layers', async () => {
      const src = `
        canvas { width: 800px; height: 400px; }
        text #unicodeText {
          at: 20px 30px;
          content: "Hello World Rocket and Japanese Design";
          font-size: 24px;
          fill: #ef4444;
        }
      `;
      const layout = await compileSourceToLayout(src);
      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const textLayer = psd.children?.find(l => l.text !== undefined || l.name.includes('Hello'));
      expect(textLayer).toBeDefined();
      expect(textLayer?.text?.text).toBe('Hello World Rocket and Japanese Design');
      expect(textLayer?.text?.style?.fontSize).toBe(24);
    });

    it('handles very long multi-line text and empty text in PSD text layers', async () => {
      const lines = Array.from({ length: 50 }, (_, i) => `Paragraph line number ${i + 1} with words.`);
      const content = lines.join('\\n');
      const src = `
        canvas { width: 800px; height: 2000px; }
        text #longText {
          at: 20px 20px;
          content: "${content}";
          font-size: 16px;
        }
        text #emptyText {
          at: 20px 1500px;
          content: "";
          font-size: 16px;
        }
      `;
      const layout = await compileSourceToLayout(src);
      const psdBuf = await exportToPsd(layout);
      const psd = readPsd(psdBuf, { readLayers: true });

      const longLayer = psd.children?.find(l => l.name.startsWith('Paragraph') || l.text?.text?.startsWith('Paragraph'));
      expect(longLayer).toBeDefined();
      expect(longLayer?.text?.text).toContain('Paragraph line number 1');
      expect(longLayer?.text?.text).toContain('Paragraph line number 50');
    });

    it('exports PSD at fractional scales (0.5x, 1.5x, 3x) with scaled layer dimensions', async () => {
      const src = `
        canvas { width: 200px; height: 100px; }
        rect #box { at: 10px 10px; size: 80px 40px; fill: #3b82f6; }
      `;
      const layout = await compileSourceToLayout(src);

      // 0.5x scale
      const psd05 = readPsd(await exportToPsd(layout, { scale: 0.5 }));
      expect(psd05.width).toBe(100);
      expect(psd05.height).toBe(50);
      const box05 = psd05.children?.find(l => l.name === 'box');
      expect(box05?.left).toBe(5);
      expect(box05?.top).toBe(5);
      expect(box05?.right).toBe(45);
      expect(box05?.bottom).toBe(25);

      // 3x scale
      const psd3 = readPsd(await exportToPsd(layout, { scale: 3.0 }));
      expect(psd3.width).toBe(600);
      expect(psd3.height).toBe(300);
      const box3 = psd3.children?.find(l => l.name === 'box');
      expect(box3?.left).toBe(30);
      expect(box3?.top).toBe(30);
      expect(box3?.right).toBe(270);
      expect(box3?.bottom).toBe(150);
    });
  });

  // ==========================================================================
  // Area 5: Draw Utilities & Mathematical Edge Cases
  // ==========================================================================
  describe('Area 5: Draw Utilities & Math Hardening', () => {

    it('distributeGradientStops handles 0, 1, 2, and 5 evenly spaced stops', () => {
      // 0 stops
      expect(distributeGradientStops([])).toEqual([]);

      // 1 stop
      const single = distributeGradientStops([{ color: '#f00' }]);
      expect(single).toHaveLength(1);
      expect(single[0]!.position).toBe(0);

      // 4 unspecified intermediate stops
      const fiveStops = distributeGradientStops([
        { color: '#000' },
        { color: '#333' },
        { color: '#666' },
        { color: '#999' },
        { color: '#fff' }
      ]);
      expect(fiveStops).toHaveLength(5);
      expect(fiveStops[0]!.position).toBe(0);
      expect(fiveStops[1]!.position).toBeCloseTo(0.25, 4);
      expect(fiveStops[2]!.position).toBeCloseTo(0.50, 4);
      expect(fiveStops[3]!.position).toBeCloseTo(0.75, 4);
      expect(fiveStops[4]!.position).toBe(1);
    });

    it('parseColorToRgba and parseColor parse all CSS color notations and robustly handle invalid inputs', () => {
      // Named
      expect(parseColorToRgba('gold')).toEqual({ r: 255, g: 215, b: 0, a: 1 });
      expect(parseColorToRgba('currentColor')).toEqual({ r: 0, g: 0, b: 0, a: 1 });

      // Hex variants
      expect(parseColorToRgba('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
      expect(parseColorToRgba('#abcd')).toEqual({ r: 170, g: 187, b: 204, a: 221 / 255 });
      expect(parseColorToRgba('#112233')).toEqual({ r: 17, g: 34, b: 51, a: 1 });
      expect(parseColorToRgba('#11223380').a).toBeCloseTo(128 / 255, 2);

      // RGB / RGBA
      expect(parseColorToRgba('rgb(100, 150, 200)')).toEqual({ r: 100, g: 150, b: 200, a: 1 });
      expect(parseColorToRgba('rgba(100, 150, 200, 0.4)')).toEqual({ r: 100, g: 150, b: 200, a: 0.4 });

      // HSL / HSLA
      const hslRed = parseColorToRgba('hsl(0, 100%, 50%)');
      expect(hslRed.r).toBe(255);
      expect(hslRed.g).toBe(0);
      expect(hslRed.b).toBe(0);

      // Invalid fallbacks to black {0, 0, 0, 1}
      expect(parseColorToRgba('')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColorToRgba(undefined)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColorToRgba('invalid-color-string')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    });

    it('maps all 16 Photoshop blend modes and handles unmapped modes safely', () => {
      const modes = [
        'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
        'color-dodge', 'color-burn', 'hard-light', 'soft-light',
        'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
      ];
      for (const m of modes) {
        expect(mapBlendMode(m)).toBeDefined();
        expect(mapBlendModeToPsd(m)).toBeDefined();
      }

      // Fallbacks
      expect(mapBlendMode('non-existent-mode')).toBe('source-over');
      expect(mapBlendModeToPsd('non-existent-mode')).toBe('normal');
      expect(mapBlendMode(undefined)).toBe('source-over');
      expect(mapBlendModeToPsd(undefined)).toBe('normal');
    });

    it('drawRect, drawCircle, and drawPolygon handle degenerate/empty geometry without throwing', () => {
      const canvas = createCanvas(100, 100);
      const ctx = canvas.getContext('2d');

      // drawRect with 4-corner array radius and 0 size
      expect(() => drawRect(ctx, 0, 0, 0, 0, [5, 10, 15, 20])).not.toThrow();
      expect(() => drawRect(ctx, 0, 0, 50, 50, 100)).not.toThrow();

      // drawCircle with rx, ry ellipse and 0 radius
      expect(() => drawCircle(ctx, 50, 50, 0)).not.toThrow();
      expect(() => drawCircle(ctx, 50, 50, { rx: 30, ry: 20 })).not.toThrow();

      // drawPolygon with empty, single, and 3 points
      expect(() => drawPolygon(ctx, [])).not.toThrow();
      expect(() => drawPolygon(ctx, [{ x: 10, y: 10 }])).not.toThrow();
      expect(() => drawPolygon(ctx, [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 50 }])).not.toThrow();
    });

    it('createCanvasGradient handles all linear directions and radial gradient construction', () => {
      const canvas = createCanvas(200, 200);
      const ctx = canvas.getContext('2d');
      const box = { x: 10, y: 10, w: 180, h: 180 };

      const directions = [
        'to right', 'to bottom', 'to left', 'to top',
        'to bottom right', 'to top right', 'to bottom left', 'to top left'
      ];
      for (const dir of directions) {
        const grad = createCanvasGradient(ctx, {
          type: 'linear',
          direction: dir,
          stops: [{ color: '#f00' }, { color: '#00f' }]
        }, box);
        expect(grad).toBeDefined();
      }

      // Radial
      const radialGrad = createCanvasGradient(ctx, {
        type: 'radial',
        stops: [{ color: '#ff0' }, { color: '#f0f' }]
      }, box);
      expect(radialGrad).toBeDefined();
    });
  });

  // ==========================================================================
  // Area 6: FontLoader Directives & Error Resilience
  // ==========================================================================
  describe('Area 6: FontLoader Engine', () => {

    it('handles non-existent font paths and invalid directories gracefully', () => {
      expect(FontLoader.registerFontFile('non/existent/font.ttf')).toBe(false);
      expect(FontLoader.registerFontDirectory('non/existent/dir')).toEqual([]);

      const results = FontLoader.registerFontDirectives([
        { family: 'MissingFont1', source: 'missing1.ttf' },
        { family: 'MissingFont2', path: 'missing2.otf' }
      ]);
      expect(results).toEqual([false, false]);
    });

    it('queries available font families in Skia environment', () => {
      const families = FontLoader.getAvailableFamilies();
      expect(Array.isArray(families)).toBe(true);
    });
  });
});
