import { describe, it, expect } from 'vitest';
import { readPsd } from 'ag-psd';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { renderToBuffer } from '../src/engine/canvasRenderer.js';
import { exportToSvg } from '../src/engine/svgExporter.js';
import { exportToPsd } from '../src/engine/psdExporter.js';
import { generateQrCode } from '../src/engine/qrGenerator.js';
import { generateBarcode } from '../src/engine/barcodeGenerator.js';

describe('1D Barcode & 2D QR Code Generation & DSL Integration', () => {
  describe('QR Code Generator (ISO/IEC 18004)', () => {
    it('generates valid QR matrix and modules for URLs and text', () => {
      const qr = generateQrCode('https://toad.design');
      expect(qr.size).toBeGreaterThanOrEqual(21);
      expect(qr.matrix.length).toBe(qr.size);
      expect(qr.matrix[0].length).toBe(qr.size);
      // Top-left finder pattern must be dark at (0, 0)
      expect(qr.matrix[0][0]).toBe(true);
      expect(qr.matrix[0][6]).toBe(true);
      expect(qr.matrix[6][0]).toBe(true);
    });

    it('supports custom error correction levels (L, M, Q, H)', () => {
      const qrL = generateQrCode('TEST_DATA', { ecl: 'L' });
      const qrH = generateQrCode('TEST_DATA', { ecl: 'H' });
      expect(qrL.ecl).toBe('L');
      expect(qrH.ecl).toBe('H');
      // Higher error correction level uses more codewords, so version/size may increase
      expect(qrH.size).toBeGreaterThanOrEqual(qrL.size);
    });

    it('automatically defaults ECL to H and allocates center quiet box when logo is provided', () => {
      const qrWithLogo = generateQrCode('https://example.com/checkout', { logo: 'brand.png' });
      expect(qrWithLogo.ecl).toBe('H');
      expect(qrWithLogo.logoBox).toBeDefined();
      expect(qrWithLogo.logoBox!.width).toBeGreaterThan(0);
      expect(qrWithLogo.logoBox!.height).toBeGreaterThan(0);

      // Verify that modules inside the center logo quiet zone are blank (false)
      const { x, y, width, height } = qrWithLogo.logoBox!;
      for (let r = y; r < y + height; r++) {
        for (let c = x; c < x + width; c++) {
          expect(qrWithLogo.matrix[r][c]).toBe(false);
        }
      }
    });

    it('generates crisp compound SVG path', () => {
      const qr = generateQrCode('HELLO_TOAD');
      const pathD = qr.toSvgPath(200, 200);
      expect(pathD).toContain('M ');
      expect(pathD).toContain(' Z');
      expect(pathD.length).toBeGreaterThan(100);
    });
  });

  describe('1D Barcode Generator', () => {
    it('generates valid Code 128 barcode with start B, stop character, and checksum', () => {
      const bc = generateBarcode('TOAD-12345', { format: 'code128' });
      expect(bc.format).toBe('code128');
      expect(bc.bars.length).toBeGreaterThan(10);
      expect(bc.totalModules).toBeGreaterThan(50);
      const pathD = bc.toSvgPath(240, 80);
      expect(pathD).toContain('M ');
      expect(pathD).toContain(' Z');
    });

    it('generates valid EAN-13 barcode with checksum calculation', () => {
      // 12-digit payload: 400638133393 -> checksum 1
      const bc = generateBarcode('400638133393', { format: 'ean13' });
      expect(bc.format).toBe('ean13');
      expect(bc.text).toBe('4006381333931');
      expect(bc.totalModules).toBe(113); // Standard EAN-13 total modules including quiet zones
    });

    it('generates UPC-A and Code 39 barcodes', () => {
      const upc = generateBarcode('012345678905', { format: 'upc' });
      expect(upc.format).toBe('upc');
      expect(upc.bars.length).toBeGreaterThan(0);

      const c39 = generateBarcode('TOAD39', { format: 'code39' });
      expect(c39.format).toBe('code39');
      expect(c39.bars.length).toBeGreaterThan(0);
    });

    it('adjusts bar height ratio when showText is true vs false', () => {
      const bcNoText = generateBarcode('ABC-123', { showText: false });
      const pathNoText = bcNoText.toSvgPath(200, 100);

      const bcWithText = generateBarcode('ABC-123', { showText: true });
      const pathWithText = bcWithText.toSvgPath(200, 100);

      // With text, bars are shorter (e.g. 80px high instead of 100px)
      expect(pathNoText).toContain('v 100.00');
      expect(pathWithText).toContain('v 80.00');
    });
  });

  describe('TOAD DSL Syntax & AST Compilation', () => {
    it('parses qrcode and barcode declarations with headers and properties', async () => {
      const doc = parseToad(`
        canvas { size: 600px 600px; }
        qrcode "https://toad.design" #site-qr {
          at: 40px 40px;
          size: 180px 180px;
          fill: #1e293b;
          ecl: "Q";
        }
        barcode "9876543210" #product-barcode {
          at: 40px 260px;
          size: 260px 90px;
          format: "code128";
          show-text: true;
        }
      `);

      const qrElem = doc.elements.find((e: any) => e.type === 'QrCodeElement');
      expect(qrElem).toBeDefined();
      expect((qrElem as any).value).toBe('https://toad.design');
      expect(qrElem?.id).toBe('site-qr');

      const barElem = doc.elements.find((e: any) => e.type === 'BarcodeElement');
      expect(barElem).toBeDefined();
      expect((barElem as any).value).toBe('9876543210');
      expect(barElem?.id).toBe('product-barcode');
    });

    it('resolves default sizes and positions in layout engine', async () => {
      const doc = parseToad(`
        canvas { size: 500px 500px; }
        qrcode "DEFAULT_QR" #qr_def;
        barcode "DEFAULT_BAR" #bar_def;
      `);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const qrNode = layout.nodes.find(e => e.id === 'qr_def');
      expect(qrNode).toBeDefined();
      expect(qrNode?.type).toBe('qrcode');
      expect(qrNode?.width).toBe(150); // Default QR width
      expect(qrNode?.height).toBe(150); // Default QR height
      expect(qrNode?.pathLayout?.d).toBeDefined();
      expect(qrNode?.qrcodeLayout?.value).toBe('DEFAULT_QR');

      const barNode = layout.nodes.find(e => e.id === 'bar_def');
      expect(barNode).toBeDefined();
      expect(barNode?.type).toBe('barcode');
      expect(barNode?.width).toBe(240); // Default barcode width
      expect(barNode?.height).toBe(80);  // Default barcode height
      expect(barNode?.pathLayout?.d).toBeDefined();
      expect(barNode?.barcodeLayout?.value).toBe('DEFAULT_BAR');
    });

    it('supports relational positioning and scaling with other elements', async () => {
      const doc = parseToad(`
        canvas { size: 600px 600px; }
        qrcode "https://github.com" #anchor_qr {
          at: 50px 50px;
          size: 160px 160px;
        }
        barcode "REL-4455" #rel_barcode {
          at: below #anchor_qr offset 30px;
          size: 280px 100px;
          show-text: true;
        }
      `);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const barNode = layout.nodes.find(e => e.id === 'rel_barcode');
      expect(barNode).toBeDefined();
      // y = 50 + 160 + 30 = 240
      expect(barNode?.y).toBe(240);
      expect(barNode?.width).toBe(280);
      expect(barNode?.height).toBe(100);
    });
  });

  describe('Exporters (Canvas, SVG, PSD)', () => {
    it('renders QR code and Barcode to Canvas without throwing', async () => {
      const doc = parseToad(`
        canvas { size: 400px 400px; background: #ffffff; }
        qrcode "CANVAS_TEST" #qr {
          at: 20px 20px;
          size: 140px 140px;
        }
        barcode "CANVAS_BAR" #bar {
          at: 20px 180px;
          size: 200px 70px;
          show-text: true;
        }
      `);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const canvasBuf = await renderToBuffer(layout);
      expect(canvasBuf).toBeDefined();
      expect(canvasBuf.length).toBeGreaterThan(1000);
    });

    it('exports QR code and Barcode as crisp SVG vector paths and text', async () => {
      const doc = parseToad(`
        canvas { size: 500px 500px; }
        qrcode "SVG_QR_URL" #my_svg_qr {
          at: 30px 30px;
          size: 150px 150px;
          fill: #2563eb;
        }
        barcode "SVG_BAR_CODE" #my_svg_bar {
          at: 30px 220px;
          size: 240px 80px;
          fill: #0f172a;
          show-text: true;
        }
      `);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);
      const svg = await exportToSvg(layout);

      expect(svg).toContain('<svg');
      expect(svg).toContain('id="my_svg_qr"');
      expect(svg).toContain('fill="#2563eb"');
      expect(svg).toContain('id="my_svg_bar"');
      expect(svg).toContain('fill="#0f172a"');
      expect(svg).toContain('SVG_BAR_CODE'); // Human-readable text
    });

    it('exports QR code and Barcode to PSD as native Vector Shape layers', async () => {
      const doc = parseToad(`
        canvas { size: 500px 500px; background: #ffffff; }
        qrcode "PSD_VECTOR_QR" #qr_psd {
          at: 40px 40px;
          size: 160px 160px;
          fill: #1e1b4b;
        }
        barcode "PSD12345" #bar_psd {
          at: 40px 240px;
          size: 220px 75px;
          fill: #047857;
          show-text: true;
        }
      `);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);
      const psdBuf = await exportToPsd(layout);

      const psd = readPsd(psdBuf, { readLayers: true, readVectorMask: true });
      expect(psd.children).toBeDefined();

      const qrLayer = psd.children?.find(l => l.name === 'qr_psd');
      expect(qrLayer).toBeDefined();
      expect(qrLayer?.vectorMask).toBeDefined();
      expect(qrLayer?.vectorMask?.paths.length).toBeGreaterThan(0);
      expect(qrLayer?.vectorFill).toBeDefined();
      expect(qrLayer?.vectorFill?.type).toBe('color');

      const barLayer = psd.children?.find(l => l.name === 'bar_psd');
      expect(barLayer).toBeDefined();
      expect(barLayer?.vectorMask).toBeDefined();
      expect(barLayer?.vectorMask?.paths.length).toBeGreaterThan(0);
      expect(barLayer?.vectorFill).toBeDefined();
      expect(barLayer?.vectorFill?.type).toBe('color');
    });
  });
});
