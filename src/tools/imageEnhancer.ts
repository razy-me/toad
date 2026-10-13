/**
 * src/tools/imageEnhancer.ts
 *
 * 100% Local & Offline AI Image Enhancer, Super-Resolution & Restoration Engine for TOAD.
 * Powered by local ONNX Swin2SR neural super-resolution models via @huggingface/transformers
 * combined with Richardson-Lucy blind deconvolution, bilateral chroma/luma denoising,
 * and halo-free multi-scale frequency detail synthesis.
 * ZERO cloud uploads: all inference and restoration is executed strictly on-device.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createRequire } from 'node:module';
import { pipeline, RawImage } from '@huggingface/transformers';
import {
  ensureEnvironmentConfigured,
  detectBestDevice,
  boxFilter2D,
  applyGuidedFilter,
  findImagesInDir
} from './backgroundRemover.js';

const require = createRequire(import.meta.url);

export type EnhancePreset = 'fast' | 'balanced' | 'sharp' | 'denoise' | 'dyb';

export interface EnhanceOptions {
  /**
   * Upscaling factor: 1 (keep original resolution, sharpen & restore details),
   * 2 (2x HD Super-Resolution, default), or 4 (4x Ultra-HD Super-Resolution).
   */
  scale?: 1 | 2 | 4;

  /**
   * Enhancement preset:
   * - 'fast': Lightweight fast restoration & upscaling
   * - 'balanced': Balanced natural detail recovery, deblur & upscaling (default)
   * - 'sharp': Aggressive optical deblurring & edge sharpening for soft smartphone photos
   * - 'denoise': Strong sensor noise & JPEG block artifact removal
   * - 'dyb': "Do-Your-Best" maximum detail reconstruction + multi-pass deconvolution
   */
  preset?: EnhancePreset;

  /**
   * "Do-Your-Best" ultra-detail mode.
   */
  dyb?: boolean;

  /**
   * Fast mode (uses lightweight Swin2SR model and fast restoration pass).
   */
  fast?: boolean;

  /**
   * Alias for fast mode.
   */
  quick?: boolean;

  /**
   * Optical deblurring strength (true = 0.7, or custom 0.0 - 1.0).
   * Reconstructs out-of-focus and motion-softened smartphone captures.
   */
  deblur?: boolean | number;

  /**
   * Bilateral sensor noise & JPEG artifact suppression (true = 0.65, or custom 0.0 - 1.0).
   */
  denoise?: boolean | number;

  /**
   * Multi-scale micro-detail sharpening amount (0.0 - 2.0).
   */
  sharpen?: number;

  /**
   * Local mid-tone micro-contrast / clarity boost (0.0 - 1.0).
   */
  clarity?: number;

  /**
   * Output format: 'png' (default), 'webp', or 'jpg' / 'jpeg'.
   */
  format?: 'png' | 'webp' | 'jpg' | 'jpeg';

  /**
   * Output compression quality for WebP / JPEG (1-100, default: 95).
   */
  quality?: number;

  /**
   * Recursive directory traversal when source is a folder (default: false).
   */
  recursive?: boolean;

  /**
   * Number of concurrent workers in batch directory mode (default: 1, fast: 4).
   */
  concurrency?: number;

  /**
   * Tile size in pixels for neural super-resolution tiling (default: 128).
   */
  tileSize?: number;

  /**
   * Tile overlap in pixels for seamless cosine-feathered blending (default: 16).
   */
  tileOverlap?: number;

  /**
   * Optional manual AI model identifier or alias.
   */
  model?: string;

  /**
   * Device provider for ONNX runtime: 'cpu' (default), 'dml' (DirectML GPU), or 'webgpu'.
   */
  device?: 'cpu' | 'webgpu' | 'dml';

  /**
   * Optional AbortSignal to cancel running operations.
   */
  signal?: AbortSignal;

  /**
   * Optional progress callback for batch processing.
   */
  onProgress?: (progress: EnhanceProgressInfo) => void;

  /**
   * Optional callback for model download progress.
   */
  onDownloadProgress?: (info: any) => void;

  /**
   * Optional callback for single-image processing stages.
   */
  onFileProgress?: (info: { file: string; stage: string; progress?: number }) => void;
}

export interface EnhanceProgressInfo {
  index: number;
  total: number;
  sourceFile: string;
  targetFile?: string;
  originalWidth?: number;
  originalHeight?: number;
  width?: number;
  height?: number;
  scale?: number;
  durationMs?: number;
  originalBytes?: number;
  outputBytes?: number;
  status: 'start' | 'success' | 'error';
  error?: string;
}

export interface SingleEnhanceResult {
  sourceFile: string;
  targetFile: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
  scale: number;
  durationMs: number;
  originalBytes: number;
  outputBytes: number;
}

export interface BatchEnhanceResult {
  total: number;
  succeeded: number;
  failed: number;
  durationMs: number;
  results: SingleEnhanceResult[];
  errors: { sourceFile: string; error: string }[];
}

export const SUPPORTED_ENHANCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/**
 * 100% Commercial Open-Source ONNX Super-Resolution & Restoration Model Matrix.
 */
export const ENHANCE_MODEL_MAP: Record<string, string> = {
  default: 'Xenova/swin2SR-classical-sr-x2-64',
  balanced: 'Xenova/swin2SR-classical-sr-x2-64',
  standard: 'Xenova/swin2SR-classical-sr-x2-64',
  classical: 'Xenova/swin2SR-classical-sr-x2-64',
  fast: 'Xenova/swin2SR-lightweight-x2-64',
  quick: 'Xenova/swin2SR-lightweight-x2-64',
  lite: 'Xenova/swin2SR-lightweight-x2-64',
  sharp: 'Xenova/swin2SR-classical-sr-x2-64',
  deblur: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr',
  denoise: 'Xenova/swin2SR-compressed-sr-x4-48',
  compressed: 'Xenova/swin2SR-compressed-sr-x4-48',
  realworld: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr',
  dyb: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr',
  x2: 'Xenova/swin2SR-classical-sr-x2-64',
  x4: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr'
};

const enhancePipelineCache = new Map<string, any>();
const inFlightEnhancePromises = new Map<string, Promise<any>>();

/**
 * Clears the loaded neural super-resolution pipeline cache.
 */
export function clearEnhancePipelineCache(): void {
  enhancePipelineCache.clear();
}

