/**
 * src/engine/fontLoader.ts
 * Font registration engine powered by @napi-rs/canvas GlobalFonts.
 * Supports directory scanning (.ttf, .otf, .woff, .woff2) and inline @font directives.
 */

import { GlobalFonts } from '@napi-rs/canvas';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

/**
 * Extracts PostScript name (nameId 6), Family (nameId 1), and Subfamily (nameId 2)
 * directly from an OpenType / TrueType font binary table without external dependencies.
 */
export function parseOpenTypeFontNames(filePath: string): { postScript?: string; family?: string; subfamily?: string } | null {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 12) return null;
    const numTables = buf.readUInt16BE(4);
    let nameTableOffset = 0;
    for (let i = 0; i < numTables; i++) {
      const pos = 12 + i * 16;
      if (pos + 16 > buf.length) break;
      const tag = buf.toString('ascii', pos, pos + 4);
      if (tag === 'name') {
        nameTableOffset = buf.readUInt32BE(pos + 8);
        break;
      }
    }
    if (!nameTableOffset || nameTableOffset + 6 > buf.length) return null;
    const count = buf.readUInt16BE(nameTableOffset + 2);
    const stringStorageOffset = nameTableOffset + buf.readUInt16BE(nameTableOffset + 4);
    let postScript: string | undefined = undefined;
    let family: string | undefined = undefined;
    let subfamily: string | undefined = undefined;

    for (let i = 0; i < count; i++) {
      const rec = nameTableOffset + 6 + i * 12;
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
    return { postScript, family, subfamily };
  } catch {
    return null;
  }
}

export class FontLoader {
  private static registeredFamilies = new Set<string>();
  private static registeredFaces: FontFaceMeta[] = [];
  private static systemFontsIndexed = false;

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
   * Indexes OS system font directories lazily to discover installed PostScript font names.
   */
  private static indexSystemFontsLazily(): void {
    if (this.systemFontsIndexed) return;
    this.systemFontsIndexed = true;

    try {
      const sysDirs: string[] = [];
      if (process.platform === 'win32') {
        const winDir = process.env.WINDIR || 'C:\\Windows';
        sysDirs.push(path.join(winDir, 'Fonts'));
        if (process.env.LOCALAPPDATA) {
          sysDirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'));
        }
      } else if (process.platform === 'darwin') {
        sysDirs.push('/System/Library/Fonts', '/Library/Fonts');
      } else {
        sysDirs.push('/usr/share/fonts', '/usr/local/share/fonts');
      }

      for (const sDir of sysDirs) {
        if (!fs.existsSync(sDir)) continue;
        const fontFiles = fs.readdirSync(sDir).filter(f => {
          const l = f.toLowerCase();
          return l.endsWith('.ttf') || l.endsWith('.otf');
        });

        for (const f of fontFiles) {
          const fullPath = path.join(sDir, f);
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

    // 2. Lazily index system fonts and try again
    this.indexSystemFontsLazily();
    return findBestFace();
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

