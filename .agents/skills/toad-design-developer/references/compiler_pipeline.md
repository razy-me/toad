# Toad Compiler Pipeline

The Toad compiler pipeline is orchestrated by `compileToad` in `src/build.ts`. It acts as the central coordinator, connecting the parser, import resolver, layout solver, and output renderers.

## Build Stages (`compileToad`)

1. **Validation & Input**:
   - Ensures the entry path is a valid file.
   - Reads the entry `.toad` file source.

2. **Parsing**:
   - Calls `parseToad(source, resolvedEntry)` from `parser.ts` to generate the initial AST (`DocumentNode`).
   - Checks the AST's `diagnostics` for errors, throwing a `ParseError` if any are found.

3. **Font Registration (Global)**:
   - If a `fontsDir` is provided in `BuildOptions`, registers the fonts using `loadFontsFromDir`.

4. **Resolution (Imports & Components)**:
   - Calls `resolveImportsAndComponents(ast, resolvedEntry)` from `importResolver.ts`.
   - Produces a `ResolvedDocumentNode` where all `@import` directives are traversed, variables are merged, and component instances are fully expanded into primitive elements.
   - Any inline `@font` directives collected from the resolved graph are registered with the engine.

5. **Layout & Math Solving**:
   - Calls `solveLayout(resolved)` from `parser/math.js`.
   - This phase computes final geometry, bounds (including Skia text bounding boxes), relative relational positions, and resolves `currentColor` references into an absolute layout tree.
   - Adjusts layout configurations based on CLI overrides for DPI and bleed dimensions.

6. **Page & Multi-Canvas Splitting**:
   - Iterates through `layout.canvases`.
   - Creates distinct pages (sub-layouts) for each defined canvas, appending name suffixes (e.g., `-page1`).

7. **Rendering & Exporting Loop**:
   - Iterates through output scales (`scalesToRender`) and pages (`layoutPages`).
   - If raster formats (`png`, `jpg`, `webp`) are requested, renders the vector scene once via `renderToCanvas` at the given scale to a buffer.
   - Saves requested raster files. JPEG exports use `flattenForJpeg` to composite transparent canvases onto a white background to avoid black artifacts.
   - If `psd` is requested, utilizes `exportToPsd`.
   - If `svg` is requested, delegates to `SvgExporter`.

8. **Result Assembly**:
   - Compiles a deduplicated list of all file dependencies (for file-watching/reloads) and returns a comprehensive `BuildResult`.
