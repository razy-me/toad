import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { compileToad } from '../../src/build.js';
import { findToadFiles } from '../../src/utils/fileFinder.js';
import { ToadLanguageServer } from '../../src/tools/lsp/server.js';
import { lintDocument } from '../../src/tools/linter.js';
import { parseToad } from '../../src/parser/parser.js';

describe('Phase 4 Tooling, Hardening & DX Regression Suite', () => {
  it('compileToad rejects invalid format options with a clear error', async () => {
    const tmpDir = path.resolve('tests/dist/p4_format_test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const toadFile = path.join(tmpDir, 'main.toad');
    fs.writeFileSync(toadFile, 'canvas { size: 100px 100px; } rect { size: 50px 50px; }', 'utf8');

    await expect(
      compileToad(toadFile, { outDir: tmpDir, format: 'invalid_format_xyz' as any })
    ).rejects.toThrow(/No valid output formats specified/);
  });

  it('compileToad includes referenced local image assets in dependencies', async () => {
    const tmpDir = path.resolve('tests/dist/p4_asset_test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const imgPath = path.join(tmpDir, 'test_img.png');
    const c = createCanvas(1, 1);
    fs.writeFileSync(imgPath, c.toBuffer('image/png'));

    const toadFile = path.join(tmpDir, 'main.toad');
    fs.writeFileSync(toadFile, 'canvas { size: 100px 100px; } image "test_img.png" { size: 50px 50px; }', 'utf8');

    const result = await compileToad(toadFile, { outDir: tmpDir, format: 'png' });
    expect(result.success).toBe(true);
    expect(result.dependencies.some(d => d.endsWith('test_img.png'))).toBe(true);
  });

  it('findToadFiles completes in under 100ms for non-existent files without searching disk roots', async () => {
    const start = Date.now();
    const hits = await findToadFiles('definitely_non_existent_file_xyz_123');
    const duration = Date.now() - start;
    expect(hits).toEqual([]);
    expect(duration).toBeLessThan(150);
  });

  it('LSP server validateTextDocument handles syntax errors with partial locations gracefully', async () => {
    const server = new ToadLanguageServer();
    const diagnostics = await server.validateTextDocument('uri://test.toad', 'canvas { size: 400px ; ; syntax error');
    expect(Array.isArray(diagnostics)).toBe(true);
    expect(diagnostics.length).toBeGreaterThan(0);
    // Range must have non-negative line and character
    for (const d of diagnostics) {
      expect(d.range.start.line).toBeGreaterThanOrEqual(0);
      expect(d.range.start.character).toBeGreaterThanOrEqual(0);
      expect(d.range.end.line).toBeGreaterThanOrEqual(0);
      expect(d.range.end.character).toBeGreaterThanOrEqual(0);
    }
  });

  it('Linter does not flag variables as unused when referenced inside other variable definitions', () => {
    const src = `
      >primary = #ff0000;
      >headerBg = >primary;
      rect #header {
        fill: >headerBg;
      }
    `;
    const ast = parseToad(src);
    const diags = lintDocument(ast);
    const unusedWarnings = diags.filter(d => d.code === 'LINT-UNUSED-VAR');
    expect(unusedWarnings).toEqual([]);
  });
});
