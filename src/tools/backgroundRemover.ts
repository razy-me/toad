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
   * Optional manual AI model identifier or alias (internal).
   */
  model?: string;

  /**
   * "Do-Your-Best" ultra-detail mode: multi-model neural ensemble + native-resolution Guided Filtering.
   */
  dyb?: boolean;

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
   * Optimize specifically for portraits, human hair, and fine wisps.
   */
  hair?: boolean;

  /**
   * Fast preview preset (uses lightweight model).
   */
  fast?: boolean;

  /**
   * Alias for fast speed preset (uses BiRefNet Lite).
   */
  quick?: boolean;

  /**
   * Optimize specifically for fine geometric details, jewelry, lace, and fine wireframes.
   */
  detail?: boolean;

  /**
   * Number of concurrent image workers in directory processing (default: 2, max: 8).
   */
  concurrency?: number;

  /**
   * Optional AbortSignal to cancel running operations.
   */
  signal?: AbortSignal;

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
  cropBox?: { x: number; y: number; width: number; height: number };
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

/**
 * 100% Commercial MIT-Licensed Model Matrix.
 * All non-commercial and CC-BY-NC restricted models are strictly excluded.
 */
export const MODEL_MAP: Record<string, string> = {
  default: 'onnx-community/BiRefNet-ONNX',
  general: 'onnx-community/BiRefNet-ONNX',
  birefnet: 'onnx-community/BiRefNet-ONNX',
  dyb: 'onnx-community/BiRefNet-ONNX',
  portrait: 'onnx-community/BiRefNet-portrait-ONNX',
  hair: 'onnx-community/BiRefNet-portrait-ONNX',
  detail: 'onnx-community/BiRefNet-DIS5K-ONNX',
  dis: 'onnx-community/BiRefNet-DIS5K-ONNX',
  fast: 'onnx-community/BiRefNet_lite-ONNX',
  quick: 'onnx-community/BiRefNet_lite-ONNX',
  lite: 'onnx-community/BiRefNet_lite-ONNX',
  'birefnet-lite': 'onnx-community/BiRefNet_lite-ONNX',
  'birefnet-portrait': 'onnx-community/BiRefNet-portrait-ONNX',
  'birefnet-dis': 'onnx-community/BiRefNet-DIS5K-ONNX'
};

// Singleton pipeline cache with device-aware composite key
let cachedPipeline: any = null;
let currentCacheKey: string | null = null;

/**
 * Configure environment to ensure models are stored in a dedicated, permanent TOAD directory
 * and can run 100% offline once downloaded.
 */
export function ensureEnvironmentConfigured(): string {
  let cacheDir = process.env.TOAD_MODELS_CACHE || path.join(os.homedir(), '.toad', 'models');
  if (!fs.existsSync(cacheDir)) {
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
    } catch {
      // Fallback to system temp directory if home partition is full or unwritable (F-56)
      cacheDir = path.join(os.tmpdir(), '.toad', 'models');
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  }
  env.cacheDir = cacheDir;
  env.allowLocalModels = true;
  // If in offline mode, disable remote checks to prevent network timeouts (F-18)
  if (process.env.TOAD_OFFLINE === '1' || process.env.OFFLINE === '1') {
    env.allowRemoteModels = false;
  }
  return cacheDir;
}

/**
 * Resolves the model name from user alias, full identifier, or active parameters.
 * Defaults to the state-of-the-art general model (BiRefNet-ONNX, MIT License).
 */
