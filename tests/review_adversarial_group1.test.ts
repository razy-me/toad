import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { tokenizeToad } from '../src/parser/lexer.js';
import { lintDocument } from '../src/tools/linter.js';
import { formatToad } from '../src/tools/formatter.js';
import { hasIcon } from '../src/engine/iconRegistry.js';
import { lightenColor, darkenColor } from '../src/engine/drawUtils.js';
import { exportToPsd } from '../src/engine/psdExporter.js';
import { renderToBuffer } from '../src/engine/canvasRenderer.js';
import { solveLayout } from '../src/parser/math.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';

describe('Adversarial Review — Gruppe 1 Verification', () => {
  it('F-01: Linter detects invalid relational target on elements inside canvas', () => {
    const code = `
      canvas {
        size: 800px 600px;
        rect #validBox {
          size: 100px 100px;
        }
        rect #badTargetBox {
          at: below #ghostTarget offset 16px;
          size: 50px 50px;
        }
      }
    `;
    const doc = parseToad(code);
    const diags = lintDocument(doc);
    const relationDiags = diags.filter(d => d.code === 'LINT-INVALID-RELATION');
    expect(relationDiags.length).toBeGreaterThanOrEqual(1);
    expect(relationDiags[0]?.message).toContain('#ghostTarget');
  });

  it('F-01: Linter detects invalid mask target on elements inside canvas', () => {
    const code = `
      canvas {
        size: 400px 400px;
        circle #maskedCircle {
          size: 50px 50px;
          mask: #nonExistentMask;
        }
      }
    `;
    const doc = parseToad(code);
    const diags = lintDocument(doc);
    const maskDiags = diags.filter(d => d.code === 'LINT-INVALID-MASK-TARGET');
    expect(maskDiags.length).toBe(1);
    expect(maskDiags[0]?.message).toContain('#nonExistentMask');
  });

  it('F-19: lightenColor and darkenColor handle continuous amounts without discontinuity at 1.0', () => {
    const base = '#336699';
    const light1 = lightenColor(base, 0.5);
    const light2 = lightenColor(base, 50);
    expect(light1).toBe(light2);

    const dark1 = darkenColor(base, 0.2);
    const dark2 = darkenColor(base, 20);
    expect(dark1).toBe(dark2);

    const lightNeg = lightenColor(base, -20);
    const darkPos = darkenColor(base, 20);
    expect(lightNeg).toBe(darkPos);
  });

  it('F-37: Lexer scanVariable does not consume trailing dot as part of variable name', () => {
    const tokens = tokenizeToad('>myVar. Next');
    const varTok = tokens.find(t => t.type === 'VARIABLE');
    expect(varTok).toBeDefined();
    expect(varTok?.value).toBe('myVar');
  });

  it('F-38: Formatter ensures space before opening curly brace in block declarations', () => {
    const input = 'rect #card{\n  size: 100px 100px;\n}';
    const output = formatToad(input);
    expect(output).toContain('rect #card {');
  });

  it('F-39: hasIcon returns false for Object.prototype properties', () => {
    expect(hasIcon('toString')).toBe(false);
    expect(hasIcon('valueOf')).toBe(false);
    expect(hasIcon('constructor')).toBe(false);
    expect(hasIcon('search')).toBe(true);
    expect(hasIcon('arrow-right')).toBe(true);
  });

  it('F-07 & F-21: PSD Exporter supports gradient layer strokes and conic angle style', async () => {
    const code = `
      canvas {
        size: 500px 500px;
        rect #box {
          size: 200px 200px;
          fill: conic-gradient(from 0deg, #ff0000, #00ff00, #0000ff, #ff0000);
          layer-stroke: 4px inside linear-gradient(to right, #ff0000, #0000ff);
        }
      }
    `;
    const doc = parseToad(code, 'psd_test.toad');
    const resolved = await resolveImportsAndComponents(doc, 'psd_test.toad');
    const layout = await solveLayout(resolved);
    const psdBuffer = await exportToPsd(layout);
    expect(psdBuffer).toBeInstanceOf(Buffer);
    expect(psdBuffer.length).toBeGreaterThan(100);
  });

  it('F-08 & F-20: CanvasRenderer handles inside/outside layerStroke and text outline stroke', async () => {
    const code = `
      canvas {
        size: 400px 400px;
        rect #insideStroke {
          size: 100px 100px;
          layer-stroke: 4px inside #ff0000 opacity 0.8;
        }
        rect #outsideStroke {
          size: 100px 100px;
          layer-stroke: 4px outside #00ff00;
        }
        text #outlinedText {
          content: "Outlined";
          size: 200px 40px;
          font-size: 24px;
          color: #ffffff;
          stroke: #ff0000;
          stroke-width: 2px;
        }
      }
    `;
    const doc = parseToad(code, 'canvas_test.toad');
    const resolved = await resolveImportsAndComponents(doc, 'canvas_test.toad');
    const layout = await solveLayout(resolved);
    const buffer = await renderToBuffer(layout);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
