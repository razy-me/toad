import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { readPsd } from 'ag-psd';
import * as TOADExports from '../../dist/index.js';
import { compileTOAD } from '../../dist/build.js';
import { createCli, startWatcher } from '../../dist/cli.js';

const execAsync = promisify(exec);

async function runAudit() {
  const auditOut = path.resolve('.agents/auditor_m3/audit_output');
  if (fs.existsSync(auditOut)) {
    fs.rmSync(auditOut, { recursive: true, force: true });
  }
  fs.mkdirSync(auditOut, { recursive: true });

  console.log('=== AUDIT CHECK 1: Public API Exports ===');
  const requiredExports = [
    'Lexer', 'tokenize', 'tokenizeTOAD', 'Parser', 'parseTOAD',
    'ImportResolver', 'resolveImportsAndComponents', 'CircularImportError', 'CircularVariableError', 'ComponentRecursionLimitError',
    'LayoutSolver', 'solveLayout', 'layoutText', 'computeGcd', 'computeAspectRatio',
    'DependencyGraph', 'buildDependencyGraph', 'topologicalSort', 'CyclicDependencyError',
    'FontLoader', 'registerFont', 'loadFontsFromDir', 'registerFontDirectives',
    'drawRect', 'drawCircle', 'drawPolygon', 'createCanvasGradient', 'mapBlendMode', 'mapBlendModeToPsd', 'parseColorToRgba', 'parseFilterString', 'drawImageWithFit',
    'CanvasRenderer', 'renderToCanvas', 'renderToBuffer',
    'PsdExporter', 'exportToPsd',
    'compileTOAD', 'createCli', 'program', 'startWatcher'
  ];

  for (const exp of requiredExports) {
    if (TOADExports[exp] === undefined) {
      throw new Error(`Export missing from index.ts: ${exp}`);
    }
    console.log(`  [PASS] Export '${exp}' is present and defined.`);
  }

  console.log('\n=== AUDIT CHECK 2: Real Build Pipeline Execution & Output Verification ===');
  const fixture = 'tests/fixtures/social_card.TOAD';
  const buildResult = await compileTOAD(fixture, {
    format: 'all',
    scale: 2,
    outDir: auditOut
  });

  if (!buildResult.success) throw new Error('Build failed');
  console.log(`  [PASS] compileTOAD succeeded in ${buildResult.durationMs}ms`);
  console.log(`  [INFO] Output files: ${buildResult.outputFiles.join(', ')}`);
  console.log(`  [INFO] Dependencies: ${buildResult.dependencies.join(', ')}`);

  // Verify PNG
  const pngFile = path.join(auditOut, 'social_card.png');
  if (!fs.existsSync(pngFile)) throw new Error('PNG file not created');
  const pngBuf = fs.readFileSync(pngFile);
  if (pngBuf[0] !== 0x89 || pngBuf[1] !== 0x50 || pngBuf[2] !== 0x4E || pngBuf[3] !== 0x47) {
    throw new Error('Invalid PNG header');
  }
  const pngW = pngBuf.readUInt32BE(16);
  const pngH = pngBuf.readUInt32BE(20);
  console.log(`  [PASS] PNG valid. Dimensions: ${pngW}x${pngH} (Expected: 2400x1260 at 2x)`);
  if (pngW !== 2400 || pngH !== 1260) throw new Error(`Unexpected PNG dimensions: ${pngW}x${pngH}`);

  // Verify JPG
  const jpgFile = path.join(auditOut, 'social_card.jpg');
  if (!fs.existsSync(jpgFile)) throw new Error('JPG file not created');
  const jpgBuf = fs.readFileSync(jpgFile);
  if (jpgBuf[0] !== 0xFF || jpgBuf[1] !== 0xD8 || jpgBuf[2] !== 0xFF) {
    throw new Error('Invalid JPG header');
  }
  console.log(`  [PASS] JPG valid. Size: ${jpgBuf.length} bytes`);

  // Verify PSD
  const psdFile = path.join(auditOut, 'social_card.psd');
  if (!fs.existsSync(psdFile)) throw new Error('PSD file not created');
  const psdBuf = fs.readFileSync(psdFile);
  if (psdBuf.subarray(0, 4).toString() !== '8BPS') {
    throw new Error('Invalid PSD header');
  }
  const parsedPsd = readPsd(psdBuf);
  console.log(`  [PASS] PSD valid. Dimensions: ${parsedPsd.width}x${parsedPsd.height}, children: ${parsedPsd.children?.length || 0}`);
  if (parsedPsd.width !== 2400 || parsedPsd.height !== 1260) {
    throw new Error(`Unexpected PSD dimensions: ${parsedPsd.width}x${parsedPsd.height}`);
  }

  console.log('\n=== AUDIT CHECK 3: CLI Subprocess Invocations ===');
  // 3a. Direct CLI invocation
  const cliOut = path.join(auditOut, 'cli_test');
  const { stdout: cliStdout } = await execAsync(`node ./dist/cli.js build "${fixture}" -o "${cliOut}" -f psd -s 1`);
  console.log(`  [CLI Output]: ${cliStdout.trim()}`);
  const cliPsd = path.join(cliOut, 'social_card.psd');
  if (!fs.existsSync(cliPsd)) throw new Error('CLI failed to write PSD output');
  const cliPsdParsed = readPsd(fs.readFileSync(cliPsd));
  console.log(`  [PASS] CLI generated 1x PSD: ${cliPsdParsed.width}x${cliPsdParsed.height}`);
  if (cliPsdParsed.width !== 1200 || cliPsdParsed.height !== 630) {
    throw new Error(`Unexpected CLI PSD dimensions: ${cliPsdParsed.width}x${cliPsdParsed.height}`);
  }

  // 3b. CLI error handling on invalid file
  try {
    await execAsync('node ./dist/cli.js build non_existent_dummy_123.TOAD');
    throw new Error('CLI should have exited with error for non-existent file');
  } catch (err) {
    if (err.code !== 1) throw new Error(`Expected exit code 1, got ${err.code}`);
    console.log(`  [PASS] CLI non-existent file error handled with exit code 1`);
  }

  console.log('\n=== AUDIT CHECK 4: Watch Mode Engine ===');
  const watchOut = path.join(auditOut, 'watch_test');
  const watcher = await startWatcher(fixture, { format: 'png', outDir: watchOut });
  const watchPng = path.join(watchOut, 'social_card.png');
  if (!fs.existsSync(watchPng)) throw new Error('Watch mode initial build failed to write file');
  console.log('  [PASS] Watch mode started, initial build succeeded');
  await watcher.close();
  console.log('  [PASS] Watch mode closed cleanly');

  console.log('\n=== AUDIT VERDICT: ALL FORENSIC CHECKS PASSED ===');
}

runAudit().catch(err => {
  console.error('[AUDIT FAILED]', err);
  process.exit(1);
});
