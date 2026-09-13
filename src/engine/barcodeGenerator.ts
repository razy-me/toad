/**
 * src/engine/barcodeGenerator.ts
 * Self-contained, pure TypeScript 1D Barcode generator.
 * Supports Code 128 (Auto/B), EAN-13, UPC-A, and Code 39
 * with checksum computation and crisp compound SVG vector paths.
 */

export type BarcodeFormat = 'code128' | 'ean13' | 'upc' | 'code39';

export interface BarcodeBar {
  x: number; // Module offset
  width: number; // Module width
}

export interface BarcodeOptions {
  format?: BarcodeFormat;
  showText?: boolean;
  quietZone?: number;
  sanitize?: boolean;
}

export interface BarcodeResult {
  format: BarcodeFormat;
  text: string;
  totalModules: number;
  bars: BarcodeBar[];
  showText: boolean;
  toSvgPath: (widthPx: number, heightPx: number, barHeightRatio?: number) => string;
}

// ============================================================================
// 1. Code 128 (ISO/IEC 15417)
// ============================================================================

// Code 128 pattern widths: alternating [bar, space, bar, space, bar, space]
const CODE128_PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], [2, 2, 2, 1, 2, 2], [2, 2, 2, 2, 2, 1], [1, 2, 1, 2, 2, 3], // 0-3
  [1, 2, 1, 3, 2, 2], [1, 3, 1, 2, 2, 2], [1, 2, 2, 2, 1, 3], [1, 2, 2, 3, 1, 2], // 4-7
  [1, 3, 2, 2, 1, 2], [2, 2, 1, 2, 1, 3], [2, 2, 1, 3, 1, 2], [2, 3, 1, 2, 1, 2], // 8-11
  [1, 1, 2, 2, 3, 2], [1, 2, 2, 1, 3, 2], [1, 2, 2, 2, 3, 1], [1, 1, 3, 2, 2, 2], // 12-15
  [1, 2, 3, 1, 2, 2], [1, 2, 3, 2, 2, 1], [2, 2, 3, 2, 1, 1], [2, 2, 1, 1, 3, 2], // 16-19
  [2, 2, 1, 2, 3, 1], [2, 1, 3, 2, 1, 2], [2, 2, 3, 1, 1, 2], [3, 1, 2, 1, 3, 1], // 20-23
  [3, 1, 1, 2, 2, 2], [3, 2, 1, 1, 2, 2], [3, 2, 1, 2, 2, 1], [3, 1, 2, 2, 1, 2], // 24-27
  [3, 2, 2, 1, 1, 2], [3, 2, 2, 2, 1, 1], [2, 1, 2, 1, 2, 3], [2, 1, 2, 3, 2, 1], // 28-31
  [2, 3, 2, 1, 2, 1], [1, 1, 1, 3, 2, 3], [1, 3, 1, 1, 2, 3], [1, 3, 1, 3, 2, 1], // 32-35
  [1, 1, 2, 3, 1, 3], [1, 3, 2, 1, 1, 3], [1, 3, 2, 3, 1, 1], [2, 1, 1, 3, 1, 3], // 36-39
  [2, 3, 1, 1, 1, 3], [2, 3, 1, 3, 1, 1], [1, 1, 2, 1, 3, 3], [1, 1, 2, 3, 3, 1], // 40-43
  [1, 3, 2, 1, 3, 1], [1, 1, 3, 1, 2, 3], [1, 1, 3, 3, 2, 1], [1, 3, 3, 1, 2, 1], // 44-47
  [3, 1, 3, 1, 2, 1], [2, 1, 1, 3, 3, 1], [2, 3, 1, 1, 3, 1], [2, 1, 3, 1, 1, 3], // 48-51
  [2, 1, 3, 3, 1, 1], [2, 1, 3, 1, 3, 1], [3, 1, 1, 1, 2, 3], [3, 1, 1, 3, 2, 1], // 52-55
  [3, 3, 1, 1, 2, 1], [3, 1, 2, 1, 1, 3], [3, 1, 2, 3, 1, 1], [3, 3, 2, 1, 1, 1], // 56-59
  [3, 1, 4, 1, 1, 1], [2, 2, 1, 4, 1, 1], [4, 3, 1, 1, 1, 1], [1, 1, 1, 2, 2, 4], // 60-63
  [1, 1, 1, 4, 2, 2], [1, 2, 1, 1, 2, 4], [1, 2, 1, 4, 2, 1], [1, 4, 1, 1, 2, 2], // 64-67
  [1, 4, 1, 2, 2, 1], [1, 1, 2, 2, 1, 4], [1, 1, 2, 4, 1, 2], [1, 2, 2, 1, 1, 4], // 68-71
  [1, 2, 2, 4, 1, 1], [1, 4, 2, 1, 1, 2], [1, 4, 2, 2, 1, 1], [2, 4, 1, 2, 1, 1], // 72-75
  [2, 2, 1, 1, 1, 4], [4, 1, 3, 1, 1, 1], [2, 4, 1, 1, 1, 2], [1, 3, 4, 1, 1, 1], // 76-79
  [1, 1, 1, 2, 4, 2], [1, 2, 1, 1, 4, 2], [1, 2, 1, 2, 4, 1], [1, 1, 4, 2, 1, 2], // 80-83
  [1, 2, 4, 1, 1, 2], [1, 2, 4, 2, 1, 1], [4, 1, 1, 2, 1, 2], [4, 2, 1, 1, 1, 2], // 84-87
  [4, 2, 1, 2, 1, 1], [2, 1, 2, 1, 4, 1], [2, 1, 4, 1, 2, 1], [4, 1, 2, 1, 2, 1], // 88-91
  [1, 1, 1, 1, 4, 3], [1, 1, 1, 3, 4, 1], [1, 3, 1, 1, 4, 1], [1, 1, 4, 1, 1, 3], // 92-95
  [1, 1, 4, 3, 1, 1], [4, 1, 1, 1, 1, 3], [4, 1, 1, 3, 1, 1], [1, 1, 3, 1, 4, 1], // 96-99
  [1, 1, 4, 1, 3, 1], [3, 1, 1, 1, 4, 1], [4, 1, 1, 1, 3, 1], [2, 1, 1, 4, 1, 2], // 100-103 (103 = Start A)
  [2, 1, 1, 2, 1, 4], // 104: Start B
  [2, 1, 1, 2, 3, 2]  // 105: Start C
];

