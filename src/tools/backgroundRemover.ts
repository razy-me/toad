/**
 * src/tools/backgroundRemover.ts
 *
 * 100% Local & Offline AI Background Remover for TOAD.
 * Powered by local ONNX neural segmentation models via @huggingface/transformers.
 * ZERO cloud uploads: all inference is executed strictly on-device.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createRequire } from 'node:module';
import { pipeline, env, RawImage } from '@huggingface/transformers';

const require = createRequire(import.meta.url);

export interface BgRemovalOptions {
  /**
   * AI model identifier or alias.
   * - 'ormbg' (default): Ultra-fast, sharp edge boundaries (~1-2s).
   * - 'birefnet': BiRefNet Lite for maximum detail on hair, glass, fine fur.
   */
  model?: 'ormbg' | 'birefnet' | string;

  /**
   * Automatically crop excess transparent boundaries around the isolated subject.
   */
  trim?: boolean;

  /**
   * Padding in pixels around the subject when trim is enabled (default: 0).
   */
  padding?: number;

  /**
   * Hard alpha threshold cutoff between 0.0 and 1.0 (default: undefined, uses smooth alpha).
   */
  threshold?: number;

  /**
   * Output format: 'png' (default) or 'webp'.
   */
  format?: 'png' | 'webp';

  /**
   * WebP compression quality (1-100, default: 95).
   */
  quality?: number;

  /**
   * Recursive scan when source is a directory (default: false).
   */
  recursive?: boolean;

  /**
   * Remove background fringe / halo (color decontamination) around fine hair and edges.
   */
  defringe?: boolean;

  /**
   * Search radius in pixels for color decontamination (default: 3).
   */
  defringeRadius?: number;

  /**
   * Special motion-blur & sports equipment mode (e.g. swinging golf clubs, hockey sticks).
   * Preserves continuous semi-transparent motion trails instead of harshly clipping them.
   */
  motion?: boolean;

  /**
   * Device provider for ONNX runtime: 'cpu' (default), 'dml' (DirectML GPU/NPU), or 'webgpu'.
   */
  device?: 'cpu' | 'webgpu' | 'dml';

  /**
   * Optional progress callback for batch processing.
   */
  onProgress?: (progress: BgProgressInfo) => void;
}

export interface BgProgressInfo {
  index: number;
  total: number;
  sourceFile: string;
  targetFile: string;
  width: number;
  height: number;
  durationMs: number;
  originalBytes: number;
  outputBytes: number;
  status: 'success' | 'error';
  error?: string;
}

export interface SingleFileResult {
  sourceFile: string;
  targetFile: string;
  width: number;
  height: number;
  durationMs: number;
  originalBytes: number;
  outputBytes: number;
}

export interface BatchRemovalResult {
  total: number;
  succeeded: number;
  failed: number;
  durationMs: number;
  results: SingleFileResult[];
  errors: { sourceFile: string; error: string }[];
}

export const SUPPORTED_BG_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export const MODEL_MAP: Record<string, string> = {
  ormbg: 'onnx-community/ormbg-ONNX',
  birefnet: 'onnx-community/BiRefNet-ONNX',
  dyb: 'onnx-community/BiRefNet-ONNX',
  'birefnet-hr': 'onnx-community/BiRefNet-ONNX',
  'birefnet-full': 'onnx-community/BiRefNet-ONNX',
  'birefnet-lite': 'onnx-community/BiRefNet_lite-ONNX'
};

// Singleton pipeline cache to avoid reloading model weights repeatedly
let cachedPipeline: any = null;
let currentModelName: string | null = null;

/**
 * Configure environment to ensure models are stored in a dedicated, permanent TOAD directory
 * and can run 100% offline once downloaded.
 */
export function ensureEnvironmentConfigured(): string {
  const cacheDir = process.env.TOAD_MODELS_CACHE || path.join(os.homedir(), '.toad', 'models');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  env.cacheDir = cacheDir;
  env.allowLocalModels = true;
  return cacheDir;
}

/**
 * Resolves the model name from user alias or full identifier.
 * Defaults to 'ormbg' which delivers state-of-the-art segmentation with full GPU / NPU (DirectML) acceleration.
 * When deep portrait mode (--dyb) is requested, resolves to BiRefNet (high quality, CPU only).
 */
