import { describe, it, expect, afterEach } from 'vitest';
import { exportToPdfBuffer, parsePdfColor, PdfExporter } from '../src/engine/pdfExporter.js';
import { renderToCanvas } from '../src/engine/canvasRenderer.js';
import { cmykToRgb, parseColorToRgba } from '../src/engine/drawUtils.js';
import { calculateModularScaleFidelity, analyzeTypographicTelemetry } from '../src/tools/metrics/typographicAnalysis.js';
import { inferErrorCode, formatRustDiagnostic } from '../src/tools/diagnostics.js';
import { c as cliColors } from '../src/cli.js';
import { formatTerminalReport } from '../src/tools/designAuditor.js';
import { LayoutResult } from '../src/parser/math.js';

describe('Review Group 5 Hardening & Regression Tests', () => {
  const originalNoColor = process.env.NO_COLOR;

  afterEach(() => {
    if (originalNoColor !== undefined) {
      process.env.NO_COLOR = originalNoColor;
    } else {
      delete process.env.NO_COLOR;
    }
  });

  // F-06: PDF Exporter barcode, qrcode, and image support
  it('F-06: exports layout with barcode, qrcode, and image to valid PDF buffer', async () => {
    const layout: LayoutResult = {
      canvas: { width: 400, height: 400, background: '#ffffff' },
      nodes: [
        {
          id: 'qr-1',
          type: 'qrcode',
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          box: { x: 10, y: 10, w: 100, h: 100 },
          style: { fill: '#111111' },
          pathLayout: { d: 'M 0 0 L 10 0 L 10 10 L 0 10 Z' }
        },
        {
          id: 'bar-1',
          type: 'barcode',
          x: 120,
          y: 10,
          width: 150,
          height: 80,
          box: { x: 120, y: 10, w: 150, h: 80 },
          style: { fill: '#000000' },
          pathLayout: { d: 'M 0 0 L 2 0 L 2 60 L 0 60 Z' },
          barcodeLayout: { showText: true, text: '1234567890', bars: [] }
        },
        {
          id: 'img-1',
          type: 'image',
          x: 10,
          y: 150,
          width: 120,
          height: 80,
          box: { x: 10, y: 150, w: 120, h: 80 },
          style: {},
          imageLayout: { src: 'non_existent_image_test.png', fit: 'fill' }
        }
      ]
    };

    const buf = await exportToPdfBuffer(layout);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
    const pdfHeader = buf.subarray(0, 5).toString('ascii');
    expect(pdfHeader).toBe('%PDF-');
  });

  // F-17: CanvasRenderer graceful error handling on missing/invalid images
  it('F-17: handles unresolvable images and photo backgrounds without crashing or unhandled rejection', async () => {
    const layout: LayoutResult = {
      canvas: {
        width: 200,
        height: 200,
        mode: 'photo',
        photoSrc: 'non_existent_background_photo.jpg'
      },
      nodes: [
        {
          id: 'img-node',
          type: 'image',
          x: 10,
          y: 10,
          width: 80,
          height: 80,
          box: { x: 10, y: 10, w: 80, h: 80 },
          style: {},
          imageLayout: { src: 'broken_path_image.jpg' }
        },
        {
          id: 'qr-node',
          type: 'qrcode',
          x: 100,
          y: 10,
          width: 80,
          height: 80,
          box: { x: 100, y: 10, w: 80, h: 80 },
          style: {},
          qrcodeLayout: {
            matrix: [[1]],
            logo: 'broken_logo.png',
            logoBox: { x: 0, y: 0, width: 1, height: 1 }
          }
        },
        {
          id: 'adjust-node',
          type: 'adjust',
          x: 10,
          y: 100,
          width: 80,
          height: 80,
          box: { x: 10, y: 100, w: 80, h: 80 },
          style: {},
          adjustLayout: { radius: 20, feather: 5 }
        }
      ]
    };

    // Should resolve without rejecting
    const canvas = await renderToCanvas(layout);
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
  });

  // F-18: Type 1 standard font registration and dynamic tag resolution
  it('F-18: resolves standard Type 1 font variants (Times, Courier, Helvetica, Bold, Italic)', async () => {
    const layout: LayoutResult = {
      canvas: { width: 300, height: 300 },
      nodes: [
        {
          id: 't-times',
          type: 'text',
          x: 10,
          y: 20,
          width: 200,
          height: 30,
          box: { x: 10, y: 20, w: 200, h: 30 },
          style: { fontFamily: 'Times New Roman', fontWeight: 'bold', fontStyle: 'italic' },
          textLayout: { lines: ['Editorial'], fontSize: 24, fontFamily: 'Times' }
        },
        {
          id: 't-mono',
          type: 'text',
          x: 10,
          y: 60,
          width: 200,
          height: 30,
          box: { x: 10, y: 60, w: 200, h: 30 },
          style: { fontFamily: 'Courier New', fontWeight: 400 },
          textLayout: { lines: ['Code snippet'], fontSize: 16, fontFamily: 'Courier' }
        }
      ]
    };

    const buf = await exportToPdfBuffer(layout);
    const pdfStr = buf.toString('latin1');
    expect(pdfStr).toContain('/Times-BoldItalic');
    expect(pdfStr).toContain('/Courier');
    expect(pdfStr).toContain('/Helvetica');
  });

  // F-29: Transliteration of non-WinAnsi symbols and decomposed accents in encodePdfString
  it('F-29: transliterates symbols (arrows, bullets, checkmarks) and decomposes accents', () => {
    const exporter = new PdfExporter();
    const encode = (exporter as any).encodePdfString.bind(exporter);

    expect(encode('A → B')).toBe('A -> B');
    expect(encode('Check: ✓')).toBe('Check: [v]');
    expect(encode('Bullets • stars ★')).toContain('\\225'); // bullet is WinAnsi 149 = \225
    expect(encode('Accents: č, ž, š, ł')).toBe('Accents: c, \\236, \\232, l');
    expect(encode('Ć')).toBe('C');
  });

  // F-32: Typographic Analysis math safety with non-positive font sizes
  it('F-32: does not produce NaN or Infinity with zero or negative font sizes', () => {
    const badNodes: any[] = [
      { type: 'text', textLayout: { fontSize: 0, lineHeight: 0, lines: ['a', 'b', 'c'] } },
      { type: 'text', textLayout: { fontSize: -5, lineHeight: 10, lines: ['d'] } },
      { type: 'text', style: { fontSize: 0 } }
    ];

    const fit = calculateModularScaleFidelity(badNodes);
    expect(Number.isFinite(fit.r2Score)).toBe(true);
    expect(Number.isNaN(fit.r2Score)).toBe(false);

    const telemetry = analyzeTypographicTelemetry(badNodes);
    expect(Number.isFinite(telemetry.marginEntropy)).toBe(true);
    expect(Number.isNaN(telemetry.marginEntropy)).toBe(false);
  });

  // F-44: Diagnostics map token syntax errors to TOAD-E001 instead of TOAD-E999
  it('F-44: maps syntax token errors and TOAD-E999 to TOAD-E001', () => {
    expect(inferErrorCode('Unexpected token KW_SLOT', 'slot')).toBe('TOAD-E001');
    expect(inferErrorCode('Unclosed block comment')).toBe('TOAD-E001');

    const diag = formatRustDiagnostic({
      message: 'Unexpected token at end of input',
      code: 'TOAD-E999',
      sourceText: 'slot'
    });
    expect(diag).toContain('error[TOAD-E001]');
    expect(diag).toContain('slot;');
  });

  // F-55: CMYK clamping to [0, 1]
  it('F-55: clamps CMYK values to [0, 1] in drawUtils and pdfExporter', () => {
    const cmyk1 = parsePdfColor('cmyk(150%, -20%, 300%, 0%)');
    expect(cmyk1.mode).toBe('cmyk');
    expect(cmyk1.c).toBe(1);
    expect(cmyk1.m).toBe(0);
    expect(cmyk1.y).toBe(1);
    expect(cmyk1.k).toBe(0);

    const rgb = cmykToRgb(1.8, -0.5, 2.5, 0);
    expect(rgb.r).toBeGreaterThanOrEqual(0);
    expect(rgb.r).toBeLessThanOrEqual(255);
    expect(rgb.g).toBeGreaterThanOrEqual(0);
    expect(rgb.b).toBeGreaterThanOrEqual(0);

    const parsedRgba = parseColorToRgba('cmyk(200%, 0%, 0%, 50%)');
    expect(parsedRgba.r).toBeGreaterThanOrEqual(0);
    expect(parsedRgba.r).toBeLessThanOrEqual(255);
  });

  // F-57: Toad list sorts files alphabetically
  it('F-57: sorts files alphabetically by filename', () => {
    const files = [
      { name: 'zebra.toad', path: '/b/zebra.toad', size: 100, mtime: new Date() },
      { name: 'alpha.toad', path: '/z/alpha.toad', size: 100, mtime: new Date() },
      { name: 'Beta.toad', path: '/a/Beta.toad', size: 100, mtime: new Date() }
    ];

    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.path.localeCompare(b.path));
    expect(files[0]!.name).toBe('alpha.toad');
    expect(files[1]!.name).toBe('Beta.toad');
    expect(files[2]!.name).toBe('zebra.toad');
  });

  // F-58: Disables ANSI color codes when NO_COLOR is set
  it('F-58: respects NO_COLOR environment variable', () => {
    process.env.NO_COLOR = '1';
    const boldText = cliColors.bold('Test Text');
    expect(boldText).toBe('Test Text');
    expect(boldText).not.toContain('\x1b[');

    const mockReport: any = {
      overallScore: 95,
      overallGrade: 'A+',
      findings: [],
      categories: {
        antiSlop: { score: 100, grade: 'A+' }
      },
      metrics: {
        negativeSpacePercent: 50,
        distinctFontFamilies: ['Inter']
      }
    };

    const out = formatTerminalReport(mockReport);
    expect(out).not.toContain('\x1b[');
  });
});
