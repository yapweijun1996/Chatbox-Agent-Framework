import type { Edge, EdgeCondition, GraphDefinition, ParallelEdge, Node } from './types';

export interface GraphConfig {
    nodes: string[];
    edges: GraphConfigEdge[];
    entryNode: string;
    maxSteps: number;
    conditionErrorStrategy?: GraphDefinition['conditionErrorStrategy'];
    parallelMerge?: GraphDefinition['parallelMerge'];
}

export type GraphConditionRegistry = Record<string, EdgeCondition>;

export type GraphConfigEdge =
    | GraphConfigSequentialEdge
    | GraphConfigConditionalEdge
    | GraphConfigParallelEdge;

export interface GraphConfigSequentialEdge {
    from: string;
    to: string;
    type?: 'sequential';
}

export interface GraphConfigConditionalEdge {
    from: string;
    to: string;
    type?: 'conditional';
    condition: string;
}

export interface GraphConfigParallelEdge {
    from: string;
    to: string[];
    join: string;
    type: 'parallel';
}

export const defaultGraphConditions: GraphConditionRegistry = {
    pending_tool_confirmation: (state) => state.task.pendingToolCall?.status === 'pending',
    steps_complete: (state) => state.task.currentStepIndex >= state.task.steps.length,
    steps_remaining: (state) => state.task.currentStepIndex < state.task.steps.length,
    plan_and_execute: (state) => state.policy.planAndExecute === true
        && state.task.currentStepIndex < state.task.steps.length,
};

export function buildGraphDefinitionFromConfig(
    config: GraphConfig,
    nodesById: Map<string, Node>,
    conditions: GraphConditionRegistry
): GraphDefinition {
    const nodes: Node[] = config.nodes.map(nodeId => {
        const node = nodesById.get(nodeId);
        if (!node) {
            throw new Error(`GraphConfig 节点 "${nodeId}" 不存在`);
        }
        return node;
    });

    const edges: Edge[] = config.edges.map(edge => {
        if (edge.type === 'parallel') {
            return {
                from: edge.from,
                to: edge.to,
                join: edge.join,
                type: 'parallel',
            } satisfies ParallelEdge;
        }

        if ('condition' in edge) {
            const condition = conditions[edge.condition];
            if (!condition) {
                throw new Error(`GraphConfig 条件 "${edge.condition}" 未注册`);
            }
            return {
                from: edge.from,
                to: edge.to,
                condition,
                type: 'conditional',
            };
        }

        return {
            from: edge.from,
            to: edge.to,
            type: 'sequential',
        };
    });

    return {
        nodes,
        edges,
        entryNode: config.entryNode,
        maxSteps: config.maxSteps,
        conditionErrorStrategy: config.conditionErrorStrategy,
        parallelMerge: config.parallelMerge,
    };
}
