import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { auditDesign, formatTerminalReport } from '../src/tools/designAuditor.js';

async function auditSnippet(src: string, name = 'test.toad') {
  const ast = parseToad(src);
  const resolved = await resolveImportsAndComponents(ast, name);
  const layout = await solveLayout(resolved);
  return auditDesign({ layout, entryPath: name });
}

describe('Anti-AI-Slop Comprehensive Engine (All 26 Heuristics & Drastic Penalties)', () => {

  it('detects SLOP-GFX-003: Muddy Linear RGB Gradient Bleed (Complementary Hues)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      rect #muddyRect {
        at: 50px 50px;
        size: 400px 200px;
        // Direct two-stop complementary gradient (Blue #0055ff to Orange #ff8800: deltaHue ~180°)
        fill: "linear-gradient(to right, #0055ff, #ff8800)";
      }
    `;
    const audit = await auditSnippet(src);
    const issue = audit.issues.find(i => i.code === 'SLOP-GFX-003');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('Complementary gradient');
    // Fatal slop caps score at <= 78%
    expect(audit.score).toBeLessThanOrEqual(78);
    expect(audit.metrics.slopRiskLevel).toBe('high');
  });

  it('detects SLOP-WEB-001: Purple Haze Darkmode Syndrome', async () => {
    const src = `
      canvas { size: 800px 600px; background: #0a0a0a; }
      circle #ambientBlob {
        at: 200px 200px;
        size: 350px;
        fill: #8b5cf6;
        filter: blur(40px);
      }
    `;
    const audit = await auditSnippet(src);
    const issue = audit.issues.find(i => i.code === 'SLOP-WEB-001');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('error');
    expect(audit.score).toBeLessThanOrEqual(78);
  });

  it('detects SLOP-WEB-002: Meaningless Bento-Grid Overkill', async () => {
    const src = `
      canvas { size: 1000px 800px; background: #0f172a; }
      rect #card1 { at: 20px 20px; size: 200px 140px; fill: alpha(#ffffff, 0.05); radius: 16px; text { content: "Card 1"; } }
      rect #card2 { at: 240px 20px; size: 200px 140px; fill: alpha(#ffffff, 0.05); radius: 16px; text { content: "Card 2"; } }
      rect #card3 { at: 460px 20px; size: 200px 140px; fill: alpha(#ffffff, 0.05); radius: 16px; text { content: "Card 3"; } }
      rect #card4 { at: 680px 20px; size: 200px 140px; fill: alpha(#ffffff, 0.05); radius: 16px; text { content: "Card 4"; } }
      rect #card5 { at: 20px 180px; size: 200px 140px; fill: alpha(#ffffff, 0.05); radius: 16px; text { content: "Card 5"; } }
      rect #card6 { at: 240px 180px; size: 200px 140px; fill: alpha(#ffffff, 0.05); radius: 16px; text { content: "Card 6"; } }
    `;
    const audit = await auditSnippet(src);
    const issue = audit.issues.find(i => i.code === 'SLOP-WEB-002');
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('Bento Overkill');
  });

  it('detects SLOP-WEB-003: Buzzwords in English and German', async () => {
    const srcEN = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #h1 { at: 40px 40px; content: "Supercharge your workflow and unlock your full potential"; color: #000; font-size: 24px; }
    `;
    const auditEN = await auditSnippet(srcEN);
    const buzzEN = auditEN.issues.find(i => i.code === 'SLOP-WEB-003');
    expect(buzzEN).toBeDefined();
    expect(buzzEN?.severity).toBe('error');

    const srcDE = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #h1 { at: 40px 40px; content: "Revolutioniere deinen Arbeitsalltag mit nahtloser Synergie"; color: #000; font-size: 24px; }
    `;
    const auditDE = await auditSnippet(srcDE);
    const buzzDE = auditDE.issues.find(i => i.code === 'SLOP-WEB-003');
    expect(buzzDE).toBeDefined();
    expect(buzzDE?.message).toContain('Revolutioniere');
  });

  it('detects SLOP-WEB-004: Senseless Floating Geometric Debris (Confetti & Plus signs)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #confetti1 { at: 100px 100px; content: "+"; color: #888; font-size: 16px; }
      text #confetti2 { at: 500px 150px; content: "✕"; color: #888; font-size: 14px; }
    `;
    const audit = await auditSnippet(src);
    const debris = audit.issues.find(i => i.code === 'SLOP-WEB-004');
    expect(debris).toBeDefined();
    expect(debris?.message).toContain('debris');
  });

  it('detects SLOP-WEB-005: Rainbow Pill-Button Overload', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      rect #rainbowBtn {
        at: 50px 50px;
        size: 160px 44px;
        radius: 22px;
        fill: "linear-gradient(to right, #ec4899, #8b5cf6, #06b6d4)";
      }
    `;
    const audit = await auditSnippet(src);
    const rainbowIssue = audit.issues.find(i => i.code === 'SLOP-WEB-005');
    expect(rainbowIssue).toBeDefined();
    expect(rainbowIssue?.message).toContain('Rainbow neon gradient');
  });

  it('detects SLOP-WEB-007: Soap-Bar Radii Overkill', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      rect #soapCard {
        at: 50px 50px;
        size: 300px 140px;
        radius: 32px;
        fill: #111111;
      }
    `;
    const audit = await auditSnippet(src);
    const soapIssue = audit.issues.find(i => i.code === 'SLOP-WEB-007');
    expect(soapIssue).toBeDefined();
    expect(soapIssue?.message).toContain('Extreme soap-bar corner radius');
  });

  it('detects SLOP-WEB-009: Purposeless Left Border Stripe', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      rect #card {
        at: 50px 50px;
        size: 300px 200px;
        fill: #f5f5f5;
        // 4px narrow left accent stripe inside card
        rect #leftStripe {
          at: 0px 0px;
          size: 4px 200px;
          fill: #8b5cf6;
        }
      }
    `;
    const audit = await auditSnippet(src);
    const stripeIssue = audit.issues.find(i => i.code === 'SLOP-WEB-009');
    expect(stripeIssue).toBeDefined();
  });

  it('detects SLOP-WEB-012: Monotone Triplet Feature Clones', async () => {
    const src = `
      canvas { size: 900px 600px; background: #ffffff; }
      rect #f1 { at: 50px 100px; size: 240px 180px; fill: #eee; }
      rect #f2 { at: 320px 100px; size: 240px 180px; fill: #eee; }
      rect #f3 { at: 590px 100px; size: 240px 180px; fill: #eee; }
    `;
    const audit = await auditSnippet(src);
    const triplet = audit.issues.find(i => i.code === 'SLOP-WEB-012');
    expect(triplet).toBeDefined();
  });

  it('detects SLOP-TYPE-001: Inter/Roboto Monoculture', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #t1 { at: 20px 20px; font-family: "Inter"; font-size: 32px; content: "Title"; color: #000; }
      text #t2 { at: 20px 80px; font-family: "Inter"; font-size: 16px; content: "Subtitle paragraph"; color: #000; }
    `;
    const audit = await auditSnippet(src);
    const mono = audit.issues.find(i => i.code === 'SLOP-TYPE-001');
    expect(mono).toBeDefined();
  });

  it('detects SLOP-TYPE-002: Centered Multi-Line Body Text (Fatal Slop)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #body {
        at: 50px 50px;
        size: 300px;
        align: center;
        content: "Dies ist ein mehrzeiliger Text der unabsichtlich mittig ausgerichtet wurde und die Lesbarkeit drastisch verschlechtert weil das Auge keinen festen Zeilenanfang findet.";
        color: #000;
        font-size: 15px;
      }
    `;
    const audit = await auditSnippet(src);
    const issue = audit.issues.find(i => i.code === 'SLOP-TYPE-002');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('error');
    // Slop-Cap check
    expect(audit.score).toBeLessThanOrEqual(78);
  });

  it('detects SLOP-TYPE-009: Em-Dash Inflation (—)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #h1 { at: 40px 40px; content: "Scale faster — with no extra effort — using smart algorithms"; color: #000; font-size: 20px; }
    `;
    const audit = await auditSnippet(src);
    const emIssue = audit.issues.find(i => i.code === 'SLOP-TYPE-009');
    expect(emIssue).toBeDefined();
  });

  it('detects SLOP-TYPE-010: AI Sparkle Overuse (✨ / ✦)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #sparkleBadge { at: 40px 40px; content: "✨ AI Powered"; color: #000; font-size: 14px; }
    `;
    const audit = await auditSnippet(src);
    const sparkIssue = audit.issues.find(i => i.code === 'SLOP-TYPE-010');
    expect(sparkIssue).toBeDefined();
  });

  it('detects SLOP-COLOR-001: Cyberpunk / Discord Spectrum cliché', async () => {
    const src = `
      canvas { size: 800px 600px; background: #0f172a; }
      rect #e1 { at: 20px 20px; size: 50px 50px; fill: #6366f1; }
      rect #e2 { at: 80px 20px; size: 50px 50px; fill: #ec4899; }
      rect #e3 { at: 140px 20px; size: 50px 50px; fill: #06b6d4; }
      rect #e4 { at: 200px 20px; size: 50px 50px; fill: #8b5cf6; }
    `;
    const audit = await auditSnippet(src);
    const cyberIssue = audit.issues.find(i => i.code === 'SLOP-COLOR-001');
    expect(cyberIssue).toBeDefined();
  });

  it('detects SLOP-COLOR-002: Harsh Mud Drop Shadow', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      rect #cardWithHeavyShadow {
        at: 50px 50px;
        size: 300px 200px;
        fill: #ffffff;
        shadow: 0 12px 24px "rgba(0, 0, 0, 0.45)";
      }
    `;
    const audit = await auditSnippet(src);
    const shadowIssue = audit.issues.find(i => i.code === 'SLOP-COLOR-002');
    expect(shadowIssue).toBeDefined();
  });

  it('detects SLOP-ASSET-001: Placeholder domain and raw Unsplash params', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      image #heroImg {
        at: 50px 50px;
        size: 400px 200px;
        src: "https://images.unsplash.com/photo-12345?auto=format&fit=crop&w=800&q=80";
      }
    `;
    const audit = await auditSnippet(src);
    const assetIssue = audit.issues.find(i => i.code === 'SLOP-ASSET-001');
    expect(assetIssue).toBeDefined();
    expect(assetIssue?.severity).toBe('error');
  });

  it('detects SLOP-ASSET-004: Standard dummy contact remnants', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      text #contactInfo {
        at: 50px 50px;
        content: "Call us at +1 (555) 0199 or email support@example.com";
        color: #111;
        font-size: 14px;
      }
    `;
    const audit = await auditSnippet(src);
    const dummyIssue = audit.issues.find(i => i.code === 'SLOP-ASSET-004');
    expect(dummyIssue).toBeDefined();
  });

  it('detects SLOP-LOGO-004: Favicon micro-detail smear (< 1.5px lines)', async () => {
    const src = `
      canvas { size: 800px 600px; background: #ffffff; }
      group #companyLogo {
        at: 50px 50px;
        size: 100px 100px;
        path #fineVectorLine {
          stroke: #000;
          stroke-width: 0.8px;
          d: "M 10 10 L 90 90";
        }
      }
    `;
    const audit = await auditSnippet(src);
    const logoIssue = audit.issues.find(i => i.code === 'SLOP-LOGO-004');
    expect(logoIssue).toBeDefined();
    expect(logoIssue?.severity).toBe('error');
  });

  it('enforces drastic scoring penalties: multiple fatal slop drops score to Grade D', async () => {
    const src = `
      canvas { size: 800px 600px; background: #000000; }
      // Fatal 1: Purple Haze
      circle #haze { at: 100px 100px; size: 300px; fill: #8b5cf6; filter: blur(40px); }
      // Fatal 2: Muddy Gradient
      rect #mud { at: 50px 50px; size: 200px 100px; fill: "linear-gradient(to right, #0055ff, #ff8800)"; }
      // Fatal 3: Centered Multi-line Prose
      text #body {
        at: 50px 400px;
        size: 400px;
        align: center;
        content: "Supercharge your workflow with next-gen synergy across all channels and never worry again about efficiency.";
        color: #fff;
        font-size: 16px;
      }
    `;
    const audit = await auditSnippet(src);
    expect(audit.metrics.slopFatalCount).toBeGreaterThanOrEqual(2);
    expect(audit.metrics.slopRiskLevel).toBe('critical');
    // Multi-fatal slop caps score at <= 58% (Grade D)
    expect(audit.score).toBeLessThanOrEqual(58);
    expect(audit.grade).toBe('D');

    const report = formatTerminalReport(audit, { slopOnly: true });
    expect(report).toContain('CRITICAL SLOP');
    expect(report).toContain('SLOP-WEB-001');
    expect(report).toContain('SLOP-GFX-003');
  });

  it('awards 100% (Grade A+) and Slop-Free to authentic, disciplined designs', async () => {
    const src = `
      canvas { size: 1200px 900px; background: #f8f9fa; }
      rect #card {
        at: 100px 100px;
        size: 800px 500px;
        fill: #1e293b;
        radius: 8px;

        text #kicker {
          at: 48px 48px;
          content: "FINANZ-ARCHITEKTUR 2026";
          font-family: "Cabinet Grotesk";
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #f8fafc;
        }

        text #headline {
          at: 48px below #kicker offset 16px;
          content: "Automatisierte Buchhaltung für mittelständische Betriebe.";
          font-family: "Cabinet Grotesk";
          font-size: 32px;
          font-weight: 800;
          color: #ffffff;
        }

        text #body {
          at: 48px below #headline offset 20px;
          size: 540px;
          content: "Direkte DATEV-Schnittstelle mit automatischer Belegzuordnung und steuerkonformer GoBD-Archivierung in Echtzeit.";
          font-family: "Inter";
          font-size: 16px;
          line-height: 26px;
          color: #f1f5f9;
          align: left;
        }
      }
    `;
    const audit = await auditSnippet(src);
    expect(audit.metrics.slopFindingsCount).toBe(0);
    expect(audit.metrics.slopRiskLevel).toBe('clean');
    expect(audit.score).toBe(100);
    expect(audit.grade).toBe('A+');
    expect(audit.categories.antiSlop.score).toBe(100);
    expect(audit.categories.antiSlop.grade).toBe('A+');
  });

});
