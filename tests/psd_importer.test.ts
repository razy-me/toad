import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { PsdExporter } from '../src/engine/psdExporter.js';
import {
  importPsd,
  parsePostScriptFont,
  psdColorToToad,
  bezierPathToSvgD
} from '../src/importers/psdImporter.js';
import { initializeCanvas, writePsdBuffer, Psd, Layer } from 'ag-psd';
import { createCanvas } from '@napi-rs/canvas';

describe('PSD to TOAD Converter (psdImporter)', () => {
  beforeAll(() => {
    initializeCanvas((width: number, height: number) => {
      return createCanvas(width, height) as unknown as HTMLCanvasElement;
    });
  });

  describe('Utility Functions', () => {
    it('parses diverse PostScript font names accurately', () => {
      expect(parsePostScriptFont('Inter-SemiBold')).toEqual({
        fontFamily: 'Inter',
        fontWeight: 600,
        isItalic: false
      });

      expect(parsePostScriptFont('Arial-BoldItalicMT')).toEqual({
        fontFamily: 'Arial',
        fontWeight: 700,
        isItalic: true
      });

      expect(parsePostScriptFont('HelveticaNeue-Light')).toEqual({
        fontFamily: 'Helvetica Neue',
        fontWeight: 300,
        isItalic: false
      });

      expect(parsePostScriptFont('Roboto-Thin')).toEqual({
        fontFamily: 'Roboto',
        fontWeight: 100,
        isItalic: false
      });

      expect(parsePostScriptFont('TimesNewRomanPS-BoldMT')).toEqual({
        fontFamily: 'Times New Roman',
        fontWeight: 700,
        isItalic: false
      });
    });

    it('converts color structures to TOAD hex and alpha strings', () => {
      expect(psdColorToToad({ r: 255, g: 0, b: 0 })).toBe('#FF0000');
      expect(psdColorToToad({ r: 0, g: 255, b: 0, a: 0.5 })).toBe('alpha(#00FF00, 0.5)');
      expect(psdColorToToad({ fr: 0, fg: 0, fb: 1 })).toBe('#0000FF');
      expect(psdColorToToad({ k: 0 })).toBe('#FFFFFF');
    });

    it('converts BezierPath knots into SVG path d commands', () => {
      const pathData = {
        open: false,
        fillRule: 'even-odd' as const,
        knots: [
          { linked: false, points: [0, 0, 0, 0, 0, 0] },
          { linked: false, points: [100, 0, 100, 0, 100, 0] },
          { linked: false, points: [100, 100, 100, 100, 100, 100] }
        ]
      };
      const d = bezierPathToSvgD(pathData);
      expect(d).toContain('M 0 0');
      expect(d).toContain('L 100 0');
      expect(d).toContain('L 100 100');
      expect(d).toContain('Z');
    });
  });

  describe('End-to-End Round-Trip: TOAD -> PSD -> TOAD', () => {
    it('imports an exported PSD back into valid and parseable TOAD DSL', async () => {
      const originalDsl = `
        canvas "Card Preview" {
          size: 600px 400px;
          fill: #0F172A;
        }

        rect #cardBg "Main Card" {
          at: 50px 50px;
          size: 500px 300px;
          fill: #1E293B;
          shadow: 0px 8px 20px #000000;
        }

        text #headline "Hello Photoshop Importer" {
          at: 80px 100px;
          font-family: "Arial";
          font-size: 24px;
          color: #F8FAFC;
        }
      `;

      // 1. Compile original DSL
      const ast = parseToad(originalDsl, 'test.toad');
      const resolved = await resolveImportsAndComponents(ast, 'test.toad');
      const layout = await solveLayout(resolved);

      // 2. Export to Photoshop PSD Buffer
      const psdBuffer = await PsdExporter.export(layout);
      expect(psdBuffer).toBeDefined();
      expect(psdBuffer.length).toBeGreaterThan(0);

      // 3. Import PSD Buffer back into TOAD DSL
      const result = await importPsd(psdBuffer, {
        formatCode: true,
        extractImages: false
      });

      expect(result.toadCode).toBeDefined();
      expect(result.toadCode).toContain('canvas');
      expect(result.toadCode).toContain('600px 400px');
      expect(result.toadCode).toContain('Hello Photoshop Importer');
      expect(result.toadCode).toContain('font-size: 24px;');
      expect(result.stats.textCount).toBeGreaterThanOrEqual(1);

      // 4. Verify that generated code passes the TOAD compiler parser cleanly
      const reAst = parseToad(result.toadCode, 'roundtrip.toad');
      const errors = reAst.diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Raster Image Extraction', () => {
    const testOutDir = path.resolve('tests/dist/psd_test');
    const testAssetsDir = path.join(testOutDir, 'assets');

    afterAll(() => {
      if (fs.existsSync(testOutDir)) {
        fs.rmSync(testOutDir, { recursive: true, force: true });
      }
    });

    it('extracts pixel bitmap layers as PNG files and generates image blocks', async () => {
      if (!fs.existsSync(testOutDir)) {
        fs.mkdirSync(testOutDir, { recursive: true });
      }

      // Create a synthetic PSD with a pixel canvas layer
      const canvas1 = createCanvas(100, 80);
      const ctx1 = canvas1.getContext('2d');
      ctx1.fillStyle = '#FF5500';
      ctx1.fillRect(0, 0, 100, 80);

      const syntheticPsd: Psd = {
        width: 400,
        height: 300,
        children: [
          {
            name: 'Orange Banner',
            left: 20,
            top: 30,
            right: 120,
            bottom: 110,
            canvas: canvas1 as unknown as HTMLCanvasElement
          }
        ]
      };

      const psdBuffer = writePsdBuffer(syntheticPsd);
      const toadOutFile = path.join(testOutDir, 'test_output.toad');

      const result = await importPsd(psdBuffer, {
        outPath: toadOutFile,
        assetsDir: testAssetsDir,
        extractImages: true
      });

      expect(result.assets).toHaveLength(1);
      expect(fs.existsSync(result.assets[0]!.filePath)).toBe(true);
      expect(result.toadCode).toContain('image');
      expect(result.toadCode).toContain('fit: cover;');
      expect(result.toadCode).toContain('size: 100px 80px;');

      // Verify that re-parsing generated code is valid
      const ast = parseToad(result.toadCode, toadOutFile);
      const errors = ast.diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Fidelity Hardening & Edge Cases', () => {
    it('generates mask property for clipped layers', async () => {
      const syntheticPsd: Psd = {
        width: 500,
        height: 400,
        children: [
          {
            name: 'Base Shape',
            left: 50,
            top: 50,
            right: 250,
            bottom: 250,
            vectorMask: {
              paths: [{
                open: false,
                knots: [
                  { linked: false, points: [50, 50, 50, 50, 50, 50] },
                  { linked: false, points: [250, 50, 250, 50, 250, 50] },
                  { linked: false, points: [250, 250, 250, 250, 250, 250] },
                  { linked: false, points: [50, 250, 50, 250, 50, 250] }
                ]
              }]
            }
          },
          {
            name: 'Clipped Overlay',
            left: 60,
            top: 60,
            right: 240,
            bottom: 240,
            clipping: true,
            clipped: true,
            text: {
              text: 'Clipped Text',
              style: { fontSize: 20 }
            }
          }
        ]
      };

      const psdBuf = writePsdBuffer(syntheticPsd);
      const res = await importPsd(psdBuf, { extractImages: false });

      expect(res.toadCode).toContain('mask: #Base_Shape;');
      expect(res.toadCode).toContain('Clipped Text');

      const reAst = parseToad(res.toadCode, 'clipping.toad');
      expect(reAst.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('emits explicit at and size coordinates on group folders with relative child offsets', async () => {
      const c1 = createCanvas(300, 40);
      const c2 = createCanvas(400, 80);
      const syntheticPsd: Psd = {
        width: 800,
        height: 600,
        children: [
          {
            name: 'Card Folder',
            children: [
              {
                name: 'Header',
                left: 100,
                top: 80,
                right: 400,
                bottom: 120,
                canvas: c1 as unknown as HTMLCanvasElement,
                text: { text: 'Card Header', style: { fontSize: 24 } }
              },
              {
                name: 'Body',
                left: 100,
                top: 140,
                right: 500,
                bottom: 220,
                canvas: c2 as unknown as HTMLCanvasElement,
                text: { text: 'Card Body Prose', style: { fontSize: 16 } }
              }
            ]
          }
        ]
      };

      const psdBuf = writePsdBuffer(syntheticPsd);
      const res = await importPsd(psdBuf, { extractImages: false });

      expect(res.toadCode).toContain('group #Card_Folder');
      expect(res.toadCode).toContain('at: 100px 80px;');
      expect(res.toadCode).toContain('size: 400px 140px;'); // 500 - 100 = 400, 220 - 80 = 140

      // Children should have local offsets relative to group origin (100, 80)
      expect(res.toadCode).toContain('at: 0px 0px;');   // 100 - 100 = 0, 80 - 80 = 0
      expect(res.toadCode).toContain('at: 0px 60px;');  // 100 - 100 = 0, 140 - 80 = 60

      const reAst = parseToad(res.toadCode, 'group.toad');
      expect(reAst.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('normalizes carriage returns and emits font-style italic', async () => {
      const syntheticPsd: Psd = {
        width: 600,
        height: 400,
        children: [
          {
            name: 'Italic Multiline Text',
            left: 20,
            top: 30,
            right: 300,
            bottom: 150,
            text: {
              text: 'Paragraph 1\rParagraph 2\r\nParagraph 3',
              style: {
                font: { name: 'Arial-ItalicMT' },
                fontSize: 18
              }
            }
          }
        ]
      };

      const psdBuf = writePsdBuffer(syntheticPsd);
      const res = await importPsd(psdBuf, { extractImages: false });

      expect(res.toadCode).toContain('font-style: italic;');
      expect(res.toadCode).toContain('Paragraph 1\\nParagraph 2\\nParagraph 3');

      const reAst = parseToad(res.toadCode, 'italic.toad');
      expect(reAst.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('preserves non-uniform background photo layers as extracted image assets', async () => {
      const c = createCanvas(200, 200);
      const ctx = c.getContext('2d');
      // Draw a gradient so canvas is non-uniform
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, 0, 100, 200);
      ctx.fillStyle = '#0000FF';
      ctx.fillRect(100, 0, 100, 200);

      const syntheticPsd: Psd = {
        width: 200,
        height: 200,
        children: [
          {
            name: 'Background Photo',
            left: 0,
            top: 0,
            right: 200,
            bottom: 200,
            canvas: c as unknown as HTMLCanvasElement
          }
        ]
      };

      const testOutDir = path.resolve('tests/dist/psd_test');
      if (!fs.existsSync(testOutDir)) {
        fs.mkdirSync(testOutDir, { recursive: true });
      }

      const psdBuf = writePsdBuffer(syntheticPsd);
      const res = await importPsd(psdBuf, {
        outPath: path.join(testOutDir, 'bg_test.toad'),
        extractImages: true
      });

      // Canvas should be transparent and layer preserved as extracted image asset
      expect(res.toadCode).toContain('fill: transparent;');
      expect(res.toadCode).toContain('image #Background_Photo');
      expect(res.stats.imageCount).toBe(1);
      expect(res.assets).toHaveLength(1);
    });

    afterAll(() => {
      const testOutDir = path.resolve('tests/dist/psd_test');
      if (fs.existsSync(testOutDir)) {
        fs.rmSync(testOutDir, { recursive: true, force: true });
      }
    });
  });
});
