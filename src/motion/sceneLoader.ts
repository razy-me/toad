/**
 * src/motion/sceneLoader.ts
 * Multi-format scene loader for TOAD Motion.
 * Adapts .toad design scenes, Adobe Photoshop .psd files, and .svg vector files
 * into a unified animatable scene graph.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createCanvas, SKRSContext2D, loadImage, Image, Path2D } from '@napi-rs/canvas';
import { initializeCanvas, readPsd, Psd, Layer } from 'ag-psd';
import { parseToad } from '../parser/parser.js';
import { resolveImportsAndComponents } from '../parser/importResolver.js';
import { solveLayout, LayoutResult, LayoutNode } from '../parser/math.js';
import { CanvasRenderer } from '../engine/canvasRenderer.js';
import { extractBorderSegments, CubicSegment, trimSvgPath, trimSegments, segmentsToPathD } from './pathSampler.js';
import type { ElementMotionState } from './motionSolver.js';

let isPsdCanvasInitialized = false;
function ensurePsdCanvas(): void {
  if (!isPsdCanvasInitialized) {
    initializeCanvas((width: number, height: number) => {
      return createCanvas(width, height) as unknown as HTMLCanvasElement;
    });
    isPsdCanvasInitialized = true;
  }
}

export interface MotionSceneElement {
  id: string; // e.g. "#heroBadge" or "#Headline"
  name: string;
  sourceType: 'toad' | 'psd' | 'svg';
  box: { x: number; y: number; width: number; height: number };
  style: {
    opacity?: number;
    borderRadius?: number | [number, number, number, number] | [number, number];
  };
  layoutNode?: LayoutNode;
  svgPath?: string;
  render(ctx: SKRSContext2D, opacityMultiplier: number, state?: ElementMotionState): void;
}

export interface MotionScene {
  sourcePath: string;
  sourceType: 'toad' | 'psd' | 'svg';
  width: number;
  height: number;
  background?: string;
  elements: Map<string, MotionSceneElement>;
  order: string[]; // render order from back to front
  getElement(id: string): MotionSceneElement | undefined;
  getBorderSegments(id: string): CubicSegment[];
}

/**
 * Loads and adapts a scene from .toad, .psd, or .svg into a unified MotionScene.
 */
