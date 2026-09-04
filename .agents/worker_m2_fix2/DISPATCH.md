## 2026-08-18T16:55:16Z
You are worker_m2_fix2.
Your working directory is c:/Users/flori/Downloads/toad/.agents/worker_m2_fix2.
You MUST read:
- c:/Users/flori/Downloads/toad/ORIGINAL_REQUEST.md
- c:/Users/flori/Downloads/toad/PROJECT.md
- c:/Users/flori/Downloads/toad/.agents/reviewer_m2_fix/handoff.md
- c:/Users/flori/Downloads/toad/.agents/challenger_m2_fix/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Fix the unhandled native TypeError in `drawImageWithFit` in `src/engine/drawUtils.ts`:
When `drawImageWithFit` is called with mock/non-Canvas image objects (e.g., in `tests/canvasRenderer.test.ts:214` with `{ width: 400, height: 200 }`), `@napi-rs/canvas` native `(ctx as SKRSContext2D).drawImage(...)` throws `TypeError: Value is not one of these types: CanvasElement, SVGCanvas, Image`.

In `src/engine/drawUtils.ts:486-527`:
Wrap every call to `(ctx as SKRSContext2D).drawImage(...)` inside `drawImageWithFit` in a `try { ... } catch {}` block so that if an invalid or mock image object is passed, it does not throw an unhandled error.

Verification Commands to run:
1. `node ./node_modules/typescript/bin/tsc --noEmit` -> Must succeed with 0 errors.
2. `node ./node_modules/vitest/vitest.mjs run tests/canvasRenderer.test.ts tests/psdExporter.test.ts tests/challenger_m2_1.test.ts tests/challenger_m2_fix.test.ts` -> All 58 tests must pass 100% (13/13 in canvasRenderer.test.ts, 8/8 in psdExporter.test.ts, 24/24 in challenger_m2_1.test.ts, 13/13 in challenger_m2_fix.test.ts).
3. `npm test` -> Run full test suite to ensure 100% pass across all unit and integration tests.

When complete, write your handoff report to `c:/Users/flori/Downloads/toad/.agents/worker_m2_fix2/handoff.md` and send a message back.
