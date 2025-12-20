import { describe, it, expect, vi } from 'vitest';
import {
    MultiAgentOrchestrator,
    RuleBasedMultiAgentRouter,
    LLMultiAgentRouter,
    RuleBasedTaskDecomposer,
} from '../../src/core/multi-agent';
import { AgentCoordinator } from '../../src/core/agent-coordinator';

const createMockAgent = (content: string, delayMs = 0) => ({
    chat: vi.fn().mockImplementation(async () => {
        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return {
            content,
            mode: 'chat',
            duration: 1,
        };
    }),
});

const createMockProvider = (response: string) => ({
    chat: vi.fn().mockResolvedValue({
        content: response,
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    }),
    getProviderName: () => 'MockProvider',
    getModel: () => 'mock-model',
    chatStream: vi.fn(),
    complete: vi.fn(),
});

describe('MultiAgentOrchestrator', () => {
    it('should route with rule-based router using keywords', async () => {
        const orchestrator = new MultiAgentOrchestrator({
            router: new RuleBasedMultiAgentRouter(),
            agents: [
                { id: 'research', agent: createMockAgent('ok'), keywords: ['research'] },
                { id: 'general', agent: createMockAgent('ok') },
            ],
        });

        const decision = await orchestrator.route('Please research this topic');
        expect(decision.agentId).toBe('research');
    });

    it('should run explicit agent task', async () => {
        const orchestrator = new MultiAgentOrchestrator({
            agents: [
                { id: 'alpha', agent: createMockAgent('alpha') },
                { id: 'beta', agent: createMockAgent('beta') },
            ],
        });

        const results = await orchestrator.runSequential([
            { agentId: 'beta', message: 'Hi' },
        ]);

        expect(results[0].agentId).toBe('beta');
        expect(results[0].result?.content).toBe('beta');
    });

    it('should use LLM router when configured', async () => {
        const provider = createMockProvider('{"agentId":"ops"}');
        const router = new LLMultiAgentRouter(provider as any);
        const orchestrator = new MultiAgentOrchestrator({
            router,
            agents: [
                { id: 'ops', agent: createMockAgent('ops') },
                { id: 'general', agent: createMockAgent('general') },
            ],
        });

        const result = await orchestrator.routeAndChat('Deploy this');
        expect(result.agentId).toBe('ops');
        expect(result.result?.content).toBe('ops');
    });

    it('should run tasks in parallel', async () => {
        const orchestrator = new MultiAgentOrchestrator({
            agents: [
                { id: 'alpha', agent: createMockAgent('alpha') },
                { id: 'beta', agent: createMockAgent('beta') },
            ],
        });

        const results = await orchestrator.runParallel([
            { agentId: 'alpha', message: 'One' },
            { agentId: 'beta', message: 'Two' },
        ]);

        expect(results).toHaveLength(2);
        expect(results[0].result?.content).toBe('alpha');
        expect(results[1].result?.content).toBe('beta');
    });

    it('should handoff between agents with coordinator', async () => {
        const coordinator = new AgentCoordinator({ defaultAgentId: 'alpha' });
        coordinator.registerAgent({ id: 'alpha', agent: createMockAgent('alpha') });
        coordinator.registerAgent({ id: 'beta', agent: createMockAgent('beta') });

        const result = await coordinator.handoff({
            fromAgentId: 'alpha',
            toAgentId: 'beta',
            reason: 'specialized task',
            payload: { summary: 'handoff summary' },
        });

        expect(result.content).toBe('beta');
        expect(coordinator.getTranscript().length).toBeGreaterThan(0);
    });

    it('should decompose tasks and assign agents', async () => {
        const orchestrator = new MultiAgentOrchestrator({
            router: new RuleBasedMultiAgentRouter('alpha'),
            decomposer: new RuleBasedTaskDecomposer(),
            agents: [
                { id: 'alpha', agent: createMockAgent('alpha'), keywords: ['alpha'] },
                { id: 'beta', agent: createMockAgent('beta'), keywords: ['beta'] },
            ],
        });

        const results = await orchestrator.decomposeAndRun('1. alpha task\n2. beta task');

        expect(results).toHaveLength(2);
        expect(results[0].agentId).toBe('alpha');
        expect(results[1].agentId).toBe('beta');
    });

    it('should rebalance to least loaded agent', async () => {
        const orchestrator = new MultiAgentOrchestrator({
            agents: [
                { id: 'alpha', agent: createMockAgent('alpha', 80) },
                { id: 'beta', agent: createMockAgent('beta') },
            ],
        });

        const inFlightA = orchestrator.routeAndChat('alpha');
        const inFlightB = orchestrator.routeAndChat('alpha');
        await new Promise(resolve => setTimeout(resolve, 10));
        const decision = await orchestrator.routeWithLoadBalancing('task');

        await Promise.all([inFlightA, inFlightB]);
        expect(decision.agentId).toBe('beta');
    });
});
