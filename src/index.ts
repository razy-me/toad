/**
 * src/index.ts
 * Public TypeScript API and exports for the "toad" declarative design DSL compiler.
 */

// 1. AST & Node Definitions
export * from './parser/ast.js';

// 2. Lexer & Tokenizer
export {
  Lexer,
  Token,
  TokenType,
  tokenize,
  tokenizeToad
} from './parser/lexer.js';

// 3. Parser
export {
  Parser,
  parseToad
} from './parser/parser.js';

// 4. Import & Component Resolver
export {
  ImportResolver,
  resolveImportsAndComponents,
  CircularImportError,
  CircularVariableError,
  ComponentRecursionLimitError
} from './parser/importResolver.js';

// 5. Geometry & Layout Solver
export {
  LayoutSolver,
  solveLayout,
  layoutText,
  computeGcd,
  computeAspectRatio,
  LayoutResult,
  LayoutNode,
  LayoutBox,
  TextLayoutResult,
  Point,
  Size,
  ComputedStyle,
  GradientStyle,
  GradientStop,
  ShadowStyle
} from './parser/math.js';

// 6. Dependency Graph & Relational DAG
export {
  DependencyGraph,
  buildDependencyGraph,
  topologicalSort,
  CyclicDependencyError
} from './parser/dependencyGraph.js';

// 7. Font Loader
export {
  FontLoader,
  FontDirective,
  registerFont,
  loadFontsFromDir,
  registerFontDirectives
} from './engine/fontLoader.js';

// 8. Shared Draw Utilities
export {
  drawRect,
  drawCircle,
  drawPolygon,
  createCanvasGradient,
  mapBlendMode,
  mapBlendModeToPsd,
  parseColorToRgba,
  parseFilterString,
  parseAndApplyFilter,
  distributeGradientStops,
  drawImageWithFit
} from './engine/drawUtils.js';

// 9. Raster Canvas Renderer
export {
  CanvasRenderer,
  renderToCanvas,
  renderToBuffer,
  RenderOptions
} from './engine/canvasRenderer.js';

// 10. Layered Photoshop PSD Exporter
export {
  PsdExporter,
  exportToPsd,
  PsdExportOptions
} from './engine/psdExporter.js';

// 11. Scalable Vector Graphics (SVG) Exporter
export {
  SvgExporter,
  exportToSvg,
  exportToSvgBuffer,
  SvgExportOptions
} from './engine/svgExporter.js';

// 12. Unified Build Pipeline
export {
  compileToad,
  BuildOptions,
  BuildResult
} from './build.js';

// 13. Commander CLI
export {
  createCli,
  program,
  startWatcher,
  CliOptions
} from './cli.js';

// 14. Developer Tools, Linter & LSP
export { formatToad, FormatOptions } from './tools/formatter.js';
export { lintDocument } from './tools/linter.js';
export { ToadLanguageServer } from './tools/lsp/server.js';
export { runInit } from './scaffold.js';
export { findToadFiles, resolveEntryFile, getWorkspaces, addWorkspace, removeWorkspace } from './utils/fileFinder.js';
