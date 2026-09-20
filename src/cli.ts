#!/usr/bin/env node

/**
 * src/cli.ts
 * Commander CLI entry point and watch mode engine for "toad".
 */

import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import chokidar, { FSWatcher } from 'chokidar';
import { compileToad, BuildOptions, BuildResult } from './build.js';
import { createPreviewServer, openBrowser, PreviewServerInstance } from './engine/previewServer.js';
import { resolveEntryFile, resolveAnyFile, getWorkspaces, addWorkspace, removeWorkspace, listAllToadFiles, getConfigPath, getConfig, setConfigValue, resetConfig, DEFAULT_CONFIG } from './utils/fileFinder.js';
import { auditDesign, formatTerminalReport, formatFixesSection, formatWarningsSection } from './tools/designAuditor.js';
import { copyToClipboard } from './utils/clipboard.js';
import { bundleAssets } from './tools/assetBundler.js';
import { formatRustDiagnostic, generateHelpSuggestion } from './tools/diagnostics.js';
import { compileMotion } from './motion/index.js';
import { updateToad, checkForUpdatesSummary } from './tools/updater.js';
import { removeBackground, isGpuAvailable, detectBestDevice } from './tools/backgroundRemover.js';
import {
  startStudioDaemon,
  stopStudioDaemon,
  getDaemonInfo,
  isStudioServerRunning,
  saveDaemonInfo,
  clearDaemonInfo
} from './engine/studioDaemon.js';


export interface CliOptions {
  scale?: string;
  vectorScale?: string;
  format?: string;
  out?: string;
  fonts?: string;
  watch?: boolean;
  quality?: string;
  dpi?: string;
  bleed?: string;
  port?: string;
  humanLayers?: boolean;
  textToPath?: boolean;
}

const isColorEnabled = () => !process.env.NO_COLOR && (process.stdout?.isTTY || process.env.FORCE_COLOR !== '0');

export const c = {
  reset: (s: string) => isColorEnabled() ? `\x1b[0m${s}\x1b[0m` : s,
  bold: (s: string) => isColorEnabled() ? `\x1b[1m${s}\x1b[22m` : s,
  dim: (s: string) => isColorEnabled() ? `\x1b[2m${s}\x1b[22m` : s,
  red: (s: string) => isColorEnabled() ? `\x1b[31m${s}\x1b[39m` : s,
  green: (s: string) => isColorEnabled() ? `\x1b[32m${s}\x1b[39m` : s,
  yellow: (s: string) => isColorEnabled() ? `\x1b[33m${s}\x1b[39m` : s,
  cyan: (s: string) => isColorEnabled() ? `\x1b[36m${s}\x1b[39m` : s,
  white: (s: string) => isColorEnabled() ? `\x1b[37m${s}\x1b[39m` : s,
  bgRed: (s: string) => isColorEnabled() ? `\x1b[41m\x1b[37m\x1b[1m${s}\x1b[0m` : s,
  bgGreen: (s: string) => isColorEnabled() ? `\x1b[42m\x1b[30m\x1b[1m${s}\x1b[0m` : s,
  bgYellow: (s: string) => isColorEnabled() ? `\x1b[43m\x1b[30m\x1b[1m${s}\x1b[0m` : s,
};

/**
 * Formats a compiler error with location, pointer, and actionable help suggestions in Clang/Rust style.
 */
export function formatCompilerError(err: any, entryPath?: string): string {
  const file = (err.loc && err.loc.file) ? err.loc.file : (entryPath || 'inline.toad');
  const line = (err.loc && err.loc.start) ? err.loc.start.line : 1;
  const col = (err.loc && err.loc.start) ? err.loc.start.column : 1;
  const message = err.message || String(err);

  let sourceText = '';
  try {
    if (file && fs.existsSync(file)) {
      sourceText = fs.readFileSync(file, 'utf-8');
    }
  } catch {}

  return formatRustDiagnostic({
    file,
    line,
    col,
    message,
    code: err.code,
    sourceText,
    help: err.help
  });
}

/**
 * Runs watch mode using chokidar to monitor entry and transitive dependencies.
 * Automatically serves a live preview with WebSocket/SSE hot reloading in browser.
 */
export async function startWatcher(
  entryPath: string,
  buildOptions: BuildOptions
): Promise<FSWatcher> {
  const resolvedEntry = path.resolve(entryPath);
  const watchedFiles = new Set<string>([resolvedEntry]);

  let isBuilding = false;
  let hasPendingChange = false;
  let buildPromise: Promise<BuildResult | null> | null = null;
  let previewServer: PreviewServerInstance | null = null;

  const triggerBuild = async (): Promise<BuildResult | null> => {
    if (isBuilding) {
      hasPendingChange = true;
      return buildPromise;
    }

    isBuilding = true;
    buildPromise = (async () => {
      let lastResult: BuildResult | null = null;
      try {
        while (true) {
          hasPendingChange = false;
          try {
            console.log(`[toad] Compiling ${path.basename(resolvedEntry)}...`);
            const result = await compileToad(resolvedEntry, buildOptions);
            lastResult = result;

            console.log(`[toad] Build succeeded in ${result.durationMs}ms`);
            const maxNameLen = Math.max(20, ...result.outputFiles.map(f => path.basename(f).length));
            for (const f of result.outputFiles) {
              let sizeStr = '';
              try {
                const stat = fs.statSync(f);
                const sizeKb = (stat.size / 1024).toFixed(1);
                sizeStr = stat.size > 1024 * 1024 ? `${(stat.size / 1024 / 1024).toFixed(2)} MB` : `${sizeKb} KB`;
              } catch { }
              
              let dimStr = '';
              if (f.endsWith('.psd') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp')) {
                 dimStr = `(${result.canvas.width}x${result.canvas.height})`;
              }
              
              console.log(`  -> ${path.basename(f).padEnd(maxNameLen)} ${sizeStr.padStart(8)}  ${dimStr}`);
            }

            if (result.warnings.length > 0) {
              for (const w of result.warnings) {
                console.warn(`  [warning] ${w}`);
              }
            }

            // Update watched dependencies
            const newDeps = new Set(result.dependencies.map(d => path.resolve(d)));
            newDeps.add(resolvedEntry);

            for (const dep of newDeps) {
              if (!watchedFiles.has(dep)) {
                watcher.add(dep);
                watchedFiles.add(dep);
              }
            }

            for (const watched of watchedFiles) {
              if (!newDeps.has(watched) && watched !== resolvedEntry) {
                watcher.unwatch(watched);
                watchedFiles.delete(watched);
              }
            }

            // Broadcast update to live preview browser
            if (previewServer) {
              previewServer.broadcastUpdate(result);
            }
          } catch (err: any) {
            const formatted = formatCompilerError(err, resolvedEntry);
            console.error(formatted);
            if (previewServer) {
              previewServer.broadcastError(formatted);
            }
            lastResult = null;
          }

          if (!hasPendingChange) {
            break;
          }
        }
      } finally {
        isBuilding = false;
        buildPromise = null;
      }
      return lastResult;
    })();

    return buildPromise;
  };

  const watcher = chokidar.watch(Array.from(watchedFiles), {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  });

  let debounceTimer: NodeJS.Timeout | null = null;
  watcher.on('all', (event, changedPath) => {
    console.log(`[toad] File ${event}: ${path.basename(changedPath)}`);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      triggerBuild();
    }, 50);
  });
  watcher.on('error', (err) => {
    console.error(`[toad] Watcher error: ${err instanceof Error ? err.message : String(err)}`);
  });

  // Initial build
  const initialResult = await triggerBuild();

  // Initialize live preview web server
  try {
    const preferredPort = (buildOptions as any).port;
    previewServer = await createPreviewServer(initialResult, resolvedEntry,
      typeof preferredPort === 'number' && preferredPort > 0 ? preferredPort : undefined);
    const folderPath = path.dirname(path.resolve(resolvedEntry));
    const normalizedFolder = folderPath.replace(/\\/g, '/');
    const folderUrl = `file:///${normalizedFolder}`;
    const clickableFolder = `\u001b]8;;${folderUrl}\u001b\\${folderPath}\u001b]8;;\u001b\\`;

    console.log(`\n  ${c.green('➜')}  ${c.bold('Local Preview:')}   ${c.cyan(previewServer.url)}`);
    console.log(`  ${c.dim('➜')}  ${c.dim('Live Reload:')}     ${c.green('Active (SSE)')}`);
    console.log(`  ${c.dim('➜')}  ${c.dim('File Folder:')}     ${c.cyan(clickableFolder)}\n`);
    openBrowser(previewServer.url);
  } catch {}

  console.log(`[toad] Watching for changes in ${watchedFiles.size} file(s)... (Press Ctrl+C to stop)`);

  const originalClose = watcher.close.bind(watcher);
  watcher.close = async () => {
    process.removeListener('SIGINT', cleanup);
    process.removeListener('SIGTERM', cleanup);
    if (previewServer) {
      await previewServer.close();
    }
    return originalClose();
  };

  const cleanup = async () => {
    await watcher.close();
    process.exit(0);
  };

  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);

  return watcher;
}

