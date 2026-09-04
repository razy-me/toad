import { describe, it, expect } from 'vitest';
import { DependencyGraph, CyclicDependencyError } from '../../src/parser/dependencyGraph.js';

function makeNode(id: string, targetId?: string): any {
  return {
    type: 'RectElement',
    id,
    at: targetId ? { relational: { targetId, relation: 'below' } } : undefined
  };
}

describe('Unit Tests: Dependency Graph & 3-Color DFS Topological Sort', () => {
  it('handles empty graph returning empty order', () => {
    const graph = new DependencyGraph();
    const sorted = graph.resolveOrder();
    expect(sorted).toEqual([]);
  });

  it('handles single isolated node', () => {
    const graph = new DependencyGraph();
    graph.addElement(makeNode('box'));
    const sorted = graph.resolveOrder();
    expect(sorted.map(n => n.id)).toEqual(['box']);
  });

  it('sorts linear dependency chain in topological order', () => {
    const graph = new DependencyGraph();
    // D depends on C, C depends on B, B depends on A
    graph.addElement(makeNode('A'));
    graph.addElement(makeNode('B', 'A'));
    graph.addElement(makeNode('C', 'B'));
    graph.addElement(makeNode('D', 'C'));

    const sorted = graph.resolveOrder();
    expect(sorted.map(n => n.id)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('sorts diamond DAG structure correctly', () => {
    const graph = new DependencyGraph();
    // B depends on A, C depends on A, D depends on B
    graph.addElement(makeNode('A'));
    graph.addElement(makeNode('B', 'A'));
    graph.addElement(makeNode('C', 'A'));
    graph.addElement(makeNode('D', 'B'));

    const sorted = graph.resolveOrder();
    const ids = sorted.map(n => n.id);
    expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('B'));
    expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('C'));
    expect(ids.indexOf('B')).toBeLessThan(ids.indexOf('D'));
  });

  it('detects direct self-cycle (A -> A) and throws CyclicDependencyError', () => {
    const graph = new DependencyGraph();
    graph.addElement(makeNode('A', 'A'));

    expect(() => graph.resolveOrder()).toThrow(CyclicDependencyError);
    try {
      graph.resolveOrder();
    } catch (err: any) {
      expect(err.message).toContain('Cyclic layout dependency');
    }
  });

  it('detects two-node mutual cycle (A -> B -> A)', () => {
    const graph = new DependencyGraph();
    graph.addElement(makeNode('A', 'B'));
    graph.addElement(makeNode('B', 'A'));

    expect(() => graph.resolveOrder()).toThrow(CyclicDependencyError);
  });

  it('detects three-node transitive cycle (A -> B -> C -> A)', () => {
    const graph = new DependencyGraph();
    graph.addElement(makeNode('A', 'B'));
    graph.addElement(makeNode('B', 'C'));
    graph.addElement(makeNode('C', 'A'));

    expect(() => graph.resolveOrder()).toThrow(CyclicDependencyError);
  });

  it('handles multiple disconnected components without cycles', () => {
    const graph = new DependencyGraph();
    // Component 1: A -> B
    graph.addElement(makeNode('A'));
    graph.addElement(makeNode('B', 'A'));
    // Component 2: X -> Y -> Z
    graph.addElement(makeNode('X'));
    graph.addElement(makeNode('Y', 'X'));
    graph.addElement(makeNode('Z', 'Y'));

    const sorted = graph.resolveOrder();
    const ids = sorted.map(n => n.id);
    expect(ids).toHaveLength(5);
    expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('B'));
    expect(ids.indexOf('X')).toBeLessThan(ids.indexOf('Y'));
    expect(ids.indexOf('Y')).toBeLessThan(ids.indexOf('Z'));
  });
});
