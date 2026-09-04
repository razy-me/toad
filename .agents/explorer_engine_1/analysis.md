# Architectural Analysis: Rendering Engine, PSD Exporter, Font Loader, Build Pipeline, CLI & Testing

**Author:** explorer_engine_1  
**Date:** 2026-08-18  
**Scope:** @napi-rs/canvas Raster Engine, ag-psd PSD Exporter, Font Loader, Build Pipeline, Commander CLI, Watch Mode, Package Manifest, and Testing Architecture.

---

## 1. Raster Rendering Architecture (@napi-rs/canvas)

### 1.1 Overview & Engine Selection
`@napi-rs/canvas` is a high-performance native Canvas implementation for Node.js powered by Google's Skia 2D graphics engine via Rust N-API bindings. It strictly follows the W3C HTML Canvas 2D Context specification with extended Skia capabilities (high-precision text metrics, native CSS filter strings, zero-copy buffer encoding).

```
┌────────────────────────────────────────────────────────┐
│                   TOAD Layout Tree                     │
│  (Resolved Absolute Coordinates, Bounds, Styles, Colors)│
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   canvasRenderer.ts                    │
│                                                        │
│  1. Create Canvas: (width * scale, height * scale)     │
│  2. Apply Transform: ctx.scale(scale, scale)           │
│  3. Recursive Tree Traversal:                          │
│     ├── Groups & Containers (Opacity, Blend, Clip)     │
│     ├── Vector Shapes (Rect, Circle, Polygon, Path)    │
│     ├── Gradients (Linear, Radial, Distributed Stops)  │
│     ├── Images (Fit: fill | cover | contain | none)    │
│     ├── Text Elements (Skia metrics, Baseline align)   │
│     └── CSS Filters (ctx.filter Skia pipeline)         │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                  Buffer Encoding                       │
│    canvas.encode('png') / canvas.encode('jpeg', q)     │
└────────────────────────────────────────────────────────┘
```

---

### 1.2 Drawing Paths & Shapes
All shapes in the TOAD layout tree have resolved absolute bounding boxes `(x, y, width, height)`.

#### 1. Rectangles & Rounded Rectangles
- **Path Construction:**
  - Standard rect: `ctx.rect(elem.x, elem.y, elem.width, elem.height)`.
  - Rounded rect (`radius: r` or `radius: [tl, tr, br, bl]`):
    ```ts
    if (typeof elem.radius === 'number' && elem.radius > 0) {
      ctx.roundRect(elem.x, elem.y, elem.width, elem.height, elem.radius);
    } else if (Array.isArray(elem.radius)) {
      ctx.roundRect(elem.x, elem.y, elem.width, elem.height, elem.radius);
    } else {
      ctx.rect(elem.x, elem.y, elem.width, elem.height);
    }
    ```

#### 2. Circles & Ellipses
- For `circle` or `ellipse` with center `(cx, cy)` and radius `r` (or `rx, ry`):
  ```ts
  ctx.beginPath();
  const cx = elem.x + elem.width / 2;
  const cy = elem.y + elem.height / 2;
  const rx = elem.width / 2;
  const ry = elem.height / 2;
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ```

#### 3. Polygons (Center-Relative Local Coordinate Space)
- **Design Rule 3:** Polygon points are declared in local coordinates relative to the element's own center `(cx, cy)`.
- Given center `cx = elem.x + elem.width / 2` and `cy = elem.y + elem.height / 2`:
  ```ts
  ctx.beginPath();
  if (elem.points && elem.points.length > 0) {
    const p0 = elem.points[0];
    ctx.moveTo(cx + p0.x, cy + p0.y);
    for (let i = 1; i < elem.points.length; i++) {
      const p = elem.points[i];
      ctx.lineTo(cx + p.x, cy + p.y);
    }
    ctx.closePath();
  }
  ```

---

### 1.3 Fill, Stroke, and Color Handling
- **Fill Execution:**
  - Solid color: `ctx.fillStyle = resolvedColorString; ctx.fill();`
  - Gradient: `ctx.fillStyle = createGradient(ctx, elem); ctx.fill();`