export function resolveModelName(modelArg?: string): string {
  if (!modelArg) return MODEL_MAP.ormbg;
  const lower = modelArg.toLowerCase().trim();
  if (MODEL_MAP[lower]) return MODEL_MAP[lower];
  return modelArg;
}

let detectedGpuAvailable: boolean | null = null;

/**
 * Checks whether GPU / NPU hardware acceleration (DirectML on Windows) is available.
 */
export function isGpuAvailable(): boolean {
  if (detectedGpuAvailable !== null) return detectedGpuAvailable;
  try {
    const ort = require('onnxruntime-node');
    if (typeof ort.listSupportedBackends === 'function') {
      const backends = ort.listSupportedBackends();
      const names = new Set(backends.map((b: any) => b.name));
      if (names.has('dml') && process.platform === 'win32') {
        detectedGpuAvailable = true;
        return true;
      }
    }
  } catch {}
  detectedGpuAvailable = false;
  return false;
}

/**
 * Automatically chooses the best execution provider for the selected model.
 */
export function detectBestDevice(modelArg?: string): 'dml' | 'cpu' {
  if (!isGpuAvailable()) return 'cpu';
  const resolved = resolveModelName(modelArg);
  // BiRefNet uses atrous deformable convolutions which exceed DML memory on iGPUs, so use CPU
  if (resolved.includes('BiRefNet')) {
    return 'cpu';
  }
  return 'dml';
}

/**
 * Loads or returns cached image segmentation pipeline.
 */
export async function getSegmentationPipeline(
  modelArg?: string,
  deviceArg?: 'cpu' | 'webgpu' | 'dml'
): Promise<any> {
  ensureEnvironmentConfigured();
  const modelName = resolveModelName(modelArg);
  const device = deviceArg || detectBestDevice(modelName);

  if (cachedPipeline && currentModelName === modelName) {
    return cachedPipeline;
  }

  cachedPipeline = await pipeline('image-segmentation', modelName, {
    device
  });
  currentModelName = modelName;
  return cachedPipeline;
}

/**
 * Smart trim: finds the bounding box of non-transparent pixels and crops with optional padding.
 */
export async function trimImageAlpha(image: any, padding = 0, thresholdAlpha = 5): Promise<any> {
  const { width, height, data, channels } = image;
  if (channels < 4) return image;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const alpha = data[idx + 3];
      if (alpha > thresholdAlpha) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Entire image was transparent or nothing detected
  if (maxX < minX || maxY < minY) {
    return image;
  }

  const pad = Math.max(0, Math.floor(padding));
  const cropXMin = Math.max(0, minX - pad);
  const cropYMin = Math.max(0, minY - pad);
  const cropXMax = Math.min(width - 1, maxX + pad);
  const cropYMax = Math.min(height - 1, maxY + pad);

  if (cropXMin === 0 && cropYMin === 0 && cropXMax === width - 1 && cropYMax === height - 1) {
    return image;
  }

  return await image.crop([cropXMin, cropYMin, cropXMax, cropYMax]);
}

/**
 * Smart color decontamination (De-fringing) & backdrop haze removal.
 * Eliminates grey/white halos around hair by:
 * 1. Clearing low-alpha background haze (alpha < 30).
 * 2. Replacing background-contaminated RGB in semi-transparent edge pixels with genuine subject color.
 */
export function defringeImage(image: any, radius = 3): any {
  const { width, height, data, channels } = image;
  if (channels < 4) return image;

  const cleanData = new Uint8ClampedArray(data);

  // Step 1: Backdrop haze removal & edge sharpening
  for (let i = 3; i < cleanData.length; i += channels) {
    const a = cleanData[i];
    if (a < 30) {
      cleanData[i] = 0;
    } else {
      cleanData[i] = Math.min(255, Math.round(Math.pow((a - 30) / (255 - 30), 1.25) * 255));
    }
  }

  // Step 2: Color decontamination
  const r = Math.max(1, Math.min(6, radius));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const alpha = cleanData[idx + 3];
      if (alpha > 0 && alpha < 235) {
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let dy = -r; dy <= r; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const nidx = (ny * width + nx) * channels;
            if (cleanData[nidx + 3] >= 235) {
              sumR += data[nidx];
              sumG += data[nidx + 1];
              sumB += data[nidx + 2];
              count++;
            }
          }
        }
        if (count > 0) {
          cleanData[idx] = Math.round(sumR / count);
          cleanData[idx + 1] = Math.round(sumG / count);
          cleanData[idx + 2] = Math.round(sumB / count);
        }
      }
    }
  }

  return new RawImage(cleanData, width, height, channels);
}

