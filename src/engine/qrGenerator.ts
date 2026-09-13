/**
 * src/engine/qrGenerator.ts
 * Self-contained, pure TypeScript ISO/IEC 18004 QR Code matrix generator.
 * Supports Byte Mode (UTF-8), Error Correction Levels (L, M, Q, H),
 * automatic version selection (1-40), penalty mask evaluation,
 * and center logo quiet zone reservation for crisp vector output.
 */

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrCodeOptions {
  ecl?: QrErrorCorrectionLevel;
  hasLogo?: boolean;
  logo?: string;
  logoRatio?: number; // Ratio of logo to QR width (0.15 - 0.30, default 0.22)
}

export interface QrCodeResult {
  matrix: boolean[][];
  size: number;
  version: number;
  ecl: QrErrorCorrectionLevel;
  logoBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
    padX: number;
    padY: number;
    padWidth: number;
    padHeight: number;
  };
  toSvgPath: (widthPx: number, heightPx: number, marginModules?: number) => string;
}

// Galois Field GF(2^8) with generator polynomial 0x11D (x^8 + x^4 + x^3 + x^2 + 1)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x >= 256) x ^= 0x11d;
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x]! + GF_LOG[y]!]!;
}

function getRsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i]!;
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j]!, root);
      next[j + 1] ^= poly[j]!;
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomonRemainder(data: Uint8Array, poly: Uint8Array): Uint8Array {
  const degree = poly.length - 1;
  const result = new Uint8Array(degree);
  for (const b of data) {
    const factor = b ^ result[0]!;
    for (let i = 0; i < degree - 1; i++) {
      result[i] = result[i + 1]! ^ gfMul(poly[degree - 1 - i]!, factor);
    }
    result[degree - 1] = gfMul(poly[0]!, factor);
  }
  return result;
}

