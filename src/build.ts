/**
 * src/build.ts
 * Unified compilation and build pipeline for the "toad" language.
 * Integrates lexer, parser, import/component resolver, layout solver, font loader,
 * raster canvas renderer, and Photoshop PSD exporter.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseToad } from './parser/parser.js';
import { resolveImportsAndComponents, convertDimensionToPx } from './parser/importResolver.js';
import { solveLayout, LayoutResult, LayoutNode } from './parser/math.js';
import { renderToBuffer, renderToCanvas } from './engine/canvasRenderer.js';
import { createCanvas } from '@napi-rs/canvas';

/**
 * JPEG has no alpha channel; flatten the rendered canvas onto white so
 * transparent designs do not export with a black background.
 */
function flattenForJpeg(canvas: any) {
  const out = createCanvas(canvas.width, canvas.height);
  const fctx = out.getContext('2d');
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, out.width, out.height);
  fctx.drawImage(canvas, 0, 0);
  return out;
}
import { exportToPsd } from './engine/psdExporter.js';
import { exportToSvgBuffer, SvgExporter } from './engine/svgExporter.js';
import { loadFontsFromDir, registerFontDirectives } from './engine/fontLoader.js';
import { ParseError } from './parser/ast.js';

export interface BuildOptions {
  outDir?: string;
  format?: string;
  scale?: number;
  dpi?: number;
  bleed?: number | string;
  fontsDir?: string;
  watch?: boolean;
  quality?: number;
  /** Preferred port for the live preview server (dev command). */
  port?: number;
}

export interface BuildResult {
  success: boolean;
  entryPath: string;
  outputFiles: string[];
  layout: LayoutResult;
  canvas: {
    width: number;
    height: number;
    aspectRatio: string;
    background?: any;
    dpi: number;
  };
  dependencies: string[];
  warnings: string[];
  durationMs: number;
}

/**
 * Compiles a .toad DSL entry file to raster images (PNG, JPG) and/or layered Photoshop document (PSD).
 */
