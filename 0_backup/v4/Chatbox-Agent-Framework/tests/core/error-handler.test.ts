import { describe, it, expect, vi } from 'vitest';
import {
    createError,
    getErrorStrategy,
    getBackoffDelay,
    retryWithBackoff,
    ErrorType,
    formatErrorMessage
} from '../../src/core/error-handler';

describe('Error Handler', () => {
    describe('createError', () => {
        it('should create an AgentError with correct properties', () => {
            const error = createError(ErrorType.EXECUTION, 'test error', {
                nodeId: 'node-1',
                toolName: 'tool-1'
            });

            expect(error.type).toBe(ErrorType.EXECUTION);
            expect(error.message).toBe('test error');
            expect(error.nodeId).toBe('node-1');
            expect(error.toolName).toBe('tool-1');
            expect(error.timestamp).toBeDefined();
        });

        it('should determine retryable default based on error type', () => {
            const networkError = createError(ErrorType.NETWORK, 'net');
            expect(networkError.retryable).toBe(true);

            const permissionError = createError(ErrorType.PERMISSION, 'perm');
            expect(permissionError.retryable).toBe(false);
        });
    });

    describe('getErrorStrategy', () => {
        it('should terminate on budget exceeded', () => {
            const error = createError(ErrorType.BUDGET_EXCEEDED, 'budget');
            const strategy = getErrorStrategy(error, 0, 3);
            expect(strategy.shouldTerminate).toBe(true);
            expect(strategy.shouldRetry).toBe(false);
        });

        it('should retry on retryable error within limit', () => {
            const error = createError(ErrorType.NETWORK, 'net');
            const strategy = getErrorStrategy(error, 1, 3);
            expect(strategy.shouldRetry).toBe(true);
            expect(strategy.suggestion).toContain('重试');
        });

        it('should degrade when retries exhausted', () => {
            const error = createError(ErrorType.NETWORK, 'net');
            const strategy = getErrorStrategy(error, 3, 3);
            expect(strategy.shouldRetry).toBe(false);
            expect(strategy.shouldDegrade).toBe(true);
        });
    });

    describe('getBackoffDelay', () => {
        it('should calculate exponential backoff', () => {
            expect(getBackoffDelay(0, 100, 2)).toBe(100);
            expect(getBackoffDelay(1, 100, 2)).toBe(200);
            expect(getBackoffDelay(2, 100, 2)).toBe(400);
        });
    });

    describe('retryWithBackoff', () => {
        it('should return result on success', async () => {
            const fn = vi.fn().mockResolvedValue('success');
            const result = await retryWithBackoff(fn, 3);
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('fail 1'))
                .mockResolvedValue('success');
            
            const result = await retryWithBackoff(fn, 3, 10); // short delay for test
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should throw after max retries', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('fail'));
            
            await expect(retryWithBackoff(fn, 2, 10)).rejects.toThrow('fail');
            expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
        });
    });

    describe('formatErrorMessage', () => {
        it('should format error message correctly', () => {
            const error = createError(ErrorType.EXECUTION, 'failed', {
                nodeId: 'node-1',
                toolName: 'tool-A'
            });
            const msg = formatErrorMessage(error);
            expect(msg).toContain('[EXECUTION]');
            expect(msg).toContain('failed');
            expect(msg).toContain('(节点: node-1)');
            expect(msg).toContain('(工具: tool-A)');
        });
    });
});