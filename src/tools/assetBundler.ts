/**
 * src/tools/assetBundler.ts
 * Multi-resolution asset bundler for toad.
 * Generates favicons, app icon packs, social share cards, and PWA manifests from any .toad design.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { LayoutResult, LayoutNode } from '../parser/math.js';
import { CanvasRenderer } from '../engine/canvasRenderer.js';
import { compileToad, BuildResult } from '../build.js';

export interface AssetEntry {
  filename: string;
  width: number;
  height: number;
  format: 'png' | 'ico';
  purpose?: string;
}

export interface BundlePreset {
  name: string;
  description: string;
  assets: AssetEntry[];
}

export const PRESETS: Record<string, BundlePreset> = {
  favicons: {
    name: 'favicons',
    description: 'Web Favicons & Modern PWA Icon Suite',
    assets: [
      { filename: 'favicon-16x16.png', width: 16, height: 16, format: 'png' },
      { filename: 'favicon-32x32.png', width: 32, height: 32, format: 'png' },
      { filename: 'apple-touch-icon.png', width: 180, height: 180, format: 'png' },
      { filename: 'android-chrome-192x192.png', width: 192, height: 192, format: 'png', purpose: 'any maskable' },
      { filename: 'android-chrome-512x512.png', width: 512, height: 512, format: 'png', purpose: 'any maskable' },
      { filename: 'favicon.ico', width: 32, height: 32, format: 'ico' }
    ]
  },
  'app-icon': {
    name: 'app-icon',
    description: 'iOS / macOS / Android Application Stores & Home Screens',
    assets: [
      { filename: 'icon-1024.png', width: 1024, height: 1024, format: 'png' },
      { filename: 'icon-512.png', width: 512, height: 512, format: 'png' },
      { filename: 'icon-192.png', width: 192, height: 192, format: 'png' },
      { filename: 'icon-180.png', width: 180, height: 180, format: 'png' },
      { filename: 'icon-120.png', width: 120, height: 120, format: 'png' },
      { filename: 'icon-64.png', width: 64, height: 64, format: 'png' },
      { filename: 'icon-32.png', width: 32, height: 32, format: 'png' }
    ]
  },
  social: {
    name: 'social',
    description: 'Social Media Headers & OpenGraph Preview Images',
    assets: [
      { filename: 'og-image.png', width: 1200, height: 630, format: 'png' },
      { filename: 'twitter-header.png', width: 1500, height: 500, format: 'png' },
      { filename: 'twitter-card.png', width: 1200, height: 675, format: 'png' },
      { filename: 'instagram-square.png', width: 1080, height: 1080, format: 'png' },
      { filename: 'instagram-story.png', width: 1080, height: 1920, format: 'png' }
    ]
  }
};

export interface BundleOptions {
  outDir?: string;
  preset?: string;
  target?: string; // Optional element id (e.g. "#logo" or "logo")
  name?: string;
  shortName?: string;
  themeColor?: string;
  manifest?: boolean;
}

export interface GeneratedAssetInfo {
  filename: string;
  path: string;
  width: number;
  height: number;
  bytes: number;
}

export interface BundleResult {
  preset: string;
  outDir: string;
  assets: GeneratedAssetInfo[];
  manifestPath?: string;
  htmlSnippetPath?: string;
}

function flattenNodes(nodes: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  const seen = new Set<LayoutNode>();
  function walk(list: LayoutNode[]) {
    for (const node of list) {
      if (!seen.has(node)) {
        seen.add(node);
        result.push(node);
      }
      if (node.children && node.children.length > 0) walk(node.children);
    }
  }
  walk(nodes);
  return result;
}

/**
 * Converts 32-bit RGBA pixel data to Windows ICO DIB (BITMAPINFOHEADER + BGRA + AND mask).
 */
