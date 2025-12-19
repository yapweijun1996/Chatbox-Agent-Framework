import type { GraphDefinition, State } from '../types';

export function resolveNextNode(
    graph: GraphDefinition,
    currentNodeId: string,
    state: State,
    explicitNext?: string
): string | null {
    if (explicitNext) {
        return explicitNext;
    }

    const edges = graph.edges.filter(e => e.from === currentNodeId);

    for (const edge of edges) {
        if (edge.condition) {
            if (edge.condition(state)) {
                return edge.to;
            }
        } else {
            return edge.to;
        }
    }

    return null;
}
