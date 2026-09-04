import { describe, it, expect } from 'vitest';
import { suggestProperty, KNOWN_PROPERTIES } from '../src/tools/diagnostics.js';
import { evaluateCalc } from '../src/parser/math.js';
import { parseToad } from '../src/parser/parser.js';
import { tokenizeToad, TokenType } from '../src/parser/lexer.js';
import { formatToad } from '../src/tools/formatter.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';

describe('Code Review Refinements & Fixes', () => {
  describe('Diagnostics & KNOWN_PROPERTIES', () => {
    it('contains recently added properties in KNOWN_PROPERTIES', () => {
      expect(KNOWN_PROPERTIES).toContain('glow');
      expect(KNOWN_PROPERTIES).toContain('outerGlow');
      expect(KNOWN_PROPERTIES).toContain('bevel');
      expect(KNOWN_PROPERTIES).toContain('layerStroke');
      expect(KNOWN_PROPERTIES).toContain('fontFeatures');
      expect(KNOWN_PROPERTIES).toContain('font-features');
      expect(KNOWN_PROPERTIES).toContain('max-lines');
      expect(KNOWN_PROPERTIES).toContain('wrap-width');
      expect(KNOWN_PROPERTIES).toContain('vertical-align');
    });

    it('suggests correct property names for typos', () => {
      expect(suggestProperty('gloww')).toBe('glow');
      expect(['outer-glow', 'outerGlow']).toContain(suggestProperty('outterGlow'));
      expect(suggestProperty('bevell')).toBe('bevel');
      expect(suggestProperty('font-feature')).toBe('font-features');
    });
  });

  describe('Math evaluateCalc print units', () => {
    it('evaluates calc expressions with mm, cm, in, and pt units', () => {
      // 1 in = 96px, 2 in = 192px
      expect(evaluateCalc('calc(2in + 8px)', 1000)).toBe(200);
      // 25.4 mm = 96px, 50.8 mm = 192px
      expect(evaluateCalc('calc(25.4mm * 2)', 1000)).toBeCloseTo(192, 1);
      // 72 pt = 96px
      expect(evaluateCalc('calc(72pt + 4px)', 1000)).toBe(100);
    });

    it('evaluates mixed calc with percentages and print units', () => {
      // 50% of 1000 = 500, + 1in (96px) = 596
      expect(evaluateCalc('calc(50% + 1in)', 1000)).toBe(596);
    });
  });

  describe('Parser Stroke Value unitless width order', () => {
    it('parses unitless stroke width preceding color (stroke: 2 #ff0000;)', () => {
      const ast = parseToad(`
        rect #box {
          stroke: 2 #ff0000;
        }
      `);
      const rect = ast.elements[0] as any;
      const strokeProp = rect.properties.find((p: any) => p.name === 'stroke');
      expect(strokeProp).toBeDefined();
      expect(strokeProp.value.type).toBe('StrokeValue');
      expect(strokeProp.value.width.value).toBe(2);
      expect(strokeProp.value.color.value).toBe('#ff0000');
    });
  });

  describe('Parser @font weight keywords', () => {
    it('parses standard OpenType weight names in @font directives', async () => {
      const ast = parseToad(`
        @font "./fonts/Inter-Medium.ttf" as "Inter" medium;
        @font "./fonts/Inter-SemiBold.ttf" as "Inter" semibold italic;
        @font "./fonts/Inter-Black.ttf" as "Inter" black;
        @font "./fonts/Inter-Thin.ttf" as "Inter" thin;
      `);
      expect(ast.directives.length).toBe(4);
      const d0 = ast.directives[0] as any;
      const d1 = ast.directives[1] as any;
      const d2 = ast.directives[2] as any;
      const d3 = ast.directives[3] as any;
      expect(d0.weight).toBe('medium');
      expect(d1.weight).toBe('semibold');
      expect(d1.style).toBe('italic');
      expect(d2.weight).toBe('black');
      expect(d3.weight).toBe('thin');
    });
  });

  describe('Formatter Multi-line Block Comments', () => {
    it('preserves indentation when block comments contain braces', () => {
      const input = [
        'canvas {',
        '  size: 800px 600px;',
        '  /*',
        '    Block comment with { braces } inside',
        '    { more braces }',
        '  */',
        '  rect #box {',
        '    fill: #ffffff;',
        '  }',
        '}'
      ].join('\n');

      const formatted = formatToad(input);
      expect(formatted).toContain('  rect #box {');
      expect(formatted).toContain('    fill: #ffffff;');
      expect(formatted).toContain('  }');
      expect(formatted).toContain('}');
    });
  });

  describe('Canvas Resolution with Print Units', () => {
    it('converts size with print units using standard CSS 96 DPI reference pixels and preserves dpi metadata', async () => {
      const ast = parseToad(`
        canvas {
          size: 10in 5in;
          dpi: 300;
        }
      `);
      const resolved = await resolveImportsAndComponents(ast, 'test.toad');
      // At 96 DPI CSS reference pixels: 10in = 960px, 5in = 480px
      expect(resolved.canvas?.width).toBe(960);
      expect(resolved.canvas?.height).toBe(480);
      expect(resolved.canvas?.dpi).toBe(300);
    });
  });

  describe('Lexer Dimension Tokenization', () => {
    it('tokenizes dimensions with standard and custom units cleanly', () => {
      const tokens = tokenizeToad('100px 50mm 2.5in');
      expect(tokens[0].type).toBe(TokenType.DIMENSION);
      expect(tokens[0].numberValue).toBe(100);
      expect(tokens[0].unit).toBe('px');

      expect(tokens[1].type).toBe(TokenType.DIMENSION);
      expect(tokens[1].numberValue).toBe(50);
      expect(tokens[1].unit).toBe('mm');

      expect(tokens[2].type).toBe(TokenType.DIMENSION);
      expect(tokens[2].numberValue).toBe(2.5);
      expect(tokens[2].unit).toBe('in');
    });
  });
});
