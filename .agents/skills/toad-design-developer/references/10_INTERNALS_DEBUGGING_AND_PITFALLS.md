# 10 — Compiler Internals, Anti-Patterns & Debugging Guide

This manual combines the **complete source architecture of the compiler**, the **top 15 AI & developer anti-patterns**, and a **practical troubleshooting playbook**.

---

## 1. Compiler Pipeline & Dataflow (`src/build.ts`)

The compilation pipeline operates across 7 deterministic stages:

```
[ .toad Source Code ]
        │
        ▼  Stage 1: src/parser/lexer.ts
[ Token Stream with SourceLocation (line, col, offset) ]
        │
        ▼  Stage 2: src/parser/parser.ts
[ Raw Abstract Syntax Tree (DocumentNode) ]
        │
        ▼  Stage 3: src/parser/importResolver.ts
[ Resolved Multi-File AST with Merged Scopes ]
        │
        ▼  Stage 4: src/parser/dependencyGraph.ts
[ DAG Topological Layout Sorting & Cycle Detection (3-Color DFS) ]
        │
        ▼  Stage 5: src/parser/math.ts
[ 4-Pass Geometry, Text Metric & Layout Solver (LayoutResult) ]
        │
        ├────────────────────────┬────────────────────────┐
        ▼ Stage 6a               ▼ Stage 6b               ▼ Stage 6c
[ Skia Canvas Renderer ]   [ SVG Exporter ]        [ PSD Exporter ]
(PNG / JPG / WebP)         (W3C Scalable Vector)   (Native Layered PSD)
```

### Backend Subsystems Overview:
1. **Lexer (`lexer.ts`)**: Single-pass tokenizer with regex scanning, position tracking, and comment stripping.
2. **Parser (`parser.ts`)**: Recursive descent parser with 3-line error snippet generation (`ParseError`).
3. **Import Resolver (`importResolver.ts`)**: Recursive path resolution, cycle protection, and scope merging.
4. **DAG Solver (`dependencyGraph.ts`)**: 3-color DFS (`WHITE`, `GRAY`, `BLACK`) for cycle detection (`CyclicDependencyError`).
5. **Layout Solver (`math.ts`)**: 4-pass pipeline (Sizing, Relational Placement, Auto-Layout Stacks, Bleed Expansion).
6. **Skia 2D Renderer (`canvasRenderer.ts`)**: Native Rust-based Skia engine (`@napi-rs/canvas`) for pixel-accurate rendering.
7. **Photoshop PSD Exporter (`psdExporter.ts`)**: Synthesizes native ALI blocks (`vmsk`, `keyOriginRRectRadii`, `GdFl`, `lrFX`, `TySh`).

The regression suite counts **880 tests across 48 files**.

---

## 2. Top 15 Anti-Patterns & Error Prevention

| # | Incorrect (Before ❌) | Correct (After ✅) | Explanation |
|---|---|---|---|
| 1 | `>primary: #3b82f6;` | `>primary = #3b82f6;` | Variable assignment uses `=` instead of `:`. |
| 2 | `color: primary;` | `color: >primary;` | Variable references require `>` prefix. |
| 3 | `at: center;` | `at: center of canvas;` | Centering requires explicit target (`canvas` or `#id`). |
| 4 | `text { size: 32px; }` | `text { font-size: 32px; size: 400px; }` | `font-size:` = glyph size; `size:` = max wrap width. |
| 5 | `display: flex;` | `stack { direction: horizontal; }` | `toad` uses `stack`, not CSS flexbox. |
| 6 | `font-weight: semi bold;` | `font-weight: semibold;` / `600` | Single-word descriptive keywords map to numbers (`semibold`→600, `black`→900, …); `weight: N` is a valid alias. Multi-word `semi bold` is invalid. |
| 7 | `canvas { fill: #0f172a; }`| `canvas { background: #0f172a; }` | Canvas uses `background:` not `fill:`. |
| 8 | `slot` | `slot;` | `slot;` statement must terminate with semicolon. |
| 9 | `text { fill: #fff; }` | `text { color: #fff; }` | Text uses `color:`, shapes use `fill:`. |
| 10 | `at: below #id offset: 16px;`| `at: below #id offset 16px;` | No colon after `offset` keyword inside `at:`. |
| 11 | `#a { at: below #b; } #b { at: below #a; }` | Linear dependency chain | Layout cycles throw `Cyclic layout dependency cycle detected: #a -> #b -> #a`; `@import` cycles stay tolerated/deduplicated. |
| 12 | `polygon { points: [(100, 100)]; }` | `points: [(-50, -50), (50, 50)];` | Polygon vertices must be centered around `(0, 0)`. |
| 13 | `@import "./theme"` | `@import "./theme.toad";` | File extension and semicolon are required. |
| 14 | `at: (100px 200px);` | `at: (100px, 200px);` | A comma is REQUIRED inside `(x, y)` tuples. Corner anchors (`top-left of`, …), bare `at: center;`, and `previous` are all valid anchors. |
| 15 | `canvas "A" { canvas "B" {} }` | Separate top-level canvas blocks | Nested canvas blocks are invalid. |
| 16 | `>font = "Agency FB", sans-serif;` | `>font = "Agency FB, sans-serif";` | Font fallback stacks must be a single string literal; unquoted commas cause a syntax parse error. |
| 17 | Zero-padding badge pill widths | 15–20% safety padding | Sizing containers to the exact pixel width of text causes overflow if font engines render slight kerning differences. |
| 18 | `alpha(>color, 0.08)` for glow | `alpha(>color, 0.35)` | Center stops for neon/glow radial gradients on dark backgrounds need $\ge 0.25$ alpha to remain vibrant in sRGB. |

