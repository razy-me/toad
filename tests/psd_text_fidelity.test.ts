import { describe, it, expect } from 'vitest';
import { readPsd } from 'ag-psd';
import { exportToPsd } from '../src/engine/psdExporter.js';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { parseOpenTypeFontNames, FontLoader } from '../src/engine/fontLoader.js';

async function generatePsd(src: string, options = {}, filename = 'test.toad') {
  const parsed = parseToad(src, filename);
  const resolved = await resolveImportsAndComponents(parsed, filename);
  const layout = await solveLayout(resolved);
  return exportToPsd(layout, options);
}

describe('PSD Text Fidelity & Resolution Consistency', () => {
  it('embeds 72 PPI resolutionInfo by default in imageResources', async () => {
    const src = `
      canvas { size: 500px 400px; background: #ffffff; }
      text #title {
        at: 20px 30px;
        content: "Title Here";
        font-size: 24px;
        color: #000000;
      }
    `;
    const buf = await generatePsd(src);
    const psd = readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true });

    expect(psd.imageResources?.resolutionInfo).toBeDefined();
    expect(psd.imageResources?.resolutionInfo?.horizontalResolution).toBe(72);
    expect(psd.imageResources?.resolutionInfo?.verticalResolution).toBe(72);
    expect(psd.imageResources?.resolutionInfo?.horizontalResolutionUnit).toBe('PPI');
    expect(psd.imageResources?.resolutionInfo?.verticalResolutionUnit).toBe('PPI');
  });

  it('respects custom DPI passed through options', async () => {
    const src = `
      canvas { size: 500px 400px; background: #ffffff; }
      text #title {
        at: 20px 30px;
        content: "Print Resolution";
        font-size: 36px;
        color: #000000;
      }
    `;
    const buf = await generatePsd(src, { dpi: 300 });
    const psd = readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true });

    expect(psd.imageResources?.resolutionInfo).toBeDefined();
    expect(psd.imageResources?.resolutionInfo?.horizontalResolution).toBe(300);
    expect(psd.imageResources?.resolutionInfo?.verticalResolution).toBe(300);

    const layer = psd.children?.find(c => c.name === 'Print Resolution');
    expect(layer?.text).toBeDefined();
    // 36px converted to points at 300 DPI: 36 * 72 / 300 = 8.64 pt
    expect(layer?.text?.style?.fontSize).toBeCloseTo(8.64, 2);
  });

  it('sanitizes CSS font fallback stacks to primary PostScript name without commas', async () => {
    const src = `
      canvas { size: 400px 200px; }
      text #t1 {
        at: 10px 10px;
        content: "Inter Stack";
        font-family: "Inter, -apple-system, sans-serif";
        font-size: 20px;
        color: #000;
      }
      text #t2 {
        at: 10px 60px;
        content: "Roboto Stack";
        font-family: 'Roboto, Arial, sans-serif';
        font-size: 16px;
        color: #000;
      }
    `;
    const buf = await generatePsd(src);
    const psd = readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true });

    const l1 = psd.children?.find(c => c.name === 'Inter Stack');
    expect(l1?.text?.style?.font?.name).toBe('Inter-Regular');
    expect(l1?.text?.style?.font?.name).not.toContain(',');

    const l2 = psd.children?.find(c => c.name === 'Roboto Stack');
    expect(l2?.text?.style?.font?.name).toBe('Roboto-Regular');
    expect(l2?.text?.style?.font?.name).not.toContain(',');
  });

  it('maps generic CSS font families to universal PostScript identifiers', async () => {
    const src = `
      canvas { size: 400px 300px; }
      text #sans {
        at: 10px 10px;
        content: "Sans Text";
        font-family: "sans-serif";
        font-size: 16px;
      }
      text #sansBold {
        at: 10px 50px;
        content: "Sans Bold";
        font-family: "sans-serif";
        font-weight: bold;
        font-size: 16px;
      }
      text #serif {
        at: 10px 90px;
        content: "Serif Text";
        font-family: "serif";
        font-size: 16px;
      }
      text #mono {
        at: 10px 130px;
        content: "Mono Text";
        font-family: "monospace";
        font-size: 16px;
      }
    `;
    const buf = await generatePsd(src);
    const psd = readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true });

    const lSans = psd.children?.find(c => c.name === 'Sans Text');
    expect(lSans?.text?.style?.font?.name).toBe('ArialMT');

    const lSansBold = psd.children?.find(c => c.name === 'Sans Bold');
    expect(lSansBold?.text?.style?.font?.name).toBe('Arial-BoldMT');

    const lSerif = psd.children?.find(c => c.name === 'Serif Text');
    expect(lSerif?.text?.style?.font?.name).toBe('TimesNewRomanPSMT');

    const lMono = psd.children?.find(c => c.name === 'Mono Text');
    expect(lMono?.text?.style?.font?.name).toBe('Courier');
  });

  it('maps granular font weights (e.g. 600, semibold) to PostScript style cuts', async () => {
    const src = `
      canvas { size: 400px 200px; }
      text #semi {
        at: 10px 10px;
        content: "SemiBold Title";
        font-family: "Inter";
        font-weight: 600;
        font-size: 22px;
      }
      text #medium {
        at: 10px 50px;
        content: "Medium Title";
        font-family: "Inter";
        font-weight: medium;
        font-size: 18px;
      }
    `;
    const buf = await generatePsd(src);
    const psd = readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true });

    const lSemi = psd.children?.find(c => c.name === 'SemiBold Title');
    expect(lSemi?.text?.style?.font?.name).toBe('Inter-SemiBold');

    const lMed = psd.children?.find(c => c.name === 'Medium Title');
    expect(lMed?.text?.style?.font?.name).toBe('Inter-Medium');
  });

  it('preserves exact 1:1 pixel point size and leading at 1x scale at 72 PPI', async () => {
    const src = `
      canvas { size: 400px 200px; }
      text #quote {
        at: 10px 10px;
        content: "Pixel Parity";
        font-size: 28px;
        line-height: 36px;
      }
    `;
    const buf = await generatePsd(src);
    const psd = readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true });

    const l = psd.children?.find(c => c.name === 'Pixel Parity');
    expect(l?.text?.style?.fontSize).toBe(28);
    expect(l?.text?.style?.leading).toBe(36);
  });

  it('extracts genuine PostScript name from OpenType / TrueType font tables', () => {
    // Test on noto-sans or Agency FB if present
    const ttfPath = 'website/node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf';
    const parsed = parseOpenTypeFontNames(ttfPath);
    if (parsed) {
      expect(parsed.postScript).toBeDefined();
      expect(parsed.postScript).toBe('NotoSans-Regular');
    }
  });

  it('resolves closest registered font weight when intermediate weight is requested', () => {
    // Register mock faces directly into FontLoader
    FontLoader.registerFontFile('website/node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf', 'CustomNoto', 'normal');

    // Resolving regular should return the exact PostScript name
    const resolved = FontLoader.resolvePostScriptName('CustomNoto', 400, 'normal');
    expect(resolved).toBe('NotoSans-Regular');

    // Resolving 500 or 300 should match NotoSans-Regular as the closest available face
    expect(FontLoader.resolvePostScriptName('CustomNoto', 500, 'normal')).toBe('NotoSans-Regular');
    expect(FontLoader.resolvePostScriptName('CustomNoto', 300, 'normal')).toBe('NotoSans-Regular');
  });

  it('omits fillColor.a for opaque text to ensure 100% opacity in Photoshop/Photopea', async () => {
    const src = `
      canvas { size: 400px 200px; }
      text #solid {
        at: 10px 10px;
        content: "Solid Black";
        color: #000000;
      }
      text #transparent {
        at: 10px 50px;
        content: "Half Opacity";
        color: alpha(#000000, 0.5);
      }
    `;
    const buf = await generatePsd(src);
    const psd = readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true });

    const solid = psd.children?.find(c => c.name === 'Solid Black');
    expect(solid?.text?.style?.fillColor).toBeDefined();
    // Crucial: 'a' MUST be undefined for opaque colors so ag-psd doesn't divide 1 by 255
    expect((solid?.text?.style?.fillColor as any)?.a).toBeUndefined();
    expect(solid?.text?.style?.fillColor?.r).toBe(0);

    const half = psd.children?.find(c => c.name === 'Half Opacity');
    expect(half?.text?.style?.fillColor).toBeDefined();
    // Half opacity must be scaled to [0..255] for ag-psd
    expect((half?.text?.style?.fillColor as any)?.a).toBeCloseTo(128, -1);
  });

  it('propagates container 180deg rotation matrix down to child text and vector layers', async () => {
    const src = `
      canvas { size: 500px 500px; }
      group #side1 {
        at: 50px 50px;
        size: 300px 200px;
        rotation: 180;
        text #rotatedText {
          at: 10px 10px;
          content: "Rotated Face";
          font-size: 20px;
        }
        rect #rotatedBox {
          at: 10px 50px;
          size: 100px 50px;
          fill: #ff0000;
        }
      }
    `;
    const buf = await generatePsd(src);
    const psd = readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true });

    const group = psd.children?.find(c => c.name === 'side1');
    expect(group).toBeDefined();

    const textLayer = group?.children?.find(c => c.name === 'Rotated Face');
    expect(textLayer).toBeDefined();
    expect(textLayer?.text?.transform).toBeDefined();
    const transform = textLayer!.text!.transform!;
    // Matrix for 180deg: cos(pi) = -1, sin(pi) = 0 => a ~ -1, b ~ 0, c ~ 0, d ~ -1
    expect(transform[0]).toBeCloseTo(-1, 2);
    expect(transform[1]).toBeCloseTo(0, 2);
    expect(transform[2]).toBeCloseTo(0, 2);
    expect(transform[3]).toBeCloseTo(-1, 2);

    const boxLayer = group?.children?.find(c => c.name === 'rotatedBox');
    expect(boxLayer).toBeDefined();
    expect(boxLayer?.vectorMask?.paths?.[0]?.knots).toBeDefined();
    // Because container is rotated, origination must be cleared and knots transformed
    expect((boxLayer as any)?.vectorOrigination).toBeUndefined();
  });

  it('computes center-aligned text transform anchor at horizontal center', async () => {
    const src = `
      canvas { size: 600px 300px; }
      text #centered {
        at: 50px 50px;
        size: 200px;
        content: "Centered Text";
        align: center;
        font-size: 24px;
      }
    `;
    const buf = await generatePsd(src);
    const psd = readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true });

    const layer = psd.children?.find(c => c.name === 'Centered Text');
    expect(layer?.text).toBeDefined();
    expect(layer?.text?.paragraphStyle?.justification).toBe('center');
    // anchorX should be at 50 + 200/2 = 150
    const tx = layer!.text!.transform![4]!;
    expect(tx).toBeCloseTo(150, 1);
  });
});


