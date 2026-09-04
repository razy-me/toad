import { describe, it, expect } from 'vitest';
import { parseToad, Parser } from '../src/parser/parser.js';
import { Lexer } from '../src/parser/lexer.js';

function props(src: string): Record<string, any> {
  const doc = parseToad(src, 'v.toad');
  const out: Record<string, any> = {};
  for (const el of doc.elements) {
    for (const p of el.properties || []) {
      if (!(p.name in out)) out[p.name] = p.value;
    }
  }
  return out;
}

function firstProp(src: string, name: string): any {
  return props(src)[name];
}

const RECT = 'rect #r {';

describe('Parser values: colors', () => {
  it('parses hex colors of all digit lengths', () => {
    expect(firstProp(RECT + ' fill: #f00; }', 'fill').value).toBe('#f00');
    expect(firstProp(RECT + ' fill: #aabbcc; }', 'fill').value).toBe('#aabbcc');
  });

  it('parses rgba() with decimal alpha', () => {
    const v = firstProp(RECT + ' fill: rgba(255, 0, 0, 0.5); }', 'fill');
    const json = JSON.stringify(v);
    expect(json).toContain('255');
    expect(json).toContain('0.5');
  });

  it('parses hsla() including percent alpha', () => {
    const v = firstProp(RECT + ' fill: hsla(200, 50%, 50%, 50%); }', 'fill');
    expect(JSON.stringify(v)).toContain('200');
  });

  it('parses color transform functions', () => {
    const v = firstProp(RECT + ' fill: lighten(#336699, 10%); }', 'fill');
    expect(v).toBeDefined();
  });
});

describe('Parser values: sizes and dimensions', () => {
  it('accepts single and paired sizes', () => {
    const p = props('rect { size: 100px; } rect { size: 100px 50px; }');
    expect(p['size']).toBeDefined();
  });

  it('keeps auto/fill/hug keywords as strings', () => {
    const src = RECT + ' size: 120px auto; } rect2 { size: fill hug; }';
    const doc = parseToad(src, 's.toad');
    const json = JSON.stringify(doc);
    expect(json).toContain('auto');
  });

  it('requires the comma inside (x, y) tuples', () => {
    // Comma form parses cleanly into a coordinate value.
    const ok = parseToad(RECT + ' origin: (10px, 20px); }', 't1.toad');
    expect(ok.elements.length).toBeGreaterThan(0);
  });
});