// Table of QR code capacity and error correction info for versions 1 to 40
// Format: [numDataCodewords, ecCodewordsPerBlock, numBlocksGroup1, numBlocksGroup2, dataCodewordsGroup2]
// Index: [version - 1][eclIndex] where eclIndex: L=0, M=1, Q=2, H=3
const ECC_TABLE: number[][][] = [
  // Version 1 (21x21)
  [[19, 7, 1, 0, 0], [16, 10, 1, 0, 0], [13, 13, 1, 0, 0], [9, 17, 1, 0, 0]],
  // Version 2 (25x25)
  [[34, 10, 1, 0, 0], [28, 16, 1, 0, 0], [22, 22, 1, 0, 0], [16, 28, 1, 0, 0]],
  // Version 3 (29x29)
  [[55, 15, 1, 0, 0], [44, 26, 1, 0, 0], [34, 18, 2, 0, 0], [26, 22, 2, 0, 0]],
  // Version 4 (33x33)
  [[80, 20, 1, 0, 0], [64, 18, 2, 0, 0], [48, 26, 2, 0, 0], [36, 16, 4, 0, 0]],
  // Version 5 (37x37)
  [[108, 26, 1, 0, 0], [86, 24, 2, 0, 0], [62, 18, 2, 2, 16], [46, 22, 2, 2, 12]],
  // Version 6 (41x41)
  [[136, 18, 2, 0, 0], [108, 16, 4, 0, 0], [76, 24, 4, 0, 0], [60, 28, 4, 0, 0]],
  // Version 7 (45x45)
  [[156, 20, 2, 0, 0], [124, 18, 4, 0, 0], [88, 18, 2, 4, 15], [66, 26, 4, 1, 14]],
  // Version 8 (49x49)
  [[194, 24, 2, 0, 0], [154, 22, 2, 2, 39], [110, 22, 4, 2, 19], [86, 26, 4, 2, 15]],
  // Version 9 (53x53)
  [[232, 30, 2, 0, 0], [182, 22, 3, 2, 37], [132, 20, 4, 4, 17], [100, 24, 4, 4, 13]],
  // Version 10 (57x57)
  [[274, 18, 2, 2, 69], [216, 26, 4, 1, 44], [154, 24, 6, 2, 20], [122, 28, 6, 2, 16]],
  // Version 11 (61x61)
  [[324, 20, 4, 0, 0], [254, 30, 1, 4, 51], [180, 28, 4, 4, 23], [140, 24, 3, 8, 13]],
  // Version 12 (65x65)
  [[370, 24, 2, 2, 93], [290, 22, 6, 2, 37], [206, 26, 4, 6, 21], [158, 28, 7, 4, 15]],
  // Version 13 (69x69)
  [[428, 26, 4, 0, 0], [334, 22, 8, 1, 38], [244, 24, 8, 4, 21], [180, 22, 12, 4, 12]],
  // Version 14 (73x73)
  [[461, 30, 3, 1, 116], [365, 24, 4, 5, 41], [261, 20, 11, 5, 17], [197, 24, 11, 5, 13]],
  // Version 15 (77x77)
  [[523, 22, 5, 1, 88], [415, 24, 5, 5, 42], [295, 30, 5, 7, 25], [223, 24, 11, 7, 13]],
  // Version 16 (81x81)
  [[589, 24, 5, 1, 99], [461, 28, 7, 3, 47], [331, 24, 15, 2, 21], [255, 30, 3, 13, 15]],
  // Version 17 (85x85)
  [[647, 28, 1, 5, 109], [511, 28, 10, 1, 47], [365, 28, 1, 15, 23], [281, 28, 2, 17, 15]],
  // Version 18 (89x89)
  [[721, 30, 5, 1, 121], [569, 26, 9, 4, 44], [405, 28, 17, 1, 23], [305, 28, 2, 19, 15]],
  // Version 19 (93x93)
  [[795, 28, 3, 4, 114], [627, 26, 3, 11, 45], [447, 26, 17, 4, 22], [347, 26, 9, 16, 14]],
  // Version 20 (97x97)
  [[861, 28, 3, 5, 108], [693, 26, 3, 13, 44], [489, 30, 15, 5, 25], [371, 28, 15, 10, 15]],
  // Version 21 (101x101)
  [[932, 28, 4, 4, 117], [746, 26, 17, 0, 0], [538, 28, 17, 6, 24], [416, 30, 19, 6, 16]],
  // Version 22 (105x105)
  [[1006, 28, 2, 7, 112], [816, 28, 17, 0, 0], [596, 30, 7, 16, 25], [442, 24, 34, 0, 0]],
  // Version 23 (109x109)
  [[1094, 30, 4, 5, 122], [876, 28, 4, 14, 49], [656, 30, 11, 14, 25], [488, 30, 16, 14, 16]],
  // Version 24 (113x113)
  [[1174, 30, 6, 4, 118], [948, 28, 6, 14, 48], [704, 30, 11, 16, 25], [532, 30, 30, 2, 17]],
  // Version 25 (117x117)
  [[1276, 26, 8, 4, 107], [1020, 28, 8, 13, 49], [772, 30, 7, 22, 25], [580, 30, 22, 13, 16]],
  // Version 26 (121x121)
  [[1370, 28, 10, 2, 115], [1098, 28, 19, 4, 48], [842, 28, 28, 6, 25], [628, 30, 33, 4, 17]],
  // Version 27 (125x125)
  [[1468, 30, 8, 4, 123], [1182, 28, 22, 3, 48], [898, 30, 8, 26, 25], [668, 30, 12, 28, 16]],
  // Version 28 (129x129)
  [[1531, 30, 3, 10, 118], [1251, 28, 3, 23, 46], [979, 30, 4, 31, 25], [731, 30, 11, 31, 16]],
  // Version 29 (133x133)
  [[1631, 30, 7, 7, 117], [1335, 28, 21, 7, 48], [1041, 30, 1, 37, 24], [785, 30, 19, 26, 16]],
  // Version 30 (137x137)
  [[1735, 30, 5, 10, 116], [1443, 28, 19, 10, 48], [1131, 30, 15, 25, 25], [845, 30, 23, 25, 16]],
  // Version 31 (141x141)
  [[1843, 30, 13, 3, 116], [1527, 28, 2, 29, 47], [1221, 30, 42, 1, 29], [905, 30, 23, 28, 16]],
  // Version 32 (145x145)
  [[1955, 30, 17, 0, 0], [1623, 28, 10, 23, 47], [1299, 30, 10, 35, 25], [971, 30, 19, 35, 16]],
  // Version 33 (149x149)
  [[2071, 30, 17, 1, 116], [1725, 28, 14, 21, 47], [1383, 30, 29, 19, 25], [1037, 30, 11, 46, 16]],
  // Version 34 (153x153)
  [[2191, 30, 13, 6, 116], [1815, 28, 14, 23, 47], [1473, 30, 44, 7, 25], [1109, 30, 59, 1, 17]],
  // Version 35 (157x157)
  [[2306, 30, 12, 7, 122], [1926, 28, 12, 26, 48], [1569, 30, 39, 14, 25], [1169, 30, 22, 41, 16]],
  // Version 36 (161x161)
  [[2434, 30, 6, 14, 122], [2034, 28, 6, 34, 48], [1665, 30, 46, 10, 25], [1235, 30, 2, 64, 16]],
  // Version 37 (165x165)
  [[2566, 30, 17, 4, 123], [2148, 28, 29, 14, 47], [1767, 30, 49, 10, 25], [1307, 30, 24, 46, 16]],
  // Version 38 (169x169)
  [[2702, 30, 4, 18, 123], [2268, 28, 13, 32, 47], [1875, 30, 48, 14, 25], [1385, 30, 42, 32, 16]],
  // Version 39 (173x173)
  [[2812, 30, 20, 4, 118], [2394, 28, 40, 7, 48], [1983, 30, 43, 22, 25], [1469, 30, 10, 67, 16]],
  // Version 40 (177x177)
  [[2956, 30, 19, 6, 119], [2502, 28, 18, 31, 48], [2097, 30, 34, 34, 25], [1535, 30, 20, 61, 16]]
];

