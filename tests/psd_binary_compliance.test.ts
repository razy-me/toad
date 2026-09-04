import { describe, it, expect } from 'vitest';
import { exportToPsd } from '../src/engine/psdExporter.js';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';

async function generatePsd(src: string, filename = 'test.toad') {
  const parsed = parseToad(src, filename);
  const resolved = await resolveImportsAndComponents(parsed, filename);
  const layout = await solveLayout(resolved);
  return exportToPsd(layout);
}

describe('PSD Binary Compliance & External Compatibility', () => {
  it('ensures text layer TySh block has valid float coordinates and no NaN (0x7fc00000)', async () => {
    const src = `
      canvas { size: 400px 300px; background: #ffffff; }
      text #heading {
        at: 20px 30px;
        size: 300px 40px;
        content: "Photoshop Compatibility";
        font-size: 24px;
        fill: #111827;
      }
    `;
    const buf = await generatePsd(src);

    // Scan for TySh block
    const tyshIdx = buf.indexOf('TySh');
    expect(tyshIdx).toBeGreaterThan(-1);

    const length = buf.readUInt32BE(tyshIdx + 4);
    const tyshData = buf.subarray(tyshIdx + 8, tyshIdx + 8 + length);

    // In TySh, the 4 float32 bounding coordinates (left, top, right, bottom) are stored at the end of the payload
    const targetLeft = Buffer.alloc(4);
    targetLeft.writeFloatBE(20);
    const coordsOffset = tyshData.lastIndexOf(targetLeft);
    expect(coordsOffset).toBeGreaterThan(-1);

    const floatBytes = tyshData.subarray(coordsOffset, coordsOffset + 16);
    expect(floatBytes.length).toBe(16);

    const left = floatBytes.readFloatBE(0);
    const top = floatBytes.readFloatBE(4);
    const right = floatBytes.readFloatBE(8);
    const bottom = floatBytes.readFloatBE(12);

    expect(Number.isNaN(left)).toBe(false);
    expect(Number.isNaN(top)).toBe(false);
    expect(Number.isNaN(right)).toBe(false);
    expect(Number.isNaN(bottom)).toBe(false);

    expect(left).toBe(20);
    expect(top).toBe(30);
    expect(right).toBe(320); // 20 + 300
    expect(bottom).toBe(70); // 30 + 40

    // Ensure 0x7fc00000 (standard NaN representation) does not occur in TySh coordinates
    expect(tyshData.indexOf(Buffer.from([0x7f, 0xc0, 0x00, 0x00]))).toBe(-1);
  });

  it('ensures vector masks contain path record selector 8 (Initial fill rule record) before subpath records', async () => {
    const src = `
      canvas { size: 200px 200px; background: #ffffff; }
      rect #card {
        at: 10px 10px;
        size: 80px 80px;
        fill: #3b82f6;
        radius: 8px;
      }
    `;
    const buf = await generatePsd(src);

    const vmskIdx = buf.indexOf('vmsk');
    expect(vmskIdx).toBeGreaterThan(-1);

    const length = buf.readUInt32BE(vmskIdx + 4);
    const vmskData = buf.subarray(vmskIdx + 8, vmskIdx + 8 + length);

    // vmsk payload: 4 bytes version + 4 bytes flags + 26-byte path records
    expect(vmskData.length).toBeGreaterThanOrEqual(8 + 26 * 2);

    const version = vmskData.readUInt32BE(0);
    expect(version).toBe(3);

    // Record 1: Path fill rule (selector = 6)
    const record1Selector = vmskData.readUInt16BE(8);
    expect(record1Selector).toBe(6);

    // Record 2: Initial fill rule (selector = 8) - strictly required by Photopea & Photoshop
    const record2Selector = vmskData.readUInt16BE(8 + 26);
    expect(record2Selector).toBe(8);

    // Record 3: Closed subpath length (selector = 0) or open subpath (selector = 3)
    const record3Selector = vmskData.readUInt16BE(8 + 26 * 2);
    expect([0, 3]).toContain(record3Selector);
  });

  it('ensures 2-byte Additional Layer Information (ALI) blocks like SoCo maintain exact alignment', async () => {
    const src = `
      canvas { size: 300px 300px; background: #ffffff; }
      rect #box {
        at: 15px 15px;
        size: 100px 100px;
        fill: #ef4444;
      }
    `;
    const buf = await generatePsd(src);

    const socoIdx = buf.indexOf('SoCo');
    expect(socoIdx).toBeGreaterThan(-1);

    const socoLen = buf.readUInt32BE(socoIdx + 4);
    // Next signature block should be '8BIM' or '8B64' immediately following the 2-byte aligned data
    const paddedLen = (socoLen + 1) & ~1; // 2-byte alignment boundary
    const nextSig = buf.toString('ascii', socoIdx + 8 + paddedLen, socoIdx + 8 + paddedLen + 4);
    expect(['8BIM', '8B64']).toContain(nextSig);
  });

  it('ensures drop shadow effects serialize with required contour transfer curve (TrnS)', async () => {
    const src = `
      canvas { size: 200px 200px; background: #ffffff; }
      rect #shadowBox {
        at: 20px 20px;
        size: 60px 60px;
        fill: #10b981;
        shadow: 0 4px 12px #00000040;
      }
    `;
    const buf = await generatePsd(src);

    // lrFX or lmfx block contains layer styles
    const hasEffects = buf.indexOf('lrFX') > -1 || buf.indexOf('lmfx') > -1;
    expect(hasEffects).toBe(true);

    // DrSh (drop shadow descriptor) must contain TrnS transfer contour curve
    const drshIdx = buf.indexOf('DrSh');
    expect(drshIdx).toBeGreaterThan(-1);
    
    // Check that TrnS key is present in the effects descriptor
    const trnsIdx = buf.indexOf('TrnS', drshIdx);
    expect(trnsIdx).toBeGreaterThan(drshIdx);
  });
});
