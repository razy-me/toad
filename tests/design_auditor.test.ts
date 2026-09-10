import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { auditDesign, formatTerminalReport, formatWarningsSection, formatFixesSection } from '../src/tools/designAuditor.js';
import { stripAnsi, copyToClipboard } from '../src/utils/clipboard.js';
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
          content: "This is a very long body paragraph spanning across multiple lines of text that is center aligned and thereby difficult to read.";
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
    expect(reportWithoutFixes).toContain('Actionable Recommendations & Quick-Fixes');
    expect(reportWithoutFixes).toContain('quick-fixes available');
    expect(reportWithoutFixes).not.toContain('💡 QUICK FIX:');

    // formatFixesSection explicitly outputs them
    const fixesOnly = formatFixesSection(audit);
    expect(fixesOnly).toContain('💡 QUICK FIX:');
    expect(fixesOnly).toContain('Findings & Actionable Recommendations');
  });

  it('outputs warnings / justifications for ratings < 100% separately from quick fixes', async () => {
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
    const resolved = await resolveImportsAndComponents(ast, 'two_stage_test.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'two_stage_test.toad' });

    // Step 1: formatWarningsSection outputs reasons/justifications for non-100% ratings without quick fix snippets
    const warningsSection = formatWarningsSection(audit, { standalone: true });
    expect(warningsSection).toContain('Justifications for Scores < 100%');
    expect(warningsSection).toContain('Accessibility & Contrast');
    expect(warningsSection).toContain('Justification:');
    expect(warningsSection).not.toContain('💡 QUICK FIX:');

    // Step 2: formatFixesSection outputs actionable solutions and code fixes
    const fixesSection = formatFixesSection(audit, { standalone: true });
    expect(fixesSection).toContain('💡 QUICK FIX:');
    expect(fixesSection).toContain('Action Plan');
  });

  it('strips ANSI escape codes cleanly for clipboard export', async () => {
    const colored = '\x1b[1m\x1b[32m✔ Clean\x1b[0m\x1b[39m - \x1b[31mError (-25 Pts)\x1b[0m';
    const plain = stripAnsi(colored);
    expect(plain).toBe('✔ Clean - Error (-25 Pts)');

    // copyToClipboard does not throw
    const success = await copyToClipboard(colored);
    expect(typeof success).toBe('boolean');
  });

  it('detects visual slop: Concentric Radii Mismatch (SLOP-GEOM-001)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      rect #parentCard {
        at: 40px 40px;
        size: 400px 300px;
        radius: 12px;
        fill: #f5f5f5;

        rect #childCard {
          at: 20px 20px;
          size: 200px 100px;
          radius: 16px; // Mismatch: child radius (16px) >= parent radius (12px)
          fill: #e5e5e5;
        }
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'geom.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'geom.toad' });

    const geomIssue = audit.issues.find(i => i.code === 'SLOP-GEOM-001');
    expect(geomIssue).toBeDefined();
    expect(geomIssue?.message).toContain('Concentric Radii Mismatch');
  });

  it('detects visual slop: Live-Pulse Beacon and Russian-Doll Nesting (SLOP-WEB-014, SLOP-WEB-015)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #000000; }
      circle #livePulse {
        at: 50px 30px;
        size: 10px;
        fill: #22c55e;
      }
      rect #cardLevel1 {
        at: 40px 60px;
        size: 500px 400px;
        radius: 12px;
        stroke: #333333;
        rect #cardLevel2 {
          at: 20px 20px;
          size: 440px 340px;
          radius: 8px;
          stroke: #444444;
          rect #cardLevel3 {
            at: 20px 20px;
            size: 380px 280px;
            radius: 4px;
            stroke: #555555;
          }
        }
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'nesting.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'nesting.toad' });

    const pulseIssue = audit.issues.find(i => i.code === 'SLOP-WEB-014');
    expect(pulseIssue).toBeDefined();

    const nestingIssue = audit.issues.find(i => i.code === 'SLOP-WEB-015');
    expect(nestingIssue).toBeDefined();
    expect(nestingIssue?.message).toContain('Russian-Doll Nesting');
  });

  it('detects visual slop: Megalithic Quote Monument, Swiss-Slop, and GPS Telemetry (SLOP-DECK-002, SLOP-PRINT-001, SLOP-PRINT-003)', async () => {
    const src = `
      canvas { size: 1000px 800px; background: #ffffff; }
      text #giantQuote {
        at: 50px 50px;
        content: "“";
        font-size: 96px;
        color: #cccccc;
      }
      text #swissRegMark {
        at: 50px 200px;
        content: "⌖";
        font-size: 18px;
        color: #000000;
      }
      text #fakeGps {
        at: 50px 300px;
        content: "LAT 35°41'22.1N LON 139°41'30.2E // SECTOR 07";
        font-size: 12px;
        color: #666666;
      }
    `;
    const ast = parseToad(src);
    const resolved = await resolveImportsAndComponents(ast, 'poster_slop.toad');
    const layout = await solveLayout(resolved);
    const audit = auditDesign({ layout, entryPath: 'poster_slop.toad' });

    const quoteIssue = audit.issues.find(i => i.code === 'SLOP-DECK-002');
    expect(quoteIssue).toBeDefined();

    const swissIssue = audit.issues.find(i => i.code === 'SLOP-PRINT-001');
    expect(swissIssue).toBeDefined();

    const gpsIssue = audit.issues.find(i => i.code === 'SLOP-PRINT-003');
    expect(gpsIssue).toBeDefined();
  });
});