/**
 * Resolves the ONNX super-resolution model identifier from user alias or options.
 */
export function resolveEnhanceModelName(modelArg?: string, options?: EnhanceOptions): string {
  if (modelArg) {
    const lower = modelArg.toLowerCase().trim();
    if (ENHANCE_MODEL_MAP[lower]) return ENHANCE_MODEL_MAP[lower];
    return modelArg;
  }
  if (options?.fast || options?.quick || options?.preset === 'fast') return ENHANCE_MODEL_MAP.fast;
  if (options?.preset === 'denoise' || options?.denoise) {
    return ENHANCE_MODEL_MAP.compressed;
  }
  if (options?.dyb || options?.preset === 'dyb') {
    return options?.scale === 2 ? ENHANCE_MODEL_MAP.classical : ENHANCE_MODEL_MAP.dyb;
  }
  if (options?.scale === 4) return ENHANCE_MODEL_MAP.x4;
  if (options?.preset && ENHANCE_MODEL_MAP[options.preset]) {
    return ENHANCE_MODEL_MAP[options.preset];
  }
  return ENHANCE_MODEL_MAP.default;
}

/**
 * Returns the native upscaling factor of a Swin2SR ONNX model (2 or 4).
 */
export function getModelNativeScale(modelName: string): 2 | 4 {
  if (modelName.includes('-x4-') || modelName.includes('_x4')) {
    return 4;
  }
  return 2;
}

/**
 * Checks whether an ONNX enhancement model is already cached locally on disk.
 */
export function isEnhanceModelCached(modelName: string): boolean {
  try {
    const cacheDir = ensureEnvironmentConfigured();
    const onnxDir = path.join(cacheDir, modelName, 'onnx');
    if (!fs.existsSync(onnxDir)) return false;
    const files = fs.readdirSync(onnxDir).filter((f) => f.endsWith('.onnx'));
    if (files.length === 0) return false;
    const stat = fs.statSync(path.join(onnxDir, files[0]!));
    return stat.size > 1 * 1024 * 1024;
  } catch {
    return false;
  }
}

/**
 * Loads or returns cached image-to-image super-resolution pipeline.
 */
export async function getEnhancePipeline(
  modelArg?: string,
  deviceArg?: 'cpu' | 'webgpu' | 'dml',
  onProgress?: (progress: any) => void
): Promise<any> {
  ensureEnvironmentConfigured();
  const modelName = resolveEnhanceModelName(modelArg);
  const device = deviceArg || detectBestDevice(modelName);
  const cacheKey = `${modelName}::${device}`;

  if (enhancePipelineCache.has(cacheKey)) {
    return enhancePipelineCache.get(cacheKey);
  }

  if (inFlightEnhancePromises.has(cacheKey)) {
    return await inFlightEnhancePromises.get(cacheKey)!;
  }

  const loadPromise = (async () => {
    const devicesToTry: ('dml' | 'webgpu' | 'cpu')[] = [device];
    if (device !== 'cpu') {
      devicesToTry.push('cpu');
    }

    let lastError: any = null;

    for (const dev of devicesToTry) {
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        try {
          const sessionOptions: any = {};
          if (dev === 'cpu') {
            sessionOptions.enableCpuMemArena = false;
            sessionOptions.intraOpNumThreads = Math.max(2, Math.min(4, os.cpus().length));
            sessionOptions.interOpNumThreads = 1;
          }
          const pipe = await pipeline('image-to-image', modelName, {
            device: dev,
            session_options: sessionOptions,
            progress_callback: onProgress
          });
          enhancePipelineCache.set(cacheKey, pipe);
          return pipe;
        } catch (err: any) {
          attempts++;
          lastError = err;
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 400 * attempts));
          }
        }
      }
    }

    throw lastError;
  })();

  inFlightEnhancePromises.set(cacheKey, loadPromise);
  try {
    return await loadPromise;
  } finally {
    inFlightEnhancePromises.delete(cacheKey);
  }
}

/**
 * Ensures the required enhancement model is downloaded and ready, reporting unified progress.
 */
export async function ensureEnhanceModelReady(
  modelName: string,
  onProgress?: (info: { status: 'progress' | 'done'; model: string; progress?: number; loaded?: number; total?: number }) => void
): Promise<boolean> {
  ensureEnvironmentConfigured();
  const approxSize = modelName.includes('lightweight') ? 8 * 1024 * 1024 : 50 * 1024 * 1024;

  if (isEnhanceModelCached(modelName)) {
    onProgress?.({ status: 'done', model: 'AI-Model', progress: 100, loaded: approxSize, total: approxSize });
    return true;
  }

  try {
    await getEnhancePipeline(modelName, 'cpu', (p: any) => {
      if (p.status === 'progress') {
        const pct = typeof p.progress === 'number' ? Math.min(99, Math.round(p.progress)) : 50;
        const loaded = Math.round((pct / 100) * approxSize);
        onProgress?.({
          status: 'progress',
          model: 'AI-Model',
          progress: pct,
          loaded,
          total: approxSize
        });
      }
    });
    onProgress?.({ status: 'done', model: 'AI-Model', progress: 100, loaded: approxSize, total: approxSize });
    return true;
  } catch {
    // Graceful fallback to local signal-processing super-resolution if offline without cache
    onProgress?.({ status: 'done', model: 'AI-Model', progress: 100, loaded: approxSize, total: approxSize });
    return false;
  }
}

/**
 * Stage 1: Edge-Preserving Bilateral Luma & Chroma Denoising + De-JPEG Filter.
 * Eliminates sensor grain and color blotches from smartphone low-light captures
 * while keeping edges razor-sharp.
 */
