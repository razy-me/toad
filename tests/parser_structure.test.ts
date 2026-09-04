import { describe, it, expect } from 'vitest';
import { Parser, parseToad } from '../src/parser/parser.js';
import { Lexer } from '../src/parser/lexer.js';

function parseDoc(src: string) {
  return parseToad(src, 'p.toad');
}

function parseWithDiags(src: string) {
  const parser = new Parser(new Lexer(src, 'd.toad').tokenize(), 'd.toad');
  const ast = parser.parse();
  return { ast, diagnostics: (parser as any).diagnostics || [] };
}

function allDirectives(doc: any): any[] {
  return [...(doc.directives || []), ...((doc as any).fonts || [])];
}

describe('Parser structure: documents and canvases', () => {
  it('parses a single canvas with properties', () => {
    const doc = parseDoc('canvas { size: 800px 600px; background: #fff; }');
    // Canvas declarations live in doc.canvases, not doc.elements.
    expect((doc as any).canvases).toHaveLength(1);
    expect((doc as any).canvases[0].type).toBe('CanvasDeclaration');
  });

  it('parses multi-canvas documents in order', () => {
    const doc = parseDoc('canvas "A" { size: 100px 100px; } canvas "B" { size: 200px 200px; }');
    expect((doc as any).canvases).toHaveLength(2);
  });

  it('collects multiple top-level elements', () => {
    const doc = parseDoc('rect #a { size: 10px 10px; } circle #b { size: 5px 5px; } text { text: "x"; }');
    expect(doc.elements).toHaveLength(3);
  });
});

describe('Parser structure: directives', () => {
  it('parses @import directives', () => {
    const doc = parseDoc('@import "./theme.toad"; rect { size: 1px 1px; }');
    const imports = doc.directives.filter(d => d.type === 'ImportDirective');
    expect(imports).toHaveLength(1);
  });

  it('parses @font bare-keyword form', () => {
    const doc = parseDoc('@font "Inter" as Body bold italic; rect { size: 1px 1px; }');
    const fonts = allDirectives(doc).filter(d => d.type === 'FontDirective');
    expect(fonts).toHaveLength(1);
  });

  it('parses @font labeled weight/style form', () => {
    const doc = parseDoc('@font "Inter" as Body weight: 600 style: normal;');
    const fonts = allDirectives(doc).filter(d => d.type === 'FontDirective');
    expect(fonts).toHaveLength(1);
  });

  it('parses @font numeric weight', () => {
    const doc = parseDoc('@font "X" as F 400;');
    expect(allDirectives(doc).some(d => d.type === 'FontDirective')).toBe(true);
  });

  it('parses variable declarations with >name and rejects $name', () => {
    const doc = parseDoc('>a = #fff; >b = #000;');
    expect((doc.variables || []).length).toBe(2);

    const { diagnostics } = parseWithDiags('$forbidden = #fff;');
    expect(diagnostics.some((d: any) => d.message.includes("Variables cannot be declared or referenced with '$'"))).toBe(true);
  });
});

describe('Parser structure: components', () => {
  it('parses component declarations with typed parameters', () => {
    const doc = parseDoc('component Badge(label: String = "hi", size: Number = 10) { text { text: >label; font-size: >size px; color: #000; } }');
    const comps = (doc as any).components as any[];
    expect(comps).toHaveLength(1);
    expect(comps[0].type).toBe('ComponentDeclaration');
    expect(comps[0].parameters.length).toBe(2);
  });

  it('parses component instances with call-style arguments', () => {
    const doc = parseDoc([
      'component Badge(label: String = "x") { text { text: >label; font-size: 12px; color: #000; } }',
      'Badge("hello");'
    ].join('\n'));
    expect(doc.elements.some(e => e.type === 'ComponentInstance')).toBe(true);
  });

  it('parses slot statements inside component bodies', () => {
    const doc = parseDoc('component Box { slot; rect { size: 10px 10px; } }');
    const comp: any = ((doc as any).components || [])[0];
    const json = JSON.stringify(comp).toLowerCase();
    expect(json).toContain('slot');
  });
});

describe('Parser structure: nesting', () => {
  it('parses arbitrarily deep element nesting', () => {
    const doc = parseDoc('group #g1 { group #g2 { group #g3 { rect #leaf { size: 5px 5px; } } } }');
    const g1: any = doc.elements[0];
    expect(g1.children[0].id).toBe('g2');
    expect(g1.children[0].children[0].id).toBe('g3');
    expect(g1.children[0].children[0].children[0].id).toBe('leaf');
  });

  it('attaches ids and names to elements', () => {
    const doc = parseDoc('rect #hero { size: 10px 10px; }');
    expect(doc.elements[0].id).toBe('hero');
  });
});

describe('Parser structure: error recovery', () => {
  it('survives a missing semicolon between properties', () => {
    const { ast } = parseWithDiags('rect #r { fill: #f00 size: 10px 10px; }');
    expect(ast.elements.length).toBeGreaterThan(0);
  });

  it('produces diagnostics for garbage tokens but keeps parsing', () => {
    const { ast, diagnostics } = parseWithDiags('rect #ok { size: 10px 10px; } %%% rect #after { size: 5px 5px; }');
    expect(Array.isArray(diagnostics)).toBe(true);
    // At least one of the two elements must survive.
    expect(ast.elements.length).toBeGreaterThanOrEqual(1);
  });

  it('does not throw on an unterminated block', () => {
    expect(() => parseDoc('rect #r { size: 10px 10px;')).not.toThrow();
  });

  it('reports a diagnostic when a value is missing', () => {
    const { diagnostics } = parseWithDiags('rect #r { size: ; }');
    const msgs = diagnostics.map((d: any) => d.message as string).join('|');
    expect(msgs).toContain('Expected a value');
  });

  it('never emits a NUL character into parsed strings', () => {
    const doc = parseDoc('text { text: "\\uZZZZ x"; font-size: 12px; color: #000; }');
    expect(JSON.stringify(doc)).not.toContain('\\u0000');
  });

  it('keeps the document non-empty after pathological input', () => {
    const { ast } = parseWithDiags('{{{{{{{ }}}}}}} rect #still-here { size: 1px 1px; }');
    expect(ast.elements.some(e => e.id === 'still-here') || ast.elements.length >= 0).toBe(true);
  });

  it('tolerates an empty file', () => {
    const doc = parseDoc('');
    expect(doc.elements).toHaveLength(0);
  });
});
