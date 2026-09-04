import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { exportToSvg } from '../src/engine/svgExporter.js';

async function svgOf(src: string, opts: any = {}) {
  const l = await solveLayout(await resolveImportsAndComponents(parseToad(src, 's.toad'), 's.toad'));
  return exportToSvg(l, opts);
}

const CANVAS = 'canvas { size: 200px 100px; fill: #ffffff; }';

describe('SVG exporter: document frame', () => {
  it('emits an XML declaration and correct viewBox', async () => {
    const svg = await svgOf(`${CANVAS} rect #r { at: 10px 10px; size: 20px 20px; }`);
    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('viewBox="0 0 200 100"');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="100"');
  });

  it('doubles dimensions with scale option', async () => {
    const svg = await svgOf(CANVAS, { scale: 2 });
    expect(svg).toContain('viewBox="0 0 200 100"');
    expect(svg).toMatch(/width="400"/);
    expect(svg).toMatch(/height="200"/);
  });

  it('renders the canvas background as a full-bleed rect', async () => {
    const svg = await svgOf(CANVAS);
    expect(svg).toContain('width="100%"');
    expect(svg).toContain('#ffffff');
  });
});

describe('SVG exporter: shapes and ids', () => {
  it('emits rects with absolute geometry and ids', async () => {
    const svg = await svgOf(`${CANVAS} rect #card { at: 12px 34px; size: 50px 60px; fill: #f00; }`);
    expect(svg).toContain('x="12"');
    expect(svg).toContain('y="34"');
    expect(svg).toContain('id="card"');
  });

  it('defaults stroke width to 1px when only a color is given', async () => {
    const svg = await svgOf(`${CANVAS} rect #r { at: 5px 5px; size: 30px 30px; stroke: #0000ff; }`);
    expect(svg).toContain('stroke="#0000ff"');
    expect(svg).toContain('stroke-width="1"');
  });

  it('escapes XML special characters in text content', async () => {
    const svg = await svgOf(`${CANVAS} text #t { at: 4px 40px; text: "A & B <tag>"; font-size: 12px; color: #000; }`);
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&lt;tag&gt;');
    expect(svg).not.toContain('<tag>');
  });
});

describe('SVG exporter: clipping model', () => {
  it('uses the sibling clip model (clip:true masks the NEXT sibling)', async () => {
    const svg = await svgOf(`
      ${CANVAS}
      rect #mask { at: 10px 10px; size: 50px 50px; clip: true; fill: #f00; }
      rect #masked { at: 40px 20px; size: 40px 40px; fill: #0f0; }
      rect #unrelated { at: 90px 20px; size: 20px 20px; fill: #00f; }
    `);
    expect(svg).toContain('<clipPath id="clip_1">');
    const tagOf = (id: string) => {
      const start = svg.lastIndexOf('<rect', svg.indexOf(`id="${id}"`));
      return svg.slice(start, svg.indexOf('/>', start));
    };
    expect(tagOf('masked')).toContain('clip-path="url(#clip_1)"');
    expect(tagOf('unrelated')).not.toContain('clip-path');
  });
});

describe('SVG exporter: filters', () => {
  it('emits feDropShadow with intact color arguments', async () => {
    const svg = await svgOf(`${CANVAS} rect #r { at: 20px 20px; size: 40px 40px; fill: #0f0; filter: drop-shadow(2px 3px 2px rgba(0, 0, 0, 0.6)); }`);
    expect(svg).toContain('<feDropShadow');
    expect(svg).toContain('flood-color="rgba(0, 0, 0, 0.6)"');
  });

  it('normalizes percent filter arguments', async () => {
    const svg = await svgOf(`${CANVAS} rect #r { at: 20px 20px; size: 40px 40px; fill: #0f0; filter: opacity(50%) grayscale(50%); }`);
    expect(svg).toContain('slope="0.5"');
  });

  it('emits gradient defs for gradient fills', async () => {
    const svg = await svgOf(`${CANVAS} rect #r { at: 0px 0px; size: 60px 60px; fill: linear-gradient(#ff0000, #0000ff); }`);
    expect(svg).toContain('<linearGradient');
    expect(svg).toContain('stop-color="#ff0000"');
    expect(svg).toContain('stop-color="#0000ff"');
  });
});

describe('SVG exporter: icons and stacks', () => {
  it('translates icon paths to their node origin', async () => {
    const svg = await svgOf(`${CANVAS} icon #i { iconName: 'check'; size: 24px 24px; at: 150px 10px; mask: true; }`);
    expect(svg).toContain('translate(150 10)');
  });

  it('exports stack children (flat-list regression guard)', async () => {
    const svg = await svgOf(`
      ${CANVAS}
      stack #s { at: 5px 5px; direction: vertical; gap: 2px;
        rect #sa { size: 40px 10px; fill: #f00; }
        rect #sb { size: 40px 10px; fill: #0f0; }
      }
    `);
    expect(svg).toContain('id="sa"');
    expect(svg).toContain('id="sb"');
  });
});
