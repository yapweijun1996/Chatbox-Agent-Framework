import type { GraphDefinition, State } from '../types';

export type NextTransition =
    | { type: 'single'; nodeId: string }
    | { type: 'parallel'; nodeIds: string[]; join: string };

export function resolveNextNode(
    graph: GraphDefinition,
    currentNodeId: string,
    state: State,
    explicitNext?: string
): NextTransition | null {
    if (explicitNext) {
        return { type: 'single', nodeId: explicitNext };
    }

    const edges = graph.edges.filter(e => e.from === currentNodeId);

    for (const edge of edges) {
        if (edge.type === 'parallel') {
            return { type: 'parallel', nodeIds: edge.to, join: edge.join };
        }

        if ('condition' in edge && edge.condition) {
            try {
                if (edge.condition(state)) {
                    return { type: 'single', nodeId: edge.to };
                }
            } catch (error) {
                if (graph.conditionErrorStrategy === 'throw') {
                    throw error;
                }
            }
        } else {
            return { type: 'single', nodeId: edge.to };
        }
    }

    return null;
}
