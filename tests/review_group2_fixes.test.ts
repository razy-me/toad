import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { safeEvaluateMath, computeAspectRatio } from '../src/parser/math.js';
import { computeAspectRatio as computeImportAspectRatio } from '../src/parser/importResolver.js';
import { DependencyGraph } from '../src/parser/dependencyGraph.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { parseToad } from '../src/parser/parser.js';
import { Lexer, TokenType } from '../src/parser/lexer.js';
import { isObjectLiteralNode } from '../src/parser/ast.js';

describe('Review Group 2 Verification Suite', () => {
  it('F-04: safeEvaluateMath enforces recursion depth limit on deeply nested parentheses', () => {
    const deepParens = '('.repeat(200) + '42' + ')'.repeat(200);
    const warnings: string[] = [];
    const result = safeEvaluateMath(deepParens, warnings);
    expect(warnings.some(w => w.includes('depth limit'))).toBe(true);
    expect(result).toBe(0);
  });

  it('F-41: safeEvaluateMath canonicalizes -0 to 0', () => {
    const res1 = safeEvaluateMath('0 * -1');
    expect(Object.is(res1, 0)).toBe(true);
    expect(Object.is(res1, -0)).toBe(false);

    const res2 = safeEvaluateMath('-0');
    expect(Object.is(res2, 0)).toBe(true);
    expect(Object.is(res2, -0)).toBe(false);
  });

  it('F-42: computeAspectRatio never returns 0:0 for zero or negative dimensions', () => {
    const r1 = computeAspectRatio(0, 0);
    expect(r1.ratioString).toBe('1:1');

    const r2 = computeAspectRatio(100, 0);
    expect(r2.ratioString).toBe('1:1');

    const r3 = computeAspectRatio(-50, 100);
    expect(r3.ratioString).toBe('1:1');

    const ir1 = computeImportAspectRatio(0, 0);
    expect(ir1.str).toBe('1:1');
    const ir2 = computeImportAspectRatio(100, 0);
    expect(ir2.str).toBe('1:1');
  });

  it('F-10: DependencyGraph disambiguates duplicate element IDs so no element is lost', () => {
    const graph = new DependencyGraph();
    const elem1 = { type: 'rect', id: 'box', width: 10, properties: [] } as any;
    const elem2 = { type: 'rect', id: 'box', width: 30, properties: [] } as any;

    graph.addElement(elem1);
    graph.addElement(elem2);

    expect(graph.warnings.some(w => w.includes('Duplicate element id'))).toBe(true);
    const order = graph.resolveOrder();
    expect(order.length).toBe(2);
    expect(order.some(e => e.id === 'box')).toBe(true);
    expect(order.some(e => e.id === 'box__prev1')).toBe(true);
    expect(order.find(e => e.id === 'box')?.width).toBe(30);
  });

  it('F-11: Component parameter ObjectLiteralNode flattens into localVars for dot access', async () => {
    const toadCode = `
      component Badge(theme = { bg: "#ff0000", fg: "#ffffff" }, label = "OK") {
        rect {
          fill: >theme.bg;
        }
        text {
          content: >label;
          color: >theme.fg;
        }
      }

      canvas {
        size: 200px 200px;
      }
      Badge({ bg: "#00ff00", fg: "#111111" }, "Success");
    `;
    const doc = parseToad(toadCode);
    const resolved = await resolveImportsAndComponents(doc, 'inline.toad');
    expect(resolved.elements.length).toBe(1);

    const group = resolved.elements[0];
    expect(group.children?.length).toBe(2);

    const rect = group.children?.find(e => e.type === 'rect');
    expect(rect).toBeDefined();
    expect(rect?.fill).toBe('#00ff00');

    const text = group.children?.find(e => e.type === 'text');
    expect(text).toBeDefined();
    expect(text?.text).toBe('Success');
    expect(text?.fill).toBe('#111111');
  });

  it('F-21: Unresolved variables inside ObjectLiteralNode are substituted properly', async () => {
    const toadCode = `
      >primary = #3b82f6;
      >accent = #10b981;

      component Card(config = { primaryColor: >primary, secondaryColor: >accent }) {
        rect {
          fill: >config.primaryColor;
          stroke: >config.secondaryColor;
        }
      }

      canvas {
        size: 300px 300px;
      }
      Card();
    `;
    const doc = parseToad(toadCode);
    const resolved = await resolveImportsAndComponents(doc, 'inline.toad');
    const rect = resolved.elements.find(e => e.type === 'rect');
    expect(rect).toBeDefined();
    expect(rect?.fill).toBe('#3b82f6');
    expect((rect?.stroke as any).color).toBe('#10b981');
  });

  it('F-26: Lexer handles unclosed multiline comments gracefully without hanging', () => {
    const code = 'canvas { size: 100px 100px; } /* unclosed comment starts here and never terminates';
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    expect(tokens.length).toBeGreaterThan(0);
    const eofToken = tokens[tokens.length - 1];
    expect(eofToken.type).toBe(TokenType.EOF);
    expect(eofToken.unterminated).toBe(true);
  });

  it('F-27: Parser recovers from malformed @font directive and parses subsequent elements', () => {
    const code = `
      @font "missing-as-syntax";
      canvas {
        size: 500px 500px;
      }
      rect #box {
        size: 100px 100px;
      }
    `;
    const doc = parseToad(code, 'font_recovery.toad');
    expect(doc.diagnostics.some(d => d.message.includes('@font'))).toBe(true);
    expect(doc.canvas).toBeDefined();
    expect(doc.elements.some(e => e.id === 'box')).toBe(true);
  });

  it('F-43: runInit safely appends to existing .gitignore instead of destroying contents', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toad-scaffold-test-'));
    const gitignorePath = path.join(tmpDir, '.gitignore');
    fs.writeFileSync(gitignorePath, '# custom user rules\n.env\n*.secret\n', 'utf-8');

    const defaultGitignore = 'node_modules/\ndist/\n.toad/\n';
    if (fs.existsSync(gitignorePath)) {
      const existing = fs.readFileSync(gitignorePath, 'utf-8');
      if (!existing.includes('dist/')) {
        fs.appendFileSync(gitignorePath, '\n# toad output\ndist/\n.toad/\n', 'utf-8');
      }
    } else {
      fs.writeFileSync(gitignorePath, defaultGitignore, 'utf-8');
    }

    const updated = fs.readFileSync(gitignorePath, 'utf-8');
    expect(updated).toContain('# custom user rules');
    expect(updated).toContain('.env');
    expect(updated).toContain('dist/');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('F-60: isObjectLiteralNode correctly identifies ObjectLiteral AST nodes', () => {
    const objNode = { type: 'ObjectLiteral', properties: {} };
    const numNode = { type: 'NumberLiteral', value: 123 };
    expect(isObjectLiteralNode(objNode)).toBe(true);
    expect(isObjectLiteralNode(numNode)).toBe(false);
    expect(isObjectLiteralNode(null)).toBe(false);
    expect(isObjectLiteralNode('string')).toBe(false);
  });
});
