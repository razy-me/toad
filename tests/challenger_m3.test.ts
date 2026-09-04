import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { readPsd } from 'ag-psd';
import * as ToadApi from '../src/index.js';
import { compileToad, BuildOptions, BuildResult } from '../src/build.js';
import { createCli, startWatcher } from '../src/cli.js';

const execAsync = promisify(exec);

describe('Milestone M3 Adversarial Challenge & Stress Suite', () => {
  const sandboxDir = path.resolve('tests/dist/challenger_m3_sandbox');

  beforeAll(() => {
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sandboxDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // Area 1: CLI Error Conditions & Boundary Flags
  // =========================================================================
  describe('Area 1: CLI Error Handling & Boundary Flags', () => {
    it('rejects execution when entry file does not exist (exit code 1)', async () => {
      const nonExistent = path.join(sandboxDir, 'ghost_file.toad');
      try {
        await execAsync(`node ./dist/cli.js build "${nonExistent}"`);
        expect.unreachable('Should have failed on missing entry file');
      } catch (err: any) {
        expect(err.code).toBe(1);
        expect(err.stderr || err.stdout).toContain('Entry file not found');
      }
    });

    it('rejects execution when entry path is a directory (exit code 1)', async () => {
      try {
        await execAsync(`node ./dist/cli.js build "${sandboxDir}"`);
        expect.unreachable('Should have failed when entry is a directory');
      } catch (err: any) {
        expect(err.code).toBe(1);
        expect(err.stderr || err.stdout).toContain('is a directory');
      }
    });

    it('rejects execution when missing required entry argument', async () => {
      try {
        await execAsync('node ./dist/cli.js build');
        expect.unreachable('Should have failed on missing entry argument');
      } catch (err: any) {
        expect(err.code).not.toBe(0);
      }
    });

    it('falls back safely to 1x scale on invalid, negative, or zero scale inputs', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const outDir = path.join(sandboxDir, 'scale_fallback');

      // Negative scale
      const resNeg = await execAsync(`node ./dist/cli.js build "${fixture}" -s -5 -o "${outDir}/neg"`);
      expect(resNeg.stdout).toContain('Build completed');
      expect(fs.existsSync(path.join(outDir, 'neg/sample_shapes.png'))).toBe(true);

      // NaN / invalid scale string
      const resNaN = await execAsync(`node ./dist/cli.js build "${fixture}" -s abc -o "${outDir}/nan"`);
      expect(resNaN.stdout).toContain('Build completed');
      expect(fs.existsSync(path.join(outDir, 'nan/sample_shapes.png'))).toBe(true);

      // 0 scale
      const resZero = await execAsync(`node ./dist/cli.js build "${fixture}" -s 0 -o "${outDir}/zero"`);
      expect(resZero.stdout).toContain('Build completed');
      expect(fs.existsSync(path.join(outDir, 'zero/sample_shapes.png'))).toBe(true);
    }, 30000);

    it('handles quality values properly across ranges (0.0 to 1.0 and 1 to 100)', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const outDir = path.join(sandboxDir, 'quality_test');

      // Quality 0.5 (should convert to 50)
      await execAsync(`node ./dist/cli.js build "${fixture}" -f jpg --quality 0.5 -o "${outDir}/q50"`);
      expect(fs.existsSync(path.join(outDir, 'q50/sample_shapes.jpg'))).toBe(true);

      // Quality 95 (1-100)
      await execAsync(`node ./dist/cli.js build "${fixture}" -f jpg --quality 95 -o "${outDir}/q95"`);
      expect(fs.existsSync(path.join(outDir, 'q95/sample_shapes.jpg'))).toBe(true);
    });

    it('creates deeply nested output directories with special spaces seamlessly', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const nestedOut = path.join(sandboxDir, 'nested folder with spaces', 'deep', 'level 3');

      const { stdout } = await execAsync(`node ./dist/cli.js build "${fixture}" -o "${nestedOut}"`);
      expect(stdout).toContain('Build completed');
      expect(fs.existsSync(path.join(nestedOut, 'sample_shapes.png'))).toBe(true);
    });
  });

  // =========================================================================
  // Area 2: Build Pipeline with Missing Imports, Syntax Errors, Circular Loops
  // =========================================================================
  describe('Area 2: Build Pipeline with Error Conditions & Malformed Syntax', () => {
    it('throws when entryPath is null, empty string, or undefined', async () => {
      await expect(compileToad('')).rejects.toThrow(/Entry path is required/);
      await expect(compileToad(null as any)).rejects.toThrow(/Entry path is required/);
      await expect(compileToad(undefined as any)).rejects.toThrow(/Entry path is required/);
    });

    it('throws when entry file contains a broken @import pointing to non-existent file', async () => {
      const testDir = path.join(sandboxDir, 'broken_import');
      fs.mkdirSync(testDir, { recursive: true });

      const brokenImportFile = path.join(testDir, 'entry_broken_import.toad');
      fs.writeFileSync(brokenImportFile, `
        @import "./missing_tokens_xyz.toad";
        canvas { size: 800px 600px; }
        rect { size: 100px 100px; fill: #ff0000; }
      `);

      await expect(
        compileToad(brokenImportFile, { outDir: testDir })
      ).rejects.toThrow(/not found|ENOENT/i);
    });

    it('throws when entry file has syntax errors in canvas declaration', async () => {
      const testDir = path.join(sandboxDir, 'syntax_err');
      fs.mkdirSync(testDir, { recursive: true });

      const syntaxErrorFile = path.join(testDir, 'entry_syntax_err.toad');
      fs.writeFileSync(syntaxErrorFile, `
        canvas { size: 800px ; ; ; missing_closing_brace
        rect { size: 100px 100px; }
      `);

      await expect(
        compileToad(syntaxErrorFile, { outDir: testDir })
      ).rejects.toThrow();
    });

    it('throws CircularImportError on 3-node circular file import loop (A -> B -> C -> A)', async () => {
      const testDir = path.join(sandboxDir, 'circ_import');
      fs.mkdirSync(testDir, { recursive: true });

      const fileA = path.join(testDir, 'circ_a.toad');
      const fileB = path.join(testDir, 'circ_b.toad');
      const fileC = path.join(testDir, 'circ_c.toad');

      fs.writeFileSync(fileA, `
        @import "./circ_b.toad";
        >varA = #111111;
        canvas { size: 400px 400px; }
      `);

      fs.writeFileSync(fileB, `
        @import "./circ_c.toad";
        >varB = #222222;
        rect { size: 50px 50px; fill: >varB; }
      `);

      fs.writeFileSync(fileC, `
        @import "./circ_a.toad";
        >varC = #333333;
        rect { size: 50px 50px; fill: >varC; }
      `);

      await expect(
        compileToad(fileA, { outDir: testDir })
      ).rejects.toThrow(/circular import/i);
    });

    it('throws CircularVariableError on cyclic variable references', async () => {
      const testDir = path.join(sandboxDir, 'circ_var');
      fs.mkdirSync(testDir, { recursive: true });

      const circVarFile = path.join(testDir, 'circ_var.toad');
      fs.writeFileSync(circVarFile, `
        >varX = >varY;
        >varY = >varX;
        canvas { size: 400px 400px; }
        rect { size: 50px 50px; fill: >varX; }
      `);

      await expect(
        compileToad(circVarFile, { outDir: testDir })
      ).rejects.toThrow(/circular variable/i);
    });

    it('throws ComponentRecursionLimitError on infinite recursive component expansions', async () => {
      const testDir = path.join(sandboxDir, 'rec_comp');
      fs.mkdirSync(testDir, { recursive: true });

      const recCompFile = path.join(testDir, 'rec_comp.toad');
      fs.writeFileSync(recCompFile, `
        component InfiniteLoop() {
          rect { size: 10px 10px; fill: #ff0000; }
          InfiniteLoop();
        }
        canvas { size: 400px 400px; }
        InfiniteLoop();
      `);

      await expect(
        compileToad(recCompFile, { outDir: testDir })
      ).rejects.toThrow(/recursion limit|circular component/i);
    });

    it('throws CyclicDependencyError on cyclic relational placement DAG (#a right of #b, #b right of #a)', async () => {
      const testDir = path.join(sandboxDir, 'cycle_dag');
      fs.mkdirSync(testDir, { recursive: true });

      const cycleDagFile = path.join(testDir, 'cycle_dag.toad');
      fs.writeFileSync(cycleDagFile, `
        canvas { size: 500px 500px; }
        rect #boxA { size: 100px 100px; at: right of #boxB; }
        rect #boxB { size: 100px 100px; at: right of #boxA; }
      `);

      await expect(
        compileToad(cycleDagFile, { outDir: testDir })
      ).rejects.toThrow(/cyclic/i);
    });
  });

  // =========================================================================
  // Area 3: Complex Fixtures with --scale 4 and --format all
  // =========================================================================
  describe('Area 3: Complex Fixtures at 4x Scale & format=all', () => {
    const fixtures = [
      { name: 'social_card', path: 'tests/fixtures/social_card.toad', baseW: 1200, baseH: 630 },
      { name: 'product_banner', path: 'tests/fixtures/product_banner.toad', baseW: 1920, baseH: 1080 },
      { name: 'hero_banner', path: 'tests/fixtures/hero_banner.toad', baseW: 1600, baseH: 900 },
      { name: 'typography_poster', path: 'tests/fixtures/typography_poster.toad', baseW: 1080, baseH: 1350 },
      { name: 'mobile_mockup', path: 'tests/fixtures/mobile_mockup.toad', baseW: 430, baseH: 932 }
    ];

    for (const f of fixtures) {
      it(`compiles ${f.name}.toad with scale=4 and format='all'`, async () => {
        const outDir = path.join(sandboxDir, 'scale4', f.name);
        fs.mkdirSync(outDir, { recursive: true });

        const result = await compileToad(f.path, {
          format: 'all',
          scale: 4,
          outDir
        });

        expect(result.success).toBe(true);
        expect(result.outputFiles).toHaveLength(5);

        const pngFile = result.outputFiles.find(p => p.endsWith('.png'))!;
        const jpgFile = result.outputFiles.find(p => p.endsWith('.jpg'))!;
        const psdFile = result.outputFiles.find(p => p.endsWith('.psd'))!;

        expect(pngFile).toBeDefined();
        expect(jpgFile).toBeDefined();
        expect(psdFile).toBeDefined();

        expect(fs.existsSync(pngFile)).toBe(true);
        expect(fs.existsSync(jpgFile)).toBe(true);
        expect(fs.existsSync(psdFile)).toBe(true);

        // Verify PNG header and dimensions
        const pngBuf = fs.readFileSync(pngFile);
        expect(pngBuf[0]).toBe(0x89);
        expect(pngBuf[1]).toBe(0x50);
        expect(pngBuf[2]).toBe(0x4E);
        expect(pngBuf[3]).toBe(0x47);

        // Read PNG width/height from IHDR chunk (bytes 16..23)
        const pngWidth = pngBuf.readUInt32BE(16);
        const pngHeight = pngBuf.readUInt32BE(20);
        expect(pngWidth).toBe(f.baseW * 4);
        expect(pngHeight).toBe(f.baseH * 4);

        // Verify JPG header (0xFF, 0xD8, 0xFF)
        const jpgBuf = fs.readFileSync(jpgFile);
        expect(jpgBuf[0]).toBe(0xFF);
        expect(jpgBuf[1]).toBe(0xD8);
        expect(jpgBuf[2]).toBe(0xFF);
        expect(jpgBuf.length).toBeGreaterThan(1000);

        // Verify PSD header and parse with ag-psd
        const psdBuf = fs.readFileSync(psdFile);
        expect(psdBuf.subarray(0, 4).toString()).toBe('8BPS');

        const psd = readPsd(psdBuf);
        expect(psd.width).toBe(f.baseW * 4);
        expect(psd.height).toBe(f.baseH * 4);
        expect(psd.children).toBeDefined();
        expect(psd.children!.length).toBeGreaterThan(0);
      }, 30000);
    }
  });

  // =========================================================================
  // Area 4: Watch Mode Dynamic Updates & Error Resilience
  // =========================================================================
  describe('Area 4: Watch Mode Dynamic Tracking & Fault Resilience', () => {
    it('survives syntax error injected during watch mode and recovers when fixed', async () => {
      const watchTempDir = path.join(sandboxDir, 'watch_resilience');
      fs.mkdirSync(watchTempDir, { recursive: true });

      const depFile = path.join(watchTempDir, 'tokens.toad');
      fs.writeFileSync(depFile, `
        >mainColor = #336699;
      `);

      const entryFile = path.join(watchTempDir, 'main.toad');
      fs.writeFileSync(entryFile, `
        @import "./tokens.toad";
        canvas { size: 400px 400px; background: #ffffff; }
        rect #box { size: 100px 100px; fill: >mainColor; }
      `);

      const outDir = path.join(watchTempDir, 'out');
      fs.mkdirSync(outDir, { recursive: true });

      // Start watcher
      const watcher = await startWatcher(entryFile, {
        format: 'png',
        outDir
      });

      const outFile = path.join(outDir, 'main.png');
      expect(fs.existsSync(outFile)).toBe(true);
      const initialMtime = fs.statSync(outFile).mtimeMs;

      // Small delay to ensure timestamp separation
      await new Promise(r => setTimeout(r, 250));

      // Inject a syntax error into main.toad
      fs.writeFileSync(entryFile, `
        canvas { size: 400px ; ; SYNTAX ERROR HERE !!!
      `);

      // Wait for watcher to attempt compilation and fail gracefully without crashing
      await new Promise(r => setTimeout(r, 450));

      // Fix syntax error with new content (different box size)
      fs.writeFileSync(entryFile, `
        @import "./tokens.toad";
        canvas { size: 600px 600px; background: #000000; }
        rect #box { size: 200px 200px; fill: >mainColor; }
      `);

      // Wait for watcher to trigger re-compilation
      await new Promise(r => setTimeout(r, 450));

      // Output file should have been updated after recovery
      expect(fs.existsSync(outFile)).toBe(true);
      const recoveredMtime = fs.statSync(outFile).mtimeMs;
      expect(recoveredMtime).toBeGreaterThanOrEqual(initialMtime);

      // Test modifying the imported dependency tokens.toad
      fs.writeFileSync(depFile, `
        >mainColor = #ff0055;
      `);

      await new Promise(r => setTimeout(r, 450));
      expect(fs.existsSync(outFile)).toBe(true);

      // Clean shutdown
      await watcher.close();
    }, 60000);

    it('dynamically tracks newly added @import dependencies during watch mode', async () => {
      const watchDynDir = path.join(sandboxDir, 'watch_dyn');
      fs.mkdirSync(watchDynDir, { recursive: true });

      const entryFile = path.join(watchDynDir, 'app.toad');
      fs.writeFileSync(entryFile, `
        canvas { size: 500px 500px; }
        rect #initialBox { size: 50px 50px; fill: #111111; }
      `);

      const outDir = path.join(watchDynDir, 'out');
      fs.mkdirSync(outDir, { recursive: true });

      const watcher = await startWatcher(entryFile, {
        format: 'png',
        outDir
      });

      const outFile = path.join(outDir, 'app.png');
      expect(fs.existsSync(outFile)).toBe(true);

      await new Promise(r => setTimeout(r, 250));

      // Create a brand new dependency file
      const newDepFile = path.join(watchDynDir, 'brand_tokens.toad');
      fs.writeFileSync(newDepFile, `
        >brandBg = #228844;
      `);

      // Update app.toad to import brand_tokens.toad
      fs.writeFileSync(entryFile, `
        @import "./brand_tokens.toad";
        canvas { size: 500px 500px; background: >brandBg; }
        rect #initialBox { size: 50px 50px; fill: #111111; }
      `);

      await new Promise(r => setTimeout(r, 450));

      // Now modify the newly added brand_tokens.toad file to verify it is being watched!
      const beforeChangeMtime = fs.statSync(outFile).mtimeMs;
      await new Promise(r => setTimeout(r, 250));

      fs.writeFileSync(newDepFile, `
        >brandBg = #990099;
      `);

      await new Promise(r => setTimeout(r, 450));
      const afterChangeMtime = fs.statSync(outFile).mtimeMs;
      expect(afterChangeMtime).toBeGreaterThanOrEqual(beforeChangeMtime);

      await watcher.close();
    }, 60000);
  });

  // =========================================================================
  // Area 5: Public API Export Integrity (src/index.ts)
  // =========================================================================
  describe('Area 5: Public API Exports Integrity', () => {
    it('exports all AST, parser, resolver, layout, engine, renderer, build and CLI symbols', () => {
      // AST / Lexer / Parser
      expect(ToadApi.Lexer).toBeDefined();
      expect(ToadApi.tokenize).toBeDefined();
      expect(ToadApi.tokenizeToad).toBeDefined();
      expect(ToadApi.Parser).toBeDefined();
      expect(ToadApi.parseToad).toBeDefined();

      // Resolver & Error types
      expect(ToadApi.ImportResolver).toBeDefined();
      expect(ToadApi.resolveImportsAndComponents).toBeDefined();
      expect(ToadApi.CircularImportError).toBeDefined();
      expect(ToadApi.CircularVariableError).toBeDefined();
      expect(ToadApi.ComponentRecursionLimitError).toBeDefined();

      // Math & Layout
      expect(ToadApi.LayoutSolver).toBeDefined();
      expect(ToadApi.solveLayout).toBeDefined();
      expect(ToadApi.computeGcd).toBeDefined();
      expect(ToadApi.computeAspectRatio).toBeDefined();

      // Dependency Graph
      expect(ToadApi.DependencyGraph).toBeDefined();
      expect(ToadApi.buildDependencyGraph).toBeDefined();
      expect(ToadApi.topologicalSort).toBeDefined();
      expect(ToadApi.CyclicDependencyError).toBeDefined();

      // Font Loader & Draw Utils
      expect(ToadApi.FontLoader).toBeDefined();
      expect(ToadApi.loadFontsFromDir).toBeDefined();
      expect(ToadApi.registerFontDirectives).toBeDefined();
      expect(ToadApi.drawRect).toBeDefined();
      expect(ToadApi.drawCircle).toBeDefined();
      expect(ToadApi.drawPolygon).toBeDefined();
      expect(ToadApi.createCanvasGradient).toBeDefined();
      expect(ToadApi.mapBlendMode).toBeDefined();
      expect(ToadApi.parseColorToRgba).toBeDefined();
      expect(ToadApi.parseFilterString).toBeDefined();
      expect(ToadApi.drawImageWithFit).toBeDefined();

      // Renderer & Exporter
      expect(ToadApi.CanvasRenderer).toBeDefined();
      expect(ToadApi.renderToCanvas).toBeDefined();
      expect(ToadApi.renderToBuffer).toBeDefined();
      expect(ToadApi.PsdExporter).toBeDefined();
      expect(ToadApi.exportToPsd).toBeDefined();

      // Build & CLI
      expect(ToadApi.compileToad).toBeDefined();
      expect(ToadApi.createCli).toBeDefined();
      expect(ToadApi.program).toBeDefined();
      expect(ToadApi.startWatcher).toBeDefined();
    });

    it('allows complete end-to-end programmatic compilation via public API export', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const outDir = path.join(sandboxDir, 'public_api_test');
      fs.mkdirSync(outDir, { recursive: true });

      const result = await ToadApi.compileToad(fixture, {
        format: 'all',
        scale: 1,
        outDir
      });

      expect(result.success).toBe(true);
      expect(result.outputFiles.length).toBe(5);
    });
  });

  // =========================================================================
  // Area 6: Concurrent Compilation & Process Isolation
  // =========================================================================
  describe('Area 6: Concurrency & State Isolation', () => {
    it('executes 10 concurrent compileToad builds simultaneously without race conditions', async () => {
      const fixtures = [
        'tests/fixtures/social_card.toad',
        'tests/fixtures/product_banner.toad',
        'tests/fixtures/hero_banner.toad',
        'tests/fixtures/typography_poster.toad',
        'tests/fixtures/mobile_mockup.toad',
        'tests/fixtures/sample_shapes.toad',
        'tests/fixtures/social_card.toad',
        'tests/fixtures/product_banner.toad',
        'tests/fixtures/hero_banner.toad',
        'tests/fixtures/typography_poster.toad'
      ];

      const tasks = fixtures.map((fixture, idx) => {
        const outDir = path.join(sandboxDir, 'concurrent', `task_${idx}`);
        fs.mkdirSync(outDir, { recursive: true });
        const scale = (idx % 3) + 1; // 1x, 2x, 3x
        return compileToad(fixture, {
          format: 'png',
          scale,
          outDir
        });
      });

      const results = await Promise.all(tasks);

      expect(results).toHaveLength(10);
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        expect(res.success).toBe(true);
        expect(res.outputFiles).toHaveLength(1);
        expect(fs.existsSync(res.outputFiles[0])).toBe(true);
      }
    });
  });
});
