# Original User Request

## 2026-08-18T16:07:54Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval.
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

Build a standalone Node.js compiler, layout solver, raster renderer, and Photoshop `.psd` exporter for the proprietary declarative design domain-specific language "TOAD" (file extension: `.TOAD`).

Working directory: `c:/Users/flori/Downloads/toad`
Integrity mode: development

## Detailed Specification & Architecture

Follow this architecture and technical design:

### Tech Stack & Dependencies
- Language / Runtime: TypeScript (Strict mode), Node.js (v20+)
- Raster Engine: `@napi-rs/canvas`
- PSD Engine: `ag-psd`
- CLI: `commander`
- Testing: `vitest`

### Confirmed Design Rules
1. **`currentColor` Resolution:** Statically resolved during the layout pass down the tree to ensure clean color channels in generated Photoshop layers.
2. **Text Bounding Box Measurement:** Pixel-precise using headless Skia canvas (`measureText` with `actualBoundingBoxAscent/Descent/Left/Right`). No auto-wrap unless `size.w` is explicitly defined.
3. **Polygon Coordinate Space:** Relative to element's own center (local coordinate space).
4. **Component Parameters:** Supports declared parameters with defaults (`component Arrow(size = 180px)`) and named arguments at call sites (`type: Arrow(size: 240px)`).
5. **Grid Layout Model:** Uniform tile grid (fixed column count, equal cell sizes, configurable gap, auto left-to-right flow).
6. **Font Loading:** Dual support via `--fonts <dir>` CLI flag AND inline `@font "path.ttf" as "Family";` directive.
7. **Image Fit:** Default is `fill`, with optional `fit: cover;`, `fit: contain;`, `fit: none;`.
8. **Gradient Stops:** Missing stop positions are evenly distributed between adjacent stops.
9. **Filter Syntax:** Space-separated property line (e.g. `filter: blur(4px) saturate(1.5);`).
10. **Watch Mode:** Watches entry file and all transitively imported `.TOAD` dependencies.
11. **Position Fallback:** Top-level elements without `at:` default to `(0, 0)` with a compiler warning.

### Project Structure to Implement
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
│   ├── canvasRenderer.ts    // @napi-rs/canvas raster rendering (PNG/JPG at 1x/2x/4x scale)
│   ├── psdExporter.ts       // ag-psd native layered PSD builder (groups, clipping masks, editable text)
│   ├── fontLoader.ts        // GlobalFonts registration helper
│   └── drawUtils.ts         // Shared drawing routines (paths, gradients, colors, blend modes)
├── build.ts                 // Orchestration pipeline
├── cli.ts                   // Commander CLI entrypoint
└── index.ts                 // Public API exports
tests/
├── fixtures/                // .TOAD fixture files
├── goldens/                 // Golden PNGs for visual comparison
├── lexer.test.ts
├── parser.test.ts
├── importResolver.test.ts
├── layoutSolver.test.ts
├── canvasRenderer.test.ts
└── psdExporter.test.ts
```

## Requirements

### R1. Implement the DSL Parser and Resolver
Implement the lexer, recursive-descent parser, and import resolver according to the strict AST definitions. Support variables, component parameterization, @import, and @font directives.

### R2. Implement the Layout Solver
Implement a layout engine that resolves currentColor inheritance, computes pixel bounding boxes for all elements (including exact text measurement via headless Skia), topological sorting for relational positioning (`at: right of #id`), and relative polygon coordinates.

### R3. Implement the Raster Renderer
Use `@napi-rs/canvas` to render the computed layout into PNG/JPG at configurable scale factors. Support clipping masks, gradients, standard blend modes, and CSS-style filters.

### R4. Implement the PSD Exporter
Use `ag-psd` to export the computed layout into a native layered Photoshop document. Preserve layer names, groups, clipping masks, and export text as native editable Photoshop text layers with rasterized fallbacks.

### R5. Provide CLI and Public API
Provide a `TOAD build` CLI using `commander` with `--scale`, `--format`, `--out`, `--fonts`, and `--watch` options. Export all core modules for programmatic use.

## Acceptance Criteria

### Automated Test Suite
- [ ] A Vitest suite exists with comprehensive unit tests for the lexer, parser, import resolver, and math solver.
- [ ] Integration tests verify that compiling a valid `.TOAD` fixture succeeds without errors.
- [ ] Golden image tests exist: rendering a complex fixture `.TOAD` file to PNG matches a pre-computed golden image hash.
- [ ] PSD export tests exist: reading the generated `.psd` via `ag-psd` verifies the correct number of layers, group hierarchies, and editable text layer properties.
- [ ] All tests pass when running `npm run test` or `npx vitest run`.

### CLI Verification
- [ ] The `TOAD build` CLI correctly parses arguments and can generate both PNG and PSD files from a sample fixture without crashing.
