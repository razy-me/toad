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
import { resolveEntryFile, getWorkspaces, addWorkspace, removeWorkspace } from './utils/fileFinder.js';

export interface CliOptions {
  scale?: string;
  format?: string;
  out?: string;
  fonts?: string;
  watch?: boolean;
  quality?: string;
  dpi?: string;
  bleed?: string;
  port?: string;
}

const useColor = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR !== '0');

export const c = {
  reset: (s: string) => useColor ? `\x1b[0m${s}\x1b[0m` : s,
  bold: (s: string) => useColor ? `\x1b[1m${s}\x1b[22m` : s,
  dim: (s: string) => useColor ? `\x1b[2m${s}\x1b[22m` : s,
  red: (s: string) => useColor ? `\x1b[31m${s}\x1b[39m` : s,
  green: (s: string) => useColor ? `\x1b[32m${s}\x1b[39m` : s,
  yellow: (s: string) => useColor ? `\x1b[33m${s}\x1b[39m` : s,
  cyan: (s: string) => useColor ? `\x1b[36m${s}\x1b[39m` : s,
  white: (s: string) => useColor ? `\x1b[37m${s}\x1b[39m` : s,
  bgRed: (s: string) => useColor ? `\x1b[41m\x1b[37m\x1b[1m${s}\x1b[0m` : s,
  bgGreen: (s: string) => useColor ? `\x1b[42m\x1b[30m\x1b[1m${s}\x1b[0m` : s,
};

/**
 * Formats a compiler error with location and 3-line code preview snippet using rich ANSI colors.
 */
