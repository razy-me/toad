# Project: toad Declarative Design DSL Compiler & Exporter

## Architecture
The "toad" compiler is a standalone Node.js toolchain that transforms declarative design DSL documents (`.toad`) into pixel-accurate multi-scale raster images (PNG, JPG, WebP), vector graphics (SVG), and native editable layered Photoshop documents (`.psd`). Runtime requirement: Node.js `>=20` (see `engines` in `package.json`).

```
                              [ .toad Source Files ]
                                        │
                                        ▼
                             [ Tokenizer / Lexer ]
                                  (lexer.ts)
                                        │
                                        ▼
                         [ Recursive-Descent Parser ]
                                 (parser.ts)
                                        │
                                        ▼
                             [ Raw AST (ast.ts) ]
                                        │
                                        ▼
                            [ Import & Component ]
                                  [ Resolver ]
                             (importResolver.ts)
                                        │
                                        ▼
                         [ Resolved & Expanded AST ]
                                        │
                                        ▼
                         [ Dependency Graph & Solver ]
                           (dependencyGraph.ts / math.ts)
                           - currentColor static cascade
                           - Relational placement DAG (3-color DFS)
                           - Skia headless text measurement
                           - Local polygon & uniform grid math
                                        │
                                        ▼
                           [ Resolved Layout Tree ]
                                  (LayoutResult)
                                  ┌─────┼─────┐
                                  │     │     │
                                  ▼     ▼     ▼
                      [ Canvas Renderer ]  [ PSD Exporter ]  [ SVG Exporter ]
                     (@napi-rs/canvas)     (ag-psd)          (svgExporter.ts)
                     - Multi-scale (1x..4x)- Vector Shape Masks - Scalable vector XML
                     - Paths, gradients    - Live Corner Radii  - Embedded fonts & paths
                     - CSS filters, blends - fx Drop Shadows
                     - Image fits          - Editable Type Layers
                                  │     │     │
                                  ▼     ▼     ▼
                        [ PNG / JPG / WebP ] [ .PSD ] [ .SVG ]
```

