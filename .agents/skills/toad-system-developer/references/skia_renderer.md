# Skia Renderer (`canvasRenderer.ts` & `drawUtils.ts`)

The Skia Renderer uses `@napi-rs/canvas` to map the `LayoutResult` AST to canvas operations for rendering to PNG, JPEG, WebP, or returning a Canvas instance.

## Rendering Steps
1. **Canvas Setup:** A base canvas is instantiated based on the document's dimensions, scaled by the export scale factor. Margin and bleed (including crop marks) are computed and applied to the transformation matrix.
2. **Background Rendering:** The document's background fill is processed. If it's a gradient, `drawUtils.ts`'s `createCanvasGradient` builds a linear, radial, or conic gradient. 
3. **Recursive Node Rendering:** The AST is traversed by `renderNode`, matching layout node types (`rect`, `circle`, `polygon`, `text`, `image`, containers) to Skia canvas commands.
4. **Transformations & Compositing:** Each node translates its origin, applies rotation, scale, and skew transforms via `ctx.transform()`/`ctx.rotate()`, and handles opacity and blend modes (`globalCompositeOperation`).
5. **Clipping Masks:** For standard `maskNode`, paths or standard shapes are traced, and `ctx.clip()` is applied before rendering the node. Sibling clipping masks (where a child node acts as a mask for subsequent siblings) are evaluated natively using a temporary mask path loop.
6. **Isolated Offscreen Rendering (Filters & Effects):** Because Skia crashes on certain composite filters, CSS filters (like drop shadows) are extracted in `renderNodeIsolated`. Filter layers and container-level shadows/glows are rendered onto offscreen canvases under the current transform, then stamped back into the device space.

## Graphics Models & Specifics
- **Gradients:** `drawUtils.ts` provides interpolation for stops and handles `linear`, `radial`, and `conic` types. Note that since Skia handles standard linear/radial well, conic gradients are synthesized natively.
- **Images:** Handled with `drawImageWithFit` covering `fill`, `cover`, `contain`, and `none` modes using object-fit logic and clipping rectangles.