/**
 * Motion Blur & Thin-Object Matting Refinement.
 * Specifically handles fast-moving sports gear (golf clubs, hockey sticks, bats),
 * motion-blurred limbs, and semi-transparent motion trails:
 * 1. Preserves continuous low-alpha motion streaks (alpha >= 15) so thin moving rods don't vanish.
 * 2. Unmultiplies background colors and extends the moving object's color into the blur gradient.
 */
export function applyMotionBlurMatte(image: any, originalImage: any): any {
  const { width, height, data, channels } = image;
  if (channels < 4) return image;

  const resultData = new Uint8ClampedArray(data);
  const origData = originalImage.data;

  // Preserve motion trail transparency with soft curve (protects low-alpha streaks)
  for (let i = 3; i < resultData.length; i += channels) {
    const a = resultData[i];
    if (a > 15 && a < 180) {
      resultData[i] = Math.min(255, Math.round(a * 1.15));
    }
  }

  // Decontaminate motion trail RGB using color of the opaque moving object
  const r = 4;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const alpha = resultData[idx + 3];
      if (alpha > 10 && alpha < 220) {
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let dy = -r; dy <= r; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const nidx = (ny * width + nx) * channels;
            if (resultData[nidx + 3] >= 220) {
              sumR += origData[nidx];
              sumG += origData[nidx + 1];
              sumB += origData[nidx + 2];
              count++;
            }
          }
        }
        if (count > 0) {
          resultData[idx] = Math.round(sumR / count);
          resultData[idx + 1] = Math.round(sumG / count);
          resultData[idx + 2] = Math.round(sumB / count);
        }
      }
    }
  }

  return new RawImage(resultData, width, height, channels);
}

/**
 * Removes the background from a single image file and saves the result to targetPath.
 */
export async function removeBackgroundFromFile(
  sourcePath: string,
  targetPath: string,
  options: BgRemovalOptions = {}
): Promise<SingleFileResult> {
  const resolvedSource = path.resolve(sourcePath);
  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`Source image not found: ${resolvedSource}`);
  }

  const stat = fs.statSync(resolvedSource);
  if (stat.isDirectory()) {
    throw new Error(`Source path is a directory, not a file: ${resolvedSource}. Use removeBackgroundFromDirectory instead.`);
  }

  const startTime = Date.now();

  // Load input image
  const rawImage = await RawImage.read(resolvedSource);

  // Always default to the highest-quality state-of-the-art model (BiRefNet)
  const modelToUse = options.model || 'birefnet';

  // Run neural background segmentation
  const segmenter = await getSegmentationPipeline(modelToUse, options.device);
  const segmentationResult = await segmenter(rawImage);

  if (!Array.isArray(segmentationResult) || segmentationResult.length === 0 || !segmentationResult[0].mask) {
    throw new Error(`Failed to generate segmentation mask for image: ${path.basename(resolvedSource)}`);
  }

  let mask = segmentationResult[0].mask;

  // Optional alpha thresholding
  if (typeof options.threshold === 'number' && options.threshold >= 0 && options.threshold <= 1) {
    const cutoff = Math.round(options.threshold * 255);
    const maskData = mask.data;
    for (let i = 0; i < maskData.length; i++) {
      maskData[i] = maskData[i] >= cutoff ? 255 : 0;
    }
  }

  // Apply alpha mask to original image
  let isolatedImage = rawImage.clone().putAlpha(mask);

  // Optional motion-blur & fast sports equipment matting
  if (options.motion) {
    isolatedImage = applyMotionBlurMatte(isolatedImage, rawImage);
  }

  // Smart color decontamination (De-fringing) for hair & fine edges:
  // Active by default for highest quality, unless explicitly disabled with defringe: false
  if (options.defringe !== false) {
    isolatedImage = defringeImage(isolatedImage, options.defringeRadius || 3);
  }

  // Optional smart auto-trim
  if (options.trim) {
    isolatedImage = await trimImageAlpha(isolatedImage, options.padding || 0);
  }

  // Ensure target folder exists
  const targetDir = path.dirname(path.resolve(targetPath));
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Save the result
  await isolatedImage.save(targetPath);

  const durationMs = Date.now() - startTime;
  const outputStat = fs.statSync(targetPath);

  return {
    sourceFile: resolvedSource,
    targetFile: path.resolve(targetPath),
    width: isolatedImage.width,
    height: isolatedImage.height,
    durationMs,
    originalBytes: stat.size,
    outputBytes: outputStat.size
  };
}