## Feature Inventory
| # | Feature | Description | Status | Source |
|---|---------|-------------|--------|--------|
| 1 | Lexical Tokenizer | Single-pass lexer for keywords, identifiers, hex colors, numbers, units, strings, symbols | DONE | `lexer.ts` |
| 2 | AST Data Model | Discriminated union types for all document, directive, variable, component, element, property nodes | DONE | `ast.ts` |
| 3 | Recursive-Descent Parser | Grammar parser with panic-mode synchronization on `;` and `}` | DONE | `parser.ts` |
| 4 | Directives (@import, @font) | File import and inline font alias declaration | DONE | `importResolver.ts` |
| 5 | Variable Substitution | Scoped `>var` and `$var` evaluation in property expressions | DONE | `importResolver.ts` |
| 6 | Component Parameterization | Declaration with defaults `Arrow(size = 180px)` and named call sites `Arrow #id { size: 240px; }` | DONE | `importResolver.ts` |
| 7 | Canvas Dims & GCD Ratio | Canvas root sizing and Euclidean aspect ratio reduction (16:9, 1:1, etc.) | DONE | `math.ts` |
| 8 | Headless Skia Text Measuring | Bounding box metrics (`actualBoundingBoxAscent/Descent/Left/Right`) & conditional auto-wrap on explicit `size.w` | DONE | `math.ts` |
| 9 | Static currentColor Cascade | Top-down resolution of `currentColor` inheritance to hex/RGBA values | DONE | `math.ts` |
| 10 | Relational Positioning DAG | `at: right of #id`, `at: below #id`, `at: center of #id` with 3-color DFS topological sort & cycle detection | DONE | `dependencyGraph.ts` |
| 11 | Local Polygon Coordinates | Center-relative coordinate space with vertex transform normalization | DONE | `math.ts` |
| 12 | Uniform Tile Grid Layout | Fixed column count, equal cell sizes, configurable gap, auto left-to-right flow | DONE | `math.ts` |
| 13 | GlobalFonts Registration | Font loading helper for CLI `--fonts` directory scan and `@font` directives | DONE | `fontLoader.ts` |
| 14 | Shared Draw Utilities | Path construction, shape drawing, color parsing, gradient stop interpolation (linear defaults to CSS `to bottom`; radial renders as a centered circle), blend mode mapping | DONE | `drawUtils.ts` |
| 15 | Raster Canvas Renderer | Multi-scale raster rendering (1x..4x) to PNG/JPG/WebP with clipping masks, blend modes, image fits; filters render via Skia `ctx.filter` (`drop-shadow()`/`opacity()` apply at composite time), shadow/glow blur and offsets scale with `-s`, node opacity applied exactly once | DONE | `canvasRenderer.ts` |
| 16 | Layered PSD Exporter | Native Photoshop Vector Shape Layers (Bézier knots for rect/circle/polygon plus star/triangle/arrow/cross straight-line paths; generic `path d` and icons rasterize into the composite), live corner radii `keyOriginRRectRadii`, vector fills/strokes, `fx` drop shadows, editable type layers (corrected PostScript names, text tracking in 1/1000 em, fauxBold/fauxItalic from weight/style), and native Adjustment Layers / separate FX layers for CSS filter chains; colorMode is always RGB (CMYK requests convert colors to sRGB) | DONE | `psdExporter.ts` |
| 17 | SVG Exporter | XML vector exporter generating scalable SVGs with gradients, sibling-model clip paths (`clip:true` masks the next sibling), default 1px strokes when only a stroke color is given, and styled text; conic gradients approximate 60 wedges | DONE | `svgExporter.ts` |
| 18 | Compilation Pipeline | Unified `compileToad()` orchestration pipeline connecting parsing, layout, rasterization, SVG, and PSD export | DONE | `build.ts` |
| 19 | Decentralized Disk Search | Tiered, depth-capped workspace search (`fileFinder.ts`) resolving `.toad` files across CWD and drives | DONE | `fileFinder.ts` |
| 20 | Commander CLI & Watch Mode | CLI tool `toad <name> [flags]` with `-f, --format`, `-s, --scale`, `-q, --quality`, `-o, --out`, `-w, --watch` and live SSE browser preview | DONE | `cli.ts` |
| 21 | Public API Exports | Clean programmatic TypeScript exports from `src/index.ts` | DONE | `index.ts` |
| 22 | Vitest Test Suite | 48 test files, 880 tests passing with 100% success rate across all modules and workloads | DONE | `tests/` |
| 23 | Built-in Shape Primitives | Dynamic vector generators for `star`, `triangle`, `arrow`, `cross` with adaptive box scaling | DONE | `shapeGenerators.ts` |
| 24 | Lucide Icon Registry | Native vector icon rendering for `icon` element with Lucide path library | DONE | `iconRegistry.ts` |
| 25 | Math Solver & Calc Expressions | Nested `calc(...)` evaluation, percentage bounds, negative offsets, and margins | DONE | `math.ts` |
| 26 | 2D Transformations | Matrix affine transformations (`scale`, `skewX`, `skewY`, `transformOrigin`, `rotation`) | DONE | `math.ts`, `canvasRenderer.ts`, `svgExporter.ts` |
| 27 | Component Content Slots | Dynamic child element projection via `slot;` inside component bodies | DONE | `importResolver.ts` |
| 28 | Platform & Social Presets | Predefined artboard presets (`og-image`, `twitter-header`, `instagram-post`, `youtube-thumbnail`, etc.) | DONE | `math.ts`, `importResolver.ts` |
| 29 | Project Scaffolding CLI | Project generator `toad init [name]` with auto-incrementing directory names | DONE | `scaffold.ts`, `cli.ts` |
| 30 | DX Tooling & Linter | Fast auto-formatter, missing file detection, duplicate ID and undeclared variable checking | DONE | `diagnostics.ts`, `linter.ts`, `formatter.ts` |
| 31 | Advanced Graphic Effects | Masking (`mask: #id`) and Stable Layer Sorting (`z-index`) across Canvas, SVG, PSD; `backdrop-filter` is unsupported on raster/PSD and exported by SVG only as a CSS style hint | DONE | `math.ts`, `canvasRenderer.ts`, `svgExporter.ts`, `psdExporter.ts` |
| 32 | Photoshop Layer FX | Extended layer styles (`inner-shadow`, `glow`, `inner-glow`, `bevel`, `stroke-style`, `overlay`) mapped to native PSD `effects` descriptors; group/grid/stack-level shadow or outer-glow renders one shadow around the union of children (no per-descendant leak), with blur/offsets scaling with output scale | DONE | `parser.ts`, `canvasRenderer.ts`, `psdExporter.ts` |
| 33 | Print Prepress & CMYK | Full CMYK color parsing (`cmyk(...)`), print units (`mm`, `cm`, `in`, `pt`), `dpi`, `bleed`, and corner crop marks with registration crosshairs | DONE | `drawUtils.ts`, `canvasRenderer.ts`, `cli.ts` |
| 34 | Advanced OpenType Typography | OpenType features (`font-features`), variable fonts (`font-variation`), paragraph justification (`align: justify`), and `hanging-punctuation` | DONE | `math.ts`, `canvasRenderer.ts`, `svgExporter.ts`, `psdExporter.ts` |
| 35 | Multi-Canvas Documents | Multi-page / multi-artboard syntax (`canvas "Front" { ... } canvas "Back" { ... }`) with automatic page asset splitting | DONE | `parser.ts`, `math.ts`, `build.ts` |

