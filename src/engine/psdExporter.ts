/**
 * src/engine/psdExporter.ts
 * Native layered Photoshop PSD exporter powered by ag-psd and @napi-rs/canvas.
 * Generates layered documents with groups, clipping masks, editable text layers,
 * and raster fallbacks.
 */

import { initializeCanvas, writePsdBuffer, Psd, Layer, ColorMode, LayerVectorMask, BezierKnot, BezierPath, VectorContent, LayerEffectsInfo } from 'ag-psd';
import { createCanvas, Canvas, CanvasRenderingContext2D, loadImage, Image, Path2D } from '@napi-rs/canvas';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LayoutResult, LayoutNode } from '../parser/math.js';
import {
  drawRect,
  drawCircle,
  drawPolygon,
  createCanvasGradient,
  distributeGradientStops,
  mapBlendModeToPsd,
  parseColorToRgba,
  drawImageWithFit
} from './drawUtils.js';
import { FontLoader } from './fontLoader.js';
import { resolveSharedImage, splitUnsafeFilterFns, sanitizeFilterCss } from './imageCache.js';
import { svgPathToBezierPaths, polygonToRoundedSvgPath } from './vectorPathParser.js';
import { resolveHumanLayerName, formatTextLayerName, sanitizeTextSnippet, LayerNamingContext } from '../utils/layerNaming.js';

// Initialize ag-psd with @napi-rs/canvas
let isInitialized = false;
function initPsdCanvas(): void {
  if (!isInitialized) {
    initializeCanvas((width: number, height: number) => {
      return createCanvas(width, height) as unknown as HTMLCanvasElement;
    });
    isInitialized = true;
  }
}

export interface Matrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export const IDENTITY_MATRIX: Matrix2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

export function isMatrixIdentity(m: Matrix2D): boolean {
  return Math.abs(m.a - 1) < 1e-6 &&
         Math.abs(m.b) < 1e-6 &&
         Math.abs(m.c) < 1e-6 &&
         Math.abs(m.d - 1) < 1e-6 &&
         Math.abs(m.tx) < 1e-6 &&
         Math.abs(m.ty) < 1e-6;
}

export function multiplyMatrix(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
    ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty,
  };
}

export function transformPoint(m: Matrix2D, x: number, y: number): { x: number; y: number } {
  return {
    x: m.a * x + m.c * y + m.tx,
    y: m.b * x + m.d * y + m.ty,
  };
}

export function getNodeLocalMatrix(node: LayoutNode): Matrix2D | null {
  if (!node.style) return null;
  const hasTransform = !!(node.style.rotation || node.style.scale !== undefined || node.style.skewX || node.style.skewY);
  if (!hasTransform) return null;

  let originX = node.x + node.width / 2;
  let originY = node.y + node.height / 2;
  if (node.style.transformOrigin) {
    const ox = node.style.transformOrigin.x;
    const oy = node.style.transformOrigin.y;
    if (typeof ox === 'number') originX = node.x + ox;
    else if (typeof ox === 'string' && ox.endsWith('%')) originX = node.x + node.width * (parseFloat(ox) / 100);
    if (typeof oy === 'number') originY = node.y + oy;
    else if (typeof oy === 'string' && oy.endsWith('%')) originY = node.y + node.height * (parseFloat(oy) / 100);
  }

  const rad = node.style.rotation ? (node.style.rotation * Math.PI) / 180 : 0;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  let sx = 1;
  let sy = 1;
  if (node.style.scale !== undefined) {
    sx = typeof node.style.scale === 'number' ? node.style.scale : (node.style.scale.x ?? 1);
    sy = typeof node.style.scale === 'number' ? node.style.scale : (node.style.scale.y ?? 1);
  }

  const kx = node.style.skewX ? Math.tan((node.style.skewX * Math.PI) / 180) : 0;
  const ky = node.style.skewY ? Math.tan((node.style.skewY * Math.PI) / 180) : 0;

  const a = cos * sx - sin * sy * ky;
  const b = sin * sx + cos * sy * ky;
  const c = cos * sx * kx - sin * sy;
  const d = sin * sx * kx + cos * sy;

  const tx = originX - a * originX - c * originY;
  const ty = originY - b * originX - d * originY;

  return { a, b, c, d, tx, ty };
}

/**
 * Converts a CSS gradient angle (0deg = to top, clockwise) into the Photoshop
 * gradient convention ag-psd expects (90deg points up, measured
 * counterclockwise from the +x axis).
 */
export function cssGradientAngleToPhotoshop(css?: number | string): number {
  let cssAngle: number | undefined = undefined;
  if (typeof css === 'number' && Number.isFinite(css)) {
    cssAngle = ((css % 360) + 360) % 360;
  } else if (typeof css === 'string') {
    const dir = css.toLowerCase().trim();
    if (dir === 'to top' || dir === 'to top center') cssAngle = 0;
    else if (dir === 'to right' || dir === 'to right center') cssAngle = 90;
    else if (dir === 'to bottom' || dir === 'to bottom center') cssAngle = 180;
    else if (dir === 'to left' || dir === 'to left center') cssAngle = 270;
    else if (dir.includes('top') && dir.includes('right')) cssAngle = 45;
    else if (dir.includes('bottom') && dir.includes('right')) cssAngle = 135;
    else if (dir.includes('bottom') && dir.includes('left')) cssAngle = 225;
    else if (dir.includes('top') && dir.includes('left')) cssAngle = 315;
  }
  if (cssAngle === undefined) cssAngle = 180; // CSS default direction: to bottom
  return (((90 - cssAngle) % 360) + 360) % 360;
}

export interface PsdExportOptions {
  scale?: number;
  dpi?: number;
  basePath?: string;
  generateThumbnail?: boolean;
  humanizeLayerNames?: boolean;
  docWidth?: number;
  docHeight?: number;
}

export class PsdExporter {
  /**
   * Exports a LayoutResult to a native layered Photoshop PSD buffer.
   */
  public static async export(layout: LayoutResult, options: PsdExportOptions = {}): Promise<Buffer> {
    initPsdCanvas();

    const scale = options.scale && options.scale > 0 ? options.scale : 1;
    const docWidth = Math.max(1, Math.round(layout.canvas.width * scale));
    const docHeight = Math.max(1, Math.round(layout.canvas.height * scale));

    // Register fonts if any
    if (layout.fonts && layout.fonts.length > 0) {
      FontLoader.registerFontDirectives(layout.fonts, options.basePath);
    }

    const psdChildren: Layer[] = [];

    const effectiveDpi = options.dpi ?? 72;

    // 1. Background layer if canvas defines background fill or photo
    if (layout.canvas.background || layout.canvas.photoSrc) {
      const bgCanvas = createCanvas(docWidth, docHeight);
      const bgCtx = bgCanvas.getContext('2d');
      bgCtx.scale(scale, scale);

      const box = { x: 0, y: 0, w: layout.canvas.width, h: layout.canvas.height };
      if (layout.canvas.background) {
        if (typeof layout.canvas.background === 'string') {
          bgCtx.fillStyle = layout.canvas.background;
        } else {
          bgCtx.fillStyle = createCanvasGradient(bgCtx, layout.canvas.background as any, box);
        }
        bgCtx.fillRect(0, 0, layout.canvas.width, layout.canvas.height);
      }
      if (layout.canvas.photoSrc) {
        const bgImg = await this.resolveImage(layout.canvas.photoSrc, options.basePath);
        if (bgImg) {
          drawImageWithFit(bgCtx, bgImg, 'cover', 0, 0, layout.canvas.width, layout.canvas.height);
        }
      }

      let bgVectorData: any = {};
      if (layout.canvas.background) {
        const bgNode: LayoutNode = {
          id: '__canvas_bg__',
          type: 'rect',
          name: 'Background',
          x: 0,
          y: 0,
          width: layout.canvas.width,
          height: layout.canvas.height,
          style: {
            color: typeof layout.canvas.background === 'string' ? layout.canvas.background : '#000000',
            fill: layout.canvas.background
          },
          box
        };
        bgVectorData = this.buildVectorShape(bgNode, scale, docWidth, docHeight, IDENTITY_MATRIX, effectiveDpi);
      }

      const bgLayer: Layer = {
        name: 'Background',
        top: 0,
        left: 0,
        right: docWidth,
        bottom: docHeight,
        opacity: 1,
        blendMode: 'normal',
        canvas: bgCanvas as unknown as HTMLCanvasElement,
        ...(bgVectorData.vectorMask ? { vectorMask: bgVectorData.vectorMask } : {}),
        ...(bgVectorData.vectorFill ? { vectorFill: bgVectorData.vectorFill } : {}),
        ...(bgVectorData.vectorOrigination ? { vectorOrigination: bgVectorData.vectorOrigination } : {}),
      };
      psdChildren.push(bgLayer);
    }

    // 2. Build PSD Layers for Layout Nodes
    const rootNodes = layout.rootNodes || layout.nodes.filter(n => !n.parentId && !n.parent);
    const nodesToRender = rootNodes.length > 0 ? rootNodes : layout.nodes;
    const rootSiblingCounts = new Map<string, number>();
    for (const n of nodesToRender) {
      rootSiblingCounts.set(n.type, (rootSiblingCounts.get(n.type) || 0) + 1);
    }

    let isCurrentRootMaskActive = false;
    for (let i = 0; i < nodesToRender.length; i++) {
      const node = nodesToRender[i]!;
      const isMask = node.style?.clip === true || (node as any).clip === true;
      const rootContext: LayerNamingContext = {
        parentName: layout.canvas.name || 'Canvas',
        parentType: 'canvas',
        siblingIndex: i,
        totalSiblings: nodesToRender.length,
        siblingCountsByType: rootSiblingCounts,
        humanizeLayerNames: options.humanizeLayerNames,
      };
      const docOptions: PsdExportOptions = {
        ...options,
        docWidth,
        docHeight
      };
      const layer = await this.buildPsdLayer(node, scale, options.basePath, effectiveDpi, IDENTITY_MATRIX, rootContext, docOptions);
      if (layer) {
        if (isMask) {
          layer.clipping = false;
          isCurrentRootMaskActive = true;
        } else if (node.style?.clip === false || (node as any).clip === false) {
          isCurrentRootMaskActive = false;
        } else if (isCurrentRootMaskActive) {
          if (!layer.children || layer.children.length === 0) {
            layer.clipping = true;
          }
        }
        psdChildren.push(layer);
      }
    }

    // 3. Construct PSD document with ImageResources (Resolution, Guides & Global Light)
    const imageResources: any = {};

    imageResources.resolutionInfo = {
      horizontalResolution: effectiveDpi,
      horizontalResolutionUnit: 'PPI',
      widthUnit: 'Inches',
      verticalResolution: effectiveDpi,
      verticalResolutionUnit: 'PPI',
      heightUnit: 'Inches'
    };

    if (layout.canvas.guides && layout.canvas.guides.length > 0) {
      imageResources.gridAndGuidesInformation = {
        guides: layout.canvas.guides.map(g => ({
          location: Math.round(g.location * scale),
          direction: g.direction
        }))
      };
    }

    if (layout.canvas.globalLight) {
      imageResources.globalAngle = layout.canvas.globalLight.angle;
      if (layout.canvas.globalLight.altitude !== undefined) {
        imageResources.globalAltitude = layout.canvas.globalLight.altitude;
      }
    }

    const psd: Psd = {
      width: docWidth,
      height: docHeight,
      channels: 3,
      bitsPerChannel: 8,
      colorMode: ColorMode.RGB,
      children: psdChildren,
      ...(Object.keys(imageResources).length > 0 ? { imageResources } : {})
    };

    // 4. Render composite canvas for PSD document preview
    const compositeCanvas = createCanvas(docWidth, docHeight);
    const compCtx = compositeCanvas.getContext('2d');
    compCtx.scale(scale, scale);

    if (layout.canvas.background || layout.canvas.photoSrc) {
      compCtx.save();
      const box = { x: 0, y: 0, w: layout.canvas.width, h: layout.canvas.height };
      if (layout.canvas.background) {
        if (typeof layout.canvas.background === 'string') {
          compCtx.fillStyle = layout.canvas.background;
        } else {
          compCtx.fillStyle = createCanvasGradient(compCtx, layout.canvas.background as any, box);
        }
        compCtx.fillRect(0, 0, layout.canvas.width, layout.canvas.height);
      }
      if (layout.canvas.photoSrc) {
        const bgImg = await this.resolveImage(layout.canvas.photoSrc, options.basePath);
        if (bgImg) {
          drawImageWithFit(compCtx, bgImg, 'cover', 0, 0, layout.canvas.width, layout.canvas.height);
        }
      }
      compCtx.restore();
    }

    const renderNodes = rootNodes.length > 0 ? rootNodes : layout.nodes;
    let rIdx = 0;
    while (rIdx < renderNodes.length) {
      const rootNode = renderNodes[rIdx]!;
      const isMask = rootNode.style?.clip === true || (rootNode as any).clip === true;

      if (isMask) {
        await this.renderNodeToContext(compCtx, rootNode, options.basePath);
        const maskedSiblings: LayoutNode[] = [];
        let j = rIdx + 1;
        while (j < renderNodes.length) {
          const nextChild = renderNodes[j]!;
          if (nextChild.style?.clip === true || (nextChild as any).clip === true) break;
          if (nextChild.style?.clip === false || (nextChild as any).clip === false) break;
          maskedSiblings.push(nextChild);
          j++;
        }

        if (maskedSiblings.length > 0) {
          compCtx.save();
          compCtx.beginPath();
          if (rootNode.type === 'circle') {
            const cx = rootNode.x + rootNode.width / 2;
            const cy = rootNode.y + rootNode.height / 2;
            drawCircle(compCtx, cx, cy, { rx: rootNode.width / 2, ry: rootNode.height / 2 });
          } else if (rootNode.type === 'polygon' && rootNode.polygonLayout?.canvasPoints) {
            drawPolygon(compCtx, rootNode.polygonLayout.canvasPoints);
          } else {
            drawRect(compCtx, rootNode.x, rootNode.y, rootNode.width, rootNode.height, rootNode.style.borderRadius);
          }
          compCtx.clip();

          for (const sibling of maskedSiblings) {
            await this.renderNodeToContext(compCtx, sibling, options.basePath);
          }
          compCtx.restore();
        }
        rIdx = j;
      } else {
        await this.renderNodeToContext(compCtx, rootNode, options.basePath);
        rIdx++;
      }
    }

    psd.canvas = compositeCanvas as unknown as HTMLCanvasElement;

    // 5. Encode PSD buffer
    const isPsb = docWidth > 30000 || docHeight > 30000 || Boolean((psd as any).psb);
    if (isPsb) {
      (psd as any).psb = true;
    }
    const buffer = writePsdBuffer(psd, {
      generateThumbnail: options.generateThumbnail ?? true,
      ...(isPsb ? { psb: true } : {})
    } as any);

    return this.enforcePsdFourBytePadding(buffer);
  }