// Center coordinates for alignment patterns (ISO/IEC 18004 Table E.1, Versions 1-40)
const ALIGNMENT_PATTERN_POSITIONS: number[][] = [
  [], // V1
  [6, 18], // V2
  [6, 22], // V3
  [6, 26], // V4
  [6, 30], // V5
  [6, 34], // V6
  [6, 22, 38], // V7
  [6, 24, 42], // V8
  [6, 26, 46], // V9
  [6, 28, 50], // V10
  [6, 30, 54], // V11
  [6, 32, 58], // V12
  [6, 34, 62], // V13
  [6, 26, 46, 66], // V14
  [6, 26, 48, 70], // V15
  [6, 30, 54, 78], // V16
  [6, 30, 56, 82], // V17
  [6, 30, 58, 86], // V18
  [6, 34, 62, 90], // V19
  [6, 28, 50, 72, 94], // V20
  [6, 26, 50, 74, 98], // V21
  [6, 30, 54, 78, 102], // V22
  [6, 28, 54, 80, 106], // V23
  [6, 32, 58, 84, 110], // V24
  [6, 30, 58, 86, 114], // V25
  [6, 34, 62, 90, 118], // V26
  [6, 26, 50, 74, 98, 122], // V27
  [6, 30, 54, 78, 102, 126], // V28
  [6, 26, 52, 78, 104, 130], // V29
  [6, 30, 56, 82, 108, 134], // V30
  [6, 34, 60, 86, 112, 138], // V31
  [6, 30, 58, 86, 114, 142], // V32
  [6, 34, 62, 90, 118, 146], // V33
  [6, 30, 54, 78, 102, 126, 150], // V34
  [6, 24, 50, 76, 102, 128, 154], // V35
  [6, 28, 54, 80, 106, 132, 158], // V36
  [6, 32, 58, 84, 110, 136, 162], // V37
  [6, 26, 54, 82, 110, 138, 166], // V38
  [6, 30, 58, 86, 114, 142, 170], // V39
  [6, 34, 62, 90, 118, 146, 174]  // V40
];

