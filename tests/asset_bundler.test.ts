import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { bundleAssets, createIcoBuffer } from '../src/tools/assetBundler.js';
import { BuildResult } from '../src/build.js';

describe('Multi-Resolution Asset Bundler (Feature 4)', () => {
  const tmpOutDir = path.resolve(process.cwd(), 'tests', 'fixtures', 'test-bundle-out');

  afterEach(() => {
    if (fs.existsSync(tmpOutDir)) {
      fs.rmSync(tmpOutDir, { recursive: true, force: true });
    }
  });

  it('generates a complete favicon and PWA icon suite with manifest and ICO', async () => {
    const src = `
      canvas { size: 512px 512px; background: #2563eb; }
      rect #iconBase {
        at: 64px 64px;
        size: 384px 384px;
        fill: #ffffff;
        radius: 64px;
        circle #dot {
          at: center of #iconBase;
          size: 160px;
          fill: #2563eb;
        }
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'test-icon.toad');
    const layout = await solveLayout(resolved);

    const mockBuildResult: BuildResult = {
      success: true,
      entryPath: path.resolve(process.cwd(), 'tests', 'fixtures', 'test-icon.toad'),
      outputFiles: [],
      layout,
      canvas: layout.canvas,
      dependencies: [],
      warnings: [],
      durationMs: 12
    };

    const res = await bundleAssets(mockBuildResult, {
      preset: 'favicons',
      outDir: tmpOutDir,
      name: 'Toad App',
      shortName: 'Toad',
      themeColor: '#2563eb'
    });

    expect(res.assets.length).toBe(6);
    expect(fs.existsSync(path.join(tmpOutDir, 'favicon-16x16.png'))).toBe(true);
    expect(fs.existsSync(path.join(tmpOutDir, 'favicon-32x32.png'))).toBe(true);
    expect(fs.existsSync(path.join(tmpOutDir, 'apple-touch-icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(tmpOutDir, 'android-chrome-192x192.png'))).toBe(true);
    expect(fs.existsSync(path.join(tmpOutDir, 'android-chrome-512x512.png'))).toBe(true);
    expect(fs.existsSync(path.join(tmpOutDir, 'favicon.ico'))).toBe(true);

    // Verify valid ICO header
    const icoBuf = fs.readFileSync(path.join(tmpOutDir, 'favicon.ico'));
    expect(icoBuf.readUInt16LE(0)).toBe(0); // Reserved
    expect(icoBuf.readUInt16LE(2)).toBe(1); // Type 1 = ICO
    expect(icoBuf.readUInt16LE(4)).toBeGreaterThanOrEqual(2); // At least 16 and 32 icons

    // Verify manifest
    expect(res.manifestPath).toBeDefined();
    const manifestContent = JSON.parse(fs.readFileSync(res.manifestPath!, 'utf-8'));
    expect(manifestContent.name).toBe('Toad App');
    expect(manifestContent.short_name).toBe('Toad');
    expect(manifestContent.theme_color).toBe('#2563eb');
    expect(manifestContent.icons.length).toBeGreaterThan(0);

    // Verify HTML snippet
    expect(res.htmlSnippetPath).toBeDefined();
    const htmlSnippet = fs.readFileSync(res.htmlSnippetPath!, 'utf-8');
    expect(htmlSnippet).toContain('rel="apple-touch-icon"');
    expect(htmlSnippet).toContain('rel="manifest"');
  });

  it('supports target element isolation and social pack preset', async () => {
    const src = `
      canvas { size: 1200px 800px; background: #111827; }
      rect #brandMark {
        at: 100px 100px;
        size: 200px 200px;
        fill: #38bdf8;
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'test-social.toad');
    const layout = await solveLayout(resolved);

    const mockBuildResult: BuildResult = {
      success: true,
      entryPath: path.resolve(process.cwd(), 'tests', 'fixtures', 'test-social.toad'),
      outputFiles: [],
      layout,
      canvas: layout.canvas,
      dependencies: [],
      warnings: [],
      durationMs: 10
    };

    const res = await bundleAssets(mockBuildResult, {
      preset: 'social',
      outDir: tmpOutDir,
      target: '#brandMark'
    });

    expect(res.assets.length).toBe(5);
    expect(fs.existsSync(path.join(tmpOutDir, 'og-image.png'))).toBe(true);
    expect(fs.existsSync(path.join(tmpOutDir, 'twitter-card.png'))).toBe(true);
  });
});
