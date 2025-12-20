import type { Edge, GraphDefinition, Node } from './types';

export type GraphTemplateName = 'light' | 'standard' | 'strict';

export interface GraphTemplateSettings {
    confirmationAutoApprove: boolean;
    includePlanAndExecuteEdge: boolean;
    conditionErrorStrategy?: GraphDefinition['conditionErrorStrategy'];
}

export function getGraphTemplateSettings(template: GraphTemplateName): GraphTemplateSettings {
    switch (template) {
        case 'light':
            return {
                confirmationAutoApprove: true,
                includePlanAndExecuteEdge: false,
                conditionErrorStrategy: 'false',
            };
        case 'strict':
            return {
                confirmationAutoApprove: false,
                includePlanAndExecuteEdge: true,
                conditionErrorStrategy: 'throw',
            };
        default:
            return {
                confirmationAutoApprove: true,
                includePlanAndExecuteEdge: true,
                conditionErrorStrategy: 'false',
            };
    }
}

export function buildGraphDefinition(
    template: GraphTemplateName,
    nodes: Node[],
    options: {
        maxSteps: number;
        includeMemory: boolean;
    }
): GraphDefinition {
    const settings = getGraphTemplateSettings(template);
    const edges: Edge[] = [
        { from: 'planner', to: 'tool-runner' },
        {
            from: 'tool-runner',
            to: 'confirmation',
            condition: (s) => s.task.pendingToolCall?.status === 'pending',
        },
        { from: 'tool-runner', to: 'verifier' },
        { from: 'confirmation', to: 'tool-runner' },
        { from: 'verifier', to: 'responder', condition: (s) => s.task.currentStepIndex >= s.task.steps.length },
    ];

    if (settings.includePlanAndExecuteEdge) {
        edges.push({
            from: 'verifier',
            to: 'planner',
            condition: (s) => s.policy.planAndExecute === true && s.task.currentStepIndex < s.task.steps.length,
        });
    }

    edges.push({
        from: 'verifier',
        to: 'tool-runner',
        condition: (s) => s.task.currentStepIndex < s.task.steps.length,
    });

    if (options.includeMemory) {
        edges.push({ from: 'responder', to: 'memory' });
    }

    return {
        nodes,
        edges,
        entryNode: 'planner',
        maxSteps: options.maxSteps,
        conditionErrorStrategy: settings.conditionErrorStrategy,
    };
}