- **Stroke Execution:**
  - Stroke width: `ctx.lineWidth = elem.strokeWidth ?? 1;`
  - Stroke alignment:
    - Default Canvas strokes are centered on the path.
    - If `strokeAlign: 'inside'` or `'outside'`: apply clipping path or stroke width offset adjustments.
  - Line caps / joins:
    - `ctx.lineCap = elem.strokeCap ?? 'butt';` (`butt` | `round` | `square`)
    - `ctx.lineJoin = elem.strokeJoin ?? 'miter';` (`miter` | `round` | `bevel`)
  - Dash patterns: `if (elem.strokeDash) ctx.setLineDash(elem.strokeDash);`
  - Stroke color: `ctx.strokeStyle = resolvedStrokeColor; ctx.stroke();`

---

### 1.4 Gradient Stop Distribution Algorithm
**Design Rule 8:** Missing stop positions are evenly distributed between adjacent stops.

#### Mathematical Algorithm
Let stops be $S = [s_0, s_1, \dots, s_{n-1}]$.
1. If $s_0.\text{position}$ is undefined, set $s_0.\text{position} = 0.0$.
2. If $s_{n-1}.\text{position}$ is undefined, set $s_{n-1}.\text{position} = 1.0$.
3. For any intermediate contiguous block of stops without defined positions from index $i$ to index $j$ ($i < j$), where $s_i.\text{position} = p_i$ is known, $s_j.\text{position} = p_j$ is known, and $s_k.\text{position}$ is undefined for all $i < k < j$:
   $$\text{count} = j - i$$
   $$s_k.\text{position} = p_i + (k - i) \times \frac{p_j - p_i}{\text{count}}$$

#### Implementation (`drawUtils.ts`)
```ts
export interface GradientStop {
  color: string;
  position?: number;
}

export function distributeGradientStops(stops: GradientStop[]): { color: string; position: number }[] {
  if (stops.length === 0) return [];
  if (stops.length === 1) return [{ color: stops[0].color, position: stops[0].position ?? 0 }];

  const result: { color: string; position: number }[] = stops.map(s => ({
    color: s.color,
    position: s.position ?? -1
  }));

  if (result[0].position === -1) result[0].position = 0;
  if (result[result.length - 1].position === -1) result[result.length - 1].position = 1;

  let lastDefinedIndex = 0;
  for (let i = 1; i < result.length; i++) {
    if (result[i].position !== -1) {
      const startPos = result[lastDefinedIndex].position;
      const endPos = result[i].position;
      const step = (endPos - startPos) / (i - lastDefinedIndex);
      for (let k = lastDefinedIndex + 1; k < i; k++) {
        result[k].position = startPos + step * (k - lastDefinedIndex);
      }
      lastDefinedIndex = i;
    }
  }

  return result;
}
```

#### Gradient Construction
- **Linear Gradient:**
  - Defined by angle $\theta$ (in degrees or radians) or points $(x_0, y_0) \to (x_1, y_1)$ across element bbox.
  - From angle $\theta$ (CSS standard: 0deg = to top, 90deg = to right, 180deg = to bottom):
    $$\text{cx} = x + w / 2, \quad \text{cy} = y + h / 2$$
    $$r = \frac{|w \cdot \sin\theta| + |h \cdot \cos\theta|}{2}$$
    $$x_0 = \text{cx} - r \cdot \sin\theta, \quad y_0 = \text{cy} + r \cdot \cos\theta$$
    $$x_1 = \text{cx} + r \cdot \sin\theta, \quad y_1 = \text{cy} - r \cdot \cos\theta$$
  - `const grad = ctx.createLinearGradient(x0, y0, x1, y1);`
  - For each distributed stop: `grad.addColorStop(stop.position, stop.color);`
- **Radial Gradient:**
  - `const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) / 2);`

---

### 1.5 Blend Modes Mapping
The TOAD DSL supports standard blend modes. `@napi-rs/canvas` supports all Canvas 2D `globalCompositeOperation` values:

