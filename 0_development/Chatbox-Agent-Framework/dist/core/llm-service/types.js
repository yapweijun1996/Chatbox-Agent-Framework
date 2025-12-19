/**
 * LLM Service 类型定义
 * 统一 LLM 调用的请求/响应类型与中间件接口
 */
/**
 * 默认服务配置
 */
export const DEFAULT_LLM_SERVICE_CONFIG = {
    defaultTimeout: 60000,
    retry: {
        maxRetries: 3,
        initialBackoff: 1000,
        maxBackoff: 30000,
        backoffMultiplier: 2,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'fetch failed', 'network error'],
    },
    cache: {
        enabled: false,
        ttl: 5 * 60 * 1000, // 5 分钟
        maxEntries: 100,
    },
    rateLimit: {
        enabled: false,
        windowMs: 60000, // 1 分钟
        maxRequests: 60,
    },
    enableStats: true,
    maxStatsHistory: 1000,
};
//# sourceMappingURL=types.js.map