/**
 * LLM Service 类型定义
 * 统一 LLM 调用的请求/响应类型与中间件接口
 */

import type { ChatMessage, ChatRequest, ChatResponse, ChatStreamChunk, TokenUsage } from '../llm-provider';

// ============================================================================
// 请求/响应类型扩展
// ============================================================================

/**
 * 扩展的请求选项
 */
export interface LLMRequestOptions {
    /** 中断信号 */
    signal?: AbortSignal;
    /** 是否跳过缓存 */
    skipCache?: boolean;
    /** 请求优先级 */
    priority?: 'low' | 'normal' | 'high';
    /** 自定义元数据 */
    metadata?: Record<string, unknown>;
    /** 超时时间（覆盖默认值） */
    timeout?: number;
    /** 最大重试次数（覆盖默认值） */
    maxRetries?: number;
}

/**
 * 扩展的请求上下文
 */
export interface LLMRequestContext {
    /** 唯一请求 ID */
    requestId: string;
    /** 请求开始时间 */
    startTime: number;
    /** Provider 名称 */
    providerName: string;
    /** 模型名称 */
    model: string;
    /** 重试次数 */
    retryCount: number;
    /** 原始请求 */
    request: ChatRequest;
    /** 请求选项 */
    options: LLMRequestOptions;
}

/**
 * 扩展的响应结果
 */
export interface LLMResult extends ChatResponse {
    /** 请求 ID */
    requestId: string;
    /** 耗时（毫秒） */
    duration: number;
    /** 是否来自缓存 */
    cached: boolean;
    /** 重试次数 */
    retryCount: number;
}

/**
 * 流式响应结果
 */
export interface LLMStreamResult {
    /** 请求 ID */
    requestId: string;
    /** 流式生成器 */
    stream: AsyncGenerator<ChatStreamChunk>;
    /** 中断方法 */
    abort: () => void;
}

// ============================================================================
// 中间件接口
// ============================================================================

/**
 * 请求中间件 - 在请求发送前执行
 */
export interface LLMRequestMiddleware {
    name: string;
    /** 处理请求，返回修改后的请求或抛出错误以中止 */
    process(
        request: ChatRequest,
        context: LLMRequestContext
    ): Promise<ChatRequest> | ChatRequest;
}

/**
 * 响应中间件 - 在响应返回后执行
 */
export interface LLMResponseMiddleware {
    name: string;
    /** 处理响应，返回修改后的响应 */
    process(
        response: ChatResponse,
        context: LLMRequestContext
    ): Promise<ChatResponse> | ChatResponse;
}

/**
 * 错误中间件 - 在发生错误时执行
 */
export interface LLMErrorMiddleware {
    name: string;
    /** 处理错误，可以恢复、修改或重新抛出 */
    process(
        error: Error,
        context: LLMRequestContext
    ): Promise<ChatResponse | null> | ChatResponse | null;
}

// ============================================================================
// 统计类型
// ============================================================================

/**
 * 单次调用统计
 */
export interface LLMCallStats {
    requestId: string;
    providerName: string;
    model: string;
    startTime: number;
    endTime: number;
    duration: number;
    usage?: TokenUsage;
    success: boolean;
    cached: boolean;
    retryCount: number;
    error?: string;
}

/**
 * 聚合统计
 */
export interface LLMAggregateStats {
    /** 总请求数 */
    totalRequests: number;
    /** 成功请求数 */
    successfulRequests: number;
    /** 失败请求数 */
    failedRequests: number;
    /** 缓存命中数 */
    cacheHits: number;
    /** 总 token 数 */
    totalTokens: number;
    /** 总 prompt token 数 */
    totalPromptTokens: number;
    /** 总 completion token 数 */
    totalCompletionTokens: number;
    /** 总耗时 */
    totalDuration: number;
    /** 平均响应时间 */
    averageDuration: number;
    /** 按 provider 的统计 */
    byProvider: Record<string, ProviderStats>;
    /** 按模型的统计 */
    byModel: Record<string, ModelStats>;
}

/**
 * Provider 统计
 */
export interface ProviderStats {
    requests: number;
    successes: number;
    failures: number;
    totalTokens: number;
    totalDuration: number;
}

/**
 * 模型统计
 */
export interface ModelStats {
    requests: number;
    successes: number;
    failures: number;
    totalTokens: number;
    averageTokensPerRequest: number;
}

// ============================================================================
// 服务配置
// ============================================================================

/**
 * 重试策略配置
 */
export interface RetryConfig {
    /** 最大重试次数 */
    maxRetries: number;
    /** 初始退避时间（毫秒） */
    initialBackoff: number;
    /** 最大退避时间（毫秒） */
    maxBackoff: number;
    /** 退避倍数 */
    backoffMultiplier: number;
    /** 可重试的错误类型 */
    retryableErrors: string[];
}

/**
 * 缓存配置
 */
export interface CacheConfig {
    /** 是否启用缓存 */
    enabled: boolean;
    /** 缓存 TTL（毫秒） */
    ttl: number;
    /** 最大缓存条目数 */
    maxEntries: number;
    /** 缓存键生成函数 */
    keyGenerator?: (request: ChatRequest) => string;
}

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
    /** 是否启用 */
    enabled: boolean;
    /** 时间窗口（毫秒） */
    windowMs: number;
    /** 窗口内最大请求数 */
    maxRequests: number;
}

/**
 * LLM Service 完整配置
 */
export interface LLMServiceConfig {
    /** 默认超时时间（毫秒） */
    defaultTimeout: number;
    /** 重试配置 */
    retry: RetryConfig;
    /** 缓存配置 */
    cache: CacheConfig;
    /** 速率限制配置 */
    rateLimit: RateLimitConfig;
    /** 是否启用统计收集 */
    enableStats: boolean;
    /** 统计保留的最大历史条目数 */
    maxStatsHistory: number;
}

/**
 * 默认服务配置
 */
export const DEFAULT_LLM_SERVICE_CONFIG: LLMServiceConfig = {
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