export function applyBilateralDenoise(
  image: RawImage,
  strength = 0.5,
  radius = 2
): RawImage {
  if (strength <= 0.01) return image;
  const { width, height, data, channels } = image;
  const numPixels = width * height;

  const Y = new Float32Array(numPixels);
  const Cb = new Float32Array(numPixels);
  const Cr = new Float32Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const idx = i * channels;
    const r = data[idx]!;
    const g = data[idx + 1]!;
    const b = data[idx + 2]!;
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    Cb[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    Cr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  }

  const r = Math.max(1, Math.min(4, Math.round(radius)));
  const sigmaColorY = 12 + strength * 28;
  const inv2SigmaY = 1 / (2 * sigmaColorY * sigmaColorY);
  const sigmaColorC = 22 + strength * 45;
  const inv2SigmaC = 1 / (2 * sigmaColorC * sigmaColorC);

  const outData = new Uint8ClampedArray(data.length);
  const blendY = Math.min(1, strength * 0.85);
  const blendC = Math.min(1, strength * 1.15);

  for (let y = 0; y < height; y++) {
    const yMin = Math.max(0, y - r);
    const yMax = Math.min(height - 1, y + r);
    const rowOffset = y * width;

    for (let x = 0; x < width; x++) {
      const pIdx = rowOffset + x;
      const centerY = Y[pIdx]!;
      const centerCb = Cb[pIdx]!;
      const centerCr = Cr[pIdx]!;

      let sumY = 0, wSumY = 0;
      let sumCb = 0, sumCr = 0, wSumC = 0;

      const xMin = Math.max(0, x - r);
      const xMax = Math.min(width - 1, x + r);

      for (let ny = yMin; ny <= yMax; ny++) {
        const dy = ny - y;
        const nRow = ny * width;
        for (let nx = xMin; nx <= xMax; nx++) {
          const dx = nx - x;
          const nIdx = nRow + nx;
          const spatialWeight = 1 / (1 + 0.5 * (dx * dx + dy * dy));

          const diffY = Y[nIdx]! - centerY;
          const wy = spatialWeight * Math.exp(-(diffY * diffY) * inv2SigmaY);
          sumY += Y[nIdx]! * wy;
          wSumY += wy;

          const diffCb = Cb[nIdx]! - centerCb;
          const diffCr = Cr[nIdx]! - centerCr;
          const wc = spatialWeight * Math.exp(-(diffCb * diffCb + diffCr * diffCr) * inv2SigmaC);
          sumCb += Cb[nIdx]! * wc;
          sumCr += Cr[nIdx]! * wc;
          wSumC += wc;
        }
      }

      const finalY = centerY * (1 - blendY) + (sumY / (wSumY || 1)) * blendY;
      const finalCb = centerCb * (1 - blendC) + (sumCb / (wSumC || 1)) * blendC;
      const finalCr = centerCr * (1 - blendC) + (sumCr / (wSumC || 1)) * blendC;

      const cIdx = pIdx * channels;
      outData[cIdx] = Math.min(255, Math.max(0, Math.round(finalY + 1.402 * (finalCr - 128))));
      outData[cIdx + 1] = Math.min(
        255,
        Math.max(0, Math.round(finalY - 0.344136 * (finalCb - 128) - 0.714136 * (finalCr - 128)))
      );
      outData[cIdx + 2] = Math.min(255, Math.max(0, Math.round(finalY + 1.772 * (finalCb - 128))));
      if (channels === 4) {
        outData[cIdx + 3] = data[cIdx + 3]!;
      }
    }
  }

  return new RawImage(outData, width, height, channels as any);
}

/**
 * Separable 2D Gaussian convolution on a Float32Array channel.
 */
export function gaussianBlur2D(
  src: Float32Array,
  width: number,
  height: number,
  sigma = 1.0
): Float32Array {
  const radius = Math.max(1, Math.min(5, Math.ceil(sigma * 2.5)));
  const kernel = new Float32Array(2 * radius + 1);
  let kSum = 0;
  const inv2SigmaSq = 1 / (2 * sigma * sigma);
  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp(-(i * i) * inv2SigmaSq);
    kernel[i + radius] = w;
    kSum += w;
  }
  for (let i = 0; i < kernel.length; i++) {
    kernel[i]! /= kSum;
  }

  const temp = new Float32Array(width * height);
  const dst = new Float32Array(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const nx = Math.min(width - 1, Math.max(0, x + k));
        sum += src[row + nx]! * kernel[k + radius]!;
      }
      temp[row + x] = sum;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const ny = Math.min(height - 1, Math.max(0, y + k));
        sum += temp[ny * width + x]! * kernel[k + radius]!;
      }
      dst[row + x] = sum;
    }
  }

  return dst;
}

/**
 * Stage 2: Deringed Richardson-Lucy Optical Deconvolution (Deblurring).
 * Reconstructs out-of-focus camera softness and slight hand-shake blur on the luminance channel
 * while preventing overshoot ringing halos near high-contrast edges.
 */
export function applyRichardsonLucyDeblur(
  image: RawImage,
  iterations = 3,
  psfSigma = 1.0,
  strength = 0.65
): RawImage {
  if (strength <= 0.01 || iterations <= 0) return image;
  const { width, height, data, channels } = image;
  const numPixels = width * height;

  const YObs = new Float32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    const idx = i * channels;
    YObs[i] = Math.max(1, 0.299 * data[idx]! + 0.587 * data[idx + 1]! + 0.114 * data[idx + 2]!);
  }

  const est = new Float32Array(YObs);
  const ratio = new Float32Array(numPixels);
  const eps = 1e-2;

  // Compute local min/max envelope in 3x3 neighborhood for halo/ringing protection
  const localMin = new Float32Array(numPixels);
  const localMax = new Float32Array(numPixels);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(width - 1, x + 1);
      let mn = 255;
      let mx = 0;
      for (let ny = y0; ny <= y1; ny++) {
        const rOff = ny * width;
        for (let nx = x0; nx <= x1; nx++) {
          const v = YObs[rOff + nx]!;
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
      }
      localMin[y * width + x] = mn;
      localMax[y * width + x] = mx;
    }
  }

  const iters = Math.max(1, Math.min(8, Math.round(iterations)));
  for (let it = 0; it < iters; it++) {
    const blurredEst = gaussianBlur2D(est, width, height, psfSigma);
    for (let i = 0; i < numPixels; i++) {
      ratio[i] = YObs[i]! / (blurredEst[i]! + eps);
    }
    const correction = gaussianBlur2D(ratio, width, height, psfSigma);
    for (let i = 0; i < numPixels; i++) {
      const updated = est[i]! * correction[i]!;
      // Allow controlled acutance expansion beyond local envelope without ringing
      const span = localMax[i]! - localMin[i]!;
      const margin = Math.min(18, span * 0.25 + 4);
      est[i] = Math.min(localMax[i]! + margin, Math.max(localMin[i]! - margin, updated));
    }
  }

  const outData = new Uint8ClampedArray(data.length);
  const s = Math.min(1.0, Math.max(0, strength));

  for (let i = 0; i < numPixels; i++) {
    const idx = i * channels;
    const origY = YObs[i]!;
    const deblurredY = origY * (1 - s) + est[i]! * s;
    const deltaY = deblurredY - origY;

    outData[idx] = Math.min(255, Math.max(0, Math.round(data[idx]! + deltaY)));
    outData[idx + 1] = Math.min(255, Math.max(0, Math.round(data[idx + 1]! + deltaY)));
    outData[idx + 2] = Math.min(255, Math.max(0, Math.round(data[idx + 2]! + deltaY)));
    if (channels === 4) {
      outData[idx + 3] = data[idx + 3]!;
    }
  }

  return new RawImage(outData, width, height, channels as any);
}

