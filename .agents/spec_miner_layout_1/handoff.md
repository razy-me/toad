# Handoff Report — Layout Solver, Math Engine & Coordinate Systems Specification

**Agent**: `spec_miner_layout_1`  
**Working Directory**: `c:/Users/flori/Downloads/toad/.agents/spec_miner_layout_1`  
**Date**: 2026-08-18  

---

## 1. Observation

Direct observations from authoritative specifications in `c:/Users/flori/Downloads/toad/ORIGINAL_REQUEST.md`:
- **Line 28**: `1. currentColor Resolution: Statically resolved during the layout pass down the tree to ensure clean color channels in generated Photoshop layers.`
- **Line 29**: `2. Text Bounding Box Measurement: Pixel-precise using headless Skia canvas (measureText with actualBoundingBoxAscent/Descent/Left/Right). No auto-wrap unless size.w is explicitly defined.`
- **Line 30**: `3. Polygon Coordinate Space: Relative to element's own center (local coordinate space).`
- **Line 32**: `5. Grid Layout Model: Uniform tile grid (fixed column count, equal cell sizes, configurable gap, auto left-to-right flow).`
- **Line 35**: `8. Gradient Stops: Missing stop positions are evenly distributed between adjacent stops.`
- **Line 38**: `11. Position Fallback: Top-level elements without at: default to (0, 0) with a compiler warning.`
- **Lines 48-49**: `src/parser/math.ts // Canvas dims (GCD ratio), bbox computation, currentColor, text measuring` and `src/parser/dependencyGraph.ts // Topological sort for relational positioning, cycle detection`
- **Line 75**: `R2. Implement the Layout Solver: Implement a layout engine that resolves currentColor inheritance, computes pixel bounding boxes for all elements (including exact text measurement via headless Skia), topological sorting for relational positioning (at: right of #id), and relative polygon coordinates.`

---

## 2. Logic Chain

1. **Canvas & GCD Ratio**: Canvas root bounds establish the world coordinate space. To determine the canonical aspect ratio string for any given canvas dimensions $(W, H)$, the Euclidean algorithm computes $\gcd(W, H)$ to yield irreducible integer ratios (e.g. $1920 \times 1080 \implies 16:9$).
2. **Text Metrics & Conditional Auto-Wrap**: Text dimensions cannot be inferred from character length alone due to variable-width font metrics. Using `@napi-rs/canvas` headless Skia context (`measureText`), exact typographic advance widths and bounding box ascent/descent are obtained. According to Rule 2, auto-wrap is strictly conditioned on the presence of an explicit `size.w`. In the absence of `size.w`, only explicit newlines (`\n`) break lines.
3. **`currentColor` Static Cascade**: Dynamic CSS-like `currentColor` lookups at rendering time would degrade rasterization performance and pollute PSD layer channel export. By walking top-down through the AST and replacing every `currentColor` token with the active inherited hex/RGBA color, all downstream engines receive purely static color definitions.
4. **Relational Positioning & DAG Resolution**: Relational placement (`at: right of #id`, `at: below #id`, `at: center of #id`) creates a dependency relationship where target bounding boxes must be computed before subject placement. Formulating this as a Directed Acyclic Graph (DAG) allows 3-color DFS topological sorting to evaluate boxes in strict dependency order while immediately catching cyclic references (e.g. $A \to B \to A$) with actionable diagnostics.
5. **Local Polygon Coordinate Space**: Placing polygon vertices relative to the center $(0,0)$ ensures consistent geometric transforms, scaling to explicit $(W, H)$ boxes, and rotation without drift.
6. **Uniform Tile Grid**: Fixed column count $C$ and gap $(g_x, g_y)$ allow closed-form $O(1)$ computation for any child's position at index $i$: $\text{row} = \lfloor i/C \rfloor, \text{col} = i \pmod C$.

---

## 3. Caveats

- For headless text measurement, `@napi-rs/canvas` must have the custom fonts loaded (via `GlobalFonts.registerFromPath`) prior to measuring text to ensure exact font glyph metrics rather than falling back to system sans-serif.
- If a relational anchor references an ID that does not exist in the document, the layout engine warns and falls back to $(0, 0)$ rather than crashing the compiler.

---

## 4. Conclusion

The specification for `src/parser/math.ts` and `src/parser/dependencyGraph.ts` is fully mined, documented, and mathematically formalized in `analysis.md`. The design cleanly decouples AST parsing from geometric layout and guarantees deterministic coordinate resolution for both the raster canvas renderer (`@napi-rs/canvas`) and PSD exporter (`ag-psd`).

Key deliverables in `analysis.md`:
- Full mathematical formulas for all relational anchors (`right of`, `left of`, `below`, `above`, `center of`, `inside`).
- Headless Skia text measurement algorithm and conditional greedy word wrapper.
- Static `currentColor` tree cascade algorithm.
- Directed graph cycle detector and topological sorter.
- Polygon center-relative normalization and vertex transform formulas.
- Tile grid layout equations.
- Complete TypeScript interface definitions for `LayoutBox`, `LayoutNode`, `ComputedStyle`, and `LayoutResult`.
- 16 Discovered Features and 18 Edge Cases documented in structured tables.

---

## 5. Verification Method

To verify the specifications and algorithms once implemented:
1. **Unit Tests (`tests/layoutSolver.test.ts`)**:
   - Verify GCD aspect ratios for $1920 \times 1080$ ($16:9$), $1080 \times 1350$ ($4:5$), $1200 \times 630$ ($40:21$), $1080 \times 1080$ ($1:1$).
   - Verify topological sort produces valid execution orders for chained relational placements (`#c` right of `#b`, `#b` right of `#a`).
   - Verify cycle detection throws descriptive error containing the full cycle path when `#a` depends on `#b` and `#b` depends on `#a`.
   - Verify text measurement wraps when `size.w` is provided and does NOT wrap when `size.w` is omitted.
   - Verify `currentColor` propagation replaces all `fill`, `stroke`, `shadow`, and `gradient` instances down nested group trees.
   - Verify center-relative polygon points scale accurately when explicit `size` is specified.
   - Verify uniform grid positions children at exact column/row offsets based on gap and cell size.
2. **Command**: Run `npx vitest run tests/layoutSolver.test.ts`
