import type { Edge, GraphDefinition } from './types';

function formatEdge(edge: Edge): string[] {
    if (edge.type === 'parallel') {
        const lines = edge.to.map(target => `  ${edge.from} --> ${target}`);
        lines.push(`  ${edge.to.join(' & ')} --> ${edge.join}`);
        return lines;
    }

    if ('condition' in edge && edge.condition) {
        return [`  ${edge.from} -- condition --> ${edge.to}`];
    }

    return [`  ${edge.from} --> ${edge.to}`];
}

export function toMermaid(graph: GraphDefinition): string {
    return toMermaidWithState(graph);
}

export function toMermaidWithState(
    graph: GraphDefinition,
    options?: {
        activeNodeId?: string;
        visitedNodes?: string[];
    }
): string {
    const lines: string[] = ['flowchart TD'];

    for (const edge of graph.edges) {
        lines.push(...formatEdge(edge));
    }

    if (options?.visitedNodes?.length) {
        lines.push('  classDef visited fill:#e6f4ff,stroke:#1e6db6,stroke-width:1px');
        lines.push(`  class ${options.visitedNodes.join(' ')} visited`);
    }

    if (options?.activeNodeId) {
        lines.push('  classDef active fill:#fff2cc,stroke:#b38600,stroke-width:2px');
        lines.push(`  class ${options.activeNodeId} active`);
    }

    return lines.join('\n');
}
