import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileToad } from '../src/build.js';
import { readPsd } from 'ag-psd';

describe('End-to-End Human Layer Naming on Fixture', () => {
  const outDir = path.resolve('tests/dist/human_export_verify');

  afterAll(() => {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('compiles hero_banner.toad with human layer names in PSD and SVG', async () => {
    const entry = path.resolve('tests/fixtures/hero_banner.toad');
    const result = await compileToad(entry, {
      outDir,
      format: 'psd,svg',
      humanizeLayerNames: true
    });

    expect(result.success).toBe(true);

    const psdPath = path.join(outDir, 'hero_banner.psd');
    const svgPath = path.join(outDir, 'hero_banner.svg');

    expect(fs.existsSync(psdPath)).toBe(true);
    expect(fs.existsSync(svgPath)).toBe(true);

    // Verify PSD layers
    const psdBuf = fs.readFileSync(psdPath);
    const psd = readPsd(psdBuf, { readLayers: true });

    function collectNames(layers: any[]): string[] {
      const names: string[] = [];
      for (const l of layers || []) {
        names.push(l.name);
        if (l.children) names.push(...collectNames(l.children));
      }
      return names;
    }

    const psdNames = collectNames(psd.children || []);
    console.log('Generated PSD Layer Names:', psdNames);

    // Check that humanized names are present
    expect(psdNames).toContain('Hero Content');
    expect(psdNames).toContain('Bg Hexagon 1');
    expect(psdNames).toContain('Bg Hexagon 2');

    // Text layers formatted as "<TEXT> Text"
    expect(psdNames.some(n => n.includes('Text'))).toBe(true);

    // No __auto_ anywhere
    for (const name of psdNames) {
      expect(name).not.toMatch(/__auto_\d+/);
    }

    // Verify SVG markup
    const svgContent = fs.readFileSync(svgPath, 'utf-8');
    expect(svgContent).toContain('data-name="Hero Content"');
    expect(svgContent).toContain('inkscape:label="Hero Content"');
    expect(svgContent).toContain('<title>Hero Content</title>');
    expect(svgContent).not.toMatch(/id="__auto_\d+"/);
  });
});
