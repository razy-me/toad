# Dependency Graph: Topological Sorting & Cycle Detection

The dependency graph (`src/parser/dependencyGraph.ts`) orchestrates relational dependencies for the layout engine.

## Graph Construction
Elements are added to the graph via `addElement`. A synthetic ID is assigned if one doesn't exist. Relational dependencies are extracted from the `at.relational.targetId` field.
The special target `'previous'` resolves to the ID of the immediately preceding sibling in document order. Targets `'canvas'` and `'parent'` are ignored as they represent spatial bounds, not layout dependencies on sibling elements.

## Cycle Detection (3-Color DFS)
Topological sorting uses a classic 3-color Depth-First Search algorithm:
- `WHITE` (0): Unvisited
- `GRAY` (1): Visiting (currently on the recursion stack)
- `BLACK` (2): Fully visited

If the DFS encounters a `GRAY` node, a cyclic dependency exists (e.g., Node A depends on B, which depends on A). The cycle path is extracted from the recursion stack and thrown as a `CyclicDependencyError`.
If successful, the topological sort returns the layout elements ordered such that every element is processed only after the elements it depends on are processed.