  /**
   * Adobe Photoshop & Photopea Specification Compliance:
   * Additional Layer Information blocks in standard 32-bit PSD layer records
   * MUST have their data padded to 4-byte boundaries ((len + 3) & ~3).
   * ag-psd by default only applies 2-byte alignment to many keys (e.g. SoCo, luni,
   * vscg, TySh, lsct), and computes section alignment relative to writer.offset
   * rather than the section data itself, causing Photopea to throw "Error in PSD file: wrong signature."
   * when jumping across blocks.
   *
   * This method:
   * 1. Aligns each Additional Layer Info block data to a 4-byte boundary.
   * 2. Updates the 4-byte length header of the ALI block to match the aligned data length,
   *    ensuring both Photopea (which advances by P or P + pad) and ag-psd/Photoshop (which
   *    advance by P) land exactly on the next '8BIM'/'8B64' signature without misaligning.
   * 3. Heals any '?' replacement characters in the legacy 1-byte Pascal string caused by
   *    ag-psd's ASCII clamping when unicode 'luni' is present, substituting clean ASCII
   *    dashes and transliterated characters in-place.
   * 4. Updates all parent section length headers (layer records length, layer info length).
   */
  public static enforcePsdFourBytePadding(buf: Buffer): Buffer {
    if (buf.length < 30 || buf.toString('ascii', 0, 4) !== '8BPS') {
      return buf;
    }

    let offset = 26; // After header
    const colorDataLen = buf.readUInt32BE(offset);
    offset += 4 + colorDataLen;

    const imgResLen = buf.readUInt32BE(offset);
    offset += 4 + imgResLen;

    const lsOffset = offset;
    const lsLen = buf.readUInt32BE(offset);
    offset += 4;

    const liOffset = offset;
    const liLen = buf.readUInt32BE(offset);
    offset += 4;

    const rawCount = buf.readInt16BE(offset);
    const layerCount = Math.abs(rawCount);
    offset += 2;

    if (layerCount === 0 || offset >= buf.length) {
      return buf;
    }

    const newRecords: Buffer[] = [];

    for (let i = 0; i < layerCount; i++) {
      const recStart = offset;
      const channels = buf.readUInt16BE(offset + 16);
      offset += 18 + channels * 6 + 12; // top..right, channels, channel info, blend sig/mode, op/clip/flag/fill
      const fixedPart = buf.subarray(recStart, offset);

      const extraLen = buf.readUInt32BE(offset);
      const extraStart = offset + 4;
      offset += 4;

      const extraFixedStart = offset;
      const maskLen = buf.readUInt32BE(offset);
      offset += 4 + maskLen;
      const blendLen = buf.readUInt32BE(offset);
      offset += 4 + blendLen;
      const nameLen = buf.readUInt8(offset);
      let pLen = 1 + nameLen;
      while (pLen % 4 !== 0) pLen++;
      offset += pLen;
      const extraFixed = Buffer.from(buf.subarray(extraFixedStart, offset));
      const nameOffsetInExtra = 4 + maskLen + 4 + blendLen;

      const newAlis: Buffer[] = [];
      let extraAlisLength = 0;
      let unicodeName = '';

      while (offset < extraStart + extraLen) {
        const aliSig = buf.subarray(offset, offset + 4);
        const aliKeyStr = buf.subarray(offset + 4, offset + 8).toString('ascii');
        const aliKey = buf.subarray(offset + 4, offset + 8);
        const aliLen = buf.readUInt32BE(offset + 8);
        const aliData = buf.subarray(offset + 12, offset + 12 + aliLen);

        if (aliKeyStr === 'luni' && aliLen >= 4) {
          const charCount = aliData.readUInt32BE(0);
          let str = '';
          for (let c = 0; c < charCount; c++) {
            str += String.fromCharCode(aliData.readUInt16BE(4 + c * 2));
          }
          unicodeName = str;
        }

        // Round length up to 4-byte boundary:
        const pad = (4 - (aliLen % 4)) % 4;
        const alignedLen = aliLen + pad;
        const totalBlockLen = 12 + alignedLen;

        const aliBlock = Buffer.alloc(totalBlockLen);
        aliSig.copy(aliBlock, 0);
        aliKey.copy(aliBlock, 4);
        // Both Photopea (which aligns to 4-byte boundaries) and ag-psd (which reads 2-byte aligned
        // lengths) require alignedLen in the header so neither reader desynchronizes signatures.
        aliBlock.writeUInt32BE(alignedLen, 8);
        aliData.copy(aliBlock, 12);
        // remaining pad bytes are initialized to 0 by Buffer.alloc

        newAlis.push(aliBlock);
        extraAlisLength += totalBlockLen;

        // In ag-psd, next block starts with '8BIM' or '8B64'.
        // Scan forward from offset + 12 + aliLen to find the next signature and avoid drifting.
        let nextOffset = offset + 12 + aliLen;
        while (nextOffset <= extraStart + extraLen - 4) {
          const sig = buf.subarray(nextOffset, nextOffset + 4).toString('ascii');
          if (sig === '8BIM' || sig === '8B64') {
            break;
          }
          nextOffset++;
        }
        if (nextOffset > extraStart + extraLen - 4) {
          nextOffset = extraStart + extraLen;
        }
        offset = nextOffset;
      }

      // If unicodeName is available, heal any '?' replacement characters in the legacy Pascal string
      if (unicodeName && nameLen > 0) {
        const uChars = Array.from(unicodeName);
        const nameBytes = extraFixed.subarray(nameOffsetInExtra + 1, nameOffsetInExtra + 1 + nameLen);
        for (let j = 0; j < nameBytes.length; j++) {
          if (nameBytes[j] === 0x3F) { // '?'
            const uChar = uChars[j] || '';
            if (uChar === '·' || uChar === '•' || uChar === '–' || uChar === '—') {
              nameBytes[j] = 0x2D; // '-'
            } else if (uChar === 'ä') {
              nameBytes[j] = 0x61; // 'a'
            } else if (uChar === 'Ä') {
              nameBytes[j] = 0x41; // 'A'
            } else if (uChar === 'ö') {
              nameBytes[j] = 0x6F; // 'o'
            } else if (uChar === 'Ö') {
              nameBytes[j] = 0x4F; // 'O'
            } else if (uChar === 'ü') {
              nameBytes[j] = 0x75; // 'u'
            } else if (uChar === 'Ü') {
              nameBytes[j] = 0x55; // 'U'
            } else if (uChar === 'ß') {
              nameBytes[j] = 0x73; // 's'
            } else if (uChar.codePointAt(0) && uChar.codePointAt(0)! > 127) {
              nameBytes[j] = 0x2D; // '-'
            }
          }
        }
      }

      const newExtraLen = extraFixed.length + extraAlisLength;
      const extraLenBuf = Buffer.alloc(4);
      extraLenBuf.writeUInt32BE(newExtraLen, 0);

      newRecords.push(fixedPart, extraLenBuf, extraFixed, ...newAlis);
    }

    const origRecordsLen = offset - (liOffset + 6);
    const repackedRecords = Buffer.concat(newRecords);
    const delta = repackedRecords.length - origRecordsLen;
    const remainder = buf.subarray(offset);

    const newLsLen = lsLen + delta;
    const newLiLen = liLen + delta;

    const prefix = buf.subarray(0, lsOffset);
    const headersBuf = Buffer.alloc(10);
    headersBuf.writeUInt32BE(newLsLen, 0);
    headersBuf.writeUInt32BE(newLiLen, 4);
    headersBuf.writeInt16BE(rawCount, 8);

    return Buffer.concat([prefix, headersBuf, repackedRecords, remainder]);
  }

  /**
   * Converts a single LayoutNode into an ag-psd Layer structure.
   */
  private static async buildPsdLayer(
    node: LayoutNode,
    scale: number,
    basePath?: string,
    dpi = 72,
    parentMatrix: Matrix2D = IDENTITY_MATRIX,
    context?: LayerNamingContext,
    options?: PsdExportOptions,
    parentNode?: LayoutNode
  ): Promise<Layer | null> {
    const layer = await this.buildPsdLayerInternal(node, scale, basePath, dpi, parentMatrix, context, options, parentNode);
    if (!layer || !node.maskNode) return layer;

    // Create a clipping mask group
    // In Photoshop, a clipping mask needs a base layer and a clipped layer.
    const maskLayer = await this.buildPsdLayerInternal(node.maskNode, scale, basePath, dpi, parentMatrix, context, options, parentNode);
    if (!maskLayer) return layer;
    
    maskLayer.clipping = false; // Base mask layer
    layer.clipping = true; // Clipped layer
    
    return {
      name: `Mask Group (${layer.name})`,
      opened: true,
      children: [maskLayer, layer]
    };
  }

