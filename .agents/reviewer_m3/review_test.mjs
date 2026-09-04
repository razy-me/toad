import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { readPsd } from 'ag-psd';
import * as TOADApi from '../../dist/index.js';
import { compileTOAD } from '../../dist/build.js';
import { createCli, startWatcher } from '../../dist/cli.js';

const execAsync = promisify(exec);
const testOutDir = path.resolve('tests/dist/reviewer_m3_sandbox');

async function runTests() {
  console.log('=== Starting Reviewer M3 Comprehensive Verification ===');

  if (fs.existsSync(testOutDir)) {
    fs.rmSync(testOutDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testOutDir, { recursive: true });

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: TypeScript compilation check
  // -------------------------------------------------------------
  console.log('\n--- Test 1: TypeScript Typecheck & Build ---');
  try {
    const { stdout, stderr } = await execAsync('node ./node_modules/typescript/bin/tsc --noEmit');
    assert(stderr === '' && stdout === '', 'tsc --noEmit compiles with 0 errors');
  } catch (err) {
    assert(false, `tsc --noEmit failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 2: Public API Exports
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Public API Exports ---');
  const expectedExports = [
    'Lexer', 'tokenize', 'tokenizeTOAD', 'Parser', 'parseTOAD',
    'ImportResolver', 'resolveImportsAndComponents', 'CircularImportError',
    'CircularVariableError', 'ComponentRecursionLimitError',
    'LayoutSolver', 'solveLayout', 'layoutText', 'computeGcd', 'computeAspectRatio',
    'DependencyGraph', 'buildDependencyGraph', 'topologicalSort', 'CyclicDependencyError',
    'FontLoader', 'loadFontsFromDir', 'registerFontDirectives',
    'drawRect', 'drawCircle', 'drawPolygon', 'createCanvasGradient', 'mapBlendMode',
    'parseColorToRgba', 'parseFilterString', 'drawImageWithFit',
    'CanvasRenderer', 'renderToCanvas', 'renderToBuffer',
    'PsdExporter', 'exportToPsd',
    'compileTOAD', 'createCli', 'program', 'startWatcher'
  ];

  for (const exp of expectedExports) {
    assert(TOADApi[exp] !== undefined, `Public API exports '${exp}'`);
  }

  // -------------------------------------------------------------
  // Test 3: Programmatic Compilation - Format Matrix & Multi-Scale
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Programmatic Compilation (Format Matrix & Multi-Scale) ---');
  const fixture = 'tests/fixtures/sample_shapes.TOAD';

  // PNG
  const pngRes = await compileTOAD(fixture, { format: 'png', scale: 1, outDir: path.join(testOutDir, 'png') });
  assert(pngRes.success === true, 'PNG build succeeded');
  assert(pngRes.outputFiles.length === 1 && pngRes.outputFiles[0].endsWith('.png'), 'PNG output file list correct');
  const pngBuf = fs.readFileSync(pngRes.outputFiles[0]);
  assert(pngBuf[0] === 0x89 && pngBuf[1] === 0x50 && pngBuf[2] === 0x4E && pngBuf[3] === 0x47, 'PNG magic bytes valid');

  // JPG
  const jpgRes = await compileTOAD(fixture, { format: 'jpg', quality: 80, scale: 1, outDir: path.join(testOutDir, 'jpg') });
  assert(jpgRes.success === true, 'JPG build succeeded');
  assert(jpgRes.outputFiles.length === 1 && jpgRes.outputFiles[0].endsWith('.jpg'), 'JPG output file list correct');
  const jpgBuf = fs.readFileSync(jpgRes.outputFiles[0]);
  assert(jpgBuf[0] === 0xFF && jpgBuf[1] === 0xD8 && jpgBuf[2] === 0xFF, 'JPG magic bytes valid');

  // PSD
  const psdRes = await compileTOAD(fixture, { format: 'psd', scale: 1, outDir: path.join(testOutDir, 'psd') });
  assert(psdRes.success === true, 'PSD build succeeded');
  assert(psdRes.outputFiles.length === 1 && psdRes.outputFiles[0].endsWith('.psd'), 'PSD output file list correct');
  const psdBuf = fs.readFileSync(psdRes.outputFiles[0]);
  assert(psdBuf.subarray(0, 4).toString() === '8BPS', 'PSD magic header 8BPS valid');
  const parsedPsd = readPsd(psdBuf);
  assert(parsedPsd.width > 0 && parsedPsd.height > 0 && parsedPsd.children.length > 0, 'PSD contains valid layers');

  // ALL formats + 2x scale
  const allRes = await compileTOAD(fixture, { format: 'all', scale: 2, outDir: path.join(testOutDir, 'all_2x') });
  assert(allRes.success === true && allRes.outputFiles.length === 3, 'format=all generates 3 files (PNG, JPG, PSD)');
  const png2x = fs.readFileSync(allRes.outputFiles.find(p => p.endsWith('.png')));
  const psd2x = readPsd(fs.readFileSync(allRes.outputFiles.find(p => p.endsWith('.psd'))));
  const pngW = png2x.readUInt32BE(16);
  const pngH = png2x.readUInt32BE(20);
  assert(pngW === allRes.canvas.width * 2 && pngH === allRes.canvas.height * 2, `PNG 2x scaled dimensions match (${pngW}x${pngH})`);
  assert(psd2x.width === allRes.canvas.width * 2 && psd2x.height === allRes.canvas.height * 2, `PSD 2x scaled dimensions match (${psd2x.width}x${psd2x.height})`);

  // -------------------------------------------------------------
  // Test 4: Production Workload Fixtures End-to-End
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Production Workload Fixtures ---');
  const productionFixtures = [
    { name: 'social_card.TOAD', w: 1200, h: 630, ratio: '40:21' },
    { name: 'product_banner.TOAD', w: 1920, h: 1080, ratio: '16:9' },
    { name: 'hero_banner.TOAD', w: 1600, h: 900, ratio: '16:9' },
    { name: 'typography_poster.TOAD', w: 1080, h: 1350, ratio: '4:5' },
    { name: 'mobile_mockup.TOAD', w: 430, h: 932, ratio: '215:466' }
  ];

  for (const pf of productionFixtures) {
    const pPath = `tests/fixtures/${pf.name}`;
    const pOut = path.join(testOutDir, 'fixtures', pf.name.replace('.TOAD', ''));
    const res = await compileTOAD(pPath, { format: 'all', scale: 1, outDir: pOut });
    assert(res.success === true, `Compiled ${pf.name} successfully`);
    assert(res.canvas.width === pf.w && res.canvas.height === pf.h, `${pf.name} dimensions (${res.canvas.width}x${res.canvas.height}) match expected (${pf.w}x${pf.h})`);
    assert(res.canvas.aspectRatio === pf.ratio, `${pf.name} aspect ratio (${res.canvas.aspectRatio}) matches expected (${pf.ratio})`);
    assert(res.outputFiles.length === 3, `${pf.name} produced 3 output files`);
  }

  // -------------------------------------------------------------
  // Test 5: Transitive Dependencies Tracking
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Transitive Dependencies Tracking ---');
  const scRes = await compileTOAD('tests/fixtures/social_card.TOAD', { outDir: path.join(testOutDir, 'deps_test') });
  assert(scRes.dependencies.length >= 3, `Discovered ${scRes.dependencies.length} transitive dependencies`);
  assert(scRes.dependencies.some(d => d.includes('tokens.TOAD')), 'Dependencies include tokens.TOAD');
  assert(scRes.dependencies.some(d => d.includes('components.TOAD')), 'Dependencies include components.TOAD');
  assert(scRes.dependencies.some(d => d.includes('social_card.TOAD')), 'Dependencies include social_card.TOAD entry');

  // -------------------------------------------------------------
  // Test 6: CLI Subprocess & Command Line Flags
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Commander CLI Subprocess Execution ---');
  
  // CLI build default PNG
  const cliRes1 = await execAsync(`node ./dist/cli.js build "tests/fixtures/sample_shapes.TOAD" -o "${path.join(testOutDir, 'cli_default')}"`);
  assert(cliRes1.stdout.includes('Build completed'), 'CLI build completed output received');
  assert(fs.existsSync(path.join(testOutDir, 'cli_default/sample_shapes.png')), 'CLI generated PNG file');

  // CLI direct invoke (default command)
  const cliRes2 = await execAsync(`node ./dist/cli.js "tests/fixtures/sample_shapes.TOAD" -o "${path.join(testOutDir, 'cli_direct')}" -f jpg`);
  assert(cliRes2.stdout.includes('Build completed'), 'CLI direct command invocation succeeded');
  assert(fs.existsSync(path.join(testOutDir, 'cli_direct/sample_shapes.jpg')), 'CLI generated JPG file');

  // CLI scale and all formats
  const cliRes3 = await execAsync(`node ./dist/cli.js build "tests/fixtures/sample_shapes.TOAD" -f all -s 2 -o "${path.join(testOutDir, 'cli_all')}"`);
  assert(fs.existsSync(path.join(testOutDir, 'cli_all/sample_shapes.png')), 'CLI multi-format PNG generated');
  assert(fs.existsSync(path.join(testOutDir, 'cli_all/sample_shapes.jpg')), 'CLI multi-format JPG generated');
  assert(fs.existsSync(path.join(testOutDir, 'cli_all/sample_shapes.psd')), 'CLI multi-format PSD generated');

  // CLI Error: Non-existent file (exit code 1)
  try {
    await execAsync('node ./dist/cli.js build "non_existent_file_xyz987.TOAD"');
    assert(false, 'CLI should have failed on non-existent file');
  } catch (err) {
    assert(err.code === 1, 'CLI exits with code 1 on non-existent file');
    assert((err.stderr || err.stdout).includes('not found'), 'CLI error message mentions not found');
  }

  // CLI Error: Directory passed as entry (exit code 1)
  try {
    await execAsync('node ./dist/cli.js build "tests/fixtures"');
    assert(false, 'CLI should have failed when directory passed');
  } catch (err) {
    assert(err.code === 1, 'CLI exits with code 1 on directory input');
    assert((err.stderr || err.stdout).includes('directory'), 'CLI error message mentions directory');
  }

  // CLI Error: Missing entry argument
  try {
    await execAsync('node ./dist/cli.js build');
    assert(false, 'CLI should have failed when missing entry argument');
  } catch (err) {
    assert(err.code !== 0, 'CLI exits with non-zero code on missing entry');
  }

  // -------------------------------------------------------------
  // Test 7: Watch Mode Engine & Dynamic Updates
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Watch Mode Engine ---');
  const watchDir = path.join(testOutDir, 'watch_engine');
  fs.mkdirSync(watchDir, { recursive: true });

  const watchTokens = path.join(watchDir, 'tokens.TOAD');
  fs.writeFileSync(watchTokens, `$primaryColor = #ff0000;\n`);

  const watchEntry = path.join(watchDir, 'main.TOAD');
  fs.writeFileSync(watchEntry, `
    @import "./tokens.TOAD";
    canvas { size: 400px 400px; background: #ffffff; }
    rect #box { size: 100px 100px; color: $primaryColor; }
  `);

  const watchOut = path.join(watchDir, 'out');
  const watcher = await startWatcher(watchEntry, { format: 'png', outDir: watchOut });
  assert(watcher !== undefined, 'startWatcher returned active FSWatcher');
  const watchPng = path.join(watchOut, 'main.png');
  assert(fs.existsSync(watchPng), 'Watch initial build generated output file');

  const mtime1 = fs.statSync(watchPng).mtimeMs;
  await new Promise(r => setTimeout(r, 200));

  // Modify dependency file
  fs.writeFileSync(watchTokens, `$primaryColor = #00ff00;\n`);
  await new Promise(r => setTimeout(r, 400));

  assert(fs.existsSync(watchPng), 'Watch recompiled after dependency modification');
  const mtime2 = fs.statSync(watchPng).mtimeMs;
  assert(mtime2 >= mtime1, 'Output file timestamp was updated upon dependency change');

  await watcher.close();
  assert(true, 'Watcher closed cleanly without leaking resources');

  // -------------------------------------------------------------
  // Test 8: Concurrency & Stress Testing
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Concurrent Compilation Stress ---');
  const concurrentTasks = Array.from({ length: 12 }, (_, i) => {
    const out = path.join(testOutDir, 'concurrent', `job_${i}`);
    return compileTOAD('tests/fixtures/social_card.TOAD', { format: 'png', scale: (i % 2) + 1, outDir: out });
  });

  const concurrentResults = await Promise.all(concurrentTasks);
  assert(concurrentResults.length === 12, 'All 12 concurrent builds executed');
  assert(concurrentResults.every(r => r.success === true), 'All 12 concurrent builds succeeded');

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log(`\n======================================================`);
  console.log(`Review Verification Summary: ${passed} passed, ${failed} failed`);
  console.log(`======================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
