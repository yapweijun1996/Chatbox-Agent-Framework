import type { Edge, GraphDefinition } from '../types';

function getEdgeTargets(edge: Edge): string[] {
    if (edge.type === 'parallel') {
        return edge.to;
    }

    return [edge.to];
}

export function validateGraphDefinition(graph: GraphDefinition): void {
    const nodeIds = graph.nodes.map(node => node.id);
    const uniqueIds = new Set(nodeIds);

    if (nodeIds.length !== uniqueIds.size) {
        throw new Error('GraphDefinition 节点 ID 必须唯一');
    }

    if (!uniqueIds.has(graph.entryNode)) {
        throw new Error(`GraphDefinition entryNode "${graph.entryNode}" 不存在`);
    }

    for (const edge of graph.edges) {
        if (!uniqueIds.has(edge.from)) {
            throw new Error(`GraphDefinition 边的起点节点 "${edge.from}" 不存在`);
        }

        if (edge.type === 'parallel') {
            if (!edge.to.length) {
                throw new Error(`GraphDefinition 并行边 "${edge.from}" 的目标节点为空`);
            }

            for (const target of edge.to) {
                if (!uniqueIds.has(target)) {
                    throw new Error(`GraphDefinition 并行边目标节点 "${target}" 不存在`);
                }
            }

            if (!uniqueIds.has(edge.join)) {
                throw new Error(`GraphDefinition 并行边 join 节点 "${edge.join}" 不存在`);
            }

            continue;
        }

        if (edge.type === 'conditional' && !('condition' in edge)) {
            throw new Error(`GraphDefinition 条件边 "${edge.from}" 缺少 condition`);
        }

        if ('condition' in edge && edge.condition && typeof edge.condition !== 'function') {
            throw new Error(`GraphDefinition 条件边 "${edge.from}" 的 condition 非函数`);
        }

        for (const target of getEdgeTargets(edge)) {
            if (!uniqueIds.has(target)) {
                throw new Error(`GraphDefinition 边的目标节点 "${target}" 不存在`);
            }
        }
    }
}