  private static async buildPsdLayerInternal(
    node: LayoutNode,
    scale: number,
    basePath?: string,
    dpi = 72,
    parentMatrix: Matrix2D = IDENTITY_MATRIX,
    context?: LayerNamingContext,
    options?: PsdExportOptions,
    parentNode?: LayoutNode
  ): Promise<Layer | null> {
    const localMat = getNodeLocalMatrix(node);
    const currentMat = localMat ? multiplyMatrix(parentMatrix, localMat) : parentMatrix;
    const isIdentity = isMatrixIdentity(currentMat);

    let left: number;
    let top: number;
    let right: number;
    let bottom: number;
    let width: number;
    let height: number;

    if (isIdentity) {
      left = Math.round(node.x * scale);
      top = Math.round(node.y * scale);
      width = Math.max(1, Math.round(node.width * scale));
      height = Math.max(1, Math.round(node.height * scale));
      right = left + width;
      bottom = top + height;
    } else {
      const corners = [
        transformPoint(currentMat, node.x, node.y),
        transformPoint(currentMat, node.x + node.width, node.y),
        transformPoint(currentMat, node.x + node.width, node.y + node.height),
        transformPoint(currentMat, node.x, node.y + node.height),
      ];
      const minX = Math.min(...corners.map(c => c.x));
      const maxX = Math.max(...corners.map(c => c.x));
      const minY = Math.min(...corners.map(c => c.y));
      const maxY = Math.max(...corners.map(c => c.y));
      left = Math.round(minX * scale);
      top = Math.round(minY * scale);
      right = Math.round(maxX * scale);
      bottom = Math.round(maxY * scale);
      width = Math.max(1, right - left);
      height = Math.max(1, bottom - top);
      if (right <= left) right = left + width;
      if (bottom <= top) bottom = top + height;
    }

    if (!node.style) {
      (node as any).style = {};
    }

    const layerName = resolveHumanLayerName(node, {
      ...context,
      humanizeLayerNames: options?.humanizeLayerNames,
    });
    const opacity = node.opacity ?? 1;
    const blendMode = mapBlendModeToPsd(node.style?.blendMode);

    // Photoshop Layer Metadata: layerColor, lock, fillOpacity, knockout
    const mapLayerColorToPsd = (col?: string): 'none' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'gray' | undefined => {
      if (!col) return undefined;
      const c = col.toLowerCase();
      const valid = ['none', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'gray'];
      if (valid.includes(c)) return c as any;
      if (c.startsWith('#')) {
        const hex = c.replace('#', '');
        const r = parseInt(hex.length >= 6 ? hex.slice(0, 2) : hex[0]! + hex[0]!, 16) || 0;
        const g = parseInt(hex.length >= 6 ? hex.slice(2, 4) : hex[1]! + hex[1]!, 16) || 0;
        const b = parseInt(hex.length >= 6 ? hex.slice(4, 6) : hex[2]! + hex[2]!, 16) || 0;
        if (r > 180 && g < 100 && b < 100) return 'red';
        if (r > 180 && g >= 100 && g < 180 && b < 100) return 'orange';
        if (r > 180 && g > 180 && b < 100) return 'yellow';
        if (g > 150 && r < 120 && b < 120) return 'green';
        if (b > 150 && r < 120 && g < 120) return 'blue';
        if (r > 130 && b > 130 && g < 120) return 'violet';
        return 'gray';
      }
      return undefined;
    };
    const layerColor = mapLayerColorToPsd(node.style.layerColor || (node as any).layerColor);
    const hasRealFill = Boolean(node.style.fill || node.fill) &&
      node.style.fill !== 'transparent' && node.fill !== 'transparent' &&
      node.style.fill !== 'none' && node.fill !== 'none';
    const hasStroke = Boolean(node.style.stroke || node.stroke);

    let fillOpacity = typeof node.style.fillOpacity === 'number' ? node.style.fillOpacity : (node as any).fillOpacity;
    if (fillOpacity === undefined) {
      const fillVal = node.style.fill || node.fill;
      if (typeof fillVal === 'string') {
        const rgba = parseColorToRgba(fillVal);
        if (rgba.a < 1) {
          // If shape has stroke but transparent fill, don't set fillOpacity to 0 to prevent hiding stroke
          if (!(hasStroke && rgba.a === 0)) {
            fillOpacity = Number(rgba.a.toFixed(3));
          }
        }
      }
    }
    const knockout = node.style.knockout ?? (node as any).knockout;
    const lockVal = node.style.lock || (node as any).lock;
    const protectedFlags = lockVal ? {
      composite: lockVal === 'all',
      position: lockVal === 'all' || lockVal === 'position',
      transparency: lockVal === 'all' || lockVal === 'transparency'
    } : undefined;

    // Group / Grid / Stack Container
    if (node.type === 'group' || node.type === 'grid' || node.type === 'stack') {
      const childLayers: Layer[] = [];
      if (node.children && node.children.length > 0) {
        let isCurrentMaskActive = false;

        const childCountsByType = new Map<string, number>();
        for (const child of node.children) {
          childCountsByType.set(child.type, (childCountsByType.get(child.type) || 0) + 1);
        }

        for (let i = 0; i < node.children.length; i++) {
          const childNode = node.children[i]!;
          const isMask = childNode.style?.clip === true || (childNode as any).clip === true;
          const childContext: LayerNamingContext = {
            parentName: layerName,
            parentType: node.type,
            siblingIndex: i,
            totalSiblings: node.children.length,
            siblingCountsByType: childCountsByType,
            humanizeLayerNames: options?.humanizeLayerNames,
          };
          const childLayer = await this.buildPsdLayer(childNode, scale, basePath, dpi, currentMat, childContext, options, node);
          if (childLayer) {
            // Apply Photoshop clipping mask hierarchy
            if (isMask) {
              childLayer.clipping = false; // Base mask layer
              isCurrentMaskActive = true;
            } else if (childNode.style?.clip === false || (childNode as any).clip === false) {
              isCurrentMaskActive = false;
            } else if (isCurrentMaskActive) {
              if (!childLayer.children || childLayer.children.length === 0) {
                childLayer.clipping = true;  // Clipped to base mask layer
              }
            }
            childLayers.push(childLayer);
          }
        }
      }

      // If container defines fill/stroke background, add a background rect layer inside the group
      if (node.style.fill || node.style.stroke) {
        const bgNode: LayoutNode = {
          ...node,
          type: 'rect',
          name: `${layerName} Background`,
          children: undefined
        };
        const bgLayer = await this.buildPsdLayerInternal(bgNode, scale, basePath, dpi, currentMat, context, options, node);
        if (bgLayer) {
          childLayers.unshift(bgLayer);
        }
      }

      // If container has borderRadius or clip, assign native Photoshop vectorMask
      let groupVectorMask: LayerVectorMask | undefined;
      const groupHasMask = node.style.clip === true || (node as any).clip === true || node.style.borderRadius !== undefined || (node as any).radius !== undefined;
      if (groupHasMask) {
        const docW = options?.docWidth ?? width;
        const docH = options?.docHeight ?? height;
        const groupVectorData = this.buildVectorShape(node, scale, docW, docH, currentMat, dpi);
        groupVectorMask = groupVectorData.vectorMask;
      }

      const groupLayer: Layer = {
        name: layerName,
        opened: true,
        opacity,
        blendMode,
        children: childLayers,
        ...(groupVectorMask ? { vectorMask: groupVectorMask } : {}),
        ...(layerColor ? { layerColor: layerColor as any } : {}),
        ...(protectedFlags ? { protected: protectedFlags } : {}),
        ...(knockout !== undefined ? { knockout: !!knockout } : {})
      };

      return groupLayer;
    }

    // Text Element: Native Editable Photoshop Text Layer + Raster Fallback
    if (node.type === 'text') {
      const textContent = node.textLayout ? node.textLayout.lines.join('\n') : ((node as any).content || node.name || 'Text');
      const baseFontSize = node.textLayout?.fontSize || 16;
      const fontSizePx = baseFontSize * scale;
      // Photoshop Type Tool font size and leading are measured in points (1 pt = 1/72 inch).
      // Converting through 72 / dpi ensures exact pixel parity when edited in Photoshop or Photopea.
      const fontSizePt = Number(((fontSizePx * 72) / dpi).toFixed(2));
      const ptFactor = 72 / dpi;
      const fillColorStr = typeof node.fill === 'string' ? node.fill : node.style.fill && typeof node.style.fill === 'string' ? node.style.fill : node.style.color || '#000000';
      const rgba = parseColorToRgba(fillColorStr);
      const fontFamily = node.textLayout?.fontFamily || 'Arial';
      const fontWeight = node.textLayout?.fontWeight || 'normal';
      const fontStyle = node.textLayout?.fontStyle || 'normal';
      const postScriptFontName = this.mapFontFamilyToPostScript(fontFamily, fontWeight, fontStyle);
      // leading must live in the SCALED coordinate space of the layer in points.
      const baseLineHeight = node.textLayout?.lineHeight || (node.textLayout?.fontSize || 16) * 1.25;
      const lineHeightPx = baseLineHeight * scale;
      const lineHeightPt = Number(((lineHeightPx * 72) / dpi).toFixed(2));
      const hasExplicitLs = node.style.letterSpacing !== undefined || (node as any).letterSpacingPx !== undefined;
      const lsRaw = typeof node.style.letterSpacing === 'number'
        ? node.style.letterSpacing
        : typeof (node as any).letterSpacingPx === 'number'
          ? (node as any).letterSpacingPx
          : 0;
      const tracking = hasExplicitLs && baseFontSize > 0 && typeof lsRaw === 'number'
        ? Math.round((lsRaw / baseFontSize) * 1000)
        : undefined;
      const numericWeight = typeof fontWeight === 'number' ? fontWeight
        : /^[0-9]+$/.test(String(fontWeight)) ? parseInt(String(fontWeight), 10) : null;
      const isBold = fontWeight === 'bold' || fontWeight === 'bolder' || (numericWeight !== null && numericWeight >= 600);
      const isItalic = fontStyle === 'italic' || fontStyle === 'oblique';
      // Only set fauxBold if the font doesn't already have a dedicated bold PostScript cut
      const fauxBold = isBold && !/bold|black|heavy|extrabold|ultrabold|semibold/i.test(postScriptFontName);
      const fauxItalic = isItalic && !/italic|oblique/i.test(postScriptFontName);

      const textCanvas = await this.renderNodeToIsolatedCanvasAsync(
        node,
        scale,
        width,
        height,
        basePath,
        currentMat,
        left,
        top
      );

      const isExplicitLeft =
        node.style.align === 'left' ||
        (node as any).alignment === 'left' ||
        (node.style as any).textAlign === 'left';

      const isExplicitCenter =
        node.style.align === 'center' ||
        (node as any).alignment === 'center' ||
        (node.style as any).textAlign === 'center';

      const isStackCenter = Boolean(
        parentNode && (parentNode.type === 'stack' || parentNode.type === 'group' || parentNode.type === 'grid') && (
          (((parentNode.style as any)?.direction === 'vertical' || (parentNode as any).direction === 'vertical') &&
           ((parentNode.style as any)?.align === 'center' || (parentNode as any).align === 'center')) ||
          (((parentNode.style as any)?.direction === 'horizontal' || (parentNode as any).direction === 'horizontal') &&
           ((parentNode.style as any)?.justify === 'center' || (parentNode as any).justify === 'center'))
        )
      );

      const isGeometryCenter = Boolean(
        !isExplicitLeft &&
        parentNode && parentNode.width > 0 &&
        (parentNode.width - node.width) > 8 &&
        Math.abs((node.x + node.width / 2) - (parentNode.x + parentNode.width / 2)) < 3
      );

      const isCentered = isExplicitCenter || (!isExplicitLeft && (isStackCenter || isGeometryCenter));

      const isExplicitRight =
        node.style.align === 'right' ||
        (node as any).alignment === 'right' ||
        (node.style as any).textAlign === 'right';

      const isStackRight = Boolean(
        parentNode && (parentNode.type === 'stack' || parentNode.type === 'group' || parentNode.type === 'grid') && (
          ((parentNode.style as any)?.direction === 'vertical' || (parentNode as any).direction === 'vertical') &&
          ((parentNode.style as any)?.align === 'end' || (parentNode.style as any)?.align === 'right')
        )
      );

      const isRight = isExplicitRight || (!isExplicitLeft && isStackRight);

      let justification: any = 'left';
      if (isCentered) justification = 'center';
      else if (isRight) justification = 'right';
      else if (node.style.align === 'justify') justification = 'justify-left';

      // Insertion anchor point in unscaled node space
      let anchorX = node.x;
      if (justification === 'center') {
        anchorX = node.x + node.width / 2;
      } else if (justification === 'right') {
        anchorX = node.x + node.width;
      }
      const opticalOffset = node.textLayout?.opticalCenterOffset ?? 0;
      const lineCount = node.textLayout?.lines?.length || 1;
      const isMiddle = node.style.verticalAlign === 'middle';
      let baselineY: number;
      if (isMiddle) {
        baselineY = node.y + (node.height - (lineCount - 1) * baseLineHeight) / 2 + opticalOffset;
      } else {
        const valignShift = node.style.verticalAlign === 'bottom'
          ? Math.max(0, node.height - (node.textLayout?.height ?? 0))
          : 0;
        baselineY = node.y + valignShift + (node.textLayout?.ascent || baseFontSize);
      }

      const transformedAnchor = transformPoint(currentMat, anchorX, baselineY);
      const tx = transformedAnchor.x * scale;
      const ty = transformedAnchor.y * scale;

      const textTransform = [
        currentMat.a,
        currentMat.b,
        currentMat.c,
        currentMat.d,
        tx,
        ty
      ];

      const effects = this.buildLayerEffects(node, scale);

      const hasExplicitName = Boolean(
        node.name &&
        node.name.trim() !== '' &&
        node.name !== node.id &&
        node.name !== node.type &&
        !node.name.startsWith('__auto_') &&
        !node.name.startsWith('inst')
      );

      let textLayerName = layerName;
      if (options?.humanizeLayerNames === true) {
        if (hasExplicitName) {
          textLayerName = node.name.trim();
        } else if (textContent) {
          const snippet = sanitizeTextSnippet(textContent, 30);
          textLayerName = formatTextLayerName(snippet);
        }
      } else if (textContent) {
        textLayerName = textContent.slice(0, 30) || layerName;
      }

      const isMultiLine = Boolean((node.textLayout && node.textLayout.lines && node.textLayout.lines.length > 1) || textContent.includes('\n'));
      const hasWrapWidth = typeof (node.style as any).wrapWidth === 'number' || typeof (node.style as any)['wrap-width'] === 'number';
      const isBoxText = Boolean((isMultiLine || hasWrapWidth || (node.textLayout && (node.textLayout as any).isWrapped)) && width > 0 && height > 0);
      const widthPt = Number(((width * 72) / dpi).toFixed(2));
      const heightPt = Number(((height * 72) / dpi).toFixed(2));

      const textLayer: Layer = {
        name: textLayerName,
        top,
        left,
        right,
        bottom,
        opacity,
        blendMode,
        clipping: node.style.clip === true || (node as any).clip === true ? false : undefined,
        ...(effects ? { effects } : {}),
        text: {
          text: textContent,
          transform: textTransform,
          top,
          left,
          bottom,
          right,
          antiAlias: 'smooth',
          ...(isBoxText ? {
            shapeType: 'box',
            boxBounds: [0, 0, widthPt, heightPt]
          } : {
            shapeType: 'point',
            pointBase: [0, 0]
          }),
          style: {
            font: { name: postScriptFontName },
            fontSize: fontSizePt,
            fillColor: rgba.a < 1
              ? { r: Math.round(rgba.r), g: Math.round(rgba.g), b: Math.round(rgba.b), a: Math.round(rgba.a * 255) }
              : { r: Math.round(rgba.r), g: Math.round(rgba.g), b: Math.round(rgba.b) },
            leading: lineHeightPt,
            ...(tracking !== undefined ? { tracking } : {}),
            ...(fauxBold ? { fauxBold: true } : {}),
            ...(fauxItalic ? { fauxItalic: true } : {}),
            ...(node.style.textTransform === 'uppercase' ? { fontCaps: 2 } : {}),
            ...((node.style.textTransform as string) === 'lowercase' || (node.style.textTransform as string) === 'small-caps' ? { fontCaps: 1 } : {}),
            ...((node.style as any).baselineShift ? { baselineShift: (node.style as any).baselineShift * scale * ptFactor } : {}),
            ...((node.style as any).strikethrough ? { strikethrough: true } : {}),
            ...((node.style as any).underline ? { underline: true } : {}),
            ...((node.style as any).ligatures !== undefined ? { ligatures: !!(node.style as any).ligatures } : {}),
            ...((node.style as any).dLigatures !== undefined ? { dLigatures: !!(node.style as any).dLigatures } : {})
          },
          paragraphStyle: {
            justification,
            ...((node.style as any).spaceBefore ? { spaceBefore: (node.style as any).spaceBefore * scale * ptFactor } : {}),
            ...((node.style as any).spaceAfter ? { spaceAfter: (node.style as any).spaceAfter * scale * ptFactor } : {}),
            ...((node.style as any).firstLineIndent ? { firstLineIndent: (node.style as any).firstLineIndent * scale * ptFactor } : {}),
            ...((node.style as any).autoHyphenate !== undefined ? { autoHyphenate: !!(node.style as any).autoHyphenate } : {})
          }
        },
        canvas: textCanvas as unknown as HTMLCanvasElement,
        ...(layerColor ? { layerColor: layerColor as any } : {}),
        ...(protectedFlags ? { protected: protectedFlags } : {}),
        ...(knockout !== undefined ? { knockout: !!knockout } : {})
      };

      if (node.filters && node.filters.length > 0) {
        const filterLayers = await this.buildFilterLayers(node.filters, node, scale, width, height, basePath, currentMat, left, top);
        return {
          name: layerName,
          opened: true,
          opacity,
          blendMode,
          clipping: node.style.clip === true || (node as any).clip === true ? false : undefined,
          children: [textLayer, ...filterLayers]
        };
      }

      return textLayer;
    }

    // Shapes & Images: Isolated Raster Canvas Layer + Native Vector Shape Data
    const hasFilters = node.filters && node.filters.length > 0;
    const cleanNode = hasFilters
      ? { ...node, style: { ...node.style, filter: undefined }, filters: undefined }
      : node;

    const layerCanvas = await this.renderNodeToIsolatedCanvasAsync(
      cleanNode,
      scale,
      width,
      height,
      basePath,
      currentMat,
      left,
      top
    );
    const docW = options?.docWidth ?? width;
    const docH = options?.docHeight ?? height;
    const vectorData = this.buildVectorShape(cleanNode, scale, docW, docH, currentMat, dpi);
    const effects = this.buildLayerEffects(cleanNode, scale);

    const baseLayer: Layer = {
      name: hasFilters ? `${layerName} (Base)` : layerName,
      top,
      left,
      right,
      bottom,
      opacity,
      blendMode,
      clipping: node.style.clip === true || (node as any).clip === true ? false : undefined,
      canvas: layerCanvas as unknown as HTMLCanvasElement,
      ...(effects ? { effects } : {}),
      ...(vectorData.vectorMask ? { vectorMask: vectorData.vectorMask } : {}),
      ...(vectorData.vectorFill ? { vectorFill: vectorData.vectorFill } : {}),
      ...(vectorData.vectorStroke ? { vectorStroke: vectorData.vectorStroke } : {}),
      ...(vectorData.vectorOrigination ? { vectorOrigination: vectorData.vectorOrigination } : {}),
      ...(fillOpacity !== undefined ? { fillOpacity } : {}),
      ...(layerColor ? { layerColor: layerColor as any } : {}),
      ...(protectedFlags ? { protected: protectedFlags } : {}),
      ...(knockout !== undefined ? { knockout: !!knockout } : {})
    };

    if (hasFilters) {
      const filterLayers = await this.buildFilterLayers(node.filters!, cleanNode, scale, width, height, basePath, currentMat, left, top);
      return {
        name: layerName,
        opened: true,
        opacity,
        blendMode,
        clipping: node.style.clip === true || (node as any).clip === true ? false : undefined,
        children: [baseLayer, ...filterLayers]
      };
    }

    return baseLayer;
  }

