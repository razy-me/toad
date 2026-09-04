# DISPATCH — Spec Miner Layout & Math

Target: Investigate the layout solver, math/unit resolution, canvas dimensions / aspect ratios (GCD ratio), bbox computation, currentColor propagation, text bounding box measurement (headless Skia), topological sorting, relational positioning (`at: right of #id`), polygon coordinate space (center-relative), and grid layout model (uniform tile grid).
Original Request: c:/Users/flori/Downloads/toad/ORIGINAL_REQUEST.md

## 2026-08-18T16:08:49Z
Task:
Perform a comprehensive specification analysis of the Layout Solver, Math Engine, and Coordinate Systems for the "TOAD" compiler.

Deliverables:
- Write a detailed specification document to c:/Users/flori/Downloads/toad/.agents/spec_miner_layout_1/analysis.md covering:
  1. Canvas Dimensions & Aspect Ratio calculations (GCD ratio computation).
  2. Bounding box computation for all element types (rect, circle, polygon, text, image, group, grid).
  3. Text measurement specification using headless Skia (@napi-rs/canvas measureText with actualBoundingBoxAscent/Descent/Left/Right), font properties, auto-wrap rules (only when size.w is explicit).
  4. currentColor static resolution down the layout tree.
  5. Relational positioning engine (`at: right of #id`, `at: below #id`, `at: center of #id`, offset coordinates, fallback to (0,0) with warning).
  6. Topological sorting and cycle detection in dependencyGraph.ts.
  7. Polygon coordinate space (center-relative / local coordinate space).
  8. Uniform tile grid layout model (fixed columns, equal cell sizing, gap, auto flow).
- Write c:/Users/flori/Downloads/toad/.agents/spec_miner_layout_1/handoff.md with your findings.
- When finished, send a message to parent summarizing your completion and pointing to the handoff file.

