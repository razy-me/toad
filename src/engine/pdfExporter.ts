/**
 * src/engine/pdfExporter.ts
 * Standalone Prepress Vector PDF Compiler for the "toad" declarative design language.
 * Generates vector PDF 1.4 / 1.6 documents with precise prepress page geometry
 * (/MediaBox, /TrimBox, /BleedBox), native /DeviceCMYK & /DeviceRGB color streams,
 * vector shapes, text elements, embedded images, and print crop marks.
 */

import * as zlib from 'node:zlib';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LayoutResult, LayoutNode } from '../parser/math.js';
import { parseColorToRgba } from './drawUtils.js';
import { resolveSharedImage } from './imageCache.js';
import { svgPathToSubpaths } from './vectorPathParser.js';
import { generateShapePath } from './shapeGenerators.js';
import { getIconPath } from './iconRegistry.js';

export interface PdfExportOptions {
  colorMode?: 'rgb' | 'cmyk';
  cropMarks?: boolean;
  bleed?: number;
  scale?: number;
  basePath?: string;
}

export interface PdfColor {
  mode: 'rgb' | 'cmyk';
  r?: number;
  g?: number;
  b?: number;
  c?: number;
  m?: number;
  y?: number;
  k?: number;
  opacity: number;
}

/**
 * Parses any CSS/TOAD color string into a PdfColor object.
 * Preserves exact CMYK values when specified as cmyk(...).
 */
export function parsePdfColor(colorStr?: string, forceCmyk = false): PdfColor {
  if (!colorStr || colorStr.toLowerCase() === 'transparent' || colorStr.toLowerCase() === 'none') {
    return { mode: 'rgb', r: 0, g: 0, b: 0, opacity: 0 };
  }

  // Direct CMYK string detection
  const cmykMatch = colorStr.match(/cmyk\s*\(\s*([0-9.]+)(%?)[,\s]+([0-9.]+)(%?)[,\s]+([0-9.]+)(%?)[,\s]+([0-9.]+)(%?)(?:[,\s/]+([0-9.]+)(%?))?\s*\)/i);
  if (cmykMatch) {
    const parseVal = (v: string, isPct: string) => {
      const num = parseFloat(v);
      return isPct ? num / 100 : (num > 1 ? num / 100 : num);
    };
    const c = Math.max(0, Math.min(1, parseVal(cmykMatch[1]!, cmykMatch[2]!)));
    const m = Math.max(0, Math.min(1, parseVal(cmykMatch[3]!, cmykMatch[4]!)));
    const y = Math.max(0, Math.min(1, parseVal(cmykMatch[5]!, cmykMatch[6]!)));
    const k = Math.max(0, Math.min(1, parseVal(cmykMatch[7]!, cmykMatch[8]!)));
    const opacity = cmykMatch[9] !== undefined ? parseVal(cmykMatch[9]!, cmykMatch[10] || '') : 1;
    return { mode: 'cmyk', c, m, y, k, opacity };
  }

  const rgba = parseColorToRgba(colorStr);
  if (forceCmyk) {
    const rNorm = rgba.r / 255;
    const gNorm = rgba.g / 255;
    const bNorm = rgba.b / 255;
    const k = 1 - Math.max(rNorm, gNorm, bNorm);
    if (k >= 1) {
      return { mode: 'cmyk', c: 0, m: 0, y: 0, k: 1, opacity: rgba.a };
    }
    const c = (1 - rNorm - k) / (1 - k);
    const m = (1 - gNorm - k) / (1 - k);
    const y = (1 - bNorm - k) / (1 - k);
    return {
      mode: 'cmyk',
      c: Number(c.toFixed(4)),
      m: Number(m.toFixed(4)),
      y: Number(y.toFixed(4)),
      k: Number(k.toFixed(4)),
      opacity: rgba.a
    };
  }

  return {
    mode: 'rgb',
    r: Number((rgba.r / 255).toFixed(4)),
    g: Number((rgba.g / 255).toFixed(4)),
    b: Number((rgba.b / 255).toFixed(4)),
    opacity: rgba.a
  };
}

export class PdfExporter {
  private objects: Array<{ id: number; content: string | Buffer }> = [];
  private nextObjectId = 1;
  private extGStates = new Map<string, number>(); // opacity -> GS id
  private images = new Map<string, { id: number; width: number; height: number }>();
  private basePath?: string;

