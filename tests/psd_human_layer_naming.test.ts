import { describe, it, expect } from 'vitest';
import { readPsd } from 'ag-psd';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { exportToPsd } from '../src/engine/psdExporter.js';

async function psdOf(src: string, opts: any = {}) {
  const parsed = parseToad(src, 'test.toad');
  const resolved = await resolveImportsAndComponents(parsed, 'test.toad');
  const layout = await solveLayout(resolved);
  const buf = await exportToPsd(layout, opts);
  return readPsd(buf, { readLayers: true });
}

function flattenLayers(layers: any[]): any[] {
  const result: any[] = [];
  for (const l of layers || []) {
    result.push(l);
    if (l.children) {
      result.push(...flattenLayers(l.children));
    }
  }
  return result;
}

describe('PSD Exporter: Human Layer Naming', () => {
  it('humanizes element identifiers to Title Case', async () => {
    const src = `
      canvas "My Canvas" { size: 500px 500px; fill: #ffffff; }
      group #heroSection {
        rect #glassCard { size: 200px 100px; fill: #f00; }
        circle #avatarCircle { size: 50px 50px; fill: #0f0; }
      }
    `;
    const psd = await psdOf(src, { humanizeLayerNames: true });
    const allLayers = flattenLayers(psd.children || []);
    const names = allLayers.map(l => l.name);

    expect(names).toContain('Hero Section');
    expect(names).toContain('Glass Card');
    expect(names).toContain('Avatar Circle');
  });

  it('formats text layers according to user spec: "<TEXT> Text"', async () => {
    const src = `
      canvas { size: 400px 200px; }
      text {
        content: "Willkommen zurück";
        font-size: 24px;
      }
      text #subTitle {
        content: "im Dashboard";
        font-size: 16px;
      }
    `;
    const psd = await psdOf(src, { humanizeLayerNames: true });
    const allLayers = flattenLayers(psd.children || []);
    const names = allLayers.map(l => l.name);

    expect(names).toContain('Willkommen zurück Text');
    expect(names).toContain('im Dashboard Text');
  });

  it('preserves explicitly assigned string layer names with highest priority', async () => {
    const src = `
      canvas { size: 400px 200px; }
      rect #bg "Custom Background Banner" {
        size: 400px 200px;
        fill: #112233;
      }
      text #hdr "Custom Heading Label" {
        content: "Hello World";
        font-size: 20px;
      }
      rect {
        name: "Explicit Property Name";
        size: 100px 100px;
      }
    `;
    const psd = await psdOf(src, { humanizeLayerNames: true });
    const allLayers = flattenLayers(psd.children || []);
    const names = allLayers.map(l => l.name);

    expect(names).toContain('Custom Background Banner');
    expect(names).toContain('Custom Heading Label');
    expect(names).toContain('Explicit Property Name');
  });

  it('names container background rects contextually as "${ParentName} Background"', async () => {
    const src = `
      canvas { size: 500px 500px; }
      group #cardContainer {
        fill: #ffffff;
        size: 300px 200px;
        text { content: "Card Title"; }
      }
    `;
    const psd = await psdOf(src, { humanizeLayerNames: true });
    const allLayers = flattenLayers(psd.children || []);
    const names = allLayers.map(l => l.name);

    expect(names).toContain('Card Container');
    expect(names).toContain('Card Container Background');
  });

  it('never outputs internal __auto_ compiler identifiers into PSD layers', async () => {
    const src = `
      canvas { size: 400px 400px; }
      group {
        rect { size: 50px 50px; fill: #f00; }
        circle { size: 50px 50px; fill: #0f0; }
        stack {
          text { content: "Item One"; }
          text { content: "Item Two"; }
        }
      }
    `;
    const psd = await psdOf(src, { humanizeLayerNames: true });
    const allLayers = flattenLayers(psd.children || []);
    for (const layer of allLayers) {
      expect(layer.name).not.toMatch(/__auto_\d+/);
    }
  });
});
