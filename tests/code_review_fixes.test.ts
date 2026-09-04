import { describe, it, expect } from 'vitest';
import { formatToad } from '../src/tools/formatter.js';
import { lintDocument } from '../src/tools/linter.js';
import { Parser, parseToad } from '../src/parser/parser.js';
import { Lexer } from '../src/parser/lexer.js';
import { exportToSvg } from '../src/engine/svgExporter.js';
import { solveLayout } from '../src/parser/math.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';

describe('Code Review Regression Tests', () => {
  it('correctly resolves Stack children with explicit IDs without stale (0,0) caching', async () => {
    const code = `
      canvas { size: 400px 400px; }
      stack {
        direction: vertical;
        gap: 20px;
        at: 50px 50px;
        size: 300px 300px;
        
        rect #firstBox {
          size: 100px 40px;
          fill: #ff0000;
        }
        rect #secondBox {
          size: 100px 40px;
          fill: #00ff00;
        }
      }
    `;
    const doc = parseToad(code, 'test.toad');
    const resolved = await resolveImportsAndComponents(doc, 'test.toad');
    const layout = await solveLayout(resolved);

    const first = layout.nodes.find(e => e.id === 'firstBox');
    const second = layout.nodes.find(e => e.id === 'secondBox');

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.x).toBe(50);
    expect(first!.y).toBe(50);
    expect(second!.x).toBe(50);
    expect(second!.y).toBe(110);
  });

  it('exports SVG with font-weight, font-style, and directional linear gradients', async () => {
    const code = `
      canvas { size: 400px 300px; }
      rect #bg {
        size: 400px 300px;
        fill: linear-gradient(to right, #1e293b, #0f172a);
      }
      text #title {
        text: "Styled Typography";
        font: 24px "Inter";
        weight: 700;
        style: italic;
        fill: #ffffff;
        at: center;
      }
    `;
    const doc = parseToad(code, 'svg_test.toad');
    const resolved = await resolveImportsAndComponents(doc, 'svg_test.toad');
    const layout = await solveLayout(resolved);
    const svg = await exportToSvg(layout);

    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('<linearGradient');
  });

  it('resolves 2-value padding and margin correctly in box model', async () => {
    const code = `
      canvas { size: 500px 500px; }
      stack {
        direction: vertical;
        padding: 10px 20px;
        rect {
          size: 100px 100px;
          fill: #3b82f6;
        }
      }
    `;
    const doc = parseToad(code, 'padding_test.toad');
    const resolved = await resolveImportsAndComponents(doc, 'padding_test.toad');
    const stackElem = resolved.elements.find(e => e.type === 'stack');
    expect(stackElem).toBeDefined();
    expect(stackElem?.padding).toEqual([10, 20, 10, 20]);
  });

  it('formats toad code containing URLs without corrupting // into comment splits', () => {
    const source = `image {\n  src: "https://example.com/image.png";\n  size: 200px 200px;\n}`;
    const formatted = formatToad(source);
    expect(formatted).toContain('src: "https://example.com/image.png";');
    expect(formatted).not.toContain('https: //');
  });

  it('does not produce false-positive lint errors for mask targets with leading #', () => {
    const code = `
      canvas { size: 400px 400px; }
      circle #avatarMask {
        size: 100px;
        at: center;
      }
      image #userPhoto {
        src: "photo.png";
        size: 100px 100px;
        at: center;
        mask: "#avatarMask";
      }
    `;
    const lexer = new Lexer(code, 'lint_test.toad');
    const parser = new Parser(lexer.tokenize(), 'lint_test.toad');
    const ast = parser.parse();
    const diags = lintDocument(ast);

    const maskErrors = diags.filter(d => d.code === 'LINT-INVALID-MASK-TARGET');
    expect(maskErrors).toHaveLength(0);
  });
});
