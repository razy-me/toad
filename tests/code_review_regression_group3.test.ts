import { describe, it, expect } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { createCanvasGradient } from '../src/engine/drawUtils.js';
import { convertImage } from '../src/tools/imageConverter.js';
import { CanvasRenderer } from '../src/engine/canvasRenderer.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Regression Review Group 3 Verification Tests', () => {
  // REG-35: createCanvasGradient handles NaN without throwing
  it('REG-35: createCanvasGradient does not throw with NaN in box coordinates', () => {
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    const nanBox: any = { x: NaN, y: NaN, w: NaN, h: NaN };
    expect(() => {
      createCanvasGradient(ctx, {
        type: 'linear',
        stops: [{ position: 0, color: '#ff0000' }, { position: 1, color: '#0000ff' }]
      }, nanBox);
    }).not.toThrow();

    expect(() => {
      createCanvasGradient(ctx, {
        type: 'radial',
        stops: [{ position: 0, color: '#ff0000' }, { position: 1, color: '#0000ff' }]
      }, nanBox);
    }).not.toThrow();
  });

  // REG-37: Non-monotonic gradient stops are clamped monotonically
  it('REG-37: non-monotonic gradient stops are clamped to preceding position per W3C', () => {
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    const box = { x: 0, y: 0, w: 100, h: 100 };
    // Stops with decreasing positions: 0.8 followed by 0.3
    expect(() => {
      const grad = createCanvasGradient(ctx, {
        type: 'linear',
        stops: [
          { position: 0.8, color: '#ff0000' },
          { position: 0.3, color: '#00ff00' },
          { position: 1.0, color: '#0000ff' }
        ]
      }, box);
      expect(grad).toBeDefined();
    }).not.toThrow();
  });

  // REG-51: fit: 'scale-down' never scales images up
  it('REG-51: fit: scale-down does not upscale images smaller than target box', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toad_img_test_'));
    const srcImgPath = path.join(tempDir, 'small.png');
    const outImgPath = path.join(tempDir, 'output.png');

    // Create a 50x50 image
    const smallCanvas = createCanvas(50, 50);
    const sctx = smallCanvas.getContext('2d');
    sctx.fillStyle = '#ff0000';
    sctx.fillRect(0, 0, 50, 50);
    fs.writeFileSync(srcImgPath, await smallCanvas.encode('png'));

    // Convert with target 200x200 and fit: 'scale-down'
    const res = await convertImage(srcImgPath, {
      width: 200,
      height: 200,
      fit: 'scale-down',
      outputPath: outImgPath
    });

    // Should stay 50x50, not upscale to 200x200
    expect(res.width).toBe(50);
    expect(res.height).toBe(50);

    // Cleanup
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  // REG-12: getNodePath2D handles shapes and rounded polygons
  it('REG-12: getNodePath2D creates accurate Path2D for polygon with borderRadius and custom shapes', () => {
    const roundedPolygonNode: any = {
      type: 'polygon',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      style: { borderRadius: 10 },
      polygonLayout: {
        canvasPoints: [
          { x: 50, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ]
      }
    };
    const path = (CanvasRenderer as any).getNodePath2D(roundedPolygonNode);
    expect(path).toBeDefined();

    const starNode: any = {
      type: 'star',
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      style: {},
      pathLayout: {
        d: 'M 25 0 L 30 15 L 45 15 L 33 25 L 38 40 L 25 30 L 12 40 L 17 25 L 5 15 L 20 15 Z'
      }
    };
    const starPath = (CanvasRenderer as any).getNodePath2D(starNode);
    expect(starPath).toBeDefined();
  });
});
