# SVG Exporter (`svgExporter.ts`)

The SVG Exporter provides a standalone translation process mapping the layout AST to standard XML-based SVG strings.

## Translation Process
1. **Initialization:** Clears `defs` registers for gradients, filters, and clip paths, mapping the document bounds to the `<svg>` `viewBox`.
2. **Node Traversal:** Iterates through AST nodes translating types into SVG elements:
   - `rect`: Renders `<rect>`. Multi-corner radii are dynamically transpiled into SVG `<path>` elements using explicit `A` (arc) commands to support individual corner arcs.
   - `circle`: Maps to `<circle>` or `<ellipse>` depending on the radius profile.
   - `polygon`: Emits `<polygon>`, but if a border radius is provided, `buildRoundedPolygonSvgPath` performs vector math to calculate tangent arcs, emitting a continuous `<path>`.
   - `text`: Yields `<text>` tags, computing anchor offsets. Multiline strings are broken into `<tspan>` nodes with proper `dy` offsets based on leading.
   - `image`: Produces `<image>` elements. Embeds as base64 data URIs if `embedImages` is active. Handles `object-fit` scaling via `preserveAspectRatio`.
3. **Transforms & Styling:**
   - SVG `transform` attributes concatenate translation, rotation, scaling, and matrix skewing.
   - `clip-path` properties reference dynamically generated `<clipPath>` definitions in the SVG `<defs>`. This respects the sibling-clipping logic identical to the raster engine.
   - `style` tags encapsulate backdrop filters and font features.
4. **Gradients & Filters:**
   - Linear and radial gradients emit native `<linearGradient>` and `<radialGradient>` objects.
   - Conic gradients are polyfilled via `<pattern>` wedges, calculating slice polygons spanning 360 degrees.
   - Filters inject `<filter>` structures with `feGaussianBlur`, `feDropShadow`, `feColorMatrix`, and `feComponentTransfer` nodes.
