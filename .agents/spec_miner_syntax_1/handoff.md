# Handoff Report — Spec Miner Syntax & Grammar

**Agent**: `spec_miner_syntax_1`  
**Date**: 2026-08-18  
**Handoff Type**: Hard (Task Complete)  
**Deliverable Document**: `c:/Users/flori/Downloads/toad/.agents/spec_miner_syntax_1/analysis.md`  

---

## 1. Observation

1. **Original Request & Project Requirements (`ORIGINAL_REQUEST.md`)**:
   - Lines 27–39: Confirmed design rules requiring:
     - Component parameters with defaults (`component Arrow(size = 180px)`) and named arguments at call sites (`type: Arrow(size: 240px)`).
     - Inline `@font "path.ttf" as "Family";` and `@import` directives.
     - Element positioning fallback: top-level elements without `at:` default to `(0, 0)` with a compiler warning.
     - Filter syntax: space-separated property line (e.g. `filter: blur(4px) saturate(1.5);`).
     - Gradients with evenly distributed stop positions when offsets are omitted.
     - Image fit options: `fill`, `cover`, `contain`, `none`.
     - Uniform tile grid model: fixed columns, gap, auto flow.
   - Lines 42–50: Prescribed parser source layout:
     ```
     src/parser/
     ├── ast.ts               // Complete TypeScript AST definitions
     ├── lexer.ts             // Single-pass tokenizer
     ├── parser.ts            // Recursive-descent AST parser
     ├── importResolver.ts    // @import resolution, variable substitution, component expansion
     ├── math.ts              // Canvas dims (GCD ratio), bbox computation, currentColor, text measuring
     └── dependencyGraph.ts   // Topological sort for relational positioning, cycle detection
     ```
2. **Dispatch Assignment (`DISPATCH.md`)**:
   - Directs comprehensive specification analysis of the "TOAD" DSL grammar, token types, AST specifications, component definitions with default parameters, component instantiation with named arguments, import resolution, variable substitution, directives (`@import`, `@font`), and parser error handling.
3. **Workspace State**:
   - Initialized clean repository awaiting architecture synthesis and module implementation.

---

## 2. Logic Chain

1. **Lexical Token Formalization**:
   - Based on observations in `ORIGINAL_REQUEST.md` (Lines 28–39), the syntax requires unambiguous lexical distinctions between hex colors (`#ffffff`, `#fff`), element identifiers (`#header`, `#button`), variables (`$primary`), units (`px`, `%`, `deg`, `rad`, `em`, `pt`, `vw`, `vh`), directives (`@import`, `@font`), and filter/gradient keywords.
   - Rule established: tokens starting with `#` followed by 3, 4, 6, or 8 hex digits `[0-9a-fA-F]` are tokenized as `HEX_COLOR`; otherwise they are tokenized as `ELEMENT_ID`.
2. **Syntactic EBNF Production Rules**:
   - Declarative block structure maps cleanly to LL(1) recursive descent.
   - Component definitions require parameter list declarations `component Name(param = defaultVal)` and expansion semantics supporting both named arguments `Arrow(size: 240px)` and positional values.
   - Property definitions use identifier followed by colon and value expression terminated by semicolon.
3. **AST Hierarchy & Types (`ast.ts`)**:
   - Established strict discriminated union types for AST nodes (`BaseNode`, `DocumentNode`, `DirectiveNode`, `VariableDeclarationNode`, `ComponentDeclarationNode`, `ElementNode`, `PropertyNode`, `ValueNode`).
   - Defined `ResolvedDocumentNode` representing the normalized post-import, post-expansion tree consumed by `math.ts` and `dependencyGraph.ts`.
4. **Parser & Error Recovery Strategy**:
   - Designed panic-mode error recovery synchronizing on semicolons (`;`) for properties and closing braces (`}`) for element blocks, collecting structured diagnostics rather than crashing on single syntax errors.
5. **Import Resolution & Component Expansion Mechanics**:
   - Multi-file loading uses DFS with a recursion stack to detect and report cyclic imports (`A -> B -> A`).
   - Scoping hierarchy: Global variables < Imported variables < Component parameter scope.
   - Component expansion clones element sub-trees, substitutes `$param` variables, and applies instance ID mangling to prevent duplicate ID collisions in relational positioning graphs.

---

## 3. Caveats

1. **Layout & Coordinate Math Hand-off**:
   - Detailed geometric bounding box algorithms, Skia text measurement calculations, and topological sorting algorithms are delegated to `spec_miner_layout_1` (`src/parser/math.ts` and `src/parser/dependencyGraph.ts`).
2. **Runtime Canvas & PSD Execution Hand-off**:
   - Canvas rasterization and PSD layer structure generation are delegated to `explorer_engine_1` (`src/engine/`).

---

## 4. Conclusion

The DSL grammar, token definitions, complete TypeScript AST interfaces (`ast.ts`), recursive descent parser mechanics, and import/component resolution specifications are fully formalized, documented, and published in `c:/Users/flori/Downloads/toad/.agents/spec_miner_syntax_1/analysis.md`. The design is completely self-consistent, production-ready, and immediately actionable for implementation in Milestone M1.

---

## 5. Verification Method

1. **Inspect Specification Document**:
   - View `c:/Users/flori/Downloads/toad/.agents/spec_miner_syntax_1/analysis.md` to review the complete TypeScript AST node definitions (Section 4), EBNF grammar (Section 3), token definitions (Section 2), resolver rules (Section 6), Feature Inventory (Section 7), and Edge Cases Matrix (Section 8).
2. **Implementation Conformance**:
   - During M1 implementation, verify that `src/parser/ast.ts`, `src/parser/lexer.ts`, `src/parser/parser.ts`, and `src/parser/importResolver.ts` strictly conform to the interfaces and algorithms specified in `analysis.md`.
3. **Test Suite Invalidation / Pass Condition**:
   - Run `npx vitest run tests/lexer.test.ts tests/parser.test.ts tests/importResolver.test.ts` to confirm 100% test pass on all lexical, parsing, import resolution, and component expansion test cases.
