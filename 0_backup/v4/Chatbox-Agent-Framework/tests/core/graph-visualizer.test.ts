import { describe, it, expect } from 'vitest';
import type { GraphDefinition, Node } from '../../src/core/types';
import { toMermaid } from '../../src/core/graph-visualizer';

const createNode = (id: string): Node => ({
    id,
    name: id,
    execute: async (state) => ({ state, events: [] }),
});

describe('graph visualizer', () => {
    it('should render sequential edges', () => {
        const graph: GraphDefinition = {
            nodes: [createNode('a'), createNode('b')],
            edges: [{ from: 'a', to: 'b' }],
            entryNode: 'a',
            maxSteps: 3,
        };

        const output = toMermaid(graph);
        expect(output).toContain('a --> b');
    });

    it('should render conditional edges', () => {
        const graph: GraphDefinition = {
            nodes: [createNode('a'), createNode('b')],
            edges: [{ from: 'a', to: 'b', condition: () => true }],
            entryNode: 'a',
            maxSteps: 3,
        };

        const output = toMermaid(graph);
        expect(output).toContain('a -- condition --> b');
    });

    it('should render parallel edges with join', () => {
        const graph: GraphDefinition = {
            nodes: [createNode('a'), createNode('b'), createNode('c'), createNode('join')],
            edges: [{ from: 'a', to: ['b', 'c'], join: 'join', type: 'parallel' }],
            entryNode: 'a',
            maxSteps: 5,
        };

        const output = toMermaid(graph);
        expect(output).toContain('a --> b');
        expect(output).toContain('a --> c');
        expect(output).toContain('b & c --> join');
    });
});
