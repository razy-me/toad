# Architecture & Symbol Map (TOAD DSL)

Compact navigation map for rapid entry without broad file scanning.

## 1. Entry Points (`src/`)
- `src/cli.ts`: CLI entry point (`toad build`, `toad watch`, `toad audit`, etc.)
- `src/index.ts`: Public library exports
- `src/build.ts`: Core pipeline orchestrating parsing, layout, and rendering
- `src/scaffold.ts`: Project scaffolding and template bootstrapping

## 2. Parser & AST (`src/parser/`)
- `lexer.ts`: Tokenizer for TOAD DSL keywords, operators, values
- `parser.ts`: Recursive-descent parser producing AST nodes
- `ast.ts`: TypeScript definitions for all AST nodes, properties, declarations
- `dependencyGraph.ts`: Dependency ordering and circular dependency detection
- `importResolver.ts`: Path resolution for `@import` statements
- `math.ts`: Evaluator for inline arithmetic and units

## 3. Layout & Render Engine (`src/engine/`)
- `canvasRenderer.ts`: Canvas 2D / Skia rendering engine (calculates layout + draws)
- `psdExporter.ts`: Adobe Photoshop PSD export with native text, shapes, effects
- `svgExporter.ts`: Clean vector SVG generation
- `pdfExporter.ts`: Vector/raster PDF export
- `fontLoader.ts`: Opentype font loader and metric calculator
- `vectorPathParser.ts`: Bezier and SVG path string parser
- `previewServer.ts`: Local live-reload HTTP/WebSocket server

## 4. Quality & Linting Tools (`src/tools/`)
- `linter.ts`: Diagnostic linter enforcing grammar and style
- `designAuditor.ts`: Multi-metric auditor scoring visual balance and rule compliance
- `antiSlopRules.ts`: AST-level checks for banned AI-slop patterns
- `formatter.ts`: TOAD code formatter and AST pretty-printer
- `lsp/server.ts`: Language Server Protocol implementation
- `metrics/`: Entropy, spatial distribution, typographic rhythm analysis

## 5. Specifications & Guidelines
- Detailed schemas & grammar: `the_seed/`
- Design system rules: `.agents/skills/toad-designer/SKILL.md`