/**
 * Stage 3: Multi-Scale Frequency Detail Synthesis & Local Clarity Enhancement.
 * Extracts fine micro-textures (r=1) and medium structural clarity (r=4) using fast O(W*H)
 * separable box filtering, with noise-floor coring and soft-knee halo protection.
 */
export function applyMultiScaleSharpen(
  image: RawImage,
  sharpenOrOptions:
    | number
    | { sharpenAmount?: number; fineAmount?: number; mediumAmount?: number; clarityAmount?: number } = 0.8,
  clarityArg = 0.35
): RawImage {
  const sharpenAmount =
    typeof sharpenOrOptions === 'object' && sharpenOrOptions !== null
      ? (sharpenOrOptions.sharpenAmount ?? sharpenOrOptions.fineAmount ?? 0.8)
      : sharpenOrOptions;
  const clarityAmount =
    typeof sharpenOrOptions === 'object' && sharpenOrOptions !== null
      ? (sharpenOrOptions.clarityAmount ?? sharpenOrOptions.mediumAmount ?? 0.35)
      : clarityArg;
  if (sharpenAmount <= 0.01 && clarityAmount <= 0.01) return image;
  const { width, height, data, channels } = image;
  const numPixels = width * height;

  const Y = new Float32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    const idx = i * channels;
    Y[i] = 0.299 * data[idx]! + 0.587 * data[idx + 1]! + 0.114 * data[idx + 2]!;
  }

  const blurFine = boxFilter2D(Y, width, height, 1);
  const blurMed = boxFilter2D(blurFine, width, height, 3);

  const outData = new Uint8ClampedArray(data.length);

  for (let i = 0; i < numPixels; i++) {
    const yVal = Y[i]!;
    const normY = yVal / 255;

    // 1. Fine high-frequency detail band (hair, foliage, fabric, pores, text)
    let fineDiff = yVal - blurFine[i]!;
    // Noise-floor coring: suppress sub-1.2 greyscale level flat noise
    if (Math.abs(fineDiff) < 1.2) {
      fineDiff *= Math.abs(fineDiff) / 1.2;
    }
    // Soft-knee saturation: prevent harsh white/black halos on extreme step edges
    const fineBoost = 28 * Math.tanh((fineDiff * sharpenAmount) / 28);

    // 2. Medium frequency structure / clarity band (mid-tone weighted)
    const medDiff = blurFine[i]! - blurMed[i]!;
    const midtoneWeight = 0.35 + 0.65 * (4 * normY * (1 - normY));
    const clarityBoost = 24 * Math.tanh((medDiff * clarityAmount * midtoneWeight) / 24);

    const totalDelta = fineBoost + clarityBoost;
    const idx = i * channels;

    outData[idx] = Math.min(255, Math.max(0, Math.round(data[idx]! + totalDelta)));
    outData[idx + 1] = Math.min(255, Math.max(0, Math.round(data[idx + 1]! + totalDelta)));
    outData[idx + 2] = Math.min(255, Math.max(0, Math.round(data[idx + 2]! + totalDelta)));
    if (channels === 4) {
      outData[idx + 3] = data[idx + 3]!;
    }
  }

  return new RawImage(outData, width, height, channels as any);
}

/**
 * Catmull-Rom / Bicubic interpolation helper on RawImage for crisp base upsampling/downsampling.
 */
function cubicWeight(x: number): number {
  const ax = Math.abs(x);
  if (ax <= 1) {
    return 1.5 * ax * ax * ax - 2.5 * ax * ax + 1;
  }
  if (ax < 2) {
    return -0.5 * ax * ax * ax + 2.5 * ax * ax - 4 * ax + 2;
  }
  return 0;
}

export function resizeBicubic(image: RawImage, targetWidth: number, targetHeight: number): RawImage {
  const { width: srcW, height: srcH, data: srcData, channels } = image;
  if (srcW === targetWidth && srcH === targetHeight) {
    return new RawImage(new Uint8ClampedArray(srcData), srcW, srcH, channels as any);
  }

  const outData = new Uint8ClampedArray(targetWidth * targetHeight * channels);
  const scaleX = srcW / targetWidth;
  const scaleY = srcH / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    const srcY = (y + 0.5) * scaleY - 0.5;
    const yInt = Math.floor(srcY);
    const yFrac = srcY - yInt;

    const wy0 = cubicWeight(yFrac + 1);
    const wy1 = cubicWeight(yFrac);
    const wy2 = cubicWeight(1 - yFrac);
    const wy3 = cubicWeight(2 - yFrac);

    const sy0 = Math.max(0, Math.min(srcH - 1, yInt - 1));
    const sy1 = Math.max(0, Math.min(srcH - 1, yInt));
    const sy2 = Math.max(0, Math.min(srcH - 1, yInt + 1));
    const sy3 = Math.max(0, Math.min(srcH - 1, yInt + 2));

    for (let x = 0; x < targetWidth; x++) {
      const srcX = (x + 0.5) * scaleX - 0.5;
      const xInt = Math.floor(srcX);
      const xFrac = srcX - xInt;

      const wx0 = cubicWeight(xFrac + 1);
      const wx1 = cubicWeight(xFrac);
      const wx2 = cubicWeight(1 - xFrac);
      const wx3 = cubicWeight(2 - xFrac);

      const sx0 = Math.max(0, Math.min(srcW - 1, xInt - 1));
      const sx1 = Math.max(0, Math.min(srcW - 1, xInt));
      const sx2 = Math.max(0, Math.min(srcW - 1, xInt + 1));
      const sx3 = Math.max(0, Math.min(srcW - 1, xInt + 2));

      const outIdx = (y * targetWidth + x) * channels;
      for (let c = 0; c < channels; c++) {
        const r0 =
          srcData[(sy0 * srcW + sx0) * channels + c]! * wx0 +
          srcData[(sy0 * srcW + sx1) * channels + c]! * wx1 +
          srcData[(sy0 * srcW + sx2) * channels + c]! * wx2 +
          srcData[(sy0 * srcW + sx3) * channels + c]! * wx3;
        const r1 =
          srcData[(sy1 * srcW + sx0) * channels + c]! * wx0 +
          srcData[(sy1 * srcW + sx1) * channels + c]! * wx1 +
          srcData[(sy1 * srcW + sx2) * channels + c]! * wx2 +
          srcData[(sy1 * srcW + sx3) * channels + c]! * wx3;
        const r2 =
          srcData[(sy2 * srcW + sx0) * channels + c]! * wx0 +
          srcData[(sy2 * srcW + sx1) * channels + c]! * wx1 +
          srcData[(sy2 * srcW + sx2) * channels + c]! * wx2 +
          srcData[(sy2 * srcW + sx3) * channels + c]! * wx3;
        const r3 =
          srcData[(sy3 * srcW + sx0) * channels + c]! * wx0 +
          srcData[(sy3 * srcW + sx1) * channels + c]! * wx1 +
          srcData[(sy3 * srcW + sx2) * channels + c]! * wx2 +
          srcData[(sy3 * srcW + sx3) * channels + c]! * wx3;

        const val = r0 * wy0 + r1 * wy1 + r2 * wy2 + r3 * wy3;
        outData[outIdx + c] = Math.min(255, Math.max(0, Math.round(val)));
      }
    }
  }

  return new RawImage(outData, targetWidth, targetHeight, channels as any);
}

