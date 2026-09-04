/**
 * src/parser/dependencyGraph.ts
 * Relational positioning DAG, 3-color DFS cycle detection, and topological layout sorting.
 */

import { ResolvedElementNode } from './ast.js';

export enum VisitState {
  WHITE = 0, // Unvisited
  GRAY = 1,  // Visiting (on current recursion stack)
  BLACK = 2  // Fully visited
}

export interface DependencyNode {
  id: string;
  element: ResolvedElementNode;
  dependencies: string[];
}

export class CyclicDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CyclicDependencyError';
  }
}

export class DependencyGraph {
  private nodes = new Map<string, DependencyNode>();
  private syntheticIdCounter = 0;
  public warnings: string[] = [];

  public addElement(element: ResolvedElementNode, prevSiblingId?: string, parentId?: string): void {
    const id = element.id || `__auto_${++this.syntheticIdCounter}`;
    element.id = id;

    if (this.nodes.has(id)) {
      this.warnings.push(
        `Duplicate element id '#${id}' detected; the later definition overwrites the earlier one.`
      );
    }

    const dependencies: string[] = [];
    if (element.at && element.at.relational && element.at.relational.targetId) {
      const target = element.at.relational.targetId;
      if (target === 'previous') {
        // 'previous' resolves to the immediately preceding sibling within the
        // same parent (document order).
        if (prevSiblingId) {
          dependencies.push(prevSiblingId);
          // Rewrite the stored anchor so the layout solver resolves against
          // the real element id.
          element.at.relational.targetId = prevSiblingId;
        } else {
          this.warnings.push(
            `Element '#${id}' anchors to 'previous' but has no previous sibling. Defaulting to (0, 0).`
          );
          // Clear relational anchor to prevent duplicate missing anchor warning in math solver
          element.at.relational = undefined;
        }
      } else if (target === 'parent') {
        if (parentId) {
          dependencies.push(parentId);
        }
      } else if (target !== 'canvas') {
        dependencies.push(target);
      }
    } else if (parentId) {
      // Child elements without an explicit relational target depend on their container
      dependencies.push(parentId);
    }

    this.nodes.set(id, {
      id,
      element,
      dependencies
    });

    // Recursively add child nodes if group, threading each child's previous
    // sibling and container id so anchors resolve inside containers as well.
    if (element.children && element.children.length > 0) {
      let prev: string | undefined;
      for (const child of element.children) {
        this.addElement(child, prev, id);
        prev = child.id;
      }
    }
  }

  public resolveOrder(): ResolvedElementNode[] {
    const state = new Map<string, VisitState>();
    const order: ResolvedElementNode[] = [];
    const recursionStack: string[] = [];

    for (const id of this.nodes.keys()) {
      state.set(id, VisitState.WHITE);
    }

    const visit = (id: string) => {
      const currentState = state.get(id);
      if (currentState === VisitState.GRAY) {
        const cycleStartIndex = recursionStack.indexOf(id);
        const cycle = [...recursionStack.slice(cycleStartIndex), id].map(s => `#${s}`).join(' -> ');
        throw new CyclicDependencyError(`Cyclic layout dependency cycle detected: ${cycle}`);
      }
      if (currentState === VisitState.BLACK) {
        return;
      }

      state.set(id, VisitState.GRAY);
      recursionStack.push(id);

      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependencies) {
          if (this.nodes.has(depId)) {
            visit(depId);
          } else {
            this.warnings.push(
              `Relational dependency '#${depId}' not found for element '#${id}'. Defaulting to (0, 0).`
            );
          }
        }
      }

      recursionStack.pop();
      state.set(id, VisitState.BLACK);
      if (node) {
        order.push(node.element);
      }
    };

    for (const id of this.nodes.keys()) {
      if (state.get(id) === VisitState.WHITE) {
        visit(id);
      }
    }

    return order;
  }
}

export function buildDependencyGraph(elements: ResolvedElementNode[]): DependencyGraph {
  const graph = new DependencyGraph();
  for (const elem of elements) {
    graph.addElement(elem);
  }
  return graph;
}

export function topologicalSort(graphOrElements: DependencyGraph | ResolvedElementNode[]): ResolvedElementNode[] {
  if (Array.isArray(graphOrElements)) {
    const graph = buildDependencyGraph(graphOrElements);
    return graph.resolveOrder();
  }
  return graphOrElements.resolveOrder();
}

