## 2026-08-18T16:56:58Z

You are worker_m3.
Your working directory is c:/Users/flori/Downloads/toad/.agents/worker_m3.
You MUST read:
- c:/Users/flori/Downloads/toad/ORIGINAL_REQUEST.md
- c:/Users/flori/Downloads/toad/PROJECT.md
- c:/Users/flori/Downloads/toad/TEST_INFRA.md
- c:/Users/flori/Downloads/toad/TEST_READY.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Implement Milestone M3: Build Pipeline, Commander CLI, Public API & Watch Mode:
1. Implement `src/build.ts`:
   - Function `compileTOAD(entryPath: string, options?: BuildOptions): Promise<BuildResult>`
   - Support options:
     - `outDir?: string` (default: dirname of entryPath or './dist')
     - `format?: 'png' | 'jpg' | 'psd' | 'all'` (default: 'png')
     - `scale?: number` (default: 1)
     - `fontsDir?: string`
     - `watch?: boolean`
     - `quality?: number` (default: 0.92 for jpg)
   - Read and parse DSL entry file, resolve imports and components, solve layout, register fonts from fontsDir and @font directives.
   - Render outputs according to `format`:
     - `'png'`: CanvasRenderer -> PNG buffer -> write `${outDir}/${baseName}.png`
     - `'jpg'`: CanvasRenderer -> JPEG buffer -> write `${outDir}/${baseName}.jpg`
     - `'psd'`: PsdExporter -> PSD buffer -> write `${outDir}/${baseName}.psd`
     - `'all'`: generate and write all 3 files (.png, .jpg, .psd)
   - Ensure output directory is created (`fs.mkdirSync(outDir, { recursive: true })`).
   - Return structured `BuildResult` with `success`, `entryPath`, `outputFiles`, `layout`, `canvas`, `dependencies` (all transitive .TOAD files), `warnings`, and `durationMs`.
   - Comprehensive error handling when file does not exist or syntax errors occur.

2. Implement `src/cli.ts`:
   - Shebang `#!/usr/bin/env node`
   - Use `commander` to build `TOAD` CLI tool.
   - Command `build <entry>` (and default command on `<entry>`):
     - `--scale <number>` (or `-s`, float scale multiplier, default 1)
     - `--format <format>` (or `-f`, 'png' | 'jpg' | 'psd' | 'all', default 'png')
     - `--out <dir>` (or `-o`, output directory)
     - `--fonts <dir>` (fonts directory)
     - `--watch` (or `-w`, watch mode)
   - In standard mode: execute `compileTOAD`, log output summary to console, exit with non-zero code on error.
   - In watch mode (`-w` / `--watch`):
     - Initial compilation.
     - Use `chokidar` to watch `entryPath` and all transitively resolved `dependencies`.
     - On file change/add/unlink: recompile, update watcher with any new dependencies, log status.
     - On compile error in watch mode: print error message to console and keep watching without crashing.

3. Implement `src/index.ts`:
   - Export all public types, classes, and helper functions across AST, parser, resolver, math/layout solver, canvas renderer, psd exporter, font loader, and build pipeline.

4. Create unit & integration tests:
   - `tests/build.test.ts`: test programmatic `compileTOAD()` with various fixtures (`social_card.TOAD`, `product_banner.TOAD`, etc.), different formats (`png`, `jpg`, `psd`, `all`), scales (`1x`, `2x`), custom fonts directory, error handling on non-existent files and invalid syntax.
   - `tests/cli.test.ts`: test CLI invocation, argument parsing, help output, version output, file creation, and error exit codes.

5. Update `package.json` if needed (ensure `"bin": { "TOAD": "./dist/cli.js" }` or `"ts-node"` / proper CLI entry mapping if applicable, and scripts).

Verification Commands to run:
1. `node ./node_modules/typescript/bin/tsc --noEmit` -> 0 errors.
2. `node ./node_modules/vitest/vitest.mjs run tests/build.test.ts tests/cli.test.ts` -> All tests pass 100%.
3. `npm test` -> Run all unit and integration test suites.

When complete, write your handoff report to `c:/Users/flori/Downloads/toad/.agents/worker_m3/handoff.md` and send a message back with your findings and verification results.
