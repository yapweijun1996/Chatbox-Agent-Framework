export function resolveNextNode(graph, currentNodeId, state, explicitNext) {
    if (explicitNext) {
        return explicitNext;
    }
    const edges = graph.edges.filter(e => e.from === currentNodeId);
    for (const edge of edges) {
        if (edge.condition) {
            if (edge.condition(state)) {
                return edge.to;
            }
        }
        else {
            return edge.to;
        }
    }
    return null;
}
//# sourceMappingURL=next-node-resolver.js.map