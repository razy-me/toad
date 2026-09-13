import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { solveLayout, findNode, computeAspectRatio } from '../src/parser/math.js';
import { resolveImportsAndComponents, CircularImportError } from '../src/parser/importResolver.js';
import { registerIcon, hasIcon, getIconPath, unregisterIcon, clearCustomIcons } from '../src/engine/iconRegistry.js';
import { formatToad } from '../src/tools/formatter.js';
import { lintDocument } from '../src/tools/linter.js';
import { auditDesign, formatTerminalReport } from '../src/tools/designAuditor.js';

describe('Adversarial Review — Gruppe 3 Verification', () => {
  it('F-03: findNode helper recursively discovers deeply nested nodes without array monkey patching', async () => {
    const code = `
      canvas {
        size: 500px 500px;
        stack #container {
          direction: vertical;
          stack #innerSubStack {
            direction: horizontal;
            rect #deepChild {
              size: 40px 40px;
              fill: #ff0000;
            }
          }
        }
      }
    `;
    const doc = parseToad(code);
    const resolved = await resolveImportsAndComponents(doc, 'tree_test.toad', () => '');
    const layout = await solveLayout(resolved);

    // Using exported findNode helper
    const found = findNode(layout, n => n.id === 'deepChild');
    expect(found).toBeDefined();
    expect(found?.width).toBe(40);

    // Verify native array behavior (spreading does not break search)
    const nativeSearch = [...layout.nodes].find(n => n.id === 'deepChild');
    expect(nativeSearch).toBeDefined();
    expect(nativeSearch?.id).toBe('deepChild');
  });

  it('F-11: registerIcon, hasIcon, and getIconPath support custom icon definitions', () => {
    const iconName = 'custom-brand-logo';
    const svgPath = 'M10 10 H90 V90 H10 Z';

    expect(hasIcon(iconName)).toBe(false);
    registerIcon(iconName, svgPath);

    expect(hasIcon(iconName)).toBe(true);
    expect(getIconPath(iconName)).toBe(svgPath);

    unregisterIcon(iconName);
    expect(hasIcon(iconName)).toBe(false);
    expect(getIconPath(iconName)).toBe('');

    registerIcon('temp-1', 'M0 0');
    registerIcon('temp-2', 'M1 1');
    clearCustomIcons();
    expect(hasIcon('temp-1')).toBe(false);
    expect(hasIcon('temp-2')).toBe(false);
  });

  it('F-12: Formatter normalizes whitespace around colons in ratio expressions', () => {
    const code = `canvas {\n  size: 1000px 500px;\n  ratio: 16 : 9;\n}`;
    const formatted = formatToad(code);
    expect(formatted).toContain('ratio: 16:9;');
  });

  it('F-25: Linter does not report LINT-UNUSED-IMPORT when at least one component from file is used', () => {
    const fileStore: Record<string, string> = {
      'd:/toad/tokens.toad': `
        component PrimaryBtn {
          rect { size: 100px 40px; fill: #0000ff; }
        }
        component SecondaryBtn {
          rect { size: 80px 30px; fill: #cccccc; }
        }
      `
    };

    const mainCode = `
      @import "./tokens.toad";
      canvas {
        size: 500px 500px;
        PrimaryBtn #btn {}
      }
    `;

    const mainDoc = parseToad(mainCode, 'd:/toad/main.toad');
    // Lint using dummy file read through existing parser
    const diags = lintDocument(mainDoc, 'd:/toad/main.toad');
    const unusedImports = diags.filter(d => d.code === 'LINT-UNUSED-IMPORT');
    expect(unusedImports.length).toBe(0);
  });

  it('F-46: computeAspectRatio recognizes 4:5 and 5:4 social media formats', () => {
    // 1080 x 1350 is exactly 4:5 (Instagram portrait)
    const ar1 = computeAspectRatio(1080, 1350);
    expect(ar1.ratioString).toBe('4:5');

    // 1350 x 1080 is exactly 5:4
    const ar2 = computeAspectRatio(1350, 1080);
    expect(ar2.ratioString).toBe('5:4');
  });

  it('F-48: CircularImportError attaches source location and line details', async () => {
    const files: Record<string, string> = {
      'd:/test/a.toad': `@import "./b.toad";\ncanvas { size: 100px 100px; }`,
      'd:/test/b.toad': `@import "./c.toad";\ncanvas { size: 100px 100px; }`,
      'd:/test/c.toad': `@import "./a.toad";\ncanvas { size: 100px 100px; }`
    };
    const doc = parseToad(files['d:/test/a.toad']!, 'd:/test/a.toad');

    try {
      await resolveImportsAndComponents(doc, 'd:/test/a.toad', p => {
        const norm = p.replace(/\\/g, '/');
        const content = files[norm];
        if (!content) throw new Error(`Not found: ${norm}`);
        return content;
      });
      expect.fail('Expected CircularImportError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(CircularImportError);
      expect(err.message).toContain('Circular import detected');
      expect(err.message).toContain('line');
      expect(err.loc).toBeDefined();
      expect(err.loc?.start?.line).toBeGreaterThanOrEqual(1);
    }
  });

  it('F-45: Design auditor reports typographic points (pt) alongside pixels on print canvas', async () => {
    const code = `
      canvas {
        size: 210mm 297mm;
        dpi: 300;
        text #printHead {
          content: "Print Headline";
          font-size: 48px;
        }
      }
    `;
    const doc = parseToad(code, 'print.toad');
    const resolved = await resolveImportsAndComponents(doc, 'print.toad', () => '');
    const layout = await solveLayout(resolved);
    const report = auditDesign(layout, 'print.toad');
    const formatted = formatTerminalReport(report);

    expect(formatted).toContain('pt');
  });
});
