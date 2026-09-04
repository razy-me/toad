import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import {
  resolveImportsAndComponents,
  CircularImportError,
  CircularVariableError,
  ComponentRecursionLimitError
} from '../src/parser/importResolver.js';

describe('Import & Component Resolver', () => {
  it('resolves multi-file imports and merges variables', async () => {
    const files: Record<string, string> = {
      'c:/app/tokens.toad': `
        >primary = #3b82f6;
        >spacing = 16px;
      `,
      'c:/app/main.toad': `
        @import "./tokens.toad";
        canvas {
          size: 800px 600px;
        }
        rect #box {
          at: 0 0;
          size: >spacing >spacing;
          fill: >primary;
        }
      `
    };

    const loader = (p: string) => {
      const normalized = p.replace(/\\/g, '/');
      const content = files[normalized];
      if (!content) throw new Error(`File not found: ${normalized}`);
      return content;
    };

    const entryDoc = parseToad(files['c:/app/main.toad'], 'c:/app/main.toad');
    const resolved = await resolveImportsAndComponents(entryDoc, 'c:/app/main.toad', loader);

    expect(resolved.canvas.width).toBe(800);
    expect(resolved.canvas.height).toBe(600);
    expect(resolved.elements).toHaveLength(1);

    const box = resolved.elements[0];
    expect(box.id).toBe('box');
    expect(box.size?.w).toBe(16);
    expect(box.size?.h).toBe(16);
    expect(box.fill).toBe('#3b82f6');
  });

  it('detects circular imports and throws CircularImportError', async () => {
    const files: Record<string, string> = {
      'c:/app/a.toad': `@import "./b.toad";`,
      'c:/app/b.toad': `@import "./c.toad";`,
      'c:/app/c.toad': `@import "./a.toad";`
    };

    const loader = (p: string) => {
      const normalized = p.replace(/\\/g, '/');
      return files[normalized] || '';
    };

    const entryDoc = parseToad(files['c:/app/a.toad'], 'c:/app/a.toad');
    await expect(resolveImportsAndComponents(entryDoc, 'c:/app/a.toad', loader)).rejects.toThrow(
      CircularImportError
    );
  });

  it('detects circular variable dependencies and throws CircularVariableError', async () => {
    const src = `
      >a = >b;
      >b = >a;
      rect { size: >a >b; }
    `;
    const doc = parseToad(src);
    await expect(resolveImportsAndComponents(doc, 'main.toad')).rejects.toThrow(
      CircularVariableError
    );
  });

  it('expands component with parameter default values and call-site overrides', async () => {
    const src = `
      component Badge(label = "New", bg = #10b981, size = 120px) {
        rect {
          size: >size 32px;
          fill: >bg;
          radius: 4px;
        }
      }

      Badge(bg: #ef4444) #dangerBadge {
        at: 20px 40px;
      }

      Badge #defaultBadge {
        at: 20px 80px;
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'main.toad');

    expect(resolved.elements).toHaveLength(2);

    const dangerBadge = resolved.elements[0];
    expect(dangerBadge.id).toBe('dangerBadge');
    expect(dangerBadge.fill).toBe('#ef4444');
    expect(dangerBadge.size?.w).toBe(120); // Default param

    const defaultBadge = resolved.elements[1];
    expect(defaultBadge.id).toBe('defaultBadge');
    expect(defaultBadge.fill).toBe('#10b981'); // Default param
  });

  it('mangles internal component element IDs to avoid collisions', async () => {
    const src = `
      component Card {
        rect #cardBg { size: 200px 100px; }
        text "Title" #cardTitle { at: 10px 10px; }
      }

      Card #c1 { at: 0 0; }
      Card #c2 { at: 0 200px; }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'main.toad');

    expect(resolved.elements).toHaveLength(2);
    const c1 = resolved.elements[0];
    const c2 = resolved.elements[1];

    expect(c1.id).toBe('c1');
    expect(c2.id).toBe('c2');

    // Children IDs should be mangled with prefix
    expect(c1.children?.[0].id).toContain('cardBg');
    expect(c2.children?.[0].id).toContain('cardBg');
    expect(c1.children?.[0].id).not.toBe(c2.children?.[0].id);
  });

  it('aggregates font directives across imported files', async () => {
    const files: Record<string, string> = {
      'c:/app/fonts.toad': `
        @font "./fonts/Inter-Regular.ttf" as "Inter";
        @font "./fonts/Inter-Bold.ttf" as "Inter" bold;
      `,
      'c:/app/main.toad': `
        @import "./fonts.toad";
        @font "./fonts/FiraCode.ttf" as "FiraCode";
      `
    };

    const loader = (p: string) => files[p.replace(/\\/g, '/')] || '';
    const entryDoc = parseToad(files['c:/app/main.toad'], 'c:/app/main.toad');
    const resolved = await resolveImportsAndComponents(entryDoc, 'c:/app/main.toad', loader);

    expect(resolved.fonts).toHaveLength(3);
    const families = resolved.fonts.map(f => f.family);
    expect(families).toContain('Inter');
    expect(families).toContain('FiraCode');
  });

  it('detects deep recursive component expansion exceeding depth limit', async () => {
    const src = `
      component Loop {
        Loop {}
      }
      Loop #root {}
    `;
    const doc = parseToad(src);
    await expect(resolveImportsAndComponents(doc, 'main.toad')).rejects.toThrow(
      ComponentRecursionLimitError
    );
  });

  it('supports positional arguments when instantiating components', async () => {
    const src = `
      component Box(w = 100px, h = 50px, color = #000) {
        rect {
          size: >w >h;
          fill: >color;
        }
      }

      Box(200px, 80px, #ff0000) #customBox {
        at: 0 0;
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'main.toad');

    const box = resolved.elements[0];
    expect(box.size?.w).toBe(200);
    expect(box.size?.h).toBe(80);
    expect(box.fill).toBe('#ff0000');
  });

  it('correctly handles variable shadowing across multiple import layers', async () => {
    const files: Record<string, string> = {
      'c:/app/base.toad': `>color = #111;`,
      'c:/app/theme.toad': `
        @import "./base.toad";
        >color = #222;
      `,
      'c:/app/main.toad': `
        @import "./theme.toad";
        rect { fill: >color; }
      `
    };

    const loader = (p: string) => files[p.replace(/\\/g, '/')] || '';
    const entryDoc = parseToad(files['c:/app/main.toad'], 'c:/app/main.toad');
    const resolved = await resolveImportsAndComponents(entryDoc, 'c:/app/main.toad', loader);

    expect(resolved.elements[0].fill).toBe('#222');
  });
});