function eclToNumeric(ecl: QrErrorCorrectionLevel): number {
  switch (ecl) {
    case 'L': return 0;
    case 'M': return 1;
    case 'Q': return 2;
    case 'H': return 3;
  }
}

function eclFormatBits(ecl: QrErrorCorrectionLevel): number {
  switch (ecl) {
    case 'L': return 0b01;
    case 'M': return 0b00;
    case 'Q': return 0b11;
    case 'H': return 0b10;
  }
}

/**
 * Calculates format information bits with BCH(15, 5) code.
 */
function getFormatBits(ecl: QrErrorCorrectionLevel, mask: number): number {
  let data = (eclFormatBits(ecl) << 3) | mask;
  let rem = data << 10;
  const G = 0x537;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= G << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

/**
 * Selects minimum version able to hold byte-mode payload.
 */
function selectVersion(dataLen: number, ecl: QrErrorCorrectionLevel): number {
  const eclIdx = eclToNumeric(ecl);
  for (let v = 1; v <= ECC_TABLE.length; v++) {
    const tableEntry = ECC_TABLE[v - 1]![eclIdx]!;
    const totalDataCodewords = tableEntry[0]!;
    // Byte mode overhead: 4 bits mode + (v >= 10 ? 16 : 8) bits count
    const headerBits = 4 + (v >= 10 ? 16 : 8);
    const capacityBytes = Math.floor((totalDataCodewords * 8 - headerBits) / 8);
    if (dataLen <= capacityBytes) {
      return v;
    }
  }
  const maxTableEntry = ECC_TABLE[ECC_TABLE.length - 1]![eclIdx]!;
  const maxCapacity = Math.floor((maxTableEntry[0]! * 8 - (4 + 16)) / 8);
  throw new Error(
    `QR payload of ${dataLen} bytes exceeds maximum capacity of ${maxCapacity} bytes (version ${ECC_TABLE.length}, ECL ${ecl}).`
  );
}

/**
 * Encodes string to UTF-8 Byte-mode bit stream with padding.
 */
function encodeData(text: string, version: number, ecl: QrErrorCorrectionLevel): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const eclIdx = eclToNumeric(ecl);
  const totalDataCodewords = ECC_TABLE[version - 1]![eclIdx]![0]!;
  const headerBits = 4 + (version >= 10 ? 16 : 8);
  const maxCapacity = Math.floor((totalDataCodewords * 8 - headerBits) / 8);
  if (bytes.length > maxCapacity) {
    throw new Error(
      `QR payload of ${bytes.length} bytes exceeds maximum capacity of ${maxCapacity} bytes for version ${version} (ECL ${ecl}).`
    );
  }

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // 1. Mode indicator (0100 for Byte Mode)
  pushBits(0b0100, 4);

  // 2. Character count indicator
  const countBits = version >= 10 ? 16 : 8;
  pushBits(bytes.length, countBits);

  // 3. Payload bytes
  for (const b of bytes) {
    pushBits(b, 8);
  }

  // 4. Terminator (up to 4 zeros)
  const maxBits = totalDataCodewords * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);

  // 5. Byte alignment padding
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // 6. Pad codewords (0xEC, 0x11 alternating)
  const padPatterns = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(padPatterns[padIdx % 2]!, 8);
    padIdx++;
  }

  // Convert bits to bytes
  const result = new Uint8Array(totalDataCodewords);
  for (let i = 0; i < totalDataCodewords; i++) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | bits[i * 8 + j]!;
    }
    result[i] = byteVal;
  }

  return result;
}

/**
 * Interleaves data codewords and Reed-Solomon error correction blocks.
 */
