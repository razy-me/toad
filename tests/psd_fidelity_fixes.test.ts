import { describe, it, expect } from 'vitest';
import { readPsd } from 'ag-psd';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { exportToPsd } from '../src/engine/psdExporter.js';

async function generatePsd(src: string, options = {}) {
  const doc = parseToad(src);
  const resolved = await resolveImportsAndComponents(doc, 'main.toad');
  const layout = await solveLayout(resolved);
  const buf = await exportToPsd(layout, options);
  return readPsd(buf, { readLayers: true });
}

describe('PSD Fidelity Fixes & Prepress Accuracy', () => {
  // 1. Box Text Placement
  it('positions multiline box text bounding box at (node.x, node.y)', async () => {
    const src = `
      canvas { size: 600px 400px; }
      text #para {
        at: 50px 80px;
        size: 300px 150px;
        content: "Line One\\nLine Two";
        font-size: 20px;
        align: center;
      }
    `;
    const psd = await generatePsd(src);
    const layer = psd.children?.find(l => l.name === 'para' || l.name?.includes('Line One'));
    expect(layer).toBeDefined();
    expect(layer?.text?.shapeType).toBe('box');
    expect(layer?.text?.transform).toBeDefined();
    // In box text, transform[4] (tx) must match node.x (50), not node.x + width / 2
    expect(layer!.text!.transform![4]).toBeCloseTo(50, 1);
    // In box text, transform[5] (ty) must match node.y (80), not baselineY
    expect(layer!.text!.transform![5]).toBeCloseTo(80, 1);
  });

  // 2. Text-Transform Lowercase vs Small-Caps
  it('does not set fontCaps: 1 on text-transform: lowercase, but sets it on small-caps', async () => {
    const src = `
      canvas { size: 500px 300px; }
      text #lower {
        at: 20px 30px;
        content: "HELLO WORLD";
        text-transform: lowercase;
      }
      text #caps {
        at: 20px 80px;
        content: "small caps text";
        text-transform: small-caps;
      }
    `;
    const psd = await generatePsd(src);
    const lowerLayer = psd.children?.find(l => l.name === 'lower' || l.name?.toLowerCase().includes('hello'));
    const capsLayer = psd.children?.find(l => l.name === 'caps' || l.name?.toLowerCase().includes('small'));

    expect(lowerLayer?.text?.style?.fontCaps).toBeUndefined();
    expect(capsLayer?.text?.style?.fontCaps).toBe(1);
  });

  // 3. Barcode exports as native Vector Shape layer with vectorMask and vectorFill
  it('exports barcode as vector shape layer with vectorMask and vectorFill', async () => {
    const src = `
      canvas { size: 500px 300px; }
      barcode #code {
        at: 30px 40px;
        size: 200px 80px;
        value: "123456789012";
        show-text: true;
      }
    `;
    const psd = await generatePsd(src);
    const barcodeLayer = psd.children?.find(l => l.name === 'code');
    expect(barcodeLayer).toBeDefined();
    expect(barcodeLayer?.vectorMask).toBeDefined();
    expect(barcodeLayer?.vectorMask?.paths.length).toBeGreaterThan(0);
    expect(barcodeLayer?.vectorFill).toBeDefined();
  });

  // 4. QR-Code with logo does not have vectorMask clipping logo
  it('omits vectorMask on qrcode when a center logo is specified', async () => {
    const src = `
      canvas { size: 500px 500px; }
      qrcode #qr {
        at: 50px 50px;
        size: 200px 200px;
        value: "https://toad.design";
        logo: "logo.png";
      }
    `;
    const psd = await generatePsd(src);
    const qrLayer = psd.children?.find(l => l.name === 'qr');
    expect(qrLayer).toBeDefined();
    expect(qrLayer?.vectorMask).toBeUndefined();
  });

  // 5. Drop-Shadow Spread without Blur
  it('correctly maps spread without blur (blur: 0) to Photoshop size and 100% choke', async () => {
    const src = `
      canvas { size: 400px 400px; }
      rect #sharpShadow {
        at: 50px 50px;
        size: 100px 100px;
        fill: #ffffff;
        shadow: 0 5px 0 10px #000000;
      }
    `;
    const psd = await generatePsd(src);
    const layer = psd.children?.find(l => l.name === 'sharpShadow');
    expect(layer?.effects?.dropShadow).toBeDefined();
    const shadow = layer!.effects!.dropShadow![0]!;
    // Total size = blur (0) + spread (10) = 10
    expect(shadow.size?.value).toBe(10);
    // Choke = (spread / size) * 100 = 100%
    expect(shadow.choke?.value).toBe(100);
  });

  // 6. Conic Gradients in vectorFill
  it('generates native Photoshop angle vectorFill for conic gradients', async () => {
    const src = `
      canvas { size: 400px 400px; }
      rect #conicBox {
        at: 50px 50px;
        size: 200px 200px;
        fill: conic-gradient(from 0deg, #ff0000, #00ff00, #0000ff);
      }
    `;
    const psd = await generatePsd(src);
    const layer = psd.children?.find(l => l.name === 'conicBox');
    expect(layer?.vectorFill).toBeDefined();
    expect((layer?.vectorFill as any)?.style).toBe('angle');
  });

  // 7. Prepress Bleed & Crop Marks Expansion
  it('expands PSD document dimensions when bleed is defined', async () => {
    const src = `
      canvas {
        size: 100px 100px;
        bleed: 10px;
      }
      rect { size: 50px 50px; }
    `;
    const psd = await generatePsd(src);
    // Total width = 100 + 2 * 10 = 120
    expect(psd.width).toBe(120);
    expect(psd.height).toBe(120);
  });

  // 8. Mask Node Deduplication
  it('does not export a mask element twice when referenced by mask property', async () => {
    const src = `
      canvas { size: 400px 400px; }
      rect #avatarMask {
        at: 20px 20px;
        size: 100px 100px;
        radius: 50px;
      }
      rect #avatarPhoto {
        at: 20px 20px;
        size: 100px 100px;
        fill: #3b82f6;
        mask: #avatarMask;
      }
    `;
    const psd = await generatePsd(src);
    // Check that avatarMask does not appear as a standalone root layer
    const standaloneMask = psd.children?.find(l => l.name === 'avatarMask');
    expect(standaloneMask).toBeUndefined();

    // Check that it is inside the Mask Group
    const maskGroup = psd.children?.find(l => l.name?.includes('Mask Group'));
    expect(maskGroup).toBeDefined();
    expect(maskGroup?.children).toHaveLength(2);
  });
});
