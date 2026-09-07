import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { auditDesign, formatTerminalReport, formatFixesSection } from '../src/tools/designAuditor.js';
import { BuildResult } from '../src/build.js';

describe('Design Auditor & Report (Feature 3)', () => {
  it('detects low contrast text and anti-slop centered prose', async () => {
    const src = `
      canvas { size: 600px 400px; background: #ffffff; }
      rect #bgCard {
        at: 20px 20px;
        size: 500px 300px;
        fill: #f0f0f0;
        
        // Low contrast: light gray text on #f0f0f0 background
        text #lowContrastText {
          at: 10px 10px;
          content: "Schwer lesbarer Text";
          font-size: 14px;
          color: #cccccc;
        }

        // Centered multi-line body text (Anti-AI Slop rule SLOP-TYPE-002)
        text #slopCenteredText {
          at: 10px 60px;
          size: 200px;
          align: center;
          content: "Dies ist ein sehr langer Fliesstext mit mehreren Zeilen Text der mittig ausgerichtet wurde und dadurch schwer zu lesen ist.";
          font-size: 14px;
          color: #111111;
        }
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const layout = await solveLayout(resolved);

    const mockBuildResult: BuildResult = {
      success: true,
      entryPath: 'inline.toad',
      outputFiles: [],
      layout,
      canvas: layout.canvas,
      dependencies: [],
      warnings: [],
      durationMs: 10
    };

    const audit = auditDesign(mockBuildResult);

    expect(audit.score).toBeLessThan(100);
    expect(audit.issues.length).toBeGreaterThan(0);

    const contrastIssue = audit.issues.find(i => i.category === 'contrast' && i.elementId === 'lowContrastText');
    expect(contrastIssue).toBeDefined();
    expect(contrastIssue?.type).toBe('error');

    const slopIssue = audit.issues.find(i => i.category === 'anti-slop' && i.elementId === 'slopCenteredText');
    expect(slopIssue).toBeDefined();

    const reportOutput = formatTerminalReport(audit);
    expect(reportOutput).toContain('TOAD DESIGN');
    expect(reportOutput).toContain('lowContrastText');
  });

  it('awards high score to clean, accessible designs', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      rect #card {
        at: 50px 50px;
        size: 700px 500px;
        fill: #000000;
        radius: 8px;

        text #headline {
          at: 40px 40px;
          content: "Hochkontrast Titel";
          font-size: 32px;
          font-weight: 700;
          color: #ffffff;
        }

        text #bodyText {
          at: 40px below #headline offset 20px;
          size: 500px;
          content: "Sauber linksbündiger Fließtext mit 21:1 Kontrastverhältnis.";
          font-size: 16px;
          line-height: 24px;
          color: #ffffff;
          align: left;
        }
      }
    `;

    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'inline.toad');
    const layout = await solveLayout(resolved);

    const mockBuildResult: BuildResult = {
      success: true,
      entryPath: 'clean.toad',
      outputFiles: [],
      layout,
      canvas: layout.canvas,
      dependencies: [],
      warnings: [],
      durationMs: 8
    };

    const audit = auditDesign(mockBuildResult);
    expect(audit.score).toBe(100);
    expect(audit.issues.filter(i => i.type === 'error').length).toBe(0);

    const report = formatTerminalReport(audit);
    expect(report).toContain('100');
    expect(report).toContain('All heuristics passed cleanly');
  });

  it('calculates APCA Lightness Contrast and detects micro-text', async () => {
    const src = `
      canvas { size: 600px 400px; background: #ffffff; }
      text #microText {
        at: 20px 20px;
        content: "Winziger Text";
        font-size: 8px;
        color: #111111;
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'apca.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'apca.toad' });

    const microIssue = audit.issues.find(i => i.code === 'A11Y-MICRO-TEXT');
    expect(microIssue).toBeDefined();
    expect(microIssue?.severity).toBe('warn');
  });

  it('detects Anti-AI-Slop Purple Haze on dark background (SLOP-WEB-001)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #000000; }
      circle #purpleHaze {
        at: 100px 100px;
        size: 300px;
        fill: #8b5cf6;
        filter: blur(50px);
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'purple.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'purple.toad' });

    const haze = audit.issues.find(i => i.code === 'SLOP-WEB-001');
    expect(haze).toBeDefined();
    expect(haze?.severity).toBe('error');
  });

  it('detects Anti-AI-Slop generic buzzwords (SLOP-WEB-003)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #hero {
        at: 40px 40px;
        content: "Supercharge your workflow with next-gen synergy";
        font-size: 24px;
        color: #111111;
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'buzz.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'buzz.toad' });

    const buzz = audit.issues.find(i => i.code === 'SLOP-WEB-003');
    expect(buzz).toBeDefined();
    expect(buzz?.message).toContain('Supercharge');
  });

  it('detects cheap system emoji icon substitution (SLOP-CODE-005)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #emojiTitle {
        at: 40px 40px;
        content: "🚀 Launch Now";
        font-size: 20px;
        color: #111111;
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'emoji.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'emoji.toad' });

    const emojiIssue = audit.issues.find(i => i.code === 'SLOP-CODE-005');
    expect(emojiIssue).toBeDefined();
  });

  it('detects soap-bar corner radii overkill on compact cards (SLOP-WEB-007)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      rect #soapCard {
        at: 40px 40px;
        size: 200px 80px;
        fill: #222222;
        radius: 36px;
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'soap.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'soap.toad' });

    const soapIssue = audit.issues.find(i => i.code === 'SLOP-WEB-007');
    expect(soapIssue).toBeDefined();
  });

  it('detects unspaced all-caps squeeze (SLOP-TYPE-004)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #capsText {
        at: 40px 40px;
        content: "SPECIAL ANNOUNCEMENT";
        font-size: 14px;
        color: #111111;
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'caps.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'caps.toad' });

    const capsIssue = audit.issues.find(i => i.code === 'SLOP-TYPE-004');
    expect(capsIssue).toBeDefined();
  });

  it('supports --json, verbose, and slop-only formatting', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #capsText {
        at: 40px 40px;
        content: "ANNOUNCEMENT";
        font-size: 14px;
        color: #111111;
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'test.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'test.toad' });

    const slopOnlyRep = formatTerminalReport(audit, { slopOnly: true });
    expect(slopOnlyRep).toContain('Anti-AI-Slop Scanner');
    expect(slopOnlyRep).not.toContain('Print & Prepress Safety');

    expect(audit.metrics).toBeDefined();
    expect(audit.metrics.negativeSpacePercent).toBeGreaterThanOrEqual(0);
    expect(audit.metrics.distinctFontFamilies).toBeDefined();
  });

  it('supports hiding fixes section until requested (interactive mode / showFixes: false)', async () => {
    const src = `
      canvas { size: 600px 400px; background: #ffffff; }
      text #lowContrast {
        at: 20px 20px;
        content: "Bad contrast text";
        font-size: 14px;
        color: #e0e0e0;
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'fixes_test.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'fixes_test.toad' });

    // When showFixes is false
    const reportWithoutFixes = formatTerminalReport(audit, { showFixes: false });
    expect(reportWithoutFixes).toContain('Handlungsempfehlungen & Quick-Fixes');
    expect(reportWithoutFixes).toContain('Quick-Fixes verfügbar');
    expect(reportWithoutFixes).not.toContain('💡 QUICK FIX:');

    // formatFixesSection explicitly outputs them
    const fixesOnly = formatFixesSection(audit);
    expect(fixesOnly).toContain('💡 QUICK FIX:');
    expect(fixesOnly).toContain('Befunde & Handlungsempfehlungen');
  });
});
