import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import {
  solveLayout,
  computeGcd,
  computeAspectRatio,
  layoutText
} from '../src/parser/math.js';
import { CyclicDependencyError } from '../src/parser/dependencyGraph.js';

describe('Layout Solver, Math Engine & Relational DAG', () => {
  describe('GCD & Aspect Ratio Calculations', () => {
    it('computes correct GCD and aspect ratio strings', () => {
      expect(computeGcd(1920, 1080)).toBe(120);
      expect(computeAspectRatio(1920, 1080).ratioString).toBe('16:9');

      expect(computeGcd(1080, 1350)).toBe(270);
      expect(computeAspectRatio(1080, 1350).ratioString).toBe('4:5');

      expect(computeGcd(1200, 630)).toBe(30);
      expect(computeAspectRatio(1200, 630).ratioString).toBe('40:21');

      expect(computeGcd(1000, 1000)).toBe(1000);
      expect(computeAspectRatio(1000, 1000).ratioString).toBe('1:1');
    });

    it('handles zero or invalid aspect ratios safely', () => {
      expect(computeAspectRatio(0, 0).ratioString).toBe('1:1');
      expect(computeAspectRatio(-100, 200).ratioString).toBe('1:1');
    });
  });

  describe('Headless Skia Text Measurement & Conditional Auto-Wrap', () => {
    it('measures text bounding box without auto-wrap when size.w is omitted', () => {
      const result = layoutText('Hello World', {
        fontSize: 24,
        fontFamily: 'sans-serif'
      });

      expect(result.lines).toHaveLength(1);
      expect(result.width).toBeGreaterThan(50);
      expect(result.height).toBeGreaterThan(20);
    });

    it('preserves multi-line text with explicit newlines without auto-wrapping', () => {
      const result = layoutText('Line One\nLine Two\nLine Three', {
        fontSize: 16,
        fontFamily: 'sans-serif'
      });

      expect(result.lines).toHaveLength(3);
      expect(result.lines[0]).toBe('Line One');
      expect(result.lines[1]).toBe('Line Two');
      expect(result.lines[2]).toBe('Line Three');
    });

    it('greedily wraps words when explicitWidth is provided', () => {
      const longSentence = 'The quick brown fox jumps over the lazy dog and runs across the open field';
      const result = layoutText(longSentence, {
        fontSize: 16,
        fontFamily: 'sans-serif',
        explicitWidth: 150
      });

      expect(result.lines.length).toBeGreaterThan(1);
      expect(result.width).toBe(150);
    });
  });

  describe('Static currentColor Cascade', () => {
    it('cascades currentColor down the tree statically', async () => {
      const src = `
        canvas {
          size: 800px 600px;
        }

        group #card {
          at: 20px 20px;
          fill: #3b82f6; // sets active color
          rect #bg {
            size: 200px 100px;
            fill: currentColor;
          }
          circle #badge {
            at: 10px 10px;
            size: 20px 20px;
            stroke: currentColor 2px;
          }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const card = layout.nodes[0];
      const bg = card.children?.find(c => c.id === 'bg');
      const badge = card.children?.find(c => c.id === 'badge');

      expect(bg?.style.fill).toBe('#3b82f6');
      expect(badge?.style.stroke).toBe('#3b82f6');
    });

    it('falls back to #000000 when no ancestor color is declared', async () => {
      const src = `
        rect #box {
          at: 0 0;
          size: 100px 100px;
          fill: currentColor;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      expect(layout.nodes[0].style.fill).toBe('#000000');
    });
  });

  describe('Relational Positioning & Topological DAG', () => {
    it('solves layout coordinates for chained relational positioning', async () => {
      const src = `
        canvas {
          size: 1000px 800px;
        }

        rect #header {
          at: 0 0;
          size: 1000px 80px;
        }

        rect #sidebar {
          at: below #header offset 10px;
          size: 200px 500px;
        }

        rect #content {
          at: right of #sidebar offset 20px;
          size: 600px 500px;
        }

        rect #avatar {
          at: center of #header;
          size: 40px 40px;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const header = layout.nodes.find(n => n.id === 'header')!;
      const sidebar = layout.nodes.find(n => n.id === 'sidebar')!;
      const content = layout.nodes.find(n => n.id === 'content')!;
      const avatar = layout.nodes.find(n => n.id === 'avatar')!;

      // Header: (0, 0, 1000, 80)
      expect(header.box.x).toBe(0);
      expect(header.box.y).toBe(0);

      // Sidebar: below #header (y = 80 + 10 = 90)
      expect(sidebar.box.x).toBe(0);
      expect(sidebar.box.y).toBe(90);

      // Content: right of #sidebar (x = 200 + 20 = 220, y = 90)
      expect(content.box.x).toBe(220);
      expect(content.box.y).toBe(90);

      // Avatar: center of #header (x = (1000 - 40)/2 = 480, y = (80 - 40)/2 = 20)
      expect(avatar.box.x).toBe(480);
      expect(avatar.box.y).toBe(20);
    });

    it('detects cyclical relational dependencies and throws CyclicDependencyError', async () => {
      const src = `
        rect #a {
          at: right of #b;
          size: 100px 100px;
        }

        rect #b {
          at: below #a;
          size: 100px 100px;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      await expect(solveLayout(resolved)).rejects.toThrow(CyclicDependencyError);
    });

    it('falls back to (0, 0) and records warning on missing relational target', async () => {
      const src = `
        rect #orphan {
          at: right of #nonExistent offset 10px;
          size: 100px 100px;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const orphan = layout.nodes.find(n => n.id === 'orphan')!;
      expect(orphan.box.x).toBe(0);
      expect(orphan.box.y).toBe(0);
      expect(layout.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Center-Relative Polygon Coordinates', () => {
    it('scales and maps center-relative polygon points to canvas space', async () => {
      const src = `
        polygon #triangle {
          at: 100px 100px;
          size: 200px 200px;
          points: [ (0, -50), (50, 50), (-50, 50) ];
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const tri = layout.nodes[0];
      expect(tri.box.x).toBe(100);
      expect(tri.box.y).toBe(100);
      expect(tri.box.w).toBe(200);
      expect(tri.box.h).toBe(200);

      // Center is (200, 200)
      const pts = tri.polygonLayout?.canvasPoints!;
      expect(pts).toBeDefined();
      expect(pts).toHaveLength(3);

      // (0, -50) scaled by 2x -> center + (0, -100) = (200, 100)
      expect(pts[0].x).toBe(200);
      expect(pts[0].y).toBe(100);

      // (50, 50) scaled by 2x -> center + (100, 100) = (300, 300)
      expect(pts[1].x).toBe(300);
      expect(pts[1].y).toBe(300);
    });
  });

  describe('Uniform Tile Grid Layout', () => {
    it('positions grid items in row-major order with uniform cells and gaps', async () => {
      const src = `
        grid #gallery {
          at: 50px 50px;
          columns: 3;
          gap: 10px;
          rect { size: 100px 100px; }
          rect { size: 100px 100px; }
          rect { size: 100px 100px; }
          rect { size: 100px 100px; }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const gallery = layout.nodes[0];
      expect(gallery.box.x).toBe(50);
      expect(gallery.box.y).toBe(50);
      // Width: 3 * 100 + 2 * 10 = 320
      expect(gallery.box.w).toBe(320);
      // Height: 2 rows * 100 + 1 * 10 = 210
      expect(gallery.box.h).toBe(210);

      const children = gallery.children!;
      expect(children).toHaveLength(4);

      // Child 0: Row 0, Col 0 -> (50, 50)
      expect(children[0].box.x).toBe(50);
      expect(children[0].box.y).toBe(50);

      // Child 1: Row 0, Col 1 -> (50 + 100 + 10 = 160, 50)
      expect(children[1].box.x).toBe(160);
      expect(children[1].box.y).toBe(50);

      // Child 2: Row 0, Col 2 -> (50 + 200 + 20 = 270, 50)
      expect(children[2].box.x).toBe(270);
      expect(children[2].box.y).toBe(50);

      // Child 3: Row 1, Col 0 -> (50, 50 + 100 + 10 = 160)
      expect(children[3].box.x).toBe(50);
      expect(children[3].box.y).toBe(160);
    });

    it('handles empty grid gracefully', async () => {
      const src = `
        grid #emptyGrid {
          at: 0 0;
          columns: 3;
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const grid = layout.nodes[0];
      expect(grid.box.w).toBe(0);
      expect(grid.box.h).toBe(0);
    });

    it('computes grid cell dimensions from child groups without explicit top-level size', async () => {
      const src = `
        grid #autoGrid {
          columns: 2;
          gap: 15px;
          group #g1 {
            rect { size: 80px 50px; }
          }
          group #g2 {
            rect { size: 80px 50px; }
          }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const grid = layout.nodes[0];
      // Width: 2 * 80 + 15 = 175
      expect(grid.box.w).toBe(175);
      // Height: 1 * 50 = 50
      expect(grid.box.h).toBe(50);
    });
  });

  describe('Enclosing Bounding Box for Groups', () => {
    it('computes enclosing AABB for group with positioned children', async () => {
      const src = `
        group #wrapper {
          rect #r1 {
            at: 100px 100px;
            size: 50px 50px;
          }
          rect #r2 {
            at: 200px 300px;
            size: 80px 20px;
          }
        }
      `;
      const doc = parseToad(src);
      const resolved = await resolveImportsAndComponents(doc, 'main.toad');
      const layout = await solveLayout(resolved);

      const wrapper = layout.nodes[0];
      // minX = 100, minY = 100, maxX = 280, maxY = 320 -> w = 180, h = 220
      expect(wrapper.box.x).toBe(100);
      expect(wrapper.box.y).toBe(100);
      expect(wrapper.box.w).toBe(180);
      expect(wrapper.box.h).toBe(220);
    });
  });
});

