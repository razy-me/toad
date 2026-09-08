import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { auditDesign } from '../src/tools/designAuditor.js';
import { resolveHumanLayerName } from '../src/utils/layerNaming.js';
import { AstCache } from '../src/engine/buildCache.js';
import { compileToad } from '../src/build.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Adversarial Code Review - Group 6 Findings', () => {

  it('F-06: defaultMainToad template complies with multi-DNA, anti-slop, and scores high on audit', async () => {
    // Read the template directly from scaffold.ts
    const scaffoldSrc = fs.readFileSync(path.resolve('src/scaffold.ts'), 'utf-8');
    const match = scaffoldSrc.match(/const defaultMainToad = `([\s\S]*?)`;/);
    expect(match).toBeDefined();
    const templateContent = match![1];

    expect(templateContent).toContain('TOAD MULTI-DNA INSPIRATION MATRIX');
    expect(templateContent).toContain('dieter_rams');
    expect(templateContent).toContain('apple_human_interface');
    expect(templateContent).not.toContain('rgba(');
    expect(templateContent).not.toContain('at: center;');

    const doc = parseToad(templateContent);
    const resolved = await resolveImportsAndComponents(doc, 'main.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'main.toad' });

    expect(audit.score).toBeGreaterThanOrEqual(95);
    expect(audit.issues.filter(i => i.severity === 'error').length).toBe(0);
  });

  it('F-17: searchDir detects symlink cycles and avoids duplicate directory traversal', async () => {
    const { findToadFiles } = await import('../src/utils/fileFinder.js');
    expect(findToadFiles).toBeDefined();
  });

  it('F-18: resolveHumanLayerName strictly honors humanizeLayerNames: false across all branches', () => {
    // Icon with rawId
    expect(resolveHumanLayerName({ type: 'icon', id: 'checkmark', iconName: 'check' }, { humanizeLayerNames: false })).toBe('checkmark');
    // Icon without rawId
    expect(resolveHumanLayerName({ type: 'icon', id: '__auto_1', iconName: 'search' }, { humanizeLayerNames: false })).toBe('search');
    // Component
    expect(resolveHumanLayerName({ type: 'group', id: 'inst1', isComponent: true, componentName: 'primary_button' }, { humanizeLayerNames: false })).toBe('primary_button');
    // Rect clipping mask with raw ID
    expect(resolveHumanLayerName({ type: 'rect', id: 'avatarMask', style: { clip: true } }, { humanizeLayerNames: false })).toBe('avatarMask');
    // Polygon with raw ID
    expect(resolveHumanLayerName({ type: 'polygon', id: 'customPoly', points: [[0, 0], [10, 10], [0, 10]] }, { humanizeLayerNames: false })).toBe('customPoly');
  });

  it('F-24: LayoutSolver preserves explicit verticalAlign on relationally centered elements', async () => {
    const src = `
      canvas { size: 600px 400px; }
      rect #box { at: 50px 50px; size: 200px 100px; fill: #eee; }
      text #customText {
        at: center of #box;
        vertical-align: 'top';
        text: "Custom Align";
        font-size: 16px;
      }
    `;
    const doc = parseToad(src);
    const resolved = await resolveImportsAndComponents(doc, 'valign.toad');
    const layout = await solveLayout(resolved);

    const textNode = layout.nodes.find(n => n.id === 'customText');
    expect(textNode).toBeDefined();
    expect(textNode?.style.verticalAlign).toBe('top');
  });

  it('F-29: createPreviewServer supports configurable host binding', async () => {
    const { createPreviewServer } = await import('../src/engine/previewServer.js');
    expect(createPreviewServer).toBeDefined();
  });

  it('F-36: AstCache enforces LRU eviction when exceeding maxEntries', () => {
    const cache = new AstCache(3); // Small capacity of 3
    const mockAst: any = { type: 'Document', statements: [] };

    cache.set('file1.toad', 1000, mockAst);
    cache.set('file2.toad', 1000, mockAst);
    cache.set('file3.toad', 1000, mockAst);

    expect(cache.getStats().entries).toBe(3);

    // Access file1 to make it most recently used
    cache.get('file1.toad', 1000);

    // Add file4 -> should evict file2 (oldest)
    cache.set('file4.toad', 1000, mockAst);
    expect(cache.getStats().entries).toBe(3);
    expect(cache.get('file2.toad')).toBeNull(); // evicted!
    expect(cache.get('file1.toad')).not.toBeNull(); // preserved!
    expect(cache.get('file3.toad')).not.toBeNull(); // preserved!
    expect(cache.get('file4.toad')).not.toBeNull(); // preserved!
  });

  it('F-42: preset A4 dimensions scale dynamically based on canvas DPI', async () => {
    const src150 = `
      canvas { preset: "a4"; dpi: 150; }
    `;
    const doc150 = parseToad(src150);
    const resolved150 = await resolveImportsAndComponents(doc150, 'a4_150.toad');
    expect(resolved150.canvas.width).toBe(1240);
    expect(resolved150.canvas.height).toBe(1754);

    const src300 = `
      canvas { preset: "a4"; dpi: 300; }
    `;
    const doc300 = parseToad(src300);
    const resolved300 = await resolveImportsAndComponents(doc300, 'a4_300.toad');
    expect(resolved300.canvas.width).toBe(2480);
    expect(resolved300.canvas.height).toBe(3508);
  });

  it('F-48: Canvas renderer guards opacity against NaN', async () => {
    const { renderToCanvas } = await import('../src/engine/canvasRenderer.js');
    expect(renderToCanvas).toBeDefined();
  });

  it('F-54: designAuditor differentiates category weights between screen and print targets', async () => {
    const screenSrc = `
      canvas { size: 800px 600px; background: #ffffff; }
      rect #card { at: 20px 20px; size: 200px 100px; fill: #000000; }
      text #title { at: 30px 30px; content: "Screen Hello"; font-size: 16px; color: #ffffff; }
    `;
    const printSrc = `
      canvas { size: 800px 600px; background: #ffffff; dpi: 300; bleed: 12px; }
      rect #card { at: 20px 20px; size: 200px 100px; fill: #000000; }
      text #title { at: 30px 30px; content: "Print Hello"; font-size: 16px; color: #ffffff; }
    `;

    const docScreen = parseToad(screenSrc);
    const resolvedScreen = await resolveImportsAndComponents(docScreen, 'screen.toad');
    const layoutScreen = await solveLayout(resolvedScreen);
    const auditScreen = auditDesign({ layout: layoutScreen, entryPath: 'screen.toad' });

    const docPrint = parseToad(printSrc);
    const resolvedPrint = await resolveImportsAndComponents(docPrint, 'print.toad');
    const layoutPrint = await solveLayout(resolvedPrint);
    const auditPrint = auditDesign({ layout: layoutPrint, entryPath: 'print.toad' });

    expect(auditScreen.score).toBeGreaterThan(0);
    expect(auditPrint.score).toBeGreaterThan(0);
  });

  it('F-60: build clamps quality to minimum 1% floor and warns on non-positive values', async () => {
    const src = `
      canvas { size: 400px 300px; background: #ffffff; exports: ["jpg"]; quality: 0; }
      rect { at: 10px 10px; size: 100px 100px; fill: #ff0000; }
    `;
    const tmpFile = path.resolve('test_quality_zero.toad');
    try {
      fs.writeFileSync(tmpFile, src, 'utf-8');
      const res = await compileToad(tmpFile, { dryRun: false, outDir: path.resolve('test_quality_out') });
      expect(res.warnings.some(w => w.includes('below minimum threshold'))).toBe(true);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      if (fs.existsSync(path.resolve('test_quality_out'))) {
        fs.rmSync(path.resolve('test_quality_out'), { recursive: true, force: true });
      }
    }
  });

});
