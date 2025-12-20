import type { ChatOptions, AgentResult } from './agent';
import type { AgentClient, AgentDescriptor } from './multi-agent';

export interface AgentHandoff {
    fromAgentId?: string;
    toAgentId: string;
    reason?: string;
    payload?: {
        summary?: string;
        context?: Record<string, unknown>;
    };
}

export interface AgentProtocolMessage {
    id: string;
    type: 'message' | 'handoff' | 'result';
    from?: string;
    to?: string;
    payload: unknown;
    timestamp: number;
}

export interface AgentCoordinatorOptions {
    defaultAgentId?: string;
    allowParallel?: boolean;
}

export class AgentCoordinator {
    private agents: Map<string, AgentDescriptor> = new Map();
    private defaultAgentId?: string;
    private allowParallel: boolean;
    private transcript: AgentProtocolMessage[] = [];

    constructor(options?: AgentCoordinatorOptions) {
        this.defaultAgentId = options?.defaultAgentId;
        this.allowParallel = options?.allowParallel ?? true;
    }

    registerAgent(agent: AgentDescriptor): void {
        if (this.agents.has(agent.id)) {
            throw new Error(`Agent "${agent.id}" already registered.`);
        }
        this.agents.set(agent.id, agent);
    }

    listAgents(): AgentDescriptor[] {
        return Array.from(this.agents.values());
    }

    getTranscript(): AgentProtocolMessage[] {
        return [...this.transcript];
    }

    async sendMessage(agentId: string, message: string, options?: ChatOptions): Promise<AgentResult> {
        const agent = this.getAgent(agentId);
        this.record({ type: 'message', from: 'user', to: agentId, payload: { message } });
        const result = await agent.chat(message, options);
        this.record({ type: 'result', from: agentId, to: 'user', payload: result });
        return result;
    }

    async handoff(handoff: AgentHandoff, options?: ChatOptions): Promise<AgentResult> {
        const from = handoff.fromAgentId ?? 'unknown';
        const to = handoff.toAgentId;
        this.record({ type: 'handoff', from, to, payload: handoff });
        const agent = this.getAgent(to);
        const message = this.formatHandoffMessage(handoff);
        const result = await agent.chat(message, options);
        this.record({ type: 'result', from: to, to: from, payload: result });
        return result;
    }

    async broadcast(message: string, options?: ChatOptions): Promise<Record<string, AgentResult>> {
        const tasks = this.listAgents().map(agent => async () => {
            const result = await agent.agent.chat(message, options);
            this.record({ type: 'result', from: agent.id, to: 'broadcast', payload: result });
            return [agent.id, result] as const;
        });

        if (!this.allowParallel) {
            const results: Array<readonly [string, AgentResult]> = [];
            for (const task of tasks) {
                results.push(await task());
            }
            return Object.fromEntries(results);
        }

        const results = await Promise.all(tasks.map(task => task()));
        return Object.fromEntries(results);
    }

    private getAgent(agentId: string): AgentClient {
        const agent = this.agents.get(agentId);
        if (!agent) {
            const fallback = this.defaultAgentId ? this.agents.get(this.defaultAgentId) : undefined;
            if (!fallback) {
                throw new Error(`Agent "${agentId}" not found.`);
            }
            return fallback.agent;
        }
        return agent.agent;
    }

    private formatHandoffMessage(handoff: AgentHandoff): string {
        const parts = [
            `Handoff from ${handoff.fromAgentId ?? 'unknown'}`,
            handoff.reason ? `Reason: ${handoff.reason}` : undefined,
            handoff.payload?.summary ? `Summary: ${handoff.payload.summary}` : undefined,
            handoff.payload?.context ? `Context: ${JSON.stringify(handoff.payload.context)}` : undefined,
        ].filter(Boolean);
        return parts.join('\n');
    }

    private record(entry: Omit<AgentProtocolMessage, 'id' | 'timestamp'>): void {
        this.transcript.push({
            ...entry,
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
        });
    }
}
