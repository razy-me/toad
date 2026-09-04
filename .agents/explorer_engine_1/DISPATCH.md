# DISPATCH — Explorer Engine & Pipeline

Target: Investigate the rendering engine (@napi-rs/canvas rasterization, PNG/JPG export at 1x/2x/4x, blend modes, filters, gradients, drawUtils), PSD exporter (ag-psd native layered structure, layer groups, clipping masks, editable text layers), fontLoader (GlobalFonts registration), build pipeline (build.ts), CLI (commander in cli.ts), public API (index.ts), package setup (package.json, tsconfig.json), and testing architecture (vitest).
Original Request: c:/Users/flori/Downloads/toad/ORIGINAL_REQUEST.md

## 2026-08-18T16:08:49Z
Task:
Perform a comprehensive architectural analysis for the Rendering Engine (@napi-rs/canvas), PSD Exporter (ag-psd), Font Loader, Build Pipeline, CLI, and Testing Architecture.

Deliverables:
- Write a detailed analysis document to c:/Users/flori/Downloads/toad/.agents/explorer_engine_1/analysis.md covering:
  1. Raster rendering architecture using @napi-rs/canvas: drawing paths, fill/stroke, gradients (even stop distribution), blend modes, CSS filter string parsing & application (blur, saturate, etc.), clipping masks, image fit options (fill, cover, contain, none), multi-scale rendering (1x, 2x, 4x), PNG/JPG encoding.
  2. PSD export architecture using ag-psd: layer tree construction, layer groups, clipping masks, native editable Photoshop text layers with formatting & font mapping, raster fallback layers.
  3. Font loading architecture: GlobalFonts registration via CLI --fonts flag and inline @font directives.
  4. Build pipeline (build.ts) and CLI (commander in cli.ts with all flags: --scale, --format, --out, --fonts, --watch).
  5. Watch mode implementation (chokidar / fs watching entry + transitively imported .TOAD files).
  6. Complete package.json dependency manifest (exact versions for @napi-rs/canvas, ag-psd, commander, chokidar, typescript, vitest, etc.) and tsconfig.json configuration.
  7. Testing architecture & Golden comparison strategy.
- Write c:/Users/flori/Downloads/toad/.agents/explorer_engine_1/handoff.md with your findings.
- When finished, send a message to parent summarizing your completion and pointing to the handoff file.

