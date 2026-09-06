import { describe, it, expect } from 'vitest';
import { parseToad } from '../src/parser/parser.js';
import { resolveImportsAndComponents } from '../src/parser/importResolver.js';
import { solveLayout } from '../src/parser/math.js';
import { exportToSvg } from '../src/engine/svgExporter.js';

async function svgOf(src: string, opts: any = {}) {
  const parsed = parseToad(src, 'test.toad');
  const resolved = await resolveImportsAndComponents(parsed, 'test.toad');
  const layout = await solveLayout(resolved);
  return exportToSvg(layout, opts);
}

describe('SVG Exporter: Human Layer Naming', () => {
  it('emits data-name and inkscape:label attributes on groups and shapes', async () => {
    const src = `
      canvas "Hero Banner" { size: 800px 600px; fill: #112233; }
      group #heroContent {
        rect #cardBackground { size: 400px 200px; fill: #ffffff; }
        circle #userAvatar { size: 60px 60px; fill: #00ff00; }
      }
    `;
    const svg = await svgOf(src, { humanizeLayerNames: true });

    expect(svg).toContain('xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"');
    expect(svg).toContain('data-name="Hero Content"');
    expect(svg).toContain('inkscape:label="Hero Content"');
    expect(svg).toContain('data-name="Card Background"');
    expect(svg).toContain('inkscape:label="Card Background"');
    expect(svg).toContain('data-name="User Avatar"');
    expect(svg).toContain('inkscape:label="User Avatar"');
  });

  it('formats text layer data-name as "<TEXT> Text"', async () => {
    const src = `
      canvas { size: 500px 300px; }
      text #welcomeHeading {
        content: "Willkommen zurück";
        font-size: 32px;
      }
    `;
    const svg = await svgOf(src, { humanizeLayerNames: true });

    expect(svg).toContain('data-name="Willkommen zurück Text"');
    expect(svg).toContain('inkscape:label="Willkommen zurück Text"');
    expect(svg).toContain('id="welcomeHeading"');
    expect(svg).toContain('Willkommen zurück');
  });

  it('injects <title> accessible name elements inside <g> containers', async () => {
    const src = `
      canvas { size: 400px 300px; }
      group #actionSection {
        rect { size: 100px 40px; fill: #2563eb; }
      }
    `;
    const svg = await svgOf(src, { humanizeLayerNames: true });

    expect(svg).toContain('<title>Action Section</title>');
  });

  it('omits raw internal __auto_ identifiers from SVG id attributes', async () => {
    const src = `
      canvas { size: 400px 400px; }
      group {
        rect { size: 80px 80px; fill: #f00; }
        circle { size: 40px 40px; fill: #0f0; }
      }
    `;
    const svg = await svgOf(src, { humanizeLayerNames: true });

    expect(svg).not.toMatch(/id="__auto_\d+"/);
    expect(svg).toContain('data-name="Group"');
    expect(svg).toContain('data-name="Circle"');
  });
});