/**
 * Creates and configures the Commander program instance.
 */
export function createCli(): Command {
  const program = new Command();

  program
    .name('toad')
    .description('Standalone compiler, layout solver, raster renderer & PSD exporter for the toad design language')
    .version('1.0.0');

  // Command: build [entry]
  const handleBuild = async (entry: string | undefined, opts: CliOptions) => {
    const resolvedPath = await resolveEntryFile(entry);
    if (!resolvedPath) {
      process.exit(1);
    }
    entry = resolvedPath;

    const scaleNum = opts.scale ? parseFloat(opts.scale) : undefined;
    const vectorScaleNum = opts.vectorScale ? parseFloat(opts.vectorScale) : undefined;
    const qualityNum = opts.quality ? parseFloat(opts.quality) : undefined;
    const dpiNum = opts.dpi ? parseFloat(opts.dpi) : undefined;
    const formatVal = Array.isArray(opts.format) ? opts.format.join(',') : (opts.format ? String(opts.format) : undefined);

    const buildOptions: BuildOptions = {
      scale: scaleNum !== undefined ? (isNaN(scaleNum) || scaleNum <= 0 ? 1 : scaleNum) : undefined,
      vectorScale: vectorScaleNum !== undefined ? (isNaN(vectorScaleNum) || vectorScaleNum <= 0 ? 2.5 : vectorScaleNum) : undefined,
      format: formatVal,
      outDir: opts.out,
      fontsDir: opts.fonts,
      watch: opts.watch,
      quality: qualityNum,
      dpi: dpiNum,
      bleed: opts.bleed,
      humanizeLayerNames: opts.humanLayers !== false,
      textToPath: opts.textToPath
    };

    const formatOutput = (result: BuildResult) => {
      console.log(`\n${c.bgGreen(' SUCCESS ')} ${c.bold(c.green(`Build completed in ${result.durationMs}ms`))}`);
      const maxBaseLen = Math.max(24, ...result.outputFiles.map(f => path.basename(f).length));
      for (const f of result.outputFiles) {
        let sizeStr = '';
        try {
          const stat = fs.statSync(f);
          const sizeKb = (stat.size / 1024).toFixed(1);
          sizeStr = stat.size > 1024 * 1024 ? `${(stat.size / 1024 / 1024).toFixed(2)} MB` : `${sizeKb} KB`;
        } catch { }
        
        let dimStr = '';
        if (f.endsWith('.psd')) {
          const effectiveScale = buildOptions.vectorScale && buildOptions.vectorScale > 0 ? buildOptions.vectorScale : 2.5;
          dimStr = c.dim(`(${Math.round(result.canvas.width * effectiveScale)}x${Math.round(result.canvas.height * effectiveScale)})`);
        } else if (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp')) {
          const effectiveScale = buildOptions.scale && buildOptions.scale > 0 ? buildOptions.scale : 1;
          dimStr = c.dim(`(${Math.round(result.canvas.width * effectiveScale)}x${Math.round(result.canvas.height * effectiveScale)})`);
        } else if (f.endsWith('.svg')) {
          dimStr = c.dim(`(${Math.round(result.canvas.width)}x${Math.round(result.canvas.height)} px)`);
        } else if (f.endsWith('.pdf')) {
          dimStr = c.dim(`(${Math.round(result.canvas.width)}x${Math.round(result.canvas.height)} pt)`);
        }
        
        console.log(`  ${c.cyan('➜')} ${c.bold(path.basename(f)).padEnd(maxBaseLen)} ${c.yellow(sizeStr.padStart(8))}  ${dimStr}`);
      }
      if (result.warnings.length > 0) {
        console.log('');
        for (const w of result.warnings) {
          console.warn(`  ${c.yellow('⚠')} ${c.yellow(`[warning] ${w}`)}`);
        }
      }
      console.log('');
    };

    try {
      if (opts.watch) {
        await startWatcher(entry, buildOptions);
      } else {
        const result = await compileToad(entry, buildOptions);
        formatOutput(result);
      }
    } catch (err: any) {
      if (err && err.isDiagnostic) {
        console.error(err.message);
        process.exit(1);
      } else {
        console.error(formatCompilerError(err, entry));
        process.exit(1);
      }
    }
  };

  program
    .command('build [entry]', { isDefault: true })
    .description('Compile a .toad file into raster images (PNG, JPG, WebP), vector graphics (SVG), layered Photoshop document (PSD), or print-ready PDF')
    .option('-s, --scale <number>', 'Scale factor multiplier for raster rendering (e.g. 1, 2, 4)')
    .option('--vector-scale <number>', 'Scale factor for vector/PSD exports (default: 2.5)')
    .option('-f, --format <formats...>', 'Output format(s): png | jpg | webp | psd | svg | pdf | image | all (comma or space separated)')
    .option('-o, --out <dir>', 'Output directory (defaults to entry directory)')
    .option('--fonts <dir>', 'Directory containing custom font files to register')
    .option('-w, --watch', 'Watch entry file and all transitive imports for changes (Press Ctrl+C to stop)')
    .option('-q, --quality <number>', 'JPEG/WebP compression quality (1-100 or 0.0-1.0, default: 92)')
    .option('--dpi <number>', 'Target output resolution in DPI (e.g. 300, 150, 96)')
    .option('--bleed <dimension>', 'Print bleed margin override (e.g. 3mm, 0.125in, 10px)')
    .option('-t, --text-to-path', 'Convert text elements to vector path outlines in SVG export')
    .option('--no-human-layers', 'Disable semantic human layer naming in PSD and SVG')
    .action(handleBuild);

  program
    .command('dev [entry]')
    .description('Start live preview server with hot reload and watch mode on local port (default: 3000, Press Ctrl+C to stop)')
    .option('-s, --scale <number>', 'Scale factor multiplier for raster rendering (e.g. 1, 2, 4)')
    .option('--vector-scale <number>', 'Scale factor for vector/PSD exports (default: 2.5)')
    .option('-f, --format <formats...>', 'Output format(s): png | jpg | webp | psd | svg | pdf | image | all (comma or space separated)')
    .option('-o, --out <dir>', 'Output directory (defaults to entry directory)')
    .option('--fonts <dir>', 'Directory containing custom font files to register')
    .option('-q, --quality <number>', 'JPEG/WebP compression quality (1-100 or 0.0-1.0, default: 92)')
    .option('--dpi <number>', 'Target output resolution in DPI (e.g. 300, 150, 96)')
    .option('--bleed <dimension>', 'Print bleed margin override (e.g. 3mm, 0.125in, 10px)')
    .option('-t, --text-to-path', 'Convert text elements to vector path outlines in SVG export')
    .option('--no-human-layers', 'Disable semantic human layer naming in PSD and SVG')
    .option('-p, --port <number>', 'Port for the live preview server (default: 3000)')
    .action(async (entry, opts) => {
      const portNum = opts.port ? parseInt(opts.port, 10) : undefined;
      await handleBuild(entry, { ...opts, watch: true, port: portNum });
    });

  program
    .command('init [name]')
    .description('Scaffold a new toad project. Auto-generates a name if omitted.')
    .action(async (name) => {
      try {
        const m = await import('./scaffold.js');
        m.runInit(name);
      } catch (err) {
        console.error('\x1b[31mError scaffolding project:\x1b[0m', err);
        process.exit(1);
      }
    });

  program
    .command('format <file>')
    .alias('fmt')
    .description('Format a .toad file with standard indentation and spacing.')
    .option('-c, --check', 'Check if file is formatted without writing changes')
    .action(async (file, opts) => {
      try {
        const { formatToad } = await import('./tools/formatter.js');
        
        let filePath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
          // Accept document names as well as paths (parity with build/lint).
          const found = await resolveEntryFile(file);
          if (found) filePath = found;
        }
        if (!fs.existsSync(filePath)) {
          console.error(`\x1b[31mError: File not found: ${filePath}\x1b[0m`);
          process.exit(1);
        }
        
        const source = fs.readFileSync(filePath, 'utf-8');
        const formatted = formatToad(source);
        
        if (opts.check) {
          if (source !== formatted) {
            console.error(`\x1b[31m${file} is not properly formatted.\x1b[0m`);
            process.exit(1);
          } else {
            console.log(`\x1b[32m✔ ${file} is properly formatted.\x1b[0m`);
          }
          return;
        }

        if (source !== formatted) {
          fs.writeFileSync(filePath, formatted, 'utf-8');
          console.log(`\x1b[32mFormatted ${file}\x1b[0m`);
        } else {
          console.log(`\x1b[32m${file} is already formatted.\x1b[0m`);
        }
      } catch (err: any) {
        console.error(`\x1b[31mError formatting file:\x1b[0m ${err.message}`);
        process.exit(1);
      }
    });

  program
    .command('convert <file>')
    .alias('import')
    .alias('psd2toad')
    .description('Universal converter: Convert PSD to TOAD DSL, or convert, resize & compress any image into any format.')
    .option('-o, --out <path>', 'Output file path or directory')
    .option('-f, --format <fmt>', 'Target image format: png, jpg, webp, avif, svg, pdf, ico, gif')
    .option('-q, --quality <number>', 'Image quality 1-100 (default: 85)')
    .option('-s, --scale <number>', 'Scale factor multiplier (e.g. 0.5, 2, 4)')
    .option('--width <px>', 'Explicit target width in pixels')
    .option('--height <px>', 'Explicit target height in pixels')
    .option('-c, --compress', 'Activate smart web compression preset')
    .option('--filter <type>', 'Resampling filter: high (bicubic), medium, nearest (pixel art)', 'high')
    .option('--assets <dir>', 'Directory for extracted raster image assets (PSD mode, default: ./assets)')
    .option('--no-extract-images', 'Do not extract raster image layers as PNG files (PSD mode)')
    .option('--include-hidden', 'Include hidden Photoshop layers (PSD mode)')
    .option('--no-format-code', 'Do not format generated TOAD code (PSD mode)')
    .option('--no-fmt', 'Alias for --no-format-code')
    .option('--dpi <number>', 'Resolution in DPI for font size and unit conversion (default: 72)')
    .action(async (file, opts) => {
      const startTime = Date.now();
      try {
        let resolvedPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(resolvedPath)) {
          const found = await resolveAnyFile(file, {
            extensions: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.psd', '.pdf', '.ico', '.bmp', '.tiff'],
            description: 'image or PSD file'
          });
          if (!found) {
            process.exit(1);
          }
          resolvedPath = found;
        }

        const ext = path.extname(resolvedPath).toLowerCase();
        const isPsd = ext === '.psd';
        const targetFormat = typeof opts.format === 'string' ? opts.format.toLowerCase() : undefined;

        // If it's a PSD and NO image format flag is given, run PSD to TOAD DSL import
        if (isPsd && !targetFormat) {
          const { importPsd } = await import('./importers/psdImporter.js');
          console.log(`\n  ${c.cyan('➜')}  Importing PSD: ${c.bold(path.basename(resolvedPath))}...`);

          const shouldFormat = opts.formatCode !== false && (opts as any).fmt !== false;
          const result = await importPsd(resolvedPath, {
            outPath: opts.out,
            assetsDir: opts.assets,
            extractImages: opts.extractImages,
            includeHidden: opts.includeHidden,
            formatCode: shouldFormat,
            dpi: opts.dpi ? parseFloat(opts.dpi) : undefined
          });

          const duration = Date.now() - startTime;
          console.log(`\n${c.bgGreen(' SUCCESS ')} ${c.bold(c.green(`PSD imported in ${duration}ms`))}\n`);

          if (result.outputFile) {
            console.log(`  ${c.cyan('➜')} ${c.bold('Output:')}   ${c.green(result.outputFile)}`);
          }
          console.log(`  ${c.dim('➜')} ${c.dim('Layers:')}   ${result.stats.layersCount} total (${result.stats.textCount} text, ${result.stats.vectorCount} vector, ${result.stats.imageCount} image, ${result.stats.groupCount} group)`);

          if (result.assets.length > 0) {
            console.log(`  ${c.dim('➜')} ${c.dim('Assets:')}   Extracted ${result.assets.length} image asset(s) to ${opts.assets || './assets'}`);
          }

          if (result.warnings.length > 0) {
            console.log('');
            for (const w of result.warnings) {
              console.warn(`  ${c.yellow('⚠')} ${c.yellow(`[warning] ${w}`)}`);
            }
          }
          console.log('');
          return;
        }

        // Image Conversion, Scaling & Compression mode!
        console.log(`\n  ${c.cyan('➜')}  Converting Image: ${c.bold(path.basename(resolvedPath))}...`);
        const { convertImage } = await import('./tools/imageConverter.js');
        const finalFormat = (targetFormat || (opts.compress ? 'webp' : 'png')).toLowerCase();

        const result = await convertImage(resolvedPath, {
          format: finalFormat as any,
          quality: opts.quality ? parseInt(opts.quality, 10) : undefined,
          scale: opts.scale ? parseFloat(opts.scale) : undefined,
          width: opts.width ? parseInt(opts.width, 10) : undefined,
          height: opts.height ? parseInt(opts.height, 10) : undefined,
          filter: opts.filter as any,
          compress: Boolean(opts.compress)
        });

        // Determine destination file path
        let outPath = opts.out;
        if (!outPath) {
          const dir = path.dirname(resolvedPath);
          const base = path.basename(resolvedPath, ext);
          outPath = path.join(dir, `${base}.${result.format}`);
        } else {
          outPath = path.resolve(process.cwd(), outPath);
          if (fs.existsSync(outPath) && fs.statSync(outPath).isDirectory()) {
            const base = path.basename(resolvedPath, ext);
            outPath = path.join(outPath, `${base}.${result.format}`);
          }
        }

        fs.writeFileSync(outPath, result.buffer);
        const duration = Date.now() - startTime;

        console.log(`\n${c.bgGreen(' SUCCESS ')} ${c.bold(c.green(`Image converted in ${duration}ms`))}\n`);
        console.log(`  ${c.cyan('➜')} ${c.bold('Output:')}     ${c.green(outPath)}`);
        console.log(`  ${c.dim('➜')} ${c.dim('Format:')}     ${ext.replace('.', '').toUpperCase()} ➜ ${result.format.toUpperCase()}`);
        console.log(`  ${c.dim('➜')} ${c.dim('Dimensions:')} ${result.originalWidth}x${result.originalHeight} ➜ ${result.width}x${result.height} px`);
        const origKb = (result.originalBytes / 1024).toFixed(1);
        const outKb = (result.outputBytes / 1024).toFixed(1);
        const savingsTag = result.savingsPercent > 0 ? c.green(`(-${result.savingsPercent}% kleiner)`) : c.dim('(unverändert)');
        console.log(`  ${c.dim('➜')} ${c.dim('Size:')}       ${origKb} KB ➜ ${c.bold(outKb + ' KB')} ${savingsTag}\n`);
      } catch (err: any) {
        console.error(`\n${c.bgRed(' ERROR ')} ${c.bold(c.red(`Failed to convert image:`))} ${err.message || String(err)}\n`);
        process.exit(1);
      }
    });

  program
    .command('lint <file>')
    .description('Statically analyze a .toad file for errors and best practices.')
    .action(async (file) => {
      try {
        const { Parser } = await import('./parser/parser.js');
        const { lintDocument } = await import('./tools/linter.js');
        const { Lexer } = await import('./parser/lexer.js');
        
        let lintPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(lintPath)) {
          // Accept document names as well as paths.
          const found = await resolveEntryFile(file);
          if (!found) {
            console.error(`\x1b[31mError: File not found: ${lintPath}\x1b[0m`);
            process.exit(1);
          }
          lintPath = found;
        }
        
        const source = fs.readFileSync(lintPath, 'utf-8');
        const lexer = new Lexer(source, lintPath);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens, lintPath);
        
        try {
          const ast = parser.parse();
          const parseDiagnostics: any[] = (parser.diagnostics || []).map(d => ({
            code: 'PARSE-ERROR',
            message: d.message,
            severity: d.severity || 'error',
            loc: d.loc
          }));

          let docToLint = ast;
          const importDirectives = (ast.directives || []).filter(d => d.type === 'ImportDirective');
          if (importDirectives.length > 0) {
            const allVars = [...ast.variables];
            const seenImports = new Set<string>([lintPath]);
            // Each transitive import resolves relative to the directory of the
            // file that DECLARES it, not the entry file.
            const queue = importDirectives.map(d => ({
              rel: (d as any).path as string,
              baseDir: path.dirname(lintPath)
            }));

            while (queue.length > 0) {
              const { rel, baseDir } = queue.shift()!;
              const target = path.resolve(baseDir, rel);
              if (!seenImports.has(target) && fs.existsSync(target)) {
                seenImports.add(target);
                try {
                  const subSource = fs.readFileSync(target, 'utf-8');
                  const subTokens = new Lexer(subSource, target).tokenize();
                  const subAst = new Parser(subTokens, target).parse();
                  allVars.push(...subAst.variables);
                  for (const subDir of (subAst.directives || [])) {
                    if (subDir.type === 'ImportDirective') {
                      queue.push({ rel: (subDir as any).path, baseDir: path.dirname(target) });
                    }
                  }
                } catch {}
              }
            }
            docToLint = { ...ast, variables: allVars };
          }

          const diagnostics = [...parseDiagnostics, ...lintDocument(docToLint)];
          
          if (diagnostics.length === 0) {
            console.log(`\x1b[32m✔ No issues found in ${file}\x1b[0m`);
            return;
          }
          
          let errorCount = 0;
          let warningCount = 0;
          
          for (const d of diagnostics) {
            if (d.severity === 'error') {
              errorCount++;
              console.error(`\x1b[31mError\x1b[0m [${d.code}] ${d.message} at line ${d.loc.start.line}`);
            } else {
              warningCount++;
              console.warn(`\x1b[33mWarning\x1b[0m [${d.code}] ${d.message} at line ${d.loc.start.line}`);
            }
          }
          
          console.log(`\nFound ${errorCount} errors and ${warningCount} warnings.`);
          if (errorCount > 0) process.exit(1);
        } catch (err: any) {
          console.error(`\x1b[31mSyntax Error:\x1b[0m ${err.message}`);
          process.exit(1);
        }
      } catch (err: any) {
        console.error(`\x1b[31mError linting file:\x1b[0m ${err.message}`);
        process.exit(1);
      }
    });

  // Command: workspace [action] [path]
  program
    .command('workspace [action] [dir]')
    .alias('ws')
    .description('Manage preferred workspace directories searched with priority')
    .action((action?: string, dir?: string) => {
      const act = (action || 'list').toLowerCase();
      if (act === 'list' || act === 'ls') {
        const list = getWorkspaces();
        console.log(`\n${c.bold('TOAD Preferred Workspaces:')}`);
        if (list.length === 0) {
          console.log(`  ${c.dim('(No workspaces registered)')}`);
          console.log(`\n${c.dim('Tip:')} Add a folder using:`);
          console.log(`  ${c.cyan('toad workspace add <path>')}\n`);
        } else {
          list.forEach((w, i) => {
            console.log(`  ${c.green(`[${i + 1}]`)} ${w}`);
          });
          console.log('');
        }
        return;
      }

      if (act === 'add') {
        const targetDir = dir || process.cwd();
        const res = addWorkspace(targetDir);
        if (res.success) {
          console.log(`\n${c.green('✔')} ${res.message}\n`);
        } else {
          console.error(`\n${c.red('✖')} ${res.message}\n`);
          process.exit(1);
        }
        return;
      }

      if (act === 'remove' || act === 'rm') {
        if (!dir) {
          console.error(`\n${c.red('✖')} Please specify the directory to remove: toad workspace remove <path>\n`);
          process.exit(1);
        }
        const res = removeWorkspace(dir);
        if (res.success) {
          console.log(`\n${c.green('✔')} ${res.message}\n`);
        } else {
          console.error(`\n${c.red('✖')} ${res.message}\n`);
          process.exit(1);
        }
        return;
      }

      console.error(`\n${c.red('✖')} Unknown action "${action}". Allowed: list, add, remove\n`);
      process.exit(1);
    });

  // Command: config [action] [key] [value] (alias: settings)
  program
    .command('config [action] [key] [value]')
    .alias('settings')
    .description('View and modify persistent TOAD configuration (~/.toadrc.json)')
    .action((action?: string, keyArg?: string, valArg?: string) => {
      const act = (action || '').toLowerCase();

      // Case: toad config path
      if (act === 'path') {
        console.log(getConfigPath());
        return;
      }

      // Case: toad config reset
      if (act === 'reset') {
        resetConfig();
        console.log(`\n${c.green('✔')} TOAD configuration reset to defaults.`);
        console.log(`  Location: ${c.dim(getConfigPath())}\n`);
        return;
      }

      // Case: toad config set <key> <val>
      if (act === 'set') {
        if (!keyArg) {
          console.error(`\n${c.red('✖')} Please specify key and value: toad config set <key> <value>\n`);
          process.exit(1);
        }
        if (valArg === undefined) {
          console.error(`\n${c.red('✖')} Please specify a value for "${keyArg}": toad config set ${keyArg} <value>\n`);
          process.exit(1);
        }
        const res = setConfigValue(keyArg, valArg);
        if (res.success) {
          console.log(`\n${c.green('✔')} ${res.message}\n`);
        } else {
          console.error(`\n${c.red('✖')} ${res.message}\n`);
          process.exit(1);
        }
        return;
      }

      // Case: toad config get <key>
      if (act === 'get') {
        if (!keyArg) {
          console.error(`\n${c.red('✖')} Please specify the configuration key: toad config get <key>\n`);
          process.exit(1);
        }
        const cfg = getConfig();
        if (keyArg in cfg) {
          const val = cfg[keyArg];
          if (typeof val === 'object') {
            console.log(JSON.stringify(val, null, 2));
          } else {
            console.log(String(val));
          }
        } else {
          console.error(`\n${c.yellow('⚠')} Setting "${keyArg}" is not defined.\n`);
          process.exit(1);
        }
        return;
      }

      // Case: toad config <key> (direct shorthand get if key exists)
      const currentCfg = getConfig();
      if (action && action !== 'list' && action !== 'ls' && (action in currentCfg || action in DEFAULT_CONFIG)) {
        const val = currentCfg[action];
        if (typeof val === 'object') {
          console.log(JSON.stringify(val, null, 2));
        } else {
          console.log(String(val));
        }
        return;
      }

      // Default / list: display full configuration formatted
      console.log(`\n${c.bold('🐸 TOAD Configuration')} ${c.dim(`(${getConfigPath()})`)}`);
      console.log(`${c.dim('─'.repeat(54))}`);
      console.log(`  ${c.bold('General Settings:')}`);
      console.log(`  ${c.cyan('• defaultFormat       :')} ${c.yellow(String(currentCfg.defaultFormat || 'png'))}`);
      console.log(`  ${c.cyan('• defaultQuality      :')} ${c.yellow(String(currentCfg.defaultQuality ?? 90))}%`);
      console.log(`  ${c.cyan('• defaultScale        :')} ${c.yellow(String(currentCfg.defaultScale || 1))}x`);
      console.log(`  ${c.cyan('• defaultOutputDir    :')} ${c.yellow(String(currentCfg.defaultOutputDir || '(neben Quelldatei)'))}`);
      console.log(`  ${c.cyan('• outputNamingPattern :')} ${c.yellow(String(currentCfg.outputNamingPattern || '{name}{suffix}{scale}'))}`);
      console.log(`  ${c.cyan('• overwriteExisting   :')} ${c.yellow(String(currentCfg.overwriteExisting !== false))}`);
      console.log(`  ${c.cyan('• searchTimeoutMs     :')} ${c.yellow(String(currentCfg.searchTimeoutMs || 5000))} ms`);
      console.log(`  ${c.cyan('• searchIgnoreDirs    :')} ${c.yellow(JSON.stringify(currentCfg.searchIgnoreDirs || []))}`);
      console.log(`  ${c.cyan('• defaultFps          :')} ${c.yellow(String(currentCfg.defaultFps || 60))} fps`);
      console.log(`  ${c.cyan('• defaultMotionFormat :')} ${c.yellow(String(currentCfg.defaultMotionFormat || 'mp4'))}`);
      console.log(`  ${c.cyan('• aiDevice            :')} ${c.yellow(String(currentCfg.aiDevice || 'auto'))}`);
      console.log(`  ${c.cyan('• autoUpdate          :')} ${c.yellow(String(currentCfg.autoUpdate !== false))}`);
      console.log(`  ${c.cyan('• theme               :')} ${c.yellow(String(currentCfg.theme || 'dark'))}`);

      const knownKeys = [
        'workspaces', 'searchPaths', 'searchIgnoreDirs', 'searchTimeoutMs',
        'defaultOutputDir', 'outputNamingPattern', 'overwriteExisting',
        'defaultFps', 'defaultMotionFormat', 'defaultFormat', 'defaultQuality',
        'defaultScale', 'aiDevice', 'autoUpdate', 'theme'
      ];
      const extraKeys = Object.keys(currentCfg).filter(k => !knownKeys.includes(k));
      if (extraKeys.length > 0) {
        console.log(`\n  ${c.bold('Custom Settings:')}`);
        extraKeys.forEach(k => {
          console.log(`  ${c.cyan(`• ${k.padEnd(15)}:`)} ${c.yellow(JSON.stringify(currentCfg[k]))}`);
        });
      }

      const ws = currentCfg.workspaces || [];
      console.log(`\n  ${c.bold(`Preferred Workspaces (${ws.length}):`)}`);
      if (ws.length === 0) {
        console.log(`  ${c.dim('(No workspaces registered - add via: toad workspace add <path>)')}`);
      } else {
        ws.forEach((w: string, i: number) => {
          console.log(`  ${c.green(`[${i + 1}]`)} ${w}`);
        });
      }

      console.log(`\n${c.dim('Commands:')}`);
      console.log(`  ${c.dim('Get value :')} ${c.cyan('toad config get <key>')}  ${c.dim('(or toad settings get <key>)')}`);
      console.log(`  ${c.dim('Set value :')} ${c.cyan('toad config set <key> <value>')}`);
      console.log(`  ${c.dim('Reset     :')} ${c.cyan('toad config reset')}`);
      console.log(`  ${c.dim('Dashboard :')} ${c.cyan('toad')}${c.dim(' -> 6. Reiter "Einstellungen"')}\n`);
    });

  // Command: list
  program
    .command('list')
    .alias('ls')
    .description('Scan the computer and list all discovered .toad files')
    .action(async () => {
      console.log(`\n${c.bold('🔍 Scanning system for .toad files...')}\n`);
      const startTime = Date.now();
      const files = await listAllToadFiles();
      const durationMs = Date.now() - startTime;

      if (files.length === 0) {
        console.log(`  ${c.yellow('No .toad files found on system.')}\n`);
        return;
      }

      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.path.localeCompare(b.path));

      files.forEach((f, idx) => {
        let sizeStr = '';
        const sizeKb = (f.size / 1024).toFixed(1);
        sizeStr = f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(2)} MB` : `${sizeKb} KB`;

        const padNum = `[${idx + 1}]`.padEnd(String(files.length).length + 3);
        console.log(`  ${c.cyan(padNum)} ${c.bold(f.name.padEnd(30))} ${c.yellow(sizeStr.padStart(9))}   ${c.dim(f.path)}`);
      });

      console.log(`\n${c.green('✔')} Found ${c.bold(String(files.length))} .toad file(s) in ${durationMs}ms.\n`);
    });

  // Command: report [entry]
  program
    .command('report [entry]')
    .alias('audit')
    .description('Run deep design quality, WCAG 2.2 accessibility, and anti-slop audit')
    .option('--strict', 'Fail with exit code 1 on any warnings')
    .option('--min-score <score>', 'Minimum passing score out of 100', '70')
    .option('--json', 'Output raw machine-readable JSON report payload')
    .option('-v, --verbose', 'Show all passed heuristics in detail')
    .option('--slop-only', 'Focus exclusively on Anti-AI-Slop rule violations')
    .option('--fixes', 'Show detailed quick-fixes and action plan immediately')
    .action(async (entry?: string, options?: { strict?: boolean; minScore?: string; json?: boolean; verbose?: boolean; slopOnly?: boolean; fixes?: boolean }) => {
      try {
        const resolvedEntry = await resolveEntryFile(entry);
        if (!resolvedEntry) {
          process.exit(1);
        }
        const buildRes = await compileToad(resolvedEntry, { dryRun: true });
        const audit = auditDesign(buildRes);

        const hasIssues = audit.findings.filter(f => f.severity !== 'pass').length > 0;
        const isInteractive = !options?.fixes && !options?.json && process.stdin.isTTY && hasIssues;

        if (options?.json) {
          console.log(JSON.stringify(audit, null, 2));
        } else {
          const reportOutput = formatTerminalReport(audit, { 
            verbose: options?.verbose, 
            slopOnly: options?.slopOnly,
            showFixes: options?.fixes ? true : (isInteractive ? false : true)
          });
          console.log(`${c.bold('🔍 Deep Auditing toad design:')} ${c.cyan(resolvedEntry)}...\n`);
          console.log(reportOutput);

          if (isInteractive) {
            let accumulatedReport = reportOutput;

            const waitForUserInputKey = async (): Promise<string> => {
              return new Promise<string>(resolve => {
                const onData = (data: Buffer) => {
                  const str = data.toString();
                  process.stdin.removeListener('data', onData);
                  if (process.stdin.isTTY && process.stdin.setRawMode) {
                    process.stdin.setRawMode(false);
                  }
                  process.stdin.pause();
                  resolve(str);
                };

                if (process.stdin.isTTY && process.stdin.setRawMode) {
                  process.stdin.setRawMode(true);
                }
                process.stdin.resume();
                process.stdin.once('data', onData);
              });
            };

            const isQuit = (k: string) => k.toLowerCase().includes('q') || k === '\u0003' || k === '\u001b';
            const isEnter = (k: string) => k === '\r' || k === '\n';
            const isCopy = (k: string) => k.toLowerCase() === 'f';

            const penaltyIssues = audit.findings.filter(f => f.severity === 'error' || f.severity === 'warn');
            const hasPenalties = penaltyIssues.length > 0;

            const safeCopyToClipboard = async (text: string): Promise<boolean> => {
              try {
                return await copyToClipboard(text);
              } catch {
                return false;
              }
            };

            const runFixesStep = async () => {
              while (true) {
                const fixPrompt = hasPenalties
                  ? `\n  ${c.cyan('➜')}  ${c.bold('Press [Enter]')} to finish, or ${c.bold('[F]')} to copy report (or [Q] to quit)... `
                  : `\n  ${c.cyan('➜')}  ${c.bold('Press [Enter]')} to view notices & recommendations, or ${c.bold('[F]')} to copy report (or [Q] to quit)... `;
                process.stdout.write(fixPrompt);
                const key2 = await waitForUserInputKey();
                process.stdout.write('\n');

                if (isQuit(key2)) {
                  break;
                }
                if (isCopy(key2)) {
                  const copied = await safeCopyToClipboard(accumulatedReport);
                  if (copied) {
                    console.log(`  ${c.green('✔')} ${c.bold('Report copied to clipboard!')}`);
                  } else {
                    console.log(`  ${c.yellow('!')} ${c.dim('Could not copy to clipboard in this environment.')}`);
                  }
                  continue;
                }
                if (isEnter(key2)) {
                  const fixesSection = formatFixesSection(audit, { standalone: true });
                  console.log(fixesSection);
                  console.log('');
                  accumulatedReport += '\n' + fixesSection;

                  // Final prompt: Copy complete report or press Enter/Q to finish
                  process.stdout.write(`  ${c.cyan('➜')}  ${c.bold('Press [F]')} to copy entire report (or [Enter]/[Q] to quit)... `);
                  const key3 = await waitForUserInputKey();
                  process.stdout.write('\n');
                  if (isCopy(key3)) {
                    const copied = await safeCopyToClipboard(accumulatedReport);
                    if (copied) {
                      console.log(`  ${c.green('✔')} ${c.bold('Entire report copied to clipboard!')}\n`);
                    } else {
                      console.log(`  ${c.yellow('!')} ${c.dim('Could not copy to clipboard in this environment.')}\n`);
                    }
                  }
                  break;
                }
              }
            };

            if (hasPenalties) {
              // Step 1: Warnings / Justifications for scores < 100%
              while (true) {
                process.stdout.write(`\n  ${c.cyan('➜')}  ${c.bold('Press [Enter]')} to view justifications (< 100%), or ${c.bold('[F]')} to copy report (or [Q] to quit)... `);
                const key1 = await waitForUserInputKey();
                process.stdout.write('\n');

                if (isQuit(key1)) {
                  break;
                }
                if (isCopy(key1)) {
                  const copied = await safeCopyToClipboard(accumulatedReport);
                  if (copied) {
                    console.log(`  ${c.green('✔')} ${c.bold('Report copied to clipboard!')}`);
                  } else {
                    console.log(`  ${c.yellow('!')} ${c.dim('Could not copy to clipboard in this environment.')}`);
                  }
                  continue;
                }
                if (isEnter(key1)) {
                  const warningsSection = formatWarningsSection(audit, { standalone: true });
                  console.log(warningsSection);
                  accumulatedReport += '\n' + warningsSection;

                  await runFixesStep();
                  break;
                }
              }
            } else {
              // At 100%: No penalties present, directly offer Step 2
              await runFixesStep();
            }
          }
        }

        const minScore = parseInt(options?.minScore || '70', 10);
        if (audit.score < minScore) {
          if (!options?.json) {
            console.error(`${c.red('✖')} Design score ${audit.score}/100 is below the threshold of ${minScore}/100.\n`);
          }
          process.exit(1);
        }
        if (options?.strict && audit.stats.warnings > 0) {
          if (!options?.json) {
            console.error(`${c.red('✖')} Strict mode enabled: ${audit.stats.warnings} warning(s) detected.\n`);
          }
          process.exit(1);
        }
      } catch (err: any) {
        console.error(formatCompilerError(err, entry));
        process.exit(1);
      }
    });

  // Command: bundle [entry]
  program
    .command('bundle [entry]')
    .description('Bundle design into multi-resolution icons, favicons, or social share packages')
    .option('-p, --preset <preset>', 'Bundle preset: favicons, app-icon, social, all', 'favicons')
    .option('-o, --out <dir>', 'Output directory for the generated assets')
    .option('-t, --target <id>', 'Target element ID to isolate and bundle (e.g. "#logo" or "appIcon")')
    .option('--name <name>', 'Application name for site.webmanifest')
    .option('--theme <color>', 'Theme color hex for site.webmanifest')
    .option('--no-manifest', 'Skip generating site.webmanifest and HTML tag snippets')
    .action(async (entry?: string, options?: any) => {
      try {
        const resolvedEntry = await resolveEntryFile(entry);
        if (!resolvedEntry) {
          process.exit(1);
        }
        console.log(`${c.bold('📦 Bundling assets for:')} ${c.cyan(resolvedEntry)}`);
        console.log(`${c.dim('   Preset:')} ${c.yellow(options.preset || 'favicons')}`);
        if (options.target) console.log(`${c.dim('   Target:')} ${c.cyan(options.target)}`);

        const res = await bundleAssets(resolvedEntry, {
          preset: options.preset,
          outDir: options.out,
          target: options.target,
          name: options.name,
          themeColor: options.theme,
          manifest: options.manifest !== false
        });

        console.log(`\n${c.green('✔')} Successfully generated ${c.bold(String(res.assets.length))} asset(s) in: ${c.cyan(res.outDir)}\n`);
        for (const a of res.assets) {
          const kb = (a.bytes / 1024).toFixed(1);
          console.log(`   ${c.dim('•')} ${a.filename.padEnd(28)} ${c.bold(`${a.width}×${a.height}`.padEnd(12))} ${c.dim(`${kb} kB`)}`);
        }
        if (res.manifestPath) {
          console.log(`\n   ${c.green('✔')} Web App Manifest: ${c.dim(res.manifestPath)}`);
        }
        if (res.htmlSnippetPath) {
          console.log(`   ${c.green('✔')} HTML Embed Tags:   ${c.dim(res.htmlSnippetPath)}\n`);
        }
      } catch (err: any) {
        console.error(formatCompilerError(err, entry));
        process.exit(1);
      }
    });

  // Command: motion <file>
  program
    .command('motion <file>')
    .description('[Beta] Compile and render a TOAD Motion animation (.toadm) to video, GIF, or frames (Early Preview).')
    .option('-o, --out <path>', 'Output video, GIF, or frames path')
    .option('-f, --format <format>', 'Export format: mp4, webm, gif, frames')
    .option('--fps <fps>', 'Frames per second override (e.g. 30 or 60)')
    .option('--ffmpeg-path <path>', 'Path to custom FFmpeg binary')
    .action(async (file: string, options: any) => {
      try {
        let resolvedPath = path.resolve(file);
        if (!fs.existsSync(resolvedPath)) {
          const found = await resolveAnyFile(file, {
            extensions: ['.toadm', '.toad'],
            description: 'motion file (.toadm)'
          });
          if (!found) {
            process.exit(1);
          }
          resolvedPath = found;
        }

        const cfg = getConfig();
        const effectiveFps = options.fps ? parseInt(options.fps, 10) : (cfg.defaultFps || 60);
        const effectiveFormat = (options.format || cfg.defaultMotionFormat || 'mp4') as any;

        console.log(`${c.bold('🎬 Rendering TOAD Motion:')} ${c.cyan(resolvedPath)}`);
        const fps = effectiveFps;

        let lastPercent = -1;
        const outResult = await compileMotion(resolvedPath, {
          outputPath: options.out,
          format: effectiveFormat,
          fps,
          ffmpegPath: options.ffmpegPath,
          onProgress: (frame: number, total: number) => {
            const percent = Math.floor((frame / total) * 100);
            if (percent !== lastPercent && percent % 10 === 0) {
              lastPercent = percent;
              process.stdout.write(`   ${c.dim('•')} Rendering: ${c.yellow(String(percent) + '%')} (${frame}/${total} frames)\r`);
            }
          }
        });

        console.log(`\n${c.green('✔')} Motion export finished successfully: ${c.bold(c.cyan(outResult))}\n`);
      } catch (err: any) {
        console.error(`\n${c.red('✖')} Motion compilation error: ${err.message || String(err)}\n`);
        process.exit(1);
      }
    });

  // Command: update / upgrade
  program
    .command('update')
    .alias('upgrade')
    .description('Update TOAD to the latest version directly from GitHub')
    .option('-c, --check', 'Check for updates without installing')
    .option('-f, --force', 'Force update even if local changes exist or already on latest')
    .action(async (options: any) => {
      try {
        await updateToad({
          checkOnly: options.check,
          force: options.force
        });
      } catch (err: any) {
        console.error(`\n${c.red('✖')} Update failed: ${err.message || String(err)}\n`);
        process.exit(1);
      }
    });

  // Command: remove-bg <source> <target>
  program
    .command('remove-bg <source> <target>')
    .alias('rembg')
    .option('--dyb', 'Do-Your-Best preset: multi-model neural ensemble + native Guided Filtering for peak visual detail')
    .option('--fast', 'Speed preset: use lightweight fast model (BiRefNet Lite, MIT License)')
    .option('--quick', 'Speed preset: alias for --fast (BiRefNet Lite, MIT License)')
    .option('-f, --format <format>', 'Output format: png or webp', 'png')
    .option('-r, --recursive', 'Recursively search subdirectories when source is a folder')
    .action(async (source: string, target: string, options: any) => {
      const abortController = new AbortController();
      let winRl: any = null;

      const terminateNow = () => {
        try {
          process.stdout.write(`\n\n  ${c.yellow('⚠ Vorgang durch Benutzer mit Strg+C abgebrochen. Beende sofort...')}\n\n`);
        } catch {}
        try {
          winRl?.close();
        } catch {}
        try {
          abortController.abort();
        } catch {}
        process.exit(130);
      };

      process.once('SIGINT', terminateNow);
      process.once('SIGBREAK', terminateNow);

      if (process.platform === 'win32' && process.stdin.isTTY) {
        try {
          const readline = await import('node:readline');
          winRl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          winRl.on('SIGINT', terminateNow);
        } catch {}
      }

      try {
        let resolvedSource = path.resolve(source);
        if (!fs.existsSync(resolvedSource)) {
          const found = await resolveAnyFile(source, {
            extensions: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.bmp', '.tiff'],
            description: 'image file'
          });
          if (!found) {
            process.exit(1);
          }
          resolvedSource = found;
        }

        const isDirectory = fs.statSync(resolvedSource).isDirectory();
        const useFast = Boolean(options.fast || options.quick);
        const useDyb = Boolean(options.dyb);
        const selectedModel = useDyb ? 'dyb (ensemble + guided filter)' : (useFast ? 'fast (BiRefNet Lite)' : 'auto (BiRefNet)');
        const effectiveDevice = detectBestDevice(selectedModel);
        // In standard and dyb mode, process strictly 1 image at a time to maximize quality, stability, and RAM efficiency
        const autoConcurrency = useFast ? 4 : 1;

        console.log(`\n${c.bold('✂️   TOAD Local Background Remover')}`);
        console.log(`  ${c.green('🔒 [Local AI]')} ${c.dim('100% on-device processing. Zero parameters required.')}`);
        let modeTag = '';
        if (useDyb) modeTag = c.yellow(' [DYB: Multi-Model Ensemble + Native Guided Filter]');
        else if (useFast) modeTag = c.cyan(' [Fast / Quick Mode: BiRefNet Lite 4x Fast-Path]');
        console.log(`  ${c.dim('Model:')}    ${c.cyan('AI-Model')}${modeTag}`);
        if (effectiveDevice === 'dml') {
          console.log(`  ${c.dim('Hardware:')} ${c.green('⚡ DirectML GPU Hardware Acceleration Active')}`);
        } else {
          console.log(`  ${c.dim('Hardware:')} ${c.green('⚡ Multi-Threaded CPU Tensor Engine (AVX2/NEON, Memory-Safe)')}`);
        }
        console.log(`  ${c.dim('Features:')} ${c.dim('Original Canvas Preservation, Bilateral Matting, Clean Metadata')}`);
        console.log(`  ${c.dim('Source:')}   ${c.white(resolvedSource)}`);
        console.log(`  ${c.dim('Target:')}   ${c.cyan(path.resolve(target))}\n`);

        function renderProgressBar(current: number, total: number, width = 20): string {
          const pct = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
          const filled = Math.round(pct * width);
          const empty = width - filled;
          const bar = '█'.repeat(filled) + '░'.repeat(empty);
          return `[${c.green(bar)}] ${(pct * 100).toFixed(0).padStart(3)}%`;
        }

        let aiModelReportedDone = false;
        const onDownloadProgress = (p: any) => {
          if (p.status === 'progress') {
            const pct = typeof p.progress === 'number' ? Math.round(p.progress) : 0;
            const bar = renderProgressBar(pct, 100, 20);
            let sizeInfo = '';
            if (p.loaded && p.total) {
              const gbLoaded = (p.loaded / 1024 / 1024 / 1024).toFixed(2);
              const gbTotal = (p.total / 1024 / 1024 / 1024).toFixed(2);
              sizeInfo = ` (${gbLoaded}/${gbTotal} GB)`;
            }
            process.stdout.write(`\r  📥 Initializing AI-Model: ${bar}${sizeInfo}   `);
          } else if (p.status === 'done') {
            if (!aiModelReportedDone) {
              aiModelReportedDone = true;
              process.stdout.write(`\r  ✔ AI-Model ready (100% on-device)                                    \n`);
            }
          }
        };

        if (!isDirectory) {
          console.log(`  ⏳ Processing ${c.cyan(path.basename(resolvedSource))} (Neural Segmentation & Matting)...`);
        }

        const result = await removeBackground(resolvedSource, target, {
          dyb: useDyb,
          fast: useFast,
          quick: useFast,
          format: options.format,
          trim: false,
          concurrency: autoConcurrency,
          device: effectiveDevice,
          recursive: options.recursive,
          signal: abortController.signal,
          onDownloadProgress,
          onProgress: (info: any) => {
            const bar = renderProgressBar(info.index, info.total, 20);
            const baseName = path.basename(info.sourceFile);
            if (info.status === 'start') {
              process.stdout.write(`\r  ⏳ ${bar} [${info.index}/${info.total}] ${c.cyan(baseName)} (processing...)          `);
            } else if (info.status === 'success') {
              const sizeKb = (info.outputBytes / 1024).toFixed(1);
              const sizeStr = info.outputBytes > 1024 * 1024
                ? `${(info.outputBytes / 1024 / 1024).toFixed(2)} MB`
                : `${sizeKb} KB`;
              const dimStr = c.dim(`(${info.width}x${info.height})`);
              const durationStr = c.dim(`${info.durationMs}ms`);
              process.stdout.write(`\r  ✔ ${bar} [${info.index}/${info.total}] ${c.bold(baseName)} ${dimStr} ${c.yellow(sizeStr.padStart(8))} ${durationStr}          \n`);
            } else if (info.status === 'error') {
              process.stdout.write(`\r  ✖ ${bar} [${info.index}/${info.total}] ${c.red(baseName)}: ${info.error}          \n`);
            }
          }
        });

        if (isDirectory) {
          const batchRes = result as any;
          const sec = (batchRes.durationMs / 1000).toFixed(2);
          if (batchRes.total === 0) {
            console.log(`  ${c.yellow('⚠ No supported images (.png, .jpg, .jpeg, .webp) found in directory.')}\n`);
            return;
          }
          console.log(`\n${c.bgGreen(' SUCCESS ')} ${c.bold(c.green(`Processed ${batchRes.succeeded}/${batchRes.total} image(s) in ${sec}s`))}`);
          console.log(`  ${c.cyan('➜')} Output folder: ${c.bold(path.resolve(target))}\n`);
          if (batchRes.failed > 0) {
            console.log(`  ${c.yellow(`⚠ ${batchRes.failed} image(s) failed to process.`)}\n`);
          }
        } else {
          const singleRes = result as any;
          const sizeKb = (singleRes.outputBytes / 1024).toFixed(1);
          const sizeStr = singleRes.outputBytes > 1024 * 1024
            ? `${(singleRes.outputBytes / 1024 / 1024).toFixed(2)} MB`
            : `${sizeKb} KB`;
          console.log(`\n${c.bgGreen(' SUCCESS ')} ${c.bold(c.green(`Background removed in ${singleRes.durationMs}ms`))}`);
          console.log(`  ${c.cyan('➜')} ${c.bold(path.basename(singleRes.targetFile))} ${c.yellow(sizeStr)} ${c.dim(`(${singleRes.width}x${singleRes.height})`)}`);
          console.log(`  ${c.dim('Location:')} ${c.cyan(singleRes.targetFile)}\n`);
        }
      } catch (err: any) {
        if (abortController.signal.aborted) {
          process.exit(130);
        }
        console.error(`\n${c.bgRed(' ERROR ')} ${c.bold(c.red(`Failed to remove background:`))} ${err.message || String(err)}\n`);
        process.exit(1);
      } finally {
        try {
          winRl?.close();
        } catch {}
        process.removeListener('SIGINT', terminateNow);
        process.removeListener('SIGBREAK', terminateNow);
      }
    });

  // Command: stop
  program
    .command('stop')
    .description('Stop running background TOAD Studio Web-GUI server')
    .action(async () => {
      const res = await stopStudioDaemon();
      console.log(`\n  ${c.green('✔')} ${res.message}\n`);
    });

  // Command: studio / ui
  program
    .command('studio [actionOrEntry]')
    .alias('ui')
    .description('Launch TOAD Studio interactive Web-GUI (Graphic, Animation, BG-Remover, Convert, Audit)')
    .option('-p, --port <number>', 'Port for the studio server (default: 3000)')
    .option('-f, --foreground', 'Run in foreground (attached to current terminal)')
    .option('--no-browser', 'Do not open browser automatically')
    .option('--delay-browser', 'Delay browser launch by 6 seconds with progress bar while checking for updates')
    .action(async (actionOrEntry?: string, options?: any) => {
      const port = options?.port ? parseInt(options.port, 10) : 3000;

      // Handle subactions: 'stop' or 'status'
      if (actionOrEntry === 'stop') {
        const res = await stopStudioDaemon();
        console.log(`\n  ${c.green('✔')} ${res.message}\n`);
        return;
      }
      if (actionOrEntry === 'status') {
        const info = getDaemonInfo();
        const running = await isStudioServerRunning(info?.port || port);
        if (running) {
          console.log(`\n  ${c.green('●')} TOAD Studio läuft aktiv auf ${c.cyan(info?.url || `http://localhost:${port}/`)} (PID ${info?.pid || 'unbekannt'})\n`);
        } else {
          console.log(`\n  ${c.dim('○')} TOAD Studio ist aktuell nicht aktiv.\n`);
        }
        return;
      }

      const isForeground = Boolean(options?.foreground);
      const shouldDelayBrowser = Boolean(options?.delayBrowser);
      const openBrowserEnabled = options?.browser !== false;

      const handleBrowserOpening = async (targetUrl: string) => {
        if (!openBrowserEnabled) return;

        if (shouldDelayBrowser) {
          const TOTAL_DELAY_MS = 6000;
          const startCheck = Date.now();

          // 1. Animated Spinner for update search
          const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
          let frameIndex = 0;
          let checking = true;

          const spinnerInterval = setInterval(() => {
            if (!checking) return;
            const frame = c.cyan(spinnerFrames[frameIndex % spinnerFrames.length]!);
            frameIndex++;
            process.stdout.write(`\r  ${frame}  ${c.dim('Suche nach Updates...')}`);
          }, 80);

          let updateInfo;
          try {
            updateInfo = await checkForUpdatesSummary();
          } finally {
            checking = false;
            clearInterval(spinnerInterval);
            process.stdout.write('\r\x1b[K'); // clear line
          }

          if (updateInfo.hasUpdates) {
            console.log(`  ${c.yellow('⭐')}  ${c.bold(c.yellow(`${updateInfo.count} neue ${updateInfo.count === 1 ? 'Update verfügbar' : 'Updates verfügbar'}!`))} ${c.dim('(toad update)')}`);
          } else {
            console.log(`  ${c.green('✔')}  ${c.dim(updateInfo.message)}`);
          }

          // 2. Animated Progress Bar for the 6-second delay
          const elapsedSoFar = Date.now() - startCheck;
          const remainingDelay = Math.max(0, TOTAL_DELAY_MS - elapsedSoFar);

          if (remainingDelay > 0) {
            const barWidth = 24;
            const progressStart = Date.now();

            await new Promise<void>((resolve) => {
              const progressInterval = setInterval(() => {
                const pElapsed = Date.now() - progressStart;
                const percent = Math.min(1, pElapsed / remainingDelay);
                const filled = Math.round(barWidth * percent);
                const empty = barWidth - filled;
                const remainingSecs = Math.max(0, Math.ceil((remainingDelay - pElapsed) / 1000));

                const barStr = c.green('█'.repeat(filled)) + c.dim('░'.repeat(empty));
                process.stdout.write(`\r  ${c.dim('🚀')}  [${barStr}] ${c.dim(`${Math.round(percent * 100)}%`)} ${c.dim('• Browser öffnet in')} ${c.bold(c.cyan(`${remainingSecs}s`))}...`);

                if (percent >= 1) {
                  clearInterval(progressInterval);
                  process.stdout.write(`\r\x1b[K  ${c.green('✔')}  ${c.dim('Browser wird geöffnet...')}\n\n`);
                  resolve();
                }
              }, 60);
            });
          }
        }
        openBrowser(targetUrl);
      };

      if (isForeground) {
        let targetFile = actionOrEntry;
        if (!targetFile) {
          try {
            const files = fs.readdirSync(process.cwd()).filter(f => f.toLowerCase().endsWith('.toad'));
            if (files.length > 0) targetFile = path.resolve(files[0]!);
          } catch {}
        } else {
          targetFile = path.resolve(targetFile);
        }

        console.log(`\n  ${c.bold(c.green('🐸 TOAD Studio Web-GUI'))}`);
        console.log(`  ${c.dim('Interactive Visual Suite: Graphic, Animation, BG-Remover, Convert, Report/Audit')}`);

        try {
          let initialRes = null;
          if (targetFile && fs.existsSync(targetFile)) {
            try {
              initialRes = await compileToad(targetFile, { format: 'png' });
            } catch {}
          }
          const serverInstance = await createPreviewServer(
            initialRes,
            targetFile || 'studio.toad',
            port,
            undefined,
            true // studioMode = true
          );

          saveDaemonInfo({
            pid: process.pid,
            port: serverInstance.port,
            url: serverInstance.url,
            entryFile: targetFile,
            startTime: Date.now()
          });

          console.log(`  ${c.green('➜')}  ${c.bold('Studio URL:')}     ${c.cyan(serverInstance.url)}`);
          if (openBrowserEnabled) {
            console.log(`  ${c.dim('➜')}  ${c.dim('Browser:')}        ${c.green(shouldDelayBrowser ? 'Öffnet in 6 Sekunden...' : 'Opening automatically...')}`);
            await handleBrowserOpening(serverInstance.url);
          }

          const cleanup = () => {
            clearDaemonInfo();
            process.exit(0);
          };
          process.on('SIGINT', cleanup);
          process.on('SIGTERM', cleanup);
        } catch (err: any) {
          console.error(`${c.red('Error launching Studio:')}`, err.message || err);
          process.exit(1);
        }
      } else {
        // Run detached background daemon so user can close terminal!
        console.log(`\n  ${c.bold(c.green('🐸 TOAD Studio Web-GUI'))}`);
        console.log(`  ${c.dim('Interactive Visual Suite: Graphic, Animation, BG-Remover, Convert, Report/Audit')}`);

        try {
          const daemon = await startStudioDaemon(port, actionOrEntry);
          console.log(`  ${c.green('➜')}  ${c.bold('Studio URL:')}     ${c.cyan(daemon.url)}`);
          console.log(`  ${c.dim('➜')}  ${c.dim('Status:')}         ${c.green('Läuft als Hintergrund-Dienst (PID: ' + daemon.pid + ')')}`);
          console.log(`  ${c.dim('➜')}  ${c.dim('Terminal:')}       ${c.yellow('Dieses CMD-Fenster kann jetzt geschlossen werden.')}`);
          console.log(`  ${c.dim('➜')}  ${c.dim('Beenden:')}        ${c.dim('toad studio stop (oder direkt im Web-GUI)')}`);
          console.log(`  ${c.dim('➜')}  ${c.dim('Browser:')}        ${c.green(shouldDelayBrowser ? 'Öffnet in 6 Sekunden...' : 'Opening automatically...')}\n`);

          await handleBrowserOpening(daemon.url);
          process.exit(0);
        } catch (err: any) {
          console.error(`${c.red('Error starting background Studio:')}`, err.message || err);
          process.exit(1);
        }
      }
    });

  return program;
}


export const program = createCli();

/**
 * Strict auto-run detection: only execute the CLI when this module itself is
 * the entry script ("node dist/cli.js") or via the package bin shims
 * (toad / toad.js / cli.js). Library consumers whose launcher merely starts
 * with "cli" must not trigger Commander argument parsing on import.
 */
export function shouldAutoRun(argv1?: string): boolean {
  if (!argv1) return false;
  try {
    const currentFile = path.resolve(fileURLToPath(import.meta.url));
    const executedFile = path.resolve(argv1);
    if (currentFile === executedFile) return true;
    const base = path.basename(executedFile).toLowerCase();
    return base === 'toad' || base === 'toad.js' || base === 'cli.js' || base === 'cli.cjs' || base === 'cli.mjs';
  } catch {
    return false;
  }
}

if (shouldAutoRun(process.argv[1])) {
  const args = process.argv.slice(2);
  // If invoked with completely 0 arguments, launch TOAD Studio Web-GUI with update check & delay
  if (args.length === 0 && !process.env.VITEST && !process.env.CI) {
    program.parse([process.argv[0]!, process.argv[1]!, 'studio', '--delay-browser']);
  } else {
    program.parse(process.argv);
  }
}

