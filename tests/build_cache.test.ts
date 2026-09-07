import { describe, it, expect, beforeEach } from 'vitest';
import { TextMeasurementCache, AstCache } from '../src/engine/buildCache.js';
import { layoutText } from '../src/parser/math.js';
import { parseToad } from '../src/parser/parser.js';

describe('Incremental Compilation & Measurement Cache (Feature 5)', () => {
  beforeEach(() => {
    TextMeasurementCache.getInstance().clear();
    AstCache.getInstance().clear();
  });

  it('memoizes text layout calculations across repeated calls', () => {
    const textCache = TextMeasurementCache.getInstance();
    expect(textCache.getStats().hits).toBe(0);
    expect(textCache.getStats().entries).toBe(0);

    const style = {
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 700,
      lineHeight: 32,
      explicitWidth: 300
    };

    const text = 'Declarative visual layout compiler for production graphics.';

    // First call: cold compute
    const res1 = layoutText(text, style);
    expect(res1.lines.length).toBeGreaterThan(1);
    expect(textCache.getStats().entries).toBe(1);
    expect(textCache.getStats().hits).toBe(0);

    // Second call with same text and style: instant cache hit
    const res2 = layoutText(text, style);
    expect(res2.lines).toEqual(res1.lines);
    expect(res2.width).toBe(res1.width);
    expect(res2.height).toBe(res1.height);
    expect(textCache.getStats().hits).toBe(1);

    // Third call with modified fontSize: cache miss & new entry
    const res3 = layoutText(text, { ...style, fontSize: 18 });
    expect(textCache.getStats().entries).toBe(2);
    expect(textCache.getStats().hits).toBe(1);
  });

  it('caches and invalidates parsed AST in AstCache', () => {
    const astCache = AstCache.getInstance();
    const filePath = '/test/project/canvas.toad';
    const mtime1 = 1700000000000;
    const source1 = 'canvas { size: 400px 400px; }';

    const ast1 = parseToad(source1, filePath);
    astCache.set(filePath, mtime1, ast1, source1);

    expect(astCache.getStats().entries).toBe(1);

    // Same mtime -> hits cache
    const retrieved = astCache.get(filePath, mtime1);
    expect(retrieved).toBe(ast1);
    expect(astCache.getStats().hits).toBe(1);

    // Newer mtime -> misses cache and invalidates stale entry
    const staleCheck = astCache.get(filePath, mtime1 + 1000);
    expect(staleCheck).toBeNull();
    expect(astCache.getStats().misses).toBe(1);
  });
});