/**
 * Edge-Directed Iterative Back-Projection (IBP) Super-Resolution.
 * Guarantees mathematically consistent high-resolution reconstruction by iteratively
 * back-projecting the low-resolution sensor error onto the high-resolution grid.
 */
export function upscaleEdgeDirectedIBP(
  image: RawImage,
  scale: 2 | 4,
  iterations = 3
): RawImage {
  const targetW = image.width * scale;
  const targetH = image.height * scale;
  let hr = resizeBicubic(image, targetW, targetH);
  const channels = image.channels;

  for (let it = 0; it < iterations; it++) {
    // Simulate camera sensor downsampling of current HR estimate
    const simulatedLr = resizeBicubic(hr, image.width, image.height);
    // Compute residual error in LR space
    const errLrData = new Float32Array(image.width * image.height * channels);
    for (let i = 0; i < errLrData.length; i++) {
      errLrData[i] = image.data[i]! - simulatedLr.data[i]!;
    }

    // Upsample residual error to HR space using bilinear interpolation
    const hrData = hr.data;
    const lrW = image.width;
    const lrH = image.height;
    const gain = 0.65;

    for (let y = 0; y < targetH; y++) {
      const ly = Math.min(lrH - 1, Math.max(0, (y + 0.5) / scale - 0.5));
      const y0 = Math.floor(ly);
      const y1 = Math.min(lrH - 1, y0 + 1);
      const fy = ly - y0;

      for (let x = 0; x < targetW; x++) {
        const lx = Math.min(lrW - 1, Math.max(0, (x + 0.5) / scale - 0.5));
        const x0 = Math.floor(lx);
        const x1 = Math.min(lrW - 1, x0 + 1);
        const fx = lx - x0;

        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        const outIdx = (y * targetW + x) * channels;
        for (let c = 0; c < Math.min(3, channels); c++) {
          const errVal =
            errLrData[(y0 * lrW + x0) * channels + c]! * w00 +
            errLrData[(y0 * lrW + x1) * channels + c]! * w10 +
            errLrData[(y1 * lrW + x0) * channels + c]! * w01 +
            errLrData[(y1 * lrW + x1) * channels + c]! * w11;
          hrData[outIdx + c] = Math.min(255, Math.max(0, Math.round(hrData[outIdx + c]! + errVal * gain)));
        }
      }
    }
  }

  return hr;
}

/**
 * Runs ONNX Swin2SR Super-Resolution using overlapping tiles and smooth 2D raised-cosine
 * feather blending to eliminate tile boundary seams and cap RAM usage strictly < 1 GB.
 */