function interleaveCodewords(data: Uint8Array, version: number, ecl: QrErrorCorrectionLevel): Uint8Array {
  const eclIdx = eclToNumeric(ecl);
  const [totalDataCodewords, ecCodewordsPerBlock, numBlocksG1, numBlocksG2, dataCodewordsG2] =
    ECC_TABLE[version - 1]![eclIdx]!;

  const totalBlocks = numBlocksG1! + numBlocksG2!;
  const dataCodewordsG1 = Math.floor(
    (totalDataCodewords! - numBlocksG2! * (dataCodewordsG2 || 0)) / numBlocksG1!
  );

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  const rsPoly = getRsGeneratorPoly(ecCodewordsPerBlock!);

  let offset = 0;
  for (let i = 0; i < totalBlocks; i++) {
    const isG2 = i >= numBlocksG1!;
    const blockSize = isG2 ? dataCodewordsG2! : dataCodewordsG1;
    const blockData = data.subarray(offset, offset + blockSize);
    offset += blockSize;

    dataBlocks.push(blockData);
    ecBlocks.push(computeReedSolomonRemainder(blockData, rsPoly));
  }

  // Interleave data codewords
  const finalCodewords: number[] = [];
  const maxDataLen = Math.max(dataCodewordsG1, dataCodewordsG2 || 0);
  for (let c = 0; c < maxDataLen; c++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (c < dataBlocks[b]!.length) {
        finalCodewords.push(dataBlocks[b]![c]!);
      }
    }
  }

  // Interleave EC codewords
  for (let c = 0; c < ecCodewordsPerBlock!; c++) {
    for (let b = 0; b < totalBlocks; b++) {
      finalCodewords.push(ecBlocks[b]![c]!);
    }
  }

  return new Uint8Array(finalCodewords);
}

/**
 * Applies mask pattern conditional.
 */
function isMasked(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2 + (r * c) % 3) === 0;
    case 6: return (((r * c) % 2 + (r * c) % 3) % 2) === 0;
    case 7: return (((r + c) % 2 + (r * c) % 3) % 2) === 0;
    default: return false;
  }
}

/**
 * Evaluates penalty score for a masked matrix.
 */
function evaluatePenalty(matrix: boolean[][], size: number): number {
  let penalty = 0;

  // Rule 1: 5 or more consecutive same color modules
  for (let r = 0; r < size; r++) {
    let count = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r]![c] === matrix[r]![c - 1]) {
        count++;
        if (count === 5) penalty += 3;
        else if (count > 5) penalty += 1;
      } else {
        count = 1;
      }
    }
  }

  for (let c = 0; c < size; c++) {
    let count = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r]![c] === matrix[r - 1]![c]) {
        count++;
        if (count === 5) penalty += 3;
        else if (count > 5) penalty += 1;
      } else {
        count = 1;
      }
    }
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const val = matrix[r]![c]!;
      if (val === matrix[r + 1]![c] && val === matrix[r]![c + 1] && val === matrix[r + 1]![c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 3: 1:1:3:1:1 finder-like patterns with 4 light modules (10111010000 or 00001011101)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 11; c++) {
      // Pattern 1: 10111010000
      if (
        matrix[r]![c] &&
        !matrix[r]![c + 1] &&
        matrix[r]![c + 2] &&
        matrix[r]![c + 3] &&
        matrix[r]![c + 4] &&
        !matrix[r]![c + 5] &&
        matrix[r]![c + 6] &&
        !matrix[r]![c + 7] &&
        !matrix[r]![c + 8] &&
        !matrix[r]![c + 9] &&
        !matrix[r]![c + 10]
      ) {
        penalty += 40;
      }
      // Pattern 2: 00001011101
      if (
        !matrix[r]![c] &&
        !matrix[r]![c + 1] &&
        !matrix[r]![c + 2] &&
        !matrix[r]![c + 3] &&
        matrix[r]![c + 4] &&
        !matrix[r]![c + 5] &&
        matrix[r]![c + 6] &&
        matrix[r]![c + 7] &&
        matrix[r]![c + 8] &&
        !matrix[r]![c + 9] &&
        matrix[r]![c + 10]
      ) {
        penalty += 40;
      }
    }
  }

  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - 11; r++) {
      // Pattern 1: 10111010000
      if (
        matrix[r]![c] &&
        !matrix[r + 1]![c] &&
        matrix[r + 2]![c] &&
        matrix[r + 3]![c] &&
        matrix[r + 4]![c] &&
        !matrix[r + 5]![c] &&
        matrix[r + 6]![c] &&
        !matrix[r + 7]![c] &&
        !matrix[r + 8]![c] &&
        !matrix[r + 9]![c] &&
        !matrix[r + 10]![c]
      ) {
        penalty += 40;
      }
      // Pattern 2: 00001011101
      if (
        !matrix[r]![c] &&
        !matrix[r + 1]![c] &&
        !matrix[r + 2]![c] &&
        !matrix[r + 3]![c] &&
        matrix[r + 4]![c] &&
        !matrix[r + 5]![c] &&
        matrix[r + 6]![c] &&
        matrix[r + 7]![c] &&
        matrix[r + 8]![c] &&
        !matrix[r + 9]![c] &&
        matrix[r + 10]![c]
      ) {
        penalty += 40;
      }
    }
  }

  // Rule 4: Proportion of dark modules
  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r]![c]) darkCount++;
    }
  }
  const pct = (darkCount * 100) / (size * size);
  const prev5 = Math.floor(pct / 5) * 5;
  const next5 = prev5 + 5;
  const deviation = Math.min(Math.abs(prev5 - 50), Math.abs(next5 - 50)) / 5;
  penalty += deviation * 10;

  return penalty;
}

