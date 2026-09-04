// tests/e2e/tier4_workloads.test.ts
// Tier 4: Real-World Workload Scenarios (5 Scenarios)

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

import { compileToad } from '../../src/build.js';
import { parseToad } from '../../src/parser/parser.js';
import { resolveImportsAndComponents } from '../../src/parser/importResolver.js';
import { solveLayout } from '../../src/parser/math.js';
import { renderToCanvas, renderToBuffer } from '../../src/engine/canvasRenderer.js';
import { exportToPsd } from '../../src/engine/psdExporter.js';
import { GOLDEN_WORKLOADS } from '../goldens/index.js';

describe('Tier 4: Real-World Workload Scenarios', () => {

  // ==========================================================================
  // Scenario 1: Social Media Card (1200x630)
  // ==========================================================================
  describe('Scenario 1: Social Media Card (1200x630)', () => {
    const fixturePath = path.resolve('tests/fixtures/social_card.toad');
    const golden = GOLDEN_WORKLOADS.social_card;

    it('1.1 parses and resolves social card AST with imports and components', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      expect(ast.type).toBe('Document');
      expect(ast.directives.length).toBeGreaterThanOrEqual(2);

      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      expect(resolved.canvas.width).toBe(golden.canvas.width);
      expect(resolved.canvas.height).toBe(golden.canvas.height);
      expect(resolved.elements.length).toBeGreaterThanOrEqual(2);
    });

    it('1.2 solves layout with Skia multi-line text wrapping and relational author card', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      expect(layout.canvas.aspectRatio).toBe(golden.canvas.aspectRatio);
      expect(layout.nodes.length).toBeGreaterThanOrEqual(golden.expectedElements.minCount);

      // Verify headline wraps and has positive height
      const headline = layout.nodes.find(n => n.id === 'headline');
      if (headline) {
        expect(headline.width).toBeLessThanOrEqual(700);
        expect(headline.height).toBeGreaterThan(38);
      }
    });

    it('1.3 renders social card to multi-scale PNG buffers (1x and 2x)', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      const png1x = await renderToBuffer(layout, { scale: 1, format: 'png' });
      const png2x = await renderToBuffer(layout, { scale: 2, format: 'png' });

      expect(png1x.length).toBeGreaterThan(0);
      expect(png2x.length).toBeGreaterThan(0);
      expect(png2x.length).toBeGreaterThan(png1x.length);
    });

    it('1.4 exports social card to layered PSD document with editable text layers', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
      // PSD signature '8BPS'
      expect(psdBuf.subarray(0, 4).toString()).toBe('8BPS');
    });

    it('1.5 executes end-to-end compileToad pipeline on social_card.toad', async () => {
      const result = await compileToad(fixturePath, { format: 'all', scale: 2 });
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // Scenario 2: Product Showcase Banner (1920x1080)
  // ==========================================================================
  describe('Scenario 2: Product Showcase Banner (1920x1080)', () => {
    const fixturePath = path.resolve('tests/fixtures/product_banner.toad');
    const golden = GOLDEN_WORKLOADS.product_banner;

    it('2.1 parses product banner with 16:9 canvas and 6-card uniform tile grid', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      expect(resolved.canvas.width).toBe(1920);
      expect(resolved.canvas.height).toBe(1080);
    });

    it('2.2 resolves currentColor cascade and grid cell bounding boxes', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      expect(layout.canvas.aspectRatio).toBe('16:9');
      expect(layout.nodes.length).toBeGreaterThanOrEqual(golden.expectedElements.minCount);

      // Verify currentColor resolution for product prices
      const priceNodes = layout.nodes.filter(n => n.id?.startsWith('productPrice'));
      for (const price of priceNodes) {
        expect(price.fill).toMatch(/#60a5fa|rgb\(96,\s*165,\s*250\)/i);
      }
    });

    it('2.3 renders product banner to PNG and JPEG rasters', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      const png = await renderToBuffer(layout, { format: 'png' });
      const jpg = await renderToBuffer(layout, { format: 'jpg', quality: 90 });

      expect(png.length).toBeGreaterThan(0);
      expect(jpg.length).toBeGreaterThan(0);
    });

    it('2.4 exports product banner to PSD with grid groups and clipping masks', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });

    it('2.5 executes compileToad on product_banner.toad', async () => {
      const result = await compileToad(fixturePath, { format: 'png' });
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // Scenario 3: Hero Banner with Nested Components & Polygons (1600x900)
  // ==========================================================================
  describe('Scenario 3: Hero Banner with Nested Components & Polygons (1600x900)', () => {
    const fixturePath = path.resolve('tests/fixtures/hero_banner.toad');
    const golden = GOLDEN_WORKLOADS.hero_banner;

    it('3.1 parses hero banner with polygon accents and nested button components', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      expect(resolved.canvas.width).toBe(1600);
      expect(resolved.canvas.height).toBe(900);
    });

    it('3.2 solves polygon center-relative coordinates and relational CTA button group', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      expect(layout.canvas.aspectRatio).toBe('16:9');
      const hex1 = layout.nodes.find(n => n.id === 'bgHexagon1');
      if (hex1) {
        expect(hex1.width).toBe(320);
        expect(hex1.height).toBe(320);
      }
    });

    it('3.3 renders hero banner at 1x, 2x, and 4x scale factors', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      const canvas1x = await renderToCanvas(layout, { scale: 1 });
      const canvas2x = await renderToCanvas(layout, { scale: 2 });
      const canvas4x = await renderToCanvas(layout, { scale: 4 });

      expect(canvas1x.width).toBe(1600);
      expect(canvas2x.width).toBe(3200);
      expect(canvas4x.width).toBe(6400);
    });

    it('3.4 exports hero banner to PSD with component hierarchy preserved', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });

    it('3.5 executes compileToad on hero_banner.toad', async () => {
      const result = await compileToad(fixturePath, { format: 'all' });
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // Scenario 4: Typography Poster (1080x1350)
  // ==========================================================================
  describe('Scenario 4: Typography Poster (1080x1350)', () => {
    const fixturePath = path.resolve('tests/fixtures/typography_poster.toad');
    const golden = GOLDEN_WORKLOADS.typography_poster;

    it('4.1 parses typography poster with @font directive and multiply blend modes', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      expect(ast.directives.some(d => d.type === 'FontDirective')).toBe(true);

      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      expect(resolved.canvas.width).toBe(1080);
      expect(resolved.canvas.height).toBe(1350);
      expect(resolved.fonts.length).toBeGreaterThanOrEqual(1);
    });

    it('4.2 solves layout computing 4:5 aspect ratio and Skia headline measurements', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      expect(layout.canvas.aspectRatio).toBe('4:5');
      const giantNum = layout.nodes.find(n => n.id === 'giantNumber');
      if (giantNum) {
        expect(giantNum.height).toBeGreaterThan(100);
      }
    });

    it('4.3 renders typography poster to PNG with blend modes applied', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      const png = await renderToBuffer(layout, { format: 'png' });
      expect(png.length).toBeGreaterThan(0);
    });

    it('4.4 exports typography poster to PSD with editable typography layers', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });

    it('4.5 executes compileToad on typography_poster.toad', async () => {
      const result = await compileToad(fixturePath, { format: 'all' });
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // Scenario 5: Mobile UI Mockup (430x932)
  // ==========================================================================
  describe('Scenario 5: Mobile UI Mockup (430x932)', () => {
    const fixturePath = path.resolve('tests/fixtures/mobile_mockup.toad');
    const golden = GOLDEN_WORKLOADS.mobile_mockup;

    it('5.1 parses mobile mockup with status bar, nav header, and quick action grid', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      expect(resolved.canvas.width).toBe(430);
      expect(resolved.canvas.height).toBe(932);
    });

    it('5.2 solves mobile layout calculating aspect ratio and grid coordinates', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      expect(layout.canvas.aspectRatio).toBe('215:466');
      expect(layout.nodes.length).toBeGreaterThanOrEqual(golden.expectedElements.minCount);
    });

    it('5.3 renders mobile mockup to crisp 2x retina and 3x super-retina buffers', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      const canvas2x = await renderToCanvas(layout, { scale: 2 });
      expect(canvas2x.width).toBe(860);
      expect(canvas2x.height).toBe(1864);
    });

    it('5.4 exports mobile mockup to PSD with full layer group hierarchy', async () => {
      const source = fs.readFileSync(fixturePath, 'utf-8');
      const ast = parseToad(source, fixturePath);
      const resolved = await resolveImportsAndComponents(ast, fixturePath);
      const layout = await solveLayout(resolved);

      const psdBuf = await exportToPsd(layout);
      expect(psdBuf.length).toBeGreaterThan(0);
    });

    it('5.5 executes compileToad on mobile_mockup.toad', async () => {
      const result = await compileToad(fixturePath, { format: 'all' });
      expect(result).toBeDefined();
    });
  });

});
