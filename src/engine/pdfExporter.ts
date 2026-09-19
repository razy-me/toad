/**
 * src/engine/pdfExporter.ts
 * Standalone Prepress Vector PDF Compiler for the "toad" declarative design language.
 * Generates vector PDF 1.4 / 1.6 documents with precise prepress page geometry
 * (/MediaBox, /TrimBox, /BleedBox), native /DeviceCMYK & /DeviceRGB color streams,
 * vector shapes, text elements, embedded images, and print crop marks.
 */

import * as zlib from 'node:zlib';
import * as fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { LayoutResult, LayoutNode } from '../parser/math.js';
import { parseColorToRgba } from './drawUtils.js';
import { resolveSharedImage } from './imageCache.js';
import { svgPathToSubpaths } from './vectorPathParser.js';
import { FontLoader } from './fontLoader.js';

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

  // Direct CMYK string detection (supports cmyk(), device-cmyk(), and CSS slash alpha notation e.g. cmyk(0 0 0 1 / 0.5))
  const cmykMatch = colorStr.match(/(?:device-)?cmyk\s*\(\s*(-?[0-9.]+)(%?)[,\s]+(-?[0-9.]+)(%?)[,\s]+(-?[0-9.]+)(%?)[,\s]+(-?[0-9.]+)(%?)(?:\s*(?:,\s*|\/\s*)(-?[0-9.]+)(%?))?\s*\)/i);
  if (cmykMatch) {
    const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
    const parseVal = (v: string, isPct: string) => {
      const num = parseFloat(v);
      if (!Number.isFinite(num)) return 0;
      const val = isPct ? num / 100 : (num > 1 ? num / 100 : num);
      return clamp01(val);
    };
    const c = parseVal(cmykMatch[1]!, cmykMatch[2]!);
    const m = parseVal(cmykMatch[3]!, cmykMatch[4]!);
    const y = parseVal(cmykMatch[5]!, cmykMatch[6]!);
    const k = parseVal(cmykMatch[7]!, cmykMatch[8]!);
    const opacity = cmykMatch[9] !== undefined ? parseVal(cmykMatch[9]!, cmykMatch[10] || '') : 1;
    return { mode: 'cmyk', c, m, y, k, opacity };
  }

  const rgba = parseColorToRgba(colorStr);
  if (forceCmyk) {
    const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
    const rNorm = clamp01(rgba.r / 255);
    const gNorm = clamp01(rgba.g / 255);
    const bNorm = clamp01(rgba.b / 255);
    const k = 1 - Math.max(rNorm, gNorm, bNorm);
    if (k >= 1) {
      return { mode: 'cmyk', c: 0, m: 0, y: 0, k: 1, opacity: clamp01(rgba.a) };
    }
    const c = clamp01((1 - rNorm - k) / (1 - k));
    const m = clamp01((1 - gNorm - k) / (1 - k));
    const y = clamp01((1 - bNorm - k) / (1 - k));
    return {
      mode: 'cmyk',
      c: Number(c.toFixed(4)),
      m: Number(m.toFixed(4)),
      y: Number(y.toFixed(4)),
      k: Number(clamp01(k).toFixed(4)),
      opacity: clamp01(rgba.a)
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

export const STANDARD_PDF_FONTS: Record<string, string> = {
  F1: 'Helvetica',
  F2: 'Helvetica-Bold',
  F3: 'Helvetica-Oblique',
  F4: 'Helvetica-BoldOblique',
  F5: 'Times-Roman',
  F6: 'Times-Bold',
  F7: 'Times-Italic',
  F8: 'Times-BoldItalic',
  F9: 'Courier',
  F10: 'Courier-Bold',
  F11: 'Courier-Oblique',
  F12: 'Courier-BoldOblique'
};

export class PdfExporter {
  private objects: Array<{ id: number; content: string | Buffer }> = [];
  private nextObjectId = 1;
  private extGStates = new Map<string, number>(); // opacity -> GS id
  private images = new Map<string, { id: number; name: string; width: number; height: number }>();
  private customFontMap = new Map<string, string>(); // psName -> tag
  private basePath?: string;

  private measureCtx: any = null;

  constructor(options: PdfExportOptions = {}) {
    this.basePath = options.basePath;
  }

  private measureLineWidth(line: string, fontSize: number, fontFamily?: string): number {
    try {
      if (!this.measureCtx) {
        this.measureCtx = createCanvas(10, 10).getContext('2d');
      }
      this.measureCtx.font = `${fontSize}px ${fontFamily || 'sans-serif'}`;
      return this.measureCtx.measureText(line).width;
    } catch {
      const fam = (fontFamily || '').toLowerCase();
      const isMono = fam.includes('courier') || fam.includes('mono') || fam.includes('code') || fam.includes('consolas');
      const isCondensed = fam.includes('condensed') || fam.includes('narrow') || fam.includes('compressed');
      return line.length * fontSize * (isMono ? 0.60 : isCondensed ? 0.45 : 0.52);
    }
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
    this.customFontMap.clear();

    const scale = options.scale && options.scale > 0 ? options.scale : 1;
    const bleed = options.bleed !== undefined ? options.bleed : (layout.canvas.bleed || 0);
    const cropMarks = options.cropMarks !== undefined ? options.cropMarks : (layout.canvas.cropMarks === true);
    const margin = Math.max(cropMarks ? 36 : 0, bleed > 0 ? bleed : 0);

    const baseW = layout.canvas.width;
    const baseH = layout.canvas.height;
    const mediaW = (baseW + 2 * margin) * scale;
    const mediaH = (baseH + 2 * margin) * scale;

    const isCmyk = options.colorMode === 'cmyk' || (layout.canvas as any).colorMode === 'cmyk';

    // 1. Generate Page Content Stream
    const streamOps: string[] = [];

    // Flip PDF coordinate system (origin bottom-left -> top-left matching canvas)
    streamOps.push(`1 0 0 -1 0 ${mediaH.toFixed(2)} cm`);

    if (scale !== 1) {
      streamOps.push(`${scale.toFixed(4)} 0 0 ${scale.toFixed(4)} 0 0 cm`);
    }

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

    // 3. Draw Layout Nodes (render root nodes recursively to preserve parent-child transforms)
    const rootNodes = layout.rootNodes || layout.nodes.filter(n => !n.parentId && !n.parent);
    for (const node of (rootNodes.length > 0 ? rootNodes : layout.nodes)) {
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
    const trimLeft = margin * scale;
    const trimBottom = margin * scale;
    const trimRight = (margin + baseW) * scale;
    const trimTop = (margin + baseH) * scale;

    const bleedLeft = (margin - bleed) * scale;
    const bleedBottom = (margin - bleed) * scale;
    const bleedRight = (margin + baseW + bleed) * scale;
    const bleedTop = (margin + baseH + bleed) * scale;

    const pageObjId = this.allocId();
    const catalogObjId = this.allocId();
    const pagesObjId = this.allocId();

    const customFontEntries: string[] = [];
    for (const [psName, tag] of this.customFontMap.entries()) {
      const face = FontLoader.getFaceByPostScriptName(psName);
      let fontStreamObjId: number | undefined;
      let fontFileClause = '';

      if (face?.filePath && fs.existsSync(face.filePath) && face.filePath.toLowerCase().endsWith('.ttf')) {
        try {
          const fontBuf = fs.readFileSync(face.filePath);
          fontStreamObjId = this.allocId();
          const streamHeader = Buffer.from(`<< /Length ${fontBuf.length} /Length1 ${fontBuf.length} >>\nstream\n`, 'ascii');
          const streamFooter = Buffer.from('\nendstream', 'ascii');
          this.objects.push({
            id: fontStreamObjId,
            content: Buffer.concat([streamHeader, fontBuf, streamFooter])
          });
          fontFileClause = ` /FontFile2 ${fontStreamObjId} 0 R`;
        } catch {
          // Fallback to font descriptor without stream
        }
      }

      // Calculate accurate character widths for chars 32..255 (REG-19)
      const widthsArray: number[] = [];
      try {
        if (!this.measureCtx) {
          this.measureCtx = createCanvas(10, 10).getContext('2d');
        }
        this.measureCtx.font = `100px "${face?.originalFamily || psName}"`;
        for (let c = 32; c <= 255; c++) {
          const charStr = String.fromCharCode(c);
          const w = Math.round(this.measureCtx.measureText(charStr).width * 10);
          widthsArray.push(Number.isFinite(w) && w > 0 ? w : 600);
        }
      } catch {
        for (let c = 32; c <= 255; c++) widthsArray.push(600);
      }
      const widths = widthsArray.join(' ');

      const fontDescId = this.allocId();
      const fontObjId = this.allocId();
      this.objects.push({
        id: fontDescId,
        content: `<< /Type /FontDescriptor /FontName /${psName} /Flags 32 /ItalicAngle 0 /Ascent 750 /Descent -250 /CapHeight 700 /StemV 80${fontFileClause} >>`
      });
      this.objects.push({
        id: fontObjId,
        content: `<< /Type /Font /Subtype /TrueType /BaseFont /${psName} /FirstChar 32 /LastChar 255 /Widths [${widths}] /FontDescriptor ${fontDescId} 0 R /Encoding /WinAnsiEncoding >>`
      });
      customFontEntries.push(`${tag} ${fontObjId} 0 R`);
    }

    const fontEntries = [
      ...Object.entries(STANDARD_PDF_FONTS)
        .map(([tag, name]) => `/${tag} << /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`),
      ...customFontEntries
    ].join(' ');

    const xObjectEntries: string[] = [];
    for (const imgData of this.images.values()) {
      xObjectEntries.push(`/${imgData.name} ${imgData.id} 0 R`);
    }

    const resourceDict = [
      '<<',
      '/ProcSet [/PDF /Text /ImageB /ImageC /ImageI]',
      gstateEntries.length > 0 ? `/ExtGState << ${gstateEntries.join(' ')} >>` : '',
      `/Font << ${fontEntries} >>`,
      xObjectEntries.length > 0 ? `/XObject << ${xObjectEntries.join(' ')} >>` : '',
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
      case 'path':
      case 'star':
      case 'triangle':
      case 'arrow':
      case 'cross':
      case 'shape':
      case 'icon': {
        const d = node.pathLayout?.d;
        if (d) {
          this.renderPath(node, ops, isCmyk, d);
        }
        break;
      }
      case 'qrcode': {
        const d = node.pathLayout?.d;
        if (d) {
          const effectiveFill = node.fill || node.style.fill || '#000000';
          this.renderPath({ ...node, fill: effectiveFill }, ops, isCmyk, d);
        }
        break;
      }
      case 'barcode': {
        const d = node.pathLayout?.d;
        if (d) {
          const effectiveFill = node.fill || node.style.fill || '#000000';
          this.renderPath({ ...node, fill: effectiveFill }, ops, isCmyk, d);
        }
        if (node.barcodeLayout?.showText && node.barcodeLayout.text) {
          const fontSize = Math.max(10, Math.min(16, Math.floor(node.height * 0.18)));
          const text = node.barcodeLayout.text;
          const lineWidth = this.measureLineWidth(text, fontSize, 'Courier');
          const textX = node.x + (node.width - lineWidth) / 2;
          const textY = node.y + node.height - (fontSize * 0.25);
          const textColor = parsePdfColor(
            typeof (node.style.fill || node.fill) === 'string' ? (node.style.fill || node.fill) as string : '#000000',
            isCmyk
          );
          this.emitFillColor(ops, textColor);
          ops.push('BT');
          ops.push(`/F9 ${fontSize.toFixed(2)} Tf`);
          const escaped = this.encodePdfString(text);
          ops.push(`1 0 0 -1 ${textX.toFixed(2)} ${textY.toFixed(2)} Tm`);
          ops.push(`(${escaped}) Tj`);
          ops.push('ET');
        }
        break;
      }
      case 'image': {
        await this.renderImage(node, ops);
        break;
      }
      case 'group':
      case 'stack':
      case 'grid': {
        if (node.fill || node.stroke) {
          this.renderRect(node, ops, isCmyk);
        }
        if (node.children && node.children.length > 0) {
          for (const child of node.children) {
            await this.renderNode(child, ops, isCmyk);
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

    const isIcon = node.type === 'icon';
    const sx = isIcon ? (node.width / 24) : 1;
    const sy = isIcon ? (node.height / 24) : 1;

    for (const sp of subpaths) {
      if (!sp.segments || sp.segments.length === 0) continue;
      const p0 = sp.segments[0]!.p0;
      ops.push(`${(p0.x * sx + node.x).toFixed(2)} ${(p0.y * sy + node.y).toFixed(2)} m`);
      for (const seg of sp.segments) {
        ops.push(
          `${(seg.cp1.x * sx + node.x).toFixed(2)} ${(seg.cp1.y * sy + node.y).toFixed(2)} ` +
          `${(seg.cp2.x * sx + node.x).toFixed(2)} ${(seg.cp2.y * sy + node.y).toFixed(2)} ` +
          `${(seg.p1.x * sx + node.x).toFixed(2)} ${(seg.p1.y * sy + node.y).toFixed(2)} c`
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

    const fontTag = this.resolveFontTag(tLayout.fontFamily || (node.style as any).fontFamily, (node.style as any).fontWeight, (node.style as any).fontStyle);
    ops.push('BT');
    ops.push(`${fontTag} ${fontSize.toFixed(2)} Tf`);

    const align = node.style.align || (node.style as any).textAlign || 'left';

    for (let i = 0; i < tLayout.lines.length; i++) {
      const line = tLayout.lines[i]!;
      const y = startY + i * lineHeight;
      let x = node.x;

      if (align === 'center') {
        const lineWidth = this.measureLineWidth(line, fontSize, tLayout.fontFamily);
        x = node.x + (node.width - lineWidth) / 2;
      } else if (align === 'right') {
        const lineWidth = this.measureLineWidth(line, fontSize, tLayout.fontFamily);
        x = node.x + (node.width - lineWidth);
      }

      // Escape characters and WinAnsi glyphs for PDF Type 1 string literal
      const escaped = this.encodePdfString(line);
      // Counter-flip vertical axis in text matrix (1 0 0 -1) so glyphs render right-side up
      ops.push(`1 0 0 -1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`);
      ops.push(`(${escaped}) Tj`);
    }

    ops.push('ET');
  }

  private resolveFontTag(fontFamily?: string, fontWeight?: string | number, fontStyle?: string): string {
    if (fontFamily) {
      const psName = FontLoader.resolvePostScriptName(fontFamily, fontWeight, fontStyle);
      if (psName && !['Helvetica', 'Times-Roman', 'Courier'].some(std => psName.startsWith(std))) {
        let tag = this.customFontMap.get(psName);
        if (!tag) {
          tag = `/CF${this.customFontMap.size + 1}`;
          this.customFontMap.set(psName, tag);
        }
        return tag;
      }
    }

    const fam = (fontFamily || '').toLowerCase();
    const isBold = fontWeight === 'bold' || fontWeight === 'semibold' || fontWeight === 'extrabold' ||
      (typeof fontWeight === 'number' ? fontWeight >= 600 : parseInt(String(fontWeight), 10) >= 600);
    const isItalic = fontStyle === 'italic' || fontStyle === 'oblique';

    if (fam.includes('courier') || fam.includes('mono') || fam.includes('code') || fam.includes('consolas')) {
      if (isBold && isItalic) return '/F12';
      if (isItalic) return '/F11';
      if (isBold) return '/F10';
      return '/F9';
    }
    if (fam.includes('times') || fam.includes('serif')) {
      if (isBold && isItalic) return '/F8';
      if (isItalic) return '/F7';
      if (isBold) return '/F6';
      return '/F5';
    }
    if (isBold && isItalic) return '/F4';
    if (isItalic) return '/F3';
    if (isBold) return '/F2';
    return '/F1';
  }

  private async renderImage(node: LayoutNode, ops: string[]): Promise<void> {
    const imgSrc = node.imageLayout?.src;
    if (!imgSrc) return;

    let img: any = null;
    try {
      img = await resolveSharedImage(imgSrc, this.basePath);
    } catch {
      img = null;
    }

    if (!img) {
      // Draw placeholder rectangle if image not found
      ops.push('q');
      ops.push('0.886 0.910 0.941 rg'); // #e2e8f0
      ops.push('0.580 0.639 0.722 RG'); // #94a3b8
      ops.push('1 w');
      ops.push(`${node.x.toFixed(2)} ${node.y.toFixed(2)} ${node.width.toFixed(2)} ${node.height.toFixed(2)} re B`);
      ops.push('Q');
      return;
    }

    const imgKey = imgSrc;
    let imgInfo = this.images.get(imgKey);
    if (!imgInfo) {
      let imgW = img.width;
      let imgH = img.height;
      // F-066: Limit maximum image dimension to avoid gigabyte memory explosions
      const MAX_PDF_IMG_DIM = 4096;
      if (imgW > MAX_PDF_IMG_DIM || imgH > MAX_PDF_IMG_DIM) {
        const scale = Math.min(MAX_PDF_IMG_DIM / imgW, MAX_PDF_IMG_DIM / imgH);
        imgW = Math.max(1, Math.round(imgW * scale));
        imgH = Math.max(1, Math.round(imgH * scale));
      }

      const imgCanvas = createCanvas(imgW, imgH);
      const ictx = imgCanvas.getContext('2d');
      ictx.drawImage(img, 0, 0, imgW, imgH);
      const imgData = ictx.getImageData(0, 0, imgW, imgH).data;

      // Free native Skia surface memory
      imgCanvas.width = 1;
      imgCanvas.height = 1;

      const totalPixels = imgW * imgH;
      const rgbBuf = Buffer.alloc(totalPixels * 3);
      let alphaBuf: Buffer | null = null;
      let hasAlpha = false;

      for (let i = 0, j = 0, a = 0; i < imgData.length; i += 4, j += 3, a++) {
        rgbBuf[j] = imgData[i]!;
        rgbBuf[j + 1] = imgData[i + 1]!;
        rgbBuf[j + 2] = imgData[i + 2]!;
        const alphaVal = imgData[i + 3]!;
        if (alphaVal < 255) {
          if (!hasAlpha) {
            hasAlpha = true;
            alphaBuf = Buffer.alloc(totalPixels, 255);
          }
          alphaBuf![a] = alphaVal;
        }
      }

      const compressedRgb = zlib.deflateSync(rgbBuf);
      let sMaskRef = '';

      // F-076: Generate /SMask for images with transparency
      if (hasAlpha && alphaBuf) {
        const compressedAlpha = zlib.deflateSync(alphaBuf);
        const sMaskObjId = this.allocId();
        this.objects.push({
          id: sMaskObjId,
          content: Buffer.concat([
            Buffer.from(
              `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${compressedAlpha.length} /Filter /FlateDecode >>\nstream\n`,
              'ascii'
            ),
            compressedAlpha,
            Buffer.from('\nendstream', 'ascii')
          ])
        });
        sMaskRef = ` /SMask ${sMaskObjId} 0 R`;
      }

      const imgObjId = this.allocId();
      this.objects.push({
        id: imgObjId,
        content: Buffer.concat([
          Buffer.from(
            `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8${sMaskRef} /Length ${compressedRgb.length} /Filter /FlateDecode >>\nstream\n`,
            'ascii'
          ),
          compressedRgb,
          Buffer.from('\nendstream', 'ascii')
        ])
      });
      const imgName = `Im${this.images.size + 1}`;
      imgInfo = { id: imgObjId, name: imgName, width: imgW, height: imgH };
      this.images.set(imgKey, imgInfo);
    }

    const { x, y, width: w, height: h } = node;
    ops.push('q');
    ops.push(`${w.toFixed(2)} 0 0 ${(-h).toFixed(2)} ${x.toFixed(2)} ${(y + h).toFixed(2)} cm`);
    ops.push(`/${imgInfo.name} Do`);
    ops.push('Q');
  }

  private encodePdfString(text: string): string {
    const SYMBOL_TRANSLITERATIONS: Record<string, string> = {
      // Arrows & Math
      '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '⇐': '<=', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~=', '±': '+/-',
      '×': 'x', '÷': '/', '√': 'sqrt', '∞': 'inf', '°': ' deg', 'µ': 'u',
      // Checkmarks & Icons
      '✓': '[v]', '✔': '[v]', '✗': '[x]', '✘': '[x]', '★': '*', '☆': '*', '♥': '<3',
      // Punctuation & Quotes
      '—': '--', '–': '-', '―': '--', '…': '...', '“': '"', '”': '"', '‘': "'", '’': "'", '«': '<<', '»': '>>',
      '·': '.',
      // Spaces
      '\u00A0': ' ', '\u2002': ' ', '\u2003': ' ', '\u2009': ' ', '\u200B': '',
      // Extended Latin
      'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ß': 'ss', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ş': 's', 'Ş': 'S',
      'č': 'c', 'Č': 'C', 'ć': 'c', 'Ć': 'C', 'ř': 'r', 'Ř': 'R', 'šť': 'st', 'ť': 't', 'Ť': 'T', 'ď': 'd', 'Ď': 'D',
      'ň': 'n', 'Ň': 'N', 'ő': 'o', 'Ő': 'O', 'ű': 'u', 'Ű': 'U', 'ą': 'a', 'Ą': 'A', 'ę': 'e', 'Ę': 'E',
      'ż': 'z', 'Ż': 'Z', 'ź': 'z', 'Ź': 'Z', 'ń': 'n', 'Ń': 'N', 'ś': 's', 'Ś': 'S',
      // Cyrillic
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z', 'И': 'I',
      'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T',
      'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '',
      'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
      'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
      'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '',
      'э': 'e', 'ю': 'yu', 'я': 'ya',
      'І': 'I', 'і': 'i', 'Ї': 'Yi', 'ї': 'yi', 'Є': 'Ye', 'є': 'ye', 'Ґ': 'G', 'ґ': 'g',
      // Greek
      'Α': 'A', 'Β': 'B', 'Γ': 'G', 'Δ': 'D', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'E', 'Θ': 'Th', 'Ι': 'I', 'Κ': 'K',
      'Λ': 'L', 'Μ': 'M', 'Ν': 'N', 'Ξ': 'X', 'Ο': 'O', 'Π': 'P', 'Ρ': 'R', 'Σ': 'S', 'Τ': 'T', 'Υ': 'Y',
      'Φ': 'Ph', 'Χ': 'Ch', 'Ψ': 'Ps', 'Ω': 'O',
      'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'e', 'θ': 'th', 'ι': 'i', 'κ': 'k',
      'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't',
      'υ': 'y', 'φ': 'ph', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o'
    };

    const WIN_ANSI_MAP: Record<string, number> = {
      '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135,
      'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142,
      '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151,
      '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159
    };

    let out = '';
    for (let i = 0; i < text.length; i++) {
      let ch = text[i]!;
      if (SYMBOL_TRANSLITERATIONS[ch]) {
        ch = SYMBOL_TRANSLITERATIONS[ch]!;
      }

      for (let j = 0; j < ch.length; j++) {
        const subCh = ch[j]!;
        const code = subCh.charCodeAt(0);

        if (subCh === '\\') {
          out += '\\\\';
        } else if (subCh === '(') {
          out += '\\(';
        } else if (subCh === ')') {
          out += '\\)';
        } else if (code >= 32 && code <= 126) {
          out += subCh;
        } else if (code >= 160 && code <= 255) {
          out += '\\' + code.toString(8).padStart(3, '0');
        } else if (WIN_ANSI_MAP[subCh]) {
          out += '\\' + WIN_ANSI_MAP[subCh]!.toString(8).padStart(3, '0');
        } else {
          // Decompose accented characters outside WinAnsi
          const decomposed = subCh.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          let handled = false;
          if (decomposed && decomposed !== subCh) {
            const decCode = decomposed.charCodeAt(0);
            if (decCode >= 32 && decCode <= 126) {
              out += decomposed;
              handled = true;
            } else if (decCode >= 160 && decCode <= 255) {
              out += '\\' + decCode.toString(8).padStart(3, '0');
              handled = true;
            }
          }
          if (!handled) {
            out += '?';
          }
        }
      }
    }
    return out;
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
    radius: number | [number, number, number, number] | [number, number]
  ): void {
    const [tl, tr, br, bl] = Array.isArray(radius)
      ? (radius as number[]).length === 2
        ? [radius[0] || 0, radius[1] || 0, radius[0] || 0, radius[1] || 0]
        : [radius[0] || 0, radius[1] || 0, radius[2] || 0, radius[3] || 0]
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
