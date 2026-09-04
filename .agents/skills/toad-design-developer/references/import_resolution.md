# Toad Import & Component Resolution

The resolution phase (`src/parser/importResolver.ts`) flattens multi-file projects, merges variable scopes, and expands component templates into a unified `ResolvedDocumentNode`.

## 1. Import Handling
- **Recursive Traversal**: `loadImportsRecursive` follows `@import` directives using a `fileLoader` (defaulting to `node:fs`).
- **Circular Imports**: Tolerates two-file mutual imports but throws `CircularImportError` when an import cycle depth reaches 3.
- **Aggregation**: Fonts and components from all imported documents are hoisted and aggregated globally.

## 2. Variable Scope & Merging
- **Global Flattening**: All variable declarations are collected into a flat map. Object literals are dot-notated (e.g. `>theme.colors.primary`).
- **Shadowing**: Later documents and imports override earlier variables of the same name.
- **Resolution**: `resolveAllVariables` iteratively substitutes variables. Recursion loops are caught, throwing `CircularVariableError`. It traverses inside nested complex nodes (`FilterValue`, `CalcValue`, `ColorTransform`) to insert absolute values.
- **Color Transforms**: Handles `alpha`, `lighten`, and `darken` dynamic variable color modifications.

## 3. Component Expansion
- **Instantiation**: When encountering a `ComponentInstanceNode`, `expandComponentInstance` fetches the matching `ComponentDeclarationNode`.
- **Parameter Binding**: Creates a local variable scope. Binds positional arguments first, then named arguments/properties, falling back to default parameter values. Missing required arguments trigger errors.
- **Slot Projections**: 
  - If a component instance passes children elements, they are captured as `slotChildren`.
  - Inside the component body expansion, any `SlotElementNode` is replaced entirely by the evaluated `slotChildren`.
- **Prefix Namespacing**: Expanded element IDs are prefixed with the instance ID to prevent ID collisions from multiple instances of the same component.
- **Recursion Limits**: Enforces a `maxComponentDepth` (default 32) throwing `ComponentRecursionLimitError` to prevent infinite macro expansion.

## 4. Canvas Resolution
- Uses `resolveSingleCanvas` to evaluate variables mapped onto canvas properties.
- Computes final dimensions intelligently: if a predefined `preset` or aspect `ratio` is given alongside a target density/resolution string (e.g., `4k`, `1080p`), it computes the exact explicit pixel width and height without requiring manual input.
