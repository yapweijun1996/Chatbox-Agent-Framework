import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgent, createMemoryManager, normalizeMemoryContent } from '../../src/index';
import type { Agent } from '../../src/core/agent';
import type { MemoryManager } from '../../src/core/memory/types';

const createMockProvider = () => ({
    chat: vi.fn().mockResolvedValue({
        content: 'Sure!',
        usage: { promptTokens: 5, completionTokens: 7, totalTokens: 12 },
    }),
    chatStream: vi.fn().mockImplementation(async function* () {
        yield { delta: 'Sure!' };
    }),
    getProviderName: () => 'MockProvider',
    getModel: () => 'mock-model',
    complete: vi.fn().mockResolvedValue('test'),
});

describe('Agent chat memory', () => {
    let memory: MemoryManager;

    beforeEach(() => {
        memory = createMemoryManager({
            autoConsolidate: false,
            shortTermMaxSize: 100,
        });
    });

    it('should inject recalled memories into chat prompt when enabled', async () => {
        await memory.remember('User likes coffee', {
            tags: ['user-preference'],
            importance: 0.9,
            longTerm: true,
        });

        const agent = createAgent({
            provider: {
                type: 'lm-studio',
                baseURL: 'http://localhost:1234',
                model: 'test-model',
            },
            memory,
            enableChatMemory: true,
            mode: 'chat',
        });

        const mockProvider = createMockProvider();
        (agent as Agent as any).provider = mockProvider;

        await agent.chat('coffee', { stream: false });

        const messages = mockProvider.chat.mock.calls[0][0].messages;
        const memoryMessage = messages.find((msg: { role: string; content: string }) =>
            msg.role === 'system' && msg.content.includes('Relevant memory')
        );

        expect(memoryMessage).toBeDefined();
        expect(memoryMessage.content).toContain('User likes coffee');
    });

    it('should save preferences after chat response when enabled', async () => {
        const agent = createAgent({
            provider: {
                type: 'lm-studio',
                baseURL: 'http://localhost:1234',
                model: 'test-model',
            },
            memory,
            enableChatMemory: true,
            mode: 'chat',
        });

        const mockProvider = createMockProvider();
        (agent as Agent as any).provider = mockProvider;

        await agent.chat('I prefer tea', { stream: false });

        const memories = await memory.recall({ tags: ['user-preference'] });
        const contents = memories.map(item => normalizeMemoryContent(item.content));

        expect(contents.some(content => content.includes('I prefer tea'))).toBe(true);
    });

    it('should allow per-call opt-out from chat memory', async () => {
        const agent = createAgent({
            provider: {
                type: 'lm-studio',
                baseURL: 'http://localhost:1234',
                model: 'test-model',
            },
            memory,
            enableChatMemory: true,
            mode: 'chat',
        });

        const mockProvider = createMockProvider();
        (agent as Agent as any).provider = mockProvider;

        await agent.chat('I prefer apples', { stream: false, useChatMemory: false });

        const memories = await memory.recall({ tags: ['user-preference'] });
        expect(memories).toHaveLength(0);

        const messages = mockProvider.chat.mock.calls[0][0].messages;
        const hasMemoryMessage = messages.some((msg: { content: string }) =>
            msg.content.includes('Relevant memory')
        );

        expect(hasMemoryMessage).toBe(false);
    });

    it('should save explicit memory when intent rule is enabled', async () => {
        const agent = createAgent({
            provider: {
                type: 'lm-studio',
                baseURL: 'http://localhost:1234',
                model: 'test-model',
            },
            memory,
            enableChatMemory: true,
            mode: 'chat',
        });

        const mockProvider = createMockProvider();
        (agent as Agent as any).provider = mockProvider;

        await agent.chat('Remember that my timezone is PST.', {
            stream: false,
            chatMemorySavePolicy: { saveIntentMessages: true },
        });

        const memories = await memory.recall({ tags: ['explicit-memory'] });
        const contents = memories.map(item => normalizeMemoryContent(item.content));

        expect(contents.some(content => content.includes('my timezone is PST'))).toBe(true);
    });
});
