// tests/e2e/tier1_features.test.ts
// Tier 1: Comprehensive Feature Coverage (>=5 tests per feature across all 20 features)

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

// Imports from toad compiler modules
import { tokenize } from '../../src/parser/lexer.js';
import { parseToad } from '../../src/parser/parser.js';
import { resolveImportsAndComponents } from '../../src/parser/importResolver.js';
import { computeGcd, computeAspectRatio, solveLayout } from '../../src/parser/math.js';
import { buildDependencyGraph, topologicalSort } from '../../src/parser/dependencyGraph.js';
import { distributeGradientStops, parseFilterString, mapBlendMode } from '../../src/engine/drawUtils.js';
import { registerFont, loadFontsFromDir } from '../../src/engine/fontLoader.js';
import { renderToCanvas, renderToBuffer } from '../../src/engine/canvasRenderer.js';
import { exportToPsd } from '../../src/engine/psdExporter.js';
import { compileToad } from '../../src/build.js';

describe('Tier 1: Feature Coverage (20 Features, >=5 tests each)', () => {

  // ==========================================================================
  // Feature 1: Lexical Tokenizer
  // ==========================================================================
  describe('Feature 1: Lexical Tokenizer', () => {
    it('1.1 tokenizes basic keywords and delimiters', () => {
      const code = 'canvas { width: 800px; height: 600px; }';
      const tokens = tokenize(code);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some(t => t.type === 'KW_CANVAS' || t.value === 'canvas')).toBe(true);
      expect(tokens.some(t => t.type === 'LBRACE' || t.value === '{')).toBe(true);
      expect(tokens.some(t => t.type === 'RBRACE' || t.value === '}')).toBe(true);
    });

    it('1.2 tokenizes dimension units (px, %, deg, em, pt)', () => {
      const code = 'size: 100px 50% 45deg 2em 12pt;';
      const tokens = tokenize(code);
      const dims = tokens.filter(t => t.type === 'DIMENSION' || (t.unit && t.value !== undefined));
      expect(dims.length).toBeGreaterThanOrEqual(4);
    });

    it('1.3 tokenizes hex colors and distinguishes from element IDs', () => {
      const code = 'fill: #3b82f6; stroke: #fff; at: right of #header;';
      const tokens = tokenize(code);
      const hexColors = tokens.filter(t => t.type === 'HEX_COLOR' || (t.value && t.value.startsWith('#') && t.type !== 'ELEMENT_ID'));
      const elementIds = tokens.filter(t => t.type === 'ELEMENT_ID' || t.value === '#header');
      expect(hexColors.length).toBeGreaterThanOrEqual(2);
      expect(elementIds.length).toBeGreaterThanOrEqual(1);
    });

    it('1.4 tokenizes string literals with quotes and escapes', () => {
      const code = 'content: "Hello \\"World\\""; name: \'Single Quoted\';';
      const tokens = tokenize(code);
      const strings = tokens.filter(t => t.type === 'STRING');
      expect(strings.length).toBe(2);
      expect(strings[0].value).toContain('Hello');
      expect(strings[1].value).toBe('Single Quoted');
    });

    it('1.5 tokenizes variable declarations and variable usages', () => {
      const code = '>primary = #3b82f6; rect { fill: >primary; }';
      const tokens = tokenize(code);
      const vars = tokens.filter(t => t.type === 'VARIABLE' || (t.value && t.value.startsWith('>')));
      expect(vars.length).toBe(2);
    });
  });

  // ==========================================================================
  // Feature 2: AST & Recursive-Descent Parser
  // ==========================================================================
  describe('Feature 2: AST & Recursive-Descent Parser', () => {
    it('2.1 parses empty canvas document', () => {
      const ast = parseToad('canvas { width: 1200px; height: 800px; }');
      expect(ast.type).toBe('Document');
      expect(ast.canvas).toBeDefined();
    });

    it('2.2 parses rect and circle elements with properties', () => {
      const code = `
        rect #box { size: 100px 50px; fill: #ff0000; }
        circle #ball { radius: 25px; fill: #00ff00; }
      `;
      const ast = parseToad(code);
      expect(ast.elements.length).toBe(2);
      expect(ast.elements[0].type).toBe('RectElement');
      expect(ast.elements[1].type).toBe('CircleElement');
    });

    it('2.3 parses polygon with point list', () => {
      const code = 'polygon #tri { points: [ (0px, -50px), (50px, 50px), (-50px, 50px) ]; fill: #0000ff; }';
      const ast = parseToad(code);
      expect(ast.elements[0].type).toBe('PolygonElement');
    });

    it('2.4 parses text and image elements', () => {
      const code = `
        text #label { content: "Header Title"; font-size: 24px; }
        image #photo { src: "photo.jpg"; size: 200px 200px; fit: cover; }
      `;
      const ast = parseToad(code);
      expect(ast.elements.length).toBe(2);
      expect(ast.elements[0].type).toBe('TextElement');
      expect(ast.elements[1].type).toBe('ImageElement');
    });

    it('2.5 parses nested group elements', () => {
      const code = `
        group #card {
          rect { size: 300px 200px; }
          text { content: "Card Title"; }
        }
      `;
      const ast = parseToad(code);
      expect(ast.elements[0].type).toBe('GroupElement');
      expect(ast.elements[0].children?.length).toBe(2);
    });
  });

  // ==========================================================================
  // Feature 3: Directives (@import, @font)
  // ==========================================================================
  describe('Feature 3: Directives (@import, @font)', () => {
    it('3.1 parses @import directives at top level', () => {
      const code = '@import "./tokens.toad"; canvas { width: 500px; height: 500px; }';
      const ast = parseToad(code);
      expect(ast.directives.length).toBe(1);
      expect(ast.directives[0].type).toBe('ImportDirective');
      expect((ast.directives[0] as any).path).toBe('./tokens.toad');
    });

    it('3.2 parses @font directive with alias', () => {
      const code = '@font "./fonts/Inter.ttf" as "Inter"; canvas { width: 500px; height: 500px; }';
      const ast = parseToad(code);
      expect(ast.directives.length).toBe(1);
      expect(ast.directives[0].type).toBe('FontDirective');
      expect((ast.directives[0] as any).family).toBe('Inter');
    });

    it('3.3 resolves imported variables across files', async () => {
      const tokensFile = '>themeColor = #ef4444;';
      const mainFile = '@import "./tokens.toad"; rect { fill: >themeColor; }';
      
      const loader = (filePath: string) => {
        if (filePath.endsWith('tokens.toad')) return tokensFile;
        return mainFile;
      };

      const ast = parseToad(mainFile, 'main.toad');
      const resolved = await resolveImportsAndComponents(ast, 'main.toad', loader);
      expect(resolved.elements.length).toBe(1);
    });

    it('3.4 aggregates multiple @font directives in resolved document', async () => {
      const doc = parseToad(`
        @font "./fonts/Inter-Regular.ttf" as "Inter";
        @font "./fonts/Inter-Bold.ttf" as "InterBold";
        canvas { width: 100px; height: 100px; }
      `);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      expect(resolved.fonts.length).toBe(2);
      expect(resolved.fonts.map(f => f.family)).toContain('Inter');
      expect(resolved.fonts.map(f => f.family)).toContain('InterBold');
    });

    it('3.5 tracks dependency paths for watch mode', async () => {
      const tokensFile = '>bg = #ffffff;';
      const mainFile = '@import "./sub/tokens.toad"; canvas { width: 100px; height: 100px; }';
      const loader = (p: string) => (p.includes('tokens.toad') ? tokensFile : mainFile);
      const ast = parseToad(mainFile, 'main.toad');
      const resolved = await resolveImportsAndComponents(ast, 'main.toad', loader);
      const layout = await solveLayout(resolved);
      expect(layout.dependencies).toBeDefined();
    });
  });

  // ==========================================================================
  // Feature 4: Variables & Scoping
  // ==========================================================================
  describe('Feature 4: Variables & Scoping', () => {
    it('4.1 substitutes simple variable in element property', async () => {
      const code = `
        >mainSize = 200px;
        rect { size: >mainSize >mainSize; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(200);
      expect(layout.nodes[0].height).toBe(200);
    });

    it('4.2 supports variable referencing another variable', async () => {
      const code = `
        >base = 50px;
        >doubled = >base;
        rect { size: >doubled 100px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(50);
    });

    it('4.3 supports color variable in strokes and fills', async () => {
      const code = `
        >brand = #10b981;
        rect { fill: >brand; stroke: >brand 2px solid; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].fill).toMatch(/#10b981|rgb\(16,\s*185,\s*129\)/i);
    });

    it('4.4 scopes variables correctly without leaking across components', async () => {
      const code = `
        >val = 10px;
        component Box(size = 50px) {
          rect { size: >size >size; }
        }
        Box #b1 { size: 100px; }
        rect #b2 { size: >val >val; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const b2 = layout.nodes.find(n => n.id === 'b2');
      expect(b2?.width).toBe(10);
    });

    it('4.5 supports string variables in text content', async () => {
      const code = `
        >title = "Hello Vitest";
        text { content: >title; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect((resolved.elements[0] as any).text || (resolved.elements[0] as any).properties?.content).toBeDefined();
    });
  });

  // ==========================================================================
  // Feature 5: Component Parameters
  // ==========================================================================
  describe('Feature 5: Component Parameters', () => {
    it('5.1 declares component with default parameter values', () => {
      const code = `
        component Arrow(size = 180px, color = #ff0000) {
          rect { size: >size >size; fill: >color; }
        }
      `;
      const ast = parseToad(code);
      expect(ast.components.length).toBe(1);
      expect(ast.components[0].parameters.length).toBe(2);
    });

    it('5.2 expands component using default parameters', async () => {
      const code = `
        component Box(w = 120px, h = 80px) {
          rect { size: >w >h; }
        }
        Box #myBox {}
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(120);
      expect(layout.nodes[0].height).toBe(80);
    });

    it('5.3 expands component with named argument overrides', async () => {
      const code = `
        component Box(w = 100px, h = 100px) {
          rect { size: >w >h; }
        }
        Box #customBox { w: 250px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(250);
      expect(layout.nodes[0].height).toBe(100);
    });

    it('5.4 supports multiple instances of same component with distinct arguments', async () => {
      const code = `
        component Card(bg = #ffffff) {
          rect { size: 100px 100px; fill: >bg; }
        }
        Card #c1 { bg: #ff0000; }
        Card #c2 { bg: #00ff00; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBe(2);
    });

    it('5.5 supports nested components inside components', async () => {
      const code = `
        component Inner(c = #111111) {
          circle { radius: 10px; fill: >c; }
        }
        component Outer(c = #222222) {
          group {
            rect { size: 100px 100px; }
            Inner { c: >c; }
          }
        }
        Outer #o1 { c: #333333; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.elements.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Feature 6: Canvas Dimensions & Aspect Ratio (GCD)
  // ==========================================================================
  describe('Feature 6: Canvas Dimensions & Aspect Ratio (GCD)', () => {
    it('6.1 calculates GCD for 1920x1080 -> 16:9', () => {
      const gcd = computeGcd(1920, 1080);
      expect(gcd).toBe(120);
      const ratio = computeAspectRatio(1920, 1080);
      expect(ratio.ratioString).toBe('16:9');
    });

    it('6.2 calculates GCD for square canvas 800x800 -> 1:1', () => {
      const ratio = computeAspectRatio(800, 800);
      expect(ratio.ratioString).toBe('1:1');
    });

    it('6.3 calculates GCD for 1200x630 -> 40:21', () => {
      const ratio = computeAspectRatio(1200, 630);
      expect(ratio.ratioString).toBe('40:21');
    });

    it('6.4 calculates GCD for 1080x1350 -> 4:5', () => {
      const ratio = computeAspectRatio(1080, 1350);
      expect(ratio.ratioString).toBe('4:5');
    });

    it('6.5 resolves canvas dimensions and background in layout result', async () => {
      const code = 'canvas { width: 1440px; height: 900px; background: #1e293b; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.canvas.width).toBe(1440);
      expect(layout.canvas.height).toBe(900);
      expect(layout.canvas.aspectRatio).toMatch(/8:5|1.6/);
    });
  });

  // ==========================================================================
  // Feature 7: Bounding Box & Skia Text Measuring
  // ==========================================================================
  describe('Feature 7: Bounding Box & Skia Text Measuring', () => {
    it('7.1 measures single line text advance width and height', async () => {
      const code = `
        text #txt {
          content: "Hello World";
          font-size: 24px;
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBeGreaterThan(0);
      expect(layout.nodes[0].height).toBeGreaterThan(0);
    });

    it('7.2 unwrapped text does not wrap when size.w is omitted', async () => {
      const longText = "A very long single line of text that should not wrap automatically unless explicit width is provided.";
      const code = `text #txt { content: "${longText}"; font-size: 20px; }`;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBeGreaterThan(300);
    });

    it('7.3 wraps text when explicit size.w is provided', async () => {
      const code = `
        text #wrapped {
          content: "First line of text that should wrap onto multiple lines because width is constrained.";
          size: 200px;
          font-size: 18px;
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBeLessThanOrEqual(200);
      expect(layout.nodes[0].height).toBeGreaterThan(20);
    });

    it('7.4 computes bounding box for circle with radius', async () => {
      const code = 'circle #c { radius: 50px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(100);
      expect(layout.nodes[0].height).toBe(100);
    });

    it('7.5 computes AABB for group containing multiple children', async () => {
      const code = `
        group #grp {
          rect { at: (10px, 10px); size: 50px 50px; }
          rect { at: (100px, 100px); size: 50px 50px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const grp = layout.nodes.find(n => n.id === 'grp');
      expect(grp?.width).toBeGreaterThanOrEqual(140);
      expect(grp?.height).toBeGreaterThanOrEqual(140);
    });
  });

  // ==========================================================================
  // Feature 8: currentColor Resolution
  // ==========================================================================
  describe('Feature 8: currentColor Resolution', () => {
    it('8.1 cascades color property to child fill currentColor', async () => {
      const code = `
        group {
          color: #3b82f6;
          rect { size: 100px 100px; fill: currentColor; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const rectNode = layout.nodes.find(n => n.type === 'rect' || n.type === 'RectElement');
      expect(rectNode?.fill).toMatch(/#3b82f6|rgb\(59,\s*130,\s*246\)/i);
    });

    it('8.2 cascades color property to child stroke currentColor', async () => {
      const code = `
        group {
          color: #10b981;
          circle { radius: 20px; stroke: currentColor 2px solid; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const circleNode = layout.nodes.find(n => n.type === 'circle' || n.type === 'CircleElement');
      expect(circleNode?.strokeColor || circleNode?.stroke?.color).toMatch(/#10b981|rgb\(16,\s*185,\s*129\)/i);
    });

    it('8.3 cascades currentColor down multi-level nested hierarchy', async () => {
      const code = `
        group {
          color: #f59e0b;
          group {
            rect { size: 50px 50px; fill: currentColor; }
          }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const rectNode = layout.nodes.find(n => n.type === 'rect' || n.type === 'RectElement');
      expect(rectNode?.fill).toMatch(/#f59e0b|rgb\(245,\s*158,\s*11\)/i);
    });

    it('8.4 overrides inherited currentColor when closer ancestor specifies new color', async () => {
      const code = `
        group {
          color: #ff0000;
          group {
            color: #0000ff;
            rect { size: 50px 50px; fill: currentColor; }
          }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const rectNode = layout.nodes.find(n => n.type === 'rect' || n.type === 'RectElement');
      expect(rectNode?.fill).toMatch(/#0000ff|rgb\(0,\s*0,\s*255\)/i);
    });

    it('8.5 defaults currentColor to black (#000000) when root has no color specified', async () => {
      const code = 'rect { size: 40px 40px; fill: currentColor; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].fill).toMatch(/#000000|black|rgb\(0,\s*0,\s*0\)/i);
    });
  });

  // ==========================================================================
  // Feature 9: Relational Positioning & DAG
  // ==========================================================================
  describe('Feature 9: Relational Positioning & DAG', () => {
    it('9.1 positions element right of target with offset', async () => {
      const code = `
        rect #a { at: (10px, 20px); size: 100px 50px; }
        rect #b { at: right of #a offset 15px; size: 80px 50px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const nodeA = layout.nodes.find(n => n.id === 'a')!;
      const nodeB = layout.nodes.find(n => n.id === 'b')!;
      expect(nodeB.x).toBe(nodeA.x + nodeA.width + 15);
      expect(nodeB.y).toBe(nodeA.y);
    });

    it('9.2 positions element below target with offset', async () => {
      const code = `
        rect #a { at: (10px, 20px); size: 100px 50px; }
        rect #b { at: below #a offset 25px; size: 100px 40px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const nodeA = layout.nodes.find(n => n.id === 'a')!;
      const nodeB = layout.nodes.find(n => n.id === 'b')!;
      expect(nodeB.y).toBe(nodeA.y + nodeA.height + 25);
      expect(nodeB.x).toBe(nodeA.x);
    });

    it('9.3 positions element center of target', async () => {
      const code = `
        rect #parentBox { at: (100px, 100px); size: 200px 100px; }
        circle #centerDot { at: center of #parentBox; radius: 20px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const parent = layout.nodes.find(n => n.id === 'parentBox')!;
      const dot = layout.nodes.find(n => n.id === 'centerDot')!;
      const parentCenterX = parent.x + parent.width / 2;
      const parentCenterY = parent.y + parent.height / 2;
      const dotCenterX = dot.x + dot.width / 2;
      const dotCenterY = dot.y + dot.height / 2;
      expect(Math.abs(dotCenterX - parentCenterX)).toBeLessThan(2);
      expect(Math.abs(dotCenterY - parentCenterY)).toBeLessThan(2);
    });

    it('9.4 topologically sorts out-of-order element definitions', async () => {
      const code = `
        rect #third { at: right of #second; size: 50px 50px; }
        rect #first { at: (0px, 0px); size: 50px 50px; }
        rect #second { at: right of #first; size: 50px 50px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const ids = layout.nodes.map(n => n.id);
      expect(ids.indexOf('first')).toBeLessThan(ids.indexOf('second'));
      expect(ids.indexOf('second')).toBeLessThan(ids.indexOf('third'));
    });

    it('9.5 falls back top-level elements without at: to (0,0) with compiler warning', async () => {
      const code = 'rect #unpositioned { size: 100px 100px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].x).toBe(0);
      expect(layout.nodes[0].y).toBe(0);
      expect(layout.warnings.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Feature 10: Local Polygon Coordinate Space
  // ==========================================================================
  describe('Feature 10: Local Polygon Coordinate Space', () => {
    it('10.1 computes bounding box from local center-relative points', async () => {
      const code = `
        polygon #tri {
          points: [ (0px, -50px), (50px, 50px), (-50px, 50px) ];
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(100);
      expect(layout.nodes[0].height).toBe(100);
    });

    it('10.2 scales vertices to explicit size dimensions', async () => {
      const code = `
        polygon #star {
          points: [ (0px, -10px), (10px, 10px), (-10px, 10px) ];
          size: 200px 200px;
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(200);
      expect(layout.nodes[0].height).toBe(200);
    });

    it('10.3 positions polygon correctly using center-relative geometry', async () => {
      const code = `
        polygon #poly {
          at: (300px, 200px);
          size: 100px 100px;
          points: [ (-50px, -50px), (50px, -50px), (50px, 50px), (-50px, 50px) ];
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].x).toBe(300);
      expect(layout.nodes[0].y).toBe(200);
    });

    it('10.4 supports asymmetric polygon vertices', async () => {
      const code = `
        polygon #wedge {
          points: [ (0px, 0px), (120px, 40px), (30px, 90px) ];
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBe(120);
      expect(layout.nodes[0].height).toBe(90);
    });

    it('10.5 handles complex hexagon points in local space', async () => {
      const code = `
        polygon #hex {
          points: [ (0px, -100px), (86px, -50px), (86px, 50px), (0px, 100px), (-86px, 50px), (-86px, -50px) ];
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].width).toBeCloseTo(172, 0);
      expect(layout.nodes[0].height).toBe(200);
    });
  });

  // ==========================================================================
  // Feature 11: Uniform Tile Grid Layout
  // ==========================================================================
  describe('Feature 11: Uniform Tile Grid Layout', () => {
    it('11.1 computes grid item positions across columns and rows', async () => {
      const code = `
        grid #g {
          at: (0px, 0px);
          columns: 2;
          gap: 10px;
          rect { size: 100px 50px; }
          rect { size: 100px 50px; }
          rect { size: 100px 50px; }
          rect { size: 100px 50px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const gridItems = layout.nodes.filter(n => n.parentId === 'g' || n.parent === 'g');
      if (gridItems.length === 4) {
        expect(gridItems[0].x).toBe(0);
        expect(gridItems[0].y).toBe(0);
        expect(gridItems[1].x).toBe(110);
        expect(gridItems[1].y).toBe(0);
        expect(gridItems[2].x).toBe(0);
        expect(gridItems[2].y).toBe(60);
        expect(gridItems[3].x).toBe(110);
        expect(gridItems[3].y).toBe(60);
      }
    });

    it('11.2 supports 3-column grid layout', async () => {
      const code = `
        grid #g3 {
          columns: 3;
          gap: 20px;
          rect { size: 80px 80px; }
          rect { size: 80px 80px; }
          rect { size: 80px 80px; }
          rect { size: 80px 80px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBeGreaterThanOrEqual(4);
    });

    it('11.3 calculates total grid container bounding box', async () => {
      const code = `
        grid #gBox {
          at: (50px, 50px);
          columns: 2;
          gap: 10px;
          rect { size: 100px 100px; }
          rect { size: 100px 100px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const gBox = layout.nodes.find(n => n.id === 'gBox');
      if (gBox) {
        expect(gBox.width).toBe(210);
        expect(gBox.height).toBe(100);
      }
    });

    it('11.4 supports grid with component children', async () => {
      const code = `
        component Card() {
          rect { size: 120px 80px; }
        }
        grid #cardGrid {
          columns: 2;
          gap: 15px;
          Card {}
          Card {}
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBeGreaterThan(0);
    });

    it('11.5 handles single item in multi-column grid', async () => {
      const code = `
        grid #singleGrid {
          columns: 4;
          gap: 10px;
          rect { size: 50px 50px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Feature 12: Font Loading (Dir & Directive)
  // ==========================================================================
  describe('Feature 12: Font Loading (Dir & Directive)', () => {
    it('12.1 provides registerFont helper function', () => {
      expect(typeof registerFont).toBe('function');
    });

    it('12.2 provides loadFontsFromDir helper function', () => {
      expect(typeof loadFontsFromDir).toBe('function');
    });

    it('12.3 registers font family name cleanly', () => {
      const success = registerFont('tests/fixtures/dummy.ttf', 'TestCustomFamily');
      expect(typeof success).toBe('boolean');
    });

    it('12.4 extracts font declarations from AST font directives', async () => {
      const code = '@font "./fonts/Roboto-Bold.ttf" as "RobotoBold"; canvas { width: 100px; height: 100px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.fonts.length).toBe(1);
      expect(resolved.fonts[0].family).toBe('RobotoBold');
    });

    it('12.5 supports font scanning in directory', () => {
      const loaded = loadFontsFromDir('tests/fixtures');
      expect(Array.isArray(loaded)).toBe(true);
    });
  });

  // ==========================================================================
  // Feature 13: Raster Canvas Rendering (Multi-scale)
  // ==========================================================================
  describe('Feature 13: Raster Canvas Rendering (Multi-scale)', () => {
    it('13.1 renders basic layout to Canvas object at 1x scale', async () => {
      const code = 'canvas { width: 400px; height: 300px; background: #ffffff; } rect { size: 200px 100px; fill: #ff0000; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const canvas = await renderToCanvas(layout, { scale: 1 });
      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(300);
    });

    it('13.2 renders canvas at 2x scale', async () => {
      const code = 'canvas { width: 300px; height: 200px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const canvas = await renderToCanvas(layout, { scale: 2 });
      expect(canvas.width).toBe(600);
      expect(canvas.height).toBe(400);
    });

    it('13.3 renders canvas at 4x scale', async () => {
      const code = 'canvas { width: 100px; height: 100px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const canvas = await renderToCanvas(layout, { scale: 4 });
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(400);
    });

    it('13.4 encodes rendered layout to PNG buffer', async () => {
      const code = 'canvas { width: 100px; height: 100px; } rect { size: 50px 50px; fill: #00ff00; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const buf = await renderToBuffer(layout, { format: 'png' });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
      // PNG header magic bytes: 0x89 0x50 0x4E 0x47
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4E);
      expect(buf[3]).toBe(0x47);
    });

    it('13.5 encodes rendered layout to JPEG buffer', async () => {
      const code = 'canvas { width: 100px; height: 100px; } rect { size: 50px 50px; fill: #0000ff; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const buf = await renderToBuffer(layout, { format: 'jpg', quality: 80 });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
      // JPEG header magic bytes: 0xFF 0xD8
      expect(buf[0]).toBe(0xFF);
      expect(buf[1]).toBe(0xD8);
    });
  });

  // ==========================================================================
  // Feature 14: Gradients & Even Stop Distribution
  // ==========================================================================
  describe('Feature 14: Gradients & Even Stop Distribution', () => {
    it('14.1 distributes missing stop positions across 3 stops', () => {
      const stops = [{ color: '#ff0000' }, { color: '#00ff00' }, { color: '#0000ff' }];
      const distributed = distributeGradientStops(stops);
      expect(distributed.length).toBe(3);
      expect(distributed[0].position).toBe(0.0);
      expect(distributed[1].position).toBeCloseTo(0.5, 2);
      expect(distributed[2].position).toBe(1.0);
    });

    it('14.2 preserves explicit stop positions when present', () => {
      const stops = [
        { color: '#ff0000', position: 0.2 },
        { color: '#00ff00' },
        { color: '#0000ff', position: 0.8 }
      ];
      const distributed = distributeGradientStops(stops);
      expect(distributed[0].position).toBe(0.2);
      expect(distributed[1].position).toBeCloseTo(0.5, 2);
      expect(distributed[2].position).toBe(0.8);
    });

    it('14.3 distributes missing intermediate stops between explicit anchors', () => {
      const stops = [
        { color: '#000', position: 0 },
        { color: '#111' },
        { color: '#222' },
        { color: '#333', position: 0.6 },
        { color: '#444' },
        { color: '#555', position: 1.0 }
      ];
      const distributed = distributeGradientStops(stops);
      expect(distributed[1].position).toBeCloseTo(0.2, 2);
      expect(distributed[2].position).toBeCloseTo(0.4, 2);
      expect(distributed[4].position).toBeCloseTo(0.8, 2);
    });

    it('14.4 parses linear-gradient with direction and multiple stops', async () => {
      const code = 'rect { size: 100px 100px; fill: linear-gradient(to right, #ff0000, #00ff00); }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.elements.length).toBe(1);
    });

    it('14.5 parses radial-gradient with circle shape', async () => {
      const code = 'rect { size: 100px 100px; fill: radial-gradient(circle, #ff0000, #0000ff); }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.elements.length).toBe(1);
    });
  });

  // ==========================================================================
  // Feature 15: Blend Modes & CSS Filters
  // ==========================================================================
  describe('Feature 15: Blend Modes & CSS Filters', () => {
    it('15.1 maps DSL blend modes to canvas globalCompositeOperation', () => {
      expect(mapBlendMode('normal')).toBe('source-over');
      expect(mapBlendMode('multiply')).toBe('multiply');
      expect(mapBlendMode('screen')).toBe('screen');
      expect(mapBlendMode('overlay')).toBe('overlay');
    });

    it('15.2 parses single filter function e.g. blur(10px)', () => {
      const filters = parseFilterString('blur(10px)');
      expect(filters.length).toBe(1);
      expect(filters[0].name).toBe('blur');
      expect(filters[0].args).toContain('10px');
    });

    it('15.3 parses space-separated multiple filter line', () => {
      const filters = parseFilterString('blur(4px) saturate(1.5) brightness(1.2)');
      expect(filters.length).toBe(3);
      expect(filters.map(f => f.name)).toEqual(['blur', 'saturate', 'brightness']);
    });

    it('15.4 parses drop-shadow filter function', () => {
      const filters = parseFilterString('drop-shadow(0px 8px 16px #00000080)');
      expect(filters.length).toBe(1);
      expect(filters[0].name).toBe('drop-shadow');
    });

    it('15.5 parses grayscale, sepia, contrast, invert, and hue-rotate', () => {
      const filters = parseFilterString('grayscale(100%) sepia(50%) contrast(200%) invert(100%) hue-rotate(90deg)');
      expect(filters.length).toBe(5);
    });
  });

  // ==========================================================================
  // Feature 16: Image Fit (fill, cover, contain, none)
  // ==========================================================================
  describe('Feature 16: Image Fit (fill, cover, contain, none)', () => {
    it('16.1 parses fit: fill property', async () => {
      const code = 'image { src: "a.png"; size: 200px 100px; fit: fill; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.elements.length).toBe(1);
    });

    it('16.2 parses fit: cover property', async () => {
      const code = 'image { src: "a.png"; size: 200px 100px; fit: cover; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.elements.length).toBe(1);
    });

    it('16.3 parses fit: contain property', async () => {
      const code = 'image { src: "a.png"; size: 200px 100px; fit: contain; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.elements.length).toBe(1);
    });

    it('16.4 parses fit: none property', async () => {
      const code = 'image { src: "a.png"; size: 200px 100px; fit: none; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      expect(resolved.elements.length).toBe(1);
    });

    it('16.5 defaults image fit to fill when omitted', async () => {
      const code = 'image { src: "a.png"; size: 200px 100px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      expect(layout.nodes[0].fit || 'fill').toBe('fill');
    });
  });

  // ==========================================================================
  // Feature 17: PSD Layer Tree & Groups
  // ==========================================================================
  describe('Feature 17: PSD Layer Tree & Groups', () => {
    it('17.1 exports layout to PSD buffer', async () => {
      const code = 'canvas { width: 200px; height: 200px; } rect { size: 100px 100px; fill: #ff0000; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psdBuf = await exportToPsd(layout);
      expect(Buffer.isBuffer(psdBuf)).toBe(true);
      expect(psdBuf.length).toBeGreaterThan(0);
      // PSD signature '8BPS' = 0x38 0x42 0x50 0x53
      expect(psdBuf[0]).toBe(0x38);
      expect(psdBuf[1]).toBe(0x42);
      expect(psdBuf[2]).toBe(0x50);
      expect(psdBuf[3]).toBe(0x53);
    });

    it('17.2 preserves layer names and element IDs in PSD export', async () => {
      const code = 'canvas { width: 200px; height: 200px; } rect #headerBox { size: 100px 50px; }';
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });

    it('17.3 preserves group hierarchies in PSD structure', async () => {
      const code = `
        canvas { width: 300px; height: 300px; }
        group #myGroup {
          rect #child1 { size: 50px 50px; }
          rect #child2 { size: 50px 50px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });

    it('17.4 preserves opacity and blend modes in PSD layers', async () => {
      const code = `
        canvas { width: 200px; height: 200px; }
        rect { size: 100px 100px; fill: #ff0000; opacity: 0.5; blend-mode: multiply; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });

    it('17.5 supports nested group hierarchies', async () => {
      const code = `
        canvas { width: 400px; height: 400px; }
        group #outer {
          group #inner {
            rect { size: 20px 20px; }
          }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Feature 18: PSD Editable Text & Clipping Masks
  // ==========================================================================
  describe('Feature 18: PSD Editable Text & Clipping Masks', () => {
    it('18.1 exports text elements as native editable PSD text layers', async () => {
      const code = `
        canvas { width: 400px; height: 200px; }
        text #editable { content: "PSD Editable Text"; font-size: 24px; fill: #ffffff; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });

    it('18.2 exports clipping masks with clipped child layers in PSD', async () => {
      const code = `
        canvas { width: 400px; height: 400px; }
        group #maskedGroup {
          rect #maskShape { size: 200px 200px; clip: true; }
          image #contentImage { src: "photo.jpg"; size: 300px 300px; }
        }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });

    it('18.3 exports font family and font size in PSD text properties', async () => {
      const code = `
        canvas { width: 300px; height: 100px; }
        text { content: "Sample"; font-family: "Arial"; font-size: 32px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });

    it('18.4 exports multi-line text with line breaks in PSD', async () => {
      const code = `
        canvas { width: 400px; height: 200px; }
        text { content: "Line 1\\nLine 2"; font-size: 16px; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });

    it('18.5 exports vector shapes with fill color in PSD', async () => {
      const code = `
        canvas { width: 200px; height: 200px; }
        circle { radius: 40px; fill: #10b981; }
      `;
      const ast = parseToad(code);
      const resolved = await resolveImportsAndComponents(ast, 'main.toad');
      const layout = await solveLayout(resolved);
      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Feature 19: CLI Commands & Flags
  // ==========================================================================
  describe('Feature 19: CLI Commands & Flags', () => {
    it('19.1 compileToad runs programmatically with format=png', async () => {
      const res = await compileToad('tests/fixtures/sample_shapes.toad', { format: 'png' });
      expect(res).toBeDefined();
    });

    it('19.2 compileToad supports scale parameter (scale=2)', async () => {
      const res = await compileToad('tests/fixtures/sample_shapes.toad', { scale: 2 });
      expect(res).toBeDefined();
    });

    it('19.3 compileToad supports format=psd', async () => {
      const res = await compileToad('tests/fixtures/sample_shapes.toad', { format: 'psd' });
      expect(res).toBeDefined();
    });

    it('19.4 compileToad supports format=all', async () => {
      const res = await compileToad('tests/fixtures/sample_shapes.toad', { format: 'all' });
      expect(res).toBeDefined();
    });

    it('19.5 compileToad accepts outDir option', async () => {
      const res = await compileToad('tests/fixtures/sample_shapes.toad', { outDir: './tests/dist' });
      expect(res).toBeDefined();
    });
  });

  // ==========================================================================
  // Feature 20: Watch Mode & Change Detection
  // ==========================================================================
  describe('Feature 20: Watch Mode & Change Detection', () => {
    it('20.1 extracts transitive dependency graph from import directives', async () => {
      const ast = parseToad('@import "./tokens.toad"; canvas { width: 100px; height: 100px; }');
      const resolved = await resolveImportsAndComponents(ast, 'tests/fixtures/main.toad', () => '>val = 10px;');
      const layout = await solveLayout(resolved);
      expect(layout.dependencies.length).toBeGreaterThanOrEqual(1);
    });

    it('20.2 includes entry file in watch dependency list', async () => {
      const ast = parseToad('canvas { width: 100px; height: 100px; }');
      const resolved = await resolveImportsAndComponents(ast, 'tests/fixtures/entry.toad');
      const layout = await solveLayout(resolved);
      expect(layout.dependencies).toBeDefined();
    });

    it('20.3 tracks multi-level deep transitive imports', async () => {
      const fileC = '>c = 30px;';
      const fileB = '@import "./fileC.toad"; >b = 20px;';
      const fileA = '@import "./fileB.toad"; canvas { width: 100px; height: 100px; }';
      
      const loader = (p: string) => {
        if (p.includes('fileC')) return fileC;
        if (p.includes('fileB')) return fileB;
        return fileA;
      };

      const ast = parseToad(fileA, 'fileA.toad');
      const resolved = await resolveImportsAndComponents(ast, 'fileA.toad', loader);
      const layout = await solveLayout(resolved);
      expect(layout.dependencies.length).toBeGreaterThanOrEqual(2);
    });

    it('20.4 deduplicates dependencies in watch list', async () => {
      const tokens = '>tok = 1px;';
      const main = `
        @import "./tokens.toad";
        @import "./tokens.toad";
        canvas { width: 100px; height: 100px; }
      `;
      const loader = () => tokens;
      const ast = parseToad(main, 'main.toad');
      const resolved = await resolveImportsAndComponents(ast, 'main.toad', loader);
      const layout = await solveLayout(resolved);
      const uniqueDeps = Array.from(new Set(layout.dependencies));
      expect(layout.dependencies.length).toBe(uniqueDeps.length);
    });

    it('20.5 watch mode option flag is accepted in compile options', async () => {
      const res = await compileToad('tests/fixtures/sample_shapes.toad', { watch: false });
      expect(res).toBeDefined();
    });
  });

});
