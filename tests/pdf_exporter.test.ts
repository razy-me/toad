import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { exportToPdfBuffer, parsePdfColor } from '../src/engine/pdfExporter.js';

describe('Prepress Vector PDF Exporter (Feature 2)', () => {
  it('parses CMYK colors accurately', () => {
    const c1 = parsePdfColor('cmyk(0, 100%, 100%, 0)');
    expect(c1.mode).toBe('cmyk');
    expect(c1.c).toBe(0);
    expect(c1.m).toBe(1);
    expect(c1.y).toBe(1);
    expect(c1.k).toBe(0);
    expect(c1.opacity).toBe(1);

    const c2 = parsePdfColor('#ff0000', true);
    expect(c2.mode).toBe('cmyk');
    expect(c2.c).toBe(0);
    expect(c2.m).toBe(1);
    expect(c2.y).toBe(1);
    expect(c2.k).toBe(0);
  });

  it('generates a valid PDF binary buffer with MediaBox, TrimBox, and BleedBox', async () => {
    const src = `
      canvas {
        size: 400px 600px;
        background: #ffffff;
        bleed: 10px;
        crop-marks: true;
      }
      rect #hero {
        at: 20px 20px;
        size: 360px 200px;
        radius: 12px;
        fill: #3b82f6;
      }
      circle #badge {
        at: 50px 250px;
        size: 80px 80px;
        fill: cmyk(0%, 50%, 100%, 0%);
      }
      text #title {
        at: 50px 360px;
        content: "PREPRESS PRINT TEST";
        font-size: 24px;
        color: #111827;
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const layout = await solveLayout(resolved);

    const pdfBuf = await exportToPdfBuffer(layout, {
      bleed: 10,
      cropMarks: true,
      colorMode: 'cmyk'
    });

    expect(pdfBuf).toBeInstanceOf(Buffer);
    expect(pdfBuf.length).toBeGreaterThan(500);

    const pdfString = pdfBuf.toString('binary');
    // PDF Magic Number
    expect(pdfString.startsWith('%PDF-1.4')).toBe(true);
    // Standard Prepress page boxes
    expect(pdfString).toContain('/MediaBox');
    expect(pdfString).toContain('/TrimBox');
    expect(pdfString).toContain('/BleedBox');
    // PDF structure
    expect(pdfString).toContain('/Type /Catalog');
    expect(pdfString).toContain('/Type /Pages');
    expect(pdfString).toContain('/Type /Page');
    expect(pdfString).toContain('startxref');
    expect(pdfString).toContain('%%EOF');
  });

  it('exports PDF via compileToad() build pipeline with -f pdf', async () => {
    const { compileToad } = await import('../src/build.js');
    const path = await import('node:path');
    const fs = await import('node:fs');

    const fixturePath = path.resolve('tests/fixtures/sample_shapes.toad');
    const outDir = path.resolve('tests/dist/pdf_test_output');

    const result = await compileToad(fixturePath, {
      outDir,
      format: 'pdf',
      bleed: '3mm'
    });

    expect(result.success).toBe(true);
    const pdfFiles = result.outputFiles.filter(f => f.endsWith('.pdf'));
    expect(pdfFiles.length).toBeGreaterThan(0);
    expect(fs.existsSync(pdfFiles[0]!)).toBe(true);

    const stat = fs.statSync(pdfFiles[0]!);
    expect(stat.size).toBeGreaterThan(200);
  });
});