| DSL Blend Mode | Canvas 2D `globalCompositeOperation` | ag-psd `Layer.blendMode` |
|---|---|---|
| `normal` | `'source-over'` | `'normal'` |
| `multiply` | `'multiply'` | `'multiply'` |
| `screen` | `'screen'` | `'screen'` |
| `overlay` | `'overlay'` | `'overlay'` |
| `darken` | `'darken'` | `'darken'` |
| `lighten` | `'lighten'` | `'lighten'` |
| `color-dodge` | `'color-dodge'` | `'color dodge'` |
| `color-burn` | `'color-burn'` | `'color burn'` |
| `hard-light` | `'hard-light'` | `'hard light'` |
| `soft-light` | `'soft-light'` | `'soft light'` |
| `difference` | `'difference'` | `'difference'` |
| `exclusion` | `'exclusion'` | `'exclusion'` |
| `hue` | `'hue'` | `'hue'` |
| `saturation` | `'saturation'` | `'saturation'` |
| `color` | `'color'` | `'color'` |
| `luminosity` | `'luminosity'` | `'luminosity'` |

---

### 1.6 CSS Filter String Parsing & Application
**Design Rule 9:** Filter syntax is a space-separated property line:
`filter: blur(4px) saturate(1.5);`

`@napi-rs/canvas` natively exposes `ctx.filter` powered by Skia image filters.

#### Filter Parser & Sanitizer
```ts
export function parseAndApplyFilter(ctx: SKRSContext2D, filterStr?: string): void {
  if (!filterStr || filterStr.trim() === 'none' || filterStr.trim() === '') {
    ctx.filter = 'none';
    return;
  }
  // Sanitize and set directly to ctx.filter
  // Supported functions: blur(), brightness(), contrast(), drop-shadow(),
  // grayscale(), hue-rotate(), invert(), opacity(), saturate(), sepia()
  ctx.filter = filterStr.trim();
}
```
State management ensures isolation:
```ts
ctx.save();
parseAndApplyFilter(ctx, elem.filter);
// Draw element
ctx.restore(); // Restores previous filter and transform
```

---

### 1.7 Clipping Masks Architecture
Hierarchical clipping is executed via Canvas context isolation:
1. `ctx.save()`
2. Construct mask geometry:
   - If mask is rect: `ctx.rect(mask.x, mask.y, mask.w, mask.h)`
   - If mask is circle/polygon: trace path
3. `ctx.clip()`
4. Render all masked child elements
5. `ctx.restore()`

---

### 1.8 Image Fit Options
**Design Rule 7:** Default image fit is `fill`, with optional `fit: cover;`, `fit: contain;`, `fit: none;`.

Let target element bounding box be $(bx, by, bw, bh)$ and natural image dimensions be $(iw, ih)$.

| Fit Mode | Scaling Formula | Destination Coordinates $(dx, dy, dw, dh)$ | Clipping Required? |
|---|---|---|---|
| `fill` (default) | Stretches to fill bounds | $dx = bx, dy = by, dw = bw, dh = bh$ | No |
| `cover` | $s = \max(bw / iw, bh / ih)$ | $dw = iw \cdot s, dh = ih \cdot s$<br>$dx = bx + (bw - dw) / 2$<br>$dy = by + (bh - dh) / 2$ | **Yes** (clip to $[bx, by, bw, bh]$) |
| `contain` | $s = \min(bw / iw, bh / ih)$ | $dw = iw \cdot s, dh = ih \cdot s$<br>$dx = bx + (bw - dw) / 2$<br>$dy = by + (bh - dh) / 2$ | No |
| `none` | $s = 1.0$ | $dw = iw, dh = ih$<br>$dx = bx + (bw - dw) / 2$<br>$dy = by + (bh - dh) / 2$ | **Yes** (clip to $[bx, by, bw, bh]$) |

#### Implementation (`canvasRenderer.ts`)
```ts
export function drawImageWithFit(
  ctx: SKRSContext2D,
  img: Image,
  fit: 'fill' | 'cover' | 'contain' | 'none' = 'fill',
  bx: number, by: number, bw: number, bh: number
): void {
  const iw = img.width;
  const ih = img.height;

  if (fit === 'fill') {
    ctx.drawImage(img, bx, by, bw, bh);
    return;
  }

  let scale = 1.0;
  if (fit === 'cover') {
    scale = Math.max(bw / iw, bh / ih);
  } else if (fit === 'contain') {
    scale = Math.min(bw / iw, bh / ih);
  } else if (fit === 'none') {
    scale = 1.0;
  }

  const dw = iw * scale;
  const dh = ih * scale;
  const dx = bx + (bw - dw) / 2;
  const dy = by + (bh - dh) / 2;

  if (fit === 'cover' || fit === 'none') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(img, dx, dy, dw, dh);
  }
}
```