export async function compileToad(
  entryPath: string,
  options: BuildOptions = {}
): Promise<BuildResult> {
  const startTime = Date.now();

  // 1. Validate entry path
  if (!entryPath || typeof entryPath !== 'string') {
    throw new Error('Entry path is required for compilation.');
  }

  const resolvedEntry = path.resolve(entryPath);
  if (!fs.existsSync(resolvedEntry)) {
    throw new Error(`Entry file not found: ${resolvedEntry}`);
  }

  const stat = fs.statSync(resolvedEntry);
  if (stat.isDirectory()) {
    throw new Error(`Entry path is a directory, expected a .toad file: ${resolvedEntry}`);
  }

  // 2. Read and parse DSL entry file
  const source = fs.readFileSync(resolvedEntry, 'utf-8');
  const ast = parseToad(source, resolvedEntry);

  if (ast.diagnostics && ast.diagnostics.length > 0) {
    const errorDiag = ast.diagnostics.find(d => d.severity === 'error');
    if (errorDiag) {
      throw new ParseError(errorDiag.message, errorDiag.loc, errorDiag.code);
    }
  }

  // 3. Register fonts from fontsDir if specified
  if (options.fontsDir) {
    const resolvedFontsDir = path.resolve(options.fontsDir);
    if (fs.existsSync(resolvedFontsDir)) {
      loadFontsFromDir(resolvedFontsDir);
    }
  }

  // 4. Resolve imports, variables, and components
  const resolved = await resolveImportsAndComponents(ast, resolvedEntry);

  // Register inline @font directives if present
  if (resolved.fonts && resolved.fonts.length > 0) {
    registerFontDirectives(
      resolved.fonts.map(f => ({
        family: f.family,
        path: f.path,
        weight: f.weight,
        style: f.style
      })),
      resolvedEntry
    );
  }

  // 5. Solve layout geometry, Skia text bounding boxes, currentColor, and DAG
  const layout = await solveLayout(resolved);

  if (options.dpi !== undefined && !isNaN(options.dpi)) {
    layout.canvas.dpi = options.dpi;
  }
  if (options.bleed !== undefined) {
    // Accept dimension strings ("3mm", "0.125in", "12px", "10") and convert
    // physical units at the canvas DPI instead of silently reading them as px.
    const raw = String(options.bleed).trim();
    const m = raw.match(/^(-?\d*\.?\d+)\s*(px|mm|cm|in|pt)?$/i);
    let bNum: number | undefined;
    if (m) {
      const v = parseFloat(m[1]);
      const unit = (m[2] || 'px').toLowerCase();
      const dpi = layout.canvas.dpi || 96;
      bNum = convertDimensionToPx(v, unit === 'px' ? undefined : unit, dpi);
    } else {
      bNum = parseFloat(raw);
    }
    if (bNum !== undefined && !isNaN(bNum)) layout.canvas.bleed = Math.max(0, bNum);
  }

  // 6. Ensure output directory
  const outDir = options.outDir
    ? path.resolve(options.outDir)
    : path.dirname(resolvedEntry);

  fs.mkdirSync(outDir, { recursive: true });

  const baseName = path.basename(resolvedEntry, path.extname(resolvedEntry));
  const rawQuality = options.quality !== undefined ? options.quality : layout.canvas.quality;
  let quality = 92;
  if (rawQuality !== undefined && !isNaN(rawQuality)) {
    const q = rawQuality > 0 && rawQuality <= 1 ? rawQuality * 100 : rawQuality;
    quality = Math.max(1, Math.min(100, Math.round(q)));
  }

  // Determine formats to export: CLI option overrides file-declared canvas.exports
  let formatsToRender: string[] = [];
  
  const processFormat = (f: string): string[] => {
    // Support comma-separated inputs like "svg, png, psd" or "svg,png"
    const rawTokens = f.split(/[\s,]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
    const resolved: string[] = [];

    for (const token of rawTokens) {
      if (token === 'all') {
        resolved.push('png', 'jpg', 'webp', 'psd', 'svg');
      } else if (token === 'image' || token === 'images' || token === 'web') {
        resolved.push('png', 'jpg', 'webp', 'svg');
      } else if (token === 'jpeg') {
        resolved.push('jpg');
      } else if (['png', 'jpg', 'webp', 'psd', 'svg'].includes(token)) {
        resolved.push(token);
      } else {
        // Unknown format tokens previously passed through and produced a
        // silent SUCCESS with zero written files.
        console.warn(`[warning] Unknown output format '${token}' ignored. Supported: png, jpg, webp, psd, svg, image, all.`);
      }
    }
    return resolved;
  };

  if (options.format) {
    formatsToRender = processFormat(options.format);
    formatsToRender = [...new Set(formatsToRender)];
  } else if (layout.canvas.exports && layout.canvas.exports.length > 0) {
    formatsToRender = layout.canvas.exports.flatMap(processFormat);
    // Remove duplicates
    formatsToRender = [...new Set(formatsToRender)];
  } else {
    formatsToRender = ['png'];
  }

  if (formatsToRender.length === 0) {
    throw new Error(`No valid output formats specified (received: '${options.format}'). Supported formats: png, jpg, webp, psd, svg, image, all.`);
  }

  // Determine scales to export: CLI option overrides file-declared canvas.scales
  let scalesToRender: number[] = [1];
  if (options.scale && options.scale > 0) {
    scalesToRender = [options.scale];
  } else if (layout.canvas.scales && layout.canvas.scales.length > 0) {
    scalesToRender = layout.canvas.scales;
  }

  const outputFiles: string[] = [];

  // Multi-canvas pages
  const layoutPages: Array<{ nameSuffix: string; pageLayout: LayoutResult }> = [];
  if (layout.canvases && layout.canvases.length > 1) {
    const usedSuffixes = new Set<string>();
    for (let idx = 0; idx < layout.canvases.length; idx++) {
      const c = layout.canvases[idx]!;
      let rawSlug = c.canvas.name ? c.canvas.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') : `${idx + 1}`;
      if (!rawSlug || rawSlug === '-') rawSlug = `${idx + 1}`;

      let candidate = `-${rawSlug}`;
      let counter = 1;
      while (usedSuffixes.has(candidate)) {
        candidate = `-${rawSlug}-${++counter}`;
      }
      usedSuffixes.add(candidate);

      layoutPages.push({
        nameSuffix: candidate,
        pageLayout: {
          canvas: c.canvas,
          fonts: layout.fonts,
          nodes: c.nodes,
          warnings: layout.warnings,
          dependencies: layout.dependencies
        }
      });
    }
  } else {
    layoutPages.push({ nameSuffix: '', pageLayout: layout });
  }

  // 7. Render outputs according to requested formats and scale factors
  fs.mkdirSync(outDir, { recursive: true });

  for (const scale of scalesToRender) {
    const scaleSuffix = scalesToRender.length > 1 || (scale !== 1 && !options.scale) ? (scale === 1 ? '' : `@${scale}x`) : '';

    for (const page of layoutPages) {
      const fileBase = scaleSuffix ? `${baseName}${page.nameSuffix}${scaleSuffix}` : `${baseName}${page.nameSuffix}`;
      const pageLayout = page.pageLayout;

      // Render the scene once per page/scale and encode every requested
      // raster format from the same bitmap instead of re-running the full
      // renderer per format.
      const needsRaster = formatsToRender.some(f => f === 'png' || f === 'jpg' || f === 'jpeg' || f === 'webp');
      if (needsRaster) {
        const renderedCanvas = await renderToCanvas(pageLayout, {
          scale,
          basePath: resolvedEntry
        });

        if (formatsToRender.includes('png')) {
          const pngPath = path.join(outDir, `${fileBase}.png`);
          fs.mkdirSync(path.dirname(pngPath), { recursive: true });
          fs.writeFileSync(pngPath, await renderedCanvas.encode('png'));
          outputFiles.push(pngPath);
        }

        if (formatsToRender.includes('jpg') || formatsToRender.includes('jpeg')) {
          const jpgPath = path.join(outDir, `${fileBase}.jpg`);
          fs.mkdirSync(path.dirname(jpgPath), { recursive: true });
          fs.writeFileSync(jpgPath, await flattenForJpeg(renderedCanvas).encode('jpeg', quality));
          outputFiles.push(jpgPath);
        }

        if (formatsToRender.includes('webp')) {
          const webpPath = path.join(outDir, `${fileBase}.webp`);
          fs.mkdirSync(path.dirname(webpPath), { recursive: true });
          fs.writeFileSync(webpPath, await renderedCanvas.encode('webp', quality));
          outputFiles.push(webpPath);
        }
      }

      if (formatsToRender.includes('psd')) {
        const effectiveDpi = options.dpi || (pageLayout.canvas.hasExplicitDpi ? pageLayout.canvas.dpi : 72);
        const psdBuf = await exportToPsd(pageLayout, {
          scale,
          dpi: effectiveDpi,
          basePath: resolvedEntry
        });
        const psdPath = path.join(outDir, `${fileBase}.psd`);
        fs.mkdirSync(path.dirname(psdPath), { recursive: true });
        fs.writeFileSync(psdPath, psdBuf);
        outputFiles.push(psdPath);
      }

      if (formatsToRender.includes('svg')) {
        const exporter = new SvgExporter({ basePath: resolvedEntry });
        const svgContent = await exporter.export(pageLayout, scale);
        const svgPath = path.join(outDir, `${fileBase}.svg`);
        fs.mkdirSync(path.dirname(svgPath), { recursive: true });
        fs.writeFileSync(svgPath, svgContent, 'utf-8');
        outputFiles.push(svgPath);
      }
    }
  }

  // 8. Collect and deduplicate all transitive dependencies (toad files, fonts, and images)
  const assetDeps: string[] = [];
  const entryDir = path.dirname(resolvedEntry);

  if (layout.fonts) {
    for (const f of layout.fonts) {
      if (f.source) {
        const fullFontPath = path.resolve(entryDir, f.source);
        if (fs.existsSync(fullFontPath)) assetDeps.push(fullFontPath);
      }
    }
  }

  const collectImageAssets = (nodes: LayoutNode[]) => {
    for (const n of nodes) {
      const src = n.imageLayout?.src || (n as any).src;
      if (src && typeof src === 'string' && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
        const fullImgPath = path.resolve(entryDir, src);
        if (fs.existsSync(fullImgPath)) assetDeps.push(fullImgPath);
      }
      if (n.children && n.children.length > 0) {
        collectImageAssets(n.children);
      }
    }
  };
  collectImageAssets(layout.nodes);

  const rawDeps = [
    resolvedEntry,
    ...(resolved.dependencies || []),
    ...(layout.dependencies || []),
    ...assetDeps
  ];
  const dependencies = Array.from(new Set(rawDeps.map(p => path.resolve(p))));

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    entryPath: resolvedEntry,
    outputFiles,
    layout,
    canvas: layout.canvas,
    dependencies,
    warnings: [...(resolved.warnings || []), ...(layout.warnings || [])],
    durationMs
  };
}

