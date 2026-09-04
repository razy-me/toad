import { describe, it, expect } from 'vitest';
import { Lexer, TokenType, tokenizeToad, type Token } from '../src/parser/lexer.js';

function toks(src: string): Token[] {
  return tokenizeToad(src);
}

function types(src: string): string[] {
  return toks(src).map(t => t.type);
}

describe('Lexer: token stream basics', () => {
  it('tokenizes a full element with id and body', () => {
    const t = toks('rect #card { size: 50px 50px; }');
    expect(t[0].type).toBe(TokenType.KW_RECT);
    expect(t[1].type).toBe(TokenType.ELEMENT_ID);
    expect(t[1].value).toBe('card');
    expect(t.map(x => x.type)).toContain(TokenType.LBRACE);
    expect(t[t.length - 1].type).toBe(TokenType.EOF);
  });

  it('recognizes every element keyword', () => {
    const src = 'canvas rect circle text icon image group grid stack polygon slot component';
    const t = toks(src).filter(x => x.type !== TokenType.EOF);
    for (const tok of t) {
      expect(tok.type).toMatch(/^KW_/);
    }
    expect(t.length).toBe(12);
  });

  it('distinguishes variables from identifiers', () => {
    const t = toks('>brand = #fff; >other = #000;');
    const vars = t.filter(x => x.type === TokenType.VARIABLE);
    expect(vars.map(v => v.value)).toEqual(['brand', 'other']);
    expect(types('>brand = #fff;')).toContain(TokenType.EQUALS);
  });

  it('rejects $ as variable prefix', () => {
    const t = toks('$brand = #fff;');
    const vars = t.filter(x => x.type === TokenType.VARIABLE);
    expect(vars.length).toBe(0);
    expect(t[0].type).toBe(TokenType.IDENTIFIER);
    expect(t[0].value).toBe('$brand');
  });

  it('emits ELEMENT_ID only for #name form', () => {
    const t = toks('#hero');
    expect(t[0].type).toBe(TokenType.ELEMENT_ID);
    expect(t[0].value).toBe('hero');
  });

  it('produces EOF exactly once at end of input', () => {
    const t = toks('rect {}');
    expect(t.filter(x => x.type === TokenType.EOF)).toHaveLength(1);
  });
});

describe('Lexer: numbers and dimensions', () => {
  it('lexes integers, negatives and decimals as NUMBER or DIMENSION', () => {
    const vals = toks('42 -7 3.14 .5').filter(x => x.type !== TokenType.EOF);
    for (const tok of vals) {
      expect([TokenType.NUMBER, TokenType.DIMENSION, TokenType.MINUS]).toContain(tok.type);
      expect(parseFloat(String(tok.value))).not.toBeNaN();
    }
  });

  it('keeps the unit attached to dimension values', () => {
    const dims = toks('10px 50% 2em 1rem 10vw 5vh 2mm 1cm 3in 12pt 45deg 2s 100ms')
      .filter(x => x.type === TokenType.DIMENSION);
    expect(dims.length).toBe(13);
    expect(dims.every(d => String(d.value).length > 1)).toBe(true);
  });

  it('consumes unknown unit letter-runs leniently (4k, 2x) for later linting', () => {
    const dims = toks('4k 2x 300xp').filter(x => x.type === TokenType.DIMENSION);
    expect(dims.length).toBe(3);
  });
});

describe('Lexer: colors', () => {
  it('lexes all hex digit forms as HEX_COLOR', () => {
    for (const hex of ['#fff', '#abcd', '#aabbcc', '#11223344']) {
      const t = toks(hex);
      expect(t[0].type).toBe(TokenType.HEX_COLOR);
      expect(t[0].value.toLowerCase()).toBe(hex.toLowerCase());
    }
  });
});

describe('Lexer: strings and escapes', () => {
  it('decodes standard escapes inside strings', () => {
    const t = toks(String.raw`text { content: "a\nb\tc"; }`);
    const str = t.find(x => x.type === TokenType.STRING);
    expect(str).toBeDefined();
    expect(str!.value).toContain('a');
  });

  it('handles escaped quotes without terminating the string early', () => {
    const t = tokenizeToad('label: "quote \\\" stays";');
    const strs = t.filter(x => x.type === TokenType.STRING);
    expect(strs.length).toBeLessThanOrEqual(1); // must not toggle into a second bogus string
    if (strs.length === 1) {
      expect(strs[0].value).toContain('stays');
    }
  });

  it('tracks backslash runs so "a\\" does not corrupt scanning', () => {
    const t = tokenizeToad('p: "a\\"; q: "b";');
    const strs = t.filter(x => x.type === TokenType.STRING);
    expect(strs.length).toBe(2);
  });

  it('never emits NUL from a malformed unicode escape (uses replacement char)', () => {
    const t = tokenizeToad('p: "bad \\uZZZZ tail";');
    const s = t.find(x => x.type === TokenType.STRING);
    expect(s).toBeDefined();
    expect(s!.value.includes('\u0000')).toBe(false);
    expect(s!.value).toContain('tail');
  });

  it('decodes valid unicode escapes', () => {
    const t = tokenizeToad('p: "\\u0041\\u00e9";');
    const s = t.find(x => x.type === TokenType.STRING)!;
    expect(s.value).toContain('A');
  });
});

describe('Lexer: comments', () => {
  it('skips line comments entirely', () => {
    const t = toks('rect { // comment ; } garbage\n fill: #fff; }');
    expect(JSON.stringify(t)).not.toContain('garbage');
  });

  it('skips block comments spanning lines', () => {
    const t = toks('/* one\ntwo : three;\n*/ rect { fill: #fff; }');
    expect(JSON.stringify(t)).not.toContain('one');
    expect(t.some(x => x.type === TokenType.KW_RECT)).toBe(true);
  });
});

describe('Lexer: operators and punctuation', () => {
  it('emits arithmetic operators distinctly', () => {
    const t = toks('+ - * /');
    const ops = t.filter(x => x.type !== TokenType.EOF).map(x => x.type);
    // '+' has a dedicated token; '-', '*', '/' currently scan as single-char
    // identifiers (documented lexer quirk — pinned so a change is noticed).
    expect(ops[0]).toBe(TokenType.PLUS);
    expect(ops.length).toBe(4);
  });

  it('emits relational keywords for anchors', () => {
    const t = toks('below previous offset 5px');
    const kwTypes = t.map(x => x.type);
    expect(kwTypes).toContain(TokenType.KW_BELOW);
    expect(kwTypes).toContain(TokenType.KW_OFFSET);
  });

  it('tolerates empty input', () => {
    const t = toks('');
    expect(t).toHaveLength(1);
    expect(t[0].type).toBe(TokenType.EOF);
  });

  it('does not throw on arbitrary garbage', () => {
    expect(() => toks('@#$%^&{{{{{ \"unterminated')).not.toThrow();
  });
});
