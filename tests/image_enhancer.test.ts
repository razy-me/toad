import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  enhanceImage,
  enhanceImageFile,
  enhanceImagesInDirectory,
  enhanceRawImage,
  resolveEnhanceModelName,
  applyBilateralDenoise,
  applyRichardsonLucyDeblur,
  applyMultiScaleSharpen,
  upscaleEdgeDirectedIBP,
  gaussianBlur2D,
  ENHANCE_MODEL_MAP
} from '../src/tools/imageEnhancer.js';
import { RawImage } from '@huggingface/transformers';

const execAsync = promisify(exec);

const FIXTURES_DIR = path.resolve('tests/fixtures');
const TEST_OUT_DIR = path.resolve('tests/dist/image_enhancer_test');

/**
 * Helper to create a synthetic test RawImage (checkerboard + circle + gradient)
 */
function createSyntheticTestImage(width = 48, height = 48, channels: 3 | 4 = 3): RawImage {
  const data = new Uint8ClampedArray(width * height * channels);
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.3;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const dist = Math.hypot(x - cx, y - cy);
      const inCircle = dist <= r;
      const checker = ((Math.floor(x / 6) + Math.floor(y / 6)) % 2) === 0;

      if (inCircle) {
        data[idx] = 230;
        data[idx + 1] = 75;
        data[idx + 2] = 140;
      } else {
        data[idx] = checker ? 210 : 45;
        data[idx + 1] = checker ? 215 : 55;
        data[idx + 2] = checker ? 225 : 70;
      }
      if (channels === 4) {
        data[idx + 3] = inCircle ? 255 : 0;
      }
    }
  }
  return new RawImage(data, width, height, channels);
}

/**
 * Computes mean gradient magnitude (Tenengrad sharpness metric) on RGB image
 */
