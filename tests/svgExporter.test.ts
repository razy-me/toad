/**
 * tests/svgExporter.test.ts
 * Unit & Integration tests for the SVG Exporter engine.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileToad } from '../src/build.js';
import { exportToSvg } from '../src/engine/svgExporter.js';
import { solveLayout } from '../src/parser/math.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { parseToad } from '../src/parser/parser.js';

describe('SVG Exporter Engine', () => {
  const testOutDir = path.resolve('tests/dist/svg_test');

  beforeEach(() => {
    fs.mkdirSync(testOutDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true, force: true });
    }
  });

  it('exports basic rectangles, circles, and texts to valid SVG markup', async () => {
    const dsl = `
      canvas "Test SVG" {
        width: 800px;
        height: 600px;
        background: #112233;
      }

      rect #box {
        at: (50px, 50px);
        size: 200px 100px;
        border-radius: 12px;
        fill: #ff0000;
        stroke: #ffffff 2px;
      }

      circle #dot {
        at: (300px, 50px);
        radius: 40px;
        fill: #00ff00;
      }

      text #title {
        at: (50px, 200px);
        content: "Hello SVG World";
        font-size: 32px;
        color: #ffffff;
      }
    `;

    const ast = parseToad(dsl, 'inline.toad');
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const layout = await solveLayout(resolved);

    const svg = await exportToSvg(layout, { scale: 1 });

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 800 600"');
    expect(svg).toContain('fill="#112233"');
    expect(svg).toContain('rx="12" ry="12"');
    expect(svg).toContain('<circle');
    expect(svg).toContain('Hello SVG World');
    expect(svg).toContain('</svg>');
  });

  it('exports polygons with native rounded corners to SVG paths', async () => {
    const dsl = `
      canvas "Polygon SVG" {
        width: 500px;
        height: 500px;
      }

      polygon #triangle {
        at: (100px, 100px);
        size: 200px 200px;
        points: [
          (0px, -100px),
          (100px, 100px),
          (-100px, 100px)
        ];
        radius: 16px;
        fill: #ffffff;
      }
    `;

    const ast = parseToad(dsl, 'poly.toad');
    const resolved = await resolveImportsAndComponents(ast, 'poly.toad');
    const layout = await solveLayout(resolved);

    const svg = await exportToSvg(layout);

    expect(svg).toContain('<path');
    expect(svg).toContain('d="M');
    expect(svg).toContain('A 16');
    expect(svg).toContain('fill="#ffffff"');
  });

  it('exports multi-corner radii rectangles with exact SVG path commands', async () => {
    const dsl = `
      canvas "Asymmetric" {
        width: 400px;
        height: 400px;
      }

      rect #asymm {
        at: (50px, 50px);
        size: 200px 200px;
        border-radius: [50px, 20px, 10px, 50px];
        fill: #0088ff;
      }
    `;

    const ast = parseToad(dsl, 'asymm.toad');
    const resolved = await resolveImportsAndComponents(ast, 'asymm.toad');
    const layout = await solveLayout(resolved);

    const svg = await exportToSvg(layout);

    expect(svg).toContain('<path');
    expect(svg).toContain('A 50 50');
    expect(svg).toContain('A 20 20');
    expect(svg).toContain('A 10 10');
  });

  it('exports stacks and containers with border-radius and preserves whitespace', async () => {
    const dsl = `
      canvas "Container Radius" {
        width: 600px;
        height: 400px;
      }

      stack #badge {
        at: (50px, 50px);
        radius: 999px;
        fill: #10b981;
        stroke: #ffffff 1px;
        padding: [10px, 20px, 10px, 20px];

        text {
          content: "   Indented Text   ";
          font-size: 16px;
        }
      }
    `;

    const ast = parseToad(dsl, 'container.toad');
    const resolved = await resolveImportsAndComponents(ast, 'container.toad');
    const layout = await solveLayout(resolved);

    const svg = await exportToSvg(layout);

    expect(svg).toContain('rx="999" ry="999"');
    expect(svg).toContain('xml:space="preserve"');
  });

  it('compiles fixture to .svg via compileToad CLI build pipeline', async () => {
    const fixture = 'tests/fixtures/sample_shapes.toad';
    const result = await compileToad(fixture, {
      format: 'svg',
      outDir: testOutDir
    });

    expect(result.success).toBe(true);
    expect(result.outputFiles).toHaveLength(1);
    expect(result.outputFiles[0].endsWith('.svg')).toBe(true);

    const content = fs.readFileSync(result.outputFiles[0], 'utf-8');
    expect(content).toContain('<?xml');
    expect(content).toContain('<svg');
  });
});