export function rgbaToDib(width: number, height: number, rgba: Uint8ClampedArray | Buffer): Buffer {
  const headerSize = 40;
  const imageSize = width * height * 4;
  const andMaskRowBytes = Math.ceil(width / 32) * 4;
  const andMaskSize = andMaskRowBytes * height;
  const totalSize = headerSize + imageSize + andMaskSize;
  const buf = Buffer.alloc(totalSize);

  // BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, 0);                 // biSize
  buf.writeInt32LE(width, 4);                // biWidth
  buf.writeInt32LE(height * 2, 8);           // biHeight (doubled for ICO XOR + AND mask)
  buf.writeUInt16LE(1, 12);                  // biPlanes
  buf.writeUInt16LE(32, 14);                 // biBitCount (32-bit BGRA)
  buf.writeUInt32LE(0, 16);                  // biCompression (BI_RGB)
  buf.writeUInt32LE(imageSize + andMaskSize, 20); // biSizeImage
  buf.writeInt32LE(0, 24);                   // biXPelsPerMeter
  buf.writeInt32LE(0, 28);                   // biYPelsPerMeter
  buf.writeUInt32LE(0, 32);                  // biClrUsed
  buf.writeUInt32LE(0, 36);                  // biClrImportant

  // XOR mask: 32-bit BGRA bottom-up
  let dstOffset = headerSize;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const srcOffset = (y * width + x) * 4;
      buf[dstOffset++] = rgba[srcOffset + 2]!; // B
      buf[dstOffset++] = rgba[srcOffset + 1]!; // G
      buf[dstOffset++] = rgba[srcOffset]!;     // R
      buf[dstOffset++] = rgba[srcOffset + 3]!; // A
    }
  }

  // AND mask: 1 bit per pixel bottom-up
  const andMaskStart = headerSize + imageSize;
  for (let y = height - 1; y >= 0; y--) {
    const rowStart = andMaskStart + (height - 1 - y) * andMaskRowBytes;
    for (let x = 0; x < width; x++) {
      const srcOffset = (y * width + x) * 4;
      if (rgba[srcOffset + 3] === 0) {
        const byteIndex = rowStart + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        buf[byteIndex] |= (1 << bitIndex);
      }
    }
  }

  return buf;
}

/**
 * Packs multiple PNG or DIB images into a standard Windows ICO container format.
 */
export function createIcoBuffer(images: Array<{ width: number; height: number; buffer: Buffer }>): Buffer {
  const count = images.length;
  const headerSize = 6;
  const dirSize = 16 * count;
  let currentOffset = headerSize + dirSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  const dirEntries: Buffer[] = [];
  const imagePayloads: Buffer[] = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Size
    entry.writeUInt32LE(currentOffset, 12); // Offset

    dirEntries.push(entry);
    imagePayloads.push(img.buffer);
    currentOffset += img.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imagePayloads]);
}

/**
 * Generates an asset bundle from a compiled toad document or entry file.
 */