export function resolveModelName(modelArg?: string, options?: BgRemovalOptions): string {
  if (options?.hair) return MODEL_MAP.hair;
  if (options?.detail) return MODEL_MAP.detail;
  if (options?.fast || options?.quick) return MODEL_MAP.fast;
  if (!modelArg) return MODEL_MAP.default;
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

// In-flight initialization mutex map to prevent parallel duplicate model downloads (F-12)
const inFlightPipelinePromises = new Map<string, Promise<any>>();

/**
 * Loads or returns cached image segmentation pipeline.
 * Caches by composite key (modelName + device) so device switches trigger fresh loading.
 * Supports hardware fallback chain: DirectML -> WebGPU -> CPU (F-45).
 */
export async function getSegmentationPipeline(
  modelArg?: string,
  deviceArg?: 'cpu' | 'webgpu' | 'dml',
  onProgress?: (progress: any) => void
): Promise<any> {
  ensureEnvironmentConfigured();
  const modelName = resolveModelName(modelArg);
  const device = deviceArg || detectBestDevice(modelName);
  const cacheKey = `${modelName}::${device}`;

  if (cachedPipeline && currentCacheKey === cacheKey) {
    return cachedPipeline;
  }

  if (inFlightPipelinePromises.has(cacheKey)) {
    return await inFlightPipelinePromises.get(cacheKey)!;
  }

  const loadPromise = (async () => {
    // Hardware provider fallback chain: requested device -> CPU
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
          const pipe = await pipeline('image-segmentation', modelName, {
            device: dev,
            progress_callback: onProgress
          });
          cachedPipeline = pipe;
          currentCacheKey = `${modelName}::${dev}`;
          return pipe;
        } catch (err: any) {
          attempts++;
          lastError = err;
          if (attempts < maxAttempts) {
            const delayMs = Math.pow(2, attempts) * 500;
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }
    }

    throw lastError;
  })();

  inFlightPipelinePromises.set(cacheKey, loadPromise);
  try {
    return await loadPromise;
  } finally {
    inFlightPipelinePromises.delete(cacheKey);
  }
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
    const rowOffset = y * width;
    let rowHasAlpha = false;
    for (let x = 0; x < width; x++) {
      const alpha = data[(rowOffset + x) * channels + 3];
      if (alpha > thresholdAlpha) {
        rowHasAlpha = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    if (rowHasAlpha) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
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

  const cropped = await image.crop([cropXMin, cropYMin, cropXMax, cropYMax]);
  (cropped as any).cropBox = {
    x: cropXMin,
    y: cropYMin,
    width: cropXMax - cropXMin + 1,
    height: cropYMax - cropYMin + 1
  };
  return cropped;
}

/**
 * Automatic subject classification based on aspect ratio and composition (F-55).
 * Automatically selects portrait model for vertical portrait aspect ratios when zero flags are given.
 */
export function detectSubjectType(image: any): 'portrait' | 'general' {
  const { width, height } = image;
  const aspectRatio = height / width;
  // Vertical framing (1.2 to 2.2) strongly correlates with portrait shots
  if (aspectRatio >= 1.2 && aspectRatio <= 2.2) {
    return 'portrait';
  }
  return 'general';
}

/**
 * Smart color decontamination (De-fringing).
 * Eliminates halos around hair and edges while preserving delicate continuous transparency.
 * Non-destructive: Does NOT clamp subtle alpha values (< 30) to zero (F-05).
 */
export function defringeImage(image: any, radius = 3): any {
  const { width, height, data, channels } = image;
  if (channels < 4) return image;

  const cleanData = new Uint8ClampedArray(data);

  // Step 1: Gentle floor noise suppression (only true zero floor noise <= 2 is zeroed, F-05)
  let hasSemiTransparent = false;
  for (let i = 3; i < cleanData.length; i += channels) {
    const a = cleanData[i];
    if (a <= 2) {
      cleanData[i] = 0;
    }
    if (cleanData[i] > 0 && cleanData[i] < 235) {
      hasSemiTransparent = true;
    }
  }

  // Fast path: If there are no semi-transparent boundary pixels, skip expensive convolution
  if (!hasSemiTransparent) {
    return new RawImage(cleanData, width, height, channels);
  }

  // Step 2: Color decontamination with precomputed row bounds
  const r = Math.max(1, Math.min(6, radius));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = (rowOffset + x) * channels;
      const alpha = cleanData[idx + 3];
      if (alpha > 0 && alpha < 235) {
        let sumR = 0, sumG = 0, sumB = 0, totalWeight = 0;
        const yMin = Math.max(0, y - r);
        const yMax = Math.min(height - 1, y + r);
        const xMin = Math.max(0, x - r);
        const xMax = Math.min(width - 1, x + r);

        for (let ny = yMin; ny <= yMax; ny++) {
          const dy = ny - y;
          const nRowOffset = ny * width;
          for (let nx = xMin; nx <= xMax; nx++) {
            const dx = nx - x;
            const nidx = (nRowOffset + nx) * channels;
            const nAlpha = cleanData[nidx + 3];
            if (nAlpha >= 235) {
              // Distance-weighted kernel: closer opaque pixels have exponentially higher contribution (F-11)
              const distSq = dx * dx + dy * dy;
              const weight = 1 / (1 + distSq);
              sumR += data[nidx] * weight;
              sumG += data[nidx + 1] * weight;
              sumB += data[nidx + 2] * weight;
              totalWeight += weight;
            }
          }
        }
        if (totalWeight > 0) {
          cleanData[idx] = Math.round(sumR / totalWeight);
          cleanData[idx + 1] = Math.round(sumG / totalWeight);
          cleanData[idx + 2] = Math.round(sumB / totalWeight);
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
/**
 * Motion Blur & Thin-Object Matting Refinement.
 * Specifically handles fast-moving sports gear (golf clubs, hockey sticks, bats),
 * motion-blurred limbs, and semi-transparent motion trails:
 * 1. Preserves continuous low-alpha motion streaks with a smooth sigmoid response curve.
 * 2. Bilateral distance-weighted color extension to eliminate background fringing on fast motion.
 */
export function applyMotionBlurMatte(image: any, originalImage: any): any {
  const { width, height, data, channels } = image;
  if (channels < 4) return image;

  const resultData = new Uint8ClampedArray(data);
  const origData = originalImage.data;

  // Preserve motion trail transparency with smooth curve (protects low-alpha streaks without harsh stepping)
  for (let i = 3; i < resultData.length; i += channels) {
    const a = resultData[i];
    if (a > 10 && a < 200) {
      const factor = 1.0 + 0.3 * (1 - Math.abs(a - 100) / 100);
      resultData[i] = Math.min(255, Math.round(a * factor));
    }
  }

  // Decontaminate motion trail RGB using distance-weighted color of opaque moving object
  const r = 3;
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = (rowOffset + x) * channels;
      const alpha = resultData[idx + 3];
      if (alpha > 10 && alpha < 220) {
        let sumR = 0, sumG = 0, sumB = 0, totalW = 0;
        const yMin = Math.max(0, y - r);
        const yMax = Math.min(height - 1, y + r);
        const xMin = Math.max(0, x - r);
        const xMax = Math.min(width - 1, x + r);

        for (let ny = yMin; ny <= yMax; ny++) {
          const dy = ny - y;
          const nRowOffset = ny * width;
          for (let nx = xMin; nx <= xMax; nx++) {
            const dx = nx - x;
            const nidx = (nRowOffset + nx) * channels;
            if (resultData[nidx + 3] >= 220) {
              const weight = 1 / (1 + dx * dx + dy * dy);
              sumR += origData[nidx] * weight;
              sumG += origData[nidx + 1] * weight;
              sumB += origData[nidx + 2] * weight;
              totalW += weight;
            }
          }
        }
        if (totalW > 0) {
          resultData[idx] = Math.round(sumR / totalW);
          resultData[idx + 1] = Math.round(sumG / totalW);
          resultData[idx + 2] = Math.round(sumB / totalW);
        }
      }
    }
  }

  return new RawImage(resultData, width, height, channels);
}

/**
 * Fast 2D Separable Box Filter in O(W * H) time.
 */
export function boxFilter2D(src: Float32Array, width: number, height: number, r: number): Float32Array {
  const temp = new Float32Array(width * height);
  const dst = new Float32Array(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    let count = 0;
    const initR = Math.min(r, width - 1);
    for (let i = 0; i <= initR; i++) {
      sum += src[row + i];
      count++;
    }
    temp[row] = sum / count;

    for (let x = 1; x < width; x++) {
      const addIdx = x + r;
      if (addIdx < width) {
        sum += src[row + addIdx];
        count++;
      }
      const subIdx = x - r - 1;
      if (subIdx >= 0) {
        sum -= src[row + subIdx];
        count--;
      }
      temp[row + x] = sum / count;
    }
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let count = 0;
    const initB = Math.min(r, height - 1);
    for (let i = 0; i <= initB; i++) {
      sum += temp[i * width + x];
      count++;
    }
    dst[x] = sum / count;

    for (let y = 1; y < height; y++) {
      const addIdx = y + r;
      if (addIdx < height) {
        sum += temp[addIdx * width + x];
        count++;
      }
      const subIdx = y - r - 1;
      if (subIdx >= 0) {
        sum -= temp[subIdx * width + x];
        count--;
      }
      dst[y * width + x] = sum / count;
    }
  }

  return dst;
}

/**
 * Guided Image Filter (He, Sun, Tang) for native-resolution edge refinement.
 * Snaps neural alpha matte transitions directly to the camera sensor's high-frequency RGB edges.
 */
export function applyGuidedFilter(
  guide: RawImage,
  mask: RawImage,
  radius = 4,
  eps = 1e-3
): RawImage {
  const width = guide.width;
  const height = guide.height;
  const numPixels = width * height;

  const I = new Float32Array(numPixels);
  const p = new Float32Array(numPixels);

  const gData = guide.data;
  const gChannels = guide.channels;
  for (let i = 0; i < numPixels; i++) {
    const idx = i * gChannels;
    I[i] = (0.299 * gData[idx] + 0.587 * gData[idx + 1] + 0.114 * gData[idx + 2]) / 255;
  }

  const mData = mask.data;
  const mChannels = mask.channels;
  const alphaOffset = mChannels === 4 ? 3 : 0;
  for (let i = 0; i < numPixels; i++) {
    p[i] = mData[i * mChannels + alphaOffset] / 255;
  }

  const meanI = boxFilter2D(I, width, height, radius);
  const meanP = boxFilter2D(p, width, height, radius);

  const II = new Float32Array(numPixels);
  const Ip = new Float32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    II[i] = I[i] * I[i];
    Ip[i] = I[i] * p[i];
  }

  const corrI = boxFilter2D(II, width, height, radius);
  const corrIp = boxFilter2D(Ip, width, height, radius);

  const a = new Float32Array(numPixels);
  const b = new Float32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    const varI = corrI[i] - meanI[i] * meanI[i];
    const covIp = corrIp[i] - meanI[i] * meanP[i];
    a[i] = covIp / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }

  const meanA = boxFilter2D(a, width, height, radius);
  const meanB = boxFilter2D(b, width, height, radius);

  const outData = new Uint8ClampedArray(numPixels);
  for (let i = 0; i < numPixels; i++) {
    let q = meanA[i] * I[i] + meanB[i];
    const orig = p[i];
    if (orig >= 0.95) {
      q = Math.max(q, 0.95);
    } else if (orig <= 0.05) {
      q = Math.min(q, 0.05);
    }
    outData[i] = Math.min(255, Math.max(0, Math.round(q * 255)));
  }

  return new RawImage(outData, width, height, 1);
}

/**
 * Removes the background from a single image file and saves the result to targetPath.
 */
export async function removeBackgroundFromFile(
  sourcePath: string,
  targetPath: string,
  options: BgRemovalOptions = {}
): Promise<SingleFileResult> {
  if (options.signal?.aborted) {
    throw new Error('Background removal aborted by signal.');
  }

  const resolvedSource = path.resolve(sourcePath);
  const resolvedTarget = path.resolve(targetPath);

  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`Source image not found: ${resolvedSource}`);
  }

  const stat = fs.statSync(resolvedSource);
  if (stat.isDirectory()) {
    throw new Error(`Source path is a directory, not a file: ${resolvedSource}. Use removeBackgroundFromDirectory instead.`);
  }

  const ext = path.extname(resolvedSource).toLowerCase();
  if (ext === '.gif') {
    throw new Error(`Animated GIF formats are not supported for single-image background removal. Please extract individual frames.`);
  }
  if (ext === '.svg') {
    throw new Error(`Vector SVG format cannot be processed directly by neural segmentation. Please rasterize to PNG or JPEG first.`);
  }
  if (ext === '.tif' || ext === '.tiff') {
    throw new Error(`Multi-page TIFF format is not supported. Please convert to PNG or JPEG first.`);
  }

  // Safety check on file size (> 150 MB safety threshold, F-36)
  if (stat.size > 150 * 1024 * 1024) {
    throw new Error(`Input image file exceeds safe size limit of 150 MB (${(stat.size / 1024 / 1024).toFixed(1)} MB). Downscale before processing.`);
  }

  // Detect in-place overwrite and buffer original file to prevent data loss on error (F-04)
  const isSameFile = resolvedSource === resolvedTarget;
  let backupBuffer: Buffer | null = null;
  if (isSameFile) {
    backupBuffer = fs.readFileSync(resolvedSource);
  }

  const startTime = Date.now();

  try {
    // Load input image and guarantee 4-channel RGBA format for putAlpha (supports grayscale, RGB, RGBA)
    let rawImage = await RawImage.read(resolvedSource);
    if (rawImage.channels === 1) {
      rawImage = rawImage.rgb().rgba();
    } else if (rawImage.channels < 4) {
      rawImage = rawImage.rgba();
    }

    const effectiveDevice = options.device || (isGpuAvailable() ? 'dml' : 'cpu');
    let mask: any;

    if (options.dyb) {
      // --- STAGE 1: Dual-Model Neural Ensemble (Semantic Foundation + DIS5K Micro-Geometry) ---
      const subject = detectSubjectType(rawImage);
      const baseModel = subject === 'portrait' ? MODEL_MAP.portrait : MODEL_MAP.default;

      // Pass A: Semantic Base
      const segmenterA = await getSegmentationPipeline(baseModel, effectiveDevice);
      const resA = await segmenterA(rawImage);
      if (!Array.isArray(resA) || resA.length === 0 || !resA[0].mask) {
        throw new Error(`Failed to generate base segmentation mask for image: ${path.basename(resolvedSource)}`);
      }
      let maskA = resA[0].mask;
      if (maskA.width !== rawImage.width || maskA.height !== rawImage.height) {
        maskA = await maskA.resize(rawImage.width, rawImage.height);
      }

      // Pass B: Micro-Geometry Specialist (BiRefNet DIS5K)
      const segmenterB = await getSegmentationPipeline(MODEL_MAP.detail, effectiveDevice);
      const resB = await segmenterB(rawImage);
      if (!Array.isArray(resB) || resB.length === 0 || !resB[0].mask) {
        throw new Error(`Failed to generate detail segmentation mask for image: ${path.basename(resolvedSource)}`);
      }
      let maskB = resB[0].mask;
      if (maskB.width !== rawImage.width || maskB.height !== rawImage.height) {
        maskB = await maskB.resize(rawImage.width, rawImage.height);
      }

      // Confidence-Weighted Ensemble Fusion
      const fusedData = new Uint8ClampedArray(rawImage.width * rawImage.height);
      const dataA = maskA.data;
      const dataB = maskB.data;
      for (let i = 0; i < fusedData.length; i++) {
        const valA = dataA[i];
        const valB = dataB[i];
        if (valA >= 220 && valB >= 220) {
          fusedData[i] = Math.max(valA, valB);
        } else if (valA <= 30 && valB <= 30) {
          fusedData[i] = Math.min(valA, valB);
        } else {
          fusedData[i] = Math.round(0.5 * valA + 0.5 * valB);
        }
      }
      const fusedMask = new RawImage(fusedData, rawImage.width, rawImage.height, 1);

      // --- STAGE 2: Native-Resolution Guided Image Filter (He et al.) ---
      // Snaps alpha matte transitions directly to the camera sensor's high-frequency RGB edges
      mask = applyGuidedFilter(rawImage, fusedMask, 4, 1e-3);
    } else {
      // Adaptive model selection: if no explicit model or flag given, auto-classify subject (F-55)
      let modelToUse: string;
      if (!options.model && !options.hair && !options.detail && !options.fast && !options.quick) {
        const subject = detectSubjectType(rawImage);
        modelToUse = subject === 'portrait' ? MODEL_MAP.portrait : MODEL_MAP.default;
      } else {
        modelToUse = resolveModelName(options.model, options);
      }

      // Run neural background segmentation
      const segmenter = await getSegmentationPipeline(modelToUse, effectiveDevice);
      const segmentationResult = await segmenter(rawImage);

      if (!Array.isArray(segmentationResult) || segmentationResult.length === 0 || !segmentationResult[0].mask) {
        throw new Error(`Failed to generate segmentation mask for image: ${path.basename(resolvedSource)}`);
      }

      mask = segmentationResult[0].mask;

      // Ensure mask dimensions match source image dimensions exactly (F-15)
      if (mask.width !== rawImage.width || mask.height !== rawImage.height) {
        mask = await mask.resize(rawImage.width, rawImage.height);
      }
    }

  // Optional smooth anti-aliased alpha thresholding (F-10)
  if (typeof options.threshold === 'number' && options.threshold >= 0 && options.threshold <= 1) {
    const cutoff = options.threshold * 255;
    const slope = 0.2;
    const maskData = mask.data;
    for (let i = 0; i < maskData.length; i++) {
      const diff = maskData[i] - cutoff;
      if (diff <= -15) {
        maskData[i] = 0;
      } else if (diff >= 15) {
        maskData[i] = 255;
      } else {
        const val = 1 / (1 + Math.exp(-diff * slope));
        maskData[i] = Math.min(255, Math.max(0, Math.round(val * 255)));
      }
    }
  }

  // Apply alpha mask to original image
  let isolatedImage = rawImage.clone().putAlpha(mask);

  // Optional motion-blur & fast sports equipment matting
  if (options.motion) {
    isolatedImage = applyMotionBlurMatte(isolatedImage, rawImage);
  }

  // Smart color decontamination (De-fringing) for hair & fine edges:
  // Active by default for highest quality, unless explicitly disabled with defringe: false.
  // In DYB mode, run deep radius 5 bilateral decontamination for 100% halo elimination.
  // Fast-Path: In fast/quick mode, skip expensive CPU convolution by default for max throughput, unless explicitly enabled.
  const shouldRunDefringe = (options.fast || options.quick)
    ? options.defringe === true
    : options.defringe !== false;

  if (shouldRunDefringe) {
    const defaultRadius = options.dyb ? 5 : ((options.fast || options.quick) ? 1 : 3);
    isolatedImage = defringeImage(isolatedImage, options.defringeRadius || defaultRadius);
  }

  // Trimming is disabled by default to strictly preserve original image dimensions and canvas positioning
  if (options.trim === true) {
    isolatedImage = await trimImageAlpha(isolatedImage, options.padding || 0);
  }

  // Ensure target folder exists
  const targetDir = path.dirname(path.resolve(targetPath));
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Atomic file write via temporary staging file to prevent corruption
  const tempPath = path.join(
    targetDir,
    `.toad-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(targetPath) || '.png'}`
  );
  try {
    await isolatedImage.save(tempPath);
    fs.renameSync(tempPath, targetPath);
  } catch (saveErr) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    throw saveErr;
  }

  const durationMs = Date.now() - startTime;
  const outputStat = fs.statSync(targetPath);

    return {
      sourceFile: resolvedSource,
      targetFile: path.resolve(targetPath),
      width: isolatedImage.width,
      height: isolatedImage.height,
      durationMs,
      originalBytes: stat.size,
      outputBytes: outputStat.size,
      cropBox: (isolatedImage as any).cropBox
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
 * Finds all image files in a directory.
 * Includes circular symlink detection to prevent infinite recursion (F-26).
 */
export function findImagesInDir(dirPath: string, recursive = false, visited = new Set<string>()): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;

  let realDir = dirPath;
  try {
    realDir = fs.realpathSync(dirPath);
  } catch {}

  if (visited.has(realDir)) {
    return results; // Cycle detected, terminate recursion branch
  }
  visited.add(realDir);

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        results.push(...findImagesInDir(full, true, visited));
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

  // Warm up pipeline once using parameter-resolved model
  const warmupModel = resolveModelName(options.model, options);
  await getSegmentationPipeline(warmupModel, options.device);

  const defaultConcurrency = (options.fast || options.quick) ? 4 : 2;
  const concurrency = Math.max(1, Math.min(8, options.concurrency ?? defaultConcurrency));
  let currentIndex = 0;
  let completedCount = 0;

  async function worker() {
    while (currentIndex < total) {
      if (options.signal?.aborted) {
        throw new Error('Batch operation aborted by signal.');
      }
      const fileIdx = currentIndex++;
      const file = imageFiles[fileIdx];
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
        completedCount++;

        // Yield event loop and clear heap memory to prevent V8 exhaustion during large batches
        await new Promise((resolve) => setImmediate(resolve));
        if (typeof global !== 'undefined' && typeof (global as any).gc === 'function') {
          try { (global as any).gc(); } catch {}
        }

        if (options.onProgress) {
          options.onProgress({
            index: completedCount,
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
        completedCount++;
        if (options.onProgress) {
          options.onProgress({
            index: completedCount,
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

    if (targetIsExplicitDir || targetExistsAsDir || (!path.extname(target) && !fs.existsSync(resolvedTarget))) {
      const parsed = path.parse(resolvedSource);
      const outExt = (options.format === 'webp') ? '.webp' : '.png';
      resolvedTarget = path.join(resolvedTarget, `${parsed.name}${outExt}`);
    } else if (options.format === 'webp' && path.extname(resolvedTarget).toLowerCase() === '.png') {
      // Auto-update extension if explicit file target was specified with mismatched extension (F-47)
      resolvedTarget = resolvedTarget.slice(0, -4) + '.webp';
    }

    return removeBackgroundFromFile(resolvedSource, resolvedTarget, options);
  }
}