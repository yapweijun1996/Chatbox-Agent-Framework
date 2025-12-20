/**
 * Crew-style collaboration utilities.
 */

import type { ChatOptions, AgentResult } from './agent';
import type { AgentClient } from './multi-agent';
import { MultiAgentOrchestrator, RuleBasedMultiAgentRouter, RuleBasedTaskDecomposer } from './multi-agent';

export interface CrewAgent {
    id: string;
    agent: AgentClient;
    role: string;
    description?: string;
    keywords?: string[];
}

export interface CrewStepResult {
    stepId: string;
    task: string;
    agentId: string;
    role: string;
    result?: AgentResult;
    error?: string;
}

export interface CrewRunOptions {
    goal: string;
    tasks?: string[];
    parallel?: boolean;
    options?: ChatOptions;
}

export class CrewCoordinator {
    private orchestrator: MultiAgentOrchestrator;
    private agents: Map<string, CrewAgent> = new Map();

    constructor(agents: CrewAgent[]) {
        agents.forEach(agent => this.registerAgent(agent));
        this.orchestrator = new MultiAgentOrchestrator({
            agents: agents.map(agent => ({
                id: agent.id,
                agent: agent.agent,
                description: agent.description || agent.role,
                keywords: agent.keywords || [agent.role],
            })),
            router: new RuleBasedMultiAgentRouter(agents[0]?.id),
            decomposer: new RuleBasedTaskDecomposer(),
        });
    }

    registerAgent(agent: CrewAgent): void {
        if (this.agents.has(agent.id)) {
            throw new Error(`Agent "${agent.id}" already registered.`);
        }
        this.agents.set(agent.id, agent);
    }

    async run(options: CrewRunOptions): Promise<CrewStepResult[]> {
        const tasks = options.tasks && options.tasks.length > 0
            ? options.tasks
            : await new RuleBasedTaskDecomposer().decompose(options.goal, {
                message: options.goal,
                agents: this.orchestrator.listAgents(),
            });

        const runTask = async (task: string, index: number): Promise<CrewStepResult> => {
            const decision = await this.orchestrator.route(task);
            const agent = this.agents.get(decision.agentId);
            if (!agent) {
                return {
                    stepId: `step-${index + 1}`,
                    task,
                    agentId: decision.agentId,
                    role: 'unknown',
                    error: 'Agent not found',
                };
            }

            const message = [
                `Role: ${agent.role}`,
                `Goal: ${options.goal}`,
                `Task: ${task}`,
            ].join('\n');

            try {
                const result = await agent.agent.chat(message, options.options);
                return {
                    stepId: `step-${index + 1}`,
                    task,
                    agentId: agent.id,
                    role: agent.role,
                    result,
                };
            } catch (error) {
                return {
                    stepId: `step-${index + 1}`,
                    task,
                    agentId: agent.id,
                    role: agent.role,
                    error: String(error),
                };
            }
        };

        if (options.parallel) {
            return Promise.all(tasks.map((task, index) => runTask(task, index)));
        }

        const results: CrewStepResult[] = [];
        for (let i = 0; i < tasks.length; i += 1) {
            results.push(await runTask(tasks[i], i));
        }
        return results;
    }
}
