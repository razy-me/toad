import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeGcd, computeAspectRatio } from '../../src/parser/math.js';
import { formatToad } from '../../src/tools/formatter.js';
import { compileToad } from '../../src/build.js';

describe('Phase 1 Showstopper Regression Suite', () => {
  it('package.json includes scripts in files array', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    expect(pkg.files).toContain('scripts');
  });

  it('computeGcd and computeAspectRatio terminate immediately on Infinity / NaN', () => {
    expect(computeGcd(Infinity, 100)).toBe(1);
    expect(computeGcd(100, Infinity)).toBe(1);
    expect(computeGcd(NaN, 50)).toBe(1);
    expect(computeGcd(50, NaN)).toBe(1);

    const ratioInf = computeAspectRatio(Infinity, 100);
    expect(ratioInf.ratioString).toBe('1:1');

    const ratioNaN = computeAspectRatio(NaN, 100);
    expect(ratioNaN.ratioString).toBe('1:1');

    const ratioZero = computeAspectRatio(0, 100);
    expect(ratioZero.ratioString).toBe('1:1');
  });

  it('formatter does not corrupt URLs or variable assignments containing colons', () => {
    const input = [
      '>api = "http://localhost:3000";',
      'rect #box {',
      '  fill: #ff0000;',
      '  content: "Warning: this is a test: please check";',
      '}'
    ].join('\n');

    const formatted = formatToad(input);
    expect(formatted).toContain('>api = "http://localhost:3000";');
    expect(formatted).not.toContain('http: //');
    expect(formatted).toContain('content: "Warning: this is a test: please check";');
  });

  it('compileToad disambiguates identical canvas names in multi-canvas documents', async () => {
    const tmpDir = path.resolve('tests/dist/p1_canvas_test');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const toadSrc = `
      canvas "Variant" {
        width: 100px;
        height: 100px;
        rect { size: 50px 50px; fill: #f00; }
      }
      canvas "Variant" {
        width: 200px;
        height: 200px;
        rect { size: 100px 100px; fill: #0f0; }
      }
    `;
    const toadFile = path.join(tmpDir, 'test.toad');
    fs.writeFileSync(toadFile, toadSrc, 'utf8');

    const result = await compileToad(toadFile, {
      outDir: tmpDir,
      format: 'png',
      scale: 1
    });

    expect(result.success).toBe(true);
    // Should have generated 2 distinct files, not overwritten
    expect(result.outputFiles.length).toBe(2);
    expect(result.outputFiles[0]).toContain('test-variant.png');
    expect(result.outputFiles[1]).toContain('test-variant-2.png');
    expect(fs.existsSync(result.outputFiles[0]!)).toBe(true);
    expect(fs.existsSync(result.outputFiles[1]!)).toBe(true);
  });
});
