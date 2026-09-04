# Toad AST Specification

The syntax analysis phase translates Toad DSL source code into an AST through tokenization and recursive-descent parsing.

## 1. Lexer (`lexer.ts`)
- **Single-Pass**: Tokenizes the raw input string, skipping whitespace and comments (both single `//` and block `/* */`).
- **Token Types**: Distinguishes keywords, standard directives (`@import`, `@font`), identifiers, variables (`>var`), hex colors, and numbers/dimensions (with complex unit tracking like `px`, `%`, `vw`).

## 2. Core AST Interfaces (`ast.ts`)
- **Base Node**: Every node extends `BaseNode` with a `type` string and a `loc` (`SourceLocation` with line, column, and offset for start and end).
- **Document Level**: 
  - `DocumentNode`: Contains arrays of `directives`, `variables`, `components`, `elements`, and `canvases`.
  - Diagnostics are kept on the AST for error tracking instead of immediately failing.
- **Declarations**: 
  - `ComponentDeclarationNode`: Has `parameters` (`ComponentParameterNode`), properties, and child elements.
  - `CanvasDeclarationNode`: Maintains global configurations (width, height, ratio, exports, etc.).
- **Elements**: 
  - All elements (`RectElementNode`, `TextElementNode`, `GroupElementNode`, etc.) extend `BaseElementNode`, storing an optional `id`, human-readable `name`, `properties`, and `children`.
- **Values & Properties**: 
  - `PropertyNode` holds a `name` and a `ValueNode`.
  - Values span literal nodes (`DimensionLiteralNode`, `ColorLiteralNode`), complex nodes (`LinearGradientNode`, `FilterValueNode`, `PointsValueNode`), and references (`VariableReferenceNode`, `ElementReferenceNode`).
  - Positional specifics use `RelationalPositionNode` (e.g. `relation: "right of"`, `target: "header"`).

## 3. Parser (`parser.ts`)
- **Recursive Descent**: Analyzes token streams sequentially. 
- **Error Recovery**: Uses panic-mode synchronization (`synchronizeStatement`) to continue parsing after hitting unexpected tokens, collecting multiple `Diagnostic` errors rather than aborting on the first syntax error.
- **Contextual Property Parsing**: Property values are parsed based on their property key (e.g. `parsePropertyValue` switches on `at`, `filter`, `scale`, `font` for specialized list/tuple handling).