/**
 * Generates an ISO/IEC 18004 compliant QR Code matrix.
 */
export function generateQrCode(text: string, options: QrCodeOptions = {}): QrCodeResult {
  const hasLogo = Boolean(options.hasLogo || options.logo);
  // If a logo is embedded, default to 'H' error correction (30% recovery)
  let ecl = options.ecl;
  if (!ecl) {
    ecl = hasLogo ? 'H' : 'M';
  }

  const version = selectVersion(new TextEncoder().encode(text).length, ecl);
  const size = 17 + version * 4;

  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setModule = (r: number, c: number, val: boolean, func = true) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r]![c] = val;
      if (func) isFunction[r]![c] = true;
    }
  };

  // 1. Finder Patterns (7x7 with separator)
  const drawFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isEdge = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setModule(row, col, isEdge || isCenter);
        } else {
          setModule(row, col, false); // Separator
        }
      }
    }
  };

  drawFinder(0, 0); // Top-left
  drawFinder(0, size - 7); // Top-right
  drawFinder(size - 7, 0); // Bottom-left

  // 2. Alignment Patterns (5x5)
  const alignCoords = ALIGNMENT_PATTERN_POSITIONS[version - 1] || [];
  for (const ar of alignCoords) {
    for (const ac of alignCoords) {
      // Skip if collides with finder patterns
      if ((ar <= 8 && ac <= 8) || (ar <= 8 && ac >= size - 9) || (ar >= size - 9 && ac <= 8)) {
        continue;
      }
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isOuter = Math.abs(r) === 2 || Math.abs(c) === 2;
          const isCore = r === 0 && c === 0;
          setModule(ar + r, ac + c, isOuter || isCore);
        }
      }
    }
  }

  // 3. Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6]![i]) setModule(6, i, i % 2 === 0);
    if (!isFunction[i]![6]) setModule(i, 6, i % 2 === 0);
  }

  // 4. Dark Module
  setModule(size - 8, 8, true);

  // 5. Reserve Format Information modules around finders
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunction[8]![i] = true;
      isFunction[i]![8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8]![size - 1 - i] = true;
    isFunction[size - 1 - i]![8] = true;
  }

  // 6. Encode Data and RS Codewords
  const rawData = encodeData(text, version, ecl);
  const finalCodewords = interleaveCodewords(rawData, version, ecl);

  // Convert to bit stream
  const allBits: number[] = [];
  for (const b of finalCodewords) {
    for (let i = 7; i >= 0; i--) {
      allBits.push((b >> i) & 1);
    }
  }

  // 7. Data placement in zigzag columns (right to left, skipping function modules)
  let bitIdx = 0;
  let upwards = true;
  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol--; // Skip vertical timing pattern
    for (let vert = 0; vert < size; vert++) {
      const r = upwards ? size - 1 - vert : vert;
      for (let c = 0; c < 2; c++) {
        const col = rightCol - c;
        if (!isFunction[r]![col]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx]! : 0;
          bitIdx++;
          matrix[r]![col] = bit === 1;
        }
      }
    }
    upwards = !upwards;
  }

  // 8. Mask Evaluation: test all 8 masks and pick the lowest penalty
  let bestMask = 0;
  let minPenalty = Infinity;
  let bestMatrix: boolean[][] = matrix;

  for (let m = 0; m < 8; m++) {
    const candidate: boolean[][] = matrix.map((row, r) =>
      row.map((val, c) => (isFunction[r]![c] ? val : val !== isMasked(m, r, c)))
    );

    // Apply format information for candidate
    const formatBits = getFormatBits(ecl, m);
    // Write format bits around top-left, top-right, bottom-left
    const writeFormat = (mat: boolean[][]) => {
      // Around top-left
      const bits = formatBits;
      for (let i = 0; i < 6; i++) mat[8]![i] = ((bits >> i) & 1) === 1;
      mat[8]![7] = ((bits >> 6) & 1) === 1;
      mat[8]![8] = ((bits >> 7) & 1) === 1;
      mat[7]![8] = ((bits >> 8) & 1) === 1;
      for (let i = 9; i < 15; i++) mat[14 - i]![8] = ((bits >> i) & 1) === 1;

      // Around bottom-left and top-right
      for (let i = 0; i < 7; i++) mat[size - 1 - i]![8] = ((bits >> i) & 1) === 1;
      for (let i = 7; i < 15; i++) mat[8]![size - 15 + i] = ((bits >> i) & 1) === 1;
    };

    writeFormat(candidate);
    const penalty = evaluatePenalty(candidate, size);
    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestMask = m;
      bestMatrix = candidate;
    }
  }

  // Calculate Logo Quiet Zone Box in module units if requested
  let logoBox: QrCodeResult['logoBox'] = undefined;
  if (hasLogo) {
    const ratio = Math.max(0.15, Math.min(0.30, options.logoRatio || 0.22));
    const logoModuleW = Math.round(size * ratio);
    const logoModuleH = Math.round(size * ratio);
    const logoModuleX = Math.floor((size - logoModuleW) / 2);
    const logoModuleY = Math.floor((size - logoModuleH) / 2);
    // Quiet padding around logo (1-2 modules)
    const pad = 1;
    logoBox = {
      x: logoModuleX,
      y: logoModuleY,
      width: logoModuleW,
      height: logoModuleH,
      padX: Math.max(0, logoModuleX - pad),
      padY: Math.max(0, logoModuleY - pad),
      padWidth: logoModuleW + pad * 2,
      padHeight: logoModuleH + pad * 2
    };

    // Blank out modules under the center logo quiet zone
    for (let r = logoModuleY; r < logoModuleY + logoModuleH; r++) {
      for (let c = logoModuleX; c < logoModuleX + logoModuleW; c++) {
        if (bestMatrix[r]) bestMatrix[r]![c] = false;
      }
    }
  }

  return {
    matrix: bestMatrix,
    size,
    version,
    ecl,
    logoBox,
    toSvgPath: (widthPx: number, heightPx: number, marginModules = 0) => {
      const totalModules = size + marginModules * 2;
      const modW = widthPx / totalModules;
      const modH = heightPx / totalModules;

      let d = '';
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (bestMatrix[r]![c]) {
            const x = (c + marginModules) * modW;
            const y = (r + marginModules) * modH;
            // Compound rectangle subpath
            d += `M ${x.toFixed(2)} ${y.toFixed(2)} h ${modW.toFixed(2)} v ${modH.toFixed(2)} h ${(-modW).toFixed(2)} Z `;
          }
        }
      }
      return d.trim();
    }
  };
}
