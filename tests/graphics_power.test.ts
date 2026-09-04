import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseToad } from '../src/parser/parser.js';
import { solveLayout } from '../src/parser/math.js';
import { CanvasRenderer } from '../src/engine/canvasRenderer.js';
import { SvgExporter } from '../src/engine/svgExporter.js';
import { PsdExporter } from '../src/engine/psdExporter.js';
import { ImportResolver } from '../src/parser/importResolver.js';

const testDir = path.join(__dirname, 'dist', 'graphics_power_sandbox');

describe('Graphics Power & Layout Option 2 Features', () => {
  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  it('correctly parses and links mask nodes and respects z-index rendering order', async () => {
    const toadCode = `
      canvas { size: 500px 500px; background: #fff; }
      
      // A shape intended to be used as a mask
      circle #avatarMask {
        at: center of canvas;
        size: 200px;
        fill: #000;
        z-index: 10;
      }
      
      // An image that is masked by the circle
      image #avatar {
        src: "https://placehold.co/400x400";
        at: center of canvas;
        size: 300px;
        mask: #avatarMask;
        z-index: 5;
      }

      // A text element drawn on top
      text {
        content: "Hello";
        at: center of canvas;
        font: 40px "Arial" bold;
        z-index: 100;
      }

      // A background element drawn behind everything
      rect {
        at: center of canvas;
        size: 400px;
        fill: #eee;
        z-index: -1;
      }
    `;

    const ast = parseToad(toadCode, 'test.toad');
    const resolver = new ImportResolver(ast, 'test.toad', {
      fileLoader: () => ''
    });
    const resolvedAst = await resolver.resolve();
    const layout = await solveLayout(resolvedAst);

    // 1. Z-Index Sorting Check (in rootNodes)
    // We expect the elements to be sorted by z-index:
    // rect (-1), image (5), circle (10), text (100)
    const rootNodes = layout.nodes;
    expect(rootNodes.length).toBe(4);
    expect(rootNodes[0].type).toBe('rect'); // z-index: -1
    expect(rootNodes[1].type).toBe('image'); // z-index: 5
    expect(rootNodes[2].type).toBe('circle'); // z-index: 10
    expect(rootNodes[3].type).toBe('text'); // z-index: 100

    // 2. Mask Link Check
    const imageNode = rootNodes[1];
    expect(imageNode.id).toBe('avatar');
    expect(imageNode.mask).toBe('avatarMask');
    expect(imageNode.maskNode).toBeDefined();
    expect(imageNode.maskNode?.id).toBe('avatarMask');
    expect(imageNode.maskNode?.type).toBe('circle');

    // 3. Exporter Checks (Ensure no crashes)
    const svg = await new SvgExporter().export(layout, 1);
    expect(svg).toContain('clip-path="url(#');
    
    const psdBuffer = await PsdExporter.export(layout, { scale: 1 });
    expect(psdBuffer.length).toBeGreaterThan(0);

    const canvas = await CanvasRenderer.renderToCanvas(layout, { scale: 1 });
    expect(canvas).toBeDefined();
  });

  it('correctly parses and outputs backdrop-filter', async () => {
    const toadCode = `
      canvas { size: 400px; }
      rect #glass {
        size: 200px;
        backdrop-filter: blur(20px) saturate(150%);
        fill: rgba(255,255,255,0.2);
      }
    `;

    const ast = parseToad(toadCode, 'test2.toad');
    const resolver = new ImportResolver(ast, 'test2.toad', {
      fileLoader: () => ''
    });
    const resolvedAst = await resolver.resolve();
    const layout = await solveLayout(resolvedAst);
    
    expect(layout.nodes[0].style.backdropFilter).toBe('blur(20px) saturate(150%)');

    const svg = await new SvgExporter().export(layout, 1);
    expect(svg).toContain('backdrop-filter: blur(20px) saturate(150%)');
  });
});
