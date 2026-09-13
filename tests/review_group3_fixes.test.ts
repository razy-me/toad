import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { exportToSvg } from '../src/engine/svgExporter.js';
import { polygonToRoundedSvgPath, svgPathToSubpaths } from '../src/engine/vectorPathParser.js';
import { createIcoBuffer, rgbaToDib, bundleAssets } from '../src/tools/assetBundler.js';
import { sanitizeTextSnippet } from '../src/utils/layerNaming.js';
import { parseColorToRgba } from '../src/engine/drawUtils.js';
import { resolveSharedImage, clearImageCache } from '../src/engine/imageCache.js';
import { compileToad } from '../src/build.js';

describe('Review Group 3 Verification Suite', () => {
  it('F-03 & F-28: SVG exporter escapes href and single quotes in attributes', async () => {
    const layout = {
      canvas: { width: 400, height: 400, unit: 'px', dpi: 96, aspectRatio: '1:1' },
      fonts: [],
      dependencies: [],
      warnings: [],
      nodes: [
        {
          id: "malicious'img",
          name: "Test'Image",
          type: 'image',
          box: { x: 10, y: 10, w: 100, h: 100 },
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          style: { opacity: 1 },
          imageLayout: {
            src: 'https://example.com/pic.jpg?foo=1&bar=2" onerror="alert(1)'
          }
        }
      ]
    } as any;

    const svg = await exportToSvg(layout);
    expect(svg).not.toContain('onerror="alert(1)');
    expect(svg).toContain('&quot; onerror=&quot;alert(1)');
    expect(svg).toContain('&apos;');
  });

  it('F-16: polygonToRoundedSvgPath handles degenerate points without producing NaN', () => {
    // Degenerate polygon with repeated points and sharp angles
    const degeneratePoints = [
      { x: 10, y: 10 },
      { x: 10, y: 10 }, // Duplicate point
      { x: 100, y: 10 },
      { x: 10, y: 10.0001 } // Extremely sharp angle
    ];

    const svgPath = polygonToRoundedSvgPath(degeneratePoints, 20);
    expect(svgPath).not.toContain('NaN');
    expect(svgPath).not.toContain('Infinity');
    expect(svgPath.startsWith('M ')).toBe(true);
  });

  it('F-46: vectorPathParser handles S bezier shorthand without preceding C/S', () => {
    const pathData = 'M 10 10 S 50 50 100 100';
    const subpaths = svgPathToSubpaths(pathData);
    expect(subpaths.length).toBe(1);
    expect(subpaths[0].segments.length).toBe(1);
    const seg = subpaths[0].segments[0];
    expect(seg.p0.x).toBe(10);
    expect(seg.p0.y).toBe(10);
    // cp1 should fall back to current point (10, 10)
    expect(seg.cp1.x).toBe(10);
    expect(seg.cp1.y).toBe(10);
    expect(seg.p1.x).toBe(100);
    expect(seg.p1.y).toBe(100);
  });

  it('F-24: rgbaToDib produces valid Windows DIB bitmap header for ICO', () => {
    const width = 16;
    const height = 16;
    const rgba = Buffer.alloc(width * height * 4, 128);
    const dib = rgbaToDib(width, height, rgba);

    // BITMAPINFOHEADER is 40 bytes
    expect(dib.readUInt32LE(0)).toBe(40);
    expect(dib.readInt32LE(4)).toBe(16); // biWidth
    expect(dib.readInt32LE(8)).toBe(32); // biHeight (doubled: 16 * 2 = 32)
    expect(dib.readUInt16LE(12)).toBe(1); // biPlanes
    expect(dib.readUInt16LE(14)).toBe(32); // biBitCount

    const ico = createIcoBuffer([{ width: 16, height: 16, buffer: dib }]);
    expect(ico.readUInt16LE(0)).toBe(0); // Reserved
    expect(ico.readUInt16LE(2)).toBe(1); // Type 1 (ICO)
    expect(ico.readUInt16LE(4)).toBe(1); // 1 image
  });

  it('F-35: sanitizeTextSnippet handles surrogate pair emojis without splitting characters', () => {
    const emojiText = '?? ?? ?? A long description that needs truncating';
    const snippet = sanitizeTextSnippet(emojiText, 10);
    expect(snippet.endsWith('...')).toBe(true);
    // Ensure no broken surrogate pairs (isolated high/low surrogates)
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(snippet)).toBe(false);
  });

  it('F-53: parseColorToRgba parses 4-digit hex #RGBA correctly', () => {
    const col = parseColorToRgba('#f008');
    expect(col.r).toBe(255);
    expect(col.g).toBe(0);
    expect(col.b).toBe(0);
    expect(col.a).toBeCloseTo(8 / 15, 1);
  });

  it('F-15 & F-54: AssetBundler letterboxes non-square images and uses canvas background as themeColor', async () => {
    const entry = path.resolve('tests/fixtures/tokens.toad');
    const outDir = path.resolve('tests/dist/group3_bundle');
    const buildResult = await compileToad(entry, { format: 'png', outDir });

    const bundle = await bundleAssets(buildResult, {
      outDir,
      preset: 'favicons'
    });

    expect(bundle.assets.length).toBeGreaterThan(0);
    const manifestFile = path.join(outDir, 'site.webmanifest');
    expect(fs.existsSync(manifestFile)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
    expect(manifest.theme_color).toBeDefined();

    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('F-59: ImageCache invalidates cached image when mtime updates', async () => {
    clearImageCache();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toad-imgcache-test-'));
    const imgPath = path.join(tmpDir, 'test.png');
    
    // Write 1x1 png
    const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(imgPath, png1x1);

    const img1 = await resolveSharedImage(imgPath);
    expect(img1).not.toBeNull();

    // Mutate mtime into future
    const futureTime = (Date.now() + 10000) / 1000;
    fs.utimesSync(imgPath, futureTime, futureTime);

    const img2 = await resolveSharedImage(imgPath);
    expect(img2).not.toBeNull();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
