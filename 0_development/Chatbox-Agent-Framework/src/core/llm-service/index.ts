/**
 * LLM Service 模块导出
 */

// 核心服务
export { LLMService, createLLMService } from './service';

// 类型
export type {
    LLMRequestOptions,
    LLMRequestContext,
    LLMResult,
    LLMStreamResult,
    LLMRequestMiddleware,
    LLMResponseMiddleware,
    LLMErrorMiddleware,
    LLMCallStats,
    LLMAggregateStats,
    ProviderStats,
    ModelStats,
    RetryConfig,
    CacheConfig,
    RateLimitConfig,
    LLMServiceConfig,
} from './types';

export { DEFAULT_LLM_SERVICE_CONFIG } from './types';

// 缓存
export { LLMCache } from './cache';

// 统计
export { LLMStatsCollector } from './stats';

// 内置中间件
export {
    // 请求中间件
    createRequestLoggingMiddleware,
    createLoggingMiddleware,
    createSystemPromptMiddleware,
    createContentFilterMiddleware,
    createTruncationMiddleware,
    // 响应中间件
    createResponseLoggingMiddleware,
    createValidationMiddleware,
    createTransformMiddleware,
    createJsonParseMiddleware,
    // 错误中间件
    createFallbackMiddleware,
    createErrorLoggingMiddleware,
    createErrorTransformMiddleware,
} from './middlewares';