export function formatCompilerError(err: any, entryPath?: string): string {
  let file = (err.loc && err.loc.file) ? err.loc.file : (entryPath || 'inline.toad');
  let line = (err.loc && err.loc.start) ? err.loc.start.line : 0;
  let col = (err.loc && err.loc.start) ? err.loc.start.column : 0;
  let message = err.message || String(err);
  let code = err.code || 'TOAD-E001';

  let header = `[toad error] ${c.bgRed(' ERROR ')} ${c.bold(c.red(`[${code}]`))} ${c.bold(message)}`;
  let locLine = line > 0 ? `\n  ${c.dim('-->')} ${c.cyan(`${file}:${line}:${col}`)}` : '';
  let snippet = '';

  try {
    if (file && fs.existsSync(file)) {
      const source = fs.readFileSync(file, 'utf-8');
      const lines = source.split(/\r?\n/);
      if (line > 0 && line <= lines.length) {
        const startLine = Math.max(1, line - 2);
        const endLine = Math.min(lines.length, line + 1);
        snippet += '\n';
        for (let i = startLine; i <= endLine; i++) {
          const lNum = String(i).padStart(4, ' ');
          const isTarget = i === line;
          const marker = isTarget ? c.red('> ') : '  ';
          const lineText = lines[i - 1];
          snippet += `\n${marker}${c.dim(lNum + ' |')} ${isTarget ? c.bold(lineText) : c.dim(lineText)}`;
          if (isTarget) {
            const pointerIndent = ' '.repeat(Math.max(0, col - 1));
            snippet += `\n       ${c.dim('|')} ${pointerIndent}${c.bold(c.red('^'))}`;
          }
        }
      }
    }
  } catch {}

  return `${header}${locLine}${snippet}\n`;
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
  let previewServer: PreviewServerInstance | null = null;

  const triggerBuild = async (): Promise<BuildResult | null> => {
    if (isBuilding) {
      hasPendingChange = true;
      return null;
    }

    isBuilding = true;
    try {
      console.log(`[toad] Compiling ${path.basename(resolvedEntry)}...`);
      const result = await compileToad(resolvedEntry, buildOptions);

      console.log(`[toad] Build succeeded in ${result.durationMs}ms`);
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
        
        console.log(`  -> ${path.basename(f).padEnd(20)} ${sizeStr.padStart(8)}  ${dimStr}`);
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

      return result;
    } catch (err: any) {
      const formatted = formatCompilerError(err, resolvedEntry);
      console.error(formatted);
      if (previewServer) {
        previewServer.broadcastError(formatted);
      }
      return null;
    } finally {
      isBuilding = false;
      if (hasPendingChange) {
        hasPendingChange = false;
        await triggerBuild();
      }
    }
  };

  const watcher = chokidar.watch(Array.from(watchedFiles), {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  });

  watcher.on('all', async (event, changedPath) => {
    console.log(`[toad] File ${event}: ${path.basename(changedPath)}`);
    await triggerBuild();
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
    const qualityNum = opts.quality ? parseFloat(opts.quality) : undefined;
    const dpiNum = opts.dpi ? parseFloat(opts.dpi) : undefined;
    const formatVal = Array.isArray(opts.format) ? opts.format.join(',') : (opts.format ? String(opts.format) : undefined);

    const buildOptions: BuildOptions = {
      scale: scaleNum !== undefined ? (isNaN(scaleNum) || scaleNum <= 0 ? 1 : scaleNum) : undefined,
      format: formatVal,
      outDir: opts.out,
      fontsDir: opts.fonts,
      watch: opts.watch,
      quality: qualityNum,
      dpi: dpiNum,
      bleed: opts.bleed
    };

    const formatOutput = (result: BuildResult) => {
      console.log(`\n${c.bgGreen(' SUCCESS ')} ${c.bold(c.green(`Build completed in ${result.durationMs}ms`))}`);
      for (const f of result.outputFiles) {
        let sizeStr = '';
        try {
          const stat = fs.statSync(f);
          const sizeKb = (stat.size / 1024).toFixed(1);
          sizeStr = stat.size > 1024 * 1024 ? `${(stat.size / 1024 / 1024).toFixed(2)} MB` : `${sizeKb} KB`;
        } catch { }
        
        let dimStr = '';
        if (f.endsWith('.psd') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp')) {
           dimStr = c.dim(`(${result.canvas.width}x${result.canvas.height})`);
        }
        
        console.log(`  ${c.cyan('➜')} ${c.bold(path.basename(f)).padEnd(24)} ${c.yellow(sizeStr.padStart(8))}  ${dimStr}`);
      }
      if (result.warnings.length > 0) {
        console.log('');
        for (const w of result.warnings) {
          console.warn(`  ${c.yellow('⚠')} ${c.yellow(`[warning] ${w}`)}`);
        }
      }
      console.log('');
    };

    if (opts.watch) {
      await startWatcher(entry, buildOptions);
    } else {
      try {
        const result = await compileToad(entry, buildOptions);
        formatOutput(result);
      } catch (err: any) {
        console.error(formatCompilerError(err, entry));
        process.exit(1);
      }
    }
  };

  program
    .command('build [entry]', { isDefault: true })
    .description('Compile a .toad file into raster images (PNG, JPG, WebP), vector graphics (SVG), or layered Photoshop document (PSD)')
    .option('-s, --scale <number>', 'Scale factor multiplier for raster rendering (e.g. 1, 2, 4)')
    .option('-f, --format <formats...>', 'Output format(s): png | jpg | webp | psd | svg | image | all (comma or space separated)')
    .option('-o, --out <dir>', 'Output directory (defaults to entry directory)')
    .option('--fonts <dir>', 'Directory containing custom font files to register')
    .option('-w, --watch', 'Watch entry file and all transitive imports for changes')
    .option('-q, --quality <number>', 'JPEG/WebP compression quality (1-100 or 0.0-1.0, default: 92)')
    .option('--dpi <number>', 'Target output resolution in DPI (e.g. 300, 150, 96)')
    .option('--bleed <dimension>', 'Print bleed margin override (e.g. 3mm, 0.125in, 10px)')
    .action(handleBuild);

  program
    .command('dev [entry]')
    .description('Start live preview server with hot reload and watch mode')
    .option('-s, --scale <number>', 'Scale factor multiplier for raster rendering (e.g. 1, 2, 4)')
    .option('-f, --format <formats...>', 'Output format(s): png | jpg | webp | psd | svg | image | all (comma or space separated)')
    .option('-o, --out <dir>', 'Output directory (defaults to entry directory)')
    .option('--fonts <dir>', 'Directory containing custom font files to register')
    .option('-q, --quality <number>', 'JPEG/WebP compression quality (1-100 or 0.0-1.0, default: 92)')
    .option('--dpi <number>', 'Target output resolution in DPI (e.g. 300, 150, 96)')
    .option('--bleed <dimension>', 'Print bleed margin override (e.g. 3mm, 0.125in, 10px)')
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
          console.log(`  ${c.dim('(Keine Workspaces hinterlegt)')}`);
          console.log(`\n${c.dim('Tipp:')} Füge einen Ordner hinzu mit:`);
          console.log(`  ${c.cyan('toad workspace add <pfad>')}\n`);
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
          console.error(`\n${c.red('✖')} Bitte gib das zu entfernende Verzeichnis an: toad workspace remove <pfad>\n`);
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

      console.error(`\n${c.red('✖')} Unbekannte Aktion "${action}". Erlaubt: list, add, remove\n`);
      process.exit(1);
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
  program.parse(process.argv);
}
