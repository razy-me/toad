import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import {
  resolveImportsAndComponents,
  CircularVariableError,
  ComponentRecursionLimitError
} from '../src/parser/importResolver.js';
import { solveLayout, layoutText, computeGcd, computeAspectRatio } from '../src/parser/math.js';
import { CyclicDependencyError } from '../src/parser/dependencyGraph.js';

describe('Adversarial Challenge Test Suite — challenger_m1_2', () => {

  // ==========================================================================
  // Domain 1: Component Expansion & Complex Parameter Overrides
  // ==========================================================================
  describe('Domain 1: Component Expansion, Nested Overrides & Defaults', () => {
    it('handles multi-tier nested component parameter forwarding and default fallbacks', async () => {
      const src = `
        >globalTheme = #1e293b;

        // Level 3 Component (Leaf)
        component Icon(name = "star", iconSize = 24px, color = #f59e0b) {
          rect #glyph {
            size: >iconSize >iconSize;
            fill: >color;
          }
        }

        // Level 2 Component (Wrapper)
        component ActionButton(label = "Click", btnWidth = 140px, btnHeight = 40px, iconColor = #ffffff) {
          rect #btnBg {
            size: >btnWidth >btnHeight;
            fill: >globalTheme;
            radius: 8px;
          }
          Icon(color: >iconColor, iconSize: 20px) #btnIcon {
            at: 10px 10px;
          }
        }

        // Level 1 Component (Complex Composite)
        component HeaderBar(barTitle = "Dashboard", primaryActionColor = #10b981, barWidth = 800px) {
          rect #barBg {
            size: >barWidth 60px;
            fill: #0f172a;
          }
          ActionButton(btnWidth: 160px, iconColor: >primaryActionColor) #action1 {
            at: 600px 10px;
          }
          ActionButton #actionDefault {
            at: 400px 10px;
          }
        }

        // Instantiation with partial overrides
        HeaderBar(primaryActionColor: #ef4444, barWidth: 1000px) #mainHeader {
          at: 0 0;
        }
      `;

      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      expect(layout.nodes).toHaveLength(1);
      const header = layout.nodes[0];
      expect(header.id).toBe('mainHeader');

      // Check header children
      expect(header.children).toBeDefined();
      expect(header.children!.length).toBe(3); // barBg, action1, actionDefault

      // 1. barBg
      const barBg = header.children!.find(c => c.id?.includes('barBg'));
      expect(barBg).toBeDefined();
      expect(barBg!.width).toBe(1000); // overridden from default 800
      expect(barBg!.height).toBe(60);

      // 2. action1 (overridden iconColor = #ef4444, btnWidth = 160px)
      const action1 = header.children!.find(c => c.id?.includes('action1'));
      expect(action1).toBeDefined();
      const action1Bg = action1!.children?.find(c => c.id?.includes('btnBg'));
      expect(action1Bg?.width).toBe(160);
      const action1Icon = action1!.children?.find(c => c.id?.includes('btnIcon'));
      expect(action1Icon).toBeDefined();
      const action1Glyph = action1Icon!.children ? action1Icon!.children.find(c => c.id?.includes('glyph')) : action1Icon;
      expect(action1Glyph?.fill).toBe('#ef4444');
      expect(action1Glyph?.width).toBe(20);

      // 3. actionDefault (default iconColor = #ffffff, btnWidth = 140px)
      const actionDefault = header.children!.find(c => c.id?.includes('actionDefault'));
      expect(actionDefault).toBeDefined();
      const actionDefBg = actionDefault!.children?.find(c => c.id?.includes('btnBg'));
      expect(actionDefBg?.width).toBe(140);
      const actionDefIcon = actionDefault!.children?.find(c => c.id?.includes('btnIcon'));
      const actionDefGlyph = actionDefIcon!.children ? actionDefIcon!.children.find(c => c.id?.includes('glyph')) : actionDefIcon;
      expect(actionDefGlyph?.fill).toBe('#ffffff');
    });

    it('throws error when a required component parameter without default is missing', async () => {
      const src = `
        component StrictCard(title, width = 200px) {
          rect { size: >width 100px; }
        }
        StrictCard #myCard { at: 0 0; }
      `;
      const doc = parseToad(src);
      await expect(resolveImportsAndComponents(doc, 'main.toad')).rejects.toThrow(
        /Missing required parameter 'title'/i
      );
    });

    it('correctly isolates variable scopes between sibling component instances', async () => {
      const src = `
        component Box(size = 50px, col = #ff0000) {
          rect {
            size: >size >size;
            fill: >col;
          }
        }

        Box(size: 80px, col: #00ff00) #boxA { at: 0 0; }
        Box(size: 120px, col: #0000ff) #boxB { at: 100px 0; }
        Box #boxDefault { at: 250px 0; }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      expect(layout.nodes).toHaveLength(3);
      expect(layout.nodes[0].width).toBe(80);
      expect(layout.nodes[0].fill).toBe('#00ff00');

      expect(layout.nodes[1].width).toBe(120);
      expect(layout.nodes[1].fill).toBe('#0000ff');

      expect(layout.nodes[2].width).toBe(50);
      expect(layout.nodes[2].fill).toBe('#ff0000');
    });

    it('handles multiple invocations of single-element vs multi-element components with ID isolation', async () => {
      const src = `
        component SinglePill(w = 100px, bg = #475569) {
          rect #pillBg {
            size: >w 30px;
            fill: >bg;
            radius: 15px;
          }
        }

        component DoublePill(w = 100px) {
          rect #p1 { size: >w 30px; fill: #111; }
          rect #p2 { size: >w 30px; fill: #222; at: 0 35px; }
        }

        SinglePill(w: 80px) #s1 { at: 0 0; }
        SinglePill(w: 120px) #s2 { at: 0 50px; }
        DoublePill(w: 90px) #d1 { at: 0 100px; }
        DoublePill(w: 110px) #d2 { at: 0 200px; }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      expect(layout.nodes).toHaveLength(4);
      expect(layout.nodes[0].id).toBe('s1');
      expect(layout.nodes[0].width).toBe(80);

      expect(layout.nodes[1].id).toBe('s2');
      expect(layout.nodes[1].width).toBe(120);

      expect(layout.nodes[2].id).toBe('d1');
      expect(layout.nodes[2].children).toHaveLength(2);
      expect(layout.nodes[2].children![0].id).not.toBe(layout.nodes[3].children![0].id);
    });

    it('handles chained global variables passed as component parameter defaults', async () => {
      const src = `
        >baseUnit = 16px;
        >spacing = >baseUnit;
        >componentPadding = >spacing;

        component PaddedBox(pad = >componentPadding, bg = #22c55e) {
          rect #inner {
            size: >pad >pad;
            fill: >bg;
          }
        }

        PaddedBox #box1;
      `;

      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const box = layout.nodes[0];
      expect(box.width).toBe(16);
      expect(box.height).toBe(16);
      expect(box.fill).toBe('#22c55e');
    });
  });

  // ==========================================================================
  // Domain 2: currentColor Cascade in Deep Hierarchies
  // ==========================================================================
  describe('Domain 2: currentColor Cascade & Hierarchical Overrides', () => {
    it('cascades through 5 nested group layers with multiple local overrides', async () => {
      const src = `
        canvas { size: 1000px 1000px; }

        group #l1 {
          fill: #111111;
          group #l2 {
            // Inherits #111111
            group #l3 {
              fill: #333333; // Overrides to #333333
              group #l4 {
                // Inherits #333333
                group #l5 {
                  fill: #555555; // Overrides to #555555
                  rect #leaf5 { size: 10px 10px; fill: currentColor; }
                }
                rect #leaf4 { size: 10px 10px; fill: currentColor; }
              }
              rect #leaf3 { size: 10px 10px; fill: currentColor; }
            }
            rect #leaf2 { size: 10px 10px; fill: currentColor; }
          }
          rect #leaf1 { size: 10px 10px; fill: currentColor; }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const findById = (nodes: any[], targetId: string): any => {
        for (const n of nodes) {
          if (n.id === targetId || n.id?.endsWith(`_${targetId}`)) return n;
          if (n.children) {
            const found = findById(n.children, targetId);
            if (found) return found;
          }
        }
        return undefined;
      };

      const leaf1 = findById(layout.nodes, 'leaf1');
      const leaf2 = findById(layout.nodes, 'leaf2');
      const leaf3 = findById(layout.nodes, 'leaf3');
      const leaf4 = findById(layout.nodes, 'leaf4');
      const leaf5 = findById(layout.nodes, 'leaf5');

      expect(leaf1.style.fill).toBe('#111111');
      expect(leaf2.style.fill).toBe('#111111');
      expect(leaf3.style.fill).toBe('#333333');
      expect(leaf4.style.fill).toBe('#333333');
      expect(leaf5.style.fill).toBe('#555555');
    });

    it('correctly resolves currentColor inside gradient stops and stroke styles', async () => {
      const src = `
        group #gradientHost {
          fill: #7c3aed; // Purple
          rect #gradBox {
            size: 200px 100px;
            fill: linear-gradient(currentColor, #ffffff);
            stroke: currentColor 3px;
          }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const host = layout.nodes[0];
      const gradBox = host.children![0];

      expect(gradBox.style.stroke).toBe('#7c3aed');
      expect(typeof gradBox.style.fill).toBe('object');
      const fillGrad = gradBox.style.fill as any;
      expect(fillGrad.stops[0].color).toBe('#7c3aed');
      expect(fillGrad.stops[1].color).toBe('#ffffff');
    });

    it('ensures sibling groups do NOT leak currentColor into each other', async () => {
      const src = `
        canvas { size: 600px 400px; }

        group #parent {
          fill: #111111; // Parent base color

          group #branchA {
            fill: #ff0000; // Overrides to red
            rect #rectA {
              size: 50px 50px;
              fill: currentColor;
            }
          }

          group #branchB {
            // No fill override: MUST inherit parent #111111, NOT sibling #ff0000
            rect #rectB {
              size: 50px 50px;
              fill: currentColor;
            }
          }

          group #branchC {
            fill: #0000ff; // Overrides to blue
            rect #rectC {
              size: 50px 50px;
              fill: currentColor;
            }
          }
        }
      `;

      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const parent = layout.nodes[0];
      const branchA = parent.children?.find(c => c.id === 'branchA');
      const branchB = parent.children?.find(c => c.id === 'branchB');
      const branchC = parent.children?.find(c => c.id === 'branchC');

      const rectA = branchA?.children?.find(c => c.id === 'rectA');
      const rectB = branchB?.children?.find(c => c.id === 'rectB');
      const rectC = branchC?.children?.find(c => c.id === 'rectC');

      expect(rectA?.style.fill).toBe('#ff0000');
      expect(rectB?.style.fill).toBe('#111111'); // Must be #111111, not contaminated by branchA
      expect(rectC?.style.fill).toBe('#0000ff');
    });

    it('applies default fallback (#000000) when neither element nor ancestors specify color', async () => {
      const src = `
        group #plainGroup {
          rect #plainRect {
            size: 50px 50px;
            fill: currentColor;
            stroke: currentColor 1px;
          }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const rect = layout.nodes[0].children![0];
      expect(rect.style.fill).toBe('#000000');
      expect(rect.style.stroke).toBe('#000000');
    });
  });

  // ==========================================================================
  // Domain 3: Skia Text Measurement, Unicode & Conditional Auto-Wrapping
  // ==========================================================================
  describe('Domain 3: Skia Text Measurement & Wrapping Precision', () => {
    it('correctly computes metrics for empty, single-line, and multi-line text without size.w', () => {
      const empty = layoutText('', { fontSize: 20, fontFamily: 'sans-serif' });
      expect(empty.width).toBe(0);
      expect(empty.height).toBe(0);
      expect(empty.lines).toEqual(['']);

      const single = layoutText('Hello World', { fontSize: 20, fontFamily: 'sans-serif' });
      expect(single.lines).toEqual(['Hello World']);
      expect(single.width).toBeGreaterThan(50);
      expect(single.height).toBeGreaterThanOrEqual(20);

      const multi = layoutText('Line 1\nLine 2\nLine 3\nLine 4', {
        fontSize: 16,
        lineHeight: 24,
        fontFamily: 'sans-serif'
      });
      expect(multi.lines).toHaveLength(4);
      expect(multi.height).toBe(4 * 24);
    });

    it('measures complex Unicode, Emojis, CJK, and accented characters accurately', () => {
      const unicodeText = '🎨 Art & Design System — 日本語テスト — Café & Übergröße — 👨‍👩‍👧‍👦 Family';
      const result = layoutText(unicodeText, {
        fontSize: 18,
        fontFamily: 'sans-serif'
      });

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0]).toBe(unicodeText);
      expect(result.width).toBeGreaterThan(200);
      expect(result.height).toBeGreaterThan(15);
      expect(result.ascent).toBeGreaterThan(0);
    });

    it('handles conditional auto-wrapping strictly when explicitWidth is specified', () => {
      const paragraph = 'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau';
      
      // With explicit width
      const wrapped = layoutText(paragraph, {
        fontSize: 16,
        fontFamily: 'sans-serif',
        explicitWidth: 200
      });
      expect(wrapped.lines.length).toBeGreaterThan(2);
      expect(wrapped.width).toBe(200);

      // Without explicit width
      const unwrapped = layoutText(paragraph, {
        fontSize: 16,
        fontFamily: 'sans-serif'
      });
      expect(unwrapped.lines).toHaveLength(1);
      expect(unwrapped.width).toBeGreaterThan(200);
    });

    it('preserves empty paragraphs and multiple consecutive newlines during auto-wrap', () => {
      const content = 'First Paragraph\n\nSecond Paragraph with lots of descriptive text that should wrap\n\nThird Paragraph';
      const wrapped = layoutText(content, {
        fontSize: 14,
        lineHeight: 20,
        fontFamily: 'sans-serif',
        explicitWidth: 180
      });

      expect(wrapped.lines).toContain('');
      expect(wrapped.lines.length).toBeGreaterThan(4);
      expect(wrapped.height).toBe(wrapped.lines.length * 20);
    });

    it('handles unbreakable long words gracefully without crashing when explicitWidth is tight', () => {
      const longWord = 'SupercalifragilisticexpialidociousAndEvenLongerStringThatExceedsTheWidth';
      const result = layoutText(longWord, {
        fontSize: 16,
        fontFamily: 'sans-serif',
        explicitWidth: 50
      });

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0]).toBe(longWord);
      expect(result.width).toBe(50);
    });

    it('correctly calculates fractional line-height multipliers (< 5) and absolute line-heights (>= 5)', () => {
      const mult = layoutText('Line 1\nLine 2', { fontSize: 20, lineHeight: 1.5, fontFamily: 'sans-serif' });
      expect(mult.lineHeight).toBe(30);
      expect(mult.height).toBe(60);

      const abs = layoutText('Line 1\nLine 2', { fontSize: 20, lineHeight: 35, fontFamily: 'sans-serif' });
      expect(abs.lineHeight).toBe(35);
      expect(abs.height).toBe(70);
    });
  });

  // ==========================================================================
  // Domain 4: Uniform Tile Grid Math, Large Counts & Irregular Aspect Ratios
  // ==========================================================================
  describe('Domain 4: Uniform Tile Grid Index Calculations & Irregular Aspect Ratios', () => {
    it('computes exact coordinates for large grid counts (1,000 items in 10 columns)', async () => {
      // 1000 items in 10 columns = 100 rows
      const items: string[] = [];
      for (let i = 0; i < 1000; i++) {
        items.push(`rect #r_${i} { size: 50px 30px; }`);
      }

      const src = `
        canvas { size: 2000px 5000px; }
        grid #hugeGrid {
          at: 100px 200px;
          columns: 10;
          columnGap: 15px;
          rowGap: 10px;
          ${items.join('\n')}
        }
      `;

      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const startTime = performance.now();
      const layout = await solveLayout(resolved);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000); // Performance check: sub-second layout solve

      const grid = layout.nodes[0];
      // Expected width: 10 * 50 + 9 * 15 = 500 + 135 = 635
      expect(grid.width).toBe(635);
      // Expected height: 100 rows * 30 + 99 * 10 = 3000 + 990 = 3990
      expect(grid.height).toBe(3990);

      expect(grid.children).toHaveLength(1000);

      // Verify item at index 0 (row 0, col 0)
      const item0 = grid.children![0];
      expect(item0.box.x).toBe(100);
      expect(item0.box.y).toBe(200);

      // Verify item at index 17 (row 1, col 7)
      // x = 100 + 7 * (50 + 15) = 100 + 7 * 65 = 100 + 455 = 555
      // y = 200 + 1 * (30 + 10) = 200 + 40 = 240
      const item17 = grid.children![17];
      expect(item17.box.x).toBe(555);
      expect(item17.box.y).toBe(240);

      // Verify last item at index 999 (row 99, col 9)
      // x = 100 + 9 * 65 = 100 + 585 = 685
      // y = 200 + 99 * 40 = 200 + 3960 = 4160
      const item999 = grid.children![999];
      expect(item999.box.x).toBe(685);
      expect(item999.box.y).toBe(4160);
    });

    it('handles prime column counts with non-divisible item counts (7 cols, 23 items)', async () => {
      // 23 items in 7 columns = 4 rows (rows 0, 1, 2 have 7 items each = 21, row 3 has 2 items)
      const items: string[] = [];
      for (let i = 0; i < 23; i++) {
        items.push(`rect #item_${i} { size: 100px 80px; }`);
      }

      const src = `
        grid #primeGrid {
          at: 50px 50px;
          columns: 7;
          gap: 20px;
          ${items.join('\n')}
        }
      `;

      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const grid = layout.nodes[0];
      // Width: 7 * 100 + 6 * 20 = 700 + 120 = 820
      expect(grid.width).toBe(820);
      // Height: 4 rows * 80 + 3 * 20 = 320 + 60 = 380
      expect(grid.height).toBe(380);

      // Last item index 22 -> row 3, col 1
      const lastItem = grid.children![22];
      expect(lastItem.box.x).toBe(50 + 1 * (100 + 20)); // 170
      expect(lastItem.box.y).toBe(50 + 3 * (80 + 20));  // 350
    });

    it('computes GCD and aspect ratio correctly for extreme and irregular dimensions', () => {
      // 1920x1080 -> 16:9
      expect(computeAspectRatio(1920, 1080).ratioString).toBe('16:9');
      // Extreme wide: 3840x600 -> 32:5
      expect(computeAspectRatio(3840, 600).ratioString).toBe('32:5');
      // Extreme tall: 600x3840 -> 5:32
      expect(computeAspectRatio(600, 3840).ratioString).toBe('5:32');
      // Prime dimensions: 1009 x 503 -> 1009:503
      expect(computeAspectRatio(1009, 503).ratioString).toBe('1009:503');
      // Irregular banner: 1200 x 628 (Facebook link preview)
      const fb = computeAspectRatio(1200, 628);
      expect(fb.ratioString).toBe('300:157');
    });

    it('supports relational positioning relative to a computed uniform grid', async () => {
      const src = `
        canvas { size: 1200px 800px; }

        grid #gallery {
          at: 50px 50px;
          columns: 3;
          gap: 10px;
          rect { size: 100px 100px; }
          rect { size: 100px 100px; }
          rect { size: 100px 100px; }
          rect { size: 100px 100px; }
        }

        rect #footer {
          at: below #gallery offset 30px;
          size: 320px 50px;
        }

        rect #sidebar {
          at: right of #gallery offset 40px;
          size: 200px 210px;
        }
      `;

      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const gallery = layout.nodes.find(n => n.id === 'gallery')!;
      const footer = layout.nodes.find(n => n.id === 'footer')!;
      const sidebar = layout.nodes.find(n => n.id === 'sidebar')!;

      // Gallery: x=50, y=50, w=320, h=210
      expect(gallery.box.x).toBe(50);
      expect(gallery.box.y).toBe(50);
      expect(gallery.box.w).toBe(320);
      expect(gallery.box.h).toBe(210);

      // Footer: below #gallery (y = 50 + 210 + 30 = 290), x = 50
      expect(footer.box.x).toBe(50);
      expect(footer.box.y).toBe(290);

      // Sidebar: right of #gallery (x = 50 + 320 + 40 = 410), y = 50
      expect(sidebar.box.x).toBe(410);
      expect(sidebar.box.y).toBe(50);
    });
  });

  // ==========================================================================
  // Domain 5: Adversarial Defect Verifications (Remediated Correct Behavior)
  // ==========================================================================
  describe('Domain 5: Adversarial Defect Verifications (Remediated Correct Behavior)', () => {
    it('Defect 1 Fixed: Property named "text:" is parsed as property when followed by colon', async () => {
      const srcTextProp = `
        text #t1 {
          text: "Hello World";
        }
      `;
      const docText = parseToad(srcTextProp);
      const resolvedText = await resolveImportsAndComponents(docText, 'main.toad');
      const layoutTextRes = await solveLayout(resolvedText);

      // Verified fix: textLayout lines[0] contains 'Hello World'
      expect(layoutTextRes.nodes[0].textLayout?.lines[0]).toBe('Hello World');

      // Workaround comparison: "content:" also works
      const srcContentProp = `
        text #t2 {
          content: "Hello World";
        }
      `;
      const docContent = parseToad(srcContentProp);
      const resolvedContent = await resolveImportsAndComponents(docContent, 'main.toad');
      const layoutContentRes = await solveLayout(resolvedContent);
      expect(layoutContentRes.nodes[0].textLayout?.lines[0]).toBe('Hello World');
    });

    it('Defect 2 Fixed: Shorthand text declaration with variable (>var) is captured and resolved', async () => {
      const srcVarShorthand = `
        >myHeading = "Welcome";
        text >myHeading #heading;
      `;
      const doc = parseToad(srcVarShorthand);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      // Verified fix: textLayout lines[0] resolves to "Welcome"
      expect(layout.nodes[0].textLayout?.lines[0]).toBe('Welcome');
    });

    it('Defect 3 Fixed: Passing variable to points property resolves to complete points array', async () => {
      const src = `
        >triPoints = [ (0, 0), (50, 50), (-50, 50) ];
        polygon #tri {
          points: >triPoints;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');

      // Verified fix: resolved points array has length 3
      expect(resolved.elements[0].points?.length).toBe(3);
    });

    it('Defect 4 Fixed: Grid children without explicit top-level size: compute intrinsic bounding boxes', async () => {
      const src = `
        grid #myGrid {
          columns: 2;
          gap: 10px;
          group #item1 {
            rect { size: 60px 40px; }
          }
          group #item2 {
            rect { size: 60px 40px; }
          }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const grid = layout.nodes[0];
      // Verified fix: grid.width is 130 (2 * 60 + 10) instead of 210
      expect(grid.width).toBe(130);
    });
  });
});
