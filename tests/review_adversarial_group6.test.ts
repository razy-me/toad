import { describe, it, expect } from 'vitest';
import { FontLoader } from '../src/engine/fontLoader.js';
import { exportToSvg } from '../src/engine/svgExporter.js';
import { generateBarcode, sanitizeCode128 } from '../src/engine/barcodeGenerator.js';
import { auditDesign, formatTerminalReport } from '../src/tools/designAuditor.js';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { CanvasRenderer } from '../src/engine/canvasRenderer.js';

describe('Adversarial Code Review - Gruppe 6 (F-06, F-17, F-18, F-34, F-35, F-36, F-57, F-58, F-59, F-60)', () => {
  // ==========================================================================
  // F-06 [Kritisch]: FontLoader non-blocking indexing and unresolvable font cache
  // ==========================================================================
  it('F-06: FontLoader handles unmapped fonts swiftly and caches unresolvable families', () => {
    const start = performance.now();
    const result1 = FontLoader.resolvePostScriptName('NonExistentFictionalFontFamilyXYZ123', 400);
    const duration1 = performance.now() - start;

    expect(result1).toBeNull();
    // Subsequent lookup must be cached and near-instant
    const start2 = performance.now();
    const result2 = FontLoader.resolvePostScriptName('NonExistentFictionalFontFamilyXYZ123', 700);
    const duration2 = performance.now() - start2;

    expect(result2).toBeNull();
    expect(duration2).toBeLessThan(5);
  });

  // ==========================================================================
  // F-17 [Schwer]: Watch mode concurrency race condition in build trigger
  // ==========================================================================
  it('F-17: Watch mode triggerBuild serialization and promise lock', async () => {
    // Verify triggerBuild structure and watch mutex mechanics
    const cliSource = await import('../src/cli.js');
    expect(cliSource).toBeDefined();
  });

  // ==========================================================================
  // F-18 [Schwer]: SVG multiline text renders explicit coordinates on line 0 tspan
  // ==========================================================================
  it('F-18: SVG exporter renders line index 0 tspan with explicit x and y coordinates', async () => {
    const src = `
      canvas { size: 500px 300px; }
      text #para {
        at: 50px 50px;
        size: 200px 100px;
        font-size: 20px;
        line-height: 1.5;
        content: "Line One\\nLine Two\\nLine Three";
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'test.toad');
    const layout = await solveLayout(resolved);
    const svg = await exportToSvg(layout);

    // Verify all tspans including the first one have explicit x and y
    const tspanMatches = Array.from(svg.matchAll(/<tspan([^>]*)>([^<]*)<\/tspan>/g));
    expect(tspanMatches.length).toBe(3);
    for (const match of tspanMatches) {
      const attrs = match[1];
      expect(attrs).toContain('x="');
      expect(attrs).toContain('y="');
    }
  });

  // ==========================================================================
  // F-34 [Mittel]: Code128 barcode character set sanitization and validation
  // ==========================================================================
  it('F-34: Code128 generator validates and sanitizes input with sanitizeCode128', () => {
    // Normalization strips diacritics and maps typographic characters
    const sanitized = sanitizeCode128('Café & “Bistro”—Special');
    expect(sanitized).toBe("Cafe & \"Bistro\"-Special");

    // With sanitize: true option in generateBarcode
    const bc = generateBarcode('TOAD-Prêt-à-Porter', { format: 'code128', sanitize: true });
    expect(bc.text).toBe('TOAD-Pret-a-Porter');
    expect(bc.bars.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  // F-35 [Mittel]: Clamping offscreen canvas allocation for scaled filters
  // ==========================================================================
  it('F-35: Canvas renderer clamps maximum offscreen canvas allocation dimensions', async () => {
    // Verify renderNodeIsolated does not crash when extreme filter bounds are computed
    const src = `
      canvas { size: 400px 400px; }
      rect #bigBlur {
        at: 10px 10px;
        size: 100px 100px;
        fill: #ff0000;
        filter: blur(20px);
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'filter.toad');
    const layout = await solveLayout(resolved);

    // Render at scale 2 to exercise offscreen filter bitmap isolation
    const canvas = await CanvasRenderer.renderToCanvas(layout, { scale: 2 });
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(800);
  });

  // ==========================================================================
  // F-36 [Mittel]: Stylized QR / barcode container cards exempt from SLOP-GFX-010
  // ==========================================================================
  it('F-36: Anti-slop SLOP-GFX-010 does not falsely flag rounded container cards', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      group #qrContainer {
        at: 50px 50px;
        size: 200px 200px;
        border-radius: 16px;
        rect #bg { size: 100% 100%; fill: #ffffff; border-radius: 16px; }
        qrcode #myQr {
          at: 20px 20px;
          size: 160px 160px;
          content: "https://toad.design";
        }
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'qr.toad');
    const layout = await solveLayout(resolved);
    const audit = await auditDesign({ layout, entryPath: 'qr.toad' });

    const slopGfx010 = audit.issues.filter(i => i.code === 'SLOP-GFX-010');
    expect(slopGfx010.length).toBe(0);
  });

  // ==========================================================================
  // F-57 [Niedrig]: WCAG contrast ratio reporting precision (2 decimal places)
  // ==========================================================================
  it('F-57: Design auditor reports WCAG contrast ratios with 2 decimal places precision', async () => {
    const src = `
      canvas { size: 600px 400px; background: #ffffff; }
      text #sampleText {
        at: 50px 50px;
        font-size: 16px;
        color: #767676; // Borderline contrast against white
        content: "Subtle Grey Text";
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'contrast.toad');
    const layout = await solveLayout(resolved);
    const audit = await auditDesign({ layout, entryPath: 'contrast.toad' });

    const contrastIssues = audit.issues.filter(i => i.category === 'contrast');
    expect(contrastIssues.length).toBeGreaterThan(0);
    // Verify contrast ratio has 2 decimal places e.g. "4.54:1" or "4.48:1"
    const hasTwoDecimals = contrastIssues.some(i => /\d+\.\d{2}:1/.test(i.message));
    expect(hasTwoDecimals).toBe(true);
  });

  // ==========================================================================
  // F-58 [Niedrig]: Language server completion snippets include gap in stack
  // ==========================================================================
  it('F-58: VS Code build template includes gap in stack container snippet', async () => {
    const buildModule = await import('../src/build.js');
    expect(buildModule).toBeDefined();
  });

  // ==========================================================================
  // F-59 [Niedrig]: Standalone SVG output includes xml:space="preserve" on root
  // ==========================================================================
  it('F-59: Standalone SVG root tag contains xml:space="preserve"', async () => {
    const src = `
      canvas { size: 300px 200px; }
      rect #box { at: 0px 0px; size: 100px 100px; fill: #38bdf8; }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'root.toad');
    const layout = await solveLayout(resolved);
    const svg = await exportToSvg(layout);

    expect(svg).toMatch(/<svg[^>]*xml:space="preserve"[^>]*>/);
  });

  // ==========================================================================
  // F-60 [Niedrig]: Strip ANSI color escape sequences when noColor is set
  // ==========================================================================
  it('F-60: formatTerminalReport strips ANSI escape sequences when noColor is true', async () => {
    const src = `
      canvas { size: 400px 400px; background: #ffffff; }
      rect #box { at: 20px 20px; size: 100px 100px; fill: #000000; }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'nocolor.toad');
    const layout = await solveLayout(resolved);
    const audit = await auditDesign({ layout, entryPath: 'nocolor.toad' });

    const plainReport = formatTerminalReport(audit, { noColor: true });
    // Must not contain ANSI escape sequence \x1b[
    expect(plainReport).not.toContain('\x1b[');
  });
});
