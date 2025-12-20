import { describe, it, expect } from 'vitest';
import type { GraphDefinition, Node, NodeResult, State } from '../../src/core/types';
import { GraphRunner } from '../../src/core/runner';
import { createState, updateState } from '../../src/core/state';

function createNode(id: string, updater?: (state: State) => State): Node {
    return {
        id,
        name: id,
        execute: async (state): Promise<NodeResult> => {
            const nextState = updater ? updater(state) : state;
            return {
                state: nextState,
                events: [],
            };
        },
    };
}

describe('GraphRunner', () => {
    it('validates entry node existence', () => {
        const node = createNode('start');
        const graph: GraphDefinition = {
            nodes: [node],
            edges: [],
            entryNode: 'missing',
            maxSteps: 3,
        };

        expect(() => new GraphRunner(graph)).toThrow(/entryNode/);
    });

    it('executes parallel edges with deterministic merge order', async () => {
        const start = createNode('start');
        const nodeA = createNode('a', state => updateState(state, draft => {
            draft.conversation.messages.push({
                role: 'assistant',
                content: 'A',
                timestamp: 0,
            });
            draft.telemetry.tokenCount += 1;
        }));
        const nodeB = createNode('b', state => updateState(state, draft => {
            draft.conversation.messages.push({
                role: 'assistant',
                content: 'B',
                timestamp: 0,
            });
            draft.telemetry.tokenCount += 2;
        }));
        const join = createNode('join');

        const graph: GraphDefinition = {
            nodes: [start, nodeA, nodeB, join],
            edges: [
                { from: 'start', to: ['a', 'b'], join: 'join', type: 'parallel' },
            ],
            entryNode: 'start',
            maxSteps: 5,
            parallelMerge: { order: 'defined' },
        };

        const runner = new GraphRunner(graph);
        const result = await runner.execute(createState('goal'));

        expect(result.state.conversation.messages.map(message => message.content)).toEqual(['A', 'B']);
        expect(result.state.telemetry.tokenCount).toBe(3);
    });

    it('defaults conditional errors to false and continues evaluation order', async () => {
        const start = createNode('start');
        const fallback = createNode('fallback', state => updateState(state, draft => {
            draft.conversation.messages.push({
                role: 'assistant',
                content: 'fallback',
                timestamp: 0,
            });
        }));
        const skipped = createNode('should-not-run');

        const graph: GraphDefinition = {
            nodes: [start, fallback, skipped],
            edges: [
                {
                    from: 'start',
                    to: 'should-not-run',
                    condition: () => {
                        throw new Error('condition failure');
                    },
                },
                { from: 'start', to: 'fallback' },
            ],
            entryNode: 'start',
            maxSteps: 3,
        };

        const runner = new GraphRunner(graph);
        const result = await runner.execute(createState('goal'));

        expect(result.state.conversation.messages.map(message => message.content)).toEqual(['fallback']);
    });

    it('throws when conditional error strategy is set to throw', async () => {
        const start = createNode('start');
        const missing = createNode('missing');
        const graph: GraphDefinition = {
            nodes: [start, missing],
            edges: [
                {
                    from: 'start',
                    to: 'missing',
                    condition: () => {
                        throw new Error('condition failure');
                    },
                },
            ],
            entryNode: 'start',
            maxSteps: 2,
            conditionErrorStrategy: 'throw',
        };

        const runner = new GraphRunner(graph);

        await expect(runner.execute(createState('goal'))).rejects.toThrow('condition failure');
    });
});
