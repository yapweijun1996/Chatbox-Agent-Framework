/**
 * 错误处理系统
 * 错误分类、重试策略、降级、回滚
 */
import type { AgentError, State, Checkpoint } from './types';
import { ErrorType } from './types';
export { ErrorType };
/**
 * 创建 AgentError
 */
export declare function createError(type: ErrorType, message: string, options?: {
    nodeId?: string;
    toolName?: string;
    retryable?: boolean;
    originalError?: Error;
}): AgentError;
/**
 * 错误处理策略
 */
export interface ErrorStrategy {
    shouldRetry: boolean;
    shouldDegrade: boolean;
    shouldRollback: boolean;
    shouldTerminate: boolean;
    suggestion?: string;
}
/**
 * 获取错误处理策略
 */
export declare function getErrorStrategy(error: AgentError, retryCount: number, maxRetries: number): ErrorStrategy;
/**
 * 计算指数退避延迟
 */
export declare function getBackoffDelay(retryCount: number, baseMs?: number, multiplier?: number): number;
/**
 * 执行重试（带指数退避）
 */
export declare function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number, baseMs?: number, multiplier?: number): Promise<T>;
/**
 * 降级策略示例
 * 实际项目中应根据具体场景实现
 */
export interface DegradationOptions {
    alternativeTool?: string;
    simplifiedInput?: unknown;
    fallbackValue?: unknown;
}
/**
 * 回滚到 checkpoint
 */
export declare function rollbackToCheckpoint(checkpoint: Checkpoint): State;
/**
 * 格式化错误信息（用户友好）
 */
export declare function formatErrorMessage(error: AgentError): string;
//# sourceMappingURL=error-handler.d.ts.map