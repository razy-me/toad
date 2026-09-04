# Layout Engine: The 4-Pass Pipeline

The layout engine in `toad` (`src/parser/math.ts`) uses a 4-pass pipeline to resolve the static document into positioned, renderable nodes:

## Pass 1: Static currentColor Cascade
Iterates through all elements recursively to cascade the `currentColor` value down the tree, replacing `'currentColor'` references in fills, strokes, and gradient stops with the inherited color.

## Pass 2: Dependency Graph & Topological Sorting
To support relational positioning (`right of`, `below`), elements must be processed in dependency order, not document order. The engine builds a DAG using `DependencyGraph` and performs a topological sort. Nodes reference their targets, and an ordered list of elements is produced.

## Pass 3: Dimension & Position Resolution
The `resolveElementLayout` function computes layout boxes (`x, y, w, h`) for all elements in topological order:
- **Sizing:** Intrinsic sizes are computed first (e.g., measuring text with Skia). Explicit widths/heights override them. Percentages and dimensions are resolved relative to parent containers.
- **Auto-layout (Stacks & Grids):** Stacks use a 2-pass flex layout algorithm to distribute space among 'fill' children along the main/cross axes. Grids compute a matrix of tiles using column definitions and gaps.
- **Bounding Box Logic (AABB):** If a container lacks explicit size, it hugs its children's bounding boxes.
- **Margins:** Applied to the calculated X/Y and optionally subtracted from width/height if set to 'fill' or '100%'.

## Pass 4: Layout Tree Node Construction
Converts AST `ResolvedElementNode` objects into `LayoutNode` objects, recursively structuring containers, applying z-index sorting, and linking mask nodes.
