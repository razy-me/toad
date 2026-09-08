import { describe, it, expect } from 'vitest';
import * as zlib from 'node:zlib';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseToad, Parser } from '../src/parser/parser.js';
import { Lexer } from '../src/parser/lexer.js';
import { safeEvaluateMath, evaluateCalc, computeAspectRatio, solveLayout } from '../src/parser/math.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { exportToPdfBuffer } from '../src/engine/pdfExporter.js';
import { TextMeasurementCache, AstCache } from '../src/engine/buildCache.js';
import { formatToad } from '../src/tools/formatter.js';
import { lintDocument } from '../src/tools/linter.js';

describe('Code Review Fixes & Regressions (REV-001 - REV-020)', () => {

  // ==========================================================================
  // REV-001, REV-002, REV-011: Prepress PDF Exporter
  // ==========================================================================
  describe('Prepress PDF Exporter fixes', () => {
    it('REV-001: emits counter-flipped text matrix (1 0 0 -1) so glyphs render right-side up', async () => {
      const src = `
        canvas {
          size: 400px 300px;
          background: #ffffff;
        }
        text #headline {
          at: 20px 40px;
          content: "HELLO PDF";
          font-size: 24px;
          color: #000000;
        }
      `;
      const ast = parseToad(src);
      const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
      const layout = await solveLayout(resolved);
      const pdfBuf = await exportToPdfBuffer(layout, { bleed: 0, cropMarks: false });

      // Extract stream content
      const start = pdfBuf.indexOf(Buffer.from('stream\n')) + 7;
      const end = pdfBuf.indexOf(Buffer.from('\nendstream'));
      expect(start).toBeGreaterThan(6);
      expect(end).toBeGreaterThan(start);

      const decompressed = zlib.inflateSync(pdfBuf.subarray(start, end)).toString('utf-8');
      // Must contain counter-flipped text matrix: 1 0 0 -1 x y Tm
      expect(decompressed).toMatch(/1 0 0 -1 \d+(\.\d+)? \d+(\.\d+)? Tm/);
      expect(decompressed).toContain('(HELLO PDF) Tj');
    });

    it('REV-002: accurately converts relative SVG path commands (c, l) into cubic segments', async () => {
      const src = `
        canvas {
          size: 200px 200px;
        }
        path #curve {
          at: 10px 10px;
          size: 100px 100px;
          d: "M 10 10 c 5 5 10 5 15 0 l 10 10 z";
          fill: #ff0000;
        }
      `;
      const ast = parseToad(src);
      const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
      const layout = await solveLayout(resolved);
      const pdfBuf = await exportToPdfBuffer(layout);

      const start = pdfBuf.indexOf(Buffer.from('stream\n')) + 7;
      const end = pdfBuf.indexOf(Buffer.from('\nendstream'));
      const decompressed = zlib.inflateSync(pdfBuf.subarray(start, end)).toString('utf-8');

      // PDF path operators: m (moveto), c (curveto), l (lineto), h (closepath)
      expect(decompressed).toMatch(/\d+(\.\d+)? \d+(\.\d+)? m/);
      expect(decompressed).toMatch(/\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)? c/);
      expect(decompressed).toContain('h');
    });

    it('REV-011: renders star, triangle, arrow, cross, and icon shapes without throwing', async () => {
      const src = `
        canvas {
          size: 500px 500px;
        }
        star #s1 {
          at: 10px 10px;
          size: 60px 60px;
          fill: #fbbf24;
        }
        triangle #t1 {
          at: 80px 10px;
          size: 60px 60px;
          fill: #3b82f6;
        }
        arrow #a1 {
          at: 150px 10px;
          size: 60px 60px;
          fill: #10b981;
        }
        cross #c1 {
          at: 220px 10px;
          size: 60px 60px;
          fill: #ef4444;
        }
        icon #i1 {
          at: 290px 10px;
          size: 60px 60px;
          name: "check";
          fill: #6366f1;
        }
      `;
      const ast = parseToad(src);
      const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
      const layout = await solveLayout(resolved);
      const pdfBuf = await exportToPdfBuffer(layout);

      expect(pdfBuf).toBeInstanceOf(Buffer);
      expect(pdfBuf.length).toBeGreaterThan(1000);

      const start = pdfBuf.indexOf(Buffer.from('stream\n')) + 7;
      const end = pdfBuf.indexOf(Buffer.from('\nendstream'));
      const decompressed = zlib.inflateSync(pdfBuf.subarray(start, end)).toString('utf-8');
      expect(decompressed).toContain('c');
      expect(decompressed).toContain('f');
    });
  });

  // ==========================================================================
  // REV-003, REV-012, REV-020: Math & Layout Solver
  // ==========================================================================
  describe('Math and Layout fixes', () => {
    it('REV-012: safeEvaluateMath parses and computes expressions without new Function / eval', () => {
      expect(safeEvaluateMath('10 + 20 * 3')).toBe(70);
      expect(safeEvaluateMath('(10 + 20) * 3')).toBe(90);
      expect(safeEvaluateMath('100 / (2 + 3)')).toBe(20);
      expect(safeEvaluateMath('-5 + 15')).toBe(10);
      expect(safeEvaluateMath('10 - -5')).toBe(15);
      expect(safeEvaluateMath('100 / 0')).toBe(0); // Guarded division by zero
      expect(safeEvaluateMath('')).toBe(0);
      expect(safeEvaluateMath('invalid')).toBe(0);
    });

    it('REV-003: decouples vw and vh against canvasWidth and canvasHeight', () => {
      const canvasWidth = 1000;
      const canvasHeight = 500;

      const vwResult = evaluateCalc('calc(50vw + 20px)', canvasWidth, 16, canvasWidth, canvasHeight);
      const vhResult = evaluateCalc('calc(50vh + 20px)', canvasHeight, 16, canvasWidth, canvasHeight);

      // 50vw = 500px + 20px = 520px
      expect(vwResult).toBe(520);
      // 50vh = 250px + 20px = 270px
      expect(vhResult).toBe(270);
    });

    it('REV-020: computeAspectRatio preserves non-integer aspect ratios without integer truncation', () => {
      const ratio = computeAspectRatio(2350, 1000);
      expect(ratio.ratioString).toBe('47:20');
      expect(ratio.ratioX).toBe(47);
      expect(ratio.ratioY).toBe(20);
    });
  });

  // ==========================================================================
  // REV-004, REV-005: Engine Build Caches
  // ==========================================================================
  describe('Engine Build Cache fixes', () => {
    it('REV-004: TextMeasurementCache distinguishes font features and font variation axes', () => {
      const baseKey = TextMeasurementCache.makeKey('Hello', { fontSize: 16, fontFamily: 'Inter', fontWeight: 'normal' });
      const featureKey = TextMeasurementCache.makeKey('Hello', { fontSize: 16, fontFamily: 'Inter', fontWeight: 'normal', fontFeatures: { cv01: true } });
      const variationKey = TextMeasurementCache.makeKey('Hello', { fontSize: 16, fontFamily: 'Inter', fontWeight: 'normal', fontVariation: { wght: 700 } });

      expect(baseKey).not.toBe(featureKey);
      expect(baseKey).not.toBe(variationKey);
      expect(featureKey).not.toBe(variationKey);
    });

    it('REV-005: AstCache invalidates cached entries when dependency file mtime changes', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toad-cache-test-'));
      const depFile = path.join(tmpDir, 'tokens.toad');
      const mainFile = path.join(tmpDir, 'main.toad');

      fs.writeFileSync(depFile, '>color = #ff0000;');
      fs.writeFileSync(mainFile, 'canvas { size: 100px 100px; }');

      const cache = new AstCache();
      const dummyAst = parseToad('canvas { size: 100px 100px; }');
      const mainMtime = fs.statSync(mainFile).mtimeMs;

      cache.set(mainFile, mainMtime, dummyAst, undefined, [depFile]);
      expect(cache.get(mainFile, mainMtime)).toBe(dummyAst);

      // Mutate dependency file mtime into the future
      const futureTime = (Date.now() + 5000) / 1000;
      fs.utimesSync(depFile, futureTime, futureTime);

      // AstCache should detect dependency modification and invalidate
      expect(cache.get(mainFile, mainMtime)).toBeNull();

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  // ==========================================================================
  // REV-017, REV-018: Tooling (Formatter & Linter)
  // ==========================================================================
  describe('Tooling fixes (Formatter & Linter)', () => {
    it('REV-017: Formatter correctly handles strings with trailing escaped backslashes', () => {
      const input = 'canvas { font-family: "C:\\\\Fonts\\\\"; }';
      const formatted = formatToad(input);
      expect(formatted).toContain('font-family: "C:\\\\Fonts\\\\";');
    });

    it('REV-018: Linter suppresses unused variable warnings on standalone token libraries', () => {
      // Standalone token file without canvas block
      const tokenLibrarySrc = `
        >primaryColor = #3b82f6;
        >secondaryColor = #10b981;
        >headingFont = "Inter";
      `;
      const libraryAst = parseToad(tokenLibrarySrc);
      const libraryResults = lintDocument(libraryAst);
      const unusedVarErrors = libraryResults.filter(r => r.code === 'LINT-UNUSED-VAR');
      expect(unusedVarErrors.length).toBe(0);

      // Design file with canvas block AND unused variable
      const designSrc = `
        >unusedColor = #ff0000;
        >usedColor = #00ff00;
        canvas {
          size: 200px 200px;
          background: >usedColor;
        }
      `;
      const designAst = parseToad(designSrc);
      const designResults = lintDocument(designAst);
      const designUnused = designResults.filter(r => r.code === 'LINT-UNUSED-VAR');
      expect(designUnused.length).toBe(1);
      expect(designUnused[0]?.message).toContain('>unusedColor');
    });
  });

  // ==========================================================================
  // REV-008, REV-015: Frontend Parser & Lexer
  // ==========================================================================
  describe('Parser & Lexer fixes', () => {
    it('REV-015: Lexer correctly scans \\u0000, \\x41, and code point \\u{1F600}', () => {
      const src = `>str1 = "\\u0000"; >str2 = "\\x41"; >str3 = "\\u{1F600}";`;
      const lexer = new Lexer(src);
      const tokens = lexer.tokenize();

      const stringTokens = tokens.filter(t => t.type === 'STRING');
      expect(stringTokens.length).toBe(3);
      expect(stringTokens[0]?.value).toBe('\u0000');
      expect(stringTokens[1]?.value).toBe('A');
      expect(stringTokens[2]?.value).toBe('😀');
    });

    it('REV-008: Parser reports error diagnostic for unterminated string literals', () => {
      const src = `
        canvas {
          size: 400px 400px;
        }
        text "Unterminated string at EOF
      `;
      const parser = new Parser(src);
      parser.parse();

      const unterminatedErrors = parser.diagnostics.filter(d =>
        d.message.toLowerCase().includes('unterminated string')
      );
      expect(unterminatedErrors.length).toBeGreaterThanOrEqual(1);
    });
  });

});
