import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { Parser } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { CanvasRenderer } from '../src/engine/canvasRenderer.js';
import { SvgExporter } from '../src/engine/svgExporter.js';

describe('Advanced Typography & OpenType Features', () => {
  it('parses font-features, font-variation, and align: justify', async () => {
    const dsl = `
      canvas {
        size: 600px 400px;
        fill: #ffffff;
      }

      text #title {
        at: 40px 40px;
        size: 520px 80px;
        content: "The quick brown fox jumps over the lazy dog";
        font: "Inter" 24px bold;
        align: justify;
        font-features: "liga" 1, "smcp" 1;
        font-variation: "wght" 700 "wdth" 85;
        hanging-punctuation: true;
      }
    `;

    const entryPath = path.resolve(process.cwd(), 'typo_test.toad');
    const parser = new Parser(dsl, entryPath);
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, entryPath);
    const layout = await solveLayout(resolved);

    const titleNode = layout.nodes.find(n => n.id === 'title' || n.name === 'title');
    expect(titleNode).toBeDefined();
    expect(titleNode?.style.align).toBe('justify');
    expect(titleNode?.style.fontFeatures).toBeDefined();
    expect(titleNode?.style.fontVariation).toBeDefined();
    expect(titleNode?.style.hangingPunctuation).toBe(true);
  });

  it('generates SVG with inline font-feature-settings and font-variation-settings', async () => {
    const dsl = `
      canvas {
        size: 500px 300px;
      }

      text "headline" {
        at: 20px 20px;
        size: 460px 60px;
        content: "OpenType Headline";
        font: "Inter" 28px bold;
        font-features: "smcp" 1;
        font-variation: "wght" 800;
      }
    `;

    const entryPath = path.resolve(process.cwd(), 'typo_svg.toad');
    const parser = new Parser(dsl, entryPath);
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, entryPath);
    const layout = await solveLayout(resolved);

    const exporter = new SvgExporter();
    const svg = await exporter.export(layout);

    expect(svg).toContain('font-feature-settings:');
    expect(svg).toContain('font-variation-settings:');
  });

  it('renders justified text to Canvas buffer without throwing errors', async () => {
    const dsl = `
      canvas {
        size: 500px 300px;
        fill: #f8fafc;
      }

      text "bodyText" {
        at: 30px 30px;
        size: 400px 200px;
        content: "Typography in toad supports OpenType ligature features and justified alignment across multi-line paragraphs effortlessly.";
        font: "sans-serif" 16px 400;
        align: justify;
      }
    `;

    const entryPath = path.resolve(process.cwd(), 'typo_canvas.toad');
    const parser = new Parser(dsl, entryPath);
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, entryPath);
    const layout = await solveLayout(resolved);

    const buf = await CanvasRenderer.renderToBuffer(layout, { format: 'png' });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });
});