const CODE128_STOP = [2, 3, 3, 1, 1, 1, 2]; // 106: Stop (13 modules)

/**
 * Sanitizes input text for Code 128 Set B by stripping accents,
 * mapping common Unicode typographic characters to ASCII,
 * and replacing unsupported characters with '?'.
 */
export function sanitizeCode128(text: string): string {
  if (!text) return '';
  let s = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\t/g, ' ')
    .replace(/[\r\n]+/g, ' ');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out += (code >= 32 && code <= 126) ? s[i] : '?';
  }
  return out;
}

function generateCode128(text: string, quietZoneModules?: number): { bars: BarcodeBar[]; totalModules: number } {
  // Use Code Set B (standard ASCII 32 to 126)
  const codes: number[] = [104]; // Start B
  let checksum = 104;

  for (let i = 0; i < text.length; i++) {
    const ascii = text.charCodeAt(i);
    if (ascii < 32 || ascii > 126) {
      throw new Error(
        `Code 128 character at index ${i} ('${text[i]}', ASCII ${ascii}) is outside valid ASCII range (32-126).`
      );
    }
    const code = ascii - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }

  codes.push(checksum % 103);

  const bars: BarcodeBar[] = [];
  const quietZone = typeof quietZoneModules === 'number' ? Math.max(0, quietZoneModules) : 10;
  let curX = quietZone;

  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c]!;
    for (let p = 0; p < pattern.length; p++) {
      const w = pattern[p]!;
      if (p % 2 === 0) {
        bars.push({ x: curX, width: w });
      }
      curX += w;
    }
  }

  // Stop character
  for (let p = 0; p < CODE128_STOP.length; p++) {
    const w = CODE128_STOP[p]!;
    if (p % 2 === 0) {
      bars.push({ x: curX, width: w });
    }
    curX += w;
  }

  curX += quietZone;
  return { bars, totalModules: curX };
}

