import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readPsd } from 'ag-psd';
import { compileToad, BuildResult } from '../src/build.js';

describe('Build Pipeline (compileToad)', () => {
  const testOutDir = path.resolve('tests/dist/build_test');

  beforeEach(() => {
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true, force: true });
    }
  });

  describe('Format Options & Output Generation', () => {
    it('compiles to PNG format by default', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const result: BuildResult = await compileToad(fixture, { outDir: testOutDir });

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(1);
      expect(result.outputFiles[0].endsWith('.png')).toBe(true);
      expect(fs.existsSync(result.outputFiles[0])).toBe(true);

      const buf = fs.readFileSync(result.outputFiles[0]);
      // PNG header: 0x89 0x50 0x4E 0x47
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4E);
      expect(buf[3]).toBe(0x47);
    });

    it('compiles to JPEG format with custom quality', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const result = await compileToad(fixture, {
        format: 'jpg',
        quality: 0.85,
        outDir: testOutDir
      });

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(1);
      expect(result.outputFiles[0].endsWith('.jpg')).toBe(true);
      expect(fs.existsSync(result.outputFiles[0])).toBe(true);

      const buf = fs.readFileSync(result.outputFiles[0]);
      // JPEG header: 0xFF 0xD8 0xFF
      expect(buf[0]).toBe(0xFF);
      expect(buf[1]).toBe(0xD8);
      expect(buf[2]).toBe(0xFF);
    });

    it('compiles to layered Photoshop PSD format', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const result = await compileToad(fixture, {
        format: 'psd',
        outDir: testOutDir
      });

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(1);
      expect(result.outputFiles[0].endsWith('.psd')).toBe(true);
      expect(fs.existsSync(result.outputFiles[0])).toBe(true);

      const buf = fs.readFileSync(result.outputFiles[0]);
      // PSD header: '8BPS'
      expect(buf.subarray(0, 4).toString()).toBe('8BPS');

      const psd = readPsd(buf);
      expect(psd.width).toBeGreaterThan(0);
      expect(psd.height).toBeGreaterThan(0);
      expect(psd.children).toBeDefined();
    });

    it('compiles to all core formats (png, jpg, psd) when format=all', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const result = await compileToad(fixture, {
        format: 'all',
        outDir: testOutDir
      });

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(5);

      const exts = result.outputFiles.map(f => path.extname(f).toLowerCase());
      expect(exts).toContain('.png');
      expect(exts).toContain('.jpg');
      expect(exts).toContain('.webp');
      expect(exts).toContain('.psd');
      expect(exts).toContain('.svg');

      for (const file of result.outputFiles) {
        expect(fs.existsSync(file)).toBe(true);
        expect(fs.statSync(file).size).toBeGreaterThan(0);
      }
    });

    it('compiles to single svg format when format=svg', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const result = await compileToad(fixture, {
        format: 'svg',
        outDir: testOutDir
      });

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(1);
      expect(result.outputFiles[0].endsWith('.svg')).toBe(true);
      expect(fs.existsSync(result.outputFiles[0])).toBe(true);
      const svgContent = fs.readFileSync(result.outputFiles[0], 'utf-8');
      expect(svgContent).toContain('<svg');
    });
  });

  describe('Scale Multipliers', () => {
    it('scales raster outputs by 2x multiplier', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const res1x = await compileToad(fixture, { format: 'png', scale: 1, outDir: testOutDir });
      const size1x = fs.statSync(res1x.outputFiles[0]).size;

      const out2xDir = path.join(testOutDir, '2x');
      const res2x = await compileToad(fixture, { format: 'png', scale: 2, outDir: out2xDir });
      const size2x = fs.statSync(res2x.outputFiles[0]).size;

      expect(res2x.success).toBe(true);
      expect(size2x).toBeGreaterThan(size1x);
    });

    it('handles fractional and high scale multipliers (0.5x and 4x)', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const resHalf = await compileToad(fixture, { scale: 0.5, outDir: path.join(testOutDir, 'half') });
      const res4x = await compileToad(fixture, { scale: 4, outDir: path.join(testOutDir, '4x') });

      expect(resHalf.success).toBe(true);
      expect(res4x.success).toBe(true);
    });
  });

  describe('Production Workload Fixtures', () => {
    it('compiles social_card.toad end-to-end', async () => {
      const fixture = 'tests/fixtures/social_card.toad';
      const result = await compileToad(fixture, {
        format: 'all',
        scale: 2,
        outDir: path.join(testOutDir, 'social')
      });

      expect(result.success).toBe(true);
      expect(result.canvas.width).toBe(1200);
      expect(result.canvas.height).toBe(630);
      expect(result.canvas.aspectRatio).toBe('40:21');
      expect(result.outputFiles).toHaveLength(5);
      expect(result.dependencies.length).toBeGreaterThanOrEqual(2);
    });

    it('compiles product_banner.toad with tile grid and currentColor', async () => {
      const fixture = 'tests/fixtures/product_banner.toad';
      const result = await compileToad(fixture, {
        format: 'psd',
        outDir: path.join(testOutDir, 'product')
      });

      expect(result.success).toBe(true);
      expect(result.canvas.width).toBe(1920);
      expect(result.canvas.height).toBe(1080);
      expect(result.canvas.aspectRatio).toBe('16:9');
    });

    it('compiles hero_banner.toad with custom tokens and polygon accents', async () => {
      const fixture = 'tests/fixtures/hero_banner.toad';
      const result = await compileToad(fixture, {
        format: 'png',
        outDir: path.join(testOutDir, 'hero')
      });

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(1);
    });

    it('compiles typography_poster.toad with @font directives', async () => {
      const fixture = 'tests/fixtures/typography_poster.toad';
      const result = await compileToad(fixture, {
        format: 'all',
        outDir: path.join(testOutDir, 'poster')
      });

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(5);
    });

    it('compiles mobile_mockup.toad with clipping masks and groups', async () => {
      const fixture = 'tests/fixtures/mobile_mockup.toad';
      const result = await compileToad(fixture, {
        format: 'all',
        outDir: path.join(testOutDir, 'mobile')
      });

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(5);
    });
  });

  describe('Structured BuildResult & Metadata', () => {
    it('returns structured BuildResult with all required metadata fields', async () => {
      const fixture = 'tests/fixtures/social_card.toad';
      const result = await compileToad(fixture, { outDir: testOutDir });

      expect(result.success).toBe(true);
      expect(typeof result.entryPath).toBe('string');
      expect(path.isAbsolute(result.entryPath)).toBe(true);
      expect(Array.isArray(result.outputFiles)).toBe(true);
      expect(result.layout).toBeDefined();
      expect(result.canvas).toBeDefined();
      expect(Array.isArray(result.dependencies)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('tracks and deduplicates all transitive file dependencies', async () => {
      const fixture = 'tests/fixtures/social_card.toad';
      const result = await compileToad(fixture, { outDir: testOutDir });

      const uniqueDeps = Array.from(new Set(result.dependencies));
      expect(result.dependencies.length).toBe(uniqueDeps.length);
      expect(result.dependencies.some(d => d.includes('tokens.toad'))).toBe(true);
      expect(result.dependencies.some(d => d.includes('components.toad'))).toBe(true);
      expect(result.dependencies.some(d => d.includes('social_card.toad'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('throws when entry file does not exist', async () => {
      await expect(
        compileToad('non_existent_file_path_xyz123.toad')
      ).rejects.toThrow(/not found/i);
    });

    it('throws when entry path is a directory instead of a file', async () => {
      await expect(
        compileToad('tests/fixtures')
      ).rejects.toThrow(/directory/i);
    });

    it('throws on invalid syntax in .toad file', async () => {
      const tempInvalid = path.join(testOutDir, 'invalid_syntax.toad');
      fs.mkdirSync(testOutDir, { recursive: true });
      fs.writeFileSync(tempInvalid, 'canvas { size: ; invalid!!!');

      await expect(
        compileToad(tempInvalid, { outDir: testOutDir })
      ).rejects.toThrow();
    });

    it('loads custom fonts from fontsDir when provided', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const fontsDir = path.resolve('tests/fixtures/fonts');
      if (!fs.existsSync(fontsDir)) {
        fs.mkdirSync(fontsDir, { recursive: true });
      }

      const result = await compileToad(fixture, {
        fontsDir,
        outDir: testOutDir
      });
      expect(result.success).toBe(true);
    });
  });
});