export async function runTiledNeuralSuperResolution(
  image: RawImage,
  pipe: any,
  modelScale: 2 | 4,
  tileSize = 128,
  overlap = 16,
  signal?: AbortSignal
): Promise<RawImage> {
  const rgbImage = image.channels === 3 ? image : image.rgb();
  const { width, height, data } = rgbImage;

  const outW = width * modelScale;
  const outH = height * modelScale;
  const accumR = new Float32Array(outW * outH);
  const accumG = new Float32Array(outW * outH);
  const accumB = new Float32Array(outW * outH);
  const accumW = new Float32Array(outW * outH);

  const effTile = Math.max(32, tileSize);
  const effOverlap = Math.max(4, Math.min(Math.floor(effTile / 3), overlap));
  const stride = effTile - effOverlap;

  const xSteps: number[] = [];
  for (let x = 0; x < width; x += stride) {
    xSteps.push(Math.min(x, Math.max(0, width - effTile)));
    if (x + effTile >= width) break;
  }
  const ySteps: number[] = [];
  for (let y = 0; y < height; y += stride) {
    ySteps.push(Math.min(y, Math.max(0, height - effTile)));
    if (y + effTile >= height) break;
  }

  for (const ty of ySteps) {
    for (const tx of xSteps) {
      if (signal?.aborted) {
        throw new Error('Operation aborted by user signal');
      }

      const tw = Math.min(effTile, width - tx);
      const th = Math.min(effTile, height - ty);

      // Extract RGB tile
      const tileData = new Uint8ClampedArray(tw * th * 3);
      for (let row = 0; row < th; row++) {
        const srcRowStart = ((ty + row) * width + tx) * 3;
        const dstRowStart = row * tw * 3;
        tileData.set(data.subarray(srcRowStart, srcRowStart + tw * 3), dstRowStart);
      }

      const tileRaw = new RawImage(tileData, tw, th, 3);
      const srTile: RawImage = await pipe(tileRaw);

      // Swin2SRImageProcessor pads right and bottom to multiple of 8; valid output is top-left (tw*modelScale, th*modelScale)
      const validW = Math.min(srTile.width, tw * modelScale);
      const validH = Math.min(srTile.height, th * modelScale);
      const srData = srTile.data;
      const srChannels = srTile.channels;
      const borderOut = effOverlap * modelScale;

      const hasLeftOverlap = tx > 0;
      const hasRightOverlap = tx + tw < width;
      const hasTopOverlap = ty > 0;
      const hasBottomOverlap = ty + th < height;

      for (let oy = 0; oy < validH; oy++) {
        let wy = 1.0;
        if (hasTopOverlap && oy < borderOut) {
          wy = 0.5 * (1 - Math.cos((Math.PI * (oy + 0.5)) / borderOut));
        } else if (hasBottomOverlap && oy >= validH - borderOut) {
          const rem = validH - oy;
          wy = 0.5 * (1 - Math.cos((Math.PI * (rem - 0.5)) / borderOut));
        }

        const dstY = ty * modelScale + oy;
        const dstRow = dstY * outW;
        const srcRow = oy * srTile.width;

        for (let ox = 0; ox < validW; ox++) {
          let wx = 1.0;
          if (hasLeftOverlap && ox < borderOut) {
            wx = 0.5 * (1 - Math.cos((Math.PI * (ox + 0.5)) / borderOut));
          } else if (hasRightOverlap && ox >= validW - borderOut) {
            const rem = validW - ox;
            wx = 0.5 * (1 - Math.cos((Math.PI * (rem - 0.5)) / borderOut));
          }

          const w = Math.max(1e-4, wx * wy);
          const dstIdx = dstRow + (tx * modelScale + ox);
          const srcIdx = (srcRow + ox) * srChannels;

          accumR[dstIdx] += srData[srcIdx]! * w;
          accumG[dstIdx] += srData[srcIdx + 1]! * w;
          accumB[dstIdx] += srData[srcIdx + 2]! * w;
          accumW[dstIdx] += w;
        }
      }
    }
  }

  const outData = new Uint8ClampedArray(outW * outH * 3);
  for (let i = 0; i < outW * outH; i++) {
    const invW = 1 / (accumW[i] || 1);
    const idx = i * 3;
    outData[idx] = Math.min(255, Math.max(0, Math.round(accumR[i]! * invW)));
    outData[idx + 1] = Math.min(255, Math.max(0, Math.round(accumG[i]! * invW)));
    outData[idx + 2] = Math.min(255, Math.max(0, Math.round(accumB[i]! * invW)));
  }

  return new RawImage(outData, outW, outH, 3);
}

/**
 * Enhances a single image file in-memory and returns the enhanced RawImage.
 */
export async function enhanceRawImage(
  rawImage: RawImage,
  options: EnhanceOptions = {}
): Promise<RawImage> {
  const isDyb = Boolean(options.dyb || options.preset === 'dyb');
  const isFast = Boolean(options.fast || options.quick || options.preset === 'fast');
  const preset: EnhancePreset = isDyb
    ? 'dyb'
    : isFast
      ? 'fast'
      : options.preset || 'balanced';

  const targetScale: 1 | 2 | 4 = options.scale === 1 || options.scale === 4 ? options.scale : 2;

  // Extract alpha channel if input is 4-channel RGBA
  let alphaMask: RawImage | null = null;
  if (rawImage.channels === 4) {
    const alphaData = new Uint8ClampedArray(rawImage.width * rawImage.height);
    for (let i = 0; i < alphaData.length; i++) {
      alphaData[i] = rawImage.data[i * 4 + 3]!;
    }
    alphaMask = new RawImage(alphaData, rawImage.width, rawImage.height, 1);
  }

  let working = rawImage.channels === 1 ? rawImage.rgb() : rawImage.channels === 4 ? rawImage.rgb() : rawImage;

  // --- STAGE 1: Sensor Noise & JPEG Block Artifact Suppression ---
  let denoiseStrength = 0.25;
  if (typeof options.denoise === 'number') {
    denoiseStrength = Math.max(0, Math.min(1, options.denoise));
  } else if (options.denoise === true || preset === 'denoise') {
    denoiseStrength = 0.75;
  } else if (preset === 'dyb') {
    denoiseStrength = 0.4;
  } else if (preset === 'fast') {
    denoiseStrength = 0.15;
  }

  if (denoiseStrength > 0.05 && (!isFast || options.denoise)) {
    working = applyBilateralDenoise(working, denoiseStrength, preset === 'denoise' ? 3 : 2);
  }

  if (options.signal?.aborted) {
    throw new Error('Operation aborted by user signal');
  }

  // --- STAGE 2: Pre-Upscale Optical Deblurring (for 1x or severe blur) ---
  let deblurStrength = 0.45;
  if (typeof options.deblur === 'number') {
    deblurStrength = Math.max(0, Math.min(1, options.deblur));
  } else if (options.deblur === true || preset === 'sharp') {
    deblurStrength = 0.8;
  } else if (preset === 'dyb') {
    deblurStrength = 0.7;
  } else if (preset === 'denoise') {
    deblurStrength = 0.3;
  } else if (preset === 'fast') {
    deblurStrength = 0.25;
  }

  if (deblurStrength > 0.05 && !isFast) {
    const rlIters = preset === 'dyb' || preset === 'sharp' ? 4 : 2;
    working = applyRichardsonLucyDeblur(working, rlIters, 0.95, deblurStrength);
  }

  if (options.signal?.aborted) {
    throw new Error('Operation aborted by user signal');
  }

  // --- STAGE 3: Super-Resolution Upscaling (2x / 4x) ---
  const targetWidth = working.width * targetScale;
  const targetHeight = working.height * targetScale;

  if (targetScale > 1) {
    const modelName = resolveEnhanceModelName(options.model, options);
    const numPixels = working.width * working.height;
    // Use neural Swin2SR tiling for standard/compact images; use IBP super-resolution for huge multi-MP canvases
    const maxNeuralPixels = isDyb ? 512 * 512 : isFast ? 192 * 192 : 320 * 320;
    let neuralSucceeded = false;

    if (numPixels <= maxNeuralPixels) {
      try {
        const effectiveDevice = options.device || detectBestDevice(modelName);
        const pipe = await getEnhancePipeline(modelName, effectiveDevice);
        const modelScale = getModelNativeScale(modelName);
        const srResult = await runTiledNeuralSuperResolution(
          working,
          pipe,
          modelScale,
          options.tileSize || 128,
          options.tileOverlap || 16,
          options.signal
        );
        if (srResult.width !== targetWidth || srResult.height !== targetHeight) {
          working = resizeBicubic(srResult, targetWidth, targetHeight);
        } else {
          working = srResult;
        }
        neuralSucceeded = true;
      } catch (err: any) {
        if (options.signal?.aborted) throw err;
        neuralSucceeded = false;
      }
    }

    if (!neuralSucceeded) {
      working = upscaleEdgeDirectedIBP(working, targetScale === 4 ? 4 : 2, isDyb ? 4 : isFast ? 2 : 3);
    }
  } else if (isDyb && working.width * working.height <= 256 * 256) {
    // In 1x DYB mode on compact images, perform 2x neural supersampling and downsample back to 1x
    try {
      const modelName = resolveEnhanceModelName(options.model, options);
      const pipe = await getEnhancePipeline(modelName, options.device || 'cpu');
      const modelScale = getModelNativeScale(modelName);
      const srResult = await runTiledNeuralSuperResolution(
        working,
        pipe,
        modelScale,
        options.tileSize || 128,
        options.tileOverlap || 16,
        options.signal
      );
      working = resizeBicubic(srResult, targetWidth, targetHeight);
    } catch (err: any) {
      if (options.signal?.aborted) throw err;
    }
  }

  if (options.signal?.aborted) {
    throw new Error('Operation aborted by user signal');
  }

  // --- STAGE 4: Multi-Scale Frequency Detail Synthesis & Clarity ---
  const defaultSharpen =
    preset === 'sharp' ? 1.15 : preset === 'dyb' ? 1.0 : preset === 'denoise' ? 0.55 : preset === 'fast' ? 0.65 : 0.85;
  const defaultClarity =
    preset === 'sharp' ? 0.45 : preset === 'dyb' ? 0.5 : preset === 'denoise' ? 0.25 : preset === 'fast' ? 0.25 : 0.35;

  const sharpenAmt = options.sharpen !== undefined ? options.sharpen : defaultSharpen;
  const clarityAmt = options.clarity !== undefined ? options.clarity : defaultClarity;

  working = applyMultiScaleSharpen(working, sharpenAmt, clarityAmt);

  // --- STAGE 5: Re-attach & Guided-Refine Alpha Channel if Present ---
  if (alphaMask) {
    let scaledAlpha = alphaMask;
    if (scaledAlpha.width !== working.width || scaledAlpha.height !== working.height) {
      scaledAlpha = resizeBicubic(scaledAlpha, working.width, working.height);
    }
    const refinedAlpha = applyGuidedFilter(working, scaledAlpha, 3, 1e-3);
    working = working.rgba().putAlpha(refinedAlpha);
  }

  return working;
}