---

### 1.9 Multi-Scale Rendering & Encoding
- Given root layout canvas dimensions $W \times H$:
  - Scale factor $S \in \{1, 2, 4\}$.
  - Target pixel dimensions: $W_{\text{target}} = \text{Math.round}(W \times S)$, $H_{\text{target}} = \text{Math.round}(H \times S)$.
  - Canvas creation: `const canvas = createCanvas(W_target, H_target);`
  - Scale transform: `ctx.scale(S, S);`
- **Output Formats:**
  - PNG: `await canvas.encode('png')`
  - JPG: `await canvas.encode('jpeg', 90)` (quality 0–100)

---

## 2. PSD Export Architecture (ag-psd)

### 2.1 Overview & ag-psd Adapter
`ag-psd` produces industry-standard, fully layered `.psd` files readable by Adobe Photoshop, Illustrator, Figma, and Affinity Designer.

To operate in Node.js without native DOM dependencies, `ag-psd` is initialized with `@napi-rs/canvas`:
```ts
import { initializeCanvas, writePsd, Psd, Layer } from 'ag-psd';
import { createCanvas } from '@napi-rs/canvas';

// Configure ag-psd to use @napi-rs/canvas
initializeCanvas((width: number, height: number) => {
  return createCanvas(width, height) as unknown as HTMLCanvasElement;
});
```

---

### 2.2 PSD Document Structure
```ts
export interface PsdExportOptions {
  scale?: number; // default 1
  dpi?: number;   // default 72 * scale
}

export function createPsdDocument(root: ResolvedLayoutRoot, options: PsdExportOptions = {}): Psd {
  const scale = options.scale ?? 1;
  return {
    width: Math.round(root.width * scale),
    height: Math.round(root.height * scale),
    channels: 3,
    bitsPerChannel: 8,
    colorMode: 3, // 3 = RGB
    children: []  // Layer hierarchy
  };
}
```

---

### 2.3 Layer Hierarchy & Layer Groups
In `ag-psd`, a Layer Group (folder) is represented by a `Layer` node containing a non-empty `children` array and `opened: true`:

```ts
export function buildPsdLayerGroup(groupNode: ResolvedGroupNode, scale: number): Layer {
  return {
    name: groupNode.id || groupNode.name || 'Group',
    opened: true,
    opacity: groupNode.opacity ?? 1,
    blendMode: mapBlendModeToPsd(groupNode.blendMode),
    children: groupNode.children.map(child => buildPsdLayer(child, scale))
  };
}
```

---

### 2.4 Clipping Masks in PSD
In Photoshop PSD file structure, clipping masks are defined linearly:
- Base Mask Layer: `clipping: false`
- Clipped Layers (placed directly above the mask in layer order): `clipping: true`

When converting a TOAD container with `clip: true` or an explicit mask:
```ts
// 1. Base mask layer
const maskLayer: Layer = {
  name: `${container.id || 'Mask'} (Mask)`,
  left: Math.round(maskBounds.x * scale),
  top: Math.round(maskBounds.y * scale),
  right: Math.round((maskBounds.x + maskBounds.width) * scale),
  bottom: Math.round((maskBounds.y + maskBounds.height) * scale),
  clipping: false,
  canvas: renderShapeToIsolatedCanvas(maskShape, scale)
};

// 2. Clipped child layers
const clippedLayers: Layer[] = container.children.map(child => {
  const layer = buildPsdLayer(child, scale);
  layer.clipping = true; // Clips to maskLayer
  return layer;
});
```

---

### 2.5 Native Editable Photoshop Text Layers
`ag-psd` allows creating full native Photoshop text layers with formatting, font mapping, leading, and tracking, combined with raster fallbacks.

