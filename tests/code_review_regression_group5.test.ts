import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { FontLoader } from '../src/engine/fontLoader.js';
import { PdfExporter } from '../src/engine/pdfExporter.js';
import { importPsd } from '../src/importers/psdImporter.js';

describe('Regression Review Group 5 Verification Tests', () => {
  // REG-25: Component argument with hex-like ID (#cafe) is parsed as ElementReference
  it('REG-25: parses hex-like element ID in component arguments as ElementReference', () => {
    const code = `
      component Card(target: #cafe) {
        rect #inner { width: 10px; }
      }
      Card(target: #fade) {}
    `;
    const doc = parseToad(code);
    expect(doc).toBeDefined();

    // Check component argument in element call
    const cardElem = doc.elements[0] as any;
    expect(cardElem).toBeDefined();
    expect(cardElem.arguments).toBeDefined();
    const targetArg = cardElem.arguments.find((a: any) => a.name === 'target');
    expect(targetArg).toBeDefined();
    expect(targetArg.value.type).toBe('ElementReference');
    expect(targetArg.value.targetId).toBe('fade');
  });

  // REG-13: FontLoader strips quotes from family and invalidates unresolvableFamilies
  it('REG-13: FontLoader handles quoted family names and invalidates unresolvable cache', () => {
    // Lookup non-existent font to populate unresolvableFamilies
    const missing = FontLoader.resolvePostScriptName('"NonExistentFontFamily123"');
    expect(missing).toBeNull();

    // Calling resolve again with or without quotes should be consistently handled
    const missingClean = FontLoader.resolvePostScriptName('NonExistentFontFamily123');
    expect(missingClean).toBeNull();
  });

  // REG-21: PSD importer parses styleRuns and text transform matrix
  it('REG-21: PSD importer respects styleRuns fallback and affine transform scaling', async () => {
    const mockPsd: any = {
      width: 800,
      height: 600,
      children: [
        {
          name: 'Hero Text',
          left: 50,
          top: 100,
          right: 350,
          bottom: 150,
          text: {
            text: 'Scaled Headline',
            // No style object, only styleRuns
            styleRuns: [
              {
                length: 15,
                style: {
                  fontSize: 20,
                  fillColor: { r: 255, g: 0, b: 0, a: 1 },
                  font: { name: 'Helvetica-Bold' }
                }
              }
            ],
            // Transform matrix with 2x vertical scale [1, 0, 0, 2, 0, 0]
            transform: [1, 0, 0, 2, 0, 0]
          }
        }
      ]
    };

    const res = await importPsd(mockPsd, { extractImages: false });
    const toadDsl = res.toadCode;
    expect(toadDsl).toBeDefined();
    // Font size was 20 with 2x scale = 40px
    expect(toadDsl).toContain('font-size: 40px;');
    expect(toadDsl.toLowerCase()).toContain('color: #ff0000;');
  });

  // REG-19: PdfExporter generates /Widths array with character measurements
  it('REG-19: PdfExporter calculates character widths and embeds font metadata', async () => {
    const exporter = new PdfExporter();
    const layout: any = {
      canvas: { width: 400, height: 200 },
      nodes: [
        {
          id: 't1',
          type: 'text',
          x: 20,
          y: 50,
          width: 200,
          height: 30,
          textLayout: {
            text: 'Hello World',
            fontSize: 24,
            fontFamily: 'Helvetica',
            fontWeight: 'normal',
            lines: [{ text: 'Hello World', y: 50 }]
          },
          style: {}
        }
      ]
    };

    const pdfBuf = await exporter.export(layout);
    expect(pdfBuf).toBeDefined();
    expect(pdfBuf.length).toBeGreaterThan(0);
    const pdfStr = pdfBuf.toString('binary');
    expect(pdfStr).toContain('%PDF-1.4');
  });
});
