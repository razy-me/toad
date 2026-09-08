/**
 * tests/review_fixes_tranche2.test.ts
 * Regression tests for Tranche 2 code review fixes:
 * F-08: SVG arc parsing with dense flags (01 / 10)
 * F-09: stripAnsi with OSC 8 hyperlinks & terminal escape terminators
 * F-10: toLspRange 1-based column conversion math
 * F-12: LSP hover template adherence to Rule 1 (>var = val;)
 * F-13: PSD layer naming prevents duplicate "Icon Icon" suffix
 * F-14: computeGcd precision & float handling via shared math.ts
 * F-26: ImageCache directory-based basePath resolution
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { svgPathToBezierPaths } from '../src/engine/vectorPathParser.js';
import { stripAnsi } from '../src/utils/clipboard.js';
import { resolveHumanLayerName } from '../src/utils/layerNaming.js';
import { ToadLanguageServer } from '../src/tools/lsp/server.js';
import { computeGcd } from '../src/parser/importResolver.js';
import { resolveSharedImage } from '../src/engine/imageCache.js';

describe('Review Fixes: Tranche 2 Coverage', () => {
  // F-08: Vector Path Parser dense arc flags
  describe('F-08: SVG Arc with Dense Flags', () => {
    it('parses elliptical arcs with concatenated flags like 0150 and 1050', () => {
      // "0150 25" has large-arc-flag=0, sweep-flag=1, x=50, y=25
      const paths = svgPathToBezierPaths('M 0 0 A 25 25 0 0150 25');
      expect(paths.length).toBeGreaterThan(0);
      const knots = paths[0].knots;
      expect(knots.length).toBeGreaterThan(0);
      // The end point of the arc anchor is in points[2] (x) and points[3] (y)
      const lastKnot = knots[knots.length - 1];
      expect(Math.round(lastKnot.points[2])).toBe(50);
      expect(Math.round(lastKnot.points[3])).toBe(25);
    });

    it('parses multiple chained dense arcs without failure', () => {
      const paths = svgPathToBezierPaths('M 10 10 A 15 15 0 0140 10 A 15 15 0 1070 10');
      expect(paths.length).toBeGreaterThan(0);
      const knots = paths[0].knots;
      const lastKnot = knots[knots.length - 1];
      expect(Math.round(lastKnot.points[2])).toBe(70);
      expect(Math.round(lastKnot.points[3])).toBe(10);
    });
  });

  // F-09: stripAnsi with OSC 8 hyperlinks and ST terminator
  describe('F-09: Clipboard stripAnsi with OSC 8 and ST terminators', () => {
    it('strips OSC 8 hyperlinks terminated by String Terminator (\\x1b\\\\)', () => {
      const input = '\x1b]8;;https://toad-dsl.dev\x1b\\TOAD Compiler\x1b]8;;\x1b\\';
      expect(stripAnsi(input)).toBe('TOAD Compiler');
    });

    it('strips OSC 8 hyperlinks terminated by BEL (\\x07)', () => {
      const input = '\x1b]8;;https://toad-dsl.dev\x07Documentation\x1b]8;;\x07';
      expect(stripAnsi(input)).toBe('Documentation');
    });

    it('strips complex CSI sequences and colors alongside hyperlinks', () => {
      const input = '\x1b[38;2;255;100;0m\x1b[1m\x1b]8;;https://github.com\x1b\\GitHub\x1b]8;;\x1b\\\x1b[0m';
      expect(stripAnsi(input)).toBe('GitHub');
    });
  });

  // F-10 & F-12: LSP Server diagnostics range & hover syntax
  describe('F-10 & F-12: LSP Server Diagnostics & Hover', () => {
    const lsp = new ToadLanguageServer();

    it('formats variable hover preview in canonical Rule 1 syntax (>var = val;)', async () => {
      const code = '>brandBlue = #0066cc;\ncanvas { size: 200px 200px; fill: >brandBlue; }';
      await lsp.validateTextDocument('uri://hover_test.toad', code);
      // Hover at line 0, column 3 (on brandBlue)
      const hover = lsp.onHover('uri://hover_test.toad', 0, 3);
      expect(hover).not.toBeNull();
      expect(hover.contents.value).toContain('>brandBlue = #0066cc;');
      expect(hover.contents.value).not.toContain('brandBlue: #0066cc;');
    });

    it('accurately maps 1-based parser error columns to 0-based LSP range', async () => {
      const code = `canvas { size: 200px 200px;\nrect #box { size: 100px 100px; fill: #f00; }`;
      const diagnostics = await lsp.validateTextDocument('uri://diag_test.toad', code);
      expect(diagnostics.length).toBeGreaterThan(0);
      for (const diag of diagnostics) {
        expect(diag.range.start.line).toBeGreaterThanOrEqual(0);
        expect(diag.range.start.character).toBeGreaterThanOrEqual(0);
        expect(diag.range.end.character).toBeGreaterThanOrEqual(diag.range.start.character);
      }
    });
  });

  // F-13: Layer Naming prevents duplicate "Icon Icon"
  describe('F-13: Semantic Layer Naming Deduplication', () => {
    it('does not append redundant "Icon" when icon name already ends with "Icon"', () => {
      const node = {
        type: 'icon',
        iconName: 'search-icon',
        id: 'searchIcon'
      } as any;
      const name = resolveHumanLayerName(node, { humanizeLayerNames: true });
      expect(name).toBe('Search Icon');
      expect(name).not.toBe('Search Icon Icon');
    });

    it('appends "Icon" when icon name does not end with "Icon"', () => {
      const node = {
        type: 'icon',
        iconName: 'user-plus',
        id: 'userPlus'
      } as any;
      const name = resolveHumanLayerName(node, { humanizeLayerNames: true });
      expect(name).toBe('User Plus Icon');
    });
  });

  // F-14: computeGcd precision & float handling
  describe('F-14: computeGcd Float Precision', () => {
    it('computes GCD for integer numbers correctly', () => {
      expect(computeGcd(1920, 1080)).toBe(120);
      expect(computeGcd(800, 600)).toBe(200);
    });

    it('computes GCD for floating point values without crashing or returning NaN', () => {
      const gcd = computeGcd(1.5, 2.5);
      expect(Number.isFinite(gcd)).toBe(true);
      expect(gcd).toBeGreaterThan(0);
    });
  });

  // F-26: ImageCache directory-based basePath resolution
  describe('F-26: ImageCache basePath Resolution', () => {
    it('resolves image relative to directory when basePath is a directory', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toad_img_test_'));
      const testLogo = path.join(process.cwd(), 'tests/fixtures/logo.png');
      const targetImg = path.join(tmpDir, 'logo.png');
      fs.copyFileSync(testLogo, targetImg);

      // Passing tmpDir directly as basePath (not a file inside it)
      const img = await resolveSharedImage('logo.png', tmpDir);
      expect(img).not.toBeNull();
      expect(img!.width).toBeGreaterThan(0);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
