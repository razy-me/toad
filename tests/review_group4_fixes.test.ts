import { describe, it, expect } from 'vitest';
import { exportToPsd, PsdExporter } from '../src/engine/psdExporter.js';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { renderToCanvas } from '../src/engine/canvasRenderer.js';
import { parseOpenTypeFontNames, parseOpenTypeMetrics, normalizeFontWeightToNumber } from '../src/engine/fontLoader.js';
import { calculateOklchEntropy, calculateSlopTriadDistance } from '../src/tools/metrics/colorEntropy.js';
import { TextMeasurementCache, AstCache, normalizeCachePath } from '../src/engine/buildCache.js';
import { createCanvasGradient } from '../src/engine/drawUtils.js';
import { sanitizeFilterCss, normalizeFilterCss, splitUnsafeFilterFns } from '../src/engine/imageCache.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Review Gruppe 4 Verification Tests', () => {
  // F-02: PSD ALI length header aligns with 4-byte on-disk boundary
  it('F-02: enforcePsdFourBytePadding ensures all ALI block headers and data are 4-byte aligned for ag-psd and Photopea', async () => {
    const src = `
      canvas { size: 200px 200px; background: #ffffff; }
      rect #card {
        at: 10px 10px;
        size: 80px 80px;
        fill: #2563eb;
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'inline.toad');
    const layout = await solveLayout(resolved);
    const psdBuf = await exportToPsd(layout);

    // Scan for SoCo ALI block
    const socoIdx = psdBuf.indexOf('SoCo');
    expect(socoIdx).toBeGreaterThan(-1);

    const socoLen = psdBuf.readUInt32BE(socoIdx + 4);
    // Header length must be 4-byte aligned so both Photopea and ag-psd land on next signature
    expect(socoLen % 4).toBe(0);

    // The next block signature starts exactly at 8 + socoLen
    const nextSig = psdBuf.toString('ascii', socoIdx + 8 + socoLen, socoIdx + 8 + socoLen + 4);
    expect(['8BIM', '8B64']).toContain(nextSig);
  });

  // F-08: Canvas Renderer mask clipping with 0 width/height icon
  it('F-08: canvasRenderer handles zero-sized icon masks without CTM poisoning or division-by-zero', async () => {
    const src = `
      canvas { size: 200px 200px; }
      icon #zeroMask {
        at: 10px 10px;
        size: 0px 0px;
      }
      rect #target {
        at: 0px 0px;
        size: 100px 100px;
        fill: #ff0000;
        mask: #zeroMask;
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'inline.toad');
    const layout = await solveLayout(resolved);

    // Should not throw or produce NaN in Canvas context
    const canvas = await renderToCanvas(layout);
    expect(canvas).toBeDefined();
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
  });

  // F-09: FontLoader streams table headers without loading entire font into memory
  it('F-09: parseOpenTypeFontNames and parseOpenTypeMetrics handle invalid/non-font files safely', () => {
    // Create a temporary non-font dummy file
    const tmpFile = path.join(process.cwd(), 'temp_dummy_group4.bin');
    fs.writeFileSync(tmpFile, Buffer.from('NOT_A_FONT_FILE_JUST_TESTING_ERROR_HANDLING'));
    try {
      const names = parseOpenTypeFontNames(tmpFile);
      expect(names).toBeNull();

      const metrics = parseOpenTypeMetrics(tmpFile);
      expect(metrics).toBeNull();
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  });

  // F-31: ColorEntropy strided sampling for large arrays
  it('F-31: calculateOklchEntropy and calculateSlopTriadDistance execute efficiently with strided downsampling', () => {
    // Generate an oversized array of 10,000 colors
    const largeColorArray = Array.from({ length: 10000 }, (_, i) => ({
      r: (i * 37) % 256,
      g: (i * 59) % 256,
      b: (i * 83) % 256,
      a: 1
    }));

    const start = Date.now();
    const entropy = calculateOklchEntropy(largeColorArray);
    const triadDist = calculateSlopTriadDistance(largeColorArray);
    const elapsed = Date.now() - start;

    expect(entropy).toBeGreaterThan(0);
    expect(triadDist).toBeGreaterThanOrEqual(0);
    expect(triadDist).toBeLessThanOrEqual(1);
    // Should complete in well under 200ms thanks to strided downsampling
    expect(elapsed).toBeLessThan(500);
  });

  // F-33: TextMeasurementCache LRU entry cap and eviction
  it('F-33: TextMeasurementCache enforces maxEntries cap and evicts oldest items in LRU order', () => {
    const cache = new TextMeasurementCache(10);
    const dummyLayout = { width: 100, height: 20, lines: ['Test'] };

    // Fill with 10 entries
    for (let i = 0; i < 10; i++) {
      cache.set(`key_${i}`, dummyLayout);
    }
    expect(cache.getStats().entries).toBe(10);

    // Access key_0 so it becomes most recently used
    expect(cache.get('key_0')).toBeDefined();

    // Insert 11th entry - should trigger eviction of oldest 20% (2 items: key_1 and key_2)
    cache.set('key_10', dummyLayout);
    expect(cache.getStats().entries).toBeLessThanOrEqual(10);

    // key_0 was refreshed, so it should still be present
    expect(cache.has('key_0')).toBe(true);
    // key_1 was oldest and evicted
    expect(cache.has('key_1')).toBe(false);
  });

  // F-34: Radial gradient radius calculations for circle vs ellipse
  it('F-34: createCanvasGradient computes closest-side radius for circle and geometric mean for ellipse', () => {
    const mockCtx: any = {
      createRadialGradient: (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) => ({
        x0, y0, r0, x1, y1, r1,
        addColorStop: () => {}
      })
    };

    // Wide banner 1200 x 300 (rx = 600, ry = 150)
    const box = { x: 0, y: 0, w: 1200, h: 300 };

    // 1. Explicit circle shape -> closest-side = min(600, 150) = 150
    const circleGrad: any = createCanvasGradient(mockCtx, {
      type: 'radial',
      shape: 'circle',
      stops: [{ color: '#fff', position: 0 }, { color: '#000', position: 1 }]
    }, box);
    expect(circleGrad.r1).toBe(150);

    // 2. Default ellipse -> geometric mean sqrt(600 * 150) = 300
    const ellipseGrad: any = createCanvasGradient(mockCtx, {
      type: 'radial',
      shape: 'ellipse',
      stops: [{ color: '#fff', position: 0 }, { color: '#000', position: 1 }]
    }, box);
    expect(ellipseGrad.r1).toBe(300);
  });

  // F-49: Cache key path normalization on Windows drive letters
  it('F-49: normalizeCachePath canonicalizes Windows drive letters and forward slashes', () => {
    expect(normalizeCachePath('c:\\Users\\dev\\project\\main.toad')).toBe('C:/Users/dev/project/main.toad');
    expect(normalizeCachePath('D:\\repo\\file.toad')).toBe('D:/repo/file.toad');
    expect(normalizeCachePath('/usr/local/share/file.toad')).toBe('/usr/local/share/file.toad');

    const cache = new AstCache(10);
    const mockAst: any = { type: 'document', canvas: { width: 100, height: 100 }, elements: [] };

    cache.set('c:\\toad\\test.toad', 12345, mockAst);
    // Retrieval with uppercase forward slashes should hit the same cache entry
    const retrieved = cache.get('C:/toad/test.toad', 12345);
    expect(retrieved).toBe(mockAst);
  });

  // F-52: Normalization of "semi-bold" with hyphen
  it('F-52: normalizeFontWeightToNumber and parser weight shorthand support "semi-bold"', async () => {
    expect(normalizeFontWeightToNumber('semi-bold')).toBe(600);
    expect(normalizeFontWeightToNumber('semibold')).toBe(600);
    expect(normalizeFontWeightToNumber('extra-bold')).toBe(800);
    expect(normalizeFontWeightToNumber('extra-light')).toBe(200);

    const src = `
      canvas { size: 200px 100px; }
      text #label {
        at: 10px 10px;
        content: "Weight Test";
        font: 16px "semi-bold" sans-serif;
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'inline.toad');
    const label = resolved.elements.find(e => e.id === 'label');
    expect(label?.font?.weight).toBe('600');
  });

  // F-56: CSS Filter trailing semicolon tolerance
  it('F-56: sanitizeFilterCss and normalizeFilterCss handle trailing semicolons gracefully', () => {
    expect(sanitizeFilterCss('blur(4px);')).toBe('blur(4px)');
    expect(sanitizeFilterCss('blur(8px);   ')).toBe('blur(8px)');
    expect(normalizeFilterCss('blur(6);')).toBe('blur(6px)');

    const split = splitUnsafeFilterFns('blur(5px);');
    expect(split.safeCss).toBe('blur(5px)');
  });
});
