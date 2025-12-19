import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent, createAgent, type AgentConfig } from '../../src/core/agent';
import { shouldUseAgentMode, formatAgentResponse } from '../../src/core/agent-utils';
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
