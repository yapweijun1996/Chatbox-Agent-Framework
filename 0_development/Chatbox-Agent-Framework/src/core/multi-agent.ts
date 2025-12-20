/**
 * Multi-agent orchestration utilities.
 */

import type { AgentResult, ChatOptions } from './agent';
import type { LLMProvider, ChatMessage } from './llm-provider';

export interface AgentClient {
    chat(message: string, options?: ChatOptions): Promise<AgentResult>;
}

export interface AgentDescriptor {
    id: string;
    agent: AgentClient;
    description?: string;
    keywords?: string[];
}

export interface MultiAgentRouterContext {
    message: string;
    agents: AgentDescriptor[];
}

export interface MultiAgentDecision {
    agentId: string;
    reason?: string;
    load?: number;
}

export interface MultiAgentRouter {
    route(context: MultiAgentRouterContext): Promise<MultiAgentDecision>;
}

export interface MultiAgentTask {
    message: string;
    agentId?: string;
    options?: ChatOptions;
}

export interface MultiAgentTaskResult {
    agentId: string;
    message: string;
    result?: AgentResult;
    error?: string;
}

export interface TaskDecomposer {
    decompose(message: string, context: MultiAgentRouterContext): Promise<string[]>;
}

export class RuleBasedTaskDecomposer implements TaskDecomposer {
    async decompose(message: string): Promise<string[]> {
        const trimmed = message.trim();
        if (!trimmed) return [];

        const numbered = trimmed.split('\n').filter(line => /^\s*\d+\./.test(line));
        if (numbered.length > 1) {
            return numbered.map(line => line.replace(/^\s*\d+\.\s*/, '').trim()).filter(Boolean);
        }

        const lines = trimmed.split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length > 1) {
            return lines;
        }

        const parts = trimmed.split(/(?:\s+then\s+|然后|接着|随后)/i).map(part => part.trim()).filter(Boolean);
        return parts.length > 1 ? parts : [trimmed];
    }
}

export class RuleBasedMultiAgentRouter implements MultiAgentRouter {
    constructor(private readonly defaultAgentId?: string) {}

    async route(context: MultiAgentRouterContext): Promise<MultiAgentDecision> {
        const message = context.message.toLowerCase();
        for (const agent of context.agents) {
            const keywords = agent.keywords || [];
            if (keywords.some(keyword => message.includes(keyword.toLowerCase()))) {
                return { agentId: agent.id, reason: 'keyword-match' };
            }
        }

        const fallback = this.defaultAgentId || context.agents[0]?.id;
        if (!fallback) {
            throw new Error('No agents available for routing.');
        }

        return { agentId: fallback, reason: 'default' };
    }
}

export interface LLMMultiAgentRouterOptions {
    systemPrompt?: string;
    temperature?: number;
    fallbackRouter?: MultiAgentRouter;
}

const DEFAULT_SYSTEM_PROMPT =
    'You are a routing assistant. Select the best agent for the user request. ' +
    'Respond with JSON only: {"agentId":"id","reason"?:"..."}.';

export class LLMultiAgentRouter implements MultiAgentRouter {
    private fallbackRouter: MultiAgentRouter;

    constructor(
        private readonly provider: LLMProvider,
        private readonly options: LLMMultiAgentRouterOptions = {}
    ) {
        this.fallbackRouter = options.fallbackRouter ?? new RuleBasedMultiAgentRouter();
    }

    async route(context: MultiAgentRouterContext): Promise<MultiAgentDecision> {
        const agentsDescription = context.agents.map(agent => {
            const tags = agent.keywords?.length ? ` (keywords: ${agent.keywords.join(', ')})` : '';
            return `- ${agent.id}: ${agent.description || 'No description'}${tags}`;
        }).join('\n');

        const messages: ChatMessage[] = [
            { role: 'system', content: this.options.systemPrompt || DEFAULT_SYSTEM_PROMPT },
            { role: 'user', content: `User message: ${context.message}\nAgents:\n${agentsDescription}` },
        ];

        try {
            const response = await this.provider.chat({
                messages,
                temperature: this.options.temperature ?? 0.1,
            });
            const decision = parseDecision(response.content);
            if (!decision || !context.agents.some(agent => agent.id === decision.agentId)) {
                return await this.fallbackRouter.route(context);
            }
            return decision;
        } catch (error) {
            console.error('[MultiAgentRouter] LLM routing failed:', error);
            return await this.fallbackRouter.route(context);
        }
    }
}

function parseDecision(content: string): MultiAgentDecision | null {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
}

export class MultiAgentOrchestrator {
    private agents: Map<string, AgentDescriptor> = new Map();
    private router: MultiAgentRouter;
    private decomposer: TaskDecomposer;
    private agentLoads: Map<string, number> = new Map();

    constructor(options?: { agents?: AgentDescriptor[]; router?: MultiAgentRouter; decomposer?: TaskDecomposer }) {
        (options?.agents || []).forEach(agent => this.registerAgent(agent));
        this.router = options?.router ?? new RuleBasedMultiAgentRouter();
        this.decomposer = options?.decomposer ?? new RuleBasedTaskDecomposer();
    }