function computeEdgeSharpness(img: RawImage): number {
  const { width, height, channels, data } = img;
  let sum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * channels;
      const idxR = (y * width + (x + 1)) * channels;
      const idxL = (y * width + (x - 1)) * channels;
      const idxD = ((y + 1) * width + x) * channels;
      const idxU = ((y - 1) * width + x) * channels;

      const gx = (data[idxR] - data[idxL]) * 0.5;
      const gy = (data[idxD] - data[idxU]) * 0.5;
      sum += Math.hypot(gx, gy);
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

describe('TOAD AI Image Enhancer & Super-Resolution Module', () => {
  beforeAll(() => {
    const defaultCache = path.join(os.homedir(), '.toad', 'models');
    process.env.TOAD_MODELS_CACHE = fs.existsSync(defaultCache) ? defaultCache : path.resolve('tests/dist/test_models');
    if (!fs.existsSync(TEST_OUT_DIR)) {
      fs.mkdirSync(TEST_OUT_DIR, { recursive: true });
    }
  });

  describe('Model Configuration & Optical Restoration Algorithms', () => {
    it('resolves Swin2SR model aliases accurately across presets and scales', () => {
      expect(resolveEnhanceModelName('fast')).toBe(ENHANCE_MODEL_MAP.fast);
      expect(resolveEnhanceModelName('quick')).toBe(ENHANCE_MODEL_MAP.quick);
      expect(resolveEnhanceModelName('balanced')).toBe(ENHANCE_MODEL_MAP.balanced);
      expect(resolveEnhanceModelName('dyb')).toBe(ENHANCE_MODEL_MAP.dyb);
      expect(resolveEnhanceModelName('realworld')).toBe(ENHANCE_MODEL_MAP.realworld);
      expect(resolveEnhanceModelName('compressed')).toBe(ENHANCE_MODEL_MAP.compressed);
      expect(resolveEnhanceModelName(undefined, { fast: true })).toBe(ENHANCE_MODEL_MAP.fast);
      expect(resolveEnhanceModelName(undefined, { scale: 4 })).toBe(ENHANCE_MODEL_MAP.realworld);
      expect(resolveEnhanceModelName(undefined, { scale: 4, denoise: true })).toBe(ENHANCE_MODEL_MAP.compressed);
      expect(resolveEnhanceModelName(undefined, { dyb: true, scale: 2 })).toBe(ENHANCE_MODEL_MAP.classical);
      expect(resolveEnhanceModelName('custom/sr-model')).toBe('custom/sr-model');
    });

    it('reduces flat-region noise while preserving step edges via Bilateral Luma/Chroma Denoising', () => {
      const width = 32;
      const height = 32;
      const clean = new Uint8ClampedArray(width * height * 3);
      const noisy = new Uint8ClampedArray(width * height * 3);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 3;
          const base = x < 16 ? 40 : 210;
          const noise = ((x * 17 + y * 31) % 21) - 10; // deterministic +/-10 noise
          for (let c = 0; c < 3; c++) {
            clean[idx + c] = base;
            noisy[idx + c] = Math.max(0, Math.min(255, base + noise));
          }
        }
      }

      const noisyImg = new RawImage(noisy, width, height, 3);
      const denoisedImg = applyBilateralDenoise(noisyImg, 1.0);

      // Measure MSE to clean ground truth
      let mseBefore = 0;
      let mseAfter = 0;
      for (let i = 0; i < clean.length; i++) {
        mseBefore += (noisy[i] - clean[i]) ** 2;
        mseAfter += (denoisedImg.data[i] - clean[i]) ** 2;
      }
      mseBefore /= clean.length;
      mseAfter /= clean.length;

      expect(mseAfter).toBeLessThan(mseBefore);
      // Verify step edge contrast between left (x=4) and right (x=28) is preserved
      const leftVal = denoisedImg.data[(16 * width + 4) * 3];
      const rightVal = denoisedImg.data[(16 * width + 28) * 3];
      expect(rightVal - leftVal).toBeGreaterThan(150);
    });

    it('restores blurred edges via Richardson-Lucy Deconvolution (Deblur)', () => {
      const sharpImg = createSyntheticTestImage(40, 40, 3);
      // Blur each channel with Gaussian sigma=1.2
      const r = new Float32Array(40 * 40);
      const g = new Float32Array(40 * 40);
      const b = new Float32Array(40 * 40);
      for (let i = 0; i < 40 * 40; i++) {
        r[i] = sharpImg.data[i * 3];
        g[i] = sharpImg.data[i * 3 + 1];
        b[i] = sharpImg.data[i * 3 + 2];
      }
      const br = gaussianBlur2D(r, 40, 40, 1.2);
      const bg = gaussianBlur2D(g, 40, 40, 1.2);
      const bb = gaussianBlur2D(b, 40, 40, 1.2);
      const blurredData = new Uint8ClampedArray(40 * 40 * 3);
      for (let i = 0; i < 40 * 40; i++) {
        blurredData[i * 3] = Math.round(br[i]);
        blurredData[i * 3 + 1] = Math.round(bg[i]);
        blurredData[i * 3 + 2] = Math.round(bb[i]);
      }
      const blurredImg = new RawImage(blurredData, 40, 40, 3);

      const deblurredImg = applyRichardsonLucyDeblur(blurredImg, 8, 1.1);
      const blurSharpness = computeEdgeSharpness(blurredImg);
      const restoredSharpness = computeEdgeSharpness(deblurredImg);

      expect(restoredSharpness).toBeGreaterThan(blurSharpness);
    });

    it('enhances micro-contrast and acutance via Multi-Scale Frequency Synthesis', () => {
      const baseImg = createSyntheticTestImage(40, 40, 3);
      const sharpened = applyMultiScaleSharpen(baseImg, {
        fineAmount: 0.65,
        mediumAmount: 0.4,
        clarityAmount: 0.25
      });

      expect(sharpened.width).toBe(40);
      expect(sharpened.height).toBe(40);
      expect(computeEdgeSharpness(sharpened)).toBeGreaterThan(computeEdgeSharpness(baseImg));
    });

    it('upscales 2x and 4x cleanly with Edge-Directed Iterative Back-Projection (IBP)', () => {
      const src = createSyntheticTestImage(24, 24, 3);
      const up2 = upscaleEdgeDirectedIBP(src, 2, 3);
      expect(up2.width).toBe(48);
      expect(up2.height).toBe(48);

      const up4 = upscaleEdgeDirectedIBP(src, 4, 2);
      expect(up4.width).toBe(96);
      expect(up4.height).toBe(96);
    });

    it('throws when source file does not exist', async () => {
      await expect(
        enhanceImageFile('non_existent_photo.png', path.join(TEST_OUT_DIR, 'out.png'))
      ).rejects.toThrow(/Source image not found/);
    });

    it('rejects vector SVG files with actionable error message', async () => {
      const source = path.join(FIXTURES_DIR, 'hero_banner.svg');
      const target = path.join(TEST_OUT_DIR, 'svg_out.png');
      await expect(enhanceImageFile(source, target)).rejects.toThrow(/Vector SVG format cannot be processed/);
    });
  });

  describe('Single Image AI Enhancement & Super-Resolution', () => {
    it('enhances and upscales an image 2x using neural Swin2SR super-resolution', async () => {
      const srcImg = createSyntheticTestImage(32, 32, 3);
      const sourcePath = path.join(TEST_OUT_DIR, 'small_input.png');
      const targetPath = path.join(TEST_OUT_DIR, 'small_enhanced_2x.png');
      await srcImg.save(sourcePath);

      const result = await enhanceImageFile(sourcePath, targetPath, {
        scale: 2,
        preset: 'fast'
      });

      expect(fs.existsSync(targetPath)).toBe(true);
      expect(result.inputWidth).toBe(32);
      expect(result.inputHeight).toBe(32);
      expect(result.outputWidth).toBe(64);
      expect(result.outputHeight).toBe(64);
      expect(result.scale).toBe(2);
      expect(result.outputBytes).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThan(0);
    }, 120000);

    it('performs 1x optical deblur + denoise restoration without changing canvas dimensions', async () => {
      const srcImg = createSyntheticTestImage(48, 48, 3);
      const sourcePath = path.join(TEST_OUT_DIR, 'blurry_1x_input.png');
      const targetPath = path.join(TEST_OUT_DIR, 'restored_1x_output.png');
      await srcImg.save(sourcePath);

      const result = await enhanceImageFile(sourcePath, targetPath, {
        scale: 1,
        deblur: true,
        denoise: true
      });

      expect(fs.existsSync(targetPath)).toBe(true);
      expect(result.outputWidth).toBe(48);
      expect(result.outputHeight).toBe(48);
      expect(result.scale).toBe(1);
    }, 60000);

    it('preserves and refines RGBA alpha channel when upscaling transparent cutouts 2x', async () => {
      const rgbaImg = createSyntheticTestImage(32, 32, 4);
      const enhanced = await enhanceRawImage(rgbaImg, {
        scale: 2,
        fast: true
      });

      expect(enhanced.width).toBe(64);
      expect(enhanced.height).toBe(64);
      expect(enhanced.channels).toBe(4);
      // Corner pixel should remain transparent (alpha === 0)
      expect(enhanced.data[3]).toBe(0);
      // Center pixel should remain opaque (alpha === 255)
      const centerIdx = (32 * 64 + 32) * 4;
      expect(enhanced.data[centerIdx + 3]).toBeGreaterThan(240);
    }, 120000);

    it('supports WebP and JPEG output formats', async () => {
      const srcImg = createSyntheticTestImage(32, 32, 3);
      const sourcePath = path.join(TEST_OUT_DIR, 'fmt_input.png');
      await srcImg.save(sourcePath);

      const webpTarget = path.join(TEST_OUT_DIR, 'fmt_out.webp');
      const jpgTarget = path.join(TEST_OUT_DIR, 'fmt_out.jpg');

      const resWebp = await enhanceImageFile(sourcePath, webpTarget, {
        scale: 1,
        format: 'webp',
        quality: 90
      });
      const resJpg = await enhanceImageFile(sourcePath, jpgTarget, {
        scale: 1,
        format: 'jpg',
        quality: 90
      });

      expect(fs.existsSync(webpTarget)).toBe(true);
      expect(resWebp.outputBytes).toBeGreaterThan(0);
      expect(fs.existsSync(jpgTarget)).toBe(true);
      expect(resJpg.outputBytes).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Batch Directory & Router Execution', () => {
    it('processes a directory of images and routes single/directory inputs accurately', async () => {
      const batchIn = path.join(TEST_OUT_DIR, 'batch_in');
      const batchOut = path.join(TEST_OUT_DIR, 'batch_out');
      fs.mkdirSync(batchIn, { recursive: true });

      const img1 = createSyntheticTestImage(28, 28, 3);
      const img2 = createSyntheticTestImage(36, 36, 3);
      await img1.save(path.join(batchIn, 'photo1.png'));
      await img2.save(path.join(batchIn, 'photo2.png'));

      const progressEvents: any[] = [];
      const batchRes = await enhanceImagesInDirectory(batchIn, batchOut, {
        scale: 1,
        deblur: true,
        onProgress: (p) => progressEvents.push(p)
      });

      expect(batchRes.total).toBe(2);
      expect(batchRes.succeeded).toBe(2);
      expect(batchRes.failed).toBe(0);
      expect(progressEvents.filter((p) => p.status === 'success').length).toBe(2);
      expect(fs.existsSync(path.join(batchOut, 'photo1.png'))).toBe(true);
      expect(fs.existsSync(path.join(batchOut, 'photo2.png'))).toBe(true);

      // Router test with single file -> target directory
      const routedDir = path.join(TEST_OUT_DIR, 'routed_single');
      const singleRouted: any = await enhanceImage(path.join(batchIn, 'photo1.png'), routedDir, {
        scale: 1,
        fast: true
      });
      expect(singleRouted.targetFile).toBe(path.join(routedDir, 'photo1.png'));
      expect(fs.existsSync(singleRouted.targetFile)).toBe(true);
    }, 120000);
  });

  describe('CLI Command Execution (toad enhance / toad upscale)', () => {
    it('executes "toad enhance <source> <target> --scale 1 --deblur" via CLI', async () => {
      const source = path.join(TEST_OUT_DIR, 'small_input.png');
      const target = path.join(TEST_OUT_DIR, 'cli_enhanced.png');

      const { stdout } = await execAsync(`node ./dist/cli.js enhance "${source}" "${target}" --scale 1 --deblur`);

      expect(stdout).toContain('TOAD Local AI Image Enhancer');
      expect(stdout).toContain('100% on-device restoration & super-resolution');
      expect(stdout).toContain('SUCCESS');
      expect(fs.existsSync(target)).toBe(true);
    }, 60000);

    it('exposes clean CLI flags in toad enhance --help', async () => {
      const { stdout } = await execAsync('node ./dist/cli.js enhance --help');
      expect(stdout).toContain('--scale');
      expect(stdout).toContain('--deblur');
      expect(stdout).toContain('--denoise');
      expect(stdout).toContain('--dyb');
      expect(stdout).toContain('--fast');
      expect(stdout).toContain('--format');
      expect(stdout).toContain('--recursive');
    });

    it('integrates AI Image Enhancer into Studio Web-GUI and Command Builder Hub with valid JS syntax', async () => {
      const { generateStudioHtml } = await import('../src/engine/uiHtml.js');
      const html = generateStudioHtml('', {} as any, '');

      expect(html).toContain('id="tab-enhancer"');
      expect(html).toContain('col-enhance');
      expect(html).toContain("openWizard('enhance')");
      expect(html).toContain('/api/image/enhance');
      expect(html).toContain('setupEnhSplitSlider');
      expect(html).toContain('setupEnhancerDragDrop');

      // Extract inline <script> and verify it parses without any JS syntax error
      const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
      expect(scriptMatch).not.toBeNull();
      expect(() => new Function(scriptMatch![1]!)).not.toThrow();
    });
  });
});
