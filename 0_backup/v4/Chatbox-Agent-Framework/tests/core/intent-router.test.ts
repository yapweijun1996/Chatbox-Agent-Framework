import { describe, it, expect, vi } from 'vitest';
import { LLMIntentRouter, RuleBasedIntentRouter } from '../../src/core/intent-router';

const createMockProvider = (content: string) => ({
    chat: vi.fn().mockResolvedValue({
        content,
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    }),
    getProviderName: () => 'MockProvider',
    getModel: () => 'mock-model',
    complete: vi.fn(),
    chatStream: vi.fn(),
});

describe('IntentRouter', () => {
    it('should route with rule-based router', async () => {
        const router = new RuleBasedIntentRouter();
        const result = await router.route({
            message: 'search the database',
            hasTools: true,
            availableTools: ['sql-query'],
        });

        expect(result.mode).toBe('agent');
        expect(result.analysis?.router).toBe('rule-based');
    });

    it('should route to chat for short or explanatory messages', async () => {
        const router = new RuleBasedIntentRouter();
        const shortResult = await router.route({
            message: 'hi',
            hasTools: true,
            availableTools: ['sql-query'],
        });
        const explainResult = await router.route({
            message: 'explain what is SQL',
            hasTools: true,
            availableTools: ['sql-query'],
        });

        expect(shortResult.mode).toBe('chat');
        expect(shortResult.clarification?.question).toBeDefined();
        expect(explainResult.mode).toBe('chat');
    });

    it('should parse LLM routing response', async () => {
        const provider = createMockProvider(
            '{"mode":"agent","allowedTools":["sql-query"],"enableMemory":false,"reason":"needs tools"}'
        );
        const router = new LLMIntentRouter(provider as any);

        const result = await router.route({
            message: 'query data',
            hasTools: true,
            availableTools: ['sql-query', 'document-search'],
        });

        expect(result.mode).toBe('agent');
        expect(result.toolPolicy?.allowedTools).toEqual(['sql-query']);
        expect(result.memoryPolicy?.enableMemory).toBe(false);
        expect(result.analysis?.router).toBe('llm');
    });

    it('should normalize clarification from LLM response', async () => {
        const provider = createMockProvider(
            '{"mode":"chat","clarification":"do you want me to use tools?"}'
        );
        const router = new LLMIntentRouter(provider as any);

        const result = await router.route({
            message: 'help',
            hasTools: true,
            availableTools: ['sql-query'],
        });

        expect(result.mode).toBe('chat');
        expect(result.clarification?.question).toBe('do you want me to use tools?');
    });

    it('should fallback when LLM response is invalid', async () => {
        const provider = createMockProvider('not json');
        const router = new LLMIntentRouter(provider as any, {
            fallbackRouter: new RuleBasedIntentRouter(),
        });

        const result = await router.route({
            message: 'hello',
            hasTools: true,
            availableTools: ['sql-query'],
        });

        expect(result.mode).toBe('chat');
        expect(result.analysis?.router).toBe('fallback');
    });

    it('should retry on invalid LLM response before fallback', async () => {
        const provider = {
            ...createMockProvider('not json'),
            chat: vi.fn()
                .mockResolvedValueOnce({ content: 'invalid', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } })
                .mockResolvedValueOnce({ content: '{"mode":"agent"}', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
        };

        const router = new LLMIntentRouter(provider as any, {
            retries: 1,
        });

        const result = await router.route({
            message: 'run a query',
            hasTools: true,
            availableTools: ['sql-query'],
        });

        expect(provider.chat).toHaveBeenCalledTimes(2);
        expect(result.mode).toBe('agent');
    });

    it('should force chat mode when no tools are available', async () => {
        const provider = createMockProvider('{"mode":"agent"}');
        const router = new LLMIntentRouter(provider as any);

        const result = await router.route({
            message: 'search',
            hasTools: false,
            availableTools: [],
        });

        expect(result.mode).toBe('chat');
    });
});