/**
 * Generates or installs the complete VS Code extension files for the toad language.
 */
export function generateVsCodeExtension(targetDir: string) {
  const resolvedTarget = path.resolve(targetDir);
  fs.mkdirSync(resolvedTarget, { recursive: true });
  fs.mkdirSync(path.join(resolvedTarget, 'syntaxes'), { recursive: true });
  fs.mkdirSync(path.join(resolvedTarget, 'snippets'), { recursive: true });

  // 1. package.json
  const pkg = {
    name: 'vscode-toad',
    displayName: 'toad Language & Compiler',
    description: 'Rich language support, syntax highlighting, autocompletion snippets, and 1-click build & live preview for the toad design language.',
    version: '1.0.0',
    publisher: 'toad',
    engines: { vscode: '^1.75.0' },
    categories: ['Programming Languages', 'Snippets', 'Other'],
    main: './extension.js',
    activationEvents: ['onLanguage:toad', '*'],
    contributes: {
      languages: [{
        id: 'toad',
        aliases: ['toad', 'TOAD'],
        extensions: ['.toad'],
        configuration: './language-configuration.json'
      }],
      grammars: [{
        language: 'toad',
        scopeName: 'source.toad',
        path: './syntaxes/toad.tmLanguage.json'
      }],
      snippets: [{
        language: 'toad',
        path: './snippets/toad.json'
      }],
      commands: [
        {
          command: 'toad.compileCurrentFile',
          title: 'toad: Export / Compile File (1-Click)'
        },
        {
          command: 'toad.watchCurrentFile',
          title: 'toad: Start Live Watch Mode'
        }
      ],
      keybindings: [
        {
          command: 'toad.compileCurrentFile',
          key: 'ctrl+shift+b',
          mac: 'cmd+shift+b',
          when: 'editorTextFocus && editorLangId == toad'
        }
      ],
      menus: {
        'editor/title': [
          {
            command: 'toad.compileCurrentFile',
            when: 'resourceExtname == .toad',
            group: 'navigation@1'
          },
          {
            command: 'toad.watchCurrentFile',
            when: 'resourceExtname == .toad',
            group: 'navigation@2'
          }
        ],
        'editor/context': [
          {
            command: 'toad.compileCurrentFile',
            when: 'resourceExtname == .toad',
            group: '1_modification'
          },
          {
            command: 'toad.watchCurrentFile',
            when: 'resourceExtname == .toad',
            group: '1_modification'
          }
        ]
      }
    }
  };
  fs.writeFileSync(path.join(resolvedTarget, 'package.json'), JSON.stringify(pkg, null, 2));

  // 2. language-configuration.json
  const langConfig = {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/']
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] }
    ],
    surroundingPairs: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
      ['"', '"'],
      ["'", "'"]
    ]
  };
  fs.writeFileSync(path.join(resolvedTarget, 'language-configuration.json'), JSON.stringify(langConfig, null, 2));

  // 3. syntaxes/toad.tmLanguage.json
  const grammar = {
    $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: 'toad',
    scopeName: 'source.toad',
    patterns: [
      { include: '#comments' },
      { include: '#directives' },
      { include: '#variables' },
      { include: '#keywords' },
      { include: '#strings' },
      { include: '#colors' },
      { include: '#numbers-units' },
      { include: '#functions' },
      { include: '#identifiers' },
      { include: '#operators' }
    ],
    repository: {
      comments: {
        patterns: [
          { name: 'comment.line.double-slash.toad', match: '//.*$' },
          { name: 'comment.block.toad', begin: '/\\*', end: '\\*/' }
        ]
      },
      directives: {
        patterns: [
          {
            match: '(@(?:import|font))\\b',
            captures: { 1: { name: 'keyword.control.directive.toad' } }
          }
        ]
      },
      variables: {
        patterns: [
          { name: 'variable.other.declaration.toad', match: '[>$][a-zA-Z0-9_-]+' }
        ]
      },
      keywords: {
        patterns: [
          {
            name: 'keyword.declaration.element.toad',
            match: '\\b(canvas|component|rect|circle|polygon|path|text|image|group|grid|stack)\\b'
          },
          {
            name: 'keyword.other.relational.toad',
            match: '\\b(at|of|right|left|above|below|center|inside|offset|to|as|weight|style)\\b'
          },
          {
            name: 'support.type.property-name.toad',
            match: '\\b(size|width|height|radius|fill|stroke|stroke-width|stroke-style|stroke-cap|stroke-join|color|font-family|font-size|font-weight|font-style|line-height|letter-spacing|text-transform|align|content|src|fit|opacity|shadow|filter|blend|clip|direction|gap|padding|columns|rows|ratio|aspect-ratio|resolution|density|export|exports|format|quality|compress)\\b'
          },
          {
            name: 'constant.language.toad',
            match: '\\b(true|false|currentColor|transparent|none|solid|dashed|dotted|round|square|butt|miter|bevel|cover|contain|fill|uppercase|lowercase|capitalize|normal|italic|bold|horizontal|vertical|row|column|start|center|end|all|web|sd|hd|fhd|1080p|qhd|4k|8k)\\b'
          }
        ]
      },
      strings: {
        patterns: [
          { name: 'string.quoted.double.toad', begin: '"', end: '"', patterns: [{ match: '\\\\.', name: 'constant.character.escape.toad' }] },
          { name: 'string.quoted.single.toad', begin: "'", end: "'", patterns: [{ match: '\\\\.', name: 'constant.character.escape.toad' }] }
        ]
      },
      colors: {
        patterns: [
          { name: 'constant.other.color.hex.toad', match: '#[0-9a-fA-F]{3,8}\\b' }
        ]
      },
      'numbers-units': {
        patterns: [
          {
            name: 'constant.numeric.toad',
            match: '(\\b[0-9]+(?:\\.[0-9]+)?)(px|%|deg|rad|em|rem|pt|vw|vh|x|k|p)?\\b',
            captures: {
              1: { name: 'constant.numeric.value.toad' },
              2: { name: 'keyword.other.unit.toad' }
            }
          },
          {
            name: 'constant.language.ratio.toad',
            match: '\\b[0-9]+:[0-9]+\\b'
          }
        ]
      },
      functions: {
        patterns: [
          {
            match: '\\b(linear-gradient|radial-gradient|alpha|lighten|darken|rgb|rgba|hsl|hsla|blur|saturate|brightness|contrast)\\b(?=\\s*\\()',
            name: 'support.function.toad'
          }
        ]
      },
      identifiers: {
        patterns: [
          { name: 'entity.name.tag.id.toad', match: '#[a-zA-Z0-9_-]+' }
        ]
      },
      operators: {
        patterns: [
          { name: 'keyword.operator.toad', match: '[:=,]' }
        ]
      }
    }
  };
  fs.writeFileSync(path.join(resolvedTarget, 'syntaxes', 'toad.tmLanguage.json'), JSON.stringify(grammar, null, 2));

  // 4. snippets/toad.json
  const snippets = {
    'Canvas Block': {
      prefix: 'canvas',
      body: [
        'canvas "${1:Artwork}" {',
        '  ratio: ${2|16:9,1:1,9:16,4:5,21:9|};',
        '  resolution: ${3|1080p,4k,720p,fhd,qhd|};',
        '  export: ${4|all,web,png,svg,psd,jpg,webp|};',
        '  quality: ${5:85%};',
        '  background: ${6:transparent};',
        '}\n$0'
      ],
      description: 'Create a new toad canvas artboard'
    },
    'Rectangle Element': {
      prefix: 'rect',
      body: [
        'rect #${1:box} {',
        '  at: (${2:40px}, ${3:40px});',
        '  size: ${4:200px} ${5:100px};',
        '  fill: ${6:#38bdf8};',
        '  radius: ${7:16px};',
        '}\n$0'
      ],
      description: 'Add a styled rectangle'
    },
    'Circle Element': {
      prefix: 'circle',
      body: [
        'circle #${1:dot} {',
        '  at: (${2:50px}, ${3:50px});',
        '  radius: ${4:40px};',
        '  fill: ${5:#38bdf8};',
        '}\n$0'
      ],
      description: 'Add a circle'
    },
    'Text Element': {
      prefix: 'text',
      body: [
        'text #${1:headline} {',
        '  at: (${2:40px}, ${3:40px});',
        '  content: "${4:Title}";',
        '  font-family: "${5:Inter}";',
        '  font-size: ${6:32px};',
        '  font-weight: ${7:700};',
        '  fill: ${8:#ffffff};',
        '  align: ${9|left,center,right|};',
        '}\n$0'
      ],
      description: 'Add a typography text block'
    },
    'Path (Vector Curve)': {
      prefix: 'path',
      body: [
        'path #${1:vectorWave} {',
        '  at: (${2:0px}, ${3:0px});',
        '  size: ${4:400px} ${5:200px};',
        '  d: "${6:M 0 50 Q 100 0 200 50 T 400 50}";',
        '  stroke: ${7:#38bdf8} ${8:4px};',
        '  stroke-cap: round;',
        '  fill: transparent;',
        '}\n$0'
      ],
      description: 'Add an SVG bezier path element'
    },
    'Polygon Element': {
      prefix: 'polygon',
      body: [
        'polygon #${1:triangle} {',
        '  at: (${2:100px}, ${3:100px});',
        '  size: ${4:100px} ${5:100px};',
        '  points: [',
        '    (-50px, -50px),',
        '    (50px, -50px),',
        '    (0px, 50px)',
        '  ];',
        '  radius: ${6:12px};',
        '  fill: ${7:#38bdf8};',
        '}\n$0'
      ],
      description: 'Add a rounded polygon element'
    },
    'Stack Container': {
      prefix: 'stack',
      body: [
        'stack #${1:nav} {',
        '  at: (${2:40px}, ${3:40px});',
        '  direction: ${4|horizontal,vertical|};',
        '  align: ${5|center,start,end|};',
        '  gap: ${6:16px};',
        '  padding: ${7:12px 24px};',
        '  fill: ${8:#1e293b};',
        '  radius: ${9:16px};',
        '  ',
        '  $0',
        '}'
      ],
      description: 'Add an Auto-Layout Stack container'
    },
    'Component Declaration': {
      prefix: 'component',
      body: [
        'component ${1:Button}(label = "${2:Click Me}", bg = ${3:#38bdf8}) {',
        '  group {',
        '    rect #bg {',
        '      size: 140px 48px;',
        '      fill: bg;',
        '      radius: 24px;',
        '    }',
        '    text #txt {',
        '      at: center of #bg;',
        '      content: label;',
        '      font-weight: 700;',
        '      fill: #000000;',
        '    }',
        '  }',
        '}\n$0'
      ],
      description: 'Declare a reusable parameterized component'
    }
  };
  fs.writeFileSync(path.join(resolvedTarget, 'snippets', 'toad.json'), JSON.stringify(snippets, null, 2));

  // 5. extension.js (VS Code Extension Controller & Autocompletion Provider)
  const extJs = `
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let activeWatcherProcess = null;
let outputChannel = null;

function getOutputChannel() {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('toad Compiler');
  }
  return outputChannel;
}

// Comprehensive toad property definitions with documentation & snippets
const TOAD_PROPERTIES = [
  { name: 'ratio', detail: 'Aspect Ratio', snippet: 'ratio: \${1|16:9,1:1,9:16,4:5,21:9|};', doc: 'Canvas aspect ratio preset (e.g. 16:9, 1:1)' },
  { name: 'resolution', detail: 'Target Resolution', snippet: 'resolution: \${1|1080p,4k,720p,fhd,qhd,1440p,8k|};', doc: 'Auto calculates width & height based on aspect ratio' },
  { name: 'export', detail: 'Export Formats', snippet: 'export: \${1|all,web,png,svg,psd,jpg,webp|};', doc: 'Export formats (all, web, png, svg, psd, jpg, webp)' },
  { name: 'quality', detail: 'Image Quality / Compression', snippet: 'quality: \${1:85%};', doc: 'Compression quality for JPG & WebP (1-100% or 0.1-1.0)' },
  { name: 'compress', detail: 'Image Quality / Compression', snippet: 'compress: \${1:80%};', doc: 'Compression quality for JPG & WebP (1-100% or 0.1-1.0)' },
  { name: 'background', detail: 'Canvas Background', snippet: 'background: \${1|transparent,#0f172a,#ffffff|};', doc: 'Canvas background color or gradient' },
  { name: 'background-color', detail: 'Canvas Background', snippet: 'background-color: \${1|transparent,#0f172a,#ffffff|};', doc: 'Canvas background color alias' },
  { name: 'size', detail: 'Element Size', snippet: 'size: \${1:200px} \${2:100px};', doc: 'Explicit width and height dimensions' },
  { name: 'width', detail: 'Element Width', snippet: 'width: \${1:200px};', doc: 'Explicit element width in pixels' },
  { name: 'height', detail: 'Element Height', snippet: 'height: \${1:100px};', doc: 'Explicit element height in pixels' },
  { name: 'at', detail: 'Positioning', snippet: 'at: \${1|center of canvas,(40px\\, 40px),right of #id offset 16px,below #id offset 20px,inside #id|};', doc: 'Relational or coordinate positioning' },
  { name: 'fill', detail: 'Fill Color / Gradient', snippet: 'fill: \${1:#38bdf8};', doc: 'Background / fill color or gradient' },
  { name: 'stroke', detail: 'Border Stroke', snippet: 'stroke: \${1:#ffffff} \${2:2px};', doc: 'Border stroke color, width and style' },
  { name: 'stroke-cap', detail: 'Stroke Cap', snippet: 'stroke-cap: \${1|round,square,butt|};', doc: 'Line ending style (round, square, butt)' },
  { name: 'stroke-join', detail: 'Stroke Join', snippet: 'stroke-join: \${1|round,miter,bevel|};', doc: 'Line corner join style (round, miter, bevel)' },
  { name: 'radius', detail: 'Corner Radius', snippet: 'radius: \${1:16px};', doc: 'Corner border radius (number or [top, right, bottom, left])' },
  { name: 'border-radius', detail: 'Corner Radius', snippet: 'border-radius: \${1:16px};', doc: 'Corner border radius (number or [top, right, bottom, left])' },
  { name: 'content', detail: 'Text Content', snippet: 'content: "\${1:Text}";', doc: 'Text content string' },
  { name: 'font-family', detail: 'Font Family', snippet: 'font-family: "\${1:Inter}";', doc: 'Typography font family name' },
  { name: 'font-size', detail: 'Font Size', snippet: 'font-size: \${1:24px};', doc: 'Typography font size in pixels' },
  { name: 'font-weight', detail: 'Font Weight', snippet: 'font-weight: \${1|700,400,600,bold,normal|};', doc: 'Typography font weight' },
  { name: 'line-height', detail: 'Line Height', snippet: 'line-height: \${1:1.25};', doc: 'Line height multiplier or pixel value' },
  { name: 'letter-spacing', detail: 'Letter Spacing', snippet: 'letter-spacing: \${1:1px};', doc: 'Tracking / letter spacing in pixels' },
  { name: 'text-transform', detail: 'Text Transform', snippet: 'text-transform: \${1|uppercase,lowercase,capitalize,none|};', doc: 'Transform text casing' },
  { name: 'align', detail: 'Text / Container Alignment', snippet: 'align: \${1|left,center,right|};', doc: 'Text alignment or Stack cross-axis alignment' },
  { name: 'direction', detail: 'Stack Flow Direction', snippet: 'direction: \${1|horizontal,vertical|};', doc: 'Flow direction for stack containers' },
  { name: 'gap', detail: 'Stack / Grid Gap', snippet: 'gap: \${1:16px};', doc: 'Spacing gap between child elements' },
  { name: 'padding', detail: 'Container Padding', snippet: 'padding: \${1:16px 24px};', doc: 'Inner padding for stacks and grids' },
  { name: 'src', detail: 'Image Source Path', snippet: 'src: "\${1:./assets/image.png}";', doc: 'File path to image asset' },
  { name: 'fit', detail: 'Image Fit Mode', snippet: 'fit: \${1|cover,contain,fill,none|};', doc: 'Image scaling fit mode' },
  { name: 'd', detail: 'SVG Path Data', snippet: 'd: "\${1:M 0 0 L 100 100}";', doc: 'SVG Bézier path commands' },
  { name: 'points', detail: 'Polygon Points', snippet: 'points: [\n\t(\${1:-50px}, \${2:-50px}),\n\t(\${3:50px}, \${4:-50px}),\n\t(\${5:0px}, \${6:50px})\n];', doc: 'Polygon vertex array relative to center' },
  { name: 'shadow', detail: 'Drop Shadow', snippet: 'shadow: \${1:0px} \${2:10px} \${3:20px} \${4:#00000040};', doc: 'Drop shadow (X Y Blur Color)' },
  { name: 'opacity', detail: 'Opacity', snippet: 'opacity: \${1:0.85};', doc: 'Layer opacity (0.0 to 1.0)' },
  { name: 'filter', detail: 'CSS Filters', snippet: 'filter: blur(\${1:4px}) saturate(\${2:1.2});', doc: 'Visual filter chain' },
  { name: 'blend-mode', detail: 'Blend Mode', snippet: 'blend-mode: \${1|multiply,screen,overlay,darken,lighten,color-dodge,color-burn|};', doc: 'Photoshop blend mode' },
  { name: 'clip', detail: 'Clipping Mask', snippet: 'clip: true;', doc: 'Use element as clipping mask for following layers' }
];

function activate(context) {
  const cliPath = path.resolve(__dirname, '..', 'toad', 'dist', 'cli.js');
  const parserPath = path.resolve(__dirname, '..', 'toad', 'dist', 'parser', 'parser.js');

  // Diagnostics Collection for Live Red Underlines & Problems Panel
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('toad');

  function validateDocument(document) {
    if (document.languageId !== 'toad' && !document.fileName.endsWith('.toad')) return;

    try {
      if (fs.existsSync(parserPath)) {
        const { parseToad } = require(parserPath);
        const text = document.getText();
        const ast = parseToad(text, document.fileName);

        if (ast.diagnostics && ast.diagnostics.length > 0) {
          const diags = ast.diagnostics.map(d => {
            const line = Math.max(0, (d.loc?.start?.line || 1) - 1);
            const col = Math.max(0, (d.loc?.start?.column || 1) - 1);
            const endLine = Math.max(0, (d.loc?.end?.line || d.loc?.start?.line || 1) - 1);
            const endCol = Math.max(col + 1, (d.loc?.end?.column || col + 2) - 1);

            const range = new vscode.Range(line, col, endLine, endCol);
            const diag = new vscode.Diagnostic(range, d.message, vscode.DiagnosticSeverity.Error);
            diag.code = d.code || 'TOAD-E001';
            diag.source = 'toad';
            return diag;
          });
          diagnosticCollection.set(document.uri, diags);
        } else {
          diagnosticCollection.delete(document.uri);
        }
      }
    } catch {}
  }

  // Validate active document immediately
  if (vscode.window.activeTextEditor) {
    validateDocument(vscode.window.activeTextEditor.document);
  }

  vscode.workspace.onDidOpenTextDocument(validateDocument, null, context.subscriptions);
  vscode.workspace.onDidChangeTextDocument(e => validateDocument(e.document), null, context.subscriptions);
  vscode.workspace.onDidSaveTextDocument(validateDocument, null, context.subscriptions);
  vscode.workspace.onDidCloseTextDocument(doc => diagnosticCollection.delete(doc.uri), null, context.subscriptions);

  // 1. Completion Item Provider for toad properties
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    'toad',
    {
      provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        
        // If already typing after colon, do not offer property names
        if (linePrefix.includes(':')) {
          return undefined;
        }

        return TOAD_PROPERTIES.map((p, idx) => {
          const item = new vscode.CompletionItem(p.name, vscode.CompletionItemKind.Property);
          item.detail = p.detail;
          item.documentation = new vscode.MarkdownString(p.doc);
          item.insertText = new vscode.SnippetString(p.snippet);
          item.sortText = '00' + String(idx).padStart(2, '0');
          item.preselect = idx === 0;
          return item;
        });
      }
    },
    ' ' // Trigger after whitespace or typing
  );

  // Command 1: 1-Click Compile
  const compileCmd = vscode.commands.registerCommand('toad.compileCurrentFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.toad')) {
      vscode.window.showWarningMessage('Please open a .toad file to compile.');
      return;
    }

    await editor.document.save();
    const filePath = editor.document.fileName;
    const channel = getOutputChannel();
    channel.show(true);
    channel.appendLine(\`[toad] Compiling \${path.basename(filePath)}...\`);

    const child = spawn('node', [cliPath, filePath], { cwd: path.dirname(filePath) });
    child.stdout.on('data', data => channel.append(data.toString()));
    child.stderr.on('data', data => channel.append(data.toString()));
    child.on('close', code => {
      if (code === 0) {
        vscode.window.showInformationMessage(\`toad: \${path.basename(filePath)} successfully exported!\`);
      } else {
        vscode.window.showErrorMessage(\`toad: Fehler in \${path.basename(filePath)}! Siehe Terminal/Output unten.\`);
      }
    });
  });

  // Command 2: Watch Mode
  const watchCmd = vscode.commands.registerCommand('toad.watchCurrentFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.toad')) {
      vscode.window.showWarningMessage('Please open a .toad file to start watch mode.');
      return;
    }

    if (activeWatcherProcess) {
      activeWatcherProcess.kill();
      activeWatcherProcess = null;
      vscode.window.showInformationMessage('toad: Watch mode stopped.');
      return;
    }

    const filePath = editor.document.fileName;
    const channel = getOutputChannel();
    channel.show(true);
    channel.appendLine(\`[toad] Starting watch mode on \${path.basename(filePath)}...\`);

    activeWatcherProcess = spawn('node', [cliPath, '-w', filePath], { cwd: path.dirname(filePath) });
    activeWatcherProcess.stdout.on('data', data => channel.append(data.toString()));
    activeWatcherProcess.stderr.on('data', data => channel.append(data.toString()));
    activeWatcherProcess.on('close', () => {
      activeWatcherProcess = null;
    });

    vscode.window.showInformationMessage(\`toad: Watch mode running for \${path.basename(filePath)}.\`);
  });

  context.subscriptions.push(diagnosticCollection, completionProvider, compileCmd, watchCmd);
}

function deactivate() {
  if (activeWatcherProcess) {
    activeWatcherProcess.kill();
  }
}

module.exports = { activate, deactivate };
`;
  fs.writeFileSync(path.join(resolvedTarget, 'extension.js'), extJs.trim());
}