```ts
export function buildPsdTextLayer(textNode: ResolvedTextNode, scale: number): Layer {
  const left = Math.round(textNode.x * scale);
  const top = Math.round(textNode.y * scale);
  const width = Math.round(textNode.width * scale);
  const height = Math.round(textNode.height * scale);

  const rgba = parseColorToRgba(textNode.color);
  const fontSizePx = (textNode.fontSize ?? 16) * scale;

  const layer: Layer = {
    name: textNode.text.slice(0, 30) || 'Text',
    left,
    top,
    right: left + width,
    bottom: top + height,
    opacity: textNode.opacity ?? 1,
    blendMode: mapBlendModeToPsd(textNode.blendMode),
    
    // Native Photoshop Editable Text Object
    text: {
      text: textNode.text,
      transform: [1, 0, 0, 1, left, top + fontSizePx],
      style: {
        font: { name: mapFontFamilyToPostScript(textNode.fontFamily) },
        fontSize: fontSizePx,
        fillColor: { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a },
        leading: textNode.lineHeight ? textNode.lineHeight * scale : undefined,
        tracking: textNode.letterSpacing ? textNode.letterSpacing * 20 : undefined
      },
      paragraphStyle: {
        justification: textNode.align === 'center' ? 'center' :
                       textNode.align === 'right' ? 'right' : 'left'
      }
    },

    // Raster fallback canvas for backwards compatibility
    canvas: renderTextToIsolatedCanvas(textNode, scale)
  };

  return layer;
}
```

---

### 2.6 Isolated Layer Rasterization (Vector & Image Elements)
For shapes, paths, gradients, and images:
1. Create an isolated offscreen `@napi-rs/canvas` with dimensions `Math.ceil(elem.width * scale)` by `Math.ceil(elem.height * scale)`.
2. Translate context by `(-elem.x * scale, -elem.y * scale)`.
3. Draw the element (paths, fills, strokes, image).
4. Assign to `layer.canvas`.
5. Set `layer.left = Math.round(elem.x * scale)`, `layer.top = Math.round(elem.y * scale)`, etc.

---

## 3. Font Loading Architecture

### 3.1 Dual Font Loading Mechanism
The TOAD compiler supports two distinct font loading pathways:

```
                  ┌───────────────────────────────┐
                  │      CLI: --fonts <dir>       │
                  └──────────────┬────────────────┘
                                 │ Scans directory (.ttf, .otf, .woff2)
                                 ▼
┌──────────────────────┐  GlobalFonts.registerFromPath(file, alias)
│ Inline DSL Directive │─────────►┌────────────────────────────────┐
│ @font "p.ttf" as "F";│          │  @napi-rs/canvas GlobalFonts   │
└──────────────────────┘          └────────────────┬───────────────┘
                                                   │
                                                   ▼
                                       Headless Skia Text Engine
                                     (Font Metrics & Rasterizer)
```

---

### 3.2 Font Loader Implementation (`fontLoader.ts`)
```ts
import { GlobalFonts } from '@napi-rs/canvas';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class FontLoader {
  private static registeredFamilies = new Set<string>();

  /**
   * Registers a single font file with optional alias
   */
  public static registerFontFile(filePath: string, alias?: string): boolean {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      console.warn(`[FontLoader] Font file not found: ${resolvedPath}`);
      return false;
    }

    try {
      const success = GlobalFonts.registerFromPath(resolvedPath, alias);
      if (success) {
        const familyName = alias || path.basename(resolvedPath, path.extname(resolvedPath));
        this.registeredFamilies.add(familyName);
      }
      return success;
    } catch (err) {
      console.error(`[FontLoader] Failed to register font ${resolvedPath}:`, err);
      return false;
    }
  }

  /**
   * Scans a directory for all .ttf, .otf, .woff, .woff2 fonts and registers them
   */
  public static registerFontDirectory(dirPath: string): number {
    const resolvedDir = path.resolve(dirPath);
    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
      console.warn(`[FontLoader] Font directory does not exist: ${resolvedDir}`);
      return 0;
    }

    const fontExts = new Set(['.ttf', '.otf', '.woff', '.woff2']);
    let count = 0;

    const files = fs.readdirSync(resolvedDir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (fontExts.has(ext)) {
        const fullPath = path.join(resolvedDir, file);
        if (this.registerFontFile(fullPath)) {
          count++;
        }
      }
    }
    return count;
  }

  public static hasFont(family: string): boolean {
    return GlobalFonts.has(family) || this.registeredFamilies.has(family);
  }

  public static getAvailableFamilies(): string[] {
    return GlobalFonts.families.map(f => f.family);
  }
}
```

