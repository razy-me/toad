---
name: toad-system-developer
description: >-
  Use this skill whenever working on the core TOAD compiler, runtime engine, AST, parser, layout math solver, Skia/SVG renderer, PSD exporter, CLI, LSP, test suite, or developing features for TOAD itself.
---

# TOAD System Developer — Engine & Compiler Core Skill

> **Primary Focus**: Developing, debugging, testing, and architecting the **TOAD Tool, Runtime, and Compiler Pipeline** itself (`src/`, `tests/`, `the_seed/`).

This skill is designed for engineering and extending the TOAD compiler, layout engine, and tooling suite.

---

## 🏛️ System Architecture & Codebase Map

When building or modifying TOAD features, consult the relevant components:

```
toad/
├── src/
│   ├── parser/
│   │   ├── lexer.ts               # Tokenization, keywords, symbols
│   │   ├── parser.ts              # Recursive descent parser & AST production
│   │   ├── ast.ts                 # TypeScript AST definitions & node interfaces
│   │   ├── math.ts                # Expression evaluation, units, layout math
│   │   ├── dependencyGraph.ts     # Topological sort & DAG dependency solver
│   │   └── importResolver.ts      # Component instantiation, slots, scope merging
│   ├── engine/
│   │   ├── canvasRenderer.ts      # Skia canvas drawing & composition pipeline
│   │   ├── drawUtils.ts           # Low-level drawing primitives, gradients, borders, shadows
│   │   ├── vectorPathParser.ts    # SVG path commands & parsing
│   │   ├── psdExporter.ts         # Native Photoshop PSD generation with ALI keys
│   │   ├── svgExporter.ts         # High-fidelity SVG vector serializer
│   │   ├── fontLoader.ts          # Custom font management & Skia typeface registration
│   │   ├── imageCache.ts          # Asset loading, caching, bitmap decoding
│   │   └── previewServer.ts       # SSE dev server, watcher, hot-reload protocol
│   ├── build.ts                   # Master compilation pipeline & orchestrator
│   ├── cli.ts                     # CLI commands (toad build, toad dev, toad lint, toad init)
│   └── index.ts                   # Public library exports
├── the_seed/                      # Architectural ground truth, formal EBNF, schemas, invariants
└── tests/                         # Vitest unit & integration test suites
```

---

## 🧠 Permanent Knowledge Base: `the_seed/`

The definitive ground truth for compiler internals and layout specifications:
- **Master Manifest**: [`the_seed/GEMINI_CORE.xml`](file:///c:/Users/flori/Downloads/toad/the_seed/GEMINI_CORE.xml)
- **Formal Grammar**: [`the_seed/grammar/toad.ebnf`](file:///c:/Users/flori/Downloads/toad/the_seed/grammar/toad.ebnf)
- **AST & Sizing Schema**: [`the_seed/schema/toad_ast.d.ts`](file:///c:/Users/flori/Downloads/toad/the_seed/schema/toad_ast.d.ts), [`the_seed/schema/properties_matrix.yaml`](file:///c:/Users/flori/Downloads/toad/the_seed/schema/properties_matrix.yaml)
- **Layout Math & DAG**: [`the_seed/layout/dag_solver_math.yaml`](file:///c:/Users/flori/Downloads/toad/the_seed/layout/dag_solver_math.yaml), [`the_seed/layout/flex_and_bento.yaml`](file:///c:/Users/flori/Downloads/toad/the_seed/layout/flex_and_bento.yaml)
- **Exporters & Prepress**: [`the_seed/exporters/skia_raster.yaml`](file:///c:/Users/flori/Downloads/toad/the_seed/exporters/skia_raster.yaml), [`the_seed/exporters/psd_layer_engine.yaml`](file:///c:/Users/flori/Downloads/toad/the_seed/exporters/psd_layer_engine.yaml), [`the_seed/exporters/svg_vector.yaml`](file:///c:/Users/flori/Downloads/toad/the_seed/exporters/svg_vector.yaml)

---

## 🛠️ Key Architectural Invariants & Pipelines

1. **Compiler Pipeline Stages** (`src/build.ts`):
   - Stage 1: Lexical Analysis & Tokenization (`src/parser/lexer.ts`)
   - Stage 2: AST Construction & Semantic Validation (`src/parser/parser.ts`)
   - Stage 3: Import Resolution, Component Inlining & Slot Projection (`src/parser/importResolver.ts`)
   - Stage 4: Layout DAG Construction & 4-Pass Coordinate Resolution (`src/parser/dependencyGraph.ts`, `src/parser/math.ts`)
   - Stage 5: Target Code Generation / Rendering (Skia Raster, SVG Vector, Photoshop PSD)

2. **Testing & Verification**:
   - Always run unit and integration tests after compiler modifications:
     ```bash
     npm test
     ```
   - Test individual components with `npx vitest run tests/<test-name>.test.ts`.

---

## Reference Manuals

* [Compiler Pipeline](./references/compiler_pipeline.md): Pipeline stages in `build.ts`
* [AST Specification](./references/ast_spec.md): AST interfaces, parsing behavior
* [Import Resolution](./references/import_resolution.md): Scope merging, slots, `@import`
* [Layout Engine](./references/layout_engine.md): 4-pass math sizing/auto-layout engine
* [Dependency Graph](./references/dependency_graph.md): Topological sort & DAG logic
* [Positioning Math](./references/positioning_math.md): Relational anchors (`right of`, `at: center`)
* [Skia Renderer](./references/skia_renderer.md): Canvas drawing & `drawUtils.ts` mappings
* [PSD Exporter](./references/psd_exporter.md): Photoshop layer generation & ALI keys
* [SVG Exporter](./references/svg_exporter.md): Vector graphic serialization
* [CLI Tooling](./references/cli_tooling.md): CLI arguments, `init`/`dev` commands
* [Preview Server](./references/preview_server.md): Server-Sent Events & dev server
* [Internals, Debugging & Pitfalls](./references/10_INTERNALS_DEBUGGING_AND_PITFALLS.md): Compiler pipeline deep-dive and anti-patterns
