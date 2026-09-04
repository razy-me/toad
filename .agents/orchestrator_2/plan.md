# Orchestration Plan — orchestrator_2

## Strategy Overview
Orchestrator_2 takes over from orchestrator_1 to finalize the TOAD compiler implementation, complete all milestones M2-M5, verify 100% pass on all 245 E2E tests, and harden against adversarial cases.

## Step-by-Step Milestones

### Milestone M2 Remediation:
1. **Target issues**:
   - `tsconfig.json`: add `"DOM"` to `"lib": ["ES2022", "DOM"]` to resolve Canvas DOM types.
   - `src/engine/fontLoader.ts`: fix `GlobalFonts.registerFromPath` return type conversion (`Boolean(GlobalFonts.registerFromPath(...))`), ensure directory basePath check (`fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()`).
   - `src/engine/drawUtils.ts`: import `SKRSContext2D` from `@napi-rs/canvas`, ensure correct typing for gradients and canvas context, implement safe filter parsing that avoids Skia C++ crash in `@napi-rs/canvas` (e.g. software/safe wrapper or fallback when native filter is unstable on Windows).
   - `src/engine/canvasRenderer.ts`: generalize sibling clipping masks to scan all children and render base mask fill/stroke before clipping.
   - `src/parser/math.ts`: handle `elem.radius` when computing circle dimensions (`w = 2 * radius`, `h = 2 * radius`).
   - `tests/psdExporter.test.ts`: fix float assertion using `toBeCloseTo(239, 0)`.
2. **Workers & Verifiers**:
   - Dispatch `teamwork_preview_worker` (`worker_m2_fix`)
   - Dispatch `teamwork_preview_reviewer` (`reviewer_m2_fix`)
   - Dispatch `teamwork_preview_challenger` (`challenger_m2_fix`)
   - Dispatch `teamwork_preview_auditor` (`auditor_m2_fix`)
   - Gate M2.

### Milestone M3: Build Pipeline, CLI & Public API
1. **Scope**:
   - `src/build.ts`: Unified `compileTOAD()` orchestration pipeline: parses .TOAD, resolves imports & components, solves layout, loads fonts, renders to Canvas/PNG/JPG/PSD based on format/scale options, writes output files to target directory, returns BuildResult with file paths, canvas dims, timing, and warnings.
   - `src/cli.ts`: `commander` CLI with executable `TOAD` and command `build <entry> [options]` supporting `--scale <scale>`, `--format <format>` (png, jpg, psd, all), `--out <dir>`, `--fonts <dir>`, `--watch`. Includes informative console output, error handling with non-zero exit codes on fatal errors.
   - `src/index.ts`: Public API exports (parseTOAD, solveLayout, renderToCanvas, renderToBuffer, exportToPsd, compileTOAD, types).
   - Watch mode: `chokidar` integration in CLI tracking entry and all transitively imported `.TOAD` dependencies.
   - Tests: `tests/cli.test.ts` and `tests/build.test.ts`.
2. **Workers & Verifiers**:
   - Dispatch `teamwork_preview_worker` (`worker_m3`)
   - Dispatch `teamwork_preview_reviewer` (`reviewer_m3`)
   - Dispatch `teamwork_preview_challenger` (`challenger_m3`)
   - Dispatch `teamwork_preview_auditor` (`auditor_m3`)
   - Gate M3.

### Milestone M4: E2E Test Suite Execution & Integration
1. **Scope**:
   - Run complete 245-test suite:
     - `tests/e2e/tier1_features.test.ts` (100 tests)
     - `tests/e2e/tier2_boundaries.test.ts` (100 tests)
     - `tests/e2e/tier3_combinations.test.ts` (20 tests)
     - `tests/e2e/tier4_workloads.test.ts` (25 tests)
   - Fix any integration regressions, edge-case discrepancies, or missing handlers.
   - Verify 100% tests pass cleanly with 0 failures.
2. **Workers & Verifiers**:
   - Dispatch `teamwork_preview_worker` (`worker_m4_e2e`)
   - Dispatch `teamwork_preview_reviewer` (`reviewer_m4`)
   - Dispatch `teamwork_preview_auditor` (`auditor_m4`)
   - Gate M4.

### Milestone M5: Adversarial Coverage Hardening (Tier 5)
1. **Scope**:
   - White-box adversarial testing on parser stress, cyclic graphs, deep ASTs, malformed syntax recovery, corrupted font files, memory stability.
   - Close any remaining edge cases.
2. **Workers & Verifiers**:
   - Dispatch `teamwork_preview_challenger` (`challenger_m5`)
   - Dispatch `teamwork_preview_worker` (`worker_m5_fix` if any issues found)
   - Dispatch `teamwork_preview_auditor` (`auditor_m5`)
   - Gate M5.

### Final Reporting:
- Compile comprehensive verification evidence and report to Sentinel.
