import type { Event, EventStream, GraphDefinition } from './types';
import { toMermaidWithState } from './graph-visualizer';

export interface NodeTimelineEntry {
    nodeId: string;
    startTime: number;
    endTime?: number;
    durationMs?: number;
    status?: Event['status'];
}

export interface ToolTraceEntry {
    toolName: string;
    stepId?: string;
    input?: unknown;
    output?: unknown;
    error?: string;
    startTime: number;
    endTime?: number;
    durationMs?: number;
    status?: Event['status'];
}

export class LiveDebugger {
    private nodeTimeline: NodeTimelineEntry[] = [];
    private toolTraces: ToolTraceEntry[] = [];
    private visitedNodes: string[] = [];
    private activeNodeId?: string;
    private unsubscribe?: () => void;

    constructor(
        private readonly eventStream: EventStream,
        private readonly graph?: GraphDefinition
    ) {
        this.unsubscribe = this.eventStream.on('*', event => this.handleEvent(event));
    }

    dispose(): void {
        this.unsubscribe?.();
    }

    getNodeTimeline(): NodeTimelineEntry[] {
        return [...this.nodeTimeline];
    }

    getToolTraces(): ToolTraceEntry[] {
        return [...this.toolTraces];
    }

    getActiveNodeId(): string | undefined {
        return this.activeNodeId;
    }

    getVisitedNodes(): string[] {
        return [...this.visitedNodes];
    }

    getMermaidDiagram(): string | undefined {
        if (!this.graph) return undefined;
        return toMermaidWithState(this.graph, {
            activeNodeId: this.activeNodeId,
            visitedNodes: this.visitedNodes,
        });
    }

    private handleEvent(event: Event): void {
        if (event.type === 'node_start' && event.nodeId) {
            this.activeNodeId = event.nodeId;
            if (!this.visitedNodes.includes(event.nodeId)) {
                this.visitedNodes.push(event.nodeId);
            }
            this.nodeTimeline.push({
                nodeId: event.nodeId,
                startTime: event.timestamp,
                status: event.status,
            });
        }

        if (event.type === 'node_end' && event.nodeId) {
            const entry = [...this.nodeTimeline]
                .reverse()
                .find(item => item.nodeId === event.nodeId && item.endTime === undefined);
            if (entry) {
                entry.endTime = event.timestamp;
                entry.durationMs = event.timestamp - entry.startTime;
                entry.status = event.status;
            }
            this.activeNodeId = undefined;
        }

        if (event.type === 'tool_call') {
            const metadata = event.metadata as { toolName?: string; stepId?: string; input?: unknown } | undefined;
            if (metadata?.toolName) {
                this.toolTraces.push({
                    toolName: metadata.toolName,
                    stepId: metadata.stepId,
                    input: metadata.input,
                    startTime: event.timestamp,
                    status: event.status,
                });
            }
        }

        if (event.type === 'tool_result') {
            const metadata = event.metadata as { toolName?: string; stepId?: string; error?: string } | undefined;
            if (metadata?.toolName) {
                const entry = [...this.toolTraces]
                    .reverse()
                    .find(item => item.toolName === metadata.toolName
                        && (metadata.stepId ? item.stepId === metadata.stepId : true)
                        && item.endTime === undefined);
                if (entry) {
                    entry.endTime = event.timestamp;
                    entry.durationMs = event.timestamp - entry.startTime;
                    entry.status = event.status;
                    entry.error = metadata.error;
                }
            }
        }
    }
}