// ============================================================================
// 2. EAN-13 / UPC-A
// ============================================================================

// L-code patterns (odd parity)
const EAN_L: string[] = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'
];

// G-code patterns (even parity)
const EAN_G: string[] = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'
];

// R-code patterns (right hand)
const EAN_R: string[] = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'
];

// Parity table determined by 1st digit (0-9)
const EAN_PARITY: string[] = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
];

function calculateEan13Checksum(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i]!, 10) || 0;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

function generateEan13(rawDigits: string, quietZoneModules?: number): { bars: BarcodeBar[]; totalModules: number; formattedText: string } {
  // Strip non-digit characters
  const digitsOnly = rawDigits.replace(/[^0-9]/g, '');
  if (digitsOnly.length < 12) {
    throw new Error(
      `EAN-13 requires at least 12 digits, received ${digitsOnly.length} digits ('${rawDigits}').`
    );
  }

  let digits = digitsOnly.slice(0, 13);
  const expectedChecksum = calculateEan13Checksum(digits.slice(0, 12));
  if (digits.length === 13) {
    const providedChecksum = parseInt(digits[12]!, 10);
    if (providedChecksum !== expectedChecksum) {
      throw new Error(
        `Invalid EAN-13 checksum: expected ${expectedChecksum} for '${digits.slice(0, 12)}', but received ${providedChecksum} in '${digits}'.`
      );
    }
  } else {
    digits += expectedChecksum;
  }

  const firstDigit = parseInt(digits[0]!, 10);
  const parity = EAN_PARITY[firstDigit]!;
  let bitString = '';

  // Left quiet zone
  const qzCount = typeof quietZoneModules === 'number' ? Math.max(0, quietZoneModules) : 9;
  const quietZone = '0'.repeat(qzCount);
  bitString += quietZone;

  // Start guard (101)
  bitString += '101';

  // Left 6 digits
  for (let i = 1; i <= 6; i++) {
    const d = parseInt(digits[i]!, 10);
    const useG = parity[i - 1] === 'G';
    bitString += useG ? EAN_G[d]! : EAN_L[d]!;
  }

  // Center guard (01010)
  bitString += '01010';

  // Right 6 digits
  for (let i = 7; i <= 12; i++) {
    const d = parseInt(digits[i]!, 10);
    bitString += EAN_R[d]!;
  }

  // End guard (101)
  bitString += '101';

  // Right quiet zone
  bitString += quietZone;

  const bars: BarcodeBar[] = [];
  for (let i = 0; i < bitString.length; i++) {
    if (bitString[i] === '1') {
      bars.push({ x: i, width: 1 });
    }
  }

  // Merge adjacent 1-module bars for cleaner vector output
  const mergedBars: BarcodeBar[] = [];
  for (const b of bars) {
    const prev = mergedBars[mergedBars.length - 1];
    if (prev && prev.x + prev.width === b.x) {
      prev.width += b.width;
    } else {
      mergedBars.push({ ...b });
    }
  }

  return { bars: mergedBars, totalModules: bitString.length, formattedText: digits };
}

// ============================================================================
// 3. Code 39
// ============================================================================

const CODE39_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*';
const CODE39_PATTERNS: string[] = [
  '000110100', '100100001', '001100001', '101100000', '000110001', // 0-4
  '100110000', '001110000', '000100101', '100100100', '001100100', // 5-9
  '100001001', '001001001', '101001000', '000011001', '100011000', // A-E
  '001011000', '000001101', '100001100', '001001100', '000011100', // F-J
  '100000011', '001000011', '101000010', '000010011', '100010010', // K-O
  '001010010', '000000111', '100000110', '001000110', '000010110', // P-T
  '110000001', '011000001', '111000000', '010010001', '110010000', // U-Y
  '011010000', '010000101', '110000100', '011000100', '010101000', // Z, -, ., ' '
  '010100010', '010001010', '000101010', '010010100'               // $, /, +, %, *
];