export async function bundleAssets(
  buildInput: BuildResult | string,
  options: BundleOptions = {}
): Promise<BundleResult> {
  let buildResult: BuildResult;
  if (typeof buildInput === 'string') {
    buildResult = await compileToad(buildInput, { dryRun: true });
  } else {
    buildResult = buildInput;
  }

  const presetKey = (options.preset || 'favicons').toLowerCase();
  let assetList: AssetEntry[] = [];

  if (presetKey === 'all') {
    assetList = [
      ...PRESETS.favicons!.assets,
      ...PRESETS['app-icon']!.assets,
      ...PRESETS.social!.assets
    ];
  } else if (PRESETS[presetKey]) {
    assetList = PRESETS[presetKey]!.assets;
  } else {
    throw new Error(`Unknown bundle preset "${presetKey}". Available presets: favicons, app-icon, social, all.`);
  }

  const baseDir = path.dirname(path.resolve(buildResult.entryPath));
  const outDir = options.outDir
    ? path.resolve(options.outDir)
    : path.resolve(baseDir, 'bundle', presetKey);

  fs.mkdirSync(outDir, { recursive: true });

  const layout = buildResult.layout;
  const allNodes = flattenNodes(layout.nodes);

  // Determine crop box (whole canvas or target element)
  let cropX = 0;
  let cropY = 0;
  let cropW = layout.canvas.width;
  let cropH = layout.canvas.height;

  if (options.target) {
    const rawTarget = options.target.replace(/^#/, '');
    const found = allNodes.find(n => n.id === rawTarget || n.name === rawTarget);
    if (!found) {
      throw new Error(`Target element "#${rawTarget}" was not found in layout for asset bundling.`);
    }
    cropX = found.x;
    cropY = found.y;
    cropW = Math.max(1, found.width);
    cropH = Math.max(1, found.height);
  }

  // Render high-res source canvas at 2x scale for sharp sub-pixel resampling
  const renderScale = 2;
  const masterCanvas = await CanvasRenderer.renderToCanvas(layout, { scale: renderScale });

  const bleed = layout.canvas.bleed || 0;
  const cropMarks = layout.canvas.cropMarks === true;
  const margin = Math.max(cropMarks ? 30 : 0, bleed > 0 ? bleed : 0);

  const generatedAssets: GeneratedAssetInfo[] = [];
  const icoCandidates: Array<{ width: number; height: number; buffer: Buffer }> = [];

  for (const asset of assetList) {
    if (asset.format === 'ico') {
      continue; // Handled after generating PNG slices
    }

    const destCanvas = createCanvas(asset.width, asset.height);
    const ctx = destCanvas.getContext('2d');

    // Smooth bilinear/bicubic scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const scaleFactor = Math.min(asset.width / cropW, asset.height / cropH);
    const drawW = Math.round(cropW * scaleFactor);
    const drawH = Math.round(cropH * scaleFactor);
    const drawX = Math.round((asset.width - drawW) / 2);
    const drawY = Math.round((asset.height - drawH) / 2);

    ctx.drawImage(
      masterCanvas,
      (cropX + margin) * renderScale,
      (cropY + margin) * renderScale,
      cropW * renderScale,
      cropH * renderScale,
      drawX,
      drawY,
      drawW,
      drawH
    );

    const buf = destCanvas.toBuffer('image/png');
    const filePath = path.join(outDir, asset.filename);
    fs.writeFileSync(filePath, buf);

    generatedAssets.push({
      filename: asset.filename,
      path: filePath,
      width: asset.width,
      height: asset.height,
      bytes: buf.length
    });

    if (asset.width === 16 || asset.width === 32 || asset.width === 48) {
      if (asset.width === 16 || asset.width === 32) {
        const imgData = ctx.getImageData(0, 0, asset.width, asset.height).data;
        icoCandidates.push({ width: asset.width, height: asset.height, buffer: rgbaToDib(asset.width, asset.height, imgData) });
      } else {
        icoCandidates.push({ width: asset.width, height: asset.height, buffer: buf });
      }
    }
  }

  // Generate ICO if requested in preset
  const icoAsset = assetList.find(a => a.format === 'ico');
  if (icoAsset) {
    // If we don't have 16 and 32 yet, render them for the ICO container using DIB format
    if (!icoCandidates.some(c => c.width === 16)) {
      const c16 = createCanvas(16, 16);
      const ctx16 = c16.getContext('2d');
      ctx16.imageSmoothingEnabled = true;
      const s16 = Math.min(16 / cropW, 16 / cropH);
      const dw16 = Math.round(cropW * s16);
      const dh16 = Math.round(cropH * s16);
      ctx16.drawImage(masterCanvas, cropX * renderScale, cropY * renderScale, cropW * renderScale, cropH * renderScale, Math.round((16 - dw16) / 2), Math.round((16 - dh16) / 2), dw16, dh16);
      const imgData16 = ctx16.getImageData(0, 0, 16, 16).data;
      icoCandidates.push({ width: 16, height: 16, buffer: rgbaToDib(16, 16, imgData16) });
    }
    if (!icoCandidates.some(c => c.width === 32)) {
      const c32 = createCanvas(32, 32);
      const ctx32 = c32.getContext('2d');
      ctx32.imageSmoothingEnabled = true;
      const s32 = Math.min(32 / cropW, 32 / cropH);
      const dw32 = Math.round(cropW * s32);
      const dh32 = Math.round(cropH * s32);
      ctx32.drawImage(masterCanvas, cropX * renderScale, cropY * renderScale, cropW * renderScale, cropH * renderScale, Math.round((32 - dw32) / 2), Math.round((32 - dh32) / 2), dw32, dh32);
      const imgData32 = ctx32.getImageData(0, 0, 32, 32).data;
      icoCandidates.push({ width: 32, height: 32, buffer: rgbaToDib(32, 32, imgData32) });
    }

    icoCandidates.sort((a, b) => a.width - b.width);
    const icoBuf = createIcoBuffer(icoCandidates);
    const icoPath = path.join(outDir, icoAsset.filename);
    fs.writeFileSync(icoPath, icoBuf);

    generatedAssets.push({
      filename: icoAsset.filename,
      path: icoPath,
      width: 32,
      height: 32,
      bytes: icoBuf.length
    });
  }

  let manifestPath: string | undefined;
  let htmlSnippetPath: string | undefined;

  // Generate Web App Manifest and HTML snippets if favicons or explicitly requested
  if (options.manifest !== false && (presetKey === 'favicons' || presetKey === 'all')) {
    const appTitle = options.name || path.basename(buildResult.entryPath, path.extname(buildResult.entryPath));
    const shortTitle = options.shortName || appTitle;
    const theme = options.themeColor || (buildResult.canvas as any)?.background || (buildResult.canvas as any)?.fill || '#000000';

    const manifestObj = {
      name: appTitle,
      short_name: shortTitle,
      icons: generatedAssets
        .filter(a => a.filename.endsWith('.png'))
        .map(a => ({
          src: `/${a.filename}`,
          sizes: `${a.width}x${a.height}`,
          type: 'image/png',
          purpose: a.width >= 192 ? 'any maskable' : 'any'
        })),
      theme_color: theme,
      background_color: '#ffffff',
      display: 'standalone'
    };

    manifestPath = path.join(outDir, 'site.webmanifest');
    fs.writeFileSync(manifestPath, JSON.stringify(manifestObj, null, 2), 'utf-8');

    const htmlSnippet = `<!-- Favicon & PWA Tags generated by TOAD Asset Bundler -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${theme}">
`;

    htmlSnippetPath = path.join(outDir, 'favicon-tags.html');
    fs.writeFileSync(htmlSnippetPath, htmlSnippet, 'utf-8');
  }

  return {
    preset: presetKey,
    outDir,
    assets: generatedAssets,
    manifestPath,
    htmlSnippetPath
  };
}