/**
 * Enhances a single image file and saves the result to targetPath.
 */
export async function enhanceImageFile(
  sourcePath: string,
  targetPath: string,
  options: EnhanceOptions = {}
): Promise<SingleEnhanceResult> {
  if (options.signal?.aborted) {
    throw new Error('Image enhancement aborted by signal.');
  }

  const resolvedSource = path.resolve(sourcePath);
  const resolvedTarget = path.resolve(targetPath);

  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`Source image not found: ${resolvedSource}`);
  }

  const stat = fs.statSync(resolvedSource);
  if (stat.isDirectory()) {
    throw new Error(`Source path is a directory, not a file: ${resolvedSource}. Use enhanceImagesInDirectory instead.`);
  }

  const ext = path.extname(resolvedSource).toLowerCase();
  if (ext === '.gif') {
    throw new Error(`Animated GIF formats are not supported for AI image enhancement. Please extract individual frames.`);
  }
  if (ext === '.svg') {
    throw new Error(`Vector SVG format cannot be processed by neural raster enhancement (SVG is already infinitely scalable).`);
  }
  if (ext === '.tif' || ext === '.tiff') {
    throw new Error(`Multi-page TIFF format is not supported. Please convert to PNG or JPEG first.`);
  }

  if (stat.size > 150 * 1024 * 1024) {
    throw new Error(`Input image file exceeds safe size limit of 150 MB (${(stat.size / 1024 / 1024).toFixed(1)} MB).`);
  }

  let isSameFile = false;
  try {
    const realSource = fs.existsSync(resolvedSource) ? fs.realpathSync(resolvedSource) : resolvedSource;
    const realTarget = fs.existsSync(resolvedTarget) ? fs.realpathSync(resolvedTarget) : resolvedTarget;
    isSameFile =
      process.platform === 'win32'
        ? realSource.toLowerCase() === realTarget.toLowerCase()
        : realSource === realTarget;
  } catch {
    isSameFile =
      process.platform === 'win32'
        ? resolvedSource.toLowerCase() === resolvedTarget.toLowerCase()
        : resolvedSource === resolvedTarget;
  }

  let backupBuffer: Buffer | null = null;
  if (isSameFile) {
    backupBuffer = fs.readFileSync(resolvedSource);
  }

  const startTime = Date.now();
  const modelName = resolveEnhanceModelName(options.model, options);
  await ensureEnhanceModelReady(modelName, options.onDownloadProgress);

  try {
    let rawImage = await RawImage.read(resolvedSource);
    const origWidth = rawImage.width;
    const origHeight = rawImage.height;

    const enhanced = await enhanceRawImage(rawImage, options);

    const targetDir = path.dirname(resolvedTarget);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (options.signal?.aborted) {
      throw new Error('Operation aborted by user signal');
    }

    const outExt = path.extname(resolvedTarget).toLowerCase() || '.png';
    const tempPath = path.join(
      targetDir,
      `.toad-enh-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}${outExt}`
    );

    try {
      const quality = options.quality !== undefined ? options.quality : 95;
      const isLossy = outExt === '.webp' || outExt === '.jpg' || outExt === '.jpeg';
      let imageToSave = enhanced;
      if ((outExt === '.jpg' || outExt === '.jpeg') && imageToSave.channels === 4) {
        imageToSave = imageToSave.rgb();
      }
      await (imageToSave as any).save(tempPath, isLossy ? { quality } : undefined);
      fs.renameSync(tempPath, resolvedTarget);
    } catch (saveErr) {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {}
      }
      throw saveErr;
    }

    const durationMs = Date.now() - startTime;
    const outputStat = fs.statSync(resolvedTarget);
    const outW = enhanced.width;
    const outH = enhanced.height;
    const effectiveScale = Math.round((outW / origWidth) * 10) / 10;

    rawImage = null as any;

    return {
      sourceFile: resolvedSource,
      targetFile: resolvedTarget,
      originalWidth: origWidth,
      originalHeight: origHeight,
      width: outW,
      height: outH,
      inputWidth: origWidth,
      inputHeight: origHeight,
      outputWidth: outW,
      outputHeight: outH,
      scale: effectiveScale,
      durationMs,
      originalBytes: stat.size,
      outputBytes: outputStat.size
    };
  } catch (err) {
    if (isSameFile && backupBuffer) {
      try {
        fs.writeFileSync(resolvedSource, backupBuffer);
      } catch {}
    }
    throw err;
  }
}

