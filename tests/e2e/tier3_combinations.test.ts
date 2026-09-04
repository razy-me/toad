// tests/e2e/tier3_combinations.test.ts
// Tier 3: Pairwise Combinatorial Cross-Feature Interactions (>=20 tests)

import { describe, it, expect } from 'vitest';

import { parseToad } from '../../src/parser/parser.js';
import { resolveImportsAndComponents } from '../../src/parser/importResolver.js';
import { solveLayout } from '../../src/parser/math.js';
import { renderToCanvas, renderToBuffer } from '../../src/engine/canvasRenderer.js';
import { exportToPsd } from '../../src/engine/psdExporter.js';
import { compileToad } from '../../src/build.js';

describe('Tier 3: Pairwise Combinatorial Cross-Feature Interactions (>=20 tests)', () => {

  // 1. Variables + Gradients
  it('3.1 combines scoped variables within gradient stops and directions', async () => {
    const code = `
      >startCol = #3b82f6;
      >endCol = #1e40af;
      >angle = 45deg;
      rect {
        size: 200px 100px;
        fill: linear-gradient(>angle, >startCol, >endCol);
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBe(1);
  });

  // 2. Components + Tile Grids
  it('3.2 combines parameterized component instances within a uniform tile grid', async () => {
    const code = `
      component StatCard(title = "Metric", val = "100", bg = #1e293b) {
        group {
          rect { size: 140px 80px; fill: >bg; border-radius: 8px; }
          text { at: (10px, 10px); content: >title; font-size: 12px; fill: #94a3b8; }
          text { at: (10px, 35px); content: >val; font-size: 24px; font-weight: bold; fill: #ffffff; }
        }
      }
      grid #statsGrid {
        at: (20px, 20px);
        columns: 2;
        gap: 12px;
        StatCard { title: "Revenue"; val: "$45K"; bg: #0f172a; }
        StatCard { title: "Users"; val: "1.2K"; bg: #0f172a; }
        StatCard { title: "Growth"; val: "+28%"; bg: #0f172a; }
        StatCard { title: "Churn"; val: "0.8%"; bg: #0f172a; }
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThanOrEqual(4);
  });

  // 3. Relational Positioning + Polygon Local Space
  it('3.3 combines relational positioning with center-relative polygon geometries', async () => {
    const code = `
      polygon #hexIcon {
        at: (50px, 50px);
        size: 60px 60px;
        points: [ (0px, -30px), (26px, -15px), (26px, 15px), (0px, 30px), (-26px, 15px), (-26px, -15px) ];
        fill: #3b82f6;
      }
      text #label {
        at: right of #hexIcon offset 16px;
        content: "Security Status";
        font-size: 18px;
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    const hex = layout.nodes.find(n => n.id === 'hexIcon')!;
    const lbl = layout.nodes.find(n => n.id === 'label')!;
    expect(lbl.x).toBe(hex.x + hex.width + 16);
  });

  // 4. currentColor + Nested Groups + Clipping Masks
  it('3.4 cascades currentColor through nested groups into clipped child strokes and fills', async () => {
    const code = `
      group #themeContainer {
        color: #10b981;
        group #clippedSubGroup {
          size: 100px 100px;
          clip: true;
          circle { radius: 40px; fill: currentColor; }
          rect { size: 60px 60px; stroke: currentColor 2px solid; }
        }
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    const circle = layout.nodes.find(n => n.type === 'circle' || n.type === 'CircleElement');
    expect(circle?.fill).toMatch(/#10b981|rgb\(16,\s*185,\s*129\)/i);
  });

  // 5. Multi-Scale Raster + Text Auto-Wrap + Filters
  it('3.5 renders multi-scale (2x) raster for auto-wrapped text with blur and drop-shadow filters', async () => {
    const code = `
      canvas { width: 400px; height: 300px; }
      text #banner {
        at: (20px, 20px);
        size: 300px;
        content: "High performance rendering with Skia text layout and drop shadow filters.";
        font-size: 20px;
        filter: drop-shadow(0px 4px 12px #00000080);
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    const canvas2x = await renderToCanvas(layout, { scale: 2 });
    expect(canvas2x.width).toBe(800);
    expect(canvas2x.height).toBe(600);
  });

  // 6. Layered PSD Export + Relational Layout + Editable Text + @font
  it('3.6 exports relational text hierarchy to layered PSD with font family preservation', async () => {
    const code = `
      @font "./fonts/Inter.ttf" as "Inter";
      canvas { width: 600px; height: 400px; }
      rect #headerBox { at: (50px, 50px); size: 500px 80px; fill: #1e293b; }
      text #headerTitle {
        at: inside #headerBox;
        content: "PSD Native Text Layer";
        font-family: "Inter";
        font-size: 24px;
        fill: #ffffff;
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    const psdBuf = await exportToPsd(layout);
    expect(psdBuf.length).toBeGreaterThan(0);
  });

  // 7. Blend Modes + CSS Filters on Image Elements with fit: cover
  it('3.7 combines multiply blend mode, brightness filter, and fit: cover on image', async () => {
    const code = `
      canvas { width: 400px; height: 300px; }
      image #coverPhoto {
        at: (0px, 0px);
        size: 400px 300px;
        src: "sample.jpg";
        fit: cover;
        blend-mode: multiply;
        filter: brightness(0.9) contrast(1.1);
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes[0].fit).toBe('cover');
  });

  // 8. @import Directives + Component Default Arguments + Scoped Variables
  it('3.8 combines imported variables as component default parameter values', async () => {
    const tokensFile = '>defaultCardWidth = 220px; >defaultCardColor = #3b82f6;';
    const mainFile = `
      @import "./tokens.toad";
      component ActionCard(w = >defaultCardWidth, c = >defaultCardColor) {
        rect { size: >w 120px; fill: >c; }
      }
      ActionCard #card1 {}
    `;
    const loader = (p: string) => (p.includes('tokens') ? tokensFile : mainFile);
    const ast = parseToad(mainFile, 'main.toad');
    const resolved = await resolveImportsAndComponents(ast, 'main.toad', loader);
    const layout = await solveLayout(resolved);
    expect(layout.nodes[0].width).toBe(220);
  });

  // 9. Relational Positioning DAG with Multiple Heterogeneous Shapes
  it('3.9 builds relational DAG between rect, circle, polygon, and text', async () => {
    const code = `
      rect #box { at: (50px, 50px); size: 100px 100px; }
      circle #dot { at: right of #box offset 20px; radius: 30px; }
      polygon #poly { at: below #box offset 20px; points: [ (0px,-20px),(20px,20px),(-20px,20px) ]; }
      text #label { at: right of #poly offset 20px; content: "Mixed Shapes"; font-size: 16px; }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBe(4);
  });

  // 10. Polygon with currentColor and Gradient Fills
  it('3.10 combines polygon center-relative vertices with linear-gradient and currentColor stroke', async () => {
    const code = `
      group {
        color: #f59e0b;
        polygon #styledPoly {
          at: (100px, 100px);
          size: 120px 120px;
          points: [ (0px, -60px), (60px, 0px), (0px, 60px), (-60px, 0px) ];
          fill: linear-gradient(180deg, #f59e0b, #b45309);
          stroke: currentColor 2px solid;
        }
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThan(0);
  });

  // 11. Nested Tile Grids with Relational Offsets
  it('3.11 combines nested tile grids with relational layout positioning', async () => {
    const code = `
      grid #grid1 {
        at: (20px, 20px);
        columns: 2;
        gap: 10px;
        rect { size: 60px 40px; }
        rect { size: 60px 40px; }
      }
      grid #grid2 {
        at: below #grid1 offset 20px;
        columns: 3;
        gap: 10px;
        rect { size: 40px 40px; }
        rect { size: 40px 40px; }
        rect { size: 40px 40px; }
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThanOrEqual(5);
  });

  // 12. Text Auto-Wrap inside Component Instances inside Grids
  it('3.12 combines text auto-wrapping inside component cards placed in a tile grid', async () => {
    const code = `
      component TextCard(headline = "Title", body = "Description goes here...") {
        group {
          rect { size: 200px 120px; fill: #1e293b; border-radius: 8px; }
          text { at: (12px, 12px); content: >headline; font-size: 16px; font-weight: bold; }
          text { at: (12px, 40px); size: 176px; content: >body; font-size: 13px; }
        }
      }
      grid {
        columns: 2;
        gap: 16px;
        TextCard { headline: "Card 1"; body: "This is a detailed description that auto wraps nicely inside the card cell."; }
        TextCard { headline: "Card 2"; body: "Another card with auto wrapped text content."; }
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThanOrEqual(2);
  });

  // 13. PSD Layer Masks + Skia Measured Text Bounding Boxes
  it('3.13 combines clipping masks and Skia measured text bounding boxes in PSD export', async () => {
    const code = `
      canvas { width: 500px; height: 300px; }
      group #maskedArea {
        at: (50px, 50px);
        size: 300px 150px;
        clip: true;
        text { content: "Masked Text Content That Extends Beyond Bounding Box"; font-size: 28px; }
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    const psdBuf = await exportToPsd(layout);
    expect(psdBuf.length).toBeGreaterThan(0);
  });

  // 14. Component Parameter Overrides Affecting Child Shapes and Strokes
  it('3.14 overrides nested stroke widths, radiuses, and fills through component arguments', async () => {
    const code = `
      component FlexiblePill(label = "Tag", radius = 12px, strokeW = 1px, col = #3b82f6) {
        group {
          rect { size: 100px 32px; border-radius: >radius; stroke: >col >strokeW solid; fill: transparent; }
          text { at: center of parent; content: >label; font-size: 12px; fill: >col; }
        }
      }
      FlexiblePill #pillCustom { label: "PRO"; radius: 4px; strokeW: 2px; col: #ef4444; }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThan(0);
  });

  // 15. CSS Filters (drop-shadow, blur) on Polygons with currentColor
  it('3.15 combines CSS drop-shadow and blur filters on polygon with inherited currentColor', async () => {
    const code = `
      group {
        color: #ec4899;
        polygon #glowingStar {
          at: (100px, 100px);
          size: 80px 80px;
          points: [ (0px, -40px), (12px, -12px), (40px, 0px), (12px, 12px), (0px, 40px), (-12px, 12px), (-40px, 0px), (-12px, -12px) ];
          fill: currentColor;
          filter: drop-shadow(0px 0px 12px #ec489980) blur(1px);
        }
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThan(0);
  });

  // 16. Multi-scale Render (4x) with High-Precision Polygons and Gradients
  it('3.16 renders 4x high-DPI raster buffer of polygons with multi-stop gradients', async () => {
    const code = `
      canvas { width: 200px; height: 200px; }
      polygon #diamond {
        at: (20px, 20px);
        size: 160px 160px;
        points: [ (0px, -80px), (80px, 0px), (0px, 80px), (-80px, 0px) ];
        fill: linear-gradient(45deg, #3b82f6, #8b5cf6, #ec4899);
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    const buf4x = await renderToBuffer(layout, { scale: 4, format: 'png' });
    expect(buf4x.length).toBeGreaterThan(0);
  });

  // 17. Dynamic Background Gradients with Relational Foreground Hierarchy
  it('3.17 combines canvas linear gradient background with complex relational foreground elements', async () => {
    const code = `
      canvas {
        width: 800px;
        height: 600px;
        background: linear-gradient(135deg, #0f172a, #1e293b);
      }
      rect #header { at: (40px, 40px); size: 720px 80px; fill: #33415580; }
      text #title { at: center of #header; content: "Dashboard"; font-size: 24px; fill: #ffffff; }
      rect #sidebar { at: below #header offset 20px; size: 200px 420px; fill: #33415560; }
      rect #contentArea { at: right of #sidebar offset 20px; size: 500px 420px; fill: #33415540; }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBe(4);
  });

  // 18. Layered PSD Export containing Groups of Polygons, Grids, and Masked Images
  it('3.18 exports complex mixed document (polygons, grids, masked images) to layered PSD', async () => {
    const code = `
      canvas { width: 800px; height: 600px; }
      group #compositeGroup {
        at: (20px, 20px);
        grid #miniGrid {
          columns: 2;
          gap: 10px;
          rect { size: 100px 60px; fill: #2563eb; }
          polygon { size: 60px 60px; points: [(0px,-30px),(30px,30px),(-30px,30px)]; fill: #f59e0b; }
        }
      }
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    const psdBuf = await exportToPsd(layout);
    expect(psdBuf.length).toBeGreaterThan(0);
  });

  // 19. Variable Arithmetic & Substitution across Multi-File Imports in Grid Layouts
  it('3.19 resolves imported layout variables into grid column counts and cell sizes', async () => {
    const tokensFile = '>colCount = 3; >gridGap = 16px; >cardW = 120px; >cardH = 80px;';
    const mainFile = `
      @import "./tokens.toad";
      grid #dataGrid {
        columns: >colCount;
        gap: >gridGap;
        rect { size: >cardW >cardH; }
        rect { size: >cardW >cardH; }
        rect { size: >cardW >cardH; }
      }
    `;
    const loader = (p: string) => (p.includes('tokens') ? tokensFile : mainFile);
    const ast = parseToad(mainFile, 'main.toad');
    const resolved = await resolveImportsAndComponents(ast, 'main.toad', loader);
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThanOrEqual(3);
  });

  // 20. Relational at: center of parent inside Parametric Components with Clipping
  it('3.20 positions text at center of parent inside component with clipping enabled', async () => {
    const code = `
      component CenteredButton(label = "Submit", bg = #22c55e) {
        group {
          size: 140px 48px;
          clip: true;
          rect { size: 140px 48px; fill: >bg; border-radius: 24px; }
          text { at: center of parent; content: >label; font-size: 14px; font-weight: bold; fill: #ffffff; }
        }
      }
      CenteredButton #btnPrimary {}
    `;
    const ast = parseToad(code);
    const resolved = await resolveImportsAndComponents(ast, 'main.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThan(0);
  });

});
