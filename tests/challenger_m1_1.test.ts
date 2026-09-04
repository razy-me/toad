import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { Lexer, TokenType, tokenizeToad } from '../src/parser/lexer.js';
import {
  resolveImportsAndComponents,
  CircularImportError,
  CircularVariableError,
  ComponentRecursionLimitError
} from '../src/parser/importResolver.js';
import {
  solveLayout,
  layoutText,
  computeGcd,
  computeAspectRatio,
  LayoutSolver
} from '../src/parser/math.js';
import {
  DependencyGraph,
  CyclicDependencyError,
  topologicalSort
} from '../src/parser/dependencyGraph.js';

describe('Adversarial Stress Test Suite — challenger_m1_1', () => {

  // ==========================================================================
  // Category 1: Syntax Edge Cases, Unterminated Strings, Comments, Hex vs ID
  // ==========================================================================
  describe('Category 1: Syntax Edge Cases & Lexical Disambiguation', () => {

    it('handles unterminated string literals gracefully without infinite loops', () => {
      const src = `text "Unterminated string at EOF`;
      const tokens = tokenizeToad(src);

      expect(tokens[0].type).toBe(TokenType.KW_TEXT);
      expect(tokens[1].type).toBe(TokenType.STRING);
      expect(tokens[1].value).toBe('Unterminated string at EOF');
      expect(tokens[2].type).toBe(TokenType.EOF);
    });

    it('correctly distinguishes comments vs string literals containing comment delimiters', () => {
      const src = `
        text "https://example.com/asset?id=123//not-a-comment" #url1 {
          fill: #000;
        }
        text "/* Not a block comment */" #url2;
      `;
      const doc = parseToad(src);
      expect(doc.elements).toHaveLength(2);
      expect((doc.elements[0] as any).text).toBe('https://example.com/asset?id=123//not-a-comment');
      expect((doc.elements[1] as any).text).toBe('/* Not a block comment */');
    });

    it('parses inline comments interspersed within property declarations and points', () => {
      const src = `
        rect #box {
          /* start */ size: /* width */ 250px /* height */ 150px /* end */; // trailing
          fill: /* red */ #ff0000;
        }
      `;
      const doc = parseToad(src);
      expect(doc.elements).toHaveLength(1);
      const box = doc.elements[0];
      const sizeProp = box.properties.find(p => p.name === 'size');
      expect(sizeProp).toBeDefined();
      expect(sizeProp?.value.type).toBe('CoordinateValue');
    });

    it('rigorously tests hex color vs element ID disambiguation boundary cases', () => {
      // Hex colors: exactly 3, 4, 6, 8 hex digits (0-9, a-f, A-F)
      // Element IDs: any identifier starting with # that does not strictly match 3, 4, 6, 8 hex digits
      const src = `
        #fff #ffffff #3b82f6 #12345678 #face #0000 #AABBCCDDEE
        #a #ab #abcde #abcdef012 #button #submit-btn #1234z #c-a-r-d #999px #e0e0e0
      `;
      const tokens = tokenizeToad(src);

      const tokenTypes = tokens.filter(t => t.type !== TokenType.EOF).map(t => ({
        type: t.type,
        val: t.value
      }));

      // #fff -> HEX (3)
      expect(tokenTypes[0]).toEqual({ type: TokenType.HEX_COLOR, val: '#fff' });
      // #ffffff -> HEX (6)
      expect(tokenTypes[1]).toEqual({ type: TokenType.HEX_COLOR, val: '#ffffff' });
      // #3b82f6 -> HEX (6)
      expect(tokenTypes[2]).toEqual({ type: TokenType.HEX_COLOR, val: '#3b82f6' });
      // #12345678 -> HEX (8)
      expect(tokenTypes[3]).toEqual({ type: TokenType.HEX_COLOR, val: '#12345678' });
      // #face -> HEX (4)
      expect(tokenTypes[4]).toEqual({ type: TokenType.HEX_COLOR, val: '#face' });
      // #0000 -> HEX (4)
      expect(tokenTypes[5]).toEqual({ type: TokenType.HEX_COLOR, val: '#0000' });
      // #AABBCCDDEE -> 10 hex digits -> NOT 3/4/6/8 -> ELEMENT_ID 'AABBCCDDEE'
      expect(tokenTypes[6]).toEqual({ type: TokenType.ELEMENT_ID, val: 'AABBCCDDEE' });

      // #a -> 1 char -> ELEMENT_ID 'a'
      expect(tokenTypes[7]).toEqual({ type: TokenType.ELEMENT_ID, val: 'a' });
      // #ab -> 2 chars -> ELEMENT_ID 'ab'
      expect(tokenTypes[8]).toEqual({ type: TokenType.ELEMENT_ID, val: 'ab' });
      // #abcde -> 5 chars -> ELEMENT_ID 'abcde'
      expect(tokenTypes[9]).toEqual({ type: TokenType.ELEMENT_ID, val: 'abcde' });
      // #abcdef012 -> 9 chars -> ELEMENT_ID 'abcdef012'
      expect(tokenTypes[10]).toEqual({ type: TokenType.ELEMENT_ID, val: 'abcdef012' });
      // #button -> contains non-hex 'u', 't', 'o', 'n' -> ELEMENT_ID 'button'
      expect(tokenTypes[11]).toEqual({ type: TokenType.ELEMENT_ID, val: 'button' });
      // #submit-btn -> contains dash -> ELEMENT_ID 'submit-btn'
      expect(tokenTypes[12]).toEqual({ type: TokenType.ELEMENT_ID, val: 'submit-btn' });
      // #1234z -> contains 'z' -> ELEMENT_ID '1234z'
      expect(tokenTypes[13]).toEqual({ type: TokenType.ELEMENT_ID, val: '1234z' });
      // #c-a-r-d -> contains dash -> ELEMENT_ID 'c-a-r-d'
      expect(tokenTypes[14]).toEqual({ type: TokenType.ELEMENT_ID, val: 'c-a-r-d' });
      // #999px -> contains 'p', 'x' -> ELEMENT_ID '999px'
      expect(tokenTypes[15]).toEqual({ type: TokenType.ELEMENT_ID, val: '999px' });
      // #e0e0e0 -> 6 hex -> HEX_COLOR '#e0e0e0'
      expect(tokenTypes[16]).toEqual({ type: TokenType.HEX_COLOR, val: '#e0e0e0' });
    });

    it('correctly parses extreme dimension formats (floating point, negative, unitless, various units)', () => {
      const src = `
        rect #r1 {
          at: -12.5px 0.05rem;
          size: 100vw 50.75vh;
          rotation: -45.5deg;
        }
      `;
      const doc = parseToad(src);
      expect(doc.elements).toHaveLength(1);
      const r1 = doc.elements[0];

      const atProp = r1.properties.find(p => p.name === 'at');
      expect(atProp?.value.type).toBe('CoordinateValue');
      const coord = atProp?.value as any;
      expect(coord.x.value).toBe(-12.5);
      expect(coord.x.unit).toBe('px');
      expect(coord.y.value).toBe(0.05);
      expect(coord.y.unit).toBe('rem');

      const sizeProp = r1.properties.find(p => p.name === 'size');
      const sizeVal = sizeProp?.value as any;
      expect(sizeVal.x.value).toBe(100);
      expect(sizeVal.x.unit).toBe('vw');
      expect(sizeVal.y.value).toBe(50.75);
      expect(sizeVal.y.unit).toBe('vh');
    });

    it('recovers from multiple syntax errors across elements using panic mode', () => {
      const src = `
        rect #bad1 {
          size: ; // Malformed
          fill: #ff0000;
        }

        rect #good1 {
          size: 100px 100px;
        }

        rect #bad2 {
          at: 100px ;
        }

        rect #good2 {
          size: 200px 200px;
        }
      `;
      const doc = parseToad(src);

      expect(doc.diagnostics?.length).toBeGreaterThanOrEqual(2);
      // Both #good1 and #good2 should be successfully parsed
      const good1 = doc.elements.find(e => e.id === 'good1');
      const good2 = doc.elements.find(e => e.id === 'good2');
      expect(good1).toBeDefined();
      expect(good2).toBeDefined();
    });

    it('parses empty document and document with only whitespace/comments', () => {
      const doc1 = parseToad('');
      expect(doc1.elements).toHaveLength(0);
      expect(doc1.directives).toHaveLength(0);

      const doc2 = parseToad('// Comment 1\n/* Comment 2 */\n\n');
      expect(doc2.elements).toHaveLength(0);
      expect(doc2.directives).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Category 2: Complex Circular Imports & Deep Import Graphs
  // ==========================================================================
  describe('Category 2: Complex Circular Imports & Deep Import Graphs', () => {

    it('detects direct self-import (A -> A)', async () => {
      const files: Record<string, string> = {
        'c:/app/self.toad': `@import "./self.toad"; rect { size: 10px 10px; }`
      };
      const loader = (p: string) => files[p.replace(/\\/g, '/')] || '';
      const doc = parseToad(files['c:/app/self.toad'], 'c:/app/self.toad');

      await expect(resolveImportsAndComponents(doc, 'c:/app/self.toad', loader)).rejects.toThrow(
        CircularImportError
      );
    });

    it('detects deep multi-hop circular import (A -> B -> C -> D -> E -> B)', async () => {
      const files: Record<string, string> = {
        'c:/app/a.toad': `@import "./b.toad";`,
        'c:/app/b.toad': `@import "./c.toad";`,
        'c:/app/c.toad': `@import "./d.toad";`,
        'c:/app/d.toad': `@import "./e.toad";`,
        'c:/app/e.toad': `@import "./b.toad";`
      };
      const loader = (p: string) => files[p.replace(/\\/g, '/')] || '';
      const doc = parseToad(files['c:/app/a.toad'], 'c:/app/a.toad');

      await expect(resolveImportsAndComponents(doc, 'c:/app/a.toad', loader)).rejects.toThrow(
        CircularImportError
      );
    });

    it('correctly resolves diamond dependency graphs without false-positive circular errors', async () => {
      // Diamond:
      //         main
      //        /    \
      //     theme  layout
      //        \    /
      //        tokens
      const files: Record<string, string> = {
        'c:/app/tokens.toad': `
          >baseSize = 24px;
          >baseColor = #0f172a;
        `,
        'c:/app/theme.toad': `
          @import "./tokens.toad";
          >primary = #3b82f6;
        `,
        'c:/app/layout.toad': `
          @import "./tokens.toad";
          >containerW = 960px;
        `,
        'c:/app/main.toad': `
          @import "./theme.toad";
          @import "./layout.toad";
          canvas { size: >containerW 600px; }
          rect #hero {
            size: >containerW >baseSize;
            fill: >primary;
          }
        `
      };

      const loader = (p: string) => {
        const norm = p.replace(/\\/g, '/');
        const c = files[norm];
        if (!c) throw new Error(`Missing ${norm}`);
        return c;
      };

      const doc = parseToad(files['c:/app/main.toad'], 'c:/app/main.toad');
      const resolved = await resolveImportsAndComponents(doc, 'c:/app/main.toad', loader);
      const layout = await solveLayout(resolved);

      expect(layout.canvas.width).toBe(960);
      expect(layout.nodes[0].width).toBe(960);
      expect(layout.nodes[0].height).toBe(24);
      expect(layout.nodes[0].fill).toBe('#3b82f6');
    });

    it('resolves a 20-level linear deep import chain with variable forwarding', async () => {
      const files: Record<string, string> = {};
      const depth = 20;

      // level_0 defines base token
      files['c:/app/level_0.toad'] = `>seed = 10px;\n>color_0 = #101010;`;

      for (let i = 1; i <= depth; i++) {
        files[`c:/app/level_${i}.toad`] = `
          @import "./level_${i - 1}.toad";
          >val_${i} = >seed;
        `;
      }

      files['c:/app/main.toad'] = `
        @import "./level_${depth}.toad";
        rect #box {
          size: >val_${depth} 50px;
          fill: >color_0;
        }
      `;

      const loader = (p: string) => files[p.replace(/\\/g, '/')] || '';
      const doc = parseToad(files['c:/app/main.toad'], 'c:/app/main.toad');
      const resolved = await resolveImportsAndComponents(doc, 'c:/app/main.toad', loader);
      const layout = await solveLayout(resolved);

      expect(layout.nodes[0].width).toBe(10);
      expect(layout.nodes[0].height).toBe(50);
      expect(layout.nodes[0].fill).toBe('#101010');
    });

    it('detects complex variable circular dependency loop (>v1 -> >v2 -> >v3 -> >v1)', async () => {
      const src = `
        >v1 = >v2;
        >v2 = >v3;
        >v3 = >v1;
        rect { size: >v1 >v2; }
      `;
      const doc = parseToad(src);
      await expect(resolveImportsAndComponents(doc, 'main.toad')).rejects.toThrow(
        CircularVariableError
      );
    });

    it('detects self-referential variable definition (>x = >x)', async () => {
      const src = `
        >x = >x;
        rect { size: >x 10px; }
      `;
      const doc = parseToad(src);
      await expect(resolveImportsAndComponents(doc, 'main.toad')).rejects.toThrow(
        CircularVariableError
      );
    });

    it('instantiates components declared in transitively imported files', async () => {
      const files: Record<string, string> = {
        'c:/app/components.toad': `
          component ImportedBox(w = 150px, col = #6366f1) {
            rect #innerBox {
              size: >w 40px;
              fill: >col;
            }
          }
        `,
        'c:/app/main.toad': `
          @import "./components.toad";
          ImportedBox(w: 250px, col: #ec4899) #inst1 {
            at: 10px 10px;
          }
        `
      };
      const loader = (p: string) => files[p.replace(/\\/g, '/')] || '';
      const doc = parseToad(files['c:/app/main.toad'], 'c:/app/main.toad');
      const resolved = await resolveImportsAndComponents(doc, 'c:/app/main.toad', loader);
      const layout = await solveLayout(resolved);

      expect(layout.nodes).toHaveLength(1);
      expect(layout.nodes[0].width).toBe(250);
      expect(layout.nodes[0].fill).toBe('#ec4899');
    });
  });

  // ==========================================================================
  // Category 3: Relational DAG Dependencies, Disconnected Components, Multi-Cycle
  // ==========================================================================
  describe('Category 3: Complex Relational DAGs, Disconnected Graphs & Cycles', () => {

    it('solves layout for multiple disconnected dependency subgraphs in single document', async () => {
      const src = `
        canvas { size: 1000px 1000px; }

        // Subgraph 1: A -> B -> C
        rect #sub1_a { at: 50px 50px; size: 100px 50px; }
        rect #sub1_b { at: right of #sub1_a offset 10px; size: 100px 50px; }
        rect #sub1_c { at: below #sub1_b offset 10px; size: 100px 50px; }

        // Subgraph 2: D -> E
        rect #sub2_d { at: 500px 500px; size: 200px 100px; }
        rect #sub2_e { at: center of #sub2_d; size: 60px 40px; }

        // Subgraph 3: F (Standalone island)
        rect #sub3_f { at: 800px 100px; size: 80px 80px; }
      `;

      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const findNode = (id: string) => layout.nodes.find(n => n.id === id)!;

      // Subgraph 1
      expect(findNode('sub1_a').box).toEqual({ x: 50, y: 50, w: 100, h: 50 });
      expect(findNode('sub1_b').box).toEqual({ x: 160, y: 50, w: 100, h: 50 });
      expect(findNode('sub1_c').box).toEqual({ x: 160, y: 110, w: 100, h: 50 });

      // Subgraph 2
      expect(findNode('sub2_d').box).toEqual({ x: 500, y: 500, w: 200, h: 100 });
      // center of (500, 500, 200, 100) with size (60, 40)
      // x = 500 + (200 - 60)/2 = 570
      // y = 500 + (100 - 40)/2 = 530
      expect(findNode('sub2_e').box).toEqual({ x: 570, y: 530, w: 60, h: 40 });

      // Subgraph 3
      expect(findNode('sub3_f').box).toEqual({ x: 800, y: 100, w: 80, h: 80 });
    });

    it('solves 100-element chained relational positions declared in reverse order', async () => {
      // 100 elements: e_99 depends on e_98, e_98 on e_97 ... e_1 on e_0, e_0 at (0, 0)
      // Declared in reverse order (e_99 first, e_0 last)
      const elementsCode: string[] = [];
      for (let i = 99; i >= 1; i--) {
        elementsCode.push(`rect #e_${i} { at: right of #e_${i - 1} offset 5px; size: 20px 10px; }`);
      }
      elementsCode.push(`rect #e_0 { at: 0 0; size: 20px 10px; }`);

      const src = `
        canvas { size: 5000px 1000px; }
        ${elementsCode.join('\n')}
      `;

      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const findNode = (id: string) => layout.nodes.find(n => n.id === id)!;

      // e_0: x = 0
      expect(findNode('e_0').box.x).toBe(0);

      // e_1: x = 0 + 20 + 5 = 25
      expect(findNode('e_1').box.x).toBe(25);

      // e_99: x = 99 * (20 + 5) = 99 * 25 = 2475
      expect(findNode('e_99').box.x).toBe(2475);
    });

    it('detects direct self-referencing relational positioning (A at: right of #A)', async () => {
      const src = `
        rect #selfRef {
          at: right of #selfRef offset 10px;
          size: 100px 100px;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      await expect(solveLayout(resolved)).rejects.toThrow(CyclicDependencyError);
    });

    it('detects 3-node cyclic dependency in complex layout (A -> B -> C -> A)', async () => {
      const src = `
        rect #elemA { at: right of #elemB; size: 100px 50px; }
        rect #elemB { at: below #elemC; size: 100px 50px; }
        rect #elemC { at: left of #elemA; size: 100px 50px; }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      await expect(solveLayout(resolved)).rejects.toThrow(CyclicDependencyError);
    });

    it('correctly executes topological sort on deep DAG with branching and merging dependencies', () => {
      // Graph:
      //       Root (0 0)
      //      /    \
      //    Left   Right
      //      \    /
      //      Bottom
      const rootElem: any = { id: 'root', type: 'rect', at: { x: 0, y: 0 }, size: { w: 100, h: 50 }, name: 'root' };
      const leftElem: any = { id: 'left', type: 'rect', at: { relational: { relation: 'below', targetId: 'root', offset: 10 } }, size: { w: 40, h: 40 }, name: 'left' };
      const rightElem: any = { id: 'right', type: 'rect', at: { relational: { relation: 'right of', targetId: 'root', offset: 10 } }, size: { w: 40, h: 40 }, name: 'right' };
      const bottomElem: any = { id: 'bottom', type: 'rect', at: { relational: { relation: 'below', targetId: 'left', offset: 10 } }, size: { w: 100, h: 20 }, name: 'bottom' };

      const order = topologicalSort([bottomElem, rightElem, leftElem, rootElem]);
      const ids = order.map(o => o.id);

      // Root must come before left and right; left must come before bottom
      expect(ids.indexOf('root')).toBeLessThan(ids.indexOf('left'));
      expect(ids.indexOf('root')).toBeLessThan(ids.indexOf('right'));
      expect(ids.indexOf('left')).toBeLessThan(ids.indexOf('bottom'));
    });

    it('handles relational references to canvas boundaries (center of canvas, inside canvas)', async () => {
      const src = `
        canvas { size: 1200px 800px; }

        rect #centerBox {
          at: center of canvas;
          size: 400px 200px;
        }

        rect #insideBox {
          at: inside canvas offset 30px;
          size: 100px 100px;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const centerBox = layout.nodes.find(n => n.id === 'centerBox')!;
      const insideBox = layout.nodes.find(n => n.id === 'insideBox')!;

      // center of (1200, 800) with size (400, 200) -> x = (1200 - 400)/2 = 400, y = (800 - 200)/2 = 300
      expect(centerBox.box).toEqual({ x: 400, y: 300, w: 400, h: 200 });

      // inside canvas offset 30px -> x = 30, y = 30
      expect(insideBox.box).toEqual({ x: 30, y: 30, w: 100, h: 100 });
    });
  });

  // ==========================================================================
  // Category 4: Bounding Box Geometry, Zero-Sized, Negative-Offset & Transforms
  // ==========================================================================
  describe('Category 4: Bounding Boxes, Zero-Sizes, Negative Offsets & Transforms', () => {

    it('computes relational positioning relative to zero-sized anchor element', async () => {
      const src = `
        canvas { size: 800px 600px; }

        // Anchor at (200, 150) with width 0, height 0
        rect #pointAnchor {
          at: 200px 150px;
          size: 0px 0px;
        }

        // Right of zero-sized anchor offset 25px -> x = 200 + 0 + 25 = 225, y = 150
        rect #rightChild {
          at: right of #pointAnchor offset 25px;
          size: 50px 50px;
        }

        // Below zero-sized anchor offset 30px -> x = 200, y = 150 + 0 + 30 = 180
        rect #belowChild {
          at: below #pointAnchor offset 30px;
          size: 50px 50px;
        }

        // Center of zero-sized anchor with size (40, 20) -> x = 200 + (0 - 40)/2 = 180, y = 150 + (0 - 20)/2 = 140
        rect #centerChild {
          at: center of #pointAnchor;
          size: 40px 20px;
        }
      `;

      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const findNode = (id: string) => layout.nodes.find(n => n.id === id)!;

      expect(findNode('pointAnchor').box).toEqual({ x: 200, y: 150, w: 0, h: 0 });
      expect(findNode('rightChild').box).toEqual({ x: 225, y: 150, w: 50, h: 50 });
      expect(findNode('belowChild').box).toEqual({ x: 200, y: 180, w: 50, h: 50 });
      expect(findNode('centerChild').box).toEqual({ x: 180, y: 140, w: 40, h: 20 });
    });

    it('correctly calculates negative offsets and coordinates throughout layout tree', async () => {
      const src = `
        canvas { size: 1000px 800px; }

        rect #anchor {
          at: 300px 300px;
          size: 200px 200px;
        }

        // Negative offset pulls element backwards into anchor
        rect #pulledIn {
          at: right of #anchor offset -50px;
          size: 80px 40px;
        }

        // Absolute negative placement
        rect #negativeOrigin {
          at: -100px -50px;
          size: 150px 100px;
        }

        // Left of with negative offset
        rect #leftPulled {
          at: left of #anchor offset -20px;
          size: 60px 60px;
        }
      `;

      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const findNode = (id: string) => layout.nodes.find(n => n.id === id)!;

      // pulledIn: x = 300 + 200 + (-50) = 450, y = 300
      expect(findNode('pulledIn').box).toEqual({ x: 450, y: 300, w: 80, h: 40 });

      // negativeOrigin: x = -100, y = -50
      expect(findNode('negativeOrigin').box).toEqual({ x: -100, y: -50, w: 150, h: 100 });

      // leftPulled: left of (300) with size 60 and offset -20 -> x = 300 - 60 - (-20) = 260, y = 300
      expect(findNode('leftPulled').box).toEqual({ x: 260, y: 300, w: 60, h: 60 });
    });

    it('computes enclosing group AABB when children span both negative and positive coordinates', async () => {
      const src = `
        group #spanningGroup {
          rect #childNeg {
            at: -80px -40px;
            size: 100px 80px; // Bounds: x [-80, 20], y [-40, 40]
          }
          rect #childPos {
            at: 120px 200px;
            size: 80px 60px;  // Bounds: x [120, 200], y [200, 260]
          }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const group = layout.nodes[0];
      // minX = -80, maxX = 200 -> width = 280
      // minY = -40, maxY = 260 -> height = 300
      expect(group.box.x).toBe(-80);
      expect(group.box.y).toBe(-40);
      expect(group.box.w).toBe(280);
      expect(group.box.h).toBe(300);
    });

    it('handles degenerate and single-point/horizontal polygons safely without division by zero', async () => {
      const src = `
        polygon #flatLine {
          at: 100px 100px;
          size: 200px 50px;
          points: [ (-50, 0), (0, 0), (50, 0) ]; // Horizontal line: height delta = 0
        }

        polygon #singlePoint {
          at: 50px 50px;
          points: [ (0, 0) ]; // Single point: width delta = 0, height delta = 0
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      expect(layout.nodes).toHaveLength(2);
      const flatLine = layout.nodes[0];
      expect(flatLine.polygonLayout?.canvasPoints).toBeDefined();
      expect(flatLine.polygonLayout!.canvasPoints).toHaveLength(3);

      const singlePt = layout.nodes[1];
      expect(singlePt.polygonLayout?.canvasPoints).toBeDefined();
      expect(singlePt.polygonLayout!.canvasPoints).toHaveLength(1);
    });

    it('preserves transformation, filter, blendMode, and border radius metadata on computed layout nodes', async () => {
      const src = `
        rect #transformed {
          at: 50px 50px;
          size: 200px 100px;
          rotation: 45;
          opacity: 0.85;
          blend-mode: "multiply";
          radius: [10, 20, 30, 40];
          filter: blur(5px) brightness(1.2) contrast(1.5);
          clip: true;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const node = layout.nodes[0];
      expect(node.style.rotation).toBe(45);
      expect(node.style.opacity).toBe(0.85);
      expect(node.style.blendMode).toBe('multiply');
      expect(node.style.filter).toContain('blur(5px)');
      expect(node.style.filter).toContain('brightness(1.2)');
      expect(node.style.clip).toBe(true);
    });
  });
});
