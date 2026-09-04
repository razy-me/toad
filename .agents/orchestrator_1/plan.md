# Master Orchestration Plan — TOAD Compiler

## Objectives
Deliver a complete, production-ready, fully tested TypeScript/Node.js implementation of the "TOAD" declarative design DSL compiler, layout solver, @napi-rs/canvas raster renderer, ag-psd PSD exporter, and CLI.

## Tracks
1. **Survey Track (Phase 0)**:
   - 3 parallel Explorers / Spec Miners:
     - Spec Miner 1: DSL grammar, AST node specifications, token types, import/component expansion rules, directive syntax.
     - Spec Miner 2: Layout solver, math/unit resolution (px, GCD aspect ratio), currentColor propagation, text bounding box measurement (Skia metrics), topological sorting, relational positioning (`at: right of #id`), polygon coordinate space.
     - Explorer 1: Engine specifications (canvasRenderer, @napi-rs/canvas APIs, clipping masks, filters, gradients, drawUtils, psdExporter ag-psd structures, fontLoader GlobalFonts, CLI options, build pipeline).
   - Synthesize survey findings into `PROJECT.md` (Feature Inventory, Architecture, Interface Contracts, Code Layout).

2. **E2E Testing Track**:
   - E2E Testing Orchestrator / Test Writer creates `TEST_INFRA.md`, test runner, and test fixtures for:
     - Tier 1: Feature Coverage (≥5 tests per feature)
     - Tier 2: Boundary & Corner Cases (≥5 tests per feature)
     - Tier 3: Cross-Feature Combinations (pairwise interactions)
     - Tier 4: Real-World Scenarios (realistic TOAD templates, goldens, PSD structure verification)
   - Publishes `TEST_READY.md`.

3. **Implementation Track**:
   - Milestone M1: Setup & DSL Parser / Layout Solver (`package.json`, `tsconfig.json`, `ast.ts`, `lexer.ts`, `parser.ts`, `importResolver.ts`, `math.ts`, `dependencyGraph.ts`).
   - Milestone M2: Rendering & Export Engine (`drawUtils.ts`, `fontLoader.ts`, `canvasRenderer.ts`, `psdExporter.ts`).
   - Milestone M3: Pipeline & CLI (`build.ts`, `cli.ts`, `index.ts`).
   - Milestone M4 (Final Phase 1): 100% E2E Test Pass (Tiers 1-4).
   - Milestone M5 (Final Phase 2): Adversarial Coverage Hardening (Tier 5).
