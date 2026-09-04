import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { PsdExporter } from '../src/engine/psdExporter.js';
import { readPsd } from 'ag-psd';

describe('PSD End-to-End DSL Integration Test', () => {
  it('compiles toad DSL with native Photoshop attributes directly to layered PSD', async () => {
    const dsl = `
      canvas "Design System" {
        size: 800px 600px;
        fill: #0f172a;
        guides: "h 150", "v 200";
        global-light: 120 45;
      }

      rect #glassCard "Glassmorphism Card" {
        at: (100px, 100px);
        size: 400px 250px;
        radius: 16px;
        fill: #ffffff;
        fill-opacity: 20%;
        layer-color: blue;
        lock: position;
        knockout: true;
      }

      text "Hello Photoshop" {
        at: below #glassCard offset 30px;
        font-family: "Arial";
        font-size: 28px;
        color: #f8fafc;
        layer-color: green;
        text-transform: uppercase;
      }
    `;

    // 1. Parse DSL into AST
    const ast = parseToad(dsl, 'test_psd.toad');
    if (ast.diagnostics.length > 0) {
      console.log('Parser diagnostics:', ast.diagnostics);
    }
    expect(ast.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

    // 2. Resolve AST
    const resolved = await resolveImportsAndComponents(ast, 'test_psd.toad');
    expect(resolved.canvas.guides).toBeDefined();
    expect(resolved.canvas.guides).toHaveLength(2);
    expect(resolved.canvas.globalLight).toEqual({ angle: 120, altitude: 45 });

    const cardResolved = resolved.elements.find(e => e.id === 'glassCard');
    expect(cardResolved).toBeDefined();
    expect(cardResolved?.layerColor).toBe('blue');
    expect(cardResolved?.fillOpacity).toBeCloseTo(0.2, 2);
    expect(cardResolved?.lock).toBe('position');
    expect(cardResolved?.knockout).toBe(true);

    // 3. Solve Layout
    const layout = await solveLayout(resolved);
    expect(layout.canvas.guides).toHaveLength(2);
    expect(layout.canvas.globalLight?.angle).toBe(120);

    const cardNode = layout.nodes.find(n => n.id === 'glassCard');
    expect(cardNode).toBeDefined();
    expect(cardNode?.style.layerColor).toBe('blue');
    expect(cardNode?.style.fillOpacity).toBeCloseTo(0.2, 2);
    expect(cardNode?.style.lock).toBe('position');
    expect(cardNode?.style.knockout).toBe(true);

    // 4. Export to real PSD buffer
    const psdBuffer = await PsdExporter.export(layout);
    expect(psdBuffer).toBeDefined();
    expect(psdBuffer.length).toBeGreaterThan(100);

    // 5. Binary Readback with ag-psd
    const psd = readPsd(psdBuffer, { skipCompositeImageData: true });
    expect(psd.width).toBe(800);
    expect(psd.height).toBe(600);
    expect(psd.imageResources?.gridAndGuidesInformation?.guides).toHaveLength(2);
    expect(psd.imageResources?.globalAngle).toBe(120);

    const cardLayer = psd.children?.find(l => l.name === 'Glassmorphism Card');
    console.log('PSD Children names:', psd.children?.map(l => l.name));
    expect(cardLayer).toBeDefined();
    expect(cardLayer?.layerColor).toBe('blue');
    expect(cardLayer?.fillOpacity).toBeCloseTo(0.2, 2);
    expect(cardLayer?.knockout).toBe(true);
    expect(cardLayer?.protected?.position).toBe(true);

    const textLayer = psd.children?.find(l => l.name === 'HELLO PHOTOSHOP');
    expect(textLayer).toBeDefined();
    expect(textLayer?.layerColor).toBe('green');
    expect(textLayer?.text?.style?.fontCaps).toBe(1);
  });
});
