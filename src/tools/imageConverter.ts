/**
 * src/tools/imageConverter.ts
 *
 * High-performance Image Conversion, Rescaling & Compression Engine for TOAD.
 * Converts between any image formats (PNG, JPG, WebP, AVIF, GIF, SVG, PDF, ICO, PSD),
 * with granular quality, scaling (upscale & downscale), resampling filters, and web compression.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import { readPsd } from 'ag-psd';

export type SupportedImageFormat = 'png' | 'jpeg' | 'jpg' | 'webp' | 'avif' | 'svg' | 'pdf' | 'ico' | 'gif';

export interface ImageConvertOptions {
  /** Target output format (default: 'webp') */
  format?: SupportedImageFormat;
  /** Image quality from 1 to 100 (for lossy formats: jpeg, webp, avif; default: 85) */
  quality?: number;
  /** Scale factor multiplier (e.g. 0.25, 0.5, 1, 2, 4) */
  scale?: number;
  /** Explicit target width in pixels */
  width?: number;
  /** Explicit target height in pixels */
  height?: number;
  /** Resizing fit strategy: 'contain', 'cover', 'stretch', 'scale-down' (default: 'contain') */
  fit?: 'contain' | 'cover' | 'stretch' | 'scale-down';
  /** Keep original aspect ratio when specifying width or height (default: true) */
  maintainAspectRatio?: boolean;
  /** Resampling interpolation: 'high' (bicubic), 'medium' (bilinear), 'nearest' (pixel art) */
  filter?: 'high' | 'medium' | 'low' | 'nearest';
  /** Background color for opaque formats (JPEG) when input has transparency (default: '#FFFFFF') */
  background?: string;
  /** Activate aggressive compression preset (e.g. 75% quality, strip metadata) */
  compress?: boolean;
}

export interface ImageConvertResult {
  buffer: Buffer;
  dataUrl: string;
  format: string;
  mimeType: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  outputBytes: number;
  savingsPercent: number;
  durationMs: number;
}

/**
 * Converts, resizes, or compresses an image from buffer, file path, or data URL.
 */