  constructor(options: PdfExportOptions = {}) {
    this.basePath = options.basePath;
  }

  private allocId(): number {
    return this.nextObjectId++;
  }

  private addObject(content: string | Buffer): number {
    const id = this.allocId();
    this.objects.push({ id, content });
    return id;
  }

  /**
   * Compiles a LayoutResult into a valid PDF binary buffer.
   */
  public async export(layout: LayoutResult, options: PdfExportOptions = {}): Promise<Buffer> {
    this.objects = [];
    this.nextObjectId = 1;
    this.extGStates.clear();
    this.images.clear();

    const bleed = options.bleed !== undefined ? options.bleed : (layout.canvas.bleed || 0);
    const cropMarks = options.cropMarks !== undefined ? options.cropMarks : (layout.canvas.cropMarks === true);
    const margin = Math.max(cropMarks ? 36 : 0, bleed > 0 ? bleed : 0);

    const baseW = layout.canvas.width;
    const baseH = layout.canvas.height;
    const mediaW = baseW + 2 * margin;
    const mediaH = baseH + 2 * margin;

    const isCmyk = options.colorMode === 'cmyk' || (layout.canvas as any).colorMode === 'cmyk';

    // 1. Generate Page Content Stream
    const streamOps: string[] = [];

    // Flip PDF coordinate system (origin bottom-left -> top-left matching canvas)
    streamOps.push(`1 0 0 -1 0 ${mediaH.toFixed(2)} cm`);

    // Translate to Trim Box origin
    if (margin > 0) {
      streamOps.push(`1 0 0 1 ${margin.toFixed(2)} ${margin.toFixed(2)} cm`);
    }

    // 2. Draw Background
    if (layout.canvas.background) {
      const bgX = -bleed;
      const bgY = -bleed;
      const bgW = baseW + 2 * bleed;
      const bgH = baseH + 2 * bleed;

      const bgStr = typeof layout.canvas.background === 'string' ? layout.canvas.background : (layout.canvas.background ? (layout.canvas.background as any).stops?.[0]?.color : undefined);
      const bgColor = parsePdfColor(bgStr, isCmyk);
      if (bgColor.opacity > 0) {
        this.emitFillColor(streamOps, bgColor);
        streamOps.push(`${bgX.toFixed(2)} ${bgY.toFixed(2)} ${bgW.toFixed(2)} ${bgH.toFixed(2)} re f`);
      }
    }

    // 3. Draw Layout Nodes
    for (const node of layout.nodes) {
      await this.renderNode(node, streamOps, isCmyk);
    }

    // 4. Draw Crop Marks & Prepress Crosshairs
    if (cropMarks) {
      this.renderPrepressMarks(streamOps, baseW, baseH, bleed, margin);
    }

    const contentBuffer = Buffer.from(streamOps.join('\n'), 'utf-8');
    const compressedContent = zlib.deflateSync(contentBuffer);

    const contentObjId = this.allocId();
    this.objects.push({
      id: contentObjId,
      content: Buffer.concat([
        Buffer.from(`<< /Length ${compressedContent.length} /Filter /FlateDecode >>\nstream\n`, 'ascii'),
        compressedContent,
        Buffer.from('\nendstream', 'ascii')
      ])
    });

    // 5. Build ExtGState resources
    const gstateEntries: string[] = [];
    for (const [key, gsId] of this.extGStates.entries()) {
      const opac = parseFloat(key);
      const gsObjId = this.addObject(`<< /Type /ExtGState /ca ${opac.toFixed(3)} /CA ${opac.toFixed(3)} >>`);
      gstateEntries.push(`/GS${gsId} ${gsObjId} 0 R`);
    }

    // 6. Build Page Object with MediaBox, TrimBox, and BleedBox
    const trimLeft = margin;
    const trimBottom = margin;
    const trimRight = margin + baseW;
    const trimTop = margin + baseH;

    const bleedLeft = margin - bleed;
    const bleedBottom = margin - bleed;
    const bleedRight = margin + baseW + bleed;
    const bleedTop = margin + baseH + bleed;

    const pageObjId = this.allocId();
    const catalogObjId = this.allocId();
    const pagesObjId = this.allocId();

    const resourceDict = [
      '<<',
      '/ProcSet [/PDF /Text /ImageB /ImageC /ImageI]',
      gstateEntries.length > 0 ? `/ExtGState << ${gstateEntries.join(' ')} >>` : '',
      '/Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >>',
      '>>'
    ].filter(Boolean).join(' ');

    this.objects.push({
      id: pageObjId,
      content: [
        '<<',
        '/Type /Page',
        `/Parent ${pagesObjId} 0 R`,
        `/MediaBox [0 0 ${mediaW.toFixed(2)} ${mediaH.toFixed(2)}]`,
        `/TrimBox [${trimLeft.toFixed(2)} ${trimBottom.toFixed(2)} ${trimRight.toFixed(2)} ${trimTop.toFixed(2)}]`,
        `/BleedBox [${bleedLeft.toFixed(2)} ${bleedBottom.toFixed(2)} ${bleedRight.toFixed(2)} ${bleedTop.toFixed(2)}]`,
        `/Contents ${contentObjId} 0 R`,
        `/Resources ${resourceDict}`,
        '>>'
      ].join(' ')
    });

    this.objects.push({
      id: pagesObjId,
      content: `<< /Type /Pages /Kids [${pageObjId} 0 R] /Count 1 >>`
    });

    this.objects.push({
      id: catalogObjId,
      content: `<< /Type /Catalog /Pages ${pagesObjId} 0 R >>`
    });

    // 7. Serialize PDF Document & Cross-Reference Table
    return this.serializePdf(catalogObjId);
  }