/**
 * Enhances all supported images in a directory and saves them to targetDir.
 */
export async function enhanceImagesInDirectory(
  sourceDir: string,
  targetDir: string,
  options: EnhanceOptions = {}
): Promise<BatchEnhanceResult> {
  const resolvedSourceDir = path.resolve(sourceDir);
  const resolvedTargetDir = path.resolve(targetDir);

  if (!fs.existsSync(resolvedSourceDir)) {
    throw new Error(`Source directory does not exist: ${resolvedSourceDir}`);
  }

  if (!fs.existsSync(resolvedTargetDir)) {
    fs.mkdirSync(resolvedTargetDir, { recursive: true });
  }

  const imageFiles = findImagesInDir(resolvedSourceDir, options.recursive ?? false);
  const total = imageFiles.length;
  const results: SingleEnhanceResult[] = [];
  const errors: { sourceFile: string; error: string }[] = [];

  const batchStartTime = Date.now();
  const modelName = resolveEnhanceModelName(options.model, options);
  await ensureEnhanceModelReady(modelName, options.onDownloadProgress);

  const defaultConcurrency = options.fast || options.quick || options.preset === 'fast' ? 4 : 1;
  const concurrency = Math.max(1, Math.min(8, options.concurrency ?? defaultConcurrency));
  let currentIndex = 0;
  let completedCount = 0;

  const normFmt = (options.format || 'png').toLowerCase();
  const outExt = normFmt === 'webp' ? '.webp' : normFmt === 'jpg' || normFmt === 'jpeg' ? '.jpg' : '.png';

  async function worker() {
    while (currentIndex < total) {
      if (options.signal?.aborted) break;
      const fileIdx = currentIndex++;
      const file = imageFiles[fileIdx]!;
      const rel = path.relative(resolvedSourceDir, file);
      const parsed = path.parse(rel);
      const outSubDir = path.join(resolvedTargetDir, parsed.dir);
      if (!fs.existsSync(outSubDir)) {
        fs.mkdirSync(outSubDir, { recursive: true });
      }

      const targetFile = path.join(outSubDir, `${parsed.name}${outExt}`);

      options.onProgress?.({
        index: fileIdx + 1,
        total,
        sourceFile: file,
        targetFile,
        status: 'start'
      });

      try {
        const res = await enhanceImageFile(file, targetFile, options);
        if (options.signal?.aborted) break;
        results.push(res);
        completedCount++;

        await new Promise((resolve) => setImmediate(resolve));
        if (typeof global !== 'undefined' && typeof (global as any).gc === 'function') {
          try {
            (global as any).gc();
          } catch {}
        }

        options.onProgress?.({
          index: completedCount,
          total,
          sourceFile: file,
          targetFile,
          originalWidth: res.originalWidth,
          originalHeight: res.originalHeight,
          width: res.width,
          height: res.height,
          scale: res.scale,
          durationMs: res.durationMs,
          originalBytes: res.originalBytes,
          outputBytes: res.outputBytes,
          status: 'success'
        });
      } catch (err: any) {
        if (options.signal?.aborted) break;
        const errMsg = err?.message || String(err);
        errors.push({ sourceFile: file, error: errMsg });
        options.onProgress?.({
          index: completedCount + 1,
          total,
          sourceFile: file,
          targetFile,
          status: 'error',
          error: errMsg
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total || 1) }, () => worker());
  await Promise.all(workers);

  return {
    total,
    succeeded: results.length,
    failed: errors.length,
    durationMs: Date.now() - batchStartTime,
    results,
    errors
  };
}

/**
 * Universal router: automatically detects whether source is a file or a directory
 * and enhances accordingly.
 */
export async function enhanceImage(
  source: string,
  target?: string,
  options: EnhanceOptions = {}
): Promise<SingleEnhanceResult | BatchEnhanceResult> {
  const resolvedSource = path.resolve(source);
  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`Source not found: ${resolvedSource}`);
  }

  const normFmt = (options.format || 'png').toLowerCase();
  const outExt = normFmt === 'webp' ? '.webp' : normFmt === 'jpg' || normFmt === 'jpeg' ? '.jpg' : '.png';

  const stat = fs.statSync(resolvedSource);
  if (stat.isDirectory()) {
    const effectiveTargetDir = target ? path.resolve(target) : path.join(resolvedSource, 'verbessert');
    return enhanceImagesInDirectory(resolvedSource, effectiveTargetDir, options);
  } else {
    const parsedSource = path.parse(resolvedSource);
    let resolvedTarget: string;

    if (!target) {
      resolvedTarget = path.join(parsedSource.dir, `${parsedSource.name}-enhanced${outExt}`);
    } else {
      resolvedTarget = path.resolve(target);
      const targetIsExplicitDir = target.endsWith('/') || target.endsWith('\\');
      const targetExistsAsDir = fs.existsSync(resolvedTarget) && fs.statSync(resolvedTarget).isDirectory();

      if (targetIsExplicitDir || targetExistsAsDir || (!path.extname(target) && !fs.existsSync(resolvedTarget))) {
        resolvedTarget = path.join(resolvedTarget, `${parsedSource.name}${outExt}`);
      } else if (options.format && path.extname(resolvedTarget).toLowerCase() !== outExt) {
        resolvedTarget = resolvedTarget.slice(0, -path.extname(resolvedTarget).length) + outExt;
      }
    }

    return enhanceImageFile(resolvedSource, resolvedTarget, options);
  }
}
