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
  MODEL_MAP
} from '../src/tools/backgroundRemover.js';

const execAsync = promisify(exec);

const FIXTURES_DIR = path.resolve('tests/fixtures');
const TEST_OUT_DIR = path.resolve('tests/dist/bg_remover_test');

describe('TOAD Background Remover Module', () => {
  beforeAll(() => {
    if (!fs.existsSync(TEST_OUT_DIR)) {
      fs.mkdirSync(TEST_OUT_DIR, { recursive: true });
    }
  });

  describe('Model Configuration & Helpers', () => {
    it('resolves model aliases correctly', () => {
      expect(resolveModelName('ormbg')).toBe(MODEL_MAP.ormbg);
      expect(resolveModelName('birefnet')).toBe(MODEL_MAP.birefnet);
      expect(resolveModelName('dyb')).toBe(MODEL_MAP.birefnet);
      expect(resolveModelName(undefined)).toBe(MODEL_MAP.ormbg);
      expect(resolveModelName('custom/model')).toBe('custom/model');
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
    }, 60000);

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
    }, 60000);

    it('supports WebP output format', async () => {
      const source = path.join(FIXTURES_DIR, 'logo.png');
      const target = path.join(TEST_OUT_DIR, 'logo_out.webp');

      const result = await removeBackgroundFromFile(source, target, {
        format: 'webp',
        quality: 90
      });

      expect(fs.existsSync(target)).toBe(true);
      expect(result.outputBytes).toBeGreaterThan(0);
    }, 60000);
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
  });
});