  /**
   * Builds separate effect and adjustment layers for each filter in a CSS filter chain.
   */
  private static async buildFilterLayers(
    filters: Array<{ type: string; value: number | string }>,
    cleanNode: LayoutNode,
    scale: number,
    widthPx: number,
    heightPx: number,
    basePath?: string,
    matrix: Matrix2D = IDENTITY_MATRIX,
    layerLeftDoc = 0,
    layerTopDoc = 0
  ): Promise<Layer[]> {
    const layers: Layer[] = [];

    for (const f of filters) {
      const type = f.type.toLowerCase();
      const rawVal = f.value;

      if (type === 'blur') {
        const radiusPx = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 0;
        const blurCanvas = await this.renderFilteredCanvasAsync(
          cleanNode,
          `blur(${radiusPx * scale}px)`,
          scale,
          widthPx,
          heightPx,
          basePath,
          matrix,
          layerLeftDoc,
          layerTopDoc
        );
        layers.push({
          name: `[FX] Blur (${rawVal})`,
          top: layerTopDoc,
          left: layerLeftDoc,
          right: layerLeftDoc + widthPx,
          bottom: layerTopDoc + heightPx,
          clipping: true,
          canvas: blurCanvas as unknown as HTMLCanvasElement
        });
      } else if (type === 'brightness') {
        const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 1;
        const brightnessPct = Math.max(-100, Math.min(100, Math.round((num - 1) * 100)));
        layers.push({
          name: `[Adjustment] Brightness (${num > 1 ? '+' : ''}${brightnessPct}%)`,
          clipping: true,
          adjustment: {
            type: 'brightness/contrast',
            brightness: brightnessPct,
            contrast: 0,
            meanValue: 128,
            useLegacy: false
          }
        });
      } else if (type === 'contrast') {
        const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 1;
        const contrastPct = Math.max(-100, Math.min(100, Math.round((num - 1) * 100)));
        layers.push({
          name: `[Adjustment] Contrast (${num > 1 ? '+' : ''}${contrastPct}%)`,
          clipping: true,
          adjustment: {
            type: 'brightness/contrast',
            brightness: 0,
            contrast: contrastPct,
            meanValue: 128,
            useLegacy: false
          }
        });
      } else if (type === 'saturate') {
        const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 1;
        const satPct = Math.max(-100, Math.min(100, Math.round((num - 1) * 100)));
        layers.push({
          name: `[Adjustment] Saturation (${num > 1 ? '+' : ''}${satPct}%)`,
          clipping: true,
          adjustment: {
            type: 'hue/saturation',
            master: { a: 0, b: 0, c: 0, d: 0, hue: 0, saturation: satPct, lightness: 0 }
          }
        });
      } else if (type === 'hue-rotate') {
        const deg = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 0;
        layers.push({
          name: `[Adjustment] Hue-Rotate (${deg}°)`,
          clipping: true,
          adjustment: {
            type: 'hue/saturation',
            master: { a: 0, b: 0, c: 0, d: 0, hue: Math.round(deg), saturation: 0, lightness: 0 }
          }
        });
      } else if (type === 'grayscale') {
        layers.push({
          name: `[Adjustment] Black & White`,
          clipping: true,
          adjustment: {
            type: 'black & white',
            reds: 40,
            yellows: 60,
            greens: 40,
            cyans: 60,
            blues: 20,
            magentas: 80
          }
        });
      } else if (type === 'invert') {
        layers.push({
          name: `[Adjustment] Invert`,
          clipping: true,
          adjustment: {
            type: 'invert'
          }
        });
      } else if (type === 'sepia') {
        layers.push({
          name: `[Adjustment] Sepia Filter`,
          clipping: true,
          adjustment: {
            type: 'photo filter',
            color: { r: 180, g: 120, b: 60 },
            density: 80,
            preserveLuminosity: true
          }
        });
      }
    }

    return layers;
  }

