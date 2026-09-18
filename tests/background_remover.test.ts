import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  removeBackground,
  removeBackgroundFromFile,
  removeBackgroundFromDirectory,
  findImagesInDir,
  resolveModelName,
  applyGuidedFilter,
  boxFilter2D,
  MODEL_MAP
} from '../src/tools/backgroundRemover.js';
import { RawImage } from '@huggingface/transformers';

const execAsync = promisify(exec);

const FIXTURES_DIR = path.resolve('tests/fixtures');
const TEST_OUT_DIR = path.resolve('tests/dist/bg_remover_test');

describe('TOAD Background Remover Module', () => {
  beforeAll(() => {
    // Isolate test model cache from user home directory (F-35)
    process.env.TOAD_MODELS_CACHE = path.resolve('tests/dist/test_models');
    if (!fs.existsSync(TEST_OUT_DIR)) {
      fs.mkdirSync(TEST_OUT_DIR, { recursive: true });
    }
  });

  describe('Model Configuration & Helpers', () => {
    it('resolves model aliases correctly with commercial MIT defaults', () => {
      expect(resolveModelName('birefnet')).toBe(MODEL_MAP.birefnet);
      expect(resolveModelName('hair')).toBe(MODEL_MAP.hair);
      expect(resolveModelName('portrait')).toBe(MODEL_MAP.portrait);
      expect(resolveModelName('detail')).toBe(MODEL_MAP.detail);
      expect(resolveModelName('fast')).toBe(MODEL_MAP.fast);
      expect(resolveModelName('quick')).toBe(MODEL_MAP.quick);
      expect(resolveModelName(undefined)).toBe(MODEL_MAP.default);
      expect(resolveModelName(undefined, { hair: true })).toBe(MODEL_MAP.hair);
      expect(resolveModelName(undefined, { detail: true })).toBe(MODEL_MAP.detail);
      expect(resolveModelName(undefined, { fast: true })).toBe(MODEL_MAP.fast);
      expect(resolveModelName(undefined, { quick: true })).toBe(MODEL_MAP.quick);
      expect(resolveModelName('custom/model')).toBe('custom/model');
    });

    it('applies Guided Image Filter to refine alpha mask against full-res RGB guide (DYB mode)', () => {
      const guideData = new Uint8ClampedArray(10 * 10 * 3);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const idx = (y * 10 + x) * 3;
          const val = x < 5 ? 0 : 255;
          guideData[idx] = val;
          guideData[idx + 1] = val;
          guideData[idx + 2] = val;
        }
      }
      const guide = new RawImage(guideData, 10, 10, 3);

      const maskData = new Uint8ClampedArray(10 * 10);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          maskData[y * 10 + x] = x < 4 ? 0 : (x > 6 ? 255 : 128);
        }
      }
      const mask = new RawImage(maskData, 10, 10, 1);

      const refined = applyGuidedFilter(guide, mask, 2, 1e-3);
      expect(refined.width).toBe(10);
      expect(refined.height).toBe(10);
      expect(refined.channels).toBe(1);
      expect(refined.data.length).toBe(100);
      for (let i = 0; i < refined.data.length; i++) {
        expect(refined.data[i]).toBeGreaterThanOrEqual(0);
        expect(refined.data[i]).toBeLessThanOrEqual(255);
      }
    });

    it('finds supported image formats in a directory', () => {
      const images = findImagesInDir(FIXTURES_DIR);
      expect(images.length).toBeGreaterThan(0);
      for (const img of images) {
        const ext = path.extname(img).toLowerCase();
        expect(['.png', '.jpg', '.jpeg', '.webp']).toContain(ext);
      }
    });

    it('throws when source file does not exist', async () => {
      await expect(
        removeBackgroundFromFile('non_existent_file.png', path.join(TEST_OUT_DIR, 'out.png'))
      ).rejects.toThrow(/Source image not found/);
    });

    it('rejects vector SVG files with actionable error message (F-59)', async () => {
      const source = path.join(FIXTURES_DIR, 'hero_banner.svg');
      const target = path.join(TEST_OUT_DIR, 'svg_out.png');
      await expect(removeBackgroundFromFile(source, target)).rejects.toThrow(/Vector SVG format cannot be processed/);
    });
  });

  describe('Single Image Background Removal', () => {
    it('removes background from a PNG image and outputs valid transparent PNG', async () => {
      const source = path.join(FIXTURES_DIR, 'logo.png');
      const target = path.join(TEST_OUT_DIR, 'logo_nobg.png');

      const result = await removeBackgroundFromFile(source, target);

      expect(fs.existsSync(target)).toBe(true);
      expect(result.sourceFile).toBe(source);
      expect(result.targetFile).toBe(target);
      expect(result.width).toBe(1000);
      expect(result.height).toBe(1000);
      expect(result.outputBytes).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThan(0);
    }, 180000);

    it('removes background from a 3-channel RGB JPEG file without error (F-01, F-34)', async () => {
      const source = path.join(FIXTURES_DIR, 'logo.jpg');
      const target = path.join(TEST_OUT_DIR, 'logo_jpg_nobg.png');

      const result = await removeBackgroundFromFile(source, target);

      expect(fs.existsSync(target)).toBe(true);
      expect(result.sourceFile).toBe(source);
      expect(result.outputBytes).toBeGreaterThan(0);
    }, 180000);

    it('supports smart trimming with padding', async () => {
      const source = path.join(FIXTURES_DIR, 'logo.png');
      const target = path.join(TEST_OUT_DIR, 'logo_trimmed.png');

      const result = await removeBackgroundFromFile(source, target, {
        trim: true,
        padding: 10
      });

      expect(fs.existsSync(target)).toBe(true);
      // Trimmed dimensions should be smaller than original 1000x1000 canvas
      expect(result.width).toBeLessThan(1000);
      expect(result.height).toBeLessThan(1000);
      expect(result.cropBox).toBeDefined();
    }, 180000);

    it('supports WebP output format', async () => {
      const source = path.join(FIXTURES_DIR, 'logo.png');
      const target = path.join(TEST_OUT_DIR, 'logo_out.webp');

      const result = await removeBackgroundFromFile(source, target, {
        format: 'webp',
        quality: 90
      });

      expect(fs.existsSync(target)).toBe(true);
      expect(result.outputBytes).toBeGreaterThan(0);
    }, 180000);
  });

  describe('Batch Directory Background Removal', () => {
    it('processes multiple files in a directory and generates results in target folder', async () => {
      const batchIn = path.join(TEST_OUT_DIR, 'batch_input');
      const batchOut = path.join(TEST_OUT_DIR, 'batch_output');

      fs.mkdirSync(batchIn, { recursive: true });
      fs.copyFileSync(path.join(FIXTURES_DIR, 'logo.png'), path.join(batchIn, 'img1.png'));
      fs.copyFileSync(path.join(FIXTURES_DIR, 'sample_shapes.png'), path.join(batchIn, 'img2.png'));

      const progressEvents: any[] = [];
      const result = await removeBackgroundFromDirectory(batchIn, batchOut, {
        onProgress: (p) => progressEvents.push(p)
      });

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(fs.existsSync(path.join(batchOut, 'img1.png'))).toBe(true);
      expect(fs.existsSync(path.join(batchOut, 'img2.png'))).toBe(true);
      expect(progressEvents.length).toBe(2);
    }, 120000);
  });

  describe('Router Function (removeBackground)', () => {
    it('routes directory source to directory handler', async () => {
      const batchIn = path.join(TEST_OUT_DIR, 'batch_input');
      const batchOut = path.join(TEST_OUT_DIR, 'batch_routed_out');

      const result: any = await removeBackground(batchIn, batchOut);
      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
    }, 120000);

    it('routes single file source with directory target to auto-named target file', async () => {
      const source = path.join(FIXTURES_DIR, 'logo.png');
      const targetDir = path.join(TEST_OUT_DIR, 'routed_target_dir');

      const result: any = await removeBackground(source, targetDir);
      expect(result.targetFile).toBe(path.join(targetDir, 'logo.png'));
      expect(fs.existsSync(result.targetFile)).toBe(true);
    }, 60000);
  });

  describe('CLI Command Execution', () => {
    it('executes "toad remove-bg <source> <target>" via CLI successfully', async () => {
      const source = path.join(FIXTURES_DIR, 'logo.png');
      const target = path.join(TEST_OUT_DIR, 'cli_logo.png');

      const { stdout, stderr } = await execAsync(`node ./dist/cli.js remove-bg "${source}" "${target}"`);

      expect(stdout).toContain('TOAD Local Background Remover');
      expect(stdout).toContain('100% on-device processing');
      expect(stdout).toContain('SUCCESS');
      expect(fs.existsSync(target)).toBe(true);
    }, 60000);

    it('executes CLI on directory input', async () => {
      const batchIn = path.join(TEST_OUT_DIR, 'batch_input');
      const targetDir = path.join(TEST_OUT_DIR, 'cli_batch_out');

      const { stdout } = await execAsync(`node ./dist/cli.js remove-bg "${batchIn}" "${targetDir}"`);

      expect(stdout).toContain('Processed 2/2 image(s)');
      expect(fs.existsSync(path.join(targetDir, 'img1.png'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'img2.png'))).toBe(true);
    }, 120000);

    it('verifies CLI help is radically streamlined and zero-config', async () => {
      const { stdout } = await execAsync('node ./dist/cli.js remove-bg --help');
      expect(stdout).not.toContain('--hair');
      expect(stdout).not.toContain('--detail');
      expect(stdout).not.toContain('--model');
      expect(stdout).not.toContain('--padding');
      expect(stdout).not.toContain('--trim');
      expect(stdout).not.toContain('--motion');
      expect(stdout).not.toContain('--defringe');
      expect(stdout).not.toContain('--no-defringe');
      expect(stdout).not.toContain('--gpu');
      expect(stdout).not.toContain('--concurrency');
      expect(stdout).not.toContain('--doctor');
      expect(stdout).not.toContain('--quiet');
      expect(stdout).not.toContain('--json');
      expect(stdout).toContain('--dyb');
      expect(stdout).toContain('--fast');
      expect(stdout).toContain('--quick');
      expect(stdout).toContain('--format');
      expect(stdout).toContain('--recursive');
    });
  });
});