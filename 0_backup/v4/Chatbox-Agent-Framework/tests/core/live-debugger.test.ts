import { describe, it, expect } from 'vitest';
import { EventStream } from '../../src/core/event-stream';
import type { GraphDefinition, Node } from '../../src/core/types';
import { LiveDebugger } from '../../src/core/live-debugger';

const createNode = (id: string): Node => ({
    id,
    name: id,
    execute: async (state) => ({ state, events: [] }),
});

describe('LiveDebugger', () => {
    it('should track node timeline and tool traces', () => {
        const eventStream = new EventStream();
        const graph: GraphDefinition = {
            nodes: [createNode('planner'), createNode('tool-runner')],
            edges: [{ from: 'planner', to: 'tool-runner' }],
            entryNode: 'planner',
            maxSteps: 5,
        };
        const debuggerInstance = new LiveDebugger(eventStream, graph);

        eventStream.emit('node_start', 'info', 'start planner', { nodeId: 'planner' });
        eventStream.emit('tool_call', 'info', 'call tool', {
            nodeId: 'tool-runner',
            metadata: { toolName: 'sql-query', stepId: 'step-1', input: { query: 'select 1' } },
        });
        eventStream.emit('tool_result', 'success', 'tool done', {
            nodeId: 'tool-runner',
            metadata: { toolName: 'sql-query', stepId: 'step-1' },
        });
        eventStream.emit('node_end', 'success', 'end planner', { nodeId: 'planner' });

        const timeline = debuggerInstance.getNodeTimeline();
        const toolTraces = debuggerInstance.getToolTraces();
        const mermaid = debuggerInstance.getMermaidDiagram();

        expect(timeline.length).toBeGreaterThan(0);
        expect(toolTraces.length).toBe(1);
        expect(mermaid).toContain('planner --> tool-runner');

        debuggerInstance.dispose();
    });
});