## Canonical Standards & Recommended Syntax (AI Reference)
- **Variables**: `>var = value;` (canonical standard)
- **Canvas Artboard**: `background:` (recommended) over `fill:` / `color:`
- **Export Declaration**: `export: all;` or `export: image;` (recommended) over `exports:`, `format:`, `formats:`
- **Aspect Ratio**: `ratio: 16:9;` (recommended) over `aspect-ratio:`, `aspectRatio:`
- **Quality & Compression**:
  - `quality: 85%;` for quality scale (100% = maximum quality, 0% = lowest)
  - `compress: 15%;` for compression scale (0% = uncompressed, 100% = max compression)
- **Multi-Format Macro**: `image` (PNG, JPG, WebP, SVG) and `all` (+ PSD)
- **Corner Radii**: `radius: 16px;` for uniform; `border-radius: [tl, tr, br, bl];` for 4-corner arrays
- **Shape vs Text Fills**: `fill:` for shapes (`rect`, `circle`, `polygon`), `color:` for `text`
- **Drop Shadows**: `shadow: 0px 10px 20px rgba(0, 0, 0, 0.4);` (maps natively to Photoshop `fx` drop shadow)
- **CLI Commands**: `toad <name> [flags]` with flags trailing the filename (e.g. `toad logo -f image -s 2 -w`)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Tooling, AST, Parser & Layout Solver | package.json, tsconfig.json, ast.ts, lexer.ts, parser.ts, importResolver.ts, math.ts, dependencyGraph.ts + unit tests | none | COMPLETE |
| M2 | Engine, Raster Renderer & PSD Exporter | fontLoader.ts, drawUtils.ts, canvasRenderer.ts, psdExporter.ts, svgExporter.ts + unit tests | M1 | COMPLETE |
| M3 | Build Pipeline, CLI & Public API | build.ts, cli.ts, fileFinder.ts, index.ts, watch mode + CLI tests | M1, M2 | COMPLETE |
| M4 | E2E Test Suite Pass (Tiers 1-4) | Comprehensive requirement-driven test suite (Tiers 1-4) passing 100% | M1, M2, M3 | COMPLETE |
| M5 | Adversarial Coverage Hardening & Native PSD | White-box stress testing, vector shape layers, live corner radius descriptors, fx drop shadow styles, hot-reload preview | M4 | COMPLETE |

## Interface Contracts

### Parser ↔ Resolver
- `parseToad(source: string, filename?: string): DocumentNode`
- `resolveImportsAndComponents(entryDoc: DocumentNode, entryPath: string, fileLoader?: (p: string) => string): Promise<ResolvedDocumentNode>`

### Resolver ↔ Layout Solver
- `solveLayout(doc: ResolvedDocumentNode): Promise<LayoutResult>`
- Returns `LayoutResult`:
  ```ts
  interface LayoutResult {
    canvas: { width: number; height: number; aspectRatio: string; background?: string; dpi: number };
    fonts: Array<{ family: string; source: string; weight?: string; style?: string }>;
    nodes: LayoutNode[]; // topologically ordered, bounding boxes computed, currentColor resolved
    warnings: string[];
    dependencies: string[]; // all imported file paths
  }
  ```

