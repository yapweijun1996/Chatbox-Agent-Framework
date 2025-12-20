import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent, createAgent, type AgentConfig } from '../../src/core/agent';
import { shouldUseAgentMode, formatAgentResponse } from '../../src/core/agent-utils';
import type { IntentRouter } from '../../src/core/intent-router';
import { EventStream } from '../../src/core/event-stream';
import { createState } from '../../src/core/state';
import { z } from 'zod';

// Mock LLM Provider
const createMockProvider = () => ({
    chat: vi.fn().mockResolvedValue({
        content: 'Hello! How can I help you?',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    }),
    chatStream: vi.fn().mockImplementation(async function* () {
        yield { delta: 'Hello' };
        yield { delta: ' World' };
    }),
    getProviderName: () => 'MockProvider',
    getModel: () => 'mock-model',
    complete: vi.fn().mockResolvedValue('test'),
});

// Mock Tool
const createMockTool = (name: string) => ({
    name,
    description: `Mock ${name} tool`,
    inputSchema: z.object({ query: z.string().optional() }),
    outputSchema: z.object({ result: z.string() }),
    timeout: 5000,
    retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
    permissions: [],
    execute: vi.fn().mockResolvedValue({ result: 'success' }),
});

describe('Agent', () => {
    describe('创建和初始化', () => {
        it('should create agent with LLMProviderConfig', () => {
            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
            });

            expect(agent).toBeInstanceOf(Agent);
            expect(agent.getProvider()).toBeDefined();
        });

        it('should create agent with tools', () => {
            const tool = createMockTool('test-tool');
            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
                tools: [tool],
            });

            expect(agent.getToolRegistry().has('test-tool')).toBe(true);
        });

        it('should use default values for optional config', () => {
            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
            });

            // Agent should be created without errors
            expect(agent).toBeInstanceOf(Agent);
        });
    });

    describe('对话历史管理', () => {
        it('should clear conversation history', () => {
            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
            });

            agent.clearHistory();
            expect(agent.getHistory()).toHaveLength(0);
        });

        it('should return copy of history', () => {
            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
            });

            const history1 = agent.getHistory();
            const history2 = agent.getHistory();
            expect(history1).not.toBe(history2);
        });
    });

    describe('意图澄清', () => {
        it('should return clarification question without executing chat or agent mode', async () => {
            const provider = createMockProvider();
            const clarificationRouter: IntentRouter = {
                route: async () => ({
                    mode: 'chat',
                    clarification: { question: '请说明你希望我直接回答还是执行工具？' },
                }),
            };

            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
                intentRouter: clarificationRouter,
            });
            // override provider to observe calls
            (agent as unknown as { provider: any }).provider = provider;

            const result = await agent.chat('hi');

            expect(result.content).toBe('请说明你希望我直接回答还是执行工具？');
            expect(result.mode).toBe('chat');
            expect(provider.chat).not.toHaveBeenCalled();
        });
    });

    describe('Checkpoint persistence', () => {
        it('should resume from persisted checkpoint when local cache is missing', async () => {
            const state = createState('checkpoint');
            const adapter = {
                saveCheckpoint: vi.fn(),
                loadCheckpoint: vi.fn().mockResolvedValue({
                    id: 'checkpoint-1',
                    stateId: state.id,
                    state,
                    eventIndex: 0,
                    timestamp: Date.now(),
                }),
                listCheckpoints: vi.fn().mockResolvedValue([]),
                deleteCheckpoint: vi.fn(),
            };
            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
                mode: 'agent',
                maxSteps: 4,
                persistenceAdapter: adapter,
            });
            (agent as any).runner = {
                execute: vi.fn().mockResolvedValue({ state, events: new EventStream() }),
            };

            const result = await agent.resume({ fromCheckpoint: 'checkpoint-1' });
            expect(adapter.loadCheckpoint).toHaveBeenCalled();
            expect(result.mode).toBe('agent');
        });
    });

    describe('Graph templates', () => {
        it('should build light template without plan-and-execute edge', () => {
            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
                graphTemplate: 'light',
            });

            const graph = agent.getGraphDefinition();
            const hasReplanEdge = graph?.edges.some(edge => {
                return 'to' in edge
                    && edge.from === 'verifier'
                    && edge.to === 'planner';
            });

            expect(hasReplanEdge).toBe(false);
        });

        it('should build strict template with condition error strategy', () => {
            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
                graphTemplate: 'strict',
            });

            const graph = agent.getGraphDefinition();
            expect(graph?.conditionErrorStrategy).toBe('throw');
        });
    });

    describe('Graph config', () => {
        it('should build graph from config with conditions', () => {
            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
                graphConfig: {
                    nodes: ['planner', 'tool-runner', 'verifier', 'responder'],
                    edges: [
                        { from: 'planner', to: 'tool-runner', type: 'sequential' },
                        { from: 'tool-runner', to: 'verifier', type: 'sequential' },
                        { from: 'verifier', to: 'responder', type: 'conditional', condition: 'steps_complete' },
                        { from: 'verifier', to: 'tool-runner', type: 'conditional', condition: 'steps_remaining' },
                    ],
                    entryNode: 'planner',
                    maxSteps: 10,
                },
            });

            const graph = agent.getGraphDefinition();
            expect(graph?.entryNode).toBe('planner');
            expect(graph?.edges.length).toBe(4);
        });
    });

    describe('工具注册', () => {
        it('should register tool dynamically', () => {
            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
            });

            const tool = createMockTool('dynamic-tool');
            agent.registerTool(tool);

            expect(agent.getToolRegistry().has('dynamic-tool')).toBe(true);
        });
    });

    describe('EventStream', () => {
        it('should return event stream', () => {
            const agent = createAgent({
                provider: {
                    type: 'lm-studio',
                    baseURL: 'http://localhost:1234',
                    model: 'test-model',
                },
            });

            const stream = agent.getEventStream();
            const runnerStream = (agent as any).runner.getEventStream();
            expect(stream).toBeDefined();
            expect(stream).toBe(runnerStream);
        });
    });
});