export async function loadMotionScene(scenePath: string, baseDir?: string): Promise<MotionScene> {
  const resolvedPath = path.isAbsolute(scenePath)
    ? scenePath
    : path.resolve(baseDir ?? process.cwd(), scenePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Scene file not found: ${resolvedPath}`);
  }

  const ext = path.extname(resolvedPath).toLowerCase();

  if (ext === '.toad') {
    return await loadToadScene(resolvedPath);
  } else if (ext === '.psd') {
    return await loadPsdScene(resolvedPath);
  } else if (ext === '.svg') {
    return await loadSvgScene(resolvedPath);
  } else {
    throw new Error(`Unsupported scene format '${ext}' in TOAD Motion. Supported: .toad, .psd, .svg`);
  }
}

/**
 * Loads native .toad design file
 */
async function loadToadScene(filePath: string): Promise<MotionScene> {
  const code = fs.readFileSync(filePath, 'utf-8');

  const ast = parseToad(code, filePath);
  const resolvedAst = await resolveImportsAndComponents(ast, filePath);
  const layout = await solveLayout(resolvedAst);

  const width = layout.canvas.width;
  const height = layout.canvas.height;
  const background = typeof layout.canvas.background === 'string' ? layout.canvas.background : undefined;

  const elements = new Map<string, MotionSceneElement>();
  const order: string[] = [];

  const sceneDir = path.dirname(filePath);
  const nodesToProcess = layout.nodes || [];
  for (const node of nodesToProcess) {
    const rawId = node.id ? (node.id.startsWith('#') ? node.id : '#' + node.id) : '#' + (node.name || 'node');
    let id = rawId;
    let counter = 1;
    while (elements.has(id)) {
      id = `${rawId}_${counter++}`;
    }

    const nodeW = Math.max(1, node.box.w);
    const nodeH = Math.max(1, node.box.h);

    // Compute extra padding for drop shadows or blurs to prevent edge clipping
    let padding = 0;
    const rawShadows = (node.style as any)?.shadows || (node.style?.shadow ? [node.style.shadow] : []);
    for (const s of rawShadows) {
      const blur = typeof s.blur === 'number' ? s.blur : 0;
      const spread = typeof s.spread === 'number' ? s.spread : 0;
      const ox = Math.abs(typeof s.offsetX === 'number' ? s.offsetX : 0);
      const oy = Math.abs(typeof s.offsetY === 'number' ? s.offsetY : 0);
      const needed = blur + spread + Math.max(ox, oy);
      if (needed > padding) padding = needed;
    }
    const customBlur = (node.style as any)?.blur;
    if (typeof customBlur === 'number') {
      padding = Math.max(padding, customBlur * 2);
    }
    padding = Math.min(Math.ceil(padding), 80);

    const canvasW = nodeW + padding * 2;
    const canvasH = nodeH + padding * 2;

    // Create isolated single-node layout.
    // Crucial: Set children: undefined so container groups do not bake duplicate static copies of their children!
    const origX = (node as any).x ?? node.box.x ?? 0;
    const origY = (node as any).y ?? node.box.y ?? 0;
    const isolatedNode: any = {
      ...node,
      parentId: undefined,
      parent: undefined,
      children: undefined, // Fix container ghosting
      x: padding,
      y: padding,
      width: nodeW,
      height: nodeH,
      box: { x: padding, y: padding, w: nodeW, h: nodeH }
    };

    if (node.polygonLayout?.canvasPoints) {
      isolatedNode.polygonLayout = {
        ...node.polygonLayout,
        canvasPoints: node.polygonLayout.canvasPoints.map((p: any) => ({
          x: p.x - origX + padding,
          y: p.y - origY + padding
        }))
      };
    }

    const singleLayout: any = {
      canvas: {
        ...layout.canvas,
        name: 'isolated',
        width: canvasW,
        height: canvasH,
        background: undefined,
        fill: undefined,
        photoSrc: undefined,
        bleed: 0,
        cropMarks: false
      },
      nodes: [isolatedNode],
      rootNodes: [isolatedNode],
      fonts: layout.fonts || [],
      warnings: [],
      dependencies: []
    };

    const nodeCanvas = await CanvasRenderer.renderToCanvas(singleLayout, {
      basePath: sceneDir
    });

    const element: MotionSceneElement = {
      id,
      name: node.name,
      sourceType: 'toad',
      box: { x: node.box.x, y: node.box.y, width: node.box.w, height: node.box.h },
      style: {
        opacity: node.style?.opacity ?? 1,
        borderRadius: node.style?.borderRadius
      },
      layoutNode: node,
      render: (ctx, opacityMultiplier, state) => {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha *= opacityMultiplier;

        const isTrimming =
          state &&
          (state.strokeEnd !== undefined || state.strokeStart !== undefined);

        if (isTrimming) {
          const start = state.strokeStart ?? 0;
          const end = state.strokeEnd ?? 1;

          if (end <= start || end <= 0) {
            ctx.globalAlpha = prevAlpha;
            return;
          }

          if (end >= 1 && start <= 0 && !state.stroke && !state.strokeWidth) {
            (ctx as any).drawImage(nodeCanvas, -padding, -padding);
            ctx.globalAlpha = prevAlpha;
            return;
          }

          const pathD = node.pathLayout?.d || (node as any).d;
          if (pathD) {
            const trimmedD = trimSvgPath(pathD, start, end, state.trimMode || 'parallel');
            if (trimmedD) {
              ctx.save();
              ctx.strokeStyle = state.stroke || node.style?.stroke || '#000000';
              ctx.lineWidth = state.strokeWidth ?? node.style?.strokeWidth ?? 1;
              ctx.lineCap = (node.style as any)?.strokeCap || 'round';
              ctx.lineJoin = (node.style as any)?.strokeJoin || 'round';
              ctx.stroke(new Path2D(trimmedD));
              ctx.restore();
            }
          } else {
            const localNode = {
              ...node,
              box: { ...node.box, x: 0, y: 0 }
            };
            const borderSegs = extractBorderSegments(localNode);
            if (borderSegs.length > 0) {
              const trimmedSegs = trimSegments(borderSegs, start, end);
              if (trimmedSegs.length > 0) {
                const trimmedD = segmentsToPathD([trimmedSegs]);
                ctx.save();
                ctx.strokeStyle = state.stroke || node.style?.stroke || '#000000';
                ctx.lineWidth = state.strokeWidth ?? node.style?.strokeWidth ?? 1;
                ctx.lineCap = (node.style as any)?.strokeCap || 'round';
                ctx.lineJoin = (node.style as any)?.strokeJoin || 'round';
                ctx.stroke(new Path2D(trimmedD));
                ctx.restore();
              }
            }
          }
        } else {
          (ctx as any).drawImage(nodeCanvas, -padding, -padding);
        }

        ctx.globalAlpha = prevAlpha;
      }
    };

    elements.set(id, element);
    order.push(id);
  }

  const scene: MotionScene = {
    sourcePath: filePath,
    sourceType: 'toad',
    width,
    height,
    background,
    elements,
    order,
    getElement(id: string) {
      const cleanId = id.startsWith('#') ? id : '#' + id;
      return elements.get(cleanId);
    },
    getBorderSegments(id: string): CubicSegment[] {
      const cleanId = id.startsWith('#') ? id : '#' + id;
      const el = elements.get(cleanId);
      if (!el || !el.layoutNode) return [];
      return extractBorderSegments(el.layoutNode);
    }
  };

  return scene;
}

/**
 * Loads Adobe Photoshop .psd file
 */
async function loadPsdScene(filePath: string): Promise<MotionScene> {
  ensurePsdCanvas();
  const buffer = fs.readFileSync(filePath);
  const psd: Psd = readPsd(buffer);

  const width = psd.width;
  const height = psd.height;
  const elements = new Map<string, MotionSceneElement>();
  const order: string[] = [];

  function collectLayers(layers?: Layer[]) {
    if (!layers) return;
    for (const layer of layers) {
      if (layer.hidden) continue;

      const layerName = layer.name?.trim() || 'Layer';
      const cleanName = layerName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const rawId = '#' + (cleanName || 'layer');
      let id = rawId;
      let counter = 1;
      while (elements.has(id)) {
        id = `${rawId}_${counter++}`;
      }

      const left = layer.left ?? 0;
      const top = layer.top ?? 0;
      const right = layer.right ?? left;
      const bottom = layer.bottom ?? top;
      const w = Math.max(1, right - left);
      const h = Math.max(1, bottom - top);

      const layerCanvas = layer.canvas;

      const element: MotionSceneElement = {
        id,
        name: layerName,
        sourceType: 'psd',
        box: { x: left, y: top, width: w, height: h },
        style: {
          opacity: layer.opacity ?? 1
        },
        layoutNode: {
          name: layerName,
          type: 'rect',
          box: { x: left, y: top, w, h },
          style: { opacity: layer.opacity ?? 1, color: '#000000' }
        } as any,
        render: (ctx, opacityMultiplier) => {
          if (!layerCanvas) return;
          const prevAlpha = ctx.globalAlpha;
          ctx.globalAlpha *= opacityMultiplier;
          (ctx as any).drawImage(layerCanvas, 0, 0);
          ctx.globalAlpha = prevAlpha;
        }
      };

      elements.set(id, element);
      order.push(id);

      if (layer.children && layer.children.length > 0) {
        collectLayers(layer.children);
      }
    }
  }

  collectLayers(psd.children);

  const scene: MotionScene = {
    sourcePath: filePath,
    sourceType: 'psd',
    width,
    height,
    elements,
    order,
    getElement(id: string) {
      const cleanId = id.startsWith('#') ? id : '#' + id;
      return elements.get(cleanId);
    },
    getBorderSegments(id: string): CubicSegment[] {
      const cleanId = id.startsWith('#') ? id : '#' + id;
      const el = elements.get(cleanId);
      if (!el || !el.layoutNode) return [];
      return extractBorderSegments(el.layoutNode);
    }
  };

  return scene;
}

function computeSvgPathBBox(d: string): { x: number; y: number; width: number; height: number } | null {
  const nums = d.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
  if (!nums || nums.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < nums.length - 1; i += 2) {
    const x = parseFloat(nums[i]!);
    const y = parseFloat(nums[i + 1]!);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (Number.isFinite(minX) && Number.isFinite(minY) && maxX >= minX && maxY >= minY) {
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  }
  return null;
}

/**
 * Loads Scalable Vector Graphics .svg file
 */
async function loadSvgScene(filePath: string): Promise<MotionScene> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const img: Image = await loadImage(filePath);

  // Extract dimensions from SVG attributes or image
  let width = img.width || 800;
  let height = img.height || 600;

  const wMatch = content.match(/width=["'](\d+(?:\.\d+)?)["']/);
  const hMatch = content.match(/height=["'](\d+(?:\.\d+)?)["']/);
  if (wMatch && wMatch[1]) width = parseFloat(wMatch[1]);
  if (hMatch && hMatch[1]) height = parseFloat(hMatch[1]);

  const elements = new Map<string, MotionSceneElement>();
  const order: string[] = [];

  // F-105: Parse elements with IDs from SVG (including nested inside <g>), without skipping siblings
  const elementRegex = /<(path|rect|circle|ellipse|line|polygon|polyline|g)\b([^>]*?)id=["']([^"']+)["']([^>]*?)>/gis;
  let match: RegExpExecArray | null;

  while ((match = elementRegex.exec(content)) !== null) {
    const tag = match[1]!.toLowerCase();
    const attrs = match[2]! + ' ' + match[4]!;

    // F-109: Ensure unique element IDs across SVG elements
    const rawId = '#' + (match[3] || 'elem');
    let id = rawId;
    let counter = 1;
    while (elements.has(id)) {
      id = `${rawId}_${counter++}`;
    }

    let d: string | undefined;
    // F-108: Compute local element bounding box
    let elemBox = { x: 0, y: 0, width, height };

    if (tag === 'path') {
      const dMatch = attrs.match(/\bd=["']([^"']+)["']/i);
      if (dMatch) {
        d = dMatch[1];
        const bbox = computeSvgPathBBox(d);
        if (bbox) elemBox = bbox;
      }
    } else if (tag === 'rect') {
      const x = parseFloat(attrs.match(/\bx=["']([^"']+)["']/i)?.[1] || '0');
      const y = parseFloat(attrs.match(/\by=["']([^"']+)["']/i)?.[1] || '0');
      const w = parseFloat(attrs.match(/\bwidth=["']([^"']+)["']/i)?.[1] || '0');
      const h = parseFloat(attrs.match(/\bheight=["']([^"']+)["']/i)?.[1] || '0');
      if (w > 0 && h > 0) {
        d = `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
        elemBox = { x, y, width: w, height: h };
      }
    } else if (tag === 'circle') {
      const cx = parseFloat(attrs.match(/\bcx=["']([^"']+)["']/i)?.[1] || '0');
      const cy = parseFloat(attrs.match(/\bcy=["']([^"']+)["']/i)?.[1] || '0');
      const r = parseFloat(attrs.match(/\br=["']([^"']+)["']/i)?.[1] || '0');
      if (r > 0) {
        d = `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
        elemBox = { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
      }
    } else if (tag === 'ellipse') {
      const cx = parseFloat(attrs.match(/\bcx=["']([^"']+)["']/i)?.[1] || '0');
      const cy = parseFloat(attrs.match(/\bcy=["']([^"']+)["']/i)?.[1] || '0');
      const rx = parseFloat(attrs.match(/\brx=["']([^"']+)["']/i)?.[1] || '0');
      const ry = parseFloat(attrs.match(/\bry=["']([^"']+)["']/i)?.[1] || '0');
      if (rx > 0 && ry > 0) {
        d = `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`;
        elemBox = { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 };
      }
    }

    const element: MotionSceneElement = {
      id,
      name: match[3]!,
      sourceType: 'svg',
      box: elemBox,
      style: { opacity: 1 },
      svgPath: d,
      layoutNode: tag === 'path' && d ? {
        name: match[3]!,
        type: 'path',
        box: { x: elemBox.x, y: elemBox.y, w: elemBox.width, h: elemBox.height },
        style: { color: '#000000' },
        d
      } as any : {
        name: match[3]!,
        type: 'rect',
        box: { x: elemBox.x, y: elemBox.y, w: elemBox.width, h: elemBox.height },
        style: { color: '#000000' }
      } as any,
      render: (ctx, opacityMultiplier, state) => {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha *= opacityMultiplier;
        if (d) {
          ctx.save();
          // Translate to align local element origin
          ctx.translate(-elemBox.x, -elemBox.y);

          const isTrimming =
            state &&
            (state.strokeEnd !== undefined || state.strokeStart !== undefined);

          let activeD = d;
          if (isTrimming) {
            const start = state.strokeStart ?? 0;
            const end = state.strokeEnd ?? 1;
            if (end <= start || end <= 0) {
              ctx.restore();
              ctx.globalAlpha = prevAlpha;
              return;
            }
            activeD = trimSvgPath(d, start, end, state.trimMode || 'parallel');
          }

          if (activeD) {
            const p2d = new Path2D(activeD);
            const fillMatch = attrs.match(/\bfill=["']([^"']+)["']/i);
            const fill = fillMatch ? fillMatch[1] : (tag === 'path' ? '#000000' : 'none');
            if (fill !== 'none' && !isTrimming) {
              ctx.fillStyle = fill;
              ctx.fill(p2d);
            }
            const strokeMatch = attrs.match(/\bstroke=["']([^"']+)["']/i);
            if (strokeMatch && strokeMatch[1] !== 'none') {
              ctx.strokeStyle = state?.stroke || strokeMatch[1]!;
              const swMatch = attrs.match(/\bstroke-width=["']([^"']+)["']/i);
              ctx.lineWidth = state?.strokeWidth ?? (swMatch ? parseFloat(swMatch[1]!) : 1);
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.stroke(p2d);
            }
          }
          ctx.restore();
        }
        ctx.globalAlpha = prevAlpha;
      }
    };

    elements.set(id, element);
    order.push(id);
  }

  // If no individual IDs found, treat entire SVG as #main
  if (elements.size === 0) {
    const id = '#main';
    elements.set(id, {
      id,
      name: 'main',
      sourceType: 'svg',
      box: { x: 0, y: 0, width, height },
      style: { opacity: 1 },
      layoutNode: {
        name: 'main',
        type: 'rect',
        box: { x: 0, y: 0, w: width, h: height },
        style: { color: '#000000' }
      } as any,
      render: (ctx, opacityMultiplier) => {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha *= opacityMultiplier;
        (ctx as any).drawImage(img, 0, 0);
        ctx.globalAlpha = prevAlpha;
      }
    });
    order.push(id);
  }

  const scene: MotionScene = {
    sourcePath: filePath,
    sourceType: 'svg',
    width,
    height,
    elements,
    order,
    getElement(id: string) {
      const cleanId = id.startsWith('#') ? id : '#' + id;
      return elements.get(cleanId);
    },
    getBorderSegments(id: string): CubicSegment[] {
      const cleanId = id.startsWith('#') ? id : '#' + id;
      const el = elements.get(cleanId);
      if (!el || !el.layoutNode) return [];
      return extractBorderSegments(el.layoutNode);
    }
  };

  return scene;
}