    registerAgent(agent: AgentDescriptor): void {
        if (this.agents.has(agent.id)) {
            throw new Error(`Agent "${agent.id}" already registered.`);
        }
        this.agents.set(agent.id, agent);
        this.agentLoads.set(agent.id, 0);
    }

    removeAgent(agentId: string): void {
        this.agents.delete(agentId);
        this.agentLoads.delete(agentId);
    }

    listAgents(): AgentDescriptor[] {
        return Array.from(this.agents.values());
    }

    setRouter(router: MultiAgentRouter): void {
        this.router = router;
    }

    setDecomposer(decomposer: TaskDecomposer): void {
        this.decomposer = decomposer;
    }

    async route(message: string): Promise<MultiAgentDecision> {
        return this.router.route({
            message,
            agents: this.listAgents(),
        });
    }

    getAgentLoad(agentId: string): number {
        return this.agentLoads.get(agentId) ?? 0;
    }

    listAgentLoads(): Record<string, number> {
        const entries = Array.from(this.agentLoads.entries());
        return Object.fromEntries(entries);
    }

    async routeWithLoadBalancing(message: string): Promise<MultiAgentDecision> {
        const decision = await this.route(message);
        const fallbackId = this.pickLeastLoadedAgent();
        if (!fallbackId) return decision;

        const chosenId = decision.agentId || fallbackId;
        const chosenLoad = this.agentLoads.get(chosenId) ?? 0;
        const fallbackLoad = this.agentLoads.get(fallbackId) ?? 0;

        if (fallbackLoad + 1 < chosenLoad) {
            return { agentId: fallbackId, reason: 'load-balance', load: fallbackLoad };
        }

        return { ...decision, load: chosenLoad };
    }

    async routeAndChat(message: string, options?: ChatOptions): Promise<MultiAgentTaskResult> {
        const decision = await this.routeWithLoadBalancing(message);
        const agent = this.agents.get(decision.agentId);
        if (!agent) {
            throw new Error(`Agent "${decision.agentId}" not found.`);
        }

        try {
            this.incrementLoad(decision.agentId);
            const result = await agent.agent.chat(message, options);
            this.decrementLoad(decision.agentId);
            return { agentId: agent.id, message, result };
        } catch (error) {
            this.decrementLoad(decision.agentId);
            return { agentId: agent.id, message, error: String(error) };
        }
    }

    async runSequential(tasks: MultiAgentTask[]): Promise<MultiAgentTaskResult[]> {
        const results: MultiAgentTaskResult[] = [];
        for (const task of tasks) {
            results.push(await this.runTask(task));
        }
        return results;
    }

    async runParallel(tasks: MultiAgentTask[]): Promise<MultiAgentTaskResult[]> {
        return Promise.all(tasks.map(task => this.runTask(task)));
    }

    async decomposeAndRun(
        message: string,
        options?: { parallel?: boolean; taskOptions?: ChatOptions }
    ): Promise<MultiAgentTaskResult[]> {
        const subtasks = await this.decomposer.decompose(message, {
            message,
            agents: this.listAgents(),
        });

        const tasks: MultiAgentTask[] = [];
        for (const subtask of subtasks) {
            const decision = await this.route(subtask);
            tasks.push({ agentId: decision.agentId, message: subtask, options: options?.taskOptions });
        }

        return options?.parallel ? this.runParallel(tasks) : this.runSequential(tasks);
    }

    private async runTask(task: MultiAgentTask): Promise<MultiAgentTaskResult> {
        if (task.agentId) {
            const agent = this.agents.get(task.agentId);
            if (!agent) {
                return { agentId: task.agentId, message: task.message, error: 'Agent not found' };
            }
            try {
                this.incrementLoad(task.agentId);
                const result = await agent.agent.chat(task.message, task.options);
                this.decrementLoad(task.agentId);
                return { agentId: agent.id, message: task.message, result };
            } catch (error) {
                this.decrementLoad(task.agentId);
                return { agentId: agent.id, message: task.message, error: String(error) };
            }
        }

        return this.routeAndChat(task.message, task.options);
    }

    private pickLeastLoadedAgent(): string | undefined {
        let chosenId: string | undefined;
        let minLoad = Number.POSITIVE_INFINITY;
        for (const [agentId, load] of this.agentLoads.entries()) {
            if (load < minLoad) {
                minLoad = load;
                chosenId = agentId;
            }
        }
        return chosenId;
    }

    private incrementLoad(agentId: string): void {
        const current = this.agentLoads.get(agentId) ?? 0;
        this.agentLoads.set(agentId, current + 1);
    }

    private decrementLoad(agentId: string): void {
        const current = this.agentLoads.get(agentId) ?? 0;
        this.agentLoads.set(agentId, Math.max(0, current - 1));
    }
}
