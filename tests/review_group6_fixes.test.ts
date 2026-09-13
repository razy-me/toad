import { describe, it, expect } from 'vitest';
import { generateQrCode } from '../src/engine/qrGenerator.js';
import { generateBarcode } from '../src/engine/barcodeGenerator.js';
import { formatToad } from '../src/tools/formatter.js';
import { lintDocument } from '../src/tools/linter.js';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { auditDesign } from '../src/tools/designAuditor.js';

describe('Review Group 6 Fixes Verification', () => {
  // ==========================================================================
  // F-05: Silent QR payload truncation & corruption
  // ==========================================================================
  describe('F-05: QR Code Capacity Limits', () => {
    it('throws descriptive error when byte payload exceeds QR capacity', () => {
      // 4000 bytes exceeds Version 40 ECL H capacity (1535 bytes) and ECL L (2956 bytes)
      const oversizedPayload = 'A'.repeat(3500);
      expect(() => generateQrCode(oversizedPayload, { ecl: 'H' }))
        .toThrow(/exceeds maximum capacity/i);
    });
  });

  // ==========================================================================
  // F-12: Silent data corruption in Code 128 Set B
  // ==========================================================================
  describe('F-12: Code 128 ASCII Validation', () => {
    it('throws error when text contains characters outside ASCII 32-126', () => {
      expect(() => generateBarcode('TOAD\x07BELL', { format: 'code128' }))
        .toThrow(/outside valid ASCII range/i);

      expect(() => generateBarcode('TOAD©2026', { format: 'code128' }))
        .toThrow(/outside valid ASCII range/i);
    });

    it('successfully generates barcode for valid ASCII 32-126 characters', () => {
      const bc = generateBarcode('TOAD-v1.0.0 (OK!)', { format: 'code128' });
      expect(bc.bars.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // F-13: EAN-13 Checksum Bypass & Validation
  // ==========================================================================
  describe('F-13: EAN-13 Validation', () => {
    it('throws error if fewer than 12 digits provided', () => {
      expect(() => generateBarcode('12345', { format: 'ean13' }))
        .toThrow(/at least 12 digits/i);
    });

    it('validates 13th digit against calculated checksum and throws if mismatched', () => {
      // Correct for '400638133393' is '1'
      expect(() => generateBarcode('4006381333939', { format: 'ean13' }))
        .toThrow(/Invalid EAN-13 checksum: expected 1/i);
    });

    it('succeeds when 13th digit matches the calculated checksum', () => {
      const bc = generateBarcode('4006381333931', { format: 'ean13' });
      expect(bc.text).toBe('4006381333931');
    });

    it('computes 13th digit automatically when exactly 12 digits provided', () => {
      const bc = generateBarcode('400638133393', { format: 'ean13' });
      expect(bc.text).toBe('4006381333931');
    });
  });

  // ==========================================================================
  // F-22: ISO/IEC 18004 Penalty Rule 3 in QR Masking
  // ==========================================================================
  describe('F-22: QR Penalty Rule 3 Evaluation', () => {
    it('generates valid QR code with complete penalty evaluation rules', () => {
      const qr = generateQrCode('https://toad.design/docs/spec', { ecl: 'M' });
      expect(qr.matrix.length).toBe(qr.size);
      expect(qr.size).toBeGreaterThanOrEqual(21);
    });
  });

  // ==========================================================================
  // F-23: Block comments with colon in property normalization
  // ==========================================================================
  describe('F-23: Formatter Inline Block Comment Preservation', () => {
    it('does not split property lines on colons inside block comments', () => {
      const input = 'rect #box {\n  /* note: important */ width: 100px;\n}\n';
      const formatted = formatToad(input);
      expect(formatted).toContain('/* note: important */ width: 100px;');
    });
  });

  // ==========================================================================
  // F-36: Bento-Overkill False Positive on Single-Column Stacks
  // ==========================================================================
  describe('F-36: Anti-Slop Bento Overkill on Single-Column Stacks', () => {
    it('does not flag single-column vertical card stacks as bento overkill', async () => {
      // 5 cards all stacked in a single vertical column (same X coordinate: 50)
      const toadCode = `
        canvas {
          size: 800px 1200px;
          background: #ffffff;
        }
        rect #card1 { at: 50px 50px; size: 400px 100px; fill: alpha(#000000, 0.1); border-radius: 16px; stroke: #000; text { content: "Card 1"; } }
        rect #card2 { at: 50px 200px; size: 400px 100px; fill: alpha(#000000, 0.1); border-radius: 16px; stroke: #000; text { content: "Card 2"; } }
        rect #card3 { at: 50px 350px; size: 400px 100px; fill: alpha(#000000, 0.1); border-radius: 16px; stroke: #000; text { content: "Card 3"; } }
        rect #card4 { at: 50px 500px; size: 400px 100px; fill: alpha(#000000, 0.1); border-radius: 16px; stroke: #000; text { content: "Card 4"; } }
        rect #card5 { at: 50px 650px; size: 400px 100px; fill: alpha(#000000, 0.1); border-radius: 16px; stroke: #000; text { content: "Card 5"; } }
      `;
      const ast = parseToad(toadCode);
      const resolved = await resolveImportsAndComponents(ast, 'test.toad');
      const layout = await solveLayout(resolved);
      const audit = await auditDesign({ layout, entryPath: 'test.toad' });
      const bentoFindings = audit.issues.filter(f => f.code === 'SLOP-WEB-002');
      expect(bentoFindings.length).toBe(0);
    });
  });

  // ==========================================================================
  // F-45: Formatter Leading & Redundant Blank Line Normalization
  // ==========================================================================
  describe('F-45: Formatter Blank Line Normalization', () => {
    it('collapses 3+ consecutive newlines to at most 1 blank line and strips leading blank lines', () => {
      const input = '\n\n\ncanvas {\n  size: 800px 600px;\n}\n\n\n\n\nrect #box {\n  size: 100px 100px;\n}\n';
      const formatted = formatToad(input);
      expect(formatted.startsWith('canvas {')).toBe(true);
      expect(formatted).not.toContain('\n\n\n');
      expect(formatted).toContain('}\n\nrect #box {');
    });
  });

  // ==========================================================================
  // F-47: Quiet Zone Configuration in Barcodes
  // ==========================================================================
  describe('F-47: Barcode Quiet Zone Configuration', () => {
    it('allows custom quietZone module configuration', () => {
      const defaultBc = generateBarcode('TOAD-123', { format: 'code128' });
      const zeroQuietBc = generateBarcode('TOAD-123', { format: 'code128', quietZone: 0 });
      const customQuietBc = generateBarcode('TOAD-123', { format: 'code128', quietZone: 25 });

      // Default quiet zone is 10 on both sides = 20 modules
      // zero quiet zone has 0 margin, so totalModules is 20 less
      expect(zeroQuietBc.totalModules).toBe(defaultBc.totalModules - 20);
      expect(customQuietBc.totalModules).toBe(defaultBc.totalModules + 30);
    });

    it('supports quietZone in EAN-13 barcodes', () => {
      const defaultEan = generateBarcode('400638133393', { format: 'ean13' });
      const zeroEan = generateBarcode('400638133393', { format: 'ean13', quietZone: 0 });
      // Default EAN-13 has 9 modules on each side = 18 modules
      expect(zeroEan.totalModules).toBe(defaultEan.totalModules - 18);
    });
  });

  // ==========================================================================
  // F-48: QR Alignment Patterns up to Version 40
  // ==========================================================================
  describe('F-48: QR Version 40 Scale Support', () => {
    it('generates high-capacity QR code leveraging extended versions up to 40', () => {
      // 1000 characters requires Version 26+ in ECL M
      const largeText = 'A'.repeat(1000);
      const qr = generateQrCode(largeText, { ecl: 'M' });
      expect(qr.version).toBeGreaterThan(15);
      expect(qr.size).toBe(17 + qr.version * 4);
    });
  });

  // ==========================================================================
  // F-51: Linter Unused Component Detection
  // ==========================================================================
  describe('F-51: Unused Component & Import Detection', () => {
    it('emits warning when a component declared in a canvas document is never instantiated', () => {
      const toadCode = `
        canvas { size: 800px 600px; }
        component UnusedButton() {
          rect { size: 100px 40px; }
        }
      `;
      const ast = parseToad(toadCode);
      const diags = lintDocument(ast);
      const unusedCompDiags = diags.filter(d => d.code === 'LINT-UNUSED-COMPONENT');
      expect(unusedCompDiags.length).toBe(1);
      expect(unusedCompDiags[0].message).toContain("Component 'UnusedButton' is declared but never instantiated");
    });

    it('does not emit warning when declared component is instantiated in the document', () => {
      const toadCode = `
        canvas { size: 800px 600px; }
        component UsedButton() {
          rect { size: 100px 40px; }
        }
        UsedButton #btn1 {}
      `;
      const ast = parseToad(toadCode);
      const diags = lintDocument(ast);
      const unusedCompDiags = diags.filter(d => d.code === 'LINT-UNUSED-COMPONENT');
      expect(unusedCompDiags.length).toBe(0);
    });
  });
});