/**
 * Finds all image files in a directory.
 */
export function findImagesInDir(dirPath: string, recursive = false): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        results.push(...findImagesInDir(full, true));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_BG_EXTENSIONS.has(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

/**
 * Removes background from an entire directory of images and saves them into targetDir.
 */
export async function removeBackgroundFromDirectory(
  sourceDir: string,
  targetDir: string,
  options: BgRemovalOptions = {}
): Promise<BatchRemovalResult> {
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
  const results: SingleFileResult[] = [];
  const errors: { sourceFile: string; error: string }[] = [];

  const batchStartTime = Date.now();

  // Warm up pipeline once
  await getSegmentationPipeline(options.model, options.device);

  for (let i = 0; i < total; i++) {
    const file = imageFiles[i];
    const rel = path.relative(resolvedSourceDir, file);
    const parsed = path.parse(rel);
    const outSubDir = path.join(resolvedTargetDir, parsed.dir);
    if (!fs.existsSync(outSubDir)) {
      fs.mkdirSync(outSubDir, { recursive: true });
    }

    const outExt = (options.format === 'webp') ? '.webp' : '.png';
    const targetFile = path.join(outSubDir, `${parsed.name}${outExt}`);

    try {
      const res = await removeBackgroundFromFile(file, targetFile, options);
      results.push(res);
      if (options.onProgress) {
        options.onProgress({
          index: i + 1,
          total,
          sourceFile: file,
          targetFile,
          width: res.width,
          height: res.height,
          durationMs: res.durationMs,
          originalBytes: res.originalBytes,
          outputBytes: res.outputBytes,
          status: 'success'
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      errors.push({ sourceFile: file, error: errMsg });
      if (options.onProgress) {
        options.onProgress({
          index: i + 1,
          total,
          sourceFile: file,
          targetFile,
          width: 0,
          height: 0,
          durationMs: 0,
          originalBytes: 0,
          outputBytes: 0,
          status: 'error',
          error: errMsg
        });
      }
    }
  }

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
 * Universal router: automatically detects whether source is a file or a folder
 * and processes accordingly.
 */
export async function removeBackground(
  source: string,
  target: string,
  options: BgRemovalOptions = {}
): Promise<SingleFileResult | BatchRemovalResult> {
  const resolvedSource = path.resolve(source);
  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`Source not found: ${resolvedSource}`);
  }

  const stat = fs.statSync(resolvedSource);
  if (stat.isDirectory()) {
    return removeBackgroundFromDirectory(resolvedSource, target, options);
  } else {
    // If target is an existing directory or ends with a slash, save as filename.png in target
    let resolvedTarget = path.resolve(target);
    const targetIsExplicitDir = target.endsWith('/') || target.endsWith('\\');
    const targetExistsAsDir = fs.existsSync(resolvedTarget) && fs.statSync(resolvedTarget).isDirectory();

    if (targetIsExplicitDir || targetExistsAsDir || !path.extname(target)) {
      const parsed = path.parse(resolvedSource);
      const outExt = (options.format === 'webp') ? '.webp' : '.png';
      resolvedTarget = path.join(resolvedTarget, `${parsed.name}${outExt}`);
    }

    return removeBackgroundFromFile(resolvedSource, resolvedTarget, options);
  }
}