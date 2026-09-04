import { describe, it, expect } from 'vitest';
import { Lexer, tokenizeToad, TokenType } from '../../src/parser/lexer.js';
import { Parser, parseToad } from '../../src/parser/parser.js';

describe('Unit Tests: Deep Lexer & Parser Edge Cases', () => {
  describe('Lexer String & Escape Sequence Handling', () => {
    it('handles standard string escape sequences', () => {
      const source = '"Line1\\nLine2\\tTabbed \\"Quote\\" \\\\Backslash"';
      const tokens = tokenizeToad(source);
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('Line1\nLine2\tTabbed "Quote" \\Backslash');
    });

    it('handles unicode escape sequences (\\uXXXX)', () => {
      const source = '"Unicode \\u0041\\u0042\\u0043"'; // ABC
      const tokens = tokenizeToad(source);
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('Unicode ABC');
    });

    it('strips UTF-8 Byte Order Mark (BOM)', () => {
      const source = '\uFEFFcanvas { size: 100px 100px; }';
      const tokens = tokenizeToad(source);
      expect(tokens[0].type).toBe(TokenType.KW_CANVAS);
    });

    it('scans unclosed string literal gracefully without throwing', () => {
      const source = 'text { content: "Unclosed string literal';
      const tokens = tokenizeToad(source);
      expect(tokens.some(t => t.type === TokenType.STRING)).toBe(true);
    });
  });

  describe('Lexer Numbers, Dimensions & Aspect Ratios', () => {
    it('tokenizes decimals without leading zeros (.5px, -.25)', () => {
      const tokens = tokenizeToad('.5px -.25em 0.85');
      expect(tokens[0].numberValue).toBe(0.5);
      expect(tokens[0].unit).toBe('px');

      expect(tokens[1].numberValue).toBe(-0.25);
      expect(tokens[1].unit).toBe('em');

      expect(tokens[2].numberValue).toBe(0.85);
      expect(tokens[2].type).toBe(TokenType.NUMBER);
    });

    it('parses aspect ratio declarations in canvas blocks', () => {
      const ast169 = parseToad('canvas { ratio: 16:9; }');
      const ast11 = parseToad('canvas { ratio: 1:1; }');
      expect(ast169.canvas?.properties.find(p => p.name === 'ratio')?.value.value).toBe('16:9');
      expect(ast11.canvas?.properties.find(p => p.name === 'ratio')?.value.value).toBe('1:1');
    });

    it('scans variable declarations with >', () => {
      const tokens = tokenizeToad('>globalTheme = #0f172a; >localParam = 12px;');
      expect(tokens[0].type).toBe(TokenType.VARIABLE);
      expect(tokens[0].value).toBe('globalTheme');

      expect(tokens[4].type).toBe(TokenType.VARIABLE);
      expect(tokens[4].value).toBe('localParam');
    });
  });

  describe('Parser Specialized Property Parsers', () => {
    it('parses relational positioning syntax (at: right of #box offset 16px)', () => {
      const ast = parseToad(`
        rect #card {
          at: right of #box offset 16px;
        }
      `);
      const rect = ast.elements[0] as any;
      const atProp = rect.properties.find((p: any) => p.name === 'at');
      expect(atProp.value.type).toBe('RelationalPosition');
      expect(atProp.value.relation).toBe('right of');
      expect(atProp.value.target).toBe('box');
      expect(atProp.value.offset.value).toBe(16);
    });

    it('parses polygon points array value', () => {
      const ast = parseToad(`
        polygon #poly {
          points: [
            (-50px, -50px),
            (50px, -50px),
            (0px, 50px)
          ];
        }
      `);
      const poly = ast.elements[0] as any;
      const pointsProp = poly.properties.find((p: any) => p.name === 'points');
      expect(pointsProp.value.type).toBe('PointsValue');
      expect(pointsProp.value.points).toHaveLength(3);
      expect(pointsProp.value.points[0].x.value).toBe(-50);
      expect(pointsProp.value.points[0].y.value).toBe(-50);
    });

    it('parses chained CSS filter declarations', () => {
      const ast = parseToad(`
        rect #box {
          filter: blur(8px) saturate(1.4) brightness(1.1);
        }
      `);
      const rect = ast.elements[0] as any;
      const filterProp = rect.properties.find((p: any) => p.name === 'filter');
      expect(filterProp.value.type).toBe('FilterValue');
      expect(filterProp.value.filters).toHaveLength(3);
      expect(filterProp.value.filters[0].name).toBe('blur');
      expect(filterProp.value.filters[1].name).toBe('saturate');
    });

    it('parses 2D transforms (rotation, scale, skew)', () => {
      const ast = parseToad(`
        rect #box {
          rotation: 45deg;
          scale: 1.5;
          skewX: 10deg;
          skewY: 5deg;
        }
      `);
      const rect = ast.elements[0] as any;
      const rot = rect.properties.find((p: any) => p.name === 'rotation');
      const sc = rect.properties.find((p: any) => p.name === 'scale');
      const sx = rect.properties.find((p: any) => p.name === 'skewX');
      const sy = rect.properties.find((p: any) => p.name === 'skewY');

      expect(rot.value.value).toBe(45);
      expect(sc.value.value).toBe(1.5);
      expect(sx.value.value).toBe(10);
      expect(sy.value.value).toBe(5);
    });
  });

  describe('Parser Error Recovery & Diagnostics', () => {
    it('recovers from unexpected tokens and parses subsequent valid elements', () => {
      const source = `
        canvas { size: 800px 600px; }
        rect #bad { width 100px; }
        rect #good { size: 200px 200px; fill: #ffffff; }
      `;
      const ast = parseToad(source, 'recovery.toad');
      expect(ast.diagnostics && ast.diagnostics.length).toBeGreaterThan(0);
      expect(ast.elements.some((e: any) => e.id === 'good')).toBe(true);
    });
  });
});
