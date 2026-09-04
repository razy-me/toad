import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Parser } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { compileToad } from '../src/build.js';

describe('Multi-Page / Multi-Canvas Documents', () => {
  it('parses multiple named canvas declarations in a single document', async () => {
    const dsl = `
      canvas "Front" {
        size: 85mm 55mm;
        fill: #1e293b;
        rect "logo" {
          at: 20px 20px;
          size: 40px 40px;
          fill: #38bdf8;
        }
      }

      canvas "Back" {
        size: 85mm 55mm;
        fill: #f8fafc;
        rect "qr" {
          at: 30px 30px;
          size: 60px 60px;
          fill: #0f172a;
        }
      }
    `;

    const entryPath = path.resolve(process.cwd(), 'multicanvas.toad');
    const parser = new Parser(dsl, entryPath);
    const ast = parser.parse();

    expect(ast.canvases).toBeDefined();
    expect(ast.canvases?.length).toBe(2);
    expect(ast.canvases?.[0].name).toBe('Front');
    expect(ast.canvases?.[1].name).toBe('Back');

    const resolved = await resolveImportsAndComponents(ast, entryPath);

    expect(resolved.canvases).toBeDefined();
    expect(resolved.canvases?.length).toBe(2);

    const layout = await solveLayout(resolved);
    expect(layout.canvases).toBeDefined();
    expect(layout.canvases?.length).toBe(2);
    expect(layout.canvases?.[0].canvas.name).toBe('Front');
    expect(layout.canvases?.[1].canvas.name).toBe('Back');
  });

  it('compiles multi-canvas documents into distinct output files per canvas', async () => {
    const tempDir = path.join(process.cwd(), 'tests', 'dist', 'multicanvas_test');
    fs.mkdirSync(tempDir, { recursive: true });
    const entryFile = path.join(tempDir, 'business_card.toad');

    const dsl = `
      canvas "Front" {
        size: 300px 200px;
        fill: #1e293b;
        rect "frontBox" {
          at: 10px 10px;
          size: 50px 50px;
          fill: #38bdf8;
        }
      }

      canvas "Back" {
        size: 300px 200px;
        fill: #f1f5f9;
        rect "backBox" {
          at: 20px 20px;
          size: 60px 60px;
          fill: #ef4444;
        }
      }
    `;

    fs.writeFileSync(entryFile, dsl, 'utf-8');

    const result = await compileToad(entryFile, {
      outDir: tempDir,
      format: 'png,svg'
    });

    expect(result.success).toBe(true);
    expect(result.outputFiles.length).toBe(4);

    const frontPng = result.outputFiles.find(f => f.includes('business_card-front.png'));
    const backPng = result.outputFiles.find(f => f.includes('business_card-back.png'));
    const frontSvg = result.outputFiles.find(f => f.includes('business_card-front.svg'));
    const backSvg = result.outputFiles.find(f => f.includes('business_card-back.svg'));

    expect(frontPng).toBeDefined();
    expect(backPng).toBeDefined();
    expect(frontSvg).toBeDefined();
    expect(backSvg).toBeDefined();

    if (frontPng) expect(fs.existsSync(frontPng)).toBe(true);
    if (backPng) expect(fs.existsSync(backPng)).toBe(true);
  });
});
