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
  findNode,
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

// 8b. Icon Registry
export {
  lucideIcons,
  getIconPath,
  hasIcon,
  registerIcon,
  unregisterIcon,
  clearCustomIcons
} from './engine/iconRegistry.js';

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

// 12. Prepress Vector PDF Exporter
export {
  PdfExporter,
  exportToPdfBuffer,
  PdfExportOptions
} from './engine/pdfExporter.js';

// 13. Unified Build Pipeline
export {
  compileToad,
  BuildOptions,
  BuildResult
} from './build.js';

// 14. Commander CLI
export {
  createCli,
  program,
  startWatcher,
  CliOptions
} from './cli.js';

// 15. Developer Tools, Linter & LSP
export { formatToad, FormatOptions } from './tools/formatter.js';
export { lintDocument } from './tools/linter.js';
export { ToadLanguageServer } from './tools/lsp/server.js';
export { runInit } from './scaffold.js';
export { findToadFiles, resolveEntryFile, getWorkspaces, addWorkspace, removeWorkspace, listAllToadFiles, ToadFileInfo } from './utils/fileFinder.js';
export { auditDesign, formatTerminalReport, formatWarningsSection, formatFixesSection, FormatReportOptions, DesignAuditResult, DesignIssue } from './tools/designAuditor.js';
export {
  bundleAssets,
  createIcoBuffer,
  PRESETS,
  BundlePreset,
  BundleOptions,
  BundleResult,
  GeneratedAssetInfo
} from './tools/assetBundler.js';
export {
  TextMeasurementCache,
  AstCache,
  CacheStats
} from './engine/buildCache.js';
export {
  formatRustDiagnostic,
  generateHelpSuggestion,
  inferErrorCode,
  suggestProperty,
  DiagnosticOptions
} from './tools/diagnostics.js';

// 16. Importers & Transpilers
export {
  importPsd,
  parsePostScriptFont,
  psdColorToToad,
  bezierPathToSvgD,
  PsdImportOptions,
  PsdImportResult,
  ExtractedAsset
} from './importers/psdImporter.js';