function generateCode39(text: string, quietZoneModules?: number): { bars: BarcodeBar[]; totalModules: number } {
  const clean = `*${text.toUpperCase().replace(/[^0-9A-Z-. $/+%]/g, '')}*`;
  const narrowW = 1;
  const wideW = 3;
  const interGap = 1;
  const quietZone = typeof quietZoneModules === 'number' ? Math.max(0, quietZoneModules) : 10;

  const bars: BarcodeBar[] = [];
  let curX = quietZone;

  for (let i = 0; i < clean.length; i++) {
    const charIdx = CODE39_CHARS.indexOf(clean[i]!);
    if (charIdx === -1) continue;
    const pat = CODE39_PATTERNS[charIdx]!;

    for (let p = 0; p < 9; p++) {
      const isBar = p % 2 === 0;
      const isWide = pat[p] === '1';
      const w = isWide ? wideW : narrowW;
      if (isBar) {
        bars.push({ x: curX, width: w });
      }
      curX += w;
    }
    curX += interGap;
  }

  curX += quietZone > 0 ? (quietZone - interGap) : 0;
  return { bars, totalModules: curX };
}

// ============================================================================
// Public API
// ============================================================================

export function generateBarcode(value: string, options: BarcodeOptions = {}): BarcodeResult {
  const format = (options.format || 'code128').toLowerCase() as BarcodeFormat;
  const showText = Boolean(options.showText);
  let bars: BarcodeBar[] = [];
  let totalModules = 100;
  let text = value;

  switch (format) {
    case 'ean13': {
      const res = generateEan13(value, options.quietZone);
      bars = res.bars;
      totalModules = res.totalModules;
      text = res.formattedText;
      break;
    }
    case 'upc': {
      // UPC-A is EAN-13 with leading zero
      const upcDigits = value.replace(/[^0-9]/g, '');
      if (upcDigits.length < 11) {
        throw new Error(`UPC requires at least 11 digits, received ${upcDigits.length} digits ('${value}').`);
      }
      let upcVal = upcDigits;
      if (upcVal.length === 11) {
        const check = calculateEan13Checksum(`0${upcVal}`);
        upcVal = `0${upcVal}${check}`;
      } else {
        upcVal = `0${upcVal.slice(0, 12)}`;
      }
      const res = generateEan13(upcVal, options.quietZone);
      bars = res.bars;
      totalModules = res.totalModules;
      text = res.formattedText;
      break;
    }
    case 'code39': {
      const res = generateCode39(value, options.quietZone);
      bars = res.bars;
      totalModules = res.totalModules;
      break;
    }
    case 'code128':
    default: {
      const codeVal = options.sanitize ? sanitizeCode128(value) : value;
      text = codeVal;
      const res = generateCode128(codeVal, options.quietZone);
      bars = res.bars;
      totalModules = res.totalModules;
      break;
    }
  }

  return {
    format,
    text,
    totalModules,
    bars,
    showText: !!showText,
    toSvgPath: (widthPx: number, heightPx: number, barHeightRatio?: number) => {
      const ratio = barHeightRatio !== undefined ? barHeightRatio : (showText ? 0.8 : 1.0);
      const modW = widthPx / totalModules;
      const effectiveH = heightPx * ratio;

      let d = '';
      for (const b of bars) {
        const x = b.x * modW;
        const w = b.width * modW;
        d += `M ${x.toFixed(2)} 0 h ${w.toFixed(2)} v ${effectiveH.toFixed(2)} h ${(-w).toFixed(2)} Z `;
      }
      return d.trim();
    }
  };
}
