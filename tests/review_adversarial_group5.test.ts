import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/parser/lexer.js';
import { Parser } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { LayoutSolver } from '../src/parser/math.js';
import { calculateTac, auditDesign } from '../src/tools/designAuditor.js';
import { runAntiSlopAudit } from '../src/tools/antiSlopRules.js';
import { parseColorToRgba } from '../src/engine/drawUtils.js';
import { PsdExporter } from '../src/engine/psdExporter.js';
import { lintDocument } from '../src/tools/linter.js';

describe('Review Adversarial - Group 5', () => {
  // F-05: Element ID collision with hex color in mask and relational properties
  it('F-05: parses hex-like element IDs (#c0ffee, #fade) as ElementReference in mask property', async () => {
    const code = `
      canvas { width: 400px; height: 400px; }
      rect #fade { width: 100px; height: 100px; }
      rect #target {
        width: 100px;
        height: 100px;
        mask: #fade;
      }
    `;
    const parser = new Parser(tokenize(code));
    const ast = parser.parse();
    const targetElem = ast.elements.find(e => e.id === 'target');
    expect(targetElem).toBeDefined();
    const maskProp = targetElem!.properties.find(p => p.name === 'mask');
    expect(maskProp?.value.type).toBe('ElementReference');
    expect((maskProp?.value as any).targetId).toBe('fade');

    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const resolvedTarget = resolved.elements.find(e => e.id === 'target');
    expect(resolvedTarget?.mask).toBe('#fade');
  });

  // F-15: Prepress TAC calculation avoids division by zero on near-black
  it('F-15: calculateTac avoids division-by-zero or numerical explosion on near-black inputs', () => {
    const nearBlack = { r: 1, g: 0, b: 0, a: 1 };
    const tacResult = calculateTac(nearBlack);
    expect(Number.isFinite(tacResult.tac)).toBe(true);
    expect(tacResult.c).toBeGreaterThanOrEqual(0);
    expect(tacResult.c).toBeLessThanOrEqual(100);
    expect(tacResult.tac).toBeLessThanOrEqual(400);

    const pitchBlack = { r: 0, g: 0, b: 0, a: 1 };
    const blackTac = calculateTac(pitchBlack);
    expect(blackTac.k).toBe(100);
    expect(blackTac.tac).toBe(100);
  });

  // F-16: Bento overkill does not flag cards with dense telemetry or rich icons
  it('F-16: anti-slop checkBentoOverkill does not falsely flag telemetry/metric cards', () => {
    const layout = {
      canvas: { width: 1200, height: 800, dpi: 96, background: '#ffffff' },
      nodes: [
        // 5 cards across 2 columns
        { id: 'c1', type: 'rect' as const, x: 50, y: 50, width: 200, height: 120, style: { stroke: '#ccc', borderRadius: 16 }, fill: 'alpha(#fff, 0.9)' },
        { id: 'c2', type: 'rect' as const, x: 300, y: 50, width: 200, height: 120, style: { stroke: '#ccc', borderRadius: 16 }, fill: 'alpha(#fff, 0.9)' },
        { id: 'c3', type: 'rect' as const, x: 50, y: 200, width: 200, height: 120, style: { stroke: '#ccc', borderRadius: 16 }, fill: 'alpha(#fff, 0.9)' },
        { id: 'c4', type: 'rect' as const, x: 300, y: 200, width: 200, height: 120, style: { stroke: '#ccc', borderRadius: 16 }, fill: 'alpha(#fff, 0.9)' },
        { id: 'c5', type: 'rect' as const, x: 50, y: 350, width: 200, height: 120, style: { stroke: '#ccc', borderRadius: 16 }, fill: 'alpha(#fff, 0.9)' },
        // Dense KPI metrics inside cards
        { id: 't1', type: 'text' as const, x: 60, y: 60, width: 100, height: 20, content: '+14.2% Growth', style: {} },
        { id: 't2', type: 'text' as const, x: 310, y: 60, width: 100, height: 20, content: '$1,420 MRR', style: {} },
        { id: 't3', type: 'text' as const, x: 60, y: 210, width: 100, height: 20, content: '99.9% uptime', style: {} },
        { id: 't4', type: 'text' as const, x: 310, y: 210, width: 100, height: 20, content: '42ms latency', style: {} },
        { id: 't5', type: 'text' as const, x: 60, y: 360, width: 100, height: 20, content: '50k users', style: {} },
      ]
    };
    const ctx = {
      layout: layout as any,
      allNodes: layout.nodes as any,
      textNodes: layout.nodes.filter(n => n.type === 'text') as any,
      bgRgba: { r: 255, g: 255, b: 255, a: 1 },
      canvasWidth: 1200,
      canvasHeight: 800,
      canvasArea: 960000,
      negativeSpacePercent: 60
    };
    const findings = runAntiSlopAudit(ctx);
    const bentoFinding = findings.find(f => f.code === 'SLOP-WEB-002');
    expect(bentoFinding?.severity).not.toBe('fatal');
    expect(bentoFinding?.message).toContain('0 with shallow filler content');
  });

  // F-31: Nested variable resolution in functional color transforms
  it('F-31: resolves variable opacity passed into alpha() transform', async () => {
    const code = `
      >op = 0.4;
      canvas { width: 100px; height: 100px; }
      rect #box {
        width: 50px;
        height: 50px;
        fill: alpha(#FF0000, >op);
      }
    `;
    const parser = new Parser(tokenize(code));
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const rect = resolved.elements.find(e => e.id === 'box');
    expect(rect).toBeDefined();
    expect(rect!.fill).toMatch(/rgba\(255,\s*0,\s*0,\s*0\.4\)/i);
  });

  // F-32: Contrast auditor checks all gradient stops
  it('F-32: contrast auditor detects contrast failure against contrasting gradient stop', () => {
    const layout = {
      canvas: {
        width: 400,
        height: 400,
        background: {
          type: 'linear',
          stops: [
            { color: '#000000', position: 0 },
            { color: '#ffffff', position: 1 } // White stop fails contrast against white text
          ]
        }
      },
      nodes: [
        {
          id: 'headline',
          type: 'text',
          x: 50,
          y: 50,
          width: 200,
          height: 30,
          style: { color: '#ffffff' },
          textLayout: { fontSize: 16 }
        }
      ]
    };
    const report = auditDesign(layout as any);
    const contrastPair = report.metrics.contrastPairs.find(cp => cp.nodeId === '#headline');
    expect(contrastPair).toBeDefined();
    // Against white stop (#ffffff), white text (#ffffff) has 1:1 contrast
    expect(contrastPair!.wcagRatio).toBeCloseTo(1, 0);
  });

  // F-33: Grid track allocation with mixed explicit and flexible columns
  it('F-33: calculates mixed explicit and flexible column widths correctly in grid layout', async () => {
    const code = `
      canvas { width: 500px; height: 300px; }
      grid #myGrid {
        width: 500px;
        height: 200px;
        columns: 2;
        gap: 20px;
        rect #col1 { width: 100px; height: 80px; }
        rect #col2 { width: fill; height: 80px; }
      }
    `;
    const parser = new Parser(tokenize(code));
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const engine = new LayoutSolver(resolved);
    const result = engine.solve();
    const gridNode = result.nodes.find(n => n.id === 'myGrid');
    expect(gridNode).toBeDefined();
    const col1 = gridNode!.children?.find(c => c.id === 'col1');
    const col2 = gridNode!.children?.find(c => c.id === 'col2');
    expect(col1?.width).toBe(100);
    // Remaining width: 500 - 20 (gap) - 100 = 380
    expect(col2?.width).toBe(380);
    expect(col2?.x).toBe(120); // 100 + 20
  });

  // F-53: PSD exporter explicit tracking zero-reset
  it('F-53: PSD exporter attaches tracking: 0 when letterSpacing is explicitly 0', async () => {
    const node = {
      id: 'textNode',
      type: 'text' as const,
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      style: { letterSpacing: 0, color: '#000000' },
      textLayout: { fontSize: 16, lineHeight: 20, lines: ['Test'] }
    };
    const layer = await (PsdExporter as any).buildPsdLayerInternal(node, 1, undefined, 72);
    expect(layer.text.style.tracking).toBe(0);
  });

  // F-54: Duplicate ID warning cites original element declaration location
  it('F-54: LINT-DUPLICATE-ID cites original element declaration line and column', () => {
    const code = `
      rect #myBox { width: 100px; }
      circle #myBox { width: 50px; }
    `;
    const parser = new Parser(tokenize(code));
    const ast = parser.parse();
    const diags = lintDocument(ast);
    const dupe = diags.find(d => d.code === 'LINT-DUPLICATE-ID');
    expect(dupe).toBeDefined();
    expect(dupe!.message).toContain('first declared at line');
  });

  // F-55: LayoutResult deduplicates font declarations
  it('F-55: LayoutSolver deduplicates identical font declarations in layout.fonts', async () => {
    const code = `
      @font "Inter" "fonts/Inter.ttf";
      @font "Inter" "fonts/Inter.ttf";
      canvas { width: 100px; height: 100px; }
    `;
    const parser = new Parser(tokenize(code));
    const ast = parser.parse();
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const engine = new LayoutSolver(resolved);
    const result = engine.solve();
    expect(result.fonts).toHaveLength(1);
  });

  // F-56: 4-digit hex parsing #RGBA
  it('F-56: parseColorToRgba parses 4-digit hex colors (#F008) correctly', () => {
    const rgba = parseColorToRgba('#F008');
    expect(rgba.r).toBe(255);
    expect(rgba.g).toBe(0);
    expect(rgba.b).toBe(0);
    expect(rgba.a).toBeCloseTo(0.5333, 2);
  });
});
