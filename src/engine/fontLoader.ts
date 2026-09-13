/**
 * src/engine/fontLoader.ts
 * Font registration engine powered by @napi-rs/canvas GlobalFonts.
 * Supports directory scanning (.ttf, .otf, .woff, .woff2) and inline @font directives.
 */

import { GlobalFonts } from '@napi-rs/canvas';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface FontDirective {
  family: string;
  path?: string;
  source?: string;
  weight?: string | number;
  style?: string;
}

export interface FontFaceMeta {
  family: string;          // Lowercase normalized family name, e.g. "agency fb"
  originalFamily: string;  // e.g. "Agency FB"
  numericWeight: number;   // 100 - 900
  style: string;           // 'normal' | 'italic' | 'oblique'
  postScriptName: string;  // e.g. "AgencyFB-Reg", "AgencyFB-Bold"
  filePath?: string;
}

/**
 * Normalizes CSS font weight (numbers or tokens) into a standard integer weight (100 - 900).
 */
export function normalizeFontWeightToNumber(weight?: string | number): number {
  if (typeof weight === 'number' && Number.isFinite(weight)) return weight;
  if (!weight) return 400;
  const str = String(weight).trim().toLowerCase();
  if (/^[0-9]+$/.test(str)) {
    const num = parseInt(str, 10);
    if (Number.isFinite(num)) return num;
  }
  if (str === 'thin' || str === 'hairline') return 100;
  if (str === 'extralight' || str === 'extra-light' || str === 'ultralight') return 200;
  if (str === 'light') return 300;
  if (str === 'normal' || str === 'regular') return 400;
  if (str === 'medium') return 500;
  if (str === 'semibold' || str === 'semi-bold' || str === 'demibold') return 600;
  if (str === 'bold' || str === 'bolder') return 700;
  if (str === 'extrabold' || str === 'extra-bold' || str === 'ultrabold') return 800;
  if (str === 'black' || str === 'heavy') return 900;
  return 400;
}

const fontNameCache = new Map<string, { postScript?: string; family?: string; subfamily?: string } | null>();

/**
 * Reads a slice of a file into a Buffer using a file descriptor to avoid loading
 * multi-megabyte font files entirely into the V8 heap.
 */
function readExactSync(fd: number, length: number, position: number): Buffer | null {
  const buf = Buffer.alloc(length);
  let totalRead = 0;
  while (totalRead < length) {
    const bytesRead = fs.readSync(fd, buf, totalRead, length - totalRead, position + totalRead);
    if (bytesRead === 0) break;
    totalRead += bytesRead;
  }
  if (totalRead < length) return null;
  return buf;
}

/**
 * Extracts PostScript name (nameId 6), Family (nameId 1), and Subfamily (nameId 2)
 * directly from an OpenType / TrueType font binary table without external dependencies.
 */
