import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import {
  RectElementNode,
  TextElementNode,
  PolygonElementNode,
  GroupElementNode,
  GridElementNode,
  ComponentInstanceNode,
  RelationalPositionNode,
  LinearGradientNode,
  FilterValueNode
} from '../src/parser/ast.js';

describe('Parser', () => {
  it('parses directives and global variable declarations', () => {
    const src = `
      @import "./theme.toad";
      @font "./Inter-Bold.ttf" as "Inter" bold;
      >primary = #3b82f6;
      >spacing = 16px;
    `;
    const doc = parseToad(src);

    expect(doc.directives).toHaveLength(2);
    expect(doc.directives[0].type).toBe('ImportDirective');
    expect((doc.directives[0] as any).path).toBe('./theme.toad');

    expect(doc.directives[1].type).toBe('FontDirective');
    expect((doc.directives[1] as any).family).toBe('Inter');
    expect((doc.directives[1] as any).weight).toBe('bold');

    expect(doc.variables).toHaveLength(2);
    expect(doc.variables[0].name).toBe('primary');
    expect(doc.variables[0].value.type).toBe('ColorLiteral');
    expect(doc.variables[1].name).toBe('spacing');
    expect(doc.variables[1].value.type).toBe('DimensionLiteral');
  });

  it('parses canvas block and root shape elements', () => {
    const src = `
      canvas "Main Dashboard" {
        size: 1920px 1080px;
        fill: #ffffff;
      }

      rect #card {
        at: 100px 200px;
        size: 400px 300px;
        fill: #f3f4f6;
        radius: 8px;
      }

      circle #avatar {
        at: (50px, 50px);
        size: 64px 64px;
        fill: #3b82f6;
      }
    `;
    const doc = parseToad(src);

    expect(doc.canvas).toBeDefined();
    expect(doc.canvas?.name).toBe('Main Dashboard');
    expect(doc.canvas?.properties).toHaveLength(2);

    expect(doc.elements).toHaveLength(2);
    const rect = doc.elements[0] as RectElementNode;
    expect(rect.type).toBe('RectElement');
    expect(rect.id).toBe('card');
    expect(rect.properties).toHaveLength(4);

    const circle = doc.elements[1];
    expect(circle.type).toBe('CircleElement');
    expect(circle.id).toBe('avatar');
  });

  it('parses text element with shorthand content and font properties', () => {
    const src = `
      text "Welcome Back" #title {
        at: 40px 60px;
        font: bold 32px "Inter";
        fill: #111827;
      }
    `;
    const doc = parseToad(src);

    expect(doc.elements).toHaveLength(1);
    const textNode = doc.elements[0] as TextElementNode;
    expect(textNode.type).toBe('TextElement');
    expect(textNode.id).toBe('title');
    expect(textNode.text).toBe('Welcome Back');
  });

  it('parses relational positioning expressions', () => {
    const src = `
      rect #header {
        at: 0 0;
        size: 100% 80px;
      }

      rect #sidebar {
        at: below #header offset 10px;
        size: 240px 600px;
      }

      rect #content {
        at: right of #sidebar offset 20px;
        size: 800px 600px;
      }
    `;
    const doc = parseToad(src);

    expect(doc.elements).toHaveLength(3);
    const sidebar = doc.elements[1];
    const atProp = sidebar.properties.find(p => p.name === 'at');
    expect(atProp?.value.type).toBe('RelationalPosition');

    const relPos = atProp?.value as RelationalPositionNode;
    expect(relPos.relation).toBe('below');
    expect(relPos.target).toBe('header');
  });

  it('parses linear gradients and CSS filters', () => {
    const src = `
      rect #hero {
        fill: linear-gradient(to right, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
        filter: blur(4px) saturate(1.5);
      }
    `;
    const doc = parseToad(src);

    const rect = doc.elements[0];
    const fillProp = rect.properties.find(p => p.name === 'fill');
    expect(fillProp?.value.type).toBe('LinearGradient');
    const grad = fillProp?.value as LinearGradientNode;
    expect(grad.stops).toHaveLength(3);

    const filterProp = rect.properties.find(p => p.name === 'filter');
    expect(filterProp?.value.type).toBe('FilterValue');
    const filter = filterProp?.value as FilterValueNode;
    expect(filter.filters).toHaveLength(2);
    expect(filter.filters[0].name).toBe('blur');
    expect(filter.filters[1].name).toBe('saturate');
  });

  it('parses polygon with point array', () => {
    const src = `
      polygon #arrow {
        points: [ (0, -20), (20, 20), (0, 10), (-20, 20) ];
        fill: #000;
      }
    `;
    const doc = parseToad(src);

    const poly = doc.elements[0] as PolygonElementNode;
    expect(poly.type).toBe('PolygonElement');
    const pointsProp = poly.properties.find(p => p.name === 'points');
    expect(pointsProp?.value.type).toBe('PointsValue');
    expect((pointsProp?.value as any).points).toHaveLength(4);
  });

  it('parses component definitions and named argument call sites', () => {
    const src = `
      component Button(label = "Submit", bg = #3b82f6, size = 180px) {
        rect {
          size: >size 44px;
          fill: >bg;
          radius: 6px;
        }
        text >label {
          at: center of parent;
          fill: #fff;
        }
      }

      Button(label: "Click Me", bg: #ef4444) #btnSubmit {
        at: 100px 200px;
      }
    `;
    const doc = parseToad(src);

    expect(doc.components).toHaveLength(1);
    const comp = doc.components[0];
    expect(comp.name).toBe('Button');
    expect(comp.parameters).toHaveLength(3);
    expect(comp.parameters[0].name).toBe('label');

    expect(doc.elements).toHaveLength(1);
    const inst = doc.elements[0] as ComponentInstanceNode;
    expect(inst.type).toBe('ComponentInstance');
    expect(inst.componentName).toBe('Button');
    expect(inst.id).toBe('btnSubmit');
    expect(inst.arguments).toHaveLength(2);
    expect(inst.arguments[0].name).toBe('label');
  });

  it('parses grid layout container with child items', () => {
    const src = `
      grid #productGrid {
        at: 40px 100px;
        columns: 3;
        gap: 16px;
        rect { size: 200px 200px; fill: #eee; }
        rect { size: 200px 200px; fill: #ddd; }
        rect { size: 200px 200px; fill: #ccc; }
      }
    `;
    const doc = parseToad(src);

    const grid = doc.elements[0] as GridElementNode;
    expect(grid.type).toBe('GridElement');
    expect(grid.children).toHaveLength(3);
  });

  it('performs panic-mode error recovery on malformed properties', () => {
    const src = `
      rect #card1 {
        fill: ; // Missing fill value
        radius: 8px;
      }

      rect #card2 {
        size: 100px 100px;
      }
    `;
    const doc = parseToad(src);

    // Diagnostics should capture error
    expect(doc.diagnostics).toBeDefined();
    expect(doc.diagnostics!.length).toBeGreaterThan(0);

    // Should successfully recover and parse #card2
    expect(doc.elements.length).toBeGreaterThanOrEqual(1);
    const card2 = doc.elements.find(e => e.id === 'card2');
    expect(card2).toBeDefined();
  });

  it('parses stroke shorthands with color, width, and style', () => {
    const src = `
      rect #box1 { stroke: #000 2px dashed; }
      rect #box2 { stroke: 4px solid; }
      rect #box3 { stroke: #ff0000; }
    `;
    const doc = parseToad(src);

    expect(doc.elements).toHaveLength(3);
    const box1 = doc.elements[0];
    const sProp1 = box1.properties.find(p => p.name === 'stroke');
    expect(sProp1?.value.type).toBe('StrokeValue');
  });

  it('parses radial gradient with shape and stops', () => {
    const src = `
      rect #sphere {
        fill: radial-gradient(circle, #ffffff 0%, #000000 100%);
      }
    `;
    const doc = parseToad(src);

    const rect = doc.elements[0];
    const fillProp = rect.properties.find(p => p.name === 'fill');
    expect(fillProp?.value.type).toBe('RadialGradient');
  });

  it('parses nested group structures', () => {
    const src = `
      group #rootGroup {
        at: 0 0;
        group #subGroup {
          rect #leafRect { size: 50px 50px; }
        }
      }
    `;
    const doc = parseToad(src);

    expect(doc.elements).toHaveLength(1);
    const root = doc.elements[0] as GroupElementNode;
    expect(root.children).toHaveLength(1);
    const sub = root.children[0] as GroupElementNode;
    expect(sub.children).toHaveLength(1);
    expect(sub.children[0].id).toBe('leafRect');
  });

  it('parses text: property correctly without mistaking it for child text element', () => {
    const src = `
      text #label {
        text: "Custom Message";
        fill: #ffffff;
      }
    `;
    const doc = parseToad(src);
    expect(doc.elements).toHaveLength(1);
    const textNode = doc.elements[0] as TextElementNode;
    expect(textNode.properties.find(p => p.name === 'text')).toBeDefined();
  });

  it('parses variable text shorthand in element header', () => {
    const src = `
      >msg = "Dynamic Title";
      text >msg #title;
    `;
    const doc = parseToad(src);
    expect(doc.elements).toHaveLength(1);
    const textNode = doc.elements[0] as TextElementNode;
    expect(textNode.text).toBe('>msg');
    expect(textNode.id).toBe('title');
  });

  it('parses variable reference in points property', () => {
    const src = `
      >coords = [ (0, 0), (10, 10) ];
      polygon #poly {
        points: >coords;
      }
    `;
    const doc = parseToad(src);
    expect(doc.elements).toHaveLength(1);
    const poly = doc.elements[0] as PolygonElementNode;
    const ptsProp = poly.properties.find(p => p.name === 'points');
    expect(ptsProp?.value.type).toBe('VariableReference');
  });
});

