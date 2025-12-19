/**
 * 内置中间件
 * 提供常用的请求/响应/错误处理中间件
 */
import type { LLMRequestContext, LLMRequestMiddleware, LLMResponseMiddleware, LLMErrorMiddleware } from './types';
/**
 * 请求日志中间件 - 记录请求信息
 */
export declare function createRequestLoggingMiddleware(logger?: (message: string, data?: unknown) => void): LLMRequestMiddleware;
/**
 * 响应日志中间件 - 记录响应信息
 */
export declare function createResponseLoggingMiddleware(logger?: (message: string, data?: unknown) => void): LLMResponseMiddleware;
/**
 * 日志中间件工厂 - 同时创建请求和响应日志中间件
 */
export declare function createLoggingMiddleware(logger?: (message: string, data?: unknown) => void): {
    request: LLMRequestMiddleware;
    response: LLMResponseMiddleware;
};
/**
 * 系统提示注入中间件
 */
export declare function createSystemPromptMiddleware(systemPrompt: string, options?: {
    prepend?: boolean;
    override?: boolean;
}): LLMRequestMiddleware;
/**
 * 消息过滤中间件 - 过滤敏感内容
 */
export declare function createContentFilterMiddleware(filterPatterns: Array<{
    pattern: RegExp;
    replacement: string;
}>): LLMRequestMiddleware;
/**
 * 消息截断中间件 - 限制消息长度
 */
export declare function createTruncationMiddleware(maxMessages: number, options?: {
    keepSystemPrompt?: boolean;
    keepLatestN?: number;
}): LLMRequestMiddleware;
/**
 * 响应验证中间件
 */
export declare function createValidationMiddleware(validator: (content: string) => boolean, onInvalid?: (content: string) => string): LLMResponseMiddleware;
/**
 * 响应转换中间件
 */
export declare function createTransformMiddleware(transformer: (content: string) => string): LLMResponseMiddleware;
/**
 * JSON 解析中间件
 */
export declare function createJsonParseMiddleware(options?: {
    strict?: boolean;
    defaultValue?: unknown;
}): LLMResponseMiddleware;
/**
 * 降级中间件 - 返回默认响应
 */
export declare function createFallbackMiddleware(fallbackContent: string | ((error: Error, context: LLMRequestContext) => string)): LLMErrorMiddleware;
/**
 * 错误日志中间件
 */
export declare function createErrorLoggingMiddleware(logger?: (message: string, error: Error, context: LLMRequestContext) => void): LLMErrorMiddleware;
/**
 * 错误转换中间件 - 转换错误类型
 */
export declare function createErrorTransformMiddleware(transformer: (error: Error, context: LLMRequestContext) => Error): LLMErrorMiddleware;
//# sourceMappingURL=middlewares.d.ts.map