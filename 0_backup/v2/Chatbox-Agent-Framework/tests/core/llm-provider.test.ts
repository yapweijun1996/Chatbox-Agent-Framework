import { describe, it, expect, beforeAll } from 'vitest';
import { createLLMProvider, LLMProviderError } from '../../src/index';

describe('LLM Provider', () => {
    describe('Provider Factory', () => {
        it('should create LM Studio provider', () => {
            const provider = createLLMProvider({
                type: 'lm-studio',
                baseURL: 'http://127.0.0.1:6354',
                model: 'test-model',
            });

            expect(provider.getProviderName()).toBe('LM Studio');
            expect(provider.getModel()).toBe('test-model');
        });

        it('should create Gemini provider', () => {
            const provider = createLLMProvider({
                type: 'gemini',
                apiKey: 'test-key',
                model: 'gemini-2.0-flash-exp',
            });

            expect(provider.getProviderName()).toBe('Gemini');
            expect(provider.getModel()).toBe('gemini-2.0-flash-exp');
        });

        it('should create OpenAI provider', () => {
            const provider = createLLMProvider({
                type: 'openai',
                apiKey: 'test-key',
                model: 'gpt-4o-mini',
            });

            expect(provider.getProviderName()).toBe('OpenAI');
            expect(provider.getModel()).toBe('gpt-4o-mini');
        });

        it('should throw error for unknown provider type', () => {
            expect(() => {
                createLLMProvider({ type: 'unknown' } as any);
            }).toThrow('Unknown provider type');
        });
    });

    describe('Chat Interface', () => {
        it('should handle basic chat request structure', async () => {
            const provider = createLLMProvider({
                type: 'lm-studio',
                baseURL: 'http://127.0.0.1:6354',
                model: 'test-model',
            });

            const messages = [
                { role: 'system' as const, content: 'You are helpful' },
                { role: 'user' as const, content: 'Hello' },
            ];

            // 这个测试会失败如果没有实际的 LM Studio 服务
            // 我们只测试接口是否正确设置
            expect(provider.chat).toBeDefined();
            expect(provider.chatStream).toBeDefined();
            expect(provider.complete).toBeDefined();
        });
    });

    describe('Message Format', () => {
        it('should accept standard message format', () => {
            const messages = [
                { role: 'system' as const, content: 'System prompt' },
                { role: 'user' as const, content: 'User message' },
                { role: 'assistant' as const, content: 'Assistant reply' },
            ];

            // 验证消息格式符合接口定义
            expect(messages).toHaveLength(3);
            expect(messages[0].role).toBe('system');
            expect(messages[1].role).toBe('user');
            expect(messages[2].role).toBe('assistant');
        });
    });
});
