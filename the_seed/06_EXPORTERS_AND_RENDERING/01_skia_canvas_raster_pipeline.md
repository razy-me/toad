# Skia Canvas Raster Pipeline

TOAD's raster rendering engine produces pixel-perfect PNG, JPEG, and WebP outputs by translating the evaluated AST layout graph into headless Skia drawing calls via `@napi-rs/canvas`.

---

## 1. Architecture Overview

The raster pipeline executes in four distinct phases:

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Evaluated AST  │ ──> │   Canvas Init   │ ──> │  Recursive Node  │ ──> │ Buffer / Export │
│ (RenderableNode)│     │ & Context Setup │     │    Traversal     │     │ (PNG/JPEG/WebP) │
└─────────────────┘     └─────────────────┘     └──────────────────┘     └─────────────────┘
```

1. **Context Initialization**: A headless `SKCanvas` of dimensions $(W \times S, H \times S)$ is instantiated, where $S$ is the export scale multiplier (`@1x`, `@2x`, `@3x`, `@4x`).
2. **Global Transform**: High-DPI scaling `ctx.scale(scale, scale)` is applied to map logical coordinates $[0, W] \times [0, H]$ to physical device pixels.
3. **Z-Ordered Node Traversal**: Nodes are visited depth-first according to their calculated stacking order ($z$-index and tree order).
4. **State Management**: Every node render executes inside an isolated `ctx.save()` / `ctx.restore()` transaction.

---

## 2. Coordinate System & Subpixel Precision

TOAD positions elements in logical canvas units (points/CSS pixels at 72 DPI baseline).

### Subpixel Snapping vs. Anti-Aliasing
Skia operates on floating-point vector paths with analytical subpixel anti-aliasing. However, 1px strokes centered on integer boundaries can straddle two device pixels, causing faint, blurry 2px lines:

```
Logical Integer: x = 10.0, stroke = 1px
Skia bounds:     [9.5, 10.5] -> 50% coverage on pixel 9, 50% coverage on pixel 10 (blurry)

Snapped Offset:  x = 10.5, stroke = 1px
Skia bounds:     [10.0, 11.0] -> 100% coverage on pixel 10 (crisp)
```

In TOAD's rasterizer:
- **Fills**: Snapped to full integer pixel boundaries (`Math.round(x)`, `Math.round(y)`).
- **Strokes**: When `stroke-width: 1px;`, the center coordinate is optionally adjusted by $+0.5$px if crisp border alignment is enabled, or rendered with full subpixel sampling for fractional shapes.

---

## 3. Node Rendering Pipeline

Each node type is handled by a specialized Skia rendering branch:

### 3.1 Shapes (`rect`, `circle`, `path`)
1. **Transform**: Compute anchor pivot and apply translation, rotation (`ctx.rotate`), and skewing.
2. **Clipping**: If `overflow: clip;` or `clip-path` is defined, create a clipping path and invoke `ctx.clip()`.
3. **Shadows**: Render drop shadows before drawing the shape:
   ```ts
   ctx.shadowColor = parseColor(node.shadow.color);
   ctx.shadowBlur = node.shadow.blur;
   ctx.shadowOffsetX = node.shadow.x;
   ctx.shadowOffsetY = node.shadow.y;
   ```
4. **Fill Path**:
   - Solid colors: `ctx.fillStyle = color;`
   - Gradients: Constructed via `ctx.createLinearGradient(x1, y1, x2, y2)` or `ctx.createRadialGradient(cx, cy, r1, cx, cy, r2)`.
   - Pattern/Shader fills.
5. **Stroke Path**:
   - `ctx.strokeStyle = strokeColor;`
   - `ctx.lineWidth = strokeWidth;`
   - `ctx.lineCap = cap; ctx.lineJoin = join;`
   - Stroke alignment (center, inside, outside) is achieved by clipping or offsetting the stroke boundary.

### 3.2 Text Elements
1. **Font Resolution**: Skia queries the registered font family from the Skia `GlobalFonts` registry:
   ```ts
   GlobalFonts.registerFromPath(fontFilePath, familyAlias);
   ```
2. **Baseline Alignment**:
   - Skia draws text from the **alphabetic baseline** by default.
   - TOAD's layout engine calculates box tops. To position text correctly:
     $$y_{\text{baseline}} = y_{\text{box}} + \text{valignShift} + \text{ascent}$$
     Where $\text{ascent} \approx \text{round}(\text{fontSize} \times 0.80)$ when exact font metric metrics are synthesized.
3. **Word Wrapping & Multiline Layout**:
   - Each wrapped line is drawn sequentially:
     $$y_i = y_{\text{baseline}} + (i \times \text{lineHeight})$$

### 3.3 Images
- Decoded via Skia's internal image codecs (PNG, JPEG, WebP, AVIF, TIFF).
- Drawn with bilinear or bicubic filtering using `ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)`.
- Respects `object-fit: cover | contain | fill`.

---

## 4. Multi-Scale Export (`@1x`, `@2x`, `@3x`, `@4x`)

TOAD supports raster export scaling for retina displays and high-resolution print proofing:

```bash
toad compile input.toad -o output.png --scale 2
```

### Mathematical Scaling
Given a canvas definition:
```toad
canvas "Banner" {
    width: 1200px;
    height: 630px;
}
```

At scale $S = 2$:
- Physical bitmap dimensions: $2400 \times 1260$ pixels.
- DirectWrite/FreeType renders glyph vectors at $2\times$ native resolution, avoiding blurry bitmap upsampling.
- Gradients recalculate coordinate matrices at $2\times$ precision.

---

## 5. Blend Modes and Compositing

Skia implements standard Porter-Duff compositing operators and CSS blend modes:

| TOAD Blend Mode | Skia `globalCompositeOperation` | Formula ($C_s$: source, $C_b$: backdrop) |
|:---|:---|:---|
| `normal` | `source-over` | $C_s + C_b(1 - \alpha_s)$ |
| `multiply` | `multiply` | $C_s \times C_b$ |
| `screen` | `screen` | $C_s + C_b - (C_s \times C_b)$ |
| `overlay` | `overlay` | Hard light with backdrop/source inverted |
| `plus-lighter` | `lighter` | $\min(C_s + C_b, 1.0)$ |
| `destination-out`| `destination-out` | Backdrop erased by source silhouette |

---

## 6. Performance Characteristics & Memory Management

1. **Surface Recycling**: For multi-artboard files, memory surfaces are drained and GC hints are provided to prevent Skia C++ native heap spikes.
2. **Thread Safety**: Headless Skia surfaces run in Node.js worker pools for parallel batch rendering.
3. **Zero-Copy Buffering**: Output buffers (`toBuffer('image/png')`) transfer binary data directly to filesystem streams without intermediate string conversions.
