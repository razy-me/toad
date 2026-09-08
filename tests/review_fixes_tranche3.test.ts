/**
 * tests/review_fixes_tranche3.test.ts
 * Regression tests for Tranche 3 code review fixes:
 * F-02: Icon vector scaling in PDF export based on node.width / node.height
 * F-03: Group hierarchy and transformations (opacity / rotation) in PDF export
 * F-05: Line-by-line multiline text alignment in PDF export
 * F-07: Linter reports invalid mask target on hex-like ID (#cafe)
 * F-11: AstCache invalidates immediately when a dependency file is removed
 * F-25: Slop triad distance scales hue delta by chroma in OkLCH
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { exportToPdfBuffer } from '../src/engine/pdfExporter.js';
import { lintDocument } from '../src/tools/linter.js';
import { AstCache } from '../src/engine/buildCache.js';
import { calculateSlopTriadDistance } from '../src/tools/metrics/colorEntropy.js';

function getPdfStream(pdfBuf: Buffer): string {
  const start = pdfBuf.indexOf(Buffer.from('stream\n')) + 7;
  const end = pdfBuf.indexOf(Buffer.from('\nendstream'));
  return zlib.inflateSync(pdfBuf.subarray(start, end)).toString('utf-8');
}

describe('Review Fixes: Tranche 3 Coverage', () => {
  // F-02: Icon vector scaling in PDF
  describe('F-02: PDF Icon Vector Scaling', () => {
    it('scales icon vector paths to match node width and height in PDF export', async () => {
      const src = `
        canvas { size: 200px 200px; }
        icon "check" #chk {
          at: 10px 10px;
          size: 48px 48px;
          stroke: #ff0000;
          stroke-width: 2px;
        }
      `;
      const ast = parseToad(src);
      const resolved = await resolveImportsAndComponents(ast, 'test.toad');
      const layout = await solveLayout(resolved);
      const pdfBuf = await exportToPdfBuffer(layout, { bleed: 0, cropMarks: false });

      const stream = getPdfStream(pdfBuf);
      // In a 48x48 icon scaled from 24x24, sx = 2 and sy = 2.
      // Coordinates should reach beyond 10 + 24 = 34px (e.g. up to 10 + 48 = 58px).
      // Check for coordinate numbers > 40 in the stream
      const coords = stream.match(/(\d+\.\d+)\s+(\d+\.\d+)\s+[mlc]/g);
      expect(coords).not.toBeNull();
      const hasScaledCoords = coords!.some(cmd => {
        const nums = cmd.split(/\s+/).map(Number);
        return nums.some(n => n > 35);
      });
      expect(hasScaledCoords).toBe(true);
    });
  });

  // F-03: PDF Group Transformations & Hierarchy
  describe('F-03: PDF Group Hierarchy & Transformations', () => {
    it('renders group children with group opacity in PDF export', async () => {
      const src = `
        canvas { size: 300px 300px; }
        group #semiGroup {
          at: 20px 20px;
          size: 200px 200px;
          opacity: 0.5;
          rect #innerBox {
            at: 0px 0px;
            size: 50px 50px;
            fill: #00ff00;
          }
        }
      `;
      const ast = parseToad(src);
      const resolved = await resolveImportsAndComponents(ast, 'test.toad');
      const layout = await solveLayout(resolved);
      const pdfBuf = await exportToPdfBuffer(layout, { bleed: 0, cropMarks: false });

      const stream = getPdfStream(pdfBuf);
      // Graphics state operator /GS... gs should be emitted for the group opacity
      expect(stream).toMatch(/\/GS\d+\s+gs/);
      // Inner rectangle should be rendered inside stream
      expect(stream).toContain('re');
      expect(stream).toContain('f');
    });
  });

  // F-05: PDF Multiline Text Alignment
  describe('F-05: PDF Multiline Text Alignment', () => {
    it('computes distinct horizontal offsets for multiline centered text in PDF', async () => {
      const src = `
        canvas { size: 500px 500px; }
        text #centeredText {
          at: 50px 50px;
          size: 400px;
          align: center;
          font-size: 20px;
          content: "A very long first line of text\\nShort";
        }
      `;
      const ast = parseToad(src);
      const resolved = await resolveImportsAndComponents(ast, 'test.toad');
      const layout = await solveLayout(resolved);
      const pdfBuf = await exportToPdfBuffer(layout, { bleed: 0, cropMarks: false });

      const stream = getPdfStream(pdfBuf);
      // Find all text matrix Tm lines: "1 0 0 -1 <x> <y> Tm"
      const tmMappings = [...stream.matchAll(/1 0 0 -1\s+([\d.]+)\s+([\d.]+)\s+Tm/g)];
      expect(tmMappings.length).toBe(2);
      const x1 = parseFloat(tmMappings[0][1]);
      const x2 = parseFloat(tmMappings[1][1]);
      // "Short" is significantly shorter than the long line, so its centered X coordinate
      // MUST be strictly greater than the long line's centered X coordinate!
      expect(x2).toBeGreaterThan(x1 + 50);
    });
  });

  // F-07: Linter checks hex-like IDs for mask
  describe('F-07: Linter Mask Target Check on Hex-like IDs', () => {
    it('detects unknown mask element target even when specified as a hex-like id', () => {
      const src = `
        canvas { size: 200px 200px; }
        rect #content { size: 100px 100px; fill: #f00; mask: #cafe; }
      `;
      const ast = parseToad(src, 'test.toad');
      const diags = lintDocument(ast);
      const maskDiag = diags.find(d => d.code === 'LINT-INVALID-MASK-TARGET');
      expect(maskDiag).toBeDefined();
      expect(maskDiag!.message).toContain('#cafe');
    });

    it('does not warn when the hex-like mask element is defined', () => {
      const src = `
        canvas { size: 200px 200px; }
        rect #cafe { size: 50px 50px; clip: true; }
        rect #content { size: 100px 100px; fill: #f00; mask: #cafe; }
      `;
      const ast = parseToad(src, 'test.toad');
      const diags = lintDocument(ast);
      const maskDiag = diags.find(d => d.code === 'LINT-INVALID-MASK-TARGET');
      expect(maskDiag).toBeUndefined();
    });
  });

  // F-11: AstCache invalidates when dependency is deleted
  describe('F-11: AstCache Invalidation on Deleted Dependency', () => {
    it('invalidates cache when a recorded dependency file is deleted from disk', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toad_cache_test_'));
      const mainPath = path.join(tmpDir, 'main.toad');
      const depPath = path.join(tmpDir, 'tokens.toad');

      fs.writeFileSync(mainPath, 'canvas { size: 100px 100px; }');
      fs.writeFileSync(depPath, '>brandRed = #ff0000;');

      const cache = AstCache.getInstance();
      const ast = parseToad(fs.readFileSync(mainPath, 'utf-8'), mainPath);
      const depMtime = fs.statSync(depPath).mtimeMs;
      const mainMtime = depMtime + 5000;
      cache.set(mainPath, mainMtime, ast, undefined, [depPath]);

      // Initially valid
      expect(cache.get(mainPath, mainMtime)).not.toBeNull();

      // Now remove the dependency from disk
      fs.unlinkSync(depPath);

      // Cache should detect missing file and return null (miss / invalidation)
      expect(cache.get(mainPath, mainMtime)).toBeNull();

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  // F-25: Slop triad distance scales hue delta by chroma
  describe('F-25: Slop Triad Distance Neutral Chroma Scaling', () => {
    it('does not assign high distance between two neutral dark colors with different hue angles', () => {
      // Two very dark, near-neutral colors: almost black with tiny chroma
      // In unscaled metric, an opposing hue angle would add ~1.0 of distance.
      // With proper OkLCH chroma scaling, distance between near-identical dark tones stays very low.
      const dark1 = { r: 15, g: 15, b: 18, a: 1 }; // OkLCH L~0.08, C~0.005
      const dark2 = { r: 18, g: 15, b: 15, a: 1 }; // OkLCH L~0.08, C~0.005 with different hue
      const dist = calculateSlopTriadDistance([dark1, dark2]);
      expect(dist).toBeLessThan(0.7);
    });
  });
});
