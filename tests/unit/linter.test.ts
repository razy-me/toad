import { describe, it, expect } from 'vitest';
import { parseToad } from '../../src/parser/parser.js';
import { lintDocument } from '../../src/tools/linter.js';

describe('Unit Tests: Linter & AST Static Analysis', () => {
  describe('Duplicate ID Detection', () => {
    it('detects duplicate element IDs at top-level', () => {
      const ast = parseToad(`
        canvas { size: 800px 600px; }
        rect #box { size: 100px 100px; }
        circle #box { size: 50px 50px; }
      `);
      const diags = lintDocument(ast);
      const dupes = diags.filter(d => d.code === 'LINT-DUPLICATE-ID');
      expect(dupes.length).toBe(1);
      expect(dupes[0].message).toContain("Duplicate element ID '#box'");
      expect(dupes[0].severity).toBe('warning');
    });

    it('detects duplicate element IDs inside components', () => {
      const ast = parseToad(`
        component Card() {
          rect #inner { size: 100px 100px; }
          text #inner { content: "duplicate"; }
        }
      `);
      const diags = lintDocument(ast);
      const dupes = diags.filter(d => d.code === 'LINT-DUPLICATE-ID');
      expect(dupes.length).toBe(1);
      expect(dupes[0].message).toContain("Duplicate element ID '#inner' in component 'Card'");
    });

    it('passes cleanly when all element IDs are unique', () => {
      const ast = parseToad(`
        canvas { size: 800px 600px; }
        rect #header { size: 800px 80px; }
        rect #sidebar { size: 200px 520px; }
        rect #content { size: 600px 520px; }
      `);
      const diags = lintDocument(ast);
      const dupes = diags.filter(d => d.code === 'LINT-DUPLICATE-ID');
      expect(dupes.length).toBe(0);
    });
  });

  describe('Undeclared & Unused Variable Analysis', () => {
    it('detects undeclared variable references in element properties', () => {
      const ast = parseToad(`
        canvas { size: 800px 600px; }
        rect #box {
          fill: >missingColor;
        }
      `);
      const diags = lintDocument(ast);
      const undeclared = diags.filter(d => d.code === 'LINT-UNDECLARED-VAR');
      expect(undeclared.length).toBe(1);
      expect(undeclared[0].message).toContain("Variable '>missingColor' is referenced but never declared");
      expect(undeclared[0].severity).toBe('error');
    });

    it('detects undeclared variables used inside calc() expressions', () => {
      const ast = parseToad(`
        canvas { size: 800px 600px; }
        rect #box {
          size: calc(100% - >sidebarWidth) 100px;
        }
      `);
      const diags = lintDocument(ast);
      const undeclared = diags.filter(d => d.code === 'LINT-UNDECLARED-VAR');
      expect(undeclared.length).toBe(1);
      expect(undeclared[0].message).toContain("Variable '>sidebarWidth' in calc() is referenced but never declared");
    });

    it('detects undeclared variables on canvas properties', () => {
      const ast = parseToad(`
        canvas {
          background: >bgTheme;
        }
      `);
      const diags = lintDocument(ast);
      const undeclared = diags.filter(d => d.code === 'LINT-UNDECLARED-VAR');
      expect(undeclared.length).toBe(1);
      expect(undeclared[0].message).toContain("Variable '>bgTheme' is referenced on canvas but never declared");
    });

    it('detects unused top-level variable declarations', () => {
      const ast = parseToad(`
        >unusedColor = #ff0000;
        >usedColor = #00ff00;
        canvas { size: 800px 600px; }
        rect #box {
          fill: >usedColor;
        }
      `);
      const diags = lintDocument(ast);
      const unused = diags.filter(d => d.code === 'LINT-UNUSED-VAR');
      expect(unused.length).toBe(1);
      expect(unused[0].message).toContain("Variable '>unusedColor' is declared but never used");
      expect(unused[0].severity).toBe('warning');
    });

    it('detects unused component parameters', () => {
      const ast = parseToad(`
        component Button(>label = "Click", >unusedParam = 42) {
          text { content: >label; }
        }
      `);
      const diags = lintDocument(ast);
      const unusedParam = diags.filter(d => d.code === 'LINT-UNUSED-PARAM');
      expect(unusedParam.length).toBe(1);
      expect(unusedParam[0].message).toContain("Parameter '>unusedParam' in component 'Button' is declared but never used");
    });
  });

  describe('Relational Positioning & Mask Validation', () => {
    it('detects invalid relational positioning targeting non-existent elements', () => {
      const ast = parseToad(`
        canvas { size: 800px 600px; }
        rect #box {
          at: below #ghostElement offset 20px;
        }
      `);
      const diags = lintDocument(ast);
      const relError = diags.filter(d => d.code === 'LINT-INVALID-RELATION');
      expect(relError.length).toBe(1);
      expect(relError[0].message).toContain("Relational position references unknown target '#ghostElement'");
      expect(relError[0].severity).toBe('error');
    });

    it('allows relational positioning targeting canvas or parent', () => {
      const ast = parseToad(`
        canvas { size: 800px 600px; }
        rect #box {
          at: center of canvas;
        }
      `);
      const diags = lintDocument(ast);
      const relError = diags.filter(d => d.code === 'LINT-INVALID-RELATION');
      expect(relError.length).toBe(0);
    });

    it('detects mask references targeting unknown elements', () => {
      const ast = parseToad(`
        canvas { size: 800px 600px; }
        image #photo {
          src: "./photo.png";
          mask: #nonExistentMask;
        }
      `);
      const diags = lintDocument(ast);
      const maskError = diags.filter(d => d.code === 'LINT-INVALID-MASK-TARGET');
      expect(maskError.length).toBe(1);
      expect(maskError[0].message).toContain("Mask references unknown element '#nonExistentMask'");
    });

    it('passes when mask references a valid element ID', () => {
      const ast = parseToad(`
        canvas { size: 800px 600px; }
        circle #maskShape { size: 100px 100px; }
        image #photo {
          src: "./photo.png";
          mask: #maskShape;
        }
      `);
      const diags = lintDocument(ast);
      const maskError = diags.filter(d => d.code === 'LINT-INVALID-MASK-TARGET');
      expect(maskError.length).toBe(0);
    });
  });
});