---

## 3. Debugging & Troubleshooting Playbook

### Problem 1: "My text does not wrap into multiple lines."
* **Cause:** The `text` element has no maximum wrap width. `font-size:` only controls typographic height.
* **Solution:** Specify `size: <width>;` on the `text` element (e.g. `size: 500px;`).

### Problem 2: "Compiler throws `CyclicDependencyError`!"
* **Cause:** Two or more elements reference each other in their `at:` statements (circular DAG dependency).
* **Solution:** Disentangle the chain. Anchor the primary element with absolute coordinates `(x, y)` and position subsequent elements unidirectionally.

### Problem 3: "Element renders at `(0, 0)` at the top-left corner unexpectedly."
* **Cause:** No `at:` position was specified and the element is not inside a `stack` or `grid`.
* **Solution:** Provide an explicit position (`at: (x, y);` or `at: center of canvas;`) or wrap the element in a `stack`.

### Problem 4: "Photoshop reports missing fonts when opening the generated PSD."
* **Cause:** Photoshop cannot match the PostScript font name to a font installed in your OS.
* **Solution:** Register the font file using `@font` and ensure the same font family is installed locally on your operating system.

### Problem 5: "Physical millimeter dimensions differ by a few pixels from external print tools."
* **Cause:** `mm`/`cm`/`in`/`pt` always convert at the CSS-reference **96 DPI** ($1\text{ in} = 96\text{ px}$, $1\text{ mm} \approx 3.7795\text{ px}$) — the canvas `dpi:` value does not rescale in-document units.
* **Solution:** Compute sizes at 96 DPI and treat `dpi: 300;` (default is `96`) purely as print metadata; it only drives the `--bleed` CLI override conversion.

### Problem 6: "My elements show up on the wrong page (or vanish) in a multi-canvas document."
* **Cause:** Multi-canvas pages are independent — each canvas renders ONLY its own elements. Top-level inheritance applies to SINGLE-canvas documents only, and an empty multi-canvas page warns.
* **Solution:** Declare each page's content inside its own `canvas` block so every element belongs to exactly one page.

### Problem 7: "My glassmorphism blur is missing from the PNG/PSD output."
* **Cause:** `backdrop-filter` is unsupported on raster (PNG/JPG/WebP) and PSD rendering — it safely degrades there; SVG exports it as a CSS style hint.
* **Solution:** Approximate the look with translucent fills and strokes on raster targets, or rely on the SVG export for the CSS hint.

### Problem 8: "A nested element sits at an unexpected offset."
* **Cause:** Nested element coordinates are relative to their **container's origin**. A container without its own position hugs its children's extents (origin shifts to the minimum child coordinate); a container with an explicit `at:` keeps that origin while its size derives from its children.
* **Solution:** Anchor the container explicitly (`at:`) when you need a stable frame, or account for the hug-origin shift when positioning children.

### Problem 9: "SVG text overflows badges or looks completely different from the PNG raster export."
* **Cause:** No explicit font-family was declared. The local Skia DirectWrite font fallback resolved to a system-installed condensed font (e.g. `Agency FB`), while SVG viewers fell back to standard wide `Arial`.
* **Solution:** Register your font file via `@font "./fonts/MyFont.ttf" as "MyFont" normal;` or set `font-family: "MyFont";` on the `canvas` block. TOAD will automatically embed the font as a base64 `@font-face` inside the SVG `<defs><style>` so it renders identically in every browser and vector tool.

