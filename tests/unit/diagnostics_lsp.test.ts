import { describe, it, expect } from 'vitest';
import { levenshteinDistance, suggestProperty, KNOWN_PROPERTIES } from '../../src/tools/diagnostics.js';
import { ToadLanguageServer } from '../../src/tools/lsp/server.js';

describe('Unit Tests: Diagnostics & LSP Server', () => {
  describe('Levenshtein Distance Calculation', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('background', 'background')).toBe(0);
    });

    it('returns string length when comparing with empty string', () => {
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', 'world')).toBe(5);
    });

    it('calculates single edit operations (insert, delete, substitute)', () => {
      expect(levenshteinDistance('cat', 'cats')).toBe(1); // insertion
      expect(levenshteinDistance('cats', 'cat')).toBe(1); // deletion
      expect(levenshteinDistance('cat', 'bat')).toBe(1); // substitution
    });

    it('calculates multi-character edit distances correctly', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
    });
  });

  describe('Property Suggestion Engine (suggestProperty)', () => {
    it('suggests closest match for single-character typos', () => {
      expect(suggestProperty('radus')).toBe('radius');
      expect(suggestProperty('strok')).toBe('stroke');
      expect(suggestProperty('opcity')).toBe('opacity');
      expect(suggestProperty('fil')).toBe('fill');
    });

    it('suggests closest match for transposed or substituted characters', () => {
      expect(suggestProperty('bacground')).toBe('background');
      expect(suggestProperty('direciton')).toBe('direction');
      expect(suggestProperty('shodow')).toBe('shadow');
    });

    it('returns null when typo exceeds distance threshold', () => {
      expect(suggestProperty('completelyRandomUnknownWord', 3)).toBeNull();
      expect(suggestProperty('xyz123', 2)).toBeNull();
    });

    it('normalizes casing and hyphens before matching', () => {
      expect(['stroke-width', 'strokeWidth']).toContain(suggestProperty('stroke_width'));
      expect(['font-family', 'fontFamily']).toContain(suggestProperty('font_family'));
    });
  });

  describe('LSP Language Server (ToadLanguageServer)', () => {
    const lsp = new ToadLanguageServer();

    it('returns error diagnostics for syntax errors', async () => {
      const code = `
        canvas {
          size: 800px 600px
          // missing semicolon
          background: #ffffff;
        }
      `;
      const diags = await lsp.validateTextDocument('uri://test.toad', code);
      expect(diags.length).toBeGreaterThan(0);
      expect(diags.some(d => d.severity === 1)).toBe(true);
    });

    it('returns lint warnings for duplicate IDs and unused variables', async () => {
      const code = `
        >unusedColor = #ff0000;
        canvas { size: 800px 600px; }
        rect #box { size: 100px 100px; }
        circle #box { size: 50px 50px; }
      `;
      const diags = await lsp.validateTextDocument('uri://test_lint.toad', code);
      expect(diags.length).toBeGreaterThan(0);
      const dupes = diags.filter(d => d.message.includes('Duplicate element ID'));
      expect(dupes.length).toBe(1);
    });

    it('returns empty diagnostics for valid and clean toad code', async () => {
      const code = `
        >bg = #0f172a;
        canvas { size: 800px 600px; background: >bg; }
        rect #card { size: 200px 100px; fill: #38bdf8; }
      `;
      const diags = await lsp.validateTextDocument('uri://clean.toad', code);
      expect(diags.length).toBe(0);
    });

    it('provides autocompletion suggestions matching known properties', () => {
      const completions = lsp.onCompletion({ line: 1, character: 2 });
      expect(completions.length).toBe(KNOWN_PROPERTIES.length);
      const labels = completions.map(c => c.label);
      expect(labels).toContain('fill');
      expect(labels).toContain('stroke');
      expect(labels).toContain('radius');
      expect(labels).toContain('shadow');
      expect(labels).toContain('font-family');
    });
  });
});