---

## 4. Build Pipeline & CLI Specification

### 4.1 Build Orchestration Pipeline (`build.ts`)
The `build.ts` module coordinates all phases into a unified programmatic API:

```ts
export interface BuildOptions {
  scale?: 1 | 2 | 4;
  format?: 'png' | 'jpg' | 'psd' | 'all';
  outDir?: string;
  fontsDir?: string;
  watch?: boolean;
}

export interface BuildOutput {
  format: 'png' | 'jpg' | 'psd';
  scale: number;
  filePath: string;
  buffer: Buffer;
  timeMs: number;
}

export interface BuildResult {
  entryFile: string;
  outputs: BuildOutput[];
  dependencies: string[]; // For watch mode
  warnings: string[];
}
```

#### Pipeline Execution Sequence
1. **Font Ingestion:** If `options.fontsDir` is provided, register all fonts via `FontLoader.registerFontDirectory`.
2. **File Ingestion & Lexing:** Read `entryFile`, tokenize with `lexer.ts`.
3. **AST Parsing:** Parse tokens with `parser.ts`.
4. **Resolution Pass (`importResolver.ts`):**
   - Resolve `@import` paths recursively, cycle check.
   - Resolve inline `@font` directives relative to source file.
   - Substitute variables and expand components with parameter overrides.
5. **Layout Solving (`layoutSolver.ts`):**
   - Calculate canvas dimensions and GCD aspect ratio.
   - Propagate `currentColor` statically down the tree.
   - Measure text bounding boxes with Skia context.
   - Topologically sort elements for relational positioning (`at: right of #id`).
   - Resolve center-relative polygon coordinates and tile grids.
6. **Rendering & Exporting:**
   - For `png`: `CanvasRenderer.render(layoutTree, { scale, format: 'png' })`
   - For `jpg`: `CanvasRenderer.render(layoutTree, { scale, format: 'jpg' })`
   - For `psd`: `PsdExporter.export(layoutTree, { scale })`
7. **Disk Output:** Write buffers to `outDir` (default `./dist`).

---

### 4.2 CLI Specification (`cli.ts`)
Built using `commander`:

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { compileTOAD } from './build.js';
import { startWatchMode } from './watch.js';
import * as path from 'node:path';

const program = new Command();

program
  .name('TOAD')
  .description('Compiler and multi-format renderer for the TOAD declarative design DSL')
  .version('1.0.0');

program
  .command('build')
  .description('Compile a .TOAD file to PNG, JPG, or PSD')
  .argument('<entry>', 'Entry .TOAD file path')
  .option('-s, --scale <number>', 'Scale factor (1, 2, or 4)', (val) => {
    const num = parseInt(val, 10);
    if (![1, 2, 4].includes(num)) throw new Error('Scale must be 1, 2, or 4');
    return num;
  }, 1)
  .option('-f, --format <format>', 'Output format (png, jpg, psd, all)', 'png')
  .option('-o, --out <dir>', 'Output destination directory', './dist')
  .option('--fonts <dir>', 'Directory containing custom font files')
  .option('-w, --watch', 'Watch entry file and dependencies for changes', false)
  .action(async (entry: string, options: any) => {
    const entryPath = path.resolve(process.cwd(), entry);

    if (options.watch) {
      await startWatchMode(entryPath, options);
    } else {
      const start = performance.now();
      const result = await compileTOAD(entryPath, options);
      const elapsed = (performance.now() - start).toFixed(1);
      console.log(`✨ Successfully built ${result.outputs.length} file(s) in ${elapsed}ms:`);
      for (const out of result.outputs) {
        console.log(`   - ${out.filePath} (${(out.buffer.length / 1024).toFixed(1)} KB)`);
      }
    }
  });

program.parse(process.argv);
```

---

## 5. Watch Mode Architecture

### 5.1 Dynamic Dependency Graph Tracking
Watch mode observes the entry file and all transitively imported `.TOAD` files, images, and fonts. When any file changes:
1. Re-run compilation.
2. Update the watch set if new imports were added or removed.
3. Debounce re-compilations (e.g. 100ms) to avoid thrashing on multi-file saves.

```
┌────────────────────────────────────────────────────────┐
│                   chokidar Watcher                     │
│  [entry.TOAD, components.TOAD, theme.TOAD, font.ttf]   │
└──────────────────────────┬─────────────────────────────┘
                           │ onChange(filePath)
                           ▼