### Layout Solver ↔ Canvas Renderer
- `renderToCanvas(layout: LayoutResult, options?: RenderOptions): Promise<Canvas>`
- `renderToBuffer(layout: LayoutResult, options?: RenderOptions): Promise<Buffer>`
  - `options: { scale?: number; format?: 'png' | 'jpg'; quality?: number }`

### Layout Solver ↔ PSD Exporter
- `exportToPsd(layout: LayoutResult, options?: PsdExportOptions): Promise<Buffer>`
  - Generates Photoshop document containing `children: Layer[]` with layer groups, clipping masks, and native editable `Layer.text` structures.

### Pipeline Orchestrator ↔ CLI
- `compileToad(entryPath: string, options: BuildOptions): Promise<BuildResult>`
  - `options: { outDir?: string; format?: string; scale?: number; dpi?: number; bleed?: number | string; fontsDir?: string; watch?: boolean; quality?: number; port?: number }` — `format` is a free-form string parsed internally (comma/space-separated tokens like `png, svg`, or the `image` / `all` macros)

## Code Layout
```
src/
├── parser/
│   ├── ast.ts               // Complete TypeScript AST definitions
│   ├── lexer.ts             // Single-pass tokenizer
│   ├── parser.ts            // Recursive-descent AST parser
│   ├── importResolver.ts    // @import resolution, variable substitution, component expansion
│   ├── math.ts              // Canvas dims (GCD ratio), bbox computation, currentColor, text measuring
│   └── dependencyGraph.ts   // Topological sort for relational positioning, cycle detection
├── engine/
│   ├── canvasRenderer.ts    // @napi-rs/canvas raster rendering (PNG/JPG/WebP at multi-scale)
│   ├── svgExporter.ts       // Clean scalable vector graphics (SVG) builder
│   ├── psdExporter.ts       // ag-psd native layered PSD builder (vector shapes, clipping masks, editable text)
│   ├── fontLoader.ts        // GlobalFonts registration helper
│   ├── shapeGenerators.ts   // Pure mathematical vector path generators (star, triangle, cross, arrow)
│   ├── iconRegistry.ts      // Lucide icon SVG path vector registry
│   ├── imageCache.ts        // Shared decoded-image cache (decoded once per mtime) used by raster & PSD paths
│   ├── previewServer.ts     // Live SSE hot-reload web server, zoom UI & 1-click OS folder opener
│   └── drawUtils.ts         // Shared drawing routines (gradients, colors, blend modes, CSS filters)
├── tools/
│   ├── formatter.ts         // Automatic code formatter standardizing indentation & whitespace
│   ├── linter.ts            // Static AST analysis linter (duplicate IDs, undeclared variables, masks)
│   ├── diagnostics.ts       // Levenshtein typo distance suggestion engine
│   └── lsp/
│       └── server.ts        // Real stdio JSON-RPC LSP server (diagnostics push, hover, go-to-definition, completion); run via node dist/tools/lsp/server.js
├── utils/
│   └── fileFinder.ts        // Tiered, depth-capped workspace search across CWD and drives
├── scaffold.ts              // Project scaffolding generator (`toad init`)
├── build.ts                 // Orchestration pipeline & VS Code extension generator
├── cli.ts                   // Commander CLI entrypoint
└── index.ts                 // Public API exports
tests/
├── fixtures/                // .toad fixture files
├── goldens/                 // Structural golden references (layer counts, dimensions, flags) recorded in index.ts — no pixel-hash comparisons
├── e2e/                     // Requirement-driven E2E tests (Tiers 1-4, 245 test cases)
├── lexer.test.ts
├── parser.test.ts
├── importResolver.test.ts
├── layoutSolver.test.ts
├── canvasRenderer.test.ts
├── svgExporter.test.ts
├── psdExporter.test.ts
├── cli.test.ts
├── build.test.ts
├── new_features.test.ts
├── graphics_power.test.ts
├── code_review_fixes.test.ts
└── challenger_m*.test.ts    // Adversarial stress test suites (M1, M2, M3)
```
