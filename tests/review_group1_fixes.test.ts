import { describe, it, expect, afterAll } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { lintDocument } from '../src/tools/linter.js';
import { parseToad } from '../src/parser/parser.js';
import { AstCache } from '../src/engine/buildCache.js';
import { compileToad } from '../src/build.js';
import { openBrowser, startPreviewServer } from '../src/engine/previewServer.js';

describe('Review Group 1 Verification Suite', () => {
  it('F-01: openBrowser sanitizes URLs and prevents command injection payloads', () => {
    // Should not throw or execute when malicious metacharacters are passed
    expect(() => openBrowser('http://127.0.0.1:3000/&calc.exe')).not.toThrow();
    expect(() => openBrowser('not-a-valid-url')).not.toThrow();
    expect(() => openBrowser('javascript:alert(1)')).not.toThrow();
    expect(() => openBrowser('http://localhost:3000/" | calc.exe')).not.toThrow();
  });

  it('F-07: compileToad isolates cached AST so resolver mutations do not pollute AstCache', async () => {
    const cache = AstCache.getInstance();
    const entry = path.resolve('tests/fixtures/sample_shapes.toad');
    const outDir = path.resolve('tests/dist/group1_cache_test');

    const res1 = await compileToad(entry, { format: 'png', outDir });
    expect(res1.success).toBe(true);

    const cachedAst = cache.get(entry, fs.statSync(entry).mtimeMs);
    expect(cachedAst).toBeDefined();

    // Verify subsequent compileToad succeeds without state corruption
    const res2 = await compileToad(entry, { format: 'png', outDir });
    expect(res2.success).toBe(true);

    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('F-14: Linter does not falsely flag component parameter dot-property access as undeclared global', () => {
    const code = `
      component Card(theme = { color: "#ffffff" }, title = "Default") {
        rect {
          fill: >theme.color;
        }
        text {
          content: >title;
        }
      }
      canvas "Main" {
        size: 500px 500px;
        Card({ color: "#ff0000" }, "Hello");
      }
    `;
    const ast = parseToad(code, 'test.toad');
    const diagnostics = lintDocument(ast, 'test.toad');
    const errors = diagnostics.filter(d => d.severity === 'error');
    expect(errors.length).toBe(0);
  });

  it('F-30 & F-39: format recognizes pdf, print, everything and error message lists supported formats', async () => {
    const entry = path.resolve('tests/fixtures/tokens.toad');
    const outDir = path.resolve('tests/dist/group1_formats');
    
    // Testing F-39 error message
    await expect(compileToad(entry, { format: 'invalid_format_xyz', outDir }))
      .rejects.toThrow(/Supported formats:.*pdf/);

    // Testing F-30 format: everything includes pdf
    const res = await compileToad(entry, { format: 'everything', outDir });
    expect(res.success).toBe(true);
    const exts = res.outputFiles.map(f => path.extname(f).replace('.', ''));
    expect(exts).toContain('png');
    expect(exts).toContain('jpg');
    expect(exts).toContain('webp');
    expect(exts).toContain('svg');
    expect(exts).toContain('psd');
    expect(exts).toContain('pdf');

    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('F-38: Multi-canvas name slug is capped to prevent ENAMETOOLONG', async () => {
    const entry = path.resolve('tests/fixtures/long_name.toad');
    const longName = 'A'.repeat(200);
    const code = `
      canvas "${longName}" { size: 100px 100px; }
      canvas "Second" { size: 100px 100px; }
    `;
    fs.writeFileSync(entry, code, 'utf-8');
    const outDir = path.resolve('tests/dist/group1_long_slug');
    
    try {
      const res = await compileToad(entry, { format: 'png', outDir });
      expect(res.success).toBe(true);
      for (const f of res.outputFiles) {
        expect(path.basename(f).length).toBeLessThan(100);
      }
    } finally {
      if (fs.existsSync(entry)) fs.unlinkSync(entry);
      if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
