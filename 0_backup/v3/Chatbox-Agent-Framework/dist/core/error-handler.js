/**
 * 错误处理系统
 * 错误分类、重试策略、降级、回滚
 */
import { ErrorType } from './types';
// 重新导出 ErrorType
export { ErrorType };
/**
 * 创建 AgentError
 */
export function createError(type, message, options) {
    return {
        type,
        message,
        nodeId: options?.nodeId,
        toolName: options?.toolName,
        retryable: options?.retryable ?? isRetryable(type),
        originalError: options?.originalError,
        timestamp: Date.now(),
    };
}
/**
 * 判断错误是否可重试
 */
function isRetryable(type) {
    switch (type) {
        case 'network':
        case 'timeout':
        case 'execution':
            return true;
        case 'permission':
        case 'validation':
        case 'budget_exceeded':
            return false;
        default:
            return false;
    }
}
/**
 * 获取错误处理策略
 */
export function getErrorStrategy(error, retryCount, maxRetries) {
    // 预算超限 -> 直接终止
    if (error.type === 'budget_exceeded') {
        return {
            shouldRetry: false,
            shouldDegrade: false,
            shouldRollback: false,
            shouldTerminate: true,
            suggestion: '已达到预算限制，请检查配置或优化工具调用',
        };
    }
    // 权限错误 -> 直接终止
    if (error.type === 'permission') {
        return {
            shouldRetry: false,
            shouldDegrade: false,
            shouldRollback: false,
            shouldTerminate: true,
            suggestion: '权限不足，请检查工具权限配置',
        };
    }
    // 校验错误 -> 尝试降级或终止
    if (error.type === 'validation') {
        return {
            shouldRetry: false,
            shouldDegrade: true,
            shouldRollback: false,
            shouldTerminate: !error.retryable,
            suggestion: '输入或输出校验失败，请检查工具契约',
        };
    }
    // 可重试错误
    if (error.retryable && retryCount < maxRetries) {
        return {
            shouldRetry: true,
            shouldDegrade: false,
            shouldRollback: false,
            shouldTerminate: false,
            suggestion: `将在 ${getBackoffDelay(retryCount)}ms 后重试 (${retryCount + 1}/${maxRetries})`,
        };
    }
    // 重试次数耗尽 -> 尝试降级
    if (retryCount >= maxRetries) {
        return {
            shouldRetry: false,
            shouldDegrade: true,
            shouldRollback: false,
            shouldTerminate: false,
            suggestion: '重试次数已耗尽，尝试降级策略',
        };
    }
    // 默认终止
    return {
        shouldRetry: false,
        shouldDegrade: false,
        shouldRollback: false,
        shouldTerminate: true,
        suggestion: '无法恢复的错误',
    };
}
/**
 * 计算指数退避延迟
 */
export function getBackoffDelay(retryCount, baseMs = 1000, multiplier = 2) {
    return baseMs * Math.pow(multiplier, retryCount);
}
/**
 * 执行重试（带指数退避）
 */
export async function retryWithBackoff(fn, maxRetries, baseMs = 1000, multiplier = 2) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (i < maxRetries) {
                const delay = getBackoffDelay(i, baseMs, multiplier);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}
/**
 * 回滚到 checkpoint
 */
export function rollbackToCheckpoint(checkpoint) {
    return checkpoint.state;
}
/**
 * 格式化错误信息（用户友好）
 */
export function formatErrorMessage(error) {
    const parts = [`[${error.type.toUpperCase()}]`, error.message];
    if (error.nodeId) {
        parts.push(`(节点: ${error.nodeId})`);
    }
    if (error.toolName) {
        parts.push(`(工具: ${error.toolName})`);
    }
    return parts.join(' ');
}
// ============================================================================
// 辅助函数
// ============================================================================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=error-handler.js.map