┌────────────────────────────────────────────────────────┐
│                  Debounce Controller                   │
│                 (100ms trailing edge)                  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                      Recompile                         │
│  1. compileTOAD(entryPath, options)                    │
│  2. diff new dependencies vs active watcher paths      │
│  3. watcher.add(newDeps) / watcher.unwatch(removedDeps)│
│  4. Log completion timestamp & duration                │
└────────────────────────────────────────────────────────┘
```

---

## 6. Complete Dependency Manifest & Config

### 6.1 `package.json`
```json
{
  "name": "TOAD",
  "version": "1.0.0",
  "description": "Standalone Node.js compiler, layout solver, raster renderer, and Photoshop PSD exporter for the TOAD declarative design DSL",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "TOAD": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "start": "node dist/cli.js"
  },
  "dependencies": {
    "@napi-rs/canvas": "^0.1.65",
    "ag-psd": "^22.1.0",
    "commander": "^12.1.0",
    "chokidar": "^3.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.12",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 6.2 `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## 7. Testing Architecture & Golden Comparison Strategy

### 7.1 Vitest Configuration (`vitest.config.ts`)
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts']
    }
  }
});
```

---

### 7.2 Golden Image Comparison Strategy
To ensure pixel-perfect rendering regressions are immediately caught:
1. **Pre-computed Hashes / Bitmaps:** Complex fixtures (`card.TOAD`, `dashboard.TOAD`, `typography.TOAD`, `masks.TOAD`) are rendered to 1x and 2x PNG buffers.
2. **Comparison Methods:**
   - **Exact SHA-256 Bitstream Hash:** For deterministic rendering verification across identical Skia versions.
   - **Pixel Buffer Diffing:**
     ```ts
     export function compareImageBuffers(bufA: Buffer, bufB: Buffer): number {
       if (bufA.equals(bufB)) return 0;
       // Compute byte-level or pixel-level difference percentage
       let diffCount = 0;
       const len = Math.min(bufA.length, bufB.length);
       for (let i = 0; i < len; i++) {
         if (bufA[i] !== bufB[i]) diffCount++;
       }
       return diffCount / len;
     }
     ```

---

### 7.3 PSD Structure Verification Strategy
Using `readPsd` from `ag-psd` to verify output `.psd` files:
```ts
import { readPsd } from 'ag-psd';

export function verifyPsdStructure(psdBuffer: Buffer) {
  const psd = readPsd(psdBuffer, { readLayers: true });
  
  // 1. Validate root dimensions
  expect(psd.width).toBeGreaterThan(0);
  expect(psd.height).toBeGreaterThan(0);
  expect(psd.colorMode).toBe(3); // RGB

  // 2. Validate layers & groups
  expect(psd.children).toBeDefined();
  expect(psd.children!.length).toBeGreaterThan(0);

  // 3. Validate editable text layers
  const textLayer = psd.children!.find(l => l.text !== undefined);
  if (textLayer) {
    expect(textLayer.text!.text).toBeTruthy();
    expect(textLayer.text!.style).toBeDefined();
  }
}
```

---

## 8. Summary & Interface Matrix

| Module | Primary Export | Primary Responsibility |
|---|---|---|
| `canvasRenderer.ts` | `CanvasRenderer.render(root, options)` | Traverses layout tree, renders to Skia 2D context, encodes PNG/JPG |
| `psdExporter.ts` | `PsdExporter.export(root, options)` | Converts layout tree to native layered PSD via `ag-psd` |
| `fontLoader.ts` | `FontLoader` | Manages `GlobalFonts` registration from CLI and `@font` directives |
| `drawUtils.ts` | `distributeGradientStops`, `parseColor`, `mapBlendMode` | Shared math, gradient distributor, color & blend mode mapping |
| `build.ts` | `compileTOAD(entry, options)` | Full build orchestration pipeline from AST to final artifacts |
| `cli.ts` | Commander CLI | CLI entry point supporting `--scale`, `--format`, `--out`, `--fonts`, `--watch` |
| `index.ts` | Public API | Re-exports all core engine and compiler interfaces |