  private async renderNode(node: LayoutNode, ops: string[], isCmyk: boolean): Promise<void> {
    if (node.opacity !== undefined && node.opacity <= 0) return;

    ops.push('q'); // save graphics state

    // Opacity
    if (node.opacity !== undefined && node.opacity < 1) {
      const gsName = this.getOrCreateExtGState(node.opacity);
      ops.push(`${gsName} gs`);
    }

    // Transform
    if (node.style.rotation) {
      const rad = (node.style.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      ops.push(`1 0 0 1 ${cx.toFixed(2)} ${cy.toFixed(2)} cm`);
      ops.push(`${cos.toFixed(4)} ${sin.toFixed(4)} ${(-sin).toFixed(4)} ${cos.toFixed(4)} 0 0 cm`);
      ops.push(`1 0 0 1 ${(-cx).toFixed(2)} ${(-cy).toFixed(2)} cm`);
    }

    switch (node.type) {
      case 'rect': {
        this.renderRect(node, ops, isCmyk);
        break;
      }
      case 'circle': {
        this.renderCircle(node, ops, isCmyk);
        break;
      }
      case 'polygon': {
        this.renderPolygon(node, ops, isCmyk);
        break;
      }
      case 'text': {
        this.renderText(node, ops, isCmyk);
        break;
      }
      case 'path': {
        this.renderPath(node, ops, isCmyk);
        break;
      }
      case 'star':
      case 'triangle':
      case 'arrow':
      case 'cross': {
        const d = generateShapePath(node.type, node.box);
        this.renderPath(node, ops, isCmyk, d);
        break;
      }
      case 'shape': {
        const shapeType = node.shapeType || 'star';
        const d = generateShapePath(shapeType, node.box);
        this.renderPath(node, ops, isCmyk, d);
        break;
      }
      case 'icon': {
        const iconName = node.iconName || (node as any).icon;
        if (iconName) {
          const d = getIconPath(iconName);
          if (d) {
            this.renderPath(node, ops, isCmyk, d);
          }
        }
        break;
      }
    }

    ops.push('Q'); // restore graphics state
  }

  private renderRect(node: LayoutNode, ops: string[], isCmyk: boolean): void {
    const { x, y, width: w, height: h } = node;
    const r = node.style.borderRadius;

    if (r && (typeof r === 'number' ? r > 0 : Array.isArray(r) && r.some(v => v > 0))) {
      this.drawRoundedRectPath(ops, x, y, w, h, r);
    } else {
      ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
    }

    this.applyFillAndStroke(node, ops, isCmyk);
  }

  private renderCircle(node: LayoutNode, ops: string[], isCmyk: boolean): void {
    const rx = node.width / 2;
    const ry = node.height / 2;
    const cx = node.x + rx;
    const cy = node.y + ry;

    const kappa = 0.5522847498;
    const kx = rx * kappa;
    const ky = ry * kappa;

    ops.push(`${(cx - rx).toFixed(2)} ${cy.toFixed(2)} m`);
    ops.push(`${(cx - rx).toFixed(2)} ${(cy - ky).toFixed(2)} ${(cx - kx).toFixed(2)} ${(cy - ry).toFixed(2)} ${cx.toFixed(2)} ${(cy - ry).toFixed(2)} c`);
    ops.push(`${(cx + kx).toFixed(2)} ${(cy - ry).toFixed(2)} ${(cx + rx).toFixed(2)} ${(cy - ky).toFixed(2)} ${(cx + rx).toFixed(2)} ${cy.toFixed(2)} c`);
    ops.push(`${(cx + rx).toFixed(2)} ${(cy + ky).toFixed(2)} ${(cx + kx).toFixed(2)} ${(cy + ry).toFixed(2)} ${cx.toFixed(2)} ${(cy + ry).toFixed(2)} c`);
    ops.push(`${(cx - kx).toFixed(2)} ${(cy + ry).toFixed(2)} ${(cx - rx).toFixed(2)} ${(cy + ky).toFixed(2)} ${(cx - rx).toFixed(2)} ${cy.toFixed(2)} c`);
    ops.push('h');

    this.applyFillAndStroke(node, ops, isCmyk);
  }

  private renderPolygon(node: LayoutNode, ops: string[], isCmyk: boolean): void {
    const pts = node.polygonLayout?.canvasPoints;
    if (!pts || pts.length < 3) return;

    ops.push(`${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)} m`);
    for (let i = 1; i < pts.length; i++) {
      ops.push(`${pts[i]!.x.toFixed(2)} ${pts[i]!.y.toFixed(2)} l`);
    }
    ops.push('h');

    this.applyFillAndStroke(node, ops, isCmyk);
  }

  private renderPath(node: LayoutNode, ops: string[], isCmyk: boolean, customD?: string): void {
    const d = customD || node.pathLayout?.d || (node as any).d;
    if (!d) return;

    const subpaths = svgPathToSubpaths(d);
    if (!subpaths || subpaths.length === 0) return;

    for (const sp of subpaths) {
      if (!sp.segments || sp.segments.length === 0) continue;
      const p0 = sp.segments[0]!.p0;
      ops.push(`${(p0.x + node.x).toFixed(2)} ${(p0.y + node.y).toFixed(2)} m`);
      for (const seg of sp.segments) {
        ops.push(
          `${(seg.cp1.x + node.x).toFixed(2)} ${(seg.cp1.y + node.y).toFixed(2)} ` +
          `${(seg.cp2.x + node.x).toFixed(2)} ${(seg.cp2.y + node.y).toFixed(2)} ` +
          `${(seg.p1.x + node.x).toFixed(2)} ${(seg.p1.y + node.y).toFixed(2)} c`
        );
      }
      if (sp.closed) {
        ops.push('h');
      }
    }

    this.applyFillAndStroke(node, ops, isCmyk);
  }

  private renderText(node: LayoutNode, ops: string[], isCmyk: boolean): void {
    const tLayout = node.textLayout;
    if (!tLayout || !tLayout.lines || tLayout.lines.length === 0) return;

    const fontColor = parsePdfColor(node.style.color || '#000000', isCmyk);
    this.emitFillColor(ops, fontColor);

    const fontSize = tLayout.fontSize || 16;
    const lineHeight = tLayout.lineHeight || fontSize * 1.2;
    const capOffset = tLayout.opticalCenterOffset || 0;

    const isMiddle = node.style.verticalAlign === 'middle';
    const startY = isMiddle
      ? node.y + (node.height - (tLayout.lines.length - 1) * lineHeight) / 2 + capOffset
      : node.y + fontSize * 0.85;

    ops.push('BT');
    ops.push(`/F1 ${fontSize.toFixed(2)} Tf`);

    for (let i = 0; i < tLayout.lines.length; i++) {
      const line = tLayout.lines[i]!;
      const y = startY + i * lineHeight;
      let x = node.x;

      if (node.style.align === 'center') {
        const lineWidth = tLayout.width || 0;
        x = node.x + (node.width - lineWidth) / 2;
      } else if (node.style.align === 'right') {
        const lineWidth = tLayout.width || 0;
        x = node.x + (node.width - lineWidth);
      }

      // Escape parentheses and backslashes for PDF string literal
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      // Counter-flip vertical axis in text matrix (1 0 0 -1) so glyphs render right-side up
      ops.push(`1 0 0 -1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`);
      ops.push(`(${escaped}) Tj`);
    }

    ops.push('ET');
  }

  private applyFillAndStroke(node: LayoutNode, ops: string[], isCmyk: boolean): void {
    const hasFill = node.fill !== undefined && node.fill !== 'none';
    const hasStroke = node.stroke !== undefined && node.stroke !== 'none' && (node.style.strokeWidth ?? 1) > 0;

    if (hasFill && typeof node.fill === 'string') {
      const fillColor = parsePdfColor(node.fill, isCmyk);
      this.emitFillColor(ops, fillColor);
    }

    if (hasStroke && node.stroke) {
      const strokeColor = parsePdfColor(node.stroke, isCmyk);
      this.emitStrokeColor(ops, strokeColor);
      const sw = node.style.strokeWidth ?? 1;
      ops.push(`${sw.toFixed(2)} w`);
    }

    if (hasFill && hasStroke) {
      ops.push('B'); // fill and stroke
    } else if (hasFill) {
      ops.push('f'); // fill
    } else if (hasStroke) {
      ops.push('S'); // stroke
    } else {
      ops.push('n'); // no-op path cleanup
    }
  }

  private emitFillColor(ops: string[], color: PdfColor): void {
    if (color.mode === 'cmyk') {
      ops.push(`${color.c!.toFixed(4)} ${color.m!.toFixed(4)} ${color.y!.toFixed(4)} ${color.k!.toFixed(4)} k`);
    } else {
      ops.push(`${color.r!.toFixed(4)} ${color.g!.toFixed(4)} ${color.b!.toFixed(4)} rg`);
    }
  }

  private emitStrokeColor(ops: string[], color: PdfColor): void {
    if (color.mode === 'cmyk') {
      ops.push(`${color.c!.toFixed(4)} ${color.m!.toFixed(4)} ${color.y!.toFixed(4)} ${color.k!.toFixed(4)} K`);
    } else {
      ops.push(`${color.r!.toFixed(4)} ${color.g!.toFixed(4)} ${color.b!.toFixed(4)} RG`);
    }
  }

  private drawRoundedRectPath(
    ops: string[],
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number | [number, number, number, number]
  ): void {
    const [tl, tr, br, bl] = Array.isArray(radius)
      ? [radius[0] || 0, radius[1] || 0, radius[2] || 0, radius[3] || 0]
      : [radius, radius, radius, radius];

    const k = 0.5522847498;

    ops.push(`${(x + tl).toFixed(2)} ${y.toFixed(2)} m`);
    ops.push(`${(x + w - tr).toFixed(2)} ${y.toFixed(2)} l`);
    if (tr > 0) {
      ops.push(`${(x + w - tr + tr * k).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + tr - tr * k).toFixed(2)} ${(x + w).toFixed(2)} ${(y + tr).toFixed(2)} c`);
    }
    ops.push(`${(x + w).toFixed(2)} ${(y + h - br).toFixed(2)} l`);
    if (br > 0) {
      ops.push(`${(x + w).toFixed(2)} ${(y + h - br + br * k).toFixed(2)} ${(x + w - br + br * k).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - br).toFixed(2)} ${(y + h).toFixed(2)} c`);
    }
    ops.push(`${(x + bl).toFixed(2)} ${(y + h).toFixed(2)} l`);
    if (bl > 0) {
      ops.push(`${(x + bl - bl * k).toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - bl + bl * k).toFixed(2)} ${x.toFixed(2)} ${(y + h - bl).toFixed(2)} c`);
    }
    ops.push(`${x.toFixed(2)} ${(y + tl).toFixed(2)} l`);
    if (tl > 0) {
      ops.push(`${x.toFixed(2)} ${(y + tl - tl * k).toFixed(2)} ${(x + tl - tl * k).toFixed(2)} ${y.toFixed(2)} ${(x + tl).toFixed(2)} ${y.toFixed(2)} c`);
    }
    ops.push('h');
  }

  private renderPrepressMarks(
    ops: string[],
    w: number,
    h: number,
    bleed: number,
    margin: number
  ): void {
    const markLength = 18;
    const markOffset = 4;
    ops.push('q');
    ops.push('0 0 0 1 K'); // Registration black stroke
    ops.push('0.5 w');

    // Top-left corner
    ops.push(`${(-markOffset).toFixed(2)} 0 m ${(-markOffset - markLength).toFixed(2)} 0 l S`);
    ops.push(`0 ${(-markOffset).toFixed(2)} m 0 ${(-markOffset - markLength).toFixed(2)} l S`);

    // Top-right corner
    ops.push(`${(w + markOffset).toFixed(2)} 0 m ${(w + markOffset + markLength).toFixed(2)} 0 l S`);
    ops.push(`${w.toFixed(2)} ${(-markOffset).toFixed(2)} m ${w.toFixed(2)} ${(-markOffset - markLength).toFixed(2)} l S`);

    // Bottom-left corner
    ops.push(`${(-markOffset).toFixed(2)} ${h.toFixed(2)} m ${(-markOffset - markLength).toFixed(2)} ${h.toFixed(2)} l S`);
    ops.push(`0 ${(h + markOffset).toFixed(2)} m 0 ${(h + markOffset + markLength).toFixed(2)} l S`);

    // Bottom-right corner
    ops.push(`${(w + markOffset).toFixed(2)} ${h.toFixed(2)} m ${(w + markOffset + markLength).toFixed(2)} ${h.toFixed(2)} l S`);
    ops.push(`${w.toFixed(2)} ${(h + markOffset).toFixed(2)} m ${w.toFixed(2)} ${(h + markOffset + markLength).toFixed(2)} l S`);

    // Registration Crosshairs at centers
    const drawCross = (cx: number, cy: number) => {
      ops.push(`${(cx - 8).toFixed(2)} ${cy.toFixed(2)} m ${(cx + 8).toFixed(2)} ${cy.toFixed(2)} l S`);
      ops.push(`${cx.toFixed(2)} ${(cy - 8).toFixed(2)} m ${cx.toFixed(2)} ${(cy + 8).toFixed(2)} l S`);
    };

    drawCross(w / 2, -markOffset - markLength / 2);
    drawCross(w / 2, h + markOffset + markLength / 2);
    drawCross(-markOffset - markLength / 2, h / 2);
    drawCross(w + markOffset + markLength / 2, h / 2);

    ops.push('Q');
  }

  private getOrCreateExtGState(opacity: number): string {
    const key = opacity.toFixed(3);
    if (!this.extGStates.has(key)) {
      this.extGStates.set(key, this.extGStates.size + 1);
    }
    return `/GS${this.extGStates.get(key)}`;
  }

  private serializePdf(catalogId: number): Buffer {
    const chunks: Buffer[] = [];
    chunks.push(Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary'));

    const offsets: number[] = [0]; // object 0 is unused
    let currentOffset = chunks[0]!.length;

    // Sort objects by id
    this.objects.sort((a, b) => a.id - b.id);

    for (const obj of this.objects) {
      offsets[obj.id] = currentOffset;
      const header = Buffer.from(`${obj.id} 0 obj\n`, 'ascii');
      const footer = Buffer.from('\nendobj\n', 'ascii');
      const body = Buffer.isBuffer(obj.content) ? obj.content : Buffer.from(obj.content, 'utf-8');

      chunks.push(header, body, footer);
      currentOffset += header.length + body.length + footer.length;
    }

    const startXref = currentOffset;
    let xref = `xref\n0 ${this.objects.length + 1}\n0000000000 65535 f \n`;

    for (let id = 1; id <= this.objects.length; id++) {
      const off = String(offsets[id] || 0).padStart(10, '0');
      xref += `${off} 00000 n \n`;
    }

    xref += `trailer\n<< /Size ${this.objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, 'ascii'));

    return Buffer.concat(chunks);
  }
}

/**
 * High-level export helper for PDF.
 */
export async function exportToPdfBuffer(
  layout: LayoutResult,
  options: PdfExportOptions = {}
): Promise<Buffer> {
  const exporter = new PdfExporter(options);
  return exporter.export(layout, options);
}