export function parseOpenTypeFontNames(filePath: string): { postScript?: string; family?: string; subfamily?: string } | null {
  if (fontNameCache.has(filePath)) {
    return fontNameCache.get(filePath)!;
  }
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const headerBuf = readExactSync(fd, 12, 0);
    if (!headerBuf) {
      fontNameCache.set(filePath, null);
      return null;
    }
    const numTables = headerBuf.readUInt16BE(4);
    if (numTables === 0 || numTables > 256) {
      fontNameCache.set(filePath, null);
      return null;
    }

    const tableDirSize = numTables * 16;
    const tableDirBuf = readExactSync(fd, tableDirSize, 12);
    if (!tableDirBuf) {
      fontNameCache.set(filePath, null);
      return null;
    }

    let nameTableOffset = 0;
    let nameTableLength = 0;
    for (let i = 0; i < numTables; i++) {
      const pos = i * 16;
      const tag = tableDirBuf.toString('ascii', pos, pos + 4);
      if (tag === 'name') {
        nameTableOffset = tableDirBuf.readUInt32BE(pos + 8);
        nameTableLength = tableDirBuf.readUInt32BE(pos + 12);
        break;
      }
    }

    if (!nameTableOffset || nameTableLength < 6 || nameTableLength > 4 * 1024 * 1024) {
      fontNameCache.set(filePath, null);
      return null;
    }

    const buf = readExactSync(fd, nameTableLength, nameTableOffset);
    if (!buf) {
      fontNameCache.set(filePath, null);
      return null;
    }

    const count = buf.readUInt16BE(2);
    const stringStorageOffset = buf.readUInt16BE(4);
    let postScript: string | undefined = undefined;
    let family: string | undefined = undefined;
    let subfamily: string | undefined = undefined;

    for (let i = 0; i < count; i++) {
      const rec = 6 + i * 12;
      if (rec + 12 > buf.length) break;
      const platformId = buf.readUInt16BE(rec);
      const encodingId = buf.readUInt16BE(rec + 2);
      const nameId = buf.readUInt16BE(rec + 6);
      const length = buf.readUInt16BE(rec + 8);
      const strOffset = stringStorageOffset + buf.readUInt16BE(rec + 10);
      if (strOffset + length > buf.length) continue;

      let val = '';
      if (platformId === 0 || platformId === 3 || (platformId === 2 && encodingId === 1)) {
        for (let j = 0; j < length; j += 2) {
          val += String.fromCharCode(buf.readUInt16BE(strOffset + j));
        }
      } else {
        val = buf.toString('latin1', strOffset, strOffset + length);
      }
      val = val.trim();

      if (nameId === 6 && !postScript && val) postScript = val;
      if (nameId === 1 && !family && val) family = val;
      if (nameId === 2 && !subfamily && val) subfamily = val;
    }
    const result = { postScript, family, subfamily };
    fontNameCache.set(filePath, result);
    return result;
  } catch {
    fontNameCache.set(filePath, null);
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

export interface FontHeaderMetrics {
  unitsPerEm: number;
  capHeight: number;
  xHeight?: number;
  ascender: number;
  descender: number;
  capHeightRatio: number;
  xHeightRatio?: number;
  ascentRatio: number;
  descentRatio: number;
  opticalCapOffsetRatio: number;
}

export function parseOpenTypeMetrics(filePath: string): FontHeaderMetrics | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const headerBuf = readExactSync(fd, 12, 0);
    if (!headerBuf) return null;
    const numTables = headerBuf.readUInt16BE(4);
    if (numTables === 0 || numTables > 256) return null;

    const tableDirSize = numTables * 16;
    const tableDirBuf = readExactSync(fd, tableDirSize, 12);
    if (!tableDirBuf) return null;

    let headOffset = 0;
    let headLength = 0;
    let os2Offset = 0;
    let os2Length = 0;
    let hheaOffset = 0;
    let hheaLength = 0;

    for (let i = 0; i < numTables; i++) {
      const pos = i * 16;
      const tag = tableDirBuf.toString('ascii', pos, pos + 4);
      if (tag === 'head') {
        headOffset = tableDirBuf.readUInt32BE(pos + 8);
        headLength = tableDirBuf.readUInt32BE(pos + 12);
      } else if (tag === 'OS/2') {
        os2Offset = tableDirBuf.readUInt32BE(pos + 8);
        os2Length = tableDirBuf.readUInt32BE(pos + 12);
      } else if (tag === 'hhea') {
        hheaOffset = tableDirBuf.readUInt32BE(pos + 8);
        hheaLength = tableDirBuf.readUInt32BE(pos + 12);
      }
    }

    let unitsPerEm = 1000;
    if (headOffset > 0 && headLength >= 20) {
      const headBuf = readExactSync(fd, Math.min(headLength, 64), headOffset);
      if (headBuf && headBuf.length >= 20) {
        unitsPerEm = headBuf.readUInt16BE(18) || 1000;
      }
    }

    let ascender = Math.round(unitsPerEm * 0.8);
    let descender = Math.round(-unitsPerEm * 0.2);
    let capHeight = Math.round(unitsPerEm * 0.7);
    let xHeight: number | undefined = undefined;

    if (hheaOffset > 0 && hheaLength >= 8) {
      const hheaBuf = readExactSync(fd, Math.min(hheaLength, 36), hheaOffset);
      if (hheaBuf && hheaBuf.length >= 8) {
        ascender = hheaBuf.readInt16BE(4);
        descender = hheaBuf.readInt16BE(6);
      }
    }

    if (os2Offset > 0 && os2Length >= 72) {
      const os2Buf = readExactSync(fd, Math.min(os2Length, 128), os2Offset);
      if (os2Buf && os2Buf.length >= 72) {
        const typoAscender = os2Buf.readInt16BE(68);
        const typoDescender = os2Buf.readInt16BE(70);
        if (typoAscender !== 0) ascender = typoAscender;
        if (typoDescender !== 0) descender = typoDescender;

        if (os2Buf.length >= 90) {
          const sxH = os2Buf.readInt16BE(86);
          const sCapH = os2Buf.readInt16BE(88);
          if (sCapH > 0) capHeight = sCapH;
          if (sxH > 0) xHeight = sxH;
        }
      }
    }

    const capHeightRatio = capHeight / unitsPerEm;
    const ascentRatio = Math.abs(ascender) / unitsPerEm;
    const descentRatio = Math.abs(descender) / unitsPerEm;
    const opticalCapOffsetRatio = Math.max(0, (Math.abs(ascender) - capHeight) / (2 * unitsPerEm));

    return {
      unitsPerEm,
      capHeight,
      xHeight,
      ascender,
      descender,
      capHeightRatio,
      xHeightRatio: xHeight ? xHeight / unitsPerEm : undefined,
      ascentRatio,
      descentRatio,
      opticalCapOffsetRatio
    };
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

export class FontLoader {
  private static registeredFamilies = new Set<string>();
  private static registeredFaces: FontFaceMeta[] = [];
  private static metricsCache = new Map<string, FontHeaderMetrics>();
  private static systemFontsIndexed = false;
  private static systemFontFiles: string[] = [];
  private static parsedFontFiles = new Set<string>();
  private static unresolvableFamilies = new Set<string>();

  public static getFontMetrics(family: string, weight?: string | number, style?: string): FontHeaderMetrics | null {
    if (!family) return null;
    const famClean = family.replace(/^['"]+|['"]+$/g, '').trim().toLowerCase();
    const weightNum = normalizeFontWeightToNumber(weight);
    const keyWithWeight = `${famClean}:${weightNum}:${style || 'normal'}`;
    if (this.metricsCache.has(keyWithWeight)) return this.metricsCache.get(keyWithWeight)!;
    if (this.metricsCache.has(famClean)) return this.metricsCache.get(famClean)!;
    return null;
  }

  /**
   * Registers a single font file with an optional family alias, weight, and style.
   */
  public static registerFontFile(
    filePath: string,
    alias?: string,
    weight?: string | number,
    style?: string
  ): boolean {
    try {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) {
        return false;
      }

      const success = Boolean(GlobalFonts.registerFromPath(resolvedPath, alias));
      const names = parseOpenTypeFontNames(resolvedPath);
      const familyName = alias || names?.family || path.basename(resolvedPath, path.extname(resolvedPath));
      this.registeredFamilies.add(familyName);

      if (names?.postScript) {
        const sub = (names.subfamily || '').toLowerCase();
        let detectedWeight = weight !== undefined
          ? normalizeFontWeightToNumber(weight)
          : sub.includes('bold') ? 700
          : sub.includes('black') || sub.includes('heavy') ? 900
          : sub.includes('extralight') || sub.includes('extra-light') ? 200
          : sub.includes('light') ? 300
          : sub.includes('medium') ? 500
          : sub.includes('semibold') || sub.includes('semi-bold') ? 600
          : 400;

        let detectedStyle = style
          ? style.toLowerCase().trim()
          : (sub.includes('italic') || sub.includes('oblique') ? 'italic' : 'normal');

        // Prevent duplicate registrations
        const exists = this.registeredFaces.some(
          f => f.family === familyName.toLowerCase() && f.postScriptName === names.postScript
        );
        if (!exists) {
          this.registeredFaces.push({
            family: familyName.toLowerCase(),
            originalFamily: familyName,
            numericWeight: detectedWeight,
            style: detectedStyle,
            postScriptName: names.postScript,
            filePath: resolvedPath
          });
        }

        // Store parsed font header metrics in cache
        const metrics = parseOpenTypeMetrics(resolvedPath);
        if (metrics) {
          const famKey = familyName.toLowerCase();
          this.metricsCache.set(famKey, metrics);
          if (alias) this.metricsCache.set(alias.toLowerCase(), metrics);
          if (names?.family) this.metricsCache.set(names.family.toLowerCase(), metrics);
          this.metricsCache.set(`${famKey}:${detectedWeight}:${detectedStyle}`, metrics);
        }
      }

      return success;
    } catch {
      return false;
    }
  }

  /**
   * Scans a directory for all .ttf, .otf, .woff, .woff2 fonts and registers them.
   * Returns array of loaded font family names / paths.
   */
  public static registerFontDirectory(dirPath: string): string[] {
    try {
      const resolvedDir = path.resolve(dirPath);
      if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
        return [];
      }

      const fontExts = new Set(['.ttf', '.otf', '.woff', '.woff2']);
      const loaded: string[] = [];

      const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (fontExts.has(ext)) {
            const fullPath = path.join(resolvedDir, entry.name);
            const family = path.basename(entry.name, ext);
            if (this.registerFontFile(fullPath, family)) {
              loaded.push(family);
            }
          }
        }
      }
      return loaded;
    } catch {
      return [];
    }
  }

  /**
   * Registers inline @font directives from a resolved document.
   */
  public static registerFontDirectives(fonts: FontDirective[], basePath?: string): boolean[] {
    const results: boolean[] = [];
    for (const font of fonts) {
      const fontPath = font.path || font.source;
      if (!fontPath) {
        results.push(false);
        continue;
      }

      let targetPath: string;
      if (basePath) {
        const isDir = fs.existsSync(basePath) && fs.statSync(basePath).isDirectory();
        targetPath = isDir ? path.resolve(basePath, fontPath) : path.resolve(path.dirname(basePath), fontPath);
      } else {
        targetPath = path.resolve(fontPath);
      }
      const ok = this.registerFontFile(targetPath, font.family, font.weight, font.style);
      results.push(ok);
    }
    return results;
  }

  /**
   * Registers metadata for a single font file.
   */
  private static registerFontMetadata(fullPath: string): void {
    if (this.parsedFontFiles.has(fullPath)) return;
    this.parsedFontFiles.add(fullPath);
    try {
      const names = parseOpenTypeFontNames(fullPath);
      if (names?.family && names?.postScript) {
        const familyKey = names.family.toLowerCase();
        const sub = (names.subfamily || '').toLowerCase();
        const numericWeight = sub.includes('bold') ? 700
          : sub.includes('black') || sub.includes('heavy') ? 900
          : sub.includes('extralight') || sub.includes('extra-light') ? 200
          : sub.includes('light') ? 300
          : sub.includes('medium') ? 500
          : sub.includes('semibold') || sub.includes('semi-bold') ? 600
          : 400;
        const style = sub.includes('italic') || sub.includes('oblique') ? 'italic' : 'normal';

        const exists = this.registeredFaces.some(
          face => face.family === familyKey && face.postScriptName === names.postScript
        );
        if (!exists) {
          this.registeredFaces.push({
            family: familyKey,
            originalFamily: names.family,
            numericWeight,
            style,
            postScriptName: names.postScript,
            filePath: fullPath
          });
        }
      }
    } catch {}
  }

  /**
   * Indexes OS system font directories lazily to discover installed PostScript font names.
   * Uses shallow directory scans to avoid blocking the event loop.
   */
  public static indexSystemFontsLazily(): void {
    if (this.systemFontsIndexed) return;
    this.systemFontsIndexed = true;

    try {
      const sysDirs: string[] = [];
      const home = os.homedir();
      if (process.platform === 'win32') {
        const winDir = process.env.WINDIR || 'C:\\Windows';
        sysDirs.push(path.join(winDir, 'Fonts'));
        if (process.env.LOCALAPPDATA) {
          sysDirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'));
        }
      } else if (process.platform === 'darwin') {
        sysDirs.push('/System/Library/Fonts', '/Library/Fonts', path.join(home, 'Library', 'Fonts'));
      } else {
        sysDirs.push(
          '/usr/share/fonts',
          '/usr/local/share/fonts',
          path.join(home, '.fonts'),
          path.join(home, '.local', 'share', 'fonts')
        );
      }

      const collectFontFiles = (dir: string, depth = 0): string[] => {
        if (depth > 1 || !fs.existsSync(dir)) return [];
        const results: string[] = [];
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              results.push(...collectFontFiles(full, depth + 1));
            } else if (entry.isFile()) {
              const l = entry.name.toLowerCase();
              if (l.endsWith('.ttf') || l.endsWith('.otf')) {
                results.push(full);
              }
            }
          }
        } catch {
          // Gracefully skip unreadable directories
        }
        return results;
      };

      for (const sDir of sysDirs) {
        if (!fs.existsSync(sDir)) continue;
        const fontFiles = collectFontFiles(sDir);
        this.systemFontFiles.push(...fontFiles);

        // Pre-parse a small initial batch (up to 20 files) for immediate availability
        const batchLimit = Math.min(20, fontFiles.length);
        for (let i = 0; i < batchLimit; i++) {
          this.registerFontMetadata(fontFiles[i]!);
        }
      }
    } catch {
      // Graceful ignore of system indexing errors
    }
  }

  /**
   * Resolves the genuine PostScript name from registered @font directives or installed system fonts.
   * Matches by font family, closest weight (e.g. 600 maps to 700 Bold if only 400 & 700 exist),
   * and font style (italic vs normal).
   */
  public static resolvePostScriptName(
    family: string,
    weight?: string | number,
    style?: string
  ): string | null {
    if (!family) return null;
    const targetFamily = family.toLowerCase().trim();
    if (this.unresolvableFamilies.has(targetFamily)) return null;

    const targetWeight = normalizeFontWeightToNumber(weight);
    const isTargetItalic = style === 'italic' || style === 'oblique';

    const findBestFace = (): string | null => {
      const matchingFamily = this.registeredFaces.filter(f => f.family === targetFamily);
      if (matchingFamily.length === 0) return null;

      // Filter by matching style first
      const styleMatches = matchingFamily.filter(f =>
        isTargetItalic ? f.style === 'italic' || f.style === 'oblique' : f.style === 'normal'
      );
      const candidates = styleMatches.length > 0 ? styleMatches : matchingFamily;

      // Find closest weight
      let bestCandidate = candidates[0]!;
      let minDiff = Math.abs(bestCandidate.numericWeight - targetWeight);

      for (let i = 1; i < candidates.length; i++) {
        const c = candidates[i]!;
        const diff = Math.abs(c.numericWeight - targetWeight);
        if (diff < minDiff) {
          minDiff = diff;
          bestCandidate = c;
        }
      }

      return bestCandidate.postScriptName;
    };

    // 1. Try currently registered faces (from @font or registerFontFile)
    const directMatch = findBestFace();
    if (directMatch) return directMatch;

    // 2. Lazily index system fonts
    this.indexSystemFontsLazily();

    // 3. Targeted inspection of candidate files that match targetFamily
    const cleanFamily = targetFamily.replace(/[^a-z0-9]/g, '');
    if (cleanFamily.length > 0) {
      const candidates = this.systemFontFiles.filter(f => {
        const base = path.basename(f).toLowerCase().replace(/[^a-z0-9]/g, '');
        return base.includes(cleanFamily);
      });
      for (const cand of candidates) {
        this.registerFontMetadata(cand);
      }
    }

    const matched = findBestFace();
    if (!matched) {
      this.unresolvableFamilies.add(targetFamily);
    }
    return matched;
  }

  /**
   * Checks if a font family is currently registered.
   */
  public static hasFont(family: string): boolean {
    return GlobalFonts.has(family) || this.registeredFamilies.has(family);
  }

  /**
   * Returns all available font families in the Skia environment.
   */
  public static getAvailableFamilies(): string[] {
    const families = GlobalFonts.families.map(f => f.family);
    return Array.from(new Set([...families, ...this.registeredFamilies]));
  }
}

/**
 * Functional helpers for direct imports
 */
export function registerFont(filePath: string, alias?: string, weight?: string | number, style?: string): boolean {
  return FontLoader.registerFontFile(filePath, alias, weight, style);
}

export function loadFontsFromDir(dirPath: string): string[] {
  return FontLoader.registerFontDirectory(dirPath);
}

export function registerFontDirectives(fonts: FontDirective[], basePath?: string): boolean[] {
  return FontLoader.registerFontDirectives(fonts, basePath);
}

