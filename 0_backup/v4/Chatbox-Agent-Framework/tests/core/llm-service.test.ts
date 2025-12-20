/**
 * LLM Service 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMService, createLLMService } from '../../src/core/llm-service/service';
import { LLMCache } from '../../src/core/llm-service/cache';
import { LLMStatsCollector } from '../../src/core/llm-service/stats';
import {
    createRequestLoggingMiddleware,
    createResponseLoggingMiddleware,
    createSystemPromptMiddleware,
    createContentFilterMiddleware,
    createFallbackMiddleware,
    createJsonParseMiddleware,
} from '../../src/core/llm-service/middlewares';
import { LLMProvider, type ChatRequest, type ChatResponse, type ChatStreamChunk, type LLMProviderConfig } from '../../src/core/llm-provider';

// ============================================================================
// Mock Provider
// ============================================================================

class MockLLMProvider extends LLMProvider {
    public responses: ChatResponse[] = [];
    private responseIndex = 0;
    public delay = 0;

    constructor(responses?: ChatResponse[]) {
        super({ model: 'mock-model' });
        this.responses = responses || [{ content: 'Mock response', usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } }];
    }

    getProviderName(): string {
        return 'MockProvider';
    }

    async chat(request: ChatRequest): Promise<ChatResponse> {
        if (this.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.delay));
        }
        const response = this.responses[this.responseIndex % this.responses.length];
        this.responseIndex++;
        return response;
    }

    async *chatStream(request: ChatRequest): AsyncGenerator<ChatStreamChunk> {
        yield { delta: 'Hello' };
        yield { delta: ' World' };
        yield { delta: '', usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } };
    }
}

// ============================================================================
// LLMService 测试
// ============================================================================

describe('LLMService', () => {
    let mockProvider: MockLLMProvider;
    let service: LLMService;

    beforeEach(() => {
        mockProvider = new MockLLMProvider();
        service = createLLMService(mockProvider);
    });

    describe('基本功能', () => {
        it('should create service with provider', () => {
            expect(service).toBeInstanceOf(LLMService);
            expect(service.getProviderName()).toBe('MockProvider');
            expect(service.getModel()).toBe('mock-model');
        });

        it('should execute chat request', async () => {
            const result = await service.chat({
                messages: [{ role: 'user', content: 'Hello' }],
            });

            expect(result.content).toBe('Mock response');
            expect(result.requestId).toBeDefined();
            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(result.cached).toBe(false);
        });

        it('should execute complete shortcut', async () => {
            const result = await service.complete('Hello');
            expect(result).toBe('Mock response');
        });

        it('should execute complete with system prompt', async () => {
            const result = await service.complete('Hello', 'You are helpful');
            expect(result).toBe('Mock response');
        });
    });

    describe('中间件', () => {
        it('should apply request middleware', async () => {
            const logs: string[] = [];
            const middleware = createRequestLoggingMiddleware(msg => logs.push(msg));

            service.useRequest(middleware);
            await service.chat({ messages: [{ role: 'user', content: 'Test' }] });

            expect(logs.some(log => log.includes('[LLM] Request'))).toBe(true);
        });

        it('should apply response middleware', async () => {
            const logs: string[] = [];
            const middleware = createResponseLoggingMiddleware(msg => logs.push(msg));

            service.useResponse(middleware);
            await service.chat({ messages: [{ role: 'user', content: 'Test' }] });

            expect(logs.some(log => log.includes('[LLM] Response'))).toBe(true);
        });

        it('should apply system prompt middleware', async () => {
            const middleware = createSystemPromptMiddleware('You are a helpful assistant');
            service.useRequest(middleware);

            // 通过 mock 验证请求被修改
            const originalChat = mockProvider.chat.bind(mockProvider);
            let capturedRequest: ChatRequest | null = null;
            mockProvider.chat = async (request: ChatRequest) => {
                capturedRequest = request;
                return originalChat(request);
            };

            await service.chat({ messages: [{ role: 'user', content: 'Test' }] });

            expect(capturedRequest).not.toBeNull();
            expect(capturedRequest!.messages[0].role).toBe('system');
            expect(capturedRequest!.messages[0].content).toBe('You are a helpful assistant');
        });

        it('should apply content filter middleware', async () => {
            const middleware = createContentFilterMiddleware([
                { pattern: /secret/gi, replacement: '[REDACTED]' },
            ]);
            service.useRequest(middleware);

            let capturedRequest: ChatRequest | null = null;
            const originalChat = mockProvider.chat.bind(mockProvider);
            mockProvider.chat = async (request: ChatRequest) => {
                capturedRequest = request;
                return originalChat(request);
            };

            await service.chat({
                messages: [{ role: 'user', content: 'The secret is 42' }],
            });

            expect(capturedRequest!.messages[0].content).toBe('The [REDACTED] is 42');
        });

        it('should remove middleware by name', async () => {
            const middleware = createRequestLoggingMiddleware();
            service.useRequest(middleware);

            const removed = service.removeMiddleware('request-logging');
            expect(removed).toBe(true);

            const removedAgain = service.removeMiddleware('request-logging');
            expect(removedAgain).toBe(false);
        });

        it('should apply error middleware for fallback', async () => {
            // 创建一个会失败的 provider
            const failingProvider = new MockLLMProvider();
            failingProvider.chat = async () => {
                throw new Error('Provider failed');
            };

            const failingService = createLLMService(failingProvider);
            failingService.useError(createFallbackMiddleware('Fallback response'));

            const result = await failingService.chat({
                messages: [{ role: 'user', content: 'Test' }],
            });

            expect(result.content).toBe('Fallback response');
        });
    });

    describe('统计', () => {
        it('should collect stats', async () => {
            await service.chat({ messages: [{ role: 'user', content: 'Test 1' }] });
            await service.chat({ messages: [{ role: 'user', content: 'Test 2' }] });

            const stats = service.getStats();

            expect(stats.totalRequests).toBe(2);
            expect(stats.successfulRequests).toBe(2);
            expect(stats.failedRequests).toBe(0);
        });

        it('should get recent calls', async () => {
            await service.chat({ messages: [{ role: 'user', content: 'Test' }] });

            const recent = service.getRecentCalls(5);
            expect(recent.length).toBe(1);
            expect(recent[0].success).toBe(true);
        });

        it('should export stats', async () => {
            await service.chat({ messages: [{ role: 'user', content: 'Test' }] });

            const exported = service.exportStats();
            expect(exported.history.length).toBe(1);
            expect(exported.aggregate.totalRequests).toBe(1);
            expect(exported.exportedAt).toBeGreaterThan(0);
        });

        it('should clear stats', async () => {
            await service.chat({ messages: [{ role: 'user', content: 'Test' }] });
            service.clearStats();

            const stats = service.getStats();
            expect(stats.totalRequests).toBe(0);
        });
    });

    describe('缓存', () => {
        it('should cache responses when enabled', async () => {
            const cachingService = createLLMService(mockProvider, {
                cache: { enabled: true, ttl: 60000, maxEntries: 100 },
            });

            await cachingService.chat({ messages: [{ role: 'user', content: 'Test' }] });
            const result2 = await cachingService.chat({ messages: [{ role: 'user', content: 'Test' }] });

            expect(result2.cached).toBe(true);
        });

        it('should skip cache when requested', async () => {
            const cachingService = createLLMService(mockProvider, {
                cache: { enabled: true, ttl: 60000, maxEntries: 100 },
            });

            await cachingService.chat({ messages: [{ role: 'user', content: 'Test' }] });
            const result2 = await cachingService.chat(
                { messages: [{ role: 'user', content: 'Test' }] },
                { skipCache: true }
            );

            expect(result2.cached).toBe(false);
        });

        it('should clear cache', async () => {
            const cachingService = createLLMService(mockProvider, {
                cache: { enabled: true, ttl: 60000, maxEntries: 100 },
            });

            await cachingService.chat({ messages: [{ role: 'user', content: 'Test' }] });
            cachingService.clearCache();

            const cacheStats = cachingService.getCacheStats();
            expect(cacheStats.size).toBe(0);
        });
    });

    describe('重试', () => {
        it('should retry on retryable errors', async () => {
            let attempts = 0;
            const flakeyProvider = new MockLLMProvider();
            flakeyProvider.chat = async () => {
                attempts++;
                if (attempts < 3) {
                    throw new Error('fetch failed');
                }
                return { content: 'Success after retries' };
            };

            const retryService = createLLMService(flakeyProvider, {
                retry: {
                    maxRetries: 3,
                    initialBackoff: 10,
                    maxBackoff: 100,
                    backoffMultiplier: 2,
                    retryableErrors: ['fetch failed'],
                },
            });

            const result = await retryService.chat({
                messages: [{ role: 'user', content: 'Test' }],
            });

            expect(result.content).toBe('Success after retries');
            expect(attempts).toBe(3);
        });

        it('should not retry on non-retryable errors', async () => {
            let attempts = 0;
            const failingProvider = new MockLLMProvider();
            failingProvider.chat = async () => {
                attempts++;
                throw new Error('Non-retryable error');
            };

            const retryService = createLLMService(failingProvider, {
                retry: {
                    maxRetries: 3,
                    initialBackoff: 10,
                    maxBackoff: 100,
                    backoffMultiplier: 2,
                    retryableErrors: ['fetch failed'],
                },
            });

            await expect(
                retryService.chat({ messages: [{ role: 'user', content: 'Test' }] })
            ).rejects.toThrow('Non-retryable error');

            expect(attempts).toBe(1);
        });
    });
});

// ============================================================================
// LLMCache 测试
// ============================================================================

describe('LLMCache', () => {
    let cache: LLMCache;

    beforeEach(() => {
        cache = new LLMCache({
            enabled: true,
            ttl: 60000,
            maxEntries: 10,
        });
    });

    it('should store and retrieve cached responses', () => {
        const key = 'test-key';
        const response: ChatResponse = { content: 'Cached response' };

        cache.set(key, response);
        const retrieved = cache.get(key);

        expect(retrieved).toEqual(response);
    });

    it('should return null for non-existent keys', () => {
        expect(cache.get('non-existent')).toBeNull();
    });

    it('should respect maxEntries limit', () => {
        for (let i = 0; i < 15; i++) {
            cache.set(`key-${i}`, { content: `Response ${i}` });
        }

        const stats = cache.getStats();
        expect(stats.size).toBeLessThanOrEqual(10);
    });

    it('should clear cache', () => {
        cache.set('key1', { content: 'Response 1' });
        cache.set('key2', { content: 'Response 2' });

        cache.clear();

        expect(cache.get('key1')).toBeNull();
        expect(cache.get('key2')).toBeNull();
    });

    it('should invalidate specific key', () => {
        cache.set('key1', { content: 'Response 1' });
        cache.set('key2', { content: 'Response 2' });

        const invalidated = cache.invalidate('key1');

        expect(invalidated).toBe(true);
        expect(cache.get('key1')).toBeNull();
        expect(cache.get('key2')).not.toBeNull();
    });

    it('should generate consistent cache keys', () => {
        const request1 = { messages: [{ role: 'user' as const, content: 'Hello' }] };
        const request2 = { messages: [{ role: 'user' as const, content: 'Hello' }] };
        const request3 = { messages: [{ role: 'user' as const, content: 'World' }] };

        const key1 = cache.generateKey(request1);
        const key2 = cache.generateKey(request2);
        const key3 = cache.generateKey(request3);

        expect(key1).toBe(key2);
        expect(key1).not.toBe(key3);
    });
});

// ============================================================================
// LLMStatsCollector 测试
// ============================================================================

describe('LLMStatsCollector', () => {
    let collector: LLMStatsCollector;

    beforeEach(() => {
        collector = new LLMStatsCollector({ maxHistory: 100, enabled: true });
    });

    it('should record and aggregate stats', () => {
        collector.record({
            requestId: 'req-1',
            providerName: 'OpenAI',
            model: 'gpt-4',
            startTime: Date.now() - 100,
            endTime: Date.now(),
            duration: 100,
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            success: true,
            cached: false,
            retryCount: 0,
        });

        const stats = collector.getAggregateStats();

        expect(stats.totalRequests).toBe(1);
        expect(stats.successfulRequests).toBe(1);
        expect(stats.totalTokens).toBe(30);
    });

    it('should track by provider', () => {
        collector.record({
            requestId: 'req-1',
            providerName: 'OpenAI',
            model: 'gpt-4',
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 100,
            success: true,
            cached: false,
            retryCount: 0,
        });

        collector.record({
            requestId: 'req-2',
            providerName: 'Gemini',
            model: 'gemini-pro',
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 100,
            success: true,
            cached: false,
            retryCount: 0,
        });

        const stats = collector.getAggregateStats();

        expect(stats.byProvider['OpenAI'].requests).toBe(1);
        expect(stats.byProvider['Gemini'].requests).toBe(1);
    });

    it('should calculate success rate', () => {
        collector.record({
            requestId: 'req-1',
            providerName: 'Test',
            model: 'test',
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 100,
            success: true,
            cached: false,
            retryCount: 0,
        });

        collector.record({
            requestId: 'req-2',
            providerName: 'Test',
            model: 'test',
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 100,
            success: false,
            cached: false,
            retryCount: 0,
            error: 'Failed',
        });

        expect(collector.getSuccessRate()).toBe(0.5);
    });

    it('should clear history', () => {
        collector.record({
            requestId: 'req-1',
            providerName: 'Test',
            model: 'test',
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 100,
            success: true,
            cached: false,
            retryCount: 0,
        });

        collector.clear();

        expect(collector.getAggregateStats().totalRequests).toBe(0);
    });

    it('should respect maxHistory limit', () => {
        const smallCollector = new LLMStatsCollector({ maxHistory: 5, enabled: true });

        for (let i = 0; i < 10; i++) {
            smallCollector.record({
                requestId: `req-${i}`,
                providerName: 'Test',
                model: 'test',
                startTime: Date.now(),
                endTime: Date.now(),
                duration: 100,
                success: true,
                cached: false,
                retryCount: 0,
            });
        }

        expect(smallCollector.getRecentStats(10).length).toBe(5);
    });
});

// ============================================================================
// 中间件测试
// ============================================================================

describe('Middlewares', () => {
    describe('createJsonParseMiddleware', () => {
        it('should parse valid JSON response', () => {
            const middleware = createJsonParseMiddleware();
            const response: ChatResponse = { content: '{"key": "value"}' };

            const result = middleware.process(response, {} as any) as ChatResponse;

            expect(JSON.parse(result.content)).toEqual({ key: 'value' });
        });

        it('should extract JSON from code blocks', () => {
            const middleware = createJsonParseMiddleware();
            const response: ChatResponse = { content: '```json\n{"key": "value"}\n```' };

            const result = middleware.process(response, {} as any) as ChatResponse;

            expect(JSON.parse(result.content)).toEqual({ key: 'value' });
        });

        it('should use default value on parse failure (non-strict)', () => {
            const middleware = createJsonParseMiddleware({
                strict: false,
                defaultValue: { error: true },
            });
            const response: ChatResponse = { content: 'not json' };

            const result = middleware.process(response, {} as any) as ChatResponse;

            expect(JSON.parse(result.content)).toEqual({ error: true });
        });

        it('should throw on parse failure (strict mode)', () => {
            const middleware = createJsonParseMiddleware({ strict: true });
            const response: ChatResponse = { content: 'not json' };

            expect(() => middleware.process(response, {} as any)).toThrow();
        });
    });
});
