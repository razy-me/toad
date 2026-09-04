import { describe, it, expect } from 'vitest';
import { parseToad } from '../../src/parser/parser.js';
import { resolveImportsAndComponents } from '../../src/parser/importResolver.js';
import { resolveDimension, evaluateCalc, solveLayout } from '../../src/parser/math.js';

describe('Phase 2 Compiler & Layout Regression Suite', () => {
  it('resolves physical units correctly in resolveDimension and evaluateCalc', () => {
    // 96 DPI defaults
    expect(resolveDimension('2in', 1000, 0, 96)).toBe(192);
    expect(resolveDimension('1in', 1000, 0, 300)).toBe(300);
    expect(resolveDimension('72pt', 1000, 0, 96)).toBe(96);
    expect(Math.round(resolveDimension('25.4mm', 1000, 0, 96))).toBe(96);

    // evaluateCalc with units and dpi
    expect(evaluateCalc('calc(1in + 4px)', 1000, 96)).toBe(100);
    expect(evaluateCalc('calc(100% - 2rem)', 500, 96)).toBe(500 - 32);
    expect(evaluateCalc('calc(50vw)', 800, 96)).toBe(400);
  });

  it('correctly binds component arguments in caller scope rather than internal parameter scope', async () => {
    const src = `
      >size = 40px;

      component Box(size = 100px, padding = 10px) {
        rect #bg {
          size: >size >size;
          radius: >padding;
        }
      }

      Box #testBox {
        size: 200px;
        padding: >size;
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const layout = await solveLayout(resolved);

    const bgNode = layout.nodes.find(n => n.id === 'testBox');
    expect(bgNode).toBeDefined();
    // width/height from size parameter override = 200
    expect(bgNode!.width).toBe(200);
    // radius from padding = >size in caller scope = 40px (NOT 200px!)
    expect(bgNode!.style.borderRadius).toBe(40);
  });

  it('preserves 2D scale specified as two values (ArrayLiteral)', async () => {
    const src = `
      rect #scaled {
        size: 100px 100px;
        scale: 1.5 2.0;
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const node = resolved.elements.find(e => e.id === 'scaled');
    expect(node).toBeDefined();
    expect(node!.scale).toEqual({ x: 1.5, y: 2.0 });
  });

  it('allows font-family to be provided as a variable reference in font shorthand', async () => {
    const src = `
      >brandFont = "Helvetica Neue";
      text #heading {
        font: bold 24px >brandFont;
        content: "Hello World";
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const heading = resolved.elements.find(e => e.id === 'heading');
    expect(heading).toBeDefined();
    expect(heading!.font?.family).toBe('Helvetica Neue');
    expect(heading!.font?.size).toBe(24);
    expect(heading!.font?.weight).toBe('bold');
  });

  it('updates stack dimensions before child layout pass so children resolve against final container box', async () => {
    const src = `
      canvas {
        size: 800px 600px;
      }
      stack #myStack {
        direction: vertical;
        padding: 20px;
        rect #item1 {
          size: 200px 50px;
          fill: #f00;
        }
        rect #item2 {
          size: 200px 50px;
          fill: #0f0;
        }
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const layout = await solveLayout(resolved);

    const stackNode = layout.nodes.find(n => n.id === 'myStack');
    expect(stackNode).toBeDefined();
    // 50 + 50 + 20 + 20 = 140
    expect(stackNode!.height).toBe(140);
    // 200 + 20 + 20 = 240
    expect(stackNode!.width).toBe(240);
  });

  it('correctly handles diamond imports without shadowing or duplication', async () => {
    const virtualFiles = new Map<string, string>();
    virtualFiles.set('tokens.toad', `
      >baseColor = #111111;
      >accentColor = #ff0000;
    `);
    virtualFiles.set('moduleA.toad', `
      @import "tokens.toad";
      >accentColor = #00ff00;
    `);
    virtualFiles.set('moduleB.toad', `
      @import "tokens.toad";
    `);
    virtualFiles.set('entry.toad', `
      @import "moduleA.toad";
      @import "moduleB.toad";
      rect #box {
        fill: >accentColor;
      }
    `);

    const loader = (filePath: string) => {
      const base = filePath.split(/[/\\]/).pop()!;
      if (virtualFiles.has(base)) return virtualFiles.get(base)!;
      throw new Error(`File not found: ${filePath}`);
    };

    const entryAst = parseToad(virtualFiles.get('entry.toad')!, 'entry.toad');
    const resolved = await resolveImportsAndComponents(entryAst, 'entry.toad', loader);

    const box = resolved.elements.find(e => e.id === 'box');
    expect(box).toBeDefined();
    // moduleA overrides accentColor to #00ff00; moduleB should not reset it back to #ff0000!
    expect(box!.fill).toBe('#00ff00');
  });
});
