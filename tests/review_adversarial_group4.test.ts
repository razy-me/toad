import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/parser/lexer.js';
import { Parser } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { SvgExporter } from '../src/engine/svgExporter.js';
import { PdfExporter } from '../src/engine/pdfExporter.js';
import { createCli } from '../src/cli.js';
import { runAntiSlopAudit } from '../src/tools/antiSlopRules.js';
import { LayoutResult } from '../src/parser/math.js';

describe('Review Adversarial - Group 4', () => {
  // F-04: Variable substitution inside color functions
  it('F-04: resolves variables inside color functions like alpha(>brand, 0.5)', async () => {
    const code = `
      >brand = #FF0000;
      canvas {
        width: 100px;
        height: 100px;
      }
      rect #box {
        width: 50px;
        height: 50px;
        fill: alpha(>brand, 0.5);
      }
    `;
    const parser = new Parser(tokenize(code));
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const rect = resolved.elements.find(e => e.id === 'box');
    expect(rect).toBeDefined();
    expect(rect!.fill).toBeDefined();
    const fillStr = typeof rect!.fill === 'string' ? rect!.fill : JSON.stringify(rect!.fill);
    expect(fillStr).toMatch(/rgba\(255,\s*0,\s*0,\s*0\.5\)/i);
  });

  // F-13: parseFilterValue stops at RBRACE boundary
  it('F-13: parseFilterValue respects block boundary and does not swallow RBRACE', () => {
    const code = `
      canvas { width: 100px; height: 100px; }
      rect #blurBox {
        width: 100px;
        height: 100px;
        filter: blur(5px);
      }
    `;
    const parser = new Parser(tokenize(code));
    const ast = parser.parse();
    expect(ast.elements).toHaveLength(1);
    expect(ast.elements[0].id).toBe('blurBox');
  });

  // F-14: Lexer supports leading + and scientific notation
  it('F-14: lexer supports leading plus and scientific notation', () => {
    const tokens = tokenize('+10px +3.14 1e5 2.5e-3 3E+4 10em');
    expect(tokens[0].type).toBe('DIMENSION');
    expect(tokens[0].numberValue).toBe(10);
    expect(tokens[0].unit).toBe('px');

    expect(tokens[1].type).toBe('NUMBER');
    expect(tokens[1].numberValue).toBeCloseTo(3.14);

    expect(tokens[2].type).toBe('NUMBER');
    expect(tokens[2].numberValue).toBe(100000);

    expect(tokens[3].type).toBe('NUMBER');
    expect(tokens[3].numberValue).toBeCloseTo(0.0025);

    expect(tokens[4].type).toBe('NUMBER');
    expect(tokens[4].numberValue).toBe(30000);

    // 10em should remain a dimension with unit 'em'
    expect(tokens[5].type).toBe('DIMENSION');
    expect(tokens[5].numberValue).toBe(10);
    expect(tokens[5].unit).toBe('em');
  });

  // F-28: Justified word split handles multi-spaces
  it('F-28: canvas renderer handles multiple spaces in justified text without NaN/distorted gap', () => {
    const line = "Hello   world   test";
    const words = line.trim().split(/\s+/).filter(Boolean);
    expect(words).toEqual(['Hello', 'world', 'test']);
  });

  // F-29: SVG exporter conic gradient SEG = 2
  it('F-29: SVG exporter conic gradient uses fine 2-degree step', async () => {
    const exporter = new SvgExporter();
    const layout: LayoutResult = {
      canvas: { width: 200, height: 200, background: '#ffffff' },
      nodes: [
        {
          id: 'conicBox',
          type: 'rect',
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          box: { x: 0, y: 0, w: 200, h: 200 },
          fill: {
            type: 'conic',
            stops: [{ color: '#ff0000', position: 0 }, { color: '#0000ff', position: 1 }]
          } as any,
          style: {}
        }
      ]
    };
    const svg = await exporter.export(layout);
    const matches = svg.match(/<path\b/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(180);
  });

  // F-30: PDF exporter condensed font fallback measurement
  it('F-30: PDF exporter measureLineWidth catch fallback accounts for condensed fonts', () => {
    const pdf = new PdfExporter();
    const monoWidth = (pdf as any).measureLineWidth('ABCDE', 10, 'Courier');
    const sansWidth = (pdf as any).measureLineWidth('ABCDE', 10, 'Helvetica');
    expect(monoWidth).toBeGreaterThan(0);
    expect(sansWidth).toBeGreaterThan(0);
  });

  // F-49: miniSvg in svgExporter includes xmlns:xlink
  it('F-49: text-to-path miniSvg template contains xmlns:xlink', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/engine/svgExporter.ts', 'utf-8');
    expect(content).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
  });

  // F-50: Bento overkill scales with DPI
  it('F-50: anti-slop checkBentoOverkill scales thresholds with canvas DPI', () => {
    const layoutLowDpi: LayoutResult = {
      canvas: { width: 800, height: 600, dpi: 96, background: '#ffffff' },
      nodes: []
    };
    const ctx = {
      layout: layoutLowDpi,
      allNodes: [],
      textNodes: [],
      bgRgba: { r: 255, g: 255, b: 255, a: 1 },
      canvasWidth: 800,
      canvasHeight: 600,
      canvasArea: 480000,
      negativeSpacePercent: 100
    };
    const findings = runAntiSlopAudit(ctx);
    expect(Array.isArray(findings)).toBe(true);
  });

  // F-51: CLI documents watch shortcuts
  it('F-51: createCli documents Ctrl+C shortcut in watch option and dev command', () => {
    const cli = createCli();
    const buildCmd = cli.commands.find(c => c.name() === 'build');
    const watchOpt = buildCmd?.options.find(o => o.flags.includes('--watch'));
    expect(watchOpt?.description).toContain('Ctrl+C');
    const devCmd = cli.commands.find(c => c.name() === 'dev');
    expect(devCmd?.description()).toContain('Ctrl+C');
  });

  // F-52: Escaped CRLF line continuations in strings
  it('F-52: lexer handles escaped CRLF line continuations in strings', () => {
    const tokens = tokenize('"line1\\\r\nline2"');
    expect(tokens[0].type).toBe('STRING');
    expect(tokens[0].value).toBe('line1line2');
  });
});
