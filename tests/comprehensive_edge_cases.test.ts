import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents, CircularVariableError } from '../src/parser/importResolver.js';
import { solveLayout, evaluateCalc } from '../src/parser/math.js';
import { CyclicDependencyError } from '../src/parser/dependencyGraph.js';
import { lintDocument } from '../src/tools/linter.js';
import { suggestProperty } from '../src/tools/diagnostics.js';

describe('Comprehensive Edge Cases & Multi-Value Grammar Suite', () => {

  // ==========================================================================
  // Group 1: All Sizing Modes & Sizing Permutations
  // ==========================================================================
  describe('Group 1: Sizing Modes & Multi-Value Combinations', () => {
    
    it('1.1 parses size with hug hug, fill fill, hug fill, fill hug', async () => {
      const code = `
        canvas { width: 800px; height: 600px; }
        stack #s1 { size: hug hug; }
        stack #s2 { size: fill fill; }
        stack #s3 { size: hug fill; }
        stack #s4 { size: fill hug; }
      `;
      const doc = parseToad(code, 'sizing_keywords.toad');
      expect(doc.diagnostics?.length || 0).toBe(0);
      const resolved = await resolveImportsAndComponents(doc, 'sizing_keywords.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes).toHaveLength(4);
    });

    it('1.2 parses size with mixed percentages, pixels, calc, and keywords', async () => {
      const code = `
        canvas { width: 1000px; height: 800px; }
        rect #r1 { size: 100% hug; }
        rect #r2 { size: hug 100%; }
        rect #r3 { size: calc(100% - 40px) hug; }
        rect #r4 { size: hug calc(50% + 20px); }
        rect #r5 { size: 300px fill; }
        rect #r6 { size: fill 250px; }
        rect #r7 { size: calc(50% - 10px) calc(50% - 10px); }
      `;
      const doc = parseToad(code, 'mixed_sizes.toad');
      expect(doc.diagnostics?.length || 0).toBe(0);
      const resolved = await resolveImportsAndComponents(doc, 'mixed_sizes.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes).toHaveLength(7);
    });

    it('1.3 parses single dimension size shorthands', async () => {
      const code = `
        canvas { width: 500px; height: 500px; }
        rect #sq1 { size: 120px; }
        rect #sq2 { size: hug; }
        rect #sq3 { size: fill; }
        circle #c1 { size: 80px; }
      `;
      const doc = parseToad(code, 'single_sizes.toad');
      expect(doc.diagnostics?.length || 0).toBe(0);
      const resolved = await resolveImportsAndComponents(doc, 'single_sizes.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes).toHaveLength(4);
      expect(layout.nodes[0].width).toBe(120);
      expect(layout.nodes[0].height).toBe(120);
    });

    it('1.4 resolves calc expressions accurately in math module', () => {
      expect(evaluateCalc('calc(100% - 50px)', 1000)).toBe(950);
      expect(evaluateCalc('calc(50% + 25px)', 800)).toBe(425);
      expect(evaluateCalc('calc(100% / 2 - 10px)', 600)).toBe(290);
      expect(evaluateCalc('calc(20px * 3 + 10px)', 500)).toBe(70);
    });
  });

  // ==========================================================================
  // Group 2: Keywords in Shorthands & Multi-Value Properties
  // ==========================================================================
  describe('Group 2: Property Keywords & Shorthand Grammar', () => {

    it('2.1 parses stroke shorthands with any order of style, color, and width', async () => {
      const code = `
        >border = #64748b;
        canvas { width: 400px; height: 400px; }
        rect #s1 { stroke: solid #3b82f6 2px; }
        rect #s2 { stroke: 4px dashed #ef4444; }
        rect #s3 { stroke: dotted >border 1px; }
        rect #s4 { stroke: >border 3px; }
        rect #s5 { stroke: none; }
      `;
      const doc = parseToad(code, 'strokes.toad');
      expect(doc.diagnostics?.length || 0).toBe(0);
      const resolved = await resolveImportsAndComponents(doc, 'strokes.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes).toHaveLength(5);
      expect(layout.nodes[0].style.strokeStyle).toBe('solid');
      expect(layout.nodes[1].style.strokeStyle).toBe('dashed');
      expect(layout.nodes[2].style.strokeStyle).toBe('dotted');
      expect(layout.nodes[4].style.stroke).toBe('none');
    });

    it('2.2 parses layout flow, alignment, and justification keywords', async () => {
      const code = `
        canvas { width: 800px; height: 600px; }
        stack #stk1 {
          direction: vertical;
          align: center;
          justify: space-between;
          rect { size: 100px 50px; }
          rect { size: 100px 50px; }
        }
        stack #stk2 {
          direction: horizontal;
          align: end;
          justify: center;
          rect { size: 80px 40px; }
        }
        grid #grd {
          columns: 2;
          flow: row;
          rect { size: 50px 50px; }
          rect { size: 50px 50px; }
        }
      `;
      const doc = parseToad(code, 'flow_align.toad');
      expect(doc.diagnostics?.length || 0).toBe(0);
      const resolved = await resolveImportsAndComponents(doc, 'flow_align.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBeGreaterThan(0);
    });

    it('2.3 parses image fit keywords (cover, contain, fill, none)', async () => {
      const code = `
        canvas { width: 600px; height: 600px; }
        image #img1 { src: "test.png"; size: 200px 200px; fit: cover; }
        image #img2 { src: "test.png"; size: 200px 200px; fit: contain; }
        image #img3 { src: "test.png"; size: 200px 200px; fit: fill; }
        image #img4 { src: "test.png"; size: 200px 200px; fit: none; }
      `;
      const doc = parseToad(code, 'image_fits.toad');
      expect(doc.diagnostics?.length || 0).toBe(0);
      const resolved = await resolveImportsAndComponents(doc, 'image_fits.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes).toHaveLength(4);
      expect(layout.nodes[0].fit).toBe('cover');
      expect(layout.nodes[1].fit).toBe('contain');
      expect(layout.nodes[2].fit).toBe('fill');
      expect(layout.nodes[3].fit).toBe('none');
    });

    it('2.4 parses complex gradients with direction keywords and stops', async () => {
      const code = `
        >c1 = #3b82f6;
        >c2 = #8b5cf6;
        canvas { width: 500px; height: 500px; }
        rect #g1 { fill: linear-gradient(to right, >c1, >c2); size: 100px 100px; }
        rect #g2 { fill: linear-gradient(135deg, #ff007a 0%, #7928ca 50%, #0070f3 100%); size: 100px 100px; }
        rect #g3 { fill: radial-gradient(circle, #ffffff, #000000); size: 100px 100px; }
        rect #g4 { fill: conic-gradient(from 45deg, #f00, #0f0, #00f); size: 100px 100px; }
      `;
      const doc = parseToad(code, 'gradients.toad');
      expect(doc.diagnostics?.length || 0).toBe(0);
      const resolved = await resolveImportsAndComponents(doc, 'gradients.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes).toHaveLength(4);
    });
  });

  // ==========================================================================
  // Group 3: Variables, Nested Objects & Color Transforms
  // ==========================================================================
  describe('Group 3: Token Trees, Nested Variables & Color Transforms', () => {

    it('3.1 resolves deeply nested object variable trees', async () => {
      const code = `
        >theme = {
          colors: {
            primary: #38bdf8,
            secondary: #818cf8,
            surface: {
              card: #1e293b,
              canvas: #0f172a
            }
          },
          spacing: {
            sm: 8px,
            md: 16px,
            lg: 24px
          },
          radius: {
            card: 16px
          }
        };

        canvas "Dashboard" {
          width: 800px;
          height: 600px;
          background: >theme.colors.surface.canvas;

          stack #card {
            fill: >theme.colors.surface.card;
            padding: >theme.spacing.lg;
            gap: >theme.spacing.md;
            radius: >theme.radius.card;
            size: 400px hug;

            text {
              content: "Nested Tokens Work";
              color: >theme.colors.primary;
            }
          }
        }
      `;
      const doc = parseToad(code, 'nested_tokens.toad');
      expect(doc.diagnostics?.length || 0).toBe(0);
      const resolved = await resolveImportsAndComponents(doc, 'nested_tokens.toad');
      const layout = await solveLayout(resolved);
      expect(layout.canvas.background).toBe('#0f172a');
      expect(layout.nodes[0].fill).toBe('#1e293b');
      expect(layout.nodes[0].children?.[0]?.style?.color).toBe('#38bdf8');
    });

    it('3.2 resolves color transforms (alpha, lighten, darken) with token arguments', async () => {
      const code = `
        >primary = #3b82f6;
        >darkBg = #0f172a;

        canvas {
          width: 500px;
          height: 500px;
          background: darken(>darkBg, 10%);

          rect #tint1 {
            size: 100px 100px;
            fill: alpha(>primary, 0.25);
          }

          rect #tint2 {
            size: 100px 100px;
            fill: lighten(>primary, 20%);
          }
        }
      `;
      const doc = parseToad(code, 'color_transforms.toad');
      expect(doc.diagnostics?.length || 0).toBe(0);
      const resolved = await resolveImportsAndComponents(doc, 'color_transforms.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes).toHaveLength(2);
      expect(layout.nodes[0].fill).toContain('rgba');
    });

    it('3.3 catches circular variable dependencies with clear error', async () => {
      const code = `
        >a = >b;
        >b = >c;
        >c = >a;
        canvas { width: 100px; height: 100px; background: >a; }
      `;
      const doc = parseToad(code, 'circular_var.toad');
      await expect(resolveImportsAndComponents(doc, 'circular_var.toad'))
        .rejects
        .toThrow(CircularVariableError);
    });
  });

  // ==========================================================================
  // Group 4: Auto-Layout Geometry & Intrinsic Sizing Calculations
  // ==========================================================================
  describe('Group 4: Auto-Layout (Stack) Sizing & Nesting Calculations', () => {

    it('4.1 calculates intrinsic hug size of empty stack with padding only', async () => {
      const code = `
        canvas { width: 500px; height: 500px; }
        stack #emptyStack {
          direction: vertical;
          padding: 24px;
          size: hug hug;
        }
      `;
      const doc = parseToad(code, 'empty_stack.toad');
      const resolved = await resolveImportsAndComponents(doc, 'empty_stack.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(48);  // 24px left + 24px right
      expect(layout.nodes[0].height).toBe(48); // 24px top + 24px bottom
    });

    it('4.2 calculates stack intrinsic size with mixed fixed and text children', async () => {
      const code = `
        canvas { width: 1000px; height: 1000px; }
        stack #parentStack {
          direction: vertical;
          gap: 16px;
          padding: 20px;
          size: hug hug;

          rect #child1 { size: 300px 100px; }
          rect #child2 { size: 250px 80px; }
        }
      `;
      const doc = parseToad(code, 'stack_calc.toad');
      const resolved = await resolveImportsAndComponents(doc, 'stack_calc.toad');
      const layout = await solveLayout(resolved);
      
      const parent = layout.nodes[0];
      // Width = max(300, 250) + 40 (padding) = 340
      expect(parent.width).toBe(340);
      // Height = 100 + 80 + 16 (gap) + 40 (padding) = 236
      expect(parent.height).toBe(236);
    });

    it('4.3 handles deeply nested stacks (horizontal inside vertical)', async () => {
      const code = `
        canvas { width: 1200px; height: 800px; }
        stack #card {
          direction: vertical;
          padding: 30px;
          gap: 20px;
          size: 600px hug;

          stack #row1 {
            direction: horizontal;
            gap: 10px;
            size: fill 50px;
            rect { size: 40px 40px; }
            rect { size: 100px 40px; }
          }

          stack #row2 {
            direction: horizontal;
            gap: 15px;
            size: fill hug;
            rect { size: 80px 60px; }
            rect { size: 120px 60px; }
          }
        }
      `;
      const doc = parseToad(code, 'nested_stacks.toad');
      const resolved = await resolveImportsAndComponents(doc, 'nested_stacks.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(600);
      expect(layout.nodes[0].height).toBeGreaterThan(100);
    });
  });

  // ==========================================================================
  // Group 5: Relational Positioning DAG Engine
  // ==========================================================================
  describe('Group 5: Relational Constraints & Multi-hop Dependency DAGs', () => {

    it('5.1 correctly evaluates multi-hop relative anchor chains', async () => {
      const code = `
        canvas { width: 1000px; height: 1000px; }
        rect #boxA { at: (50px, 50px); size: 100px 100px; }
        rect #boxB { at: right of #boxA offset 20px; size: 80px 80px; }
        rect #boxC { at: below #boxB offset 30px; size: 60px 60px; }
        rect #boxD { at: left of #boxC offset 10px; size: 40px 40px; }
      `;
      const doc = parseToad(code, 'dag_chain.toad');
      const resolved = await resolveImportsAndComponents(doc, 'dag_chain.toad');
      const layout = await solveLayout(resolved);
      
      const nodeMap = new Map(layout.nodes.map(n => [n.id, n]));
      const a = nodeMap.get('boxA')!;
      const b = nodeMap.get('boxB')!;
      const c = nodeMap.get('boxC')!;
      const d = nodeMap.get('boxD')!;

      // boxB = right of boxA (x=50+100+20=170, y=50)
      expect(b.x).toBe(170);
      expect(b.y).toBe(50);

      // boxC = below boxB (x=170, y=50+80+30=160)
      expect(c.x).toBe(170);
      expect(c.y).toBe(160);

      // boxD = left of boxC (x=170-40-10=120, y=160)
      expect(d.x).toBe(120);
      expect(d.y).toBe(160);
    });

    it('5.2 detects cyclic layout dependencies and raises CyclicDependencyError', async () => {
      const code = `
        canvas { width: 500px; height: 500px; }
        rect #first { at: below #second; size: 50px 50px; }
        rect #second { at: below #first; size: 50px 50px; }
      `;
      const doc = parseToad(code, 'cyclic_layout.toad');
      const resolved = await resolveImportsAndComponents(doc, 'cyclic_layout.toad');
      await expect(solveLayout(resolved)).rejects.toThrow(CyclicDependencyError);
    });
  });

  // ==========================================================================
  // Group 6: Multi-Canvas & Artboard Resolution
  // ==========================================================================
  describe('Group 6: Multi-Canvas Definitions & Presets', () => {

    it('6.1 solves multiple canvases in a single document independently', async () => {
      const code = `
        canvas "TwitterHeader" {
          preset: twitter-header;
          rect #bg { size: 100% 100%; fill: #1da1f2; }
        }

        canvas "InstagramStory" {
          preset: insta-story;
          rect #bg { size: 100% 100%; fill: #e1306c; }
        }
      `;
      const doc = parseToad(code, 'multi_preset.toad');
      const resolved = await resolveImportsAndComponents(doc, 'multi_preset.toad');
      const layout = await solveLayout(resolved);

      expect(layout.canvases).toBeDefined();
      expect(layout.canvases).toHaveLength(2);
      // Twitter header: 1500 x 500
      expect(layout.canvases![0].canvas.width).toBe(1500);
      expect(layout.canvases![0].canvas.height).toBe(500);
      // Insta story: 1080 x 1920
      expect(layout.canvases![1].canvas.width).toBe(1080);
      expect(layout.canvases![1].canvas.height).toBe(1920);
    });
  });

  // ==========================================================================
  // Group 7: Diagnostic Tooling & Typos
  // ==========================================================================
  describe('Group 7: Linter & Diagnostics Intelligence', () => {

    it('7.1 suggests corrections for misspelled property names', () => {
      expect(suggestProperty('witdh')).toBe('width');
      expect(suggestProperty('bakground')).toBe('background');
      expect(suggestProperty('borderradius')).toBe('borderRadius');
    });
  });

});
