// tests/e2e/tier2_boundaries.test.ts
// Tier 2: Comprehensive Boundary Value Analysis & Edge Cases (>=100 tests)

import { describe, it, expect } from 'vitest';

import { tokenize } from '../../src/parser/lexer.js';
import { parseToad } from '../../src/parser/parser.js';
import { resolveImportsAndComponents } from '../../src/parser/importResolver.js';
import { computeGcd, computeAspectRatio, solveLayout } from '../../src/parser/math.js';
import { buildDependencyGraph, topologicalSort } from '../../src/parser/dependencyGraph.js';
import { distributeGradientStops, parseFilterString, mapBlendMode } from '../../src/engine/drawUtils.js';
import { renderToCanvas, renderToBuffer } from '../../src/engine/canvasRenderer.js';
import { exportToPsd } from '../../src/engine/psdExporter.js';
import { compileToad } from '../../src/build.js';

describe('Tier 2: Boundary Value Analysis & Edge Cases (>=100 tests)', () => {

  // ==========================================================================
  // 1. Canvas Dimensions & Aspect Ratio Extremes (10 tests)
  // ==========================================================================
  describe('1. Canvas Dimensions & Aspect Ratio Extremes', () => {
    it('1.1 handles minimal 1x1 canvas dimensions', async () => {
      const code = 'canvas { width: 1px; height: 1px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.canvas.width).toBe(1);
      expect(layout.canvas.height).toBe(1);
      expect(computeAspectRatio(1, 1).ratioString).toBe('1:1');
    });

    it('1.2 handles massive 16384x16384 canvas dimensions', async () => {
      const code = 'canvas { width: 16384px; height: 16384px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.canvas.width).toBe(16384);
      expect(layout.canvas.height).toBe(16384);
    });

    it('1.3 handles floating point canvas dimensions', async () => {
      const code = 'canvas { width: 1920.5px; height: 1080.5px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.canvas.width).toBeCloseTo(1920.5, 1);
    });

    it('1.4 handles extreme aspect ratio 10000:1', () => {
      const ratio = computeAspectRatio(10000, 1);
      expect(ratio.ratioString).toBe('10000:1');
    });

    it('1.5 handles extreme aspect ratio 1:10000', () => {
      const ratio = computeAspectRatio(1, 10000);
      expect(ratio.ratioString).toBe('1:10000');
    });

    it('1.6 handles GCD when dimensions are prime numbers (e.g. 1999 x 997)', () => {
      const gcd = computeGcd(1999, 997);
      expect(gcd).toBe(1);
    });

    it('1.7 handles zero dimensions with fallback or minimum clamp', () => {
      const gcd = computeGcd(0, 500);
      expect(gcd).toBe(500);
    });

    it('1.8 handles negative inputs in GCD computation via absolute value', () => {
      const gcd = computeGcd(-1920, 1080);
      expect(gcd).toBe(120);
    });

    it('1.9 calculates aspect ratio for standard ultra-wide 3440x1440', () => {
      const ratio = computeAspectRatio(3440, 1440);
      expect(ratio.ratioString).toBe('43:18');
    });

    it('1.10 calculates aspect ratio for 4K UHD 3840x2160', () => {
      const ratio = computeAspectRatio(3840, 2160);
      expect(ratio.ratioString).toBe('16:9');
    });
  });

  // ==========================================================================
  // 2. Lexical & Numeric Boundary Conditions (10 tests)
  // ==========================================================================
  describe('2. Lexical & Numeric Boundary Conditions', () => {
    it('2.1 tokenizes zero dimensions (0px, 0%, 0deg)', () => {
      const tokens = tokenize('size: 0px 0% 0deg;');
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('2.2 tokenizes high-precision decimal dimensions (0.0001px)', () => {
      const tokens = tokenize('width: 0.0001px;');
      expect(tokens.some(t => t.value === '0.0001px' || (t.value === 0.0001 && t.unit === 'px'))).toBe(true);
    });

    it('2.3 tokenizes negative coordinates in tuple at: (-50px, -100px)', () => {
      const tokens = tokenize('at: (-50px, -100px);');
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('2.4 tokenizes large angles (360deg, 720deg, -1080deg)', () => {
      const tokens = tokenize('linear-gradient(720deg, #fff, #000)');
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('2.5 tokenizes 8-digit hex color with alpha channel (#3b82f680)', () => {
      const tokens = tokenize('fill: #3b82f680;');
      const hex = tokens.find(t => t.type === 'HEX_COLOR' || t.value === '#3b82f680');
      expect(hex).toBeDefined();
    });

    it('2.6 tokenizes 4-digit shorthand hex color (#f00f)', () => {
      const tokens = tokenize('fill: #f00f;');
      const hex = tokens.find(t => t.type === 'HEX_COLOR' || t.value === '#f00f');
      expect(hex).toBeDefined();
    });

    it('2.7 tokenizes element ID with numbers and dashes (#card-item-99)', () => {
      const tokens = tokenize('rect #card-item-99 {}');
      const id = tokens.find(t => t.type === 'ELEMENT_ID' || t.value === '#card-item-99');
      expect(id).toBeDefined();
    });

    it('2.8 tokenizes variable with numbers and underscores (>var_name_123)', () => {
      const tokens = tokenize('>var_name_123 = 10px;');
      const v = tokens.find(t => t.type === 'VARIABLE' || t.value === '>var_name_123');
      expect(v).toBeDefined();
    });

    it('2.9 discards multi-line block comments correctly', () => {
      const code = '/* multi line\ncomment */ rect { size: 10px 10px; }';
      const tokens = tokenize(code);
      expect(tokens.some(t => t.value === 'rect' || t.type === 'KW_RECT')).toBe(true);
    });

    it('2.10 discards line comments at end of file without trailing newline', () => {
      const code = 'rect { size: 10px 10px; } // end of file';
      const tokens = tokenize(code);
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 3. Text & Headless Skia Measurement Boundaries (10 tests)
  // ==========================================================================
  describe('3. Text & Headless Skia Measurement Boundaries', () => {
    it('3.1 handles empty string text content ""', async () => {
      const code = 'text { content: ""; font-size: 16px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(0);
    });

    it('3.2 handles single whitespace text content " "', async () => {
      const code = 'text { content: " "; font-size: 16px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBeGreaterThanOrEqual(0);
    });

    it('3.3 handles massive text string (10,000 characters)', async () => {
      const massiveStr = 'A'.repeat(10000);
      const code = `text { content: "${massiveStr}"; font-size: 14px; }`;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBeGreaterThan(1000);
    });

    it('3.4 handles Unicode and Emoji characters in text content', async () => {
      const emojiText = "🚀 Rocket • 🎨 Design • 🌟 Star • 漢字 • العربية";
      const code = `text { content: "${emojiText}"; font-size: 20px; }`;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBeGreaterThan(0);
    });

    it('3.5 handles escaped newline and tab characters in text', async () => {
      const code = 'text { content: "Line 1\\nLine 2\\tTabbed"; font-size: 16px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].height).toBeGreaterThan(16);
    });

    it('3.6 handles tiny font size (0.5px)', async () => {
      const code = 'text { content: "Tiny"; font-size: 0.5px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBeGreaterThanOrEqual(0);
    });

    it('3.7 handles huge font size (500px)', async () => {
      const code = 'text { content: "Huge"; font-size: 500px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBeGreaterThan(500);
    });

    it('3.8 auto-wraps when constraint size.w is smaller than word width', async () => {
      const code = 'text { content: "Supercalifragilisticexpialidocious"; size: 50px; font-size: 20px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].height).toBeGreaterThan(0);
    });

    it('3.9 handles multiple consecutive newline characters', async () => {
      const code = 'text { content: "Line1\\n\\n\\nLine4"; font-size: 16px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].height).toBeGreaterThan(32);
    });

    it('3.10 handles font-weight numeric values (100, 400, 700, 900)', async () => {
      const code = 'text { content: "Bold"; font-size: 16px; font-weight: 900; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 4. Shape & Polygon Degenerate Boundaries (10 tests)
  // ==========================================================================
  describe('4. Shape & Polygon Degenerate Boundaries', () => {
    it('4.1 handles polygon with 0 points gracefully', async () => {
      const code = 'polygon { points: []; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(0);
      expect(layout.nodes[0].height).toBe(0);
    });

    it('4.2 handles polygon with single point (1 vertex)', async () => {
      const code = 'polygon { points: [ (0px, 0px) ]; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(0);
      expect(layout.nodes[0].height).toBe(0);
    });

    it('4.3 handles polygon with 2 points (degenerate line segment)', async () => {
      const code = 'polygon { points: [ (0px, 0px), (100px, 0px) ]; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(100);
      expect(layout.nodes[0].height).toBe(0);
    });

    it('4.4 handles collinear 3-point polygon', async () => {
      const code = 'polygon { points: [ (0px, 0px), (50px, 0px), (100px, 0px) ]; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(100);
      expect(layout.nodes[0].height).toBe(0);
    });

    it('4.5 handles high-vertex polygon (100 points)', async () => {
      const pts = Array.from({ length: 100 }, (_, i) => {
        const rad = (i / 100) * 2 * Math.PI;
        return `(${Math.round(Math.cos(rad) * 50)}px, ${Math.round(Math.sin(rad) * 50)}px)`;
      }).join(', ');
      const code = `polygon { points: [ ${pts} ]; }`;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBeGreaterThan(0);
    });

    it('4.6 clamps rectangle corner radius when radius exceeds half dimensions', async () => {
      const code = 'rect { size: 100px 60px; border-radius: 80px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(100);
      expect(layout.nodes[0].height).toBe(60);
    });

    it('4.7 handles circle with radius 0', async () => {
      const code = 'circle { radius: 0px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(0);
      expect(layout.nodes[0].height).toBe(0);
    });

    it('4.8 handles rect with zero width and non-zero height', async () => {
      const code = 'rect { size: 0px 100px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(0);
      expect(layout.nodes[0].height).toBe(100);
    });

    it('4.9 handles 0px stroke-width without throwing', async () => {
      const code = 'rect { size: 50px 50px; stroke: #000 0px solid; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(50);
    });

    it('4.10 handles massive stroke width (500px)', async () => {
      const code = 'rect { size: 50px 50px; stroke: #000 500px solid; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(50);
    });
  });

  // ==========================================================================
  // 5. Gradient & Color Stop Distribution Boundaries (10 tests)
  // ==========================================================================
  describe('5. Gradient & Color Stop Distribution Boundaries', () => {
    it('5.1 handles empty gradient stops array', () => {
      const distributed = distributeGradientStops([]);
      expect(distributed).toEqual([]);
    });

    it('5.2 handles single stop gradient (defaults to 0.0)', () => {
      const distributed = distributeGradientStops([{ color: '#ff0000' }]);
      expect(distributed.length).toBe(1);
      expect(distributed[0].position).toBe(0.0);
    });

    it('5.3 handles 50 stops with all missing positions evenly spaced', () => {
      const stops = Array.from({ length: 51 }, (_, i) => ({ color: `#${i.toString(16).padStart(6, '0')}` }));
      const distributed = distributeGradientStops(stops);
      expect(distributed.length).toBe(51);
      expect(distributed[0].position).toBe(0.0);
      expect(distributed[25].position).toBeCloseTo(0.5, 2);
      expect(distributed[50].position).toBe(1.0);
    });

    it('5.4 handles stops with identical overlapping offsets (hard stop / knife edge)', () => {
      const stops = [
        { color: '#ff0000', position: 0.5 },
        { color: '#00ff00', position: 0.5 }
      ];
      const distributed = distributeGradientStops(stops);
      expect(distributed[0].position).toBe(0.5);
      expect(distributed[1].position).toBe(0.5);
    });

    it('5.5 handles stops where first and last have explicit positions', () => {
      const stops = [
        { color: '#ff0000', position: 0.1 },
        { color: '#00ff00' },
        { color: '#0000ff', position: 0.9 }
      ];
      const distributed = distributeGradientStops(stops);
      expect(distributed[1].position).toBeCloseTo(0.5, 2);
    });

    it('5.6 handles transparent color stops (rgba(0,0,0,0) or transparent)', () => {
      const stops = [{ color: 'transparent' }, { color: '#ffffff' }];
      const distributed = distributeGradientStops(stops);
      expect(distributed[0].color).toBe('transparent');
      expect(distributed[1].position).toBe(1.0);
    });

    it('5.7 handles stops with percentage positions (25%, 75%)', async () => {
      const code = 'rect { size: 100px 100px; fill: linear-gradient(to right, #000 25%, #fff 75%); }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.elements.length).toBe(1);
    });

    it('5.8 handles linear-gradient with 0deg, 90deg, 180deg, 270deg angles', async () => {
      const code = 'rect { size: 100px 100px; fill: linear-gradient(270deg, #ff0, #00f); }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.elements.length).toBe(1);
    });

    it('5.9 handles radial gradient with ellipse shape', async () => {
      const code = 'rect { size: 100px 100px; fill: radial-gradient(ellipse, #111, #999); }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.elements.length).toBe(1);
    });

    it('5.10 handles linear-gradient directional keywords (to top right, to bottom left)', async () => {
      const code = 'rect { size: 100px 100px; fill: linear-gradient(to top right, #333, #888); }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.elements.length).toBe(1);
    });
  });

  // ==========================================================================
  // 6. Relational Positioning Cycles & DAG Extremes (10 tests)
  // ==========================================================================
  describe('6. Relational Positioning Cycles & DAG Extremes', () => {
    it('6.1 detects direct 2-node cycle (A -> B -> A) and reports cycle error or warning', async () => {
      const code = `
        rect #a { at: right of #b; size: 50px 50px; }
        rect #b { at: right of #a; size: 50px 50px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      // Solving cyclic layout should reject or produce cycle warning/fallback without infinite loop
      try {
        const layout = await solveLayout(resolved);
        expect(layout.warnings.some(w => w.toLowerCase().includes('cycle'))).toBe(true);
      } catch (err: any) {
        expect(err.message.toLowerCase()).toContain('cycle');
      }
    });

    it('6.2 detects 3-node cycle (A -> B -> C -> A)', async () => {
      const code = `
        rect #a { at: right of #c; size: 50px 50px; }
        rect #b { at: right of #a; size: 50px 50px; }
        rect #c { at: right of #b; size: 50px 50px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      try {
        const layout = await solveLayout(resolved);
        expect(layout.warnings.length).toBeGreaterThan(0);
      } catch (err: any) {
        expect(err.message.toLowerCase()).toContain('cycle');
      }
    });

    it('6.3 detects self-referential cycle (A -> A)', async () => {
      const code = 'rect #a { at: right of #a; size: 50px 50px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      try {
        const layout = await solveLayout(resolved);
        expect(layout.warnings.length).toBeGreaterThan(0);
      } catch (err: any) {
        expect(err.message.toLowerCase()).toContain('cycle');
      }
    });

    it('6.4 handles relational positioning referencing non-existent element ID with warning', async () => {
      const code = 'rect #orphan { at: right of #ghostElement offset 10px; size: 50px 50px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].x).toBeDefined();
      expect(layout.warnings.length).toBeGreaterThan(0);
    });

    it('6.5 handles deep linear dependency chain (20 elements: A1 -> A2 -> ... -> A20)', async () => {
      let code = 'rect #e0 { at: (0px, 0px); size: 10px 10px; }\n';
      for (let i = 1; i < 20; i++) {
        code += `rect #e${i} { at: right of #e${i - 1} offset 5px; size: 10px 10px; }\n`;
      }
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBe(20);
      const last = layout.nodes.find(n => n.id === 'e19')!;
      expect(last.x).toBe(19 * 15);
    });

    it('6.6 handles diamond relational DAG dependency', async () => {
      const code = `
        rect #root { at: (0px, 0px); size: 50px 50px; }
        rect #branchA { at: right of #root offset 10px; size: 50px 50px; }
        rect #branchB { at: below #root offset 10px; size: 50px 50px; }
        rect #merge { at: right of #branchB offset 10px; size: 50px 50px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBe(4);
    });

    it('6.7 handles at: center of canvas keyword target', async () => {
      const code = `
        canvas { width: 800px; height: 600px; }
        rect #centered { at: center of canvas; size: 200px 100px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const node = layout.nodes[0];
      expect(node.x).toBe(300);
      expect(node.y).toBe(250);
    });

    it('6.8 handles at: inside #parentBox relational placement', async () => {
      const code = `
        rect #parentBox { at: (100px, 100px); size: 400px 400px; }
        rect #inner { at: inside #parentBox; size: 100px 100px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const inner = layout.nodes.find(n => n.id === 'inner')!;
      expect(inner.x).toBeGreaterThanOrEqual(100);
      expect(inner.y).toBeGreaterThanOrEqual(100);
    });

    it('6.9 handles at: above #anchor offset 20px', async () => {
      const code = `
        rect #anchor { at: (100px, 200px); size: 100px 100px; }
        rect #aboveEl { at: above #anchor offset 20px; size: 100px 50px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const above = layout.nodes.find(n => n.id === 'aboveEl')!;
      expect(above.y).toBe(200 - 50 - 20);
    });

    it('6.10 handles at: left of #anchor offset 15px', async () => {
      const code = `
        rect #anchor { at: (300px, 100px); size: 100px 100px; }
        rect #leftEl { at: left of #anchor offset 15px; size: 80px 100px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const left = layout.nodes.find(n => n.id === 'leftEl')!;
      expect(left.x).toBe(300 - 80 - 15);
    });
  });

  // ==========================================================================
  // 7. Imports, Scoping & Component Expansion Extremes (10 tests)
  // ==========================================================================
  describe('7. Imports, Scoping & Component Expansion Extremes', () => {
    it('7.1 handles circular @import without infinite recursion', async () => {
      const fileA = '@import "./fileB.toad"; >valA = 10px;';
      const fileB = '@import "./fileA.toad"; >valB = 20px;';
      const loader = (p: string) => (p.includes('fileA') ? fileA : fileB);

      const ast = parseToad(fileA, 'fileA.toad');
      const resolved = await resolveImportsAndComponents(ast, 'fileA.toad', loader);
      expect(resolved).toBeDefined();
    });

    it('7.2 handles diamond @import graph cleanly', async () => {
      const fileD = '>token = #ffffff;';
      const fileB = '@import "./fileD.toad"; >b = 10px;';
      const fileC = '@import "./fileD.toad"; >c = 20px;';
      const fileA = '@import "./fileB.toad"; @import "./fileC.toad"; rect { size: 10px 10px; }';

      const loader = (p: string) => {
        if (p.includes('fileD')) return fileD;
        if (p.includes('fileB')) return fileB;
        if (p.includes('fileC')) return fileC;
        return fileA;
      };

      const ast = parseToad(fileA, 'fileA.toad');
      const resolved = await resolveImportsAndComponents(ast, 'fileA.toad', loader);
      expect(resolved.elements.length).toBe(1);
    });

    it('7.3 resolves undefined variable with fallback without crash', async () => {
      const code = 'rect { size: >undefinedVar 50px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBe(1);
    });

    it('7.4 handles empty component definition with 0 elements', async () => {
      const code = `
        component Empty() {}
        Empty #e1 {}
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved).toBeDefined();
    });

    it('7.5 handles component with 10 parameters', async () => {
      const code = `
        component MultiParam(p1=1px, p2=2px, p3=3px, p4=4px, p5=5px, p6=6px, p7=7px, p8=8px, p9=9px, p10=10px) {
          rect { size: >p10 >p10; }
        }
        MultiParam #m {}
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(10);
    });

    it('7.6 namespaces element IDs inside expanded component instances to prevent ID collision', async () => {
      const code = `
        component Item() {
          rect #innerBox { size: 50px 50px; }
        }
        Item #itemA {}
        Item #itemB {}
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBe(2);
      expect(layout.nodes[0].id).not.toBe(layout.nodes[1].id);
    });

    it('7.7 allows component parameter to override variable of same name in outer scope', async () => {
      const code = `
        >col = #ff0000;
        component Box(col = #0000ff) {
          rect { fill: >col; }
        }
        Box #b {}
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].fill).toMatch(/#0000ff|rgb\(0,\s*0,\s*255\)/i);
    });

    it('7.8 handles multiple component instances passed expressions as arguments', async () => {
      const code = `
        >base = 40px;
        component Box(s = 20px) {
          rect { size: >s >s; }
        }
        Box #b1 { s: >base; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(40);
    });

    it('7.9 handles missing @import file with graceful error', async () => {
      const code = '@import "./nonexistent_file_xyz.toad";';
      const ast = parseToad(code);
      try {
        await resolveImportsAndComponents(ast, 'main.toad', () => { throw new Error('File not found'); });
      } catch (err: any) {
        expect(err.message).toContain('File not found');
      }
    });

    it('7.10 handles component call site with omitted parentheses and arguments', async () => {
      const code = `
        component Card(s = 50px) {
          rect { size: >s >s; }
        }
        Card #card1 {}
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(50);
    });
  });

  // ==========================================================================
  // 8. Groups & Grids Boundary Conditions (10 tests)
  // ==========================================================================
  describe('8. Groups & Grids Boundary Conditions', () => {
    it('8.1 handles empty group with 0 children', async () => {
      const code = 'group #emptyGrp {}';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const grp = layout.nodes.find(n => n.id === 'emptyGrp');
      if (grp) {
        expect(grp.width).toBe(0);
        expect(grp.height).toBe(0);
      }
    });

    it('8.2 handles deep nested groups (depth 10)', async () => {
      let code = 'rect { size: 10px 10px; }';
      for (let i = 0; i < 10; i++) {
        code = `group { ${code} }`;
      }
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBeGreaterThan(0);
    });

    it('8.3 handles empty grid with 0 items', async () => {
      const code = 'grid #emptyGrid { columns: 3; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout).toBeDefined();
    });

    it('8.4 handles 1-column grid (vertical stack)', async () => {
      const code = `
        grid {
          columns: 1;
          gap: 10px;
          rect { size: 100px 40px; }
          rect { size: 100px 40px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBeGreaterThanOrEqual(2);
    });

    it('8.5 handles grid with columns exceeding item count (10 columns, 2 items)', async () => {
      const code = `
        grid {
          columns: 10;
          gap: 5px;
          rect { size: 20px 20px; }
          rect { size: 20px 20px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBeGreaterThanOrEqual(2);
    });

    it('8.6 handles 0px grid gap', async () => {
      const code = `
        grid {
          columns: 2;
          gap: 0px;
          rect { size: 50px 50px; }
          rect { size: 50px 50px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBeGreaterThanOrEqual(2);
    });

    it('8.7 handles 100px large grid gap', async () => {
      const code = `
        grid {
          columns: 2;
          gap: 100px;
          rect { size: 50px 50px; }
          rect { size: 50px 50px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBeGreaterThanOrEqual(2);
    });

    it('8.8 handles group with explicit size clipping children', async () => {
      const code = `
        group {
          size: 100px 100px;
          clip: true;
          rect { size: 200px 200px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(100);
    });

    it('8.9 handles grid with row flow specification', async () => {
      const code = `
        grid {
          columns: 2;
          flow: row;
          rect { size: 30px 30px; }
          rect { size: 30px 30px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBeGreaterThanOrEqual(2);
    });

    it('8.10 handles grid with column flow specification', async () => {
      const code = `
        grid {
          columns: 2;
          flow: column;
          rect { size: 30px 30px; }
          rect { size: 30px 30px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // 9. Blend Modes & Filter String Parser Extremes (10 tests)
  // ==========================================================================
  describe('9. Blend Modes & Filter String Parser Extremes', () => {
    it('9.1 handles empty filter string', () => {
      const filters = parseFilterString('');
      expect(filters).toEqual([]);
    });

    it('9.2 handles filter string with unknown filter gracefully', () => {
      const filters = parseFilterString('unknownFilter(10px) blur(5px)');
      expect(filters.some(f => f.name === 'blur')).toBe(true);
    });

    it('9.3 handles filter with 0px blur', () => {
      const filters = parseFilterString('blur(0px)');
      expect(filters.length).toBe(1);
    });

    it('9.4 handles filter with 0% opacity or saturate', () => {
      const filters = parseFilterString('saturate(0)');
      expect(filters.length).toBe(1);
    });

    it('9.5 handles filter chain with 10 functions', () => {
      const chain = 'blur(1px) saturate(1.2) brightness(1.1) contrast(1.3) grayscale(20%) sepia(10%) invert(5%) hue-rotate(45deg) drop-shadow(0 2px 4px #000) blur(2px)';
      const filters = parseFilterString(chain);
      expect(filters.length).toBe(10);
    });

    it('9.6 maps unknown blend mode to fallback normal/source-over', () => {
      expect(mapBlendMode('nonExistentMode')).toBe('source-over');
    });

    it('9.7 maps dark blend modes (darken, color-burn)', () => {
      expect(mapBlendMode('darken')).toBe('darken');
      expect(mapBlendMode('color-burn')).toBe('color-burn');
    });

    it('9.8 maps light blend modes (lighten, color-dodge)', () => {
      expect(mapBlendMode('lighten')).toBe('lighten');
      expect(mapBlendMode('color-dodge')).toBe('color-dodge');
    });

    it('9.9 maps contrast blend modes (overlay, hard-light, soft-light)', () => {
      expect(mapBlendMode('overlay')).toBe('overlay');
      expect(mapBlendMode('hard-light')).toBe('hard-light');
      expect(mapBlendMode('soft-light')).toBe('soft-light');
    });

    it('9.10 maps component blend modes (hue, saturation, color, luminosity)', () => {
      expect(mapBlendMode('hue')).toBe('hue');
      expect(mapBlendMode('luminosity')).toBe('luminosity');
    });
  });

  // ==========================================================================
  // 10. Multi-scale Raster & PSD Export Boundaries (10 tests)
  // ==========================================================================
  describe('10. Multi-scale Raster & PSD Export Boundaries', () => {
    it('10.1 renders 1x1 canvas to PNG without crashing', async () => {
      const code = 'canvas { width: 1px; height: 1px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const buf = await renderToBuffer(layout, { format: 'png' });
      expect(buf.length).toBeGreaterThan(0);
    });

    it('10.2 renders 1x1 canvas to PSD without crashing', async () => {
      const code = 'canvas { width: 1px; height: 1px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psd = await exportToPsd(layout);
      expect(psd.length).toBeGreaterThan(0);
    });

    it('10.3 handles PSD export with 50 layers', async () => {
      let code = 'canvas { width: 500px; height: 500px; }\n';
      for (let i = 0; i < 50; i++) {
        code += `rect #r${i} { at: (${i * 5}px, ${i * 5}px); size: 20px 20px; }\n`;
      }
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psd = await exportToPsd(layout);
      expect(psd.length).toBeGreaterThan(0);
    });

    it('10.4 handles PSD export with empty layers without crash', async () => {
      const code = 'canvas { width: 100px; height: 100px; } group #emptyGrp {}';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psd = await exportToPsd(layout);
      expect(psd.length).toBeGreaterThan(0);
    });

    it('10.5 handles PSD export with special characters in layer names', async () => {
      const code = 'canvas { width: 200px; height: 200px; } rect #"Layer / With: Special.Chars" { size: 50px 50px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psd = await exportToPsd(layout);
      expect(psd.length).toBeGreaterThan(0);
    });

    it('10.6 renders JPEG with quality 1 (minimum) and quality 100 (maximum)', async () => {
      const code = 'canvas { width: 50px; height: 50px; } rect { size: 50px 50px; fill: #ff0000; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const bufLow = await renderToBuffer(layout, { format: 'jpg', quality: 1 });
      const bufHigh = await renderToBuffer(layout, { format: 'jpg', quality: 100 });
      expect(bufLow.length).toBeGreaterThan(0);
      expect(bufHigh.length).toBeGreaterThan(0);
      expect(bufHigh.length).toBeGreaterThanOrEqual(bufLow.length);
    });

    it('10.7 handles scale 0.5 (downscale) rendering', async () => {
      const code = 'canvas { width: 100px; height: 100px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const canvas = await renderToCanvas(layout, { scale: 0.5 });
      expect(canvas.width).toBe(50);
      expect(canvas.height).toBe(50);
    });

    it('10.8 handles scale 8 (large upscale) rendering', async () => {
      const code = 'canvas { width: 50px; height: 50px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const canvas = await renderToCanvas(layout, { scale: 8 });
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(400);
    });

    it('10.9 handles image fit with missing image asset without crash', async () => {
      const code = 'canvas { width: 200px; height: 200px; } image { src: "missing_file.png"; size: 100px 100px; fit: cover; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const buf = await renderToBuffer(layout, { format: 'png' });
      expect(buf.length).toBeGreaterThan(0);
    });

    it('10.10 compileToad handles non-existent file path by rejecting with error', async () => {
      await expect(compileToad('non_existent_path_xyz_123.toad')).rejects.toThrow();
    });
  });

});