describe('shouldUseAgentMode', () => {
    it('should return false when no tools available', () => {
        expect(shouldUseAgentMode('search for something', false)).toBe(false);
    });

    it('should return false for greetings', () => {
        expect(shouldUseAgentMode('hi', true)).toBe(false);
        expect(shouldUseAgentMode('hello', true)).toBe(false);
        expect(shouldUseAgentMode('你好', true)).toBe(false);
        expect(shouldUseAgentMode('thanks', true)).toBe(false);
    });

    it('should return false for simple questions', () => {
        expect(shouldUseAgentMode('what is your name', true)).toBe(false);
        expect(shouldUseAgentMode('who are you', true)).toBe(false);
        expect(shouldUseAgentMode('你是谁', true)).toBe(false);
    });

    it('should return true for task keywords', () => {
        expect(shouldUseAgentMode('search for documents', true)).toBe(true);
        expect(shouldUseAgentMode('query the database', true)).toBe(true);
        expect(shouldUseAgentMode('分析这段代码', true)).toBe(true);
        expect(shouldUseAgentMode('optimize this sql', true)).toBe(true);
    });

    it('should return false for general questions', () => {
        expect(shouldUseAgentMode('tell me a story', true)).toBe(false);
        expect(shouldUseAgentMode('what is the weather', true)).toBe(false);
    });
});

describe('formatAgentResponse', () => {
    it('should format completed steps', () => {
        const result = formatAgentResponse('Test goal', [
            { description: 'Step 1', status: 'completed' },
            { description: 'Step 2', status: 'completed' },
            { description: 'Step 3', status: 'failed' },
        ]);

        expect(result).toContain('Test goal');
        expect(result).toContain('Step 1');
        expect(result).toContain('Step 2');
        expect(result).not.toContain('Step 3'); // Failed step not included
    });

    it('should handle empty steps', () => {
        const result = formatAgentResponse('Empty goal', []);

        expect(result).toContain('Empty goal');
        expect(result).toContain('任务已完成');
    });
});
