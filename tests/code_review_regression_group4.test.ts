import { describe, it, expect } from 'vitest';
import { arcToCubicSegments, polygonToRoundedSvgPath } from '../src/engine/vectorPathParser.js';
import { SvgExporter } from '../src/engine/svgExporter.js';
import { resolveSharedImage, clearImageCache } from '../src/engine/imageCache.js';
import { ImportResolver } from '../src/parser/importResolver.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Regression Review Group 4 Verification Tests', () => {
  // REG-14: arcToCubicSegments handles coincident endpoints and anchors p1
  it('REG-14: arcToCubicSegments returns empty array for coincident endpoints and anchors p1', () => {
    // Exactly or near coincident (within 1e-7)
    const emptySegs = arcToCubicSegments(10, 10, 5, 5, 0, 0, 1, 10.00000001, 10.00000001);
    expect(emptySegs).toHaveLength(0);

    // Valid arc from (0, 0) to (10, 0)
    const segs = arcToCubicSegments(0, 0, 10, 10, 0, 0, 1, 10, 0);
    expect(segs.length).toBeGreaterThan(0);
    const last = segs[segs.length - 1]!;
    expect(last.p1.x).toBe(10);
    expect(last.p1.y).toBe(0);
  });

  // REG-36: polygonToRoundedSvgPath skips arc on collinear points
  it('REG-36: polygonToRoundedSvgPath treats collinear points as straight edges', () => {
    // 3 points in a straight line: (0, 0) -> (50, 0) -> (100, 0), then back via (50, 50)
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 50 }
    ];
    const pathD = polygonToRoundedSvgPath(points, 10);
    expect(pathD).toBeDefined();
    // For the collinear vertex at (50, 0), there should NOT be an arc command that loops back
    // Check that there is no 'A 10 10 ... 50 0' where start and end are at (50, 0)
    expect(pathD).not.toMatch(/A \d+ \d+ \d+ \d+ \d+ 50 0/);
  });

  // REG-18: SvgExporter maintains clipping mask across multiple consecutive siblings
  it('REG-18: SvgExporter clips multiple consecutive siblings until clip: false', async () => {
    const exporter = new SvgExporter();
    const layout: any = {
      canvas: { width: 500, height: 500 },
      nodes: [
        {
          id: 'mask1',
          type: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          style: { clip: true },
          parentId: 'root'
        },
        {
          id: 'child1',
          type: 'rect',
          x: 10,
          y: 10,
          width: 50,
          height: 50,
          style: {},
          parentId: 'root'
        },
        {
          id: 'child2',
          type: 'circle',
          x: 20,
          y: 20,
          width: 40,
          height: 40,
          style: {},
          parentId: 'root'
        }
      ]
    };

    const svg = await exporter.export(layout);
    expect(svg).toBeDefined();
    // Both child1 and child2 must have clip-path attributes referencing the mask
    const child1Match = svg.match(/<rect[^>]+id="child1"[^>]+clip-path="url\(#([^"]+)\)"/);
    const child2Match = svg.match(/<(?:circle|ellipse)[^>]+id="child2"[^>]+clip-path="url\(#([^"]+)\)"/);

    expect(child1Match).not.toBeNull();
    expect(child2Match).not.toBeNull();
    // Both should reference the same clip path
    expect(child1Match![1]).toBe(child2Match![1]);
  });

  // REG-24: ImportResolver allows virtual fileLoader and parent workspace imports
  it('REG-24: ImportResolver allows virtual loaders without throwing security violation', async () => {
    const dummyAst: any = {
      type: 'Document',
      directives: [{ type: 'ImportDirective', path: 'virtual:///shared/tokens.toad' }],
      variables: [],
      components: [],
      elements: []
    };
    const resolver = new ImportResolver(dummyAst, 'virtual:///main.toad', {
      fileLoader: () => '$token = #123456;'
    });

    const res = await resolver.resolve();
    expect(res).toBeDefined();
    expect(res.dependencies.some(d => d.includes('tokens.toad'))).toBe(true);
  });
});
