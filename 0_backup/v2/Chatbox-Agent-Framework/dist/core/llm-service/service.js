/**
 * LLM Service 核心实现
 * 提供统一的 LLM 调用接口，支持中间件、缓存、重试、统计等功能
 */
import { LLMCache } from './cache';
import { LLMStatsCollector } from './stats';
import { DEFAULT_LLM_SERVICE_CONFIG } from './types';
// ============================================================================
// 辅助函数
// ============================================================================
/**
 * 生成唯一请求 ID
 */
function generateRequestId() {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
/**
 * 睡眠函数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * 检查错误是否可重试
 */
function isRetryableError(error, retryableErrors) {
    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(re => errorMessage.includes(re.toLowerCase()));
}
// ============================================================================
// LLM Service 类
// ============================================================================
/**
 * LLM Service
 * 高级 LLM 调用服务，封装 Provider 并提供附加功能
 */
export class LLMService {
    provider;
    config;
    cache;
    stats;
    requestMiddlewares = [];
    responseMiddlewares = [];
    errorMiddlewares = [];
    rateLimitState = {
        count: 0,
        windowStart: Date.now(),
    };
    constructor(provider, config = {}) {
        this.provider = provider;
        this.config = { ...DEFAULT_LLM_SERVICE_CONFIG, ...config };
        this.cache = new LLMCache(this.config.cache);
        this.stats = new LLMStatsCollector({
            maxHistory: this.config.maxStatsHistory,
            enabled: this.config.enableStats,
        });
    }
    // ========================================================================
    // 主要 API
    // ========================================================================
    /**
     * 发送聊天请求（非流式）
     */
    async chat(request, options = {}) {
        const requestId = generateRequestId();
        const startTime = Date.now();
        const context = {
            requestId,
            startTime,
            providerName: this.provider.getProviderName(),
            model: this.provider.getModel(),
            retryCount: 0,
            request,
            options,
        };
        try {
            // 速率限制检查
            await this.checkRateLimit();
            // 检查缓存
            if (!options.skipCache) {
                const cacheKey = this.cache.generateKey(request);
                const cached = this.cache.get(cacheKey);
                if (cached) {
                    const result = this.createResult(cached, context, true);
                    this.recordStats(context, result, true);
                    return result;
                }
            }
            // 执行请求中间件
            let processedRequest = request;
            for (const middleware of this.requestMiddlewares) {
                processedRequest = await middleware.process(processedRequest, context);
            }
            // 执行请求（带重试）
            const response = await this.executeWithRetry(processedRequest, context, options);
            // 执行响应中间件
            let processedResponse = response;
            for (const middleware of this.responseMiddlewares) {
                processedResponse = await middleware.process(processedResponse, context);
            }
            // 缓存响应
            if (!options.skipCache) {
                const cacheKey = this.cache.generateKey(request);
                this.cache.set(cacheKey, processedResponse);
            }
            const result = this.createResult(processedResponse, context, false);
            this.recordStats(context, result, true);
            return result;
        }
        catch (error) {
            // 执行错误中间件
            for (const middleware of this.errorMiddlewares) {
                const recovered = await middleware.process(error, context);
                if (recovered) {
                    const result = this.createResult(recovered, context, false);
                    this.recordStats(context, result, true);
                    return result;
                }
            }
            // 记录失败统计
            this.recordStats(context, null, false, error.message);
            throw error;
        }
    }
    /**
     * 发送聊天请求（流式）
     */
    async chatStream(request, options = {}) {
        const requestId = generateRequestId();
        const startTime = Date.now();
        let aborted = false;
        const context = {
            requestId,
            startTime,
            providerName: this.provider.getProviderName(),
            model: this.provider.getModel(),
            retryCount: 0,
            request,
            options,
        };
        // 速率限制检查
        await this.checkRateLimit();
        // 执行请求中间件
        let processedRequest = request;
        for (const middleware of this.requestMiddlewares) {
            processedRequest = await middleware.process(processedRequest, context);
        }
        // 创建流式生成器包装
        const self = this;
        async function* wrappedStream() {
            try {
                const stream = self.provider.chatStream(processedRequest);
                for await (const chunk of stream) {
                    if (aborted || options.signal?.aborted) {
                        break;
                    }
                    yield chunk;
                }
            }
            catch (error) {
                self.recordStats(context, null, false, error.message);
                throw error;
            }
        }
        return {
            requestId,
            stream: wrappedStream(),
            abort: () => {
                aborted = true;
            },
        };
    }
    /**
     * 简便方法：发送单条消息
     */
    async complete(prompt, systemPrompt, options = {}) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        const result = await this.chat({ messages }, options);
        return result.content;
    }
    // ========================================================================
    // 中间件管理
    // ========================================================================
    /**
     * 添加请求中间件
     */
    useRequest(middleware) {
        this.requestMiddlewares.push(middleware);
        return this;
    }
    /**
     * 添加响应中间件
     */
    useResponse(middleware) {
        this.responseMiddlewares.push(middleware);
        return this;
    }
    /**
     * 添加错误中间件
     */
    useError(middleware) {
        this.errorMiddlewares.push(middleware);
        return this;
    }
    /**
     * 移除中间件
     */
    removeMiddleware(name) {
        let removed = false;
        const removeFromArray = (arr) => {
            const index = arr.findIndex(m => m.name === name);
            if (index > -1) {
                arr.splice(index, 1);
                removed = true;
            }
            return arr;
        };
        this.requestMiddlewares = removeFromArray(this.requestMiddlewares);
        this.responseMiddlewares = removeFromArray(this.responseMiddlewares);
        this.errorMiddlewares = removeFromArray(this.errorMiddlewares);
        return removed;
    }
    // ========================================================================
    // 统计与缓存 API
    // ========================================================================
    /**
     * 获取聚合统计
     */
    getStats() {
        return this.stats.getAggregateStats();
    }
    /**
     * 获取最近的调用记录
     */
    getRecentCalls(count = 10) {
        return this.stats.getRecentStats(count);
    }
    /**
     * 导出统计数据
     */
    exportStats() {
        return this.stats.export();
    }
    /**
     * 清空统计
     */
    clearStats() {
        this.stats.clear();
    }
    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return this.cache.getStats();
    }
    // ========================================================================
    // Provider 访问
    // ========================================================================
    /**
     * 获取底层 Provider
     */
    getProvider() {
        return this.provider;
    }
    /**
     * 获取 Provider 名称
     */
    getProviderName() {
        return this.provider.getProviderName();
    }
    /**
     * 获取当前模型
     */
    getModel() {
        return this.provider.getModel();
    }
    // ========================================================================
    // 私有方法
    // ========================================================================
    /**
     * 执行请求（带重试）
     */
    async executeWithRetry(request, context, options) {
        const maxRetries = options.maxRetries ?? this.config.retry.maxRetries;
        const timeout = options.timeout ?? this.config.defaultTimeout;
        let lastError = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            context.retryCount = attempt;
            try {
                // 创建超时 Promise
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Request timeout')), timeout);
                });
                // 创建请求 Promise
                const requestPromise = this.provider.chat(request);
                // 竞争执行
                const response = await Promise.race([requestPromise, timeoutPromise]);
                return response;
            }
            catch (error) {
                lastError = error;
                // 检查中断信号
                if (options.signal?.aborted) {
                    throw new Error('Request aborted');
                }
                // 检查是否可重试
                if (attempt < maxRetries && isRetryableError(lastError, this.config.retry.retryableErrors)) {
                    const backoff = Math.min(this.config.retry.initialBackoff * Math.pow(this.config.retry.backoffMultiplier, attempt), this.config.retry.maxBackoff);
                    await sleep(backoff);
                    continue;
                }
                throw lastError;
            }
        }
        throw lastError || new Error('Max retries exceeded');
    }
    /**
     * 检查速率限制
     */
    async checkRateLimit() {
        if (!this.config.rateLimit.enabled)
            return;
        const now = Date.now();
        // 检查是否需要重置窗口
        if (now - this.rateLimitState.windowStart >= this.config.rateLimit.windowMs) {
            this.rateLimitState = { count: 0, windowStart: now };
        }
        // 检查是否超过限制
        if (this.rateLimitState.count >= this.config.rateLimit.maxRequests) {
            const waitTime = this.config.rateLimit.windowMs - (now - this.rateLimitState.windowStart);
            if (waitTime > 0) {
                await sleep(waitTime);
                this.rateLimitState = { count: 0, windowStart: Date.now() };
            }
        }
        this.rateLimitState.count++;
    }
    /**
     * 创建结果对象
     */
    createResult(response, context, cached) {
        return {
            ...response,
            requestId: context.requestId,
            duration: Date.now() - context.startTime,
            cached,
            retryCount: context.retryCount,
        };
    }
    /**
     * 记录统计
     */
    recordStats(context, result, success, error) {
        this.stats.record({
            requestId: context.requestId,
            providerName: context.providerName,
            model: context.model,
            startTime: context.startTime,
            endTime: Date.now(),
            duration: Date.now() - context.startTime,
            usage: result?.usage,
            success,
            cached: result?.cached ?? false,
            retryCount: context.retryCount,
            error,
        });
    }
}
// ============================================================================
// 工厂函数
// ============================================================================
/**
 * 创建 LLM Service 实例
 */
export function createLLMService(provider, config = {}) {
    return new LLMService(provider, config);
}
//# sourceMappingURL=service.js.map