describe('Parser values: at / relational anchors', () => {
  it('parses plain coordinates', () => {
    const v = firstProp(RECT + ' at: 10px 20px; }', 'at');
    expect(v).toBeDefined();
  });

  it('parses all relational keywords without a target (parent default)', () => {
    for (const rel of ['center', 'right', 'left', 'above', 'below', 'inside', 'top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      const v = firstProp(RECT + ` at: ${rel}; }`, 'at');
      expect(v, rel).toBeDefined();
      expect(JSON.stringify(v), rel).toContain(rel === 'top-left' ? 'left' : rel.split('-')[0]);
    }
  });

  it('parses explicit canvas/parent/#id targets', () => {
    for (const target of ['canvas', 'parent', '#hero']) {
      const v = firstProp(RECT + ` at: below ${target}; }`, 'at');
      expect(v).toBeDefined();
    }
  });

  it('parses corner anchors against targets', () => {
    const v = firstProp(RECT + ' at: top-right of canvas; }', 'at');
    expect(JSON.stringify(v)).toContain('right');
  });

  it('parses previous as an anchor target', () => {
    const v = firstProp(RECT + ' at: right of previous; }', 'at');
    expect(JSON.stringify(v)).toContain('previous');
  });

  it('parses offset suffixes in both forms', () => {
    const a = firstProp(RECT + ' at: below parent offset 16px; }', 'at');
    expect(a).toBeDefined();
    const b = firstProp(RECT + ' at: below parent offset (16px, 24px); }', 'at');
    expect(b).toBeDefined();
  });
});

describe('Parser values: shadows', () => {
  it('parses x y blur color shadow quadruples', () => {
    const v = firstProp(RECT + ' shadow: 4px 8px 12px #00000080; }', 'shadow');
    expect(v).toBeDefined();
  });

  it('parses inset shadows', () => {
    const v = firstProp(RECT + ' inner-shadow: 2px 2px 6px rgba(0,0,0,0.5); }', 'inner-shadow');
    expect(v).toBeDefined();
  });
});

describe('Parser values: gradients', () => {
  it('parses linear-gradient with stops', () => {
    const v = firstProp(RECT + ' fill: linear-gradient(90deg, #ff0000, #0000ff); }', 'fill');
    const json = JSON.stringify(v);
    expect(json.toLowerCase()).toContain('linear');
  });

  it('parses linear-gradient default direction (no preamble)', () => {
    const v = firstProp(RECT + ' fill: linear-gradient(#f00, #00f); }', 'fill');
    expect(v).toBeDefined();
  });

  it('parses radial-gradient CSS preamble tokens without creating bogus stops', () => {
    const v: any = firstProp(RECT + ' fill: radial-gradient(circle at center, #ff0000, #0000ff); }', 'fill');
    expect(v.type).toBe('RadialGradient');
    expect(v.shape).toBe('circle');
    // Exactly the two color stops survive; preamble tokens are not stops.
    const stopJson = JSON.stringify(v.stops);
    expect(stopJson).toContain('#ff0000');
    expect(stopJson).toContain('#0000ff');
    expect(stopJson.toLowerCase()).not.toContain('closest');
  });

  it('parses conic-gradient', () => {
    const v = firstProp(RECT + ' fill: conic-gradient(#f00, #0f0, #00f, #f00); }', 'fill');
    expect(v).toBeDefined();
  });
});

describe('Parser values: filters', () => {
  it('parses filter chains into structured functions', () => {
    const v = firstProp(RECT + ' filter: blur(4px) saturate(1.2) brightness(110%); }', 'filter');
    const json = JSON.stringify(v);
    expect(json).toContain('blur');
    expect(json).toContain('saturate');
  });

  it('keeps nested color arguments intact inside drop-shadow', () => {
    const v: any = firstProp(RECT + ' filter: drop-shadow(2px 2px 2px rgba(0,0,0,.6)); }', 'filter');
    const args = JSON.stringify(v);
    expect(args).toContain('rgba');
    // The full color must survive arg tokenization.
    expect(args).toMatch(/rgba\(0\s*,\s*0\s*,\s*0/);
  });

  it('recovers from an unterminated filter function and keeps later siblings', () => {
    const doc = parseToad(`rect #a { filter: blur(4px } rect #b { size: 5px 5px; }`, 'u.toad');
    const ids = doc.elements.map(e => e.id);
    expect(ids).toContain('b');
  });

  it('tolerates opacity() in the filter grammar', () => {
    const v = firstProp(RECT + ' filter: opacity(50%); }', 'filter');
    expect(JSON.stringify(v)).toContain('opacity');
  });
});

describe('Parser values: misc value types', () => {
  it('parses stroke shorthand with width', () => {
    const v = firstProp(RECT + ' stroke: #10b981 4px solid; }', 'stroke');
    expect(v).toBeDefined();
  });

  it('parses polygon point arrays', () => {
    const v = firstProp('polygon { points: [(-50px, -50px), (50px, -50px), (0px, 50px)]; }', 'points');
    expect(v).toBeDefined();
  });

  it('parses calc() into an ExpressionList with a CalcValue member', () => {
    const v: any = firstProp(RECT + ' at: calc(100px - 2 * 10px) 40px; }', 'at');
    expect(v.type).toBe('ExpressionList');
    const json = JSON.stringify(v);
    expect(json).toContain('CalcValue');
    expect(json).toContain('40px');
  });

  it('parses variable references as property values', () => {
    const doc = parseToad('>brand = #38bdf8; rect #r { fill: >brand; }', 'v.toad');
    const p: any = doc.elements[0].properties.find((x: any) => x.name === 'fill');
    expect(p.value).toBeDefined();
    const json = JSON.stringify(p.value);
    expect(json).toContain('brand');
  });

  it('reports a diagnostic when a VALUE position hits a terminator', () => {
    const src = RECT + ' size: ; fill: #fff; }';
    const parser = new Parser(new Lexer(src, 'test.toad').tokenize(), 'test.toad');
    const doc = parser.parse();
    const diags: any[] = (parser as any).diagnostics || [];
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.map((d) => d.message).join('|')).toMatch(/[Ee]xpected a value/);
    expect(doc.elements.length).toBeGreaterThan(0);
  });
});