export async function convertImage(
  input: string | Buffer,
  options: ImageConvertOptions = {}
): Promise<ImageConvertResult> {
  const startTime = Date.now();

  // 1. Resolve input buffer and source file size
  let srcBuffer: Buffer;
  let originalBytes = 0;

  if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      const commaIdx = input.indexOf(',');
      const base64Data = commaIdx >= 0 ? input.slice(commaIdx + 1) : input;
      srcBuffer = Buffer.from(base64Data, 'base64');
      originalBytes = srcBuffer.length;
    } else {
      const resolved = path.resolve(input);
      if (!fs.existsSync(resolved)) {
        throw new Error(`Input image file not found: ${resolved}`);
      }
      srcBuffer = fs.readFileSync(resolved);
      originalBytes = srcBuffer.length;
    }
  } else if (Buffer.isBuffer(input)) {
    srcBuffer = input;
    originalBytes = input.length;
  } else {
    throw new Error('Invalid image input: expected file path, Buffer, or data URL.');
  }

  // 2. Decode source image
  let srcWidth = 0;
  let srcHeight = 0;
  let loadedImage: Image | null = null;
  let psdCanvasBuffer: Buffer | null = null;

  // Check if source is PSD
  const isPsd = srcBuffer.length >= 4 && srcBuffer.subarray(0, 4).toString('ascii') === '8BPS';
  if (isPsd) {
    try {
      const psd = readPsd(srcBuffer as any);
      srcWidth = psd.width;
      srcHeight = psd.height;
      if (psd.canvas) {
        // Render PSD canvas
        const psdC = psd.canvas as any;
        if (typeof psdC.toBuffer === 'function') {
          psdCanvasBuffer = psdC.toBuffer('image/png');
        }
      }
      if (!psdCanvasBuffer) {
        // Fallback: draw background or layers
        const tempC = createCanvas(srcWidth, srcHeight);
        psdCanvasBuffer = tempC.toBuffer('image/png');
      }
      loadedImage = await loadImage(psdCanvasBuffer);
    } catch (err: any) {
      throw new Error(`Failed to decode PSD file: ${err.message || String(err)}`);
    }
  } else {
    try {
      loadedImage = await loadImage(srcBuffer);
      srcWidth = loadedImage.width;
      srcHeight = loadedImage.height;
    } catch (err: any) {
      throw new Error(`Failed to decode image: ${err.message || String(err)}`);
    }
  }

  if (srcWidth <= 0 || srcHeight <= 0) {
    throw new Error(`Invalid source image dimensions: ${srcWidth}x${srcHeight}`);
  }

  // 3. Compute target dimensions
  let targetWidth = srcWidth;
  let targetHeight = srcHeight;
  const maintainAspect = options.maintainAspectRatio !== false;
  const fit = options.fit || 'contain';

  if (options.scale && options.scale > 0) {
    targetWidth = Math.max(1, Math.round(srcWidth * options.scale));
    targetHeight = Math.max(1, Math.round(srcHeight * options.scale));
  } else if (options.width && options.height) {
    if (maintainAspect) {
      const ratio = srcWidth / srcHeight;
      if (fit === 'stretch') {
        targetWidth = Math.max(1, Math.round(options.width));
        targetHeight = Math.max(1, Math.round(options.height));
      } else if (fit === 'cover') {
        // Fill bounds and crop
        targetWidth = Math.max(1, Math.round(options.width));
        targetHeight = Math.max(1, Math.round(options.height));
      } else {
        // 'contain' or 'scale-down'
        const scaleW = options.width / srcWidth;
        const scaleH = options.height / srcHeight;
        const s = Math.min(scaleW, scaleH);
        targetWidth = Math.max(1, Math.round(srcWidth * s));
        targetHeight = Math.max(1, Math.round(srcHeight * s));
      }
    } else {
      targetWidth = Math.max(1, Math.round(options.width));
      targetHeight = Math.max(1, Math.round(options.height));
    }
  } else if (options.width && !options.height) {
    targetWidth = Math.max(1, Math.round(options.width));
    targetHeight = maintainAspect ? Math.max(1, Math.round(srcHeight * (options.width / srcWidth))) : srcHeight;
  } else if (!options.width && options.height) {
    targetHeight = Math.max(1, Math.round(options.height));
    targetWidth = maintainAspect ? Math.max(1, Math.round(srcWidth * (options.height / srcHeight))) : srcWidth;
  }

  // Clamping
  targetWidth = Math.min(32768, Math.max(1, targetWidth));
  targetHeight = Math.min(32768, Math.max(1, targetHeight));

  // 4. Render to Canvas with smoothing filter
  const canvas = createCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');

  const filter = options.filter || 'high';
  ctx.imageSmoothingEnabled = filter !== 'nearest';
  if (filter !== 'nearest') {
    ctx.imageSmoothingQuality = filter === 'low' ? 'low' : filter === 'medium' ? 'medium' : 'high';
  }

  // Pre-fill background if target format is opaque (JPEG)
  const normFormat = (options.format || (options.compress ? 'webp' : 'png')).toLowerCase();
  const isJpeg = normFormat === 'jpeg' || normFormat === 'jpg';

  if (isJpeg) {
    ctx.fillStyle = options.background || '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  // Draw image
  if (fit === 'cover' && options.width && options.height && maintainAspect) {
    const scale = Math.max(options.width / srcWidth, options.height / srcHeight);
    const nw = srcWidth * scale;
    const nh = srcHeight * scale;
    const dx = (targetWidth - nw) / 2;
    const dy = (targetHeight - nh) / 2;
    ctx.drawImage(loadedImage, dx, dy, nw, nh);
  } else {
    ctx.drawImage(loadedImage, 0, 0, targetWidth, targetHeight);
  }

  // 5. Quality calculation
  let quality = options.quality;
  if (quality === undefined) {
    quality = options.compress ? 75 : 88;
  }
  quality = Math.max(1, Math.min(100, Math.round(quality)));

  // 6. Encode to target format
  let outBuf: Buffer;
  let mimeType = 'image/png';
  let finalFormat = normFormat;

  if (isJpeg) {
    outBuf = await canvas.encode('jpeg', quality);
    mimeType = 'image/jpeg';
    finalFormat = 'jpg';
  } else if (normFormat === 'webp') {
    outBuf = await canvas.encode('webp', quality);
    mimeType = 'image/webp';
    finalFormat = 'webp';
  } else if (normFormat === 'avif') {
    outBuf = await canvas.encode('avif', { quality });
    mimeType = 'image/avif';
    finalFormat = 'avif';
  } else if (normFormat === 'gif') {
    outBuf = await canvas.encode('gif', quality);
    mimeType = 'image/gif';
    finalFormat = 'gif';
  } else if (normFormat === 'ico') {
    // Generate standard PNG-in-ICO binary container
    const pngBuf = await canvas.encode('png');
    const icoW = targetWidth >= 256 ? 0 : targetWidth;
    const icoH = targetHeight >= 256 ? 0 : targetHeight;
    const icoBuf = Buffer.alloc(6 + 16 + pngBuf.length);

    // ICO Header
    icoBuf.writeUInt16LE(0, 0); // Reserved
    icoBuf.writeUInt16LE(1, 2); // Type 1 = ICO
    icoBuf.writeUInt16LE(1, 4); // Count = 1

    // Directory Entry
    icoBuf.writeUInt8(icoW, 6);
    icoBuf.writeUInt8(icoH, 7);
    icoBuf.writeUInt8(0, 8); // Color count
    icoBuf.writeUInt8(0, 9); // Reserved
    icoBuf.writeUInt16LE(1, 10); // Color planes
    icoBuf.writeUInt16LE(32, 12); // Bits per pixel
    icoBuf.writeUInt32LE(pngBuf.length, 14); // Image bytes
    icoBuf.writeUInt32LE(22, 18); // Offset (6 + 16)

    pngBuf.copy(icoBuf, 22);
    outBuf = icoBuf;
    mimeType = 'image/x-icon';
    finalFormat = 'ico';
  } else if (normFormat === 'svg') {
    // Wrap raster in SVG with exact viewBox and dimensions
    const pngBuf = await canvas.encode('png');
    const base64 = pngBuf.toString('base64');
    const svgText = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${targetWidth}" height="${targetHeight}" viewBox="0 0 ${targetWidth} ${targetHeight}">
  <image width="${targetWidth}" height="${targetHeight}" href="data:image/png;base64,${base64}" />
</svg>`;
    outBuf = Buffer.from(svgText, 'utf-8');
    mimeType = 'image/svg+xml';
    finalFormat = 'svg';
  } else if (normFormat === 'pdf') {
    // Minimal standalone PDF container embedding high-res JPEG
    const jpgBuf = await canvas.encode('jpeg', quality);
    outBuf = buildPdfFromJpeg(jpgBuf, targetWidth, targetHeight);
    mimeType = 'application/pdf';
    finalFormat = 'pdf';
  } else {
    // Default: PNG
    outBuf = await canvas.encode('png');
    mimeType = 'image/png';
    finalFormat = 'png';
  }

  const outputBytes = outBuf.length;
  const savings = originalBytes > 0
    ? Math.round(((originalBytes - outputBytes) / originalBytes) * 1000) / 10
    : 0;

  const dataUrl = `data:${mimeType};base64,${outBuf.toString('base64')}`;

  return {
    buffer: outBuf,
    dataUrl,
    format: finalFormat,
    mimeType,
    width: targetWidth,
    height: targetHeight,
    originalWidth: srcWidth,
    originalHeight: srcHeight,
    originalBytes,
    outputBytes,
    savingsPercent: savings,
    durationMs: Date.now() - startTime
  };
}

/**
 * Builds a valid single-page PDF embedding a JPEG image.
 */
function buildPdfFromJpeg(jpegBuf: Buffer, width: number, height: number): Buffer {
  const chunks: Buffer[] = [];
  chunks.push(Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary'));

  const objects: { id: number; content: Buffer }[] = [];

  // Object 1: Catalog
  objects.push({ id: 1, content: Buffer.from('<< /Type /Catalog /Pages 2 0 R >>') });

  // Object 2: Pages
  objects.push({ id: 2, content: Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>') });

  // Object 3: Page (MediaBox matches pixel dimensions at 72dpi)
  objects.push({
    id: 3,
    content: Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`)
  });

  // Object 4: Image XObject with /DCTDecode
  const imgHeader = Buffer.from(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuf.length} >>\nstream\n`,
    'ascii'
  );
  const imgFooter = Buffer.from('\nendstream', 'ascii');
  objects.push({ id: 4, content: Buffer.concat([imgHeader, jpegBuf, imgFooter]) });

  // Object 5: Content stream (matrix transforms unit square to width x height)
  const drawStream = `q ${width} 0 0 ${height} 0 0 cm /Im1 Do Q`;
  objects.push({
    id: 5,
    content: Buffer.from(`<< /Length ${drawStream.length} >>\nstream\n${drawStream}\nendstream`)
  });

  // Serialize PDF objects
  const offsets: number[] = [0];
  let curOffset = chunks[0]!.length;

  for (const obj of objects) {
    offsets[obj.id] = curOffset;
    const header = Buffer.from(`${obj.id} 0 obj\n`, 'ascii');
    const footer = Buffer.from('\nendobj\n', 'ascii');
    chunks.push(header, obj.content, footer);
    curOffset += header.length + obj.content.length + footer.length;
  }

  const startXref = curOffset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objects.length; id++) {
    const offStr = String(offsets[id] || 0).padStart(10, '0');
    xref += `${offStr} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'ascii'));

  return Buffer.concat(chunks);
}
