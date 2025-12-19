/**
 * LLM Service 核心实现
 * 提供统一的 LLM 调用接口，支持中间件、缓存、重试、统计等功能
 */
import { LLMProvider, type ChatRequest } from '../llm-provider';
import type { LLMRequestOptions, LLMResult, LLMStreamResult, LLMRequestMiddleware, LLMResponseMiddleware, LLMErrorMiddleware, LLMServiceConfig, LLMAggregateStats, LLMCallStats } from './types';
/**
 * LLM Service
 * 高级 LLM 调用服务，封装 Provider 并提供附加功能
 */
export declare class LLMService {
    private provider;
    private config;
    private cache;
    private stats;
    private requestMiddlewares;
    private responseMiddlewares;
    private errorMiddlewares;
    private rateLimitState;
    constructor(provider: LLMProvider, config?: Partial<LLMServiceConfig>);
    /**
     * 发送聊天请求（非流式）
     */
    chat(request: ChatRequest, options?: LLMRequestOptions): Promise<LLMResult>;
    /**
     * 发送聊天请求（流式）
     */
    chatStream(request: ChatRequest, options?: LLMRequestOptions): Promise<LLMStreamResult>;
    /**
     * 简便方法：发送单条消息
     */
    complete(prompt: string, systemPrompt?: string, options?: LLMRequestOptions): Promise<string>;
    /**
     * 添加请求中间件
     */
    useRequest(middleware: LLMRequestMiddleware): this;
    /**
     * 添加响应中间件
     */
    useResponse(middleware: LLMResponseMiddleware): this;
    /**
     * 添加错误中间件
     */
    useError(middleware: LLMErrorMiddleware): this;
    /**
     * 移除中间件
     */
    removeMiddleware(name: string): boolean;
    /**
     * 获取聚合统计
     */
    getStats(): LLMAggregateStats;
    /**
     * 获取最近的调用记录
     */
    getRecentCalls(count?: number): LLMCallStats[];
    /**
     * 导出统计数据
     */
    exportStats(): {
        history: LLMCallStats[];
        aggregate: LLMAggregateStats;
        exportedAt: number;
    };
    /**
     * 清空统计
     */
    clearStats(): void;
    /**
     * 清空缓存
     */
    clearCache(): void;
    /**
     * 获取缓存统计
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
    };
    /**
     * 获取底层 Provider
     */
    getProvider(): LLMProvider;
    /**
     * 获取 Provider 名称
     */
    getProviderName(): string;
    /**
     * 获取当前模型
     */
    getModel(): string;
    /**
     * 执行请求（带重试）
     */
    private executeWithRetry;
    /**
     * 检查速率限制
     */
    private checkRateLimit;
    /**
     * 创建结果对象
     */
    private createResult;
    /**
     * 记录统计
     */
    private recordStats;
}
/**
 * 创建 LLM Service 实例
 */
export declare function createLLMService(provider: LLMProvider, config?: Partial<LLMServiceConfig>): LLMService;
//# sourceMappingURL=service.d.ts.map