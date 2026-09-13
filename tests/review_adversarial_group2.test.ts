import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { lintDocument } from '../src/tools/linter.js';
import { safeEvaluateMath, solveLayout } from '../src/parser/math.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { parsePdfColor } from '../src/engine/pdfExporter.js';
import { compileToad } from '../src/build.js';
import * as path from 'path';
import * as fs from 'fs';

describe('Adversarial Review — Gruppe 2 Verification', () => {
  it('F-22: safeEvaluateMath emits diagnostic warning on division by zero', () => {
    const warnings: string[] = [];
    const val = safeEvaluateMath('100 / 0', warnings);
    expect(val).toBe(0);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0]).toContain('Division by zero');
  });

  it('F-23: Single-line text with overflow: ellipsis and bounded width applies truncation', async () => {
    const code = `
      canvas {
        size: 300px 200px;
        text #headline {
          content: "SupercalifragilisticexpialidociousLongUnbrokenTitle";
          width: 100px;
          overflow: ellipsis;
          font-size: 16px;
        }
      }
    `;
    const doc = parseToad(code, 'ellipsis_test.toad');
    const resolved = await resolveImportsAndComponents(doc, 'ellipsis_test.toad', () => '');
    const layout = await solveLayout(resolved);
    const node = layout.nodes.find(n => n.id === 'headline');
    expect(node).toBeDefined();
    expect(node?.textLayout?.lines?.[0]).toContain('…');
  });

  it('F-42: Linter KNOWN_UNITS recognizes ch and ex typography units', () => {
    const code = `
      canvas {
        size: 40ch 20ex;
        rect #box {
          size: 20ch 10ex;
        }
      }
    `;
    const doc = parseToad(code);
    const diags = lintDocument(doc);
    const unitDiags = diags.filter(d => d.code === 'LINT-UNKNOWN-UNIT');
    expect(unitDiags.length).toBe(0);
  });

  it('F-43: parsePdfColor parses modern slash alpha notation and device-cmyk', () => {
    const cmyk1 = parsePdfColor('cmyk(0 0 0 1 / 0.5)');
    expect(cmyk1.mode).toBe('cmyk');
    expect(cmyk1.k).toBe(1);
    expect(cmyk1.opacity).toBe(0.5);

    const cmyk2 = parsePdfColor('device-cmyk(0.2, 0.4, 0.6, 0.8 / 75%)');
    expect(cmyk2.mode).toBe('cmyk');
    expect(cmyk2.c).toBeCloseTo(0.2);
    expect(cmyk2.m).toBeCloseTo(0.4);
    expect(cmyk2.y).toBeCloseTo(0.6);
    expect(cmyk2.k).toBeCloseTo(0.8);
    expect(cmyk2.opacity).toBe(0.75);
  });

  it('F-44: Parser accepts uppercase RGB and RGBA function calls', () => {
    const code = `
      canvas {
        size: 200px 200px;
        rect #box {
          fill: RGB(255, 128, 0);
          stroke: RGBA(0, 0, 255, 0.5);
        }
      }
    `;
    const doc = parseToad(code);
    expect(doc.diagnostics?.length || 0).toBe(0);
    const elem = (doc.canvas?.elements || doc.elements)[0] as any;
    expect(elem.properties).toBeDefined();
  });

  it('F-10: Stack circular hug/fill does not force arbitrary 32px on empty elements', async () => {
    const code = `
      canvas {
        size: 500px 500px;
        stack #row {
          direction: horizontal;
          size: hug hug;
          group #zeroBox {
            size: fill fill;
          }
        }
      }
    `;
    const doc = parseToad(code, 'hug_fill.toad');
    const resolved = await resolveImportsAndComponents(doc, 'hug_fill.toad', () => '');
    const layout = await solveLayout(resolved);
    const row = layout.nodes.find(n => n.id === 'row');
    expect(row).toBeDefined();
    expect(row?.width).toBe(0);
  });

  it('F-02: compileToad passes scale down to PDF export buffer', async () => {
    const tmpDir = path.resolve('tests/dist/pdf_scale_test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const toadFile = path.join(tmpDir, 'test.toad');
    fs.writeFileSync(toadFile, 'canvas { size: 200px 200px; background: #ff0000; }');

    const result = await compileToad(toadFile, {
      format: 'pdf',
      scale: 2,
      outDir: tmpDir
    });

    expect(result.success).toBe(true);
    const pdfFile = result.outputFiles.find(f => f.endsWith('.pdf'));
    expect(pdfFile).toBeDefined();
    const content = fs.readFileSync(pdfFile!, 'utf-8');
    // MediaBox at scale 2x of 200x200 should be 400.00
    expect(content).toContain('/MediaBox [0 0 400.00 400.00]');
  });
});