  /**
   * Renders a node to an isolated canvas with a specific CSS filter applied.
   */
  private static async renderFilteredCanvasAsync(
    node: LayoutNode,
    filterCss: string,
    scale: number,
    widthPx: number,
    heightPx: number,
    basePath?: string,
    matrix: Matrix2D = IDENTITY_MATRIX,
    layerLeftDoc = 0,
    layerTopDoc = 0
  ): Promise<any> {
    const canvas = createCanvas(widthPx, heightPx);
    const ctx = canvas.getContext('2d');
    // Skia aborts on drop-shadow()/opacity() inside ctx.filter — split them
    // out and apply what remains. The extracted shadow is stamped through
    // ctx.shadow* (honored on vector fills) instead of crashing.
    const split = splitUnsafeFilterFns(filterCss);
    try {
      ctx.filter = split.safeCss && split.safeCss !== 'none' ? sanitizeFilterCss(split.safeCss) : 'none';
    } catch { /* backend without filter support */ }
    if (split.shadow) {
      ctx.shadowColor = split.shadow.color;
      ctx.shadowBlur = split.shadow.blur * scale;
      ctx.shadowOffsetX = split.shadow.offsetX * scale;
      ctx.shadowOffsetY = split.shadow.offsetY * scale;
    }
    ctx.globalAlpha *= split.opacityFactor;

    if (isMatrixIdentity(matrix)) {
      ctx.scale(scale, scale);
      ctx.translate(-node.x, -node.y);
      await this.renderNodeToContext(ctx, node, basePath);
    } else {
      ctx.translate(-layerLeftDoc, -layerTopDoc);
      ctx.scale(scale, scale);
      ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty);
      await this.renderNodeToContext(ctx, node, basePath, true);
    }
    return canvas;
  }

  private static async renderNodeToIsolatedCanvasAsync(
    node: LayoutNode,
    scale: number,
    widthPx: number,
    heightPx: number,
    basePath?: string,
    matrix: Matrix2D = IDENTITY_MATRIX,
    layerLeftDoc = 0,
    layerTopDoc = 0
  ): Promise<HTMLCanvasElement> {
    const canvas = createCanvas(widthPx, heightPx);
    const ctx = canvas.getContext('2d');
    if (isMatrixIdentity(matrix)) {
      ctx.scale(scale, scale);
      ctx.translate(-node.x, -node.y);
      await this.renderNodeToContext(ctx, node, basePath);
    } else {
      ctx.translate(-layerLeftDoc, -layerTopDoc);
      ctx.scale(scale, scale);
      ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty);
      await this.renderNodeToContext(ctx, node, basePath, true);
    }
    return canvas as unknown as HTMLCanvasElement;
  }

  private static async renderNodeToContext(
    ctx: CanvasRenderingContext2D,
    node: LayoutNode,
    basePath?: string,
    skipLocalTransform = false
  ): Promise<void> {
    ctx.save();

    if (typeof node.opacity === 'number' && node.opacity < 1) {
      ctx.globalAlpha *= node.opacity;
    }

    if (!node.style) {
      (node as any).style = {};
    }

    // 4. 2D Transforms
    const hasTransform = !skipLocalTransform && (node.style.rotation || node.style.scale !== undefined || node.style.skewX || node.style.skewY);
    if (hasTransform) {
      let originX = node.x + node.width / 2;
      let originY = node.y + node.height / 2;
      
      if (node.style.transformOrigin) {
        const ox = node.style.transformOrigin.x;
        const oy = node.style.transformOrigin.y;
        if (typeof ox === 'number') originX = node.x + ox;
        else if (typeof ox === 'string' && ox.endsWith('%')) originX = node.x + node.width * (parseFloat(ox) / 100);
        
        if (typeof oy === 'number') originY = node.y + oy;
        else if (typeof oy === 'string' && oy.endsWith('%')) originY = node.y + node.height * (parseFloat(oy) / 100);
      }

      ctx.translate(originX, originY);
      if (node.style.rotation) {
        ctx.rotate((node.style.rotation * Math.PI) / 180);
      }
      if (node.style.scale !== undefined) {
        const sx = typeof node.style.scale === 'number' ? node.style.scale : (node.style.scale.x ?? 1);
        const sy = typeof node.style.scale === 'number' ? node.style.scale : (node.style.scale.y ?? 1);
        ctx.scale(sx, sy);
      }
      if (node.style.skewX || node.style.skewY) {
        const kx = node.style.skewX ? Math.tan((node.style.skewX * Math.PI) / 180) : 0;
        const ky = node.style.skewY ? Math.tan((node.style.skewY * Math.PI) / 180) : 0;
        ctx.transform(1, ky, kx, 1, 0, 0);
      }
      ctx.translate(-originX, -originY);
    }

    switch (node.type) {
      case 'rect': {
        drawRect(ctx, node.x, node.y, node.width, node.height, node.style.borderRadius);
        this.applyFillAndStroke(ctx, node);
        break;
      }
      case 'circle': {
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        drawCircle(ctx, cx, cy, { rx: node.width / 2, ry: node.height / 2 });
        this.applyFillAndStroke(ctx, node);
        break;
      }
      case 'polygon': {
        if (node.polygonLayout?.canvasPoints) {
          drawPolygon(ctx, node.polygonLayout.canvasPoints, node.style.borderRadius);
          this.applyFillAndStroke(ctx, node);
        }
        break;
      }
      case 'path':
      case 'shape':
      case 'icon':
      case 'star':
      case 'triangle':
      case 'arrow':
      case 'cross':
      case 'barcode':
      case 'qrcode': {
        const d = node.pathLayout?.d;
        if (d) {
          const pathObj = new Path2D(d);
          ctx.save();
          ctx.translate(node.x, node.y);
          if (node.type === 'icon') {
            ctx.scale(node.width / 24, node.height / 24);
          }
          const fill = node.style.fill || node.fill || (node.type === 'barcode' || node.type === 'qrcode' ? '#000000' : undefined);
          if (fill) {
            if (typeof fill === 'string') {
              ctx.fillStyle = fill;
            } else {
              const localBox = { x: 0, y: 0, w: node.width, h: node.height };
              ctx.fillStyle = createCanvasGradient(ctx, fill as any, localBox);
            }
            ctx.fill(pathObj);
          }
          const stroke = node.style.stroke || node.stroke;
          if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = node.style.strokeWidth ?? 1;
            if (node.style.strokeCap) ctx.lineCap = node.style.strokeCap;
            if (node.style.strokeJoin) ctx.lineJoin = node.style.strokeJoin;
            if (node.style.strokeStyle === 'dashed') ctx.setLineDash([6, 6]);
            else if (node.style.strokeStyle === 'dotted') ctx.setLineDash([2, 2]);
            else ctx.setLineDash([]);
            ctx.stroke(pathObj);
          }
          ctx.restore();

          if (node.type === 'barcode' && node.barcodeLayout?.showText && node.barcodeLayout.text) {
            ctx.save();
            const textFill = typeof (node.style.fill || node.fill) === 'string' ? (node.style.fill || node.fill || '#000000') : '#000000';
            ctx.fillStyle = String(textFill);
            const fontSize = Math.max(10, Math.min(16, Math.floor(node.height * 0.18)));
            ctx.font = `${fontSize}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(node.barcodeLayout.text, node.x + node.width / 2, node.y + node.height);
            ctx.restore();
          }

          if (node.type === 'qrcode' && node.qrcodeLayout?.logo && node.qrcodeLayout.logoBox) {
            const { x: lbX, y: lbY, width: lbW, height: lbH } = node.qrcodeLayout.logoBox;
            const matrixLen = node.qrcodeLayout.matrix.length || 1;
            const absX = node.x + (lbX / matrixLen) * node.width;
            const absY = node.y + (lbY / matrixLen) * node.height;
            const absW = (lbW / matrixLen) * node.width;
            const absH = (lbH / matrixLen) * node.height;

            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(absX, absY, absW, absH);
            ctx.restore();

            const logoImg = await resolveSharedImage(node.qrcodeLayout.logo, basePath);
            if (logoImg) {
              drawImageWithFit(ctx, logoImg as any, 'contain', absX, absY, absW, absH);
            }
          }
        }
        break;
      }
      case 'text': {
        const fontSize = node.textLayout?.fontSize || 16;
        const fontFamily = node.textLayout?.fontFamily || 'sans-serif';
        const lineHeight = node.textLayout?.lineHeight || Math.round(fontSize * 1.25);
        const fw = node.textLayout?.fontWeight || 'normal';
        const fs = node.textLayout?.fontStyle || 'normal';

        ctx.font = `${fs === 'italic' || fs === 'oblique' ? 'italic ' : ''}${fw} ${fontSize}px "${fontFamily}"`;

        if (node.style.fill || node.fill) {
          const fill = node.style.fill || node.fill;
          if (typeof fill === 'string') {
            ctx.fillStyle = fill;
          } else {
            ctx.fillStyle = createCanvasGradient(ctx, fill as any, node.box);
          }
        } else {
          ctx.fillStyle = node.style.color || '#000000';
        }

        const align = node.style.align || 'left';
        if (align === 'center') {
          ctx.textAlign = 'center';
        } else if (align === 'right') {
          ctx.textAlign = 'right';
        } else {
          ctx.textAlign = 'left';
        }

        let anchorX = node.x;
        if (align === 'center') anchorX = node.x + node.width / 2;
        if (align === 'right') anchorX = node.x + node.width;

        const opticalOffset = node.textLayout?.opticalCenterOffset ?? 0;
        const lineCount = node.textLayout?.lines?.length || 1;
        const isMiddle = node.style.verticalAlign === 'middle';

        ctx.textBaseline = isMiddle ? 'middle' : 'top';

        const baselineY0 = isMiddle
          ? node.y + node.height / 2 + opticalOffset - ((lineCount - 1) * lineHeight) / 2
          : node.y + (node.style.verticalAlign === 'bottom' ? Math.max(0, node.height - (node.textLayout?.height ?? 0)) : 0);

        if (node.textLayout && node.textLayout.lines) {
          for (let i = 0; i < node.textLayout.lines.length; i++) {
            ctx.fillText(node.textLayout.lines[i]!, anchorX, baselineY0 + i * lineHeight);
          }
        }
        break;
      }
      case 'image': {
        const imgSrc = node.imageLayout?.src;
        if (imgSrc) {
          const img = await this.resolveImage(imgSrc, basePath);
          if (img) {
            if (node.style.borderRadius) {
              ctx.save();
              drawRect(ctx, node.x, node.y, node.width, node.height, node.style.borderRadius);
              ctx.clip();
              drawImageWithFit(ctx, img, node.fit || node.imageLayout?.fit || 'fill', node.x, node.y, node.width, node.height);
              ctx.restore();
            } else {
              drawImageWithFit(ctx, img, node.fit || node.imageLayout?.fit || 'fill', node.x, node.y, node.width, node.height);
            }
          }
        }
        break;
      }
      case 'stack':
      case 'group':
      case 'grid': {
        if (node.style.fill || node.style.stroke) {
          drawRect(ctx, node.x, node.y, node.width, node.height, node.style.borderRadius);
          this.applyFillAndStroke(ctx, node);
        }
        const hasGroupClip = node.style.clip === true || (node as any).clip === true;
        if (hasGroupClip) {
          ctx.save();
          drawRect(ctx, node.x, node.y, node.width, node.height, node.style.borderRadius);
          ctx.clip();
        }

        if (node.children && node.children.length > 0) {
          let i = 0;
          while (i < node.children.length) {
            const child = node.children[i]!;
            const isMask = child.style.clip === true || (child as any).clip === true;

            if (isMask) {
              await this.renderNodeToContext(ctx, child, basePath);

              const maskedSiblings: LayoutNode[] = [];
              let j = i + 1;
              while (j < node.children.length) {
                const nextChild = node.children[j]!;
                const nextIsMask = nextChild.style.clip === true || (nextChild as any).clip === true;
                if (nextIsMask) break;
                maskedSiblings.push(nextChild);
                j++;
              }

              if (maskedSiblings.length > 0) {
                ctx.save();
                ctx.beginPath();
                if (child.type === 'circle') {
                  const cx = child.x + child.width / 2;
                  const cy = child.y + child.height / 2;
                  drawCircle(ctx, cx, cy, { rx: child.width / 2, ry: child.height / 2 });
                } else if (child.type === 'polygon' && child.polygonLayout?.canvasPoints) {
                  drawPolygon(ctx, child.polygonLayout.canvasPoints);
                } else {
                  drawRect(ctx, child.x, child.y, child.width, child.height, child.style.borderRadius);
                }
                ctx.clip();

                for (const sibling of maskedSiblings) {
                  await this.renderNodeToContext(ctx, sibling, basePath);
                }
                ctx.restore();
              }
              i = j;
            } else {
              await this.renderNodeToContext(ctx, child, basePath);
              i++;
            }
          }
        }

        if (hasGroupClip) {
          ctx.restore();
        }
        break;
      }
    }

    ctx.restore();
  }

  private static applyFillAndStroke(ctx: CanvasRenderingContext2D, node: LayoutNode): void {
    const fill = node.style.fill || node.fill;
    if (fill) {
      if (typeof fill === 'string') {
        ctx.fillStyle = fill;
      } else {
        ctx.fillStyle = createCanvasGradient(ctx, fill as any, node.box);
      }
      ctx.fill();
    }

    const stroke = node.style.stroke || node.stroke;
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = node.style.strokeWidth ?? 1;
      if (node.style.strokeCap) ctx.lineCap = node.style.strokeCap;
      if (node.style.strokeJoin) ctx.lineJoin = node.style.strokeJoin;
      if (node.style.strokeStyle === 'dashed') ctx.setLineDash([6, 6]);
      else if (node.style.strokeStyle === 'dotted') ctx.setLineDash([2, 2]);
      else ctx.setLineDash([]);
      ctx.stroke();
    }
  }

  private static async resolveImage(imgSrc: string, basePath?: string): Promise<Image | null> {
    return resolveSharedImage(imgSrc, basePath);
  }

  private static mapFontFamilyToPostScript(fontFamily: string, fontWeight: string | number, fontStyle: string): string {
    // 1. Handle comma-separated font fallback stacks (e.g. "Inter, -apple-system, sans-serif")
    // Photoshop Type layers require a single concrete PostScript font identifier.
    let primary = fontFamily ? fontFamily.split(',')[0]!.trim() : 'sans-serif';
    // Strip surrounding quotes
    primary = primary.replace(/^['"]|['"]$/g, '').trim();
    if (!primary) primary = 'sans-serif';

    // 2. Query FontLoader first to resolve genuine PostScript name from registered or system fonts
    const fromLoader = FontLoader.resolvePostScriptName(primary, fontWeight, fontStyle);
    if (fromLoader) {
      return fromLoader;
    }

    const numericWeight = typeof fontWeight === 'number' ? fontWeight
      : /^[0-9]+$/.test(String(fontWeight)) ? parseInt(String(fontWeight), 10) : null;
    const isBold = fontWeight === 'bold' || fontWeight === 'bolder' || (numericWeight !== null && numericWeight >= 600) || String(fontWeight) === '700';
    const isItalic = fontStyle === 'italic' || fontStyle === 'oblique';

    // Granular weight suffix for variable & OpenType fonts (e.g. Inter-SemiBold)
    let weightName = 'Regular';
    if (numericWeight !== null) {
      if (numericWeight <= 150) weightName = 'Thin';
      else if (numericWeight <= 250) weightName = 'ExtraLight';
      else if (numericWeight <= 350) weightName = 'Light';
      else if (numericWeight <= 450) weightName = 'Regular';
      else if (numericWeight <= 550) weightName = 'Medium';
      else if (numericWeight <= 650) weightName = 'SemiBold';
      else if (numericWeight <= 750) weightName = 'Bold';
      else if (numericWeight <= 850) weightName = 'ExtraBold';
      else weightName = 'Black';
    } else {
      const fwLower = String(fontWeight).toLowerCase().trim();
      if (fwLower === 'thin' || fwLower === 'hairline') weightName = 'Thin';
      else if (fwLower === 'extralight' || fwLower === 'extra-light' || fwLower === 'ultralight' || fwLower === 'ultra-light') weightName = 'ExtraLight';
      else if (fwLower === 'light') weightName = 'Light';
      else if (fwLower === 'medium') weightName = 'Medium';
      else if (fwLower === 'semibold' || fwLower === 'semi-bold' || fwLower === 'demibold' || fwLower === 'demi-bold') weightName = 'SemiBold';
      else if (fwLower === 'bold' || fwLower === 'bolder') weightName = 'Bold';
      else if (fwLower === 'extrabold' || fwLower === 'extra-bold' || fwLower === 'ultrabold' || fwLower === 'ultra-bold') weightName = 'ExtraBold';
      else if (fwLower === 'black' || fwLower === 'heavy') weightName = 'Black';
      else weightName = 'Regular';
    }

    let styleSuffix = weightName;
    if (isItalic) {
      styleSuffix = weightName === 'Regular' ? 'Italic' : `${weightName}Italic`;
    }

    // Generic CSS fallbacks mapping to standard ubiquitous PostScript fonts
    const key = primary.toLowerCase();
    const genericSans = isItalic
      ? (isBold ? 'Arial-BoldItalicMT' : 'Arial-ItalicMT')
      : (isBold ? 'Arial-BoldMT' : 'ArialMT');
    const genericSerif = isItalic
      ? (isBold ? 'TimesNewRomanPS-BoldItalicMT' : 'TimesNewRomanPS-ItalicMT')
      : (isBold ? 'TimesNewRomanPS-BoldMT' : 'TimesNewRomanPSMT');
    const genericMono = isItalic
      ? (isBold ? 'Courier-BoldOblique' : 'Courier-Oblique')
      : (isBold ? 'Courier-Bold' : 'Courier');

    if (key === 'sans-serif' || key === 'system-ui' || key === '-apple-system' || key === 'blinkmacsystemfont') {
      return genericSans;
    }
    if (key === 'serif') {
      return genericSerif;
    }
    if (key === 'monospace') {
      return genericMono;
    }

    const consolasName = isBold
      ? (isItalic ? 'Consolas-BoldItalic' : 'Consolas-Bold')
      : (isItalic ? 'Consolas-Italic' : 'Consolas');

    const segoeUiName = isBold
      ? (isItalic ? 'SegoeUI-BoldItalic' : 'SegoeUI-Bold')
      : (isItalic ? 'SegoeUI-Italic' : 'SegoeUI');

    const map: Record<string, string> = {
      'arial': genericSans,
      'helvetica': `Helvetica${styleSuffix === 'Regular' ? '' : '-' + styleSuffix}`,
      'helvetica neue': `HelveticaNeue${styleSuffix === 'Regular' ? '' : '-' + styleSuffix}`,
      'times': genericSerif,
      'times new roman': genericSerif,
      'courier': genericMono,
      'courier new': `CourierNewPS${styleSuffix === 'Regular' ? 'MT' : '-' + styleSuffix + 'MT'}`,
      'consolas': consolasName,
      'segoe ui': segoeUiName,
      'segoeui': segoeUiName,
      'cascadia code': isBold ? (isItalic ? 'CascadiaCode-BoldItalic' : 'CascadiaCode-Bold') : (isItalic ? 'CascadiaCode-Italic' : 'CascadiaCode-Regular'),
      'fira code': isBold ? 'FiraCode-Bold' : 'FiraCode-Regular',
      'jetbrains mono': isBold ? (isItalic ? 'JetBrainsMono-BoldItalic' : 'JetBrainsMono-Bold') : (isItalic ? 'JetBrainsMono-Italic' : 'JetBrainsMono-Regular'),
      'inter': `Inter-${styleSuffix}`,
      'roboto': `Roboto-${styleSuffix}`,
      'poppins': `Poppins-${styleSuffix}`,
      'montserrat': `Montserrat-${styleSuffix}`,
      'open sans': `OpenSans-${styleSuffix}`,
      'lato': `Lato-${styleSuffix}`,
      'geist': `Geist-${styleSuffix}`,
      'outfit': `Outfit-${styleSuffix}`
    };

    if (map[key]) return map[key];

    // Some basic key mappings like "inter bold" in case someone still passed it inside fontFamily
    if (key === 'arial bold') return 'Arial-BoldMT';
    if (key === 'helvetica bold') return 'Helvetica-Bold';
    if (key === 'inter bold') return 'Inter-Bold';
    if (key === 'roboto bold') return 'Roboto-Bold';

    // Clean primary family name for PostScript convention: PascalCase / no spaces / no commas
    const cleanPrimary = primary.replace(/[^a-zA-Z0-9_-]/g, '');
    return `${cleanPrimary}-${styleSuffix}`;
  }

  /**
   * Generates native Photoshop Vector Shape Layer metadata:
   * vectorMask (Bezier paths & knots), vectorFill, vectorStroke, and live vectorOrigination.
   */
  private static buildVectorShape(
    node: LayoutNode,
    scale: number,
    docW: number,
    docH: number,
    matrix: Matrix2D = IDENTITY_MATRIX,
    dpi = 72
  ): {
    vectorMask?: LayerVectorMask;
    vectorFill?: VectorContent;
    vectorStroke?: any;
    vectorOrigination?: any;
  } {
    // Native vector shapes: rect, circle, polygon, path, icon, star, triangle, arrow, cross, shape, image, group, grid, stack, barcode, qrcode
    const VECTOR_TYPES = ['rect', 'circle', 'polygon', 'path', 'icon', 'star', 'triangle', 'arrow', 'cross', 'shape', 'image', 'group', 'grid', 'stack', 'barcode', 'qrcode'];
    if (!VECTOR_TYPES.includes(node.type)) {
      return {};
    }

    const x0 = node.x * scale;
    const y0 = node.y * scale;
    const w = node.width * scale;
    const h = node.height * scale;
    const x1 = x0 + w;
    const y1 = y0 + h;

    const K = 0.5522847498307935;
    let knots: BezierKnot[] = [];
    let customPaths: BezierPath[] | undefined;
    let origination: any = undefined;

    if (node.type === 'rect' || node.type === 'image' || ['group', 'grid', 'stack'].includes(node.type)) {
      const radiusVal = node.style.borderRadius ?? (node as any).radius;
      // If it's an image or container without any radius or clip, skip vectorMask generation
      if (node.type === 'image' && !radiusVal && !node.style.clip && !(node as any).clip) {
        return {};
      }
      if (['group', 'grid', 'stack'].includes(node.type) && !radiusVal && !node.style.clip && !(node as any).clip) {
        return {};
      }
      let rTL = 0, rTR = 0, rBR = 0, rBL = 0;
      if (Array.isArray(radiusVal)) {
        rTL = (radiusVal[0] || 0) * scale;
        rTR = (radiusVal[1] || 0) * scale;
        rBR = (radiusVal[2] || 0) * scale;
        rBL = (radiusVal[3] || 0) * scale;
      } else if (typeof radiusVal === 'number') {
        rTL = rTR = rBR = rBL = radiusVal * scale;
      }

      // Clamp radii to prevent self-intersection and negative dimensions (F-083)
      const maxR = Math.max(0, Math.min(w / 2, h / 2));
      rTL = Math.max(0, Math.min(Number.isFinite(rTL) ? rTL : 0, maxR));
      rTR = Math.max(0, Math.min(Number.isFinite(rTR) ? rTR : 0, maxR));
      rBR = Math.max(0, Math.min(Number.isFinite(rBR) ? rBR : 0, maxR));
      rBL = Math.max(0, Math.min(Number.isFinite(rBL) ? rBL : 0, maxR));

      if (rTL > 0 || rTR > 0 || rBR > 0 || rBL > 0) {
        // Clockwise 8-knot rounded rectangle
        knots = [
          // 1. Top edge right
          { linked: true, points: [x1 - rTR, y0, x1 - rTR, y0, x1 - rTR + rTR * K, y0] },
          // 2. Right edge top
          { linked: true, points: [x1, y0 + rTR - rTR * K, x1, y0 + rTR, x1, y0 + rTR] },
          // 3. Right edge bottom
          { linked: true, points: [x1, y1 - rBR, x1, y1 - rBR, x1, y1 - rBR + rBR * K] },
          // 4. Bottom edge right
          { linked: true, points: [x1 - rBR + rBR * K, y1, x1 - rBR, y1, x1 - rBR, y1] },
          // 5. Bottom edge left
          { linked: true, points: [x0 + rBL, y1, x0 + rBL, y1, x0 + rBL - rBL * K, y1] },
          // 6. Left edge bottom
          { linked: true, points: [x0, y1 - rBL + rBL * K, x0, y1 - rBL, x0, y1 - rBL] },
          // 7. Left edge top
          { linked: true, points: [x0, y0 + rTL, x0, y0 + rTL, x0, y0 + rTL - rTL * K] },
          // 8. Top edge left
          { linked: true, points: [x0 + rTL - rTL * K, y0, x0 + rTL, y0, x0 + rTL, y0] }
        ];

        origination = {
          keyDescriptorList: [
            {
              keyOriginType: 2, // Rounded Rectangle
              keyOriginResolution: dpi,
              keyOriginRRectRadii: {
                topLeft: { units: 'Pixels', value: rTL },
                topRight: { units: 'Pixels', value: rTR },
                bottomRight: { units: 'Pixels', value: rBR },
                bottomLeft: { units: 'Pixels', value: rBL }
              },
              keyOriginShapeBoundingBox: {
                top: { units: 'Pixels', value: y0 },
                left: { units: 'Pixels', value: x0 },
                bottom: { units: 'Pixels', value: y1 },
                right: { units: 'Pixels', value: x1 }
              },
              keyOriginBoxCorners: [
                { x: x0, y: y0 },
                { x: x1, y: y0 },
                { x: x1, y: y1 },
                { x: x0, y: y1 }
              ]
            }
          ]
        };
      } else {
        // Standard 4-knot sharp rectangle
        knots = [
          { linked: false, points: [x0, y0, x0, y0, x0, y0] },
          { linked: false, points: [x1, y0, x1, y0, x1, y0] },
          { linked: false, points: [x1, y1, x1, y1, x1, y1] },
          { linked: false, points: [x0, y1, x0, y1, x0, y1] }
        ];

        origination = {
          keyDescriptorList: [
            {
              keyOriginType: 1, // Sharp Rectangle
              keyOriginResolution: dpi,
              keyOriginShapeBoundingBox: {
                top: { units: 'Pixels', value: y0 },
                left: { units: 'Pixels', value: x0 },
                bottom: { units: 'Pixels', value: y1 },
                right: { units: 'Pixels', value: x1 }
              },
              keyOriginBoxCorners: [
                { x: x0, y: y0 },
                { x: x1, y: y0 },
                { x: x1, y: y1 },
                { x: x0, y: y1 }
              ]
            }
          ]
        };
      }
    } else if (node.type === 'circle') {
      const cx = (node.x + node.width / 2) * scale;
      const cy = (node.y + node.height / 2) * scale;
      const rx = (node.width / 2) * scale;
      const ry = (node.height / 2) * scale;
      const kx = rx * K;
      const ky = ry * K;

      knots = [
        // Top
        { linked: true, points: [cx - kx, cy - ry, cx, cy - ry, cx + kx, cy - ry] },
        // Right
        { linked: true, points: [cx + rx, cy - ky, cx + rx, cy, cx + rx, cy + ky] },
        // Bottom
        { linked: true, points: [cx + kx, cy + ry, cx, cy + ry, cx - kx, cy + ry] },
        // Left
        { linked: true, points: [cx - rx, cy + ky, cx - rx, cy, cx - rx, cy - ky] }
      ];

      origination = {
        keyDescriptorList: [
          {
            keyOriginType: 5, // Ellipse (Photoshop specification: 1=rect, 2=round rect, 4=line, 5=ellipse)
            keyOriginResolution: dpi,
            keyOriginShapeBoundingBox: {
              top: { units: 'Pixels', value: y0 },
              left: { units: 'Pixels', value: x0 },
              bottom: { units: 'Pixels', value: y1 },
              right: { units: 'Pixels', value: x1 }
            },
            keyOriginBoxCorners: [
              { x: x0, y: y0 },
              { x: x1, y: y0 },
              { x: x1, y: y1 },
              { x: x0, y: y1 }
            ]
          }
        ]
      };
    } else if (node.type === 'polygon' && node.polygonLayout?.canvasPoints) {
      const radiusVal = node.style.borderRadius ?? (node as any).radius;
      if (radiusVal) {
        const d = polygonToRoundedSvgPath(node.polygonLayout.canvasPoints, radiusVal);
        const bezierPaths = svgPathToBezierPaths(d, {
          scale,
          fillRule: (node.style as any)?.fillRule === 'evenodd' ? 'even-odd' : 'non-zero'
        });
        if (bezierPaths.length > 0) {
          customPaths = bezierPaths;
        }
      } else {
        knots = node.polygonLayout.canvasPoints.map(p => {
          const px = p.x * scale;
          const py = p.y * scale;
          return { linked: false, points: [px, py, px, py, px, py] };
        });
      }
    } else if (['star', 'triangle', 'arrow', 'cross', 'shape', 'path', 'icon', 'barcode', 'qrcode'].includes(node.type) && node.pathLayout?.d) {
      // Use the full SVG-to-Bézier parser to convert curves, arcs, and lines into native knots
      const isIcon = node.type === 'icon';
      const bezierPaths = svgPathToBezierPaths(node.pathLayout.d, {
        scale,
        offsetX: node.x,
        offsetY: node.y,
        fillRule: (node.style as any)?.fillRule === 'evenodd' ? 'even-odd' : 'non-zero',
        ...(isIcon ? { scaleWidth: node.width, scaleHeight: node.height, viewBoxWidth: 24, viewBoxHeight: 24 } : {})
      });

      if (bezierPaths.length > 0) {
        // Collect all knots across subpaths
        customPaths = bezierPaths;
      }
    }

    let vectorMask: LayerVectorMask | undefined;

    // Clamp knot points to 32-bit fixed point (8.24) bounds: [-127.99, 127.99] * docDim (F-082)
    const clampKnotPoints = (knotList: BezierKnot[]) => {
      const minX = -127.99 * Math.max(1, docW);
      const maxX = 127.99 * Math.max(1, docW);
      const minY = -127.99 * Math.max(1, docH);
      const maxY = 127.99 * Math.max(1, docH);
      for (const knot of knotList) {
        if (!knot.points) continue;
        for (let i = 0; i < knot.points.length; i += 2) {
          let px = knot.points[i];
          let py = knot.points[i + 1];
          if (typeof px !== 'number' || !Number.isFinite(px)) px = 0;
          if (typeof py !== 'number' || !Number.isFinite(py)) py = 0;
          knot.points[i] = Math.max(minX, Math.min(maxX, px));
          knot.points[i + 1] = Math.max(minY, Math.min(maxY, py));
        }
      }
    };

    if (customPaths && customPaths.length > 0) {
      const hasTransform = !isMatrixIdentity(matrix);
      if (hasTransform) {
        origination = undefined;
        for (const bp of customPaths) {
          for (const knot of bp.knots) {
            const p0 = transformPoint(matrix, knot.points[0]! / scale, knot.points[1]! / scale);
            const p1 = transformPoint(matrix, knot.points[2]! / scale, knot.points[3]! / scale);
            const p2 = transformPoint(matrix, knot.points[4]! / scale, knot.points[5]! / scale);
            knot.points = [p0.x * scale, p0.y * scale, p1.x * scale, p1.y * scale, p2.x * scale, p2.y * scale];
          }
        }
      }
      for (const bp of customPaths) {
        if (bp.knots) clampKnotPoints(bp.knots);
      }
      vectorMask = {
        paths: customPaths,
        fillStartsWithAllPixels: false
      };
    } else if (knots.length > 0) {
      const hasTransform = !isMatrixIdentity(matrix);
      if (hasTransform) {
        origination = undefined; // Drop live shape properties if we apply a transform to the mask
        for (const knot of knots) {
          const p0 = transformPoint(matrix, knot.points[0]! / scale, knot.points[1]! / scale);
          const p1 = transformPoint(matrix, knot.points[2]! / scale, knot.points[3]! / scale);
          const p2 = transformPoint(matrix, knot.points[4]! / scale, knot.points[5]! / scale);
          knot.points = [p0.x * scale, p0.y * scale, p1.x * scale, p1.y * scale, p2.x * scale, p2.y * scale];
        }
      }
      clampKnotPoints(knots);

      vectorMask = {
        paths: [
          {
            open: false,
            operation: 'combine',
            fillRule: 'non-zero',
            knots
          }
        ],
        fillStartsWithAllPixels: false
      };
    }

    if (!vectorMask) {
      return {};
    }

    // Vector Fill
    let vectorFill: VectorContent | undefined;
    const rawFill = node.style.fill || node.fill || (node.type === 'barcode' || node.type === 'qrcode' ? '#000000' : undefined);
    const hasRealFill = Boolean(rawFill) &&
      rawFill !== 'transparent' && rawFill !== 'none' &&
      (typeof rawFill !== 'string' || parseColorToRgba(rawFill).a > 0);

    if (hasRealFill && rawFill) {
      if (typeof rawFill === 'string') {
        const rgba = parseColorToRgba(rawFill);
        vectorFill = {
          type: 'color',
          color: { r: rgba.r, g: rgba.g, b: rgba.b }
        };
      } else if (typeof rawFill === 'object' && (rawFill.type === 'linear' || rawFill.type === 'radial' || rawFill.type === 'conic')) {
        const distributed = distributeGradientStops(rawFill.stops);
        // Note: ag-psd internally scales stop location by 4096 and midpoint by 100.
        // We pass normalized location (0..1) and midpoint (0..1) here.
        const colorStops = distributed.map(s => {
          const c = parseColorToRgba(s.color);
          return {
            color: { r: c.r, g: c.g, b: c.b },
            location: s.offset,
            midpoint: 0.5
          };
        });
        const opacityStops = distributed.map(s => {
          const c = parseColorToRgba(s.color);
          return {
            opacity: c.a,
            location: s.offset,
            midpoint: 0.5
          };
        });
        vectorFill = {
          type: 'solid',
          name: 'Gradient Fill',
          smoothness: 1,
          colorStops,
          opacityStops,
          style: (rawFill as any).type === 'radial' ? 'radial' : (rawFill as any).type === 'conic' ? 'angle' : 'linear',
          angle: cssGradientAngleToPhotoshop(typeof rawFill.angle === 'number' ? rawFill.angle : rawFill.direction)
        } as any;
      }
    }

    // Vector Stroke
    let vectorStroke: any | undefined;
    const stroke = node.style.stroke || node.stroke;
    if (stroke) {
      const strokeColor = parseColorToRgba(stroke);
      // In Photoshop, shapes with a stroke require vectorFill to emit vscg metadata.
      // If there is no real fill, emit a dummy color with fillEnabled: false.
      if (!vectorFill) {
        vectorFill = {
          type: 'color',
          color: { r: 0, g: 0, b: 0 }
        };
      }

      const strokeStyle = node.style.strokeStyle;
      let lineDashSet: any[] | undefined;
      let lineDashOffset: any | undefined;
      if (strokeStyle === 'dashed') {
        lineDashSet = [
          { units: 'Points', value: 6 },
          { units: 'Points', value: 6 }
        ];
        lineDashOffset = { units: 'Points', value: 0 };
      } else if (strokeStyle === 'dotted') {
        lineDashSet = [
          { units: 'Points', value: 2 },
          { units: 'Points', value: 2 }
        ];
        lineDashOffset = { units: 'Points', value: 0 };
      }

      const rawAlign = node.style.strokeAlign || (node.style as any)['stroke-align'];
      const lineAlignment = rawAlign === 'inside' ? 'inside' : rawAlign === 'outside' ? 'outside' : 'center';

      vectorStroke = {
        strokeEnabled: true,
        fillEnabled: hasRealFill,
        lineWidth: { units: 'Pixels', value: (node.style.strokeWidth ?? 1) * scale },
        lineJoinType: node.style.strokeJoin === 'round' ? 'round' : node.style.strokeJoin === 'bevel' ? 'bevel' : 'miter',
        lineCapType: node.style.strokeCap === 'round' ? 'round' : node.style.strokeCap === 'square' ? 'square' : (strokeStyle === 'dotted' ? 'round' : 'butt'),
        lineAlignment,
        ...(lineDashSet ? { lineDashSet, lineDashOffset } : {}),
        content: {
          type: 'color',
          color: { r: strokeColor.r, g: strokeColor.g, b: strokeColor.b }
        }
      };
    }

    return {
      vectorMask,
      vectorFill,
      vectorStroke,
      vectorOrigination: origination
    };
  }

  /**
   * Generates native Photoshop Layer Effects (Drop Shadow, Inner Shadow, Glow, Bevel, Stroke, Overlays).
   */
  private static buildLayerEffects(node: LayoutNode, scale: number): LayerEffectsInfo | undefined {
    const effects: LayerEffectsInfo = {};
    let hasAnyEffect = false;

    const rawShadows = (node.style as any).shadows || (node.style.shadow ? [node.style.shadow] : (node as any).shadow ? [(node as any).shadow] : []);
    if (rawShadows.length > 0) {
      effects.dropShadow = rawShadows.map((s: any) => {
        const offsetX = (s.offsetX ?? 0) * scale;
        const offsetY = (s.offsetY ?? 0) * scale;
        const blur = (s.blur ?? 0) * scale;
        const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        const angleRad = Math.atan2(offsetY, -offsetX);
        let angleDeg = Math.round(angleRad * (180 / Math.PI));
        if (angleDeg < 0) angleDeg += 360;

        const shadowColor = parseColorToRgba(s.color || '#000000');
        const chokePx = typeof s.spread === 'number' ? s.spread * scale : 0;

        return {
          enabled: true,
          blendMode: s.blendMode || 'multiply',
          color: { r: shadowColor.r, g: shadowColor.g, b: shadowColor.b },
          opacity: shadowColor.a,
          distance: { units: 'Pixels', value: dist },
          size: { units: 'Pixels', value: blur },
          choke: { units: 'Pixels', value: chokePx },
          angle: angleDeg,
          useGlobalLight: s.useGlobalLight ?? false,
          contour: {
            name: 'Linear',
            curve: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
          },
          noise: typeof s.noise === 'number' ? s.noise : 0,
          layerConceals: true,
          antialiased: false
        } as any;
      });
      hasAnyEffect = true;
    }

    // Inner Shadow
    const innerShadow = node.style.innerShadow || (node as any).innerShadow;
    if (innerShadow) {
      const offsetX = (innerShadow.offsetX ?? 0) * scale;
      const offsetY = (innerShadow.offsetY ?? 0) * scale;
      const blur = (innerShadow.blur ?? 0) * scale;
      const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      const angleRad = Math.atan2(offsetY, -offsetX);
      let angleDeg = Math.round(angleRad * (180 / Math.PI));
      if (angleDeg < 0) angleDeg += 360;

      const color = parseColorToRgba(innerShadow.color || '#000000');
      effects.innerShadow = [
        {
          enabled: true,
          blendMode: innerShadow.blendMode || 'multiply',
          color: { r: color.r, g: color.g, b: color.b },
          opacity: color.a,
          distance: { units: 'Pixels', value: dist },
          size: { units: 'Pixels', value: blur },
          choke: { units: 'Pixels', value: typeof innerShadow.spread === 'number' ? innerShadow.spread * scale : 0 },
          angle: angleDeg,
          useGlobalLight: innerShadow.useGlobalLight ?? false,
          contour: {
            name: 'Linear',
            curve: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
          },
          noise: typeof innerShadow.noise === 'number' ? innerShadow.noise : 0,
          antialiased: false
        } as any
      ];
      hasAnyEffect = true;
    }

    // Outer Glow
    const outerGlow = node.style.outerGlow;
    if (outerGlow) {
      const color = parseColorToRgba(outerGlow.color || '#ffffff');
      effects.outerGlow = {
        enabled: true,
        blendMode: (outerGlow as any).blendMode || 'screen',
        color: { r: color.r, g: color.g, b: color.b },
        opacity: outerGlow.opacity ?? color.a,
        size: { units: 'Pixels', value: (outerGlow.size || 10) * scale },
        choke: { units: 'Pixels', value: typeof (outerGlow as any).spread === 'number' ? (outerGlow as any).spread * scale : 0 },
        technique: 'softer',
        source: 'edge',
        noise: typeof (outerGlow as any).noise === 'number' ? (outerGlow as any).noise : 0,
        range: 50,
        jitter: 0,
        antialiased: false,
        contour: {
          name: 'Linear',
          curve: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
        }
      } as any;
      hasAnyEffect = true;
    }

    // Inner Glow
    const innerGlow = node.style.innerGlow;
    if (innerGlow) {
      const color = parseColorToRgba(innerGlow.color || '#ffffff');
      effects.innerGlow = {
        enabled: true,
        blendMode: (innerGlow as any).blendMode || 'screen',
        color: { r: color.r, g: color.g, b: color.b },
        opacity: innerGlow.opacity ?? color.a,
        size: { units: 'Pixels', value: (innerGlow.size || 8) * scale },
        choke: { units: 'Pixels', value: typeof (innerGlow as any).spread === 'number' ? (innerGlow as any).spread * scale : 0 },
        technique: 'softer',
        source: (innerGlow as any).source === 'center' ? 'center' : 'edge',
        noise: typeof (innerGlow as any).noise === 'number' ? (innerGlow as any).noise : 0,
        range: 50,
        jitter: 0,
        antialiased: false,
        contour: {
          name: 'Linear',
          curve: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
        }
      };
      hasAnyEffect = true;
    }

    // Bevel and Emboss
    const bevel = node.style.bevel;
    if (bevel) {
      const bevelTypeMap: Record<string, 'inner bevel' | 'outer bevel' | 'emboss' | 'pillow emboss' | 'stroke emboss'> = {
        'inner-bevel': 'inner bevel',
        'outer-bevel': 'outer bevel',
        'emboss': 'emboss',
        'pillow-emboss': 'pillow emboss',
        'stroke-emboss': 'stroke emboss'
      };
      const bevelStyle = (bevel as any).style || bevelTypeMap[bevel.type] || 'inner bevel';
      const bevelTech = bevel.type === 'chisel-hard' ? 'chisel hard' : bevel.type === 'chisel-soft' ? 'chisel soft' : 'smooth';

      effects.bevel = {
        enabled: true,
        size: { units: 'Pixels', value: (bevel.size || 4) * scale },
        soften: { units: 'Pixels', value: (bevel.soften || 0) * scale },
        direction: bevel.direction === 'down' ? 'down' : 'up',
        style: bevelStyle,
        technique: bevelTech,
        strength: bevel.depth ?? 100,
        altitude: bevel.altitude ?? 30,
        angle: bevel.angle ?? 90,
        highlightBlendMode: 'screen',
        shadowBlendMode: 'multiply',
        highlightColor: { r: 255, g: 255, b: 255 },
        shadowColor: { r: 0, g: 0, b: 0 },
        highlightOpacity: 0.75,
        shadowOpacity: 0.75,
        useGlobalLight: false,
        contour: {
          name: 'Linear',
          curve: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
        }
      };
      hasAnyEffect = true;
    }

    // Stroke Effect
    const strokeFx = node.style.layerStroke;
    if (strokeFx) {
      if (strokeFx.gradient && strokeFx.gradient.stops) {
        const distributed = distributeGradientStops(strokeFx.gradient.stops);
        const colorStops = distributed.map(s => {
          const c = parseColorToRgba(s.color);
          return { color: { r: c.r, g: c.g, b: c.b }, location: s.offset, midpoint: 0.5 };
        });
        const opacityStops = distributed.map(s => {
          const c = parseColorToRgba(s.color);
          return { opacity: c.a, location: s.offset, midpoint: 0.5 };
        });
        const gradType = strokeFx.gradient.type === 'radial' ? 'radial' : strokeFx.gradient.type === 'conic' ? 'angle' : 'linear';
        effects.stroke = [
          {
            enabled: true,
            size: { units: 'Pixels', value: (strokeFx.width || 1) * scale },
            position: strokeFx.position || 'inside',
            fillType: 'gradient',
            blendMode: (strokeFx as any).blendMode || 'normal',
            opacity: strokeFx.opacity ?? 1,
            gradient: {
              style: gradType,
              angle: cssGradientAngleToPhotoshop(typeof (strokeFx.gradient as any).angle === 'number' ? (strokeFx.gradient as any).angle : (strokeFx.gradient as any).direction),
              name: 'Gradient Stroke',
              type: 'solid',
              smoothness: 1,
              colorStops,
              opacityStops
            }
          } as any
        ];
      } else {
        const color = parseColorToRgba(strokeFx.color || '#000000');
        effects.stroke = [
          {
            enabled: true,
            size: { units: 'Pixels', value: (strokeFx.width || 1) * scale },
            position: strokeFx.position || 'inside',
            fillType: 'color',
            blendMode: (strokeFx as any).blendMode || 'normal',
            color: { r: color.r, g: color.g, b: color.b },
            opacity: strokeFx.opacity ?? color.a
          }
        ];
      }
      hasAnyEffect = true;
    }

    // Color Overlay (solidFill in PSD)
    if (node.style.colorOverlay) {
      const color = parseColorToRgba(node.style.colorOverlay);
      effects.solidFill = [
        {
          enabled: true,
          color: { r: color.r, g: color.g, b: color.b },
          opacity: color.a,
          blendMode: 'normal'
        }
      ];
      hasAnyEffect = true;
    }

    // Gradient Overlay (gradientFill in PSD)
    const gradOverlay = node.style.gradientOverlay || (node as any).gradientOverlay;
    if (gradOverlay && gradOverlay.stops) {
      const distributed = distributeGradientStops(gradOverlay.stops);
      const colorStops = distributed.map(s => {
        const c = parseColorToRgba(s.color);
        return {
          color: { r: c.r, g: c.g, b: c.b },
          location: s.offset,
          midpoint: 0.5
        };
      });
      const opacityStops = distributed.map(s => {
        const c = parseColorToRgba(s.color);
        return {
          opacity: c.a,
          location: s.offset,
          midpoint: 0.5
        };
      });

      effects.gradientOverlay = [
        {
          enabled: true,
          blendMode: (gradOverlay as any).blendMode || 'normal',
          opacity: gradOverlay.opacity ?? 1,
          type: gradOverlay.type === 'radial' ? 'radial' : gradOverlay.type === 'conic' ? 'angle' : 'linear',
          angle: cssGradientAngleToPhotoshop(typeof gradOverlay.angle === 'number' ? gradOverlay.angle : gradOverlay.direction),
          scale: 1,
          gradient: {
            name: 'Gradient Overlay',
            type: 'solid',
            smoothness: 1,
            colorStops,
            opacityStops
          }
        } as any
      ];
      hasAnyEffect = true;
    }

    return hasAnyEffect ? effects : undefined;
  }
}

/**
 * Functional export for PSD export
 */
export async function exportToPsd(layout: LayoutResult, options?: PsdExportOptions): Promise<Buffer> {
  return PsdExporter.export(layout, options);
}
