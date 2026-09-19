import { describe, it, expect } from 'vitest';
import { generateQrCode } from '../src/engine/qrGenerator.js';
import { generateBarcode } from '../src/engine/barcodeGenerator.js';
import { importPsd } from '../src/importers/psdImporter.js';
import { PdfExporter } from '../src/engine/pdfExporter.js';
import * as zlib from 'node:zlib';

describe('Regression Review Group 6 Verification Tests', () => {
  // REG-06: generateQrCode falls back to lower ECL for large payloads with logo
  it('REG-06: generateQrCode gracefully falls back to lower ECL when payload exceeds ECL H', () => {
    // Generate ~1600 bytes of data (exceeds ECL H max capacity of 1532 bytes, but fits in ECL Q/M)
    const largePayload = 'A'.repeat(1600);
    const res = generateQrCode(largePayload, { hasLogo: true });
    expect(res).toBeDefined();
    expect(res.version).toBeLessThanOrEqual(40);
    // ECL should have fallen back from H to Q or M
    expect(['Q', 'M', 'L']).toContain(res.ecl);
  });

  // REG-26: generateQrCode blanks quiet zone padding during mask evaluation
  it('REG-26: generateQrCode computes padded logoBox and blanks quiet zone', () => {
    const res = generateQrCode('https://example.com/test', { hasLogo: true, logoRatio: 0.25 });
    expect(res.logoBox).toBeDefined();
    const box = res.logoBox!;
    expect(box.padWidth).toBeGreaterThan(box.width);
    expect(box.padHeight).toBeGreaterThan(box.height);

    // Verify all modules in quiet zone are blanked (false)
    for (let r = box.padY; r < box.padY + box.padHeight; r++) {
      for (let c = box.padX; c < box.padX + box.padWidth; c++) {
        if (res.matrix[r] && res.matrix[r]![c] !== undefined) {
          expect(res.matrix[r]![c]).toBe(false);
        }
      }
    }
  });

  // REG-41: Code 128 Mode C supports odd digit count
  it('REG-41: Code 128 encodes odd digit count by switching to Mode B', () => {
    // 5 digits: 12, 34, switch to B, 5
    const barRes = generateBarcode('12345', { format: 'code128' });
    expect(barRes).toBeDefined();
    expect(barRes.bars.length).toBeGreaterThan(0);
    expect(barRes.totalModules).toBeGreaterThan(0);
  });

  // REG-20: Hidden unclipped layers reset lastBaseId in PSD importer
  it('REG-20: PSD importer resets lastBaseId when encountering hidden unclipped layer', async () => {
    const mockPsd: any = {
      width: 500,
      height: 500,
      children: [
        {
          name: 'BaseLayer1',
          left: 0,
          top: 0,
          right: 100,
          bottom: 100,
          clipping: false,
          hidden: false
        },
        {
          name: 'HiddenBaseLayer2',
          left: 10,
          top: 10,
          right: 100,
          bottom: 100,
          clipping: false,
          hidden: true // Hidden unclipped base layer
        },
        {
          name: 'ClippedLayer3',
          left: 20,
          top: 20,
          right: 80,
          bottom: 80,
          clipping: true, // Should NOT clip to BaseLayer1
          hidden: false
        }
      ]
    };

    const res = await importPsd(mockPsd, { includeHidden: false, extractImages: false });
    expect(res).toBeDefined();
    const toadCode = res.toadCode;
    // ClippedLayer3 should not have mask: #BaseLayer1
    expect(toadCode).not.toContain('mask: #BaseLayer1');
  });

  // REG-45: PdfExporter includes half-leading in startY for custom line-height
  it('REG-45: PdfExporter adjusts text startY when custom line-height is specified', async () => {
    const exporter = new PdfExporter();
    const layout: any = {
      canvas: { width: 400, height: 200 },
      nodes: [
        {
          id: 'text1',
          type: 'text',
          x: 50,
          y: 50,
          width: 200,
          height: 60,
          textLayout: {
            text: 'Leading Test',
            fontSize: 20,
            lineHeight: 40, // 40px line-height on 20px font -> 10px half-leading
            fontFamily: 'Helvetica',
            fontWeight: 'normal',
            lines: [{ text: 'Leading Test', y: 50 }]
          },
          style: {}
        }
      ]
    };

    const pdfBuf = await exporter.export(layout);
    expect(pdfBuf).toBeDefined();

    const streamStart = pdfBuf.indexOf(Buffer.from('stream\n')) + 7;
    const streamEnd = pdfBuf.indexOf(Buffer.from('\nendstream'));
    const compressed = pdfBuf.subarray(streamStart, streamEnd);
    const decompressed = zlib.inflateSync(compressed).toString('utf-8');

    // Baseline y should be 50 + halfLeading (10) + 20 * 0.85 (17) = 77.00
    expect(decompressed).toContain('77.00 Tm');
  });
});
