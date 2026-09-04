import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';

describe('Cookbook Code Verification Suite', () => {
  it('Example 1.1: Modern Pill Badge compiles and solves cleanly', async () => {
    const code = `
      >primary = #3b82f6;
      >bgDark = #0f172a;

      canvas "Pill-Badge" {
          width: 240px;
          height: 80px;
          background: >bgDark;
          export: image;
      }

      stack #badge {
          direction: horizontal;
          gap: 8px;
          padding: [8px, 16px, 8px, 16px];
          radius: 32px;
          fill: alpha(>primary, 0.15);
          stroke: >primary 1px;
          at: center of canvas;

          icon {
              iconName: "check";
              size: 16px;
              fill: >primary;
          }

          text {
              content: "Verified User";
              font-family: "Inter";
              font-size: 14px;
              font-weight: bold;
              color: #ffffff;
          }
      }
    `;
    const doc = parseToad(code, 'ex1_1.toad');
    const resolved = await resolveImportsAndComponents(doc, 'ex1_1.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThan(0);
  });

  it('Example 1.2: Circular Avatar Mask compiles and solves cleanly', async () => {
    const code = `
      canvas "Avatar-Ring" {
          width: 160px;
          height: 160px;
          background: transparent;
          export: png, svg;
      }

      circle #outerRing {
          size: 140px;
          at: center of canvas;
          stroke: linear-gradient(135deg, #38bdf8, #ec4899) 4px;
          fill: transparent;
      }

      circle #avatarMask {
          size: 120px;
          at: center of canvas;
      }

      image #photo {
          src: "avatar.png";
          size: 120px 120px;
          at: center of canvas;
          fit: cover;
          mask: #avatarMask;
      }
    `;
    const doc = parseToad(code, 'ex1_2.toad');
    const resolved = await resolveImportsAndComponents(doc, 'ex1_2.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBe(3);
  });

  it('Example 1.3: Geometric Diamond compiles and solves cleanly', async () => {
    const code = `
      canvas "Shapes-Accent" {
          width: 300px;
          height: 300px;
          background: #090d16;
      }

      polygon #diamond {
          at: center of canvas;
          points: [
              (0px, -60px),
              (60px, 0px),
              (0px, 60px),
              (-60px, 0px)
          ];
          radius: 8px;
          fill: linear-gradient(135deg, #6366f1, #a855f7);
          shadow: 0 15px 35px rgba(168, 85, 247, 0.4);
      }

      star #innerStar {
          size: 48px;
          at: center of #diamond;
          fill: #ffffff;
          rotation: 15deg;
      }
    `;
    const doc = parseToad(code, 'ex1_3.toad');
    const resolved = await resolveImportsAndComponents(doc, 'ex1_3.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBe(2);
  });

  it('Example 2.1: Social Media Card compiles and solves cleanly', async () => {
    const code = `
      >bg = #0f172a;
      >cardBg = #1e293b;
      >primary = #38bdf8;
      >textMuted = #94a3b8;

      canvas "Social-OG-Card" {
          preset: og-image;
          background: >bg;
          export: all;
      }

      circle #glow1 {
          size: 600px;
          at: (-100px, -100px);
          fill: radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, transparent 70%);
      }

      circle #glow2 {
          size: 500px;
          at: (750px, 200px);
          fill: radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, transparent 70%);
      }

      stack #contentCard {
          direction: vertical;
          gap: 24px;
          padding: 48px;
          size: 1040px hug;
          radius: 24px;
          fill: >cardBg;
          stroke: #334155 1px;
          shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
          at: center of canvas;

          stack #brandHeader {
              direction: horizontal;
              gap: 12px;
              align: center;

              icon {
                  iconName: "settings";
                  size: 28px;
                  fill: >primary;
              }

              text {
                  content: "TOAD COMPILER 2.0";
                  font-family: "Inter";
                  font-size: 16px;
                  font-weight: 700;
                  letter-spacing: 2px;
                  text-transform: uppercase;
                  color: >primary;
              }
          }

          text #headline {
              content: "Declarative Graphic Design for Code & AI Agents";
              font-family: "Inter";
              font-size: 48px;
              font-weight: 800;
              color: #ffffff;
              size: 940px;
          }

          text #description {
              content: "Compile clean declarative syntax into multi-scale images, SVG vector paths, and layered Photoshop PSDs with editable text and shapes.";
              font-family: "Inter";
              font-size: 20px;
              line-height: 32px;
              color: >textMuted;
              size: 940px;
          }
      }
    `;
    const doc = parseToad(code, 'ex2_1.toad');
    const resolved = await resolveImportsAndComponents(doc, 'ex2_1.toad');
    const layout = await solveLayout(resolved);
    expect(layout.canvas.width).toBe(1200);
    expect(layout.canvas.height).toBe(630);
  });

  it('Example 2.2: Pricing Tier Card Component compiles and solves cleanly', async () => {
    const code = `
      >primary = #3b82f6;

      canvas "Pricing-Showcase" {
          width: 420px;
          height: 600px;
          background: #0b0f19;
          export: image, psd;
      }

      component PricingCard(plan = "PRO", price = "$29", period = "/mo", isPopular = false) {
          stack #card {
              direction: vertical;
              gap: 20px;
              padding: 36px;
              size: 340px hug;
              radius: 20px;
              fill: #161f30;
              stroke: >primary 2px;
              shadow: 0 20px 45px rgba(0, 0, 0, 0.4);
              at: center of canvas;

              stack #planHeader {
                  direction: horizontal;
                  align: center;
                  justify: space-between;

                  text {
                      content: >plan;
                      font-family: "Inter";
                      font-size: 18px;
                      font-weight: 800;
                      color: >primary;
                      letter-spacing: 1px;
                  }
              }

              text #priceTag {
                  content: >price;
                  font-family: "Inter";
                  font-size: 44px;
                  font-weight: 800;
                  color: #ffffff;
              }

              stack #featureList {
                  direction: vertical;
                  gap: 12px;

                  text { content: "✓ Unlimited Multi-Scale Exports"; font-size: 14px; color: #cbd5e1; }
                  text { content: "✓ Full Layered PSD Support"; font-size: 14px; color: #cbd5e1; }
                  text { content: "✓ Live Watch Mode & Hot Reload"; font-size: 14px; color: #cbd5e1; }
              }

              stack #ctaButton {
                  direction: horizontal;
                  padding: [14px, 20px, 14px, 20px];
                  radius: 12px;
                  fill: >primary;
                  align: center;

                  text {
                      content: "Choose Plan";
                      font-family: "Inter";
                      font-size: 15px;
                      font-weight: bold;
                      color: #ffffff;
                  }
              }
          }
      }

      PricingCard("ENTERPRISE", "$99", "/mo", true);
    `;
    const doc = parseToad(code, 'ex2_2.toad');
    const resolved = await resolveImportsAndComponents(doc, 'ex2_2.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThan(0);
  });

  it('Example 3.1: Glassmorphic Analytics Dashboard compiles and solves cleanly', async () => {
    const code = `
      >bgDark = #030712;
      >neonCyan = #06b6d4;
      >neonPink = #ec4899;
      >neonPurple = #8b5cf6;

      canvas "Analytics-Pro" {
          ratio: 16:9;
          resolution: 1080p;
          background: >bgDark;
          export: all;
          quality: 90%;
      }

      rect #conicOrb {
          size: 700px 700px;
          at: (1200px, -150px);
          fill: conic-gradient(from 90deg, >neonCyan, >neonPurple, >neonPink, >neonCyan);
          radius: 350px;
          filter: blur(80px);
          opacity: 0.35;
      }

      rect #glassContainer {
          size: 1600px 860px;
          at: center of canvas;
          fill: rgba(17, 24, 39, 0.65);
          backdrop-filter: blur(32px) saturate(180%);
          radius: 28px;
          stroke: rgba(255, 255, 255, 0.12) 1.5px;
          shadow: 0 35px 80px rgba(0, 0, 0, 0.7);
          z-index: 10;
      }

      stack #topNav {
          direction: horizontal;
          gap: 20px;
          padding: [32px, 48px, 24px, 48px];
          size: 1600px hug;
          align: center;
          at: inside #glassContainer offset (0px, 0px);

          icon {
              iconName: "home";
              size: 32px;
              fill: >neonCyan;
          }

          text #dashTitle {
              content: "EXECUTIVE ANALYTICS";
              font-family: "Inter";
              font-size: 24px;
              font-weight: 800;
              letter-spacing: 2px;
              color: #ffffff;
          }

          rect #spacer {
              size: calc(100% - 600px) 1px;
              fill: transparent;
          }

          icon #userIcon {
              iconName: "user";
              size: 24px;
              fill: #94a3b8;
          }
      }

      grid #metricGrid {
          at: inside #glassContainer offset (48px, 120px);
          columns: 3;
          gap: 32px;
          flow: row;

          stack #cardRevenue {
              direction: vertical;
              gap: 16px;
              padding: 28px;
              size: 480px 220px;
              radius: 20px;
              fill: rgba(31, 41, 55, 0.7);
              stroke: rgba(56, 189, 248, 0.3) 1px;

              text { content: "Total Revenue"; font-size: 15px; font-weight: 600; color: #94a3b8; }
              text { content: "$1,284,500"; font-size: 38px; font-weight: 800; color: #ffffff; }
              text { content: "+24.8% from last quarter"; font-size: 14px; font-weight: 700; color: #10b981; }
          }

          stack #cardUsers {
              direction: vertical;
              gap: 16px;
              padding: 28px;
              size: 480px 220px;
              radius: 20px;
              fill: rgba(31, 41, 55, 0.7);
              stroke: rgba(168, 85, 247, 0.3) 1px;

              text { content: "Active Subscriptions"; font-size: 15px; font-weight: 600; color: #94a3b8; }
              text { content: "84,320"; font-size: 38px; font-weight: 800; color: #ffffff; }
              text { content: "+12.4% new signups this week"; font-size: 14px; font-weight: 700; color: #10b981; }
          }

          stack #cardPerformance {
              direction: vertical;
              gap: 16px;
              padding: 28px;
              size: 480px 220px;
              radius: 20px;
              fill: rgba(31, 41, 55, 0.7);
              stroke: rgba(236, 72, 153, 0.3) 1px;

              text { content: "System Health Score"; font-size: 15px; font-weight: 600; color: #94a3b8; }
              text { content: "99.98%"; font-size: 38px; font-weight: 800; color: #ffffff; }
              text { content: "All global clusters online"; font-size: 14px; font-weight: 700; color: #38bdf8; }
          }
      }

      rect #lowerPanel {
          at: below #metricGrid offset 32px;
          size: 1504px 420px;
          radius: 20px;
          fill: rgba(31, 41, 55, 0.5);
          stroke: rgba(255, 255, 255, 0.08) 1px;
      }

      path #chartWave {
          at: inside #lowerPanel offset (32px, 140px);
          d: "M 0 180 Q 250 40 500 120 T 1000 60 T 1440 20";
          stroke: linear-gradient(to right, >neonCyan, >neonPurple, >neonPink) 4px;
          fill: transparent;
      }
    `;
    const doc = parseToad(code, 'ex3_1.toad');
    const resolved = await resolveImportsAndComponents(doc, 'ex3_1.toad');
    const layout = await solveLayout(resolved);
    expect(layout.canvas.width).toBe(1920);
    expect(layout.canvas.height).toBe(1080);
  });

  it('Example 3.2: Reusable Modal with Slot Children compiles and solves cleanly', async () => {
    const code = `
      >primary = #6366f1;

      canvas "Modal-Slot-Showcase" {
          preset: banner;
          background: #0a0f1d;
          export: all;
      }

      component ModalDialog(title = "Dialog", width = 540px) {
          group #modalWrapper {
              rect #modalCard {
                  size: >width hug;
                  fill: #151d30;
                  radius: 20px;
                  stroke: #2e3a54 1.5px;
                  shadow: 0 30px 70px rgba(0, 0, 0, 0.6);
                  at: center of canvas;
              }

              stack #modalHeader {
                  direction: horizontal;
                  padding: [24px, 32px, 16px, 32px];
                  at: inside #modalCard offset (0px, 0px);
                  align: center;
                  justify: space-between;

                  text {
                      content: >title;
                      font-family: "Inter";
                      font-size: 20px;
                      font-weight: 800;
                      color: #ffffff;
                  }

                  icon {
                      iconName: "x";
                      size: 20px;
                      fill: #94a3b8;
                  }
              }

              slot;
          }
      }

      ModalDialog("Delete Project Confirmation", 560px) {
          stack #modalBody {
              direction: vertical;
              gap: 20px;
              padding: [20px, 32px, 32px, 32px];
              at: inside parent offset (0px, 64px);

              text #bodyWarning {
                  content: "Are you sure you want to permanently delete this project? This action cannot be undone and will erase all associated artboards.";
                  font-family: "Inter";
                  font-size: 15px;
                  line-height: 24px;
                  color: #94a3b8;
                  size: 496px;
              }

              stack #actions {
                  direction: horizontal;
                  gap: 16px;
                  justify: end;

                  stack #btnCancel {
                      direction: horizontal;
                      padding: [10px, 20px, 10px, 20px];
                      radius: 10px;
                      fill: #222e47;

                      text { content: "Cancel"; font-weight: 600; color: #cbd5e1; }
                  }

                  stack #btnDelete {
                      direction: horizontal;
                      padding: [10px, 20px, 10px, 20px];
                      radius: 10px;
                      fill: #ef4444;

                      text { content: "Delete Project"; font-weight: 700; color: #ffffff; }
                  }
              }
          }
      }
    `;
    const doc = parseToad(code, 'ex3_2.toad');
    const resolved = await resolveImportsAndComponents(doc, 'ex3_2.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThan(0);
  });

  it('Parses mixed size values like 900px hug and fill 100% without error', async () => {
    const code = `
      >bg = #0f172a;
      >cardBg = #1e293b;
      >primary = #38bdf8;
      >textMuted = #94a3b8;
      >textLight = #ffffff;

      canvas "AnnouncementCard" {
          preset: og-image;
          background: >bg;
          export: image;

          stack #card {
              at: center of canvas;
              direction: vertical;
              size: 900px hug;
              padding: 48px;
              gap: 24px;
              radius: 20px;
              fill: >cardBg;
              stroke: #334155 1px;
          }
      }
    `;
    const doc = parseToad(code, 'announcement.toad');
    expect(doc.diagnostics?.length || 0).toBe(0);
    const resolved = await resolveImportsAndComponents(doc, 'announcement.toad');
    const layout = await solveLayout(resolved);
    expect(layout.nodes.length).toBeGreaterThan(0);
  });
});

