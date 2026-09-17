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
        fontFamily: 'Times New Roman PS',
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
    const testOutDir = path.resolve(process.cwd(), 'tmp_psd_test');
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
});
