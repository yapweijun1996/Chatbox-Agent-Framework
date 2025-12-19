/**
 * AgentAbortController 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    AgentAbortController,
    createAbortController,
    isAbortError
} from '../../src/core/abort-controller';
import type { Checkpoint, State } from '../../src/core/types';

// Mock State 创建
function createMockState(): State {
    return {
        id: 'test-state',
        conversation: {
            messages: [],
            toolResultsSummary: [],
        },
        task: {
            goal: 'Test goal',
            steps: [],
            currentNode: '',
            currentStepIndex: 0,
            progress: 0,
        },
        memory: {
            shortTerm: {},
            longTermKeys: [],
        },
        artifacts: {},
        telemetry: {
            totalDuration: 0,
            tokenCount: 0,
            toolCallCount: 0,
            errorCount: 0,
            retryCount: 0,
            nodeTimings: {},
        },
        policy: {
            maxToolCalls: 10,
            maxDuration: 30000,
            maxRetries: 3,
            permissions: {},
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

// Mock Checkpoint 创建
function createMockCheckpoint(id: string, timestamp?: number): Checkpoint {
    return {
        id,
        stateId: 'state-1',
        state: createMockState(),
        eventIndex: 0,
        timestamp: timestamp || Date.now(),
    };
}

describe('AgentAbortController', () => {
    let controller: AgentAbortController;

    beforeEach(() => {
        controller = new AgentAbortController();
    });

    describe('初始化状态', () => {
        it('should start with aborted = false', () => {
            expect(controller.isAborted).toBe(false);
        });

        it('should provide a valid AbortSignal', () => {
            expect(controller.signal).toBeDefined();
            expect(controller.signal.aborted).toBe(false);
        });

        it('should return empty abort state initially', () => {
            const state = controller.getAbortState();
            expect(state.aborted).toBe(false);
            expect(state.reason).toBeUndefined();
            expect(state.timestamp).toBeUndefined();
        });
    });

    describe('abort()', () => {
        it('should set aborted to true', () => {
            controller.abort();
            expect(controller.isAborted).toBe(true);
        });

        it('should set abort reason', () => {
            controller.abort('User cancelled');
            expect(controller.getAbortState().reason).toBe('User cancelled');
        });

        it('should use default reason when not provided', () => {
            controller.abort();
            expect(controller.getAbortState().reason).toBe('User initiated abort');
        });

        it('should set timestamp', () => {
            const before = Date.now();
            controller.abort();
            const after = Date.now();

            const timestamp = controller.getAbortState().timestamp!;
            expect(timestamp).toBeGreaterThanOrEqual(before);
            expect(timestamp).toBeLessThanOrEqual(after);
        });

        it('should abort the signal', () => {
            controller.abort('Test');
            expect(controller.signal.aborted).toBe(true);
        });

        it('should only abort once (idempotent)', () => {
            controller.abort('First reason');
            controller.abort('Second reason');

            expect(controller.getAbortState().reason).toBe('First reason');
        });
    });

    describe('reset()', () => {
        it('should reset aborted state', () => {
            controller.abort();
            expect(controller.isAborted).toBe(true);

            controller.reset();
            expect(controller.isAborted).toBe(false);
        });

        it('should create new AbortController', () => {
            const oldSignal = controller.signal;
            controller.abort();
            controller.reset();

            expect(controller.signal).not.toBe(oldSignal);
            expect(controller.signal.aborted).toBe(false);
        });

        it('should clear abort state', () => {
            controller.abort('Test');
            controller.reset();

            const state = controller.getAbortState();
            expect(state.aborted).toBe(false);
            expect(state.reason).toBeUndefined();
        });
    });

    describe('throwIfAborted()', () => {
        it('should not throw when not aborted', () => {
            expect(() => controller.throwIfAborted()).not.toThrow();
        });

        it('should throw AbortError when aborted', () => {
            controller.abort('Test reason');

            expect(() => controller.throwIfAborted()).toThrow();

            try {
                controller.throwIfAborted();
            } catch (error) {
                expect((error as Error).name).toBe('AbortError');
                expect((error as Error).message).toBe('Test reason');
            }
        });
    });

    describe('wrapWithAbort()', () => {
        it('should resolve normally when not aborted', async () => {
            const result = await controller.wrapWithAbort(Promise.resolve('success'));
            expect(result).toBe('success');
        });

        it('should reject immediately if already aborted', async () => {
            controller.abort('Pre-aborted');

            await expect(controller.wrapWithAbort(Promise.resolve('test')))
                .rejects.toThrow('Pre-aborted');
        });

        it('should reject when aborted during execution', async () => {
            const longPromise = new Promise((resolve) => {
                setTimeout(() => resolve('done'), 500);
            });

            // Abort after a short delay
            setTimeout(() => controller.abort('Mid-execution abort'), 50);

            await expect(controller.wrapWithAbort(longPromise))
                .rejects.toThrow();
        });

        it('should propagate original promise errors', async () => {
            const failingPromise = Promise.reject(new Error('Original error'));

            await expect(controller.wrapWithAbort(failingPromise))
                .rejects.toThrow('Original error');
        });
    });

    describe('Checkpoint 管理', () => {
        it('should save checkpoint', () => {
            const checkpoint = createMockCheckpoint('cp-1');
            controller.saveCheckpoint(checkpoint);

            expect(controller.getCheckpoint('cp-1')).toEqual(checkpoint);
        });

        it('should return undefined for non-existent checkpoint', () => {
            expect(controller.getCheckpoint('non-existent')).toBeUndefined();
        });

        it('should update latest checkpoint on save', () => {
            const cp1 = createMockCheckpoint('cp-1', 1000);
            const cp2 = createMockCheckpoint('cp-2', 2000);

            controller.saveCheckpoint(cp1);
            expect(controller.getLatestCheckpoint()?.id).toBe('cp-1');

            controller.saveCheckpoint(cp2);
            expect(controller.getLatestCheckpoint()?.id).toBe('cp-2');
        });

        it('should list checkpoints sorted by timestamp (newest first)', () => {
            controller.saveCheckpoint(createMockCheckpoint('cp-1', 1000));
            controller.saveCheckpoint(createMockCheckpoint('cp-2', 3000));
            controller.saveCheckpoint(createMockCheckpoint('cp-3', 2000));

            const list = controller.listCheckpoints();

            expect(list.map(c => c.id)).toEqual(['cp-2', 'cp-3', 'cp-1']);
        });

        it('should clear all checkpoints', () => {
            controller.saveCheckpoint(createMockCheckpoint('cp-1'));
            controller.saveCheckpoint(createMockCheckpoint('cp-2'));

            expect(controller.listCheckpoints().length).toBe(2);

            controller.clearCheckpoints();

            expect(controller.listCheckpoints().length).toBe(0);
            expect(controller.getLatestCheckpoint()).toBeUndefined();
        });
    });
});

describe('createAbortController()', () => {
    it('should create an AgentAbortController instance', () => {
        const controller = createAbortController();
        expect(controller).toBeInstanceOf(AgentAbortController);
    });
});

describe('isAbortError()', () => {
    it('should return true for Error with name "AbortError"', () => {
        const error = new Error('Test');
        error.name = 'AbortError';
        expect(isAbortError(error)).toBe(true);
    });

    it('should return true for Error containing "aborted" in message', () => {
        expect(isAbortError(new Error('Operation was aborted'))).toBe(true);
        expect(isAbortError(new Error('Request aborted by user'))).toBe(true);
    });

    it('should return false for regular errors', () => {
        expect(isAbortError(new Error('Network error'))).toBe(false);
        expect(isAbortError(new Error('Timeout'))).toBe(false);
    });

    it('should return false for non-Error values', () => {
        expect(isAbortError(null)).toBe(false);
        expect(isAbortError(undefined)).toBe(false);
        expect(isAbortError('error string')).toBe(false);
        expect(isAbortError(42)).toBe(false);
        expect(isAbortError({ message: 'error' })).toBe(false);
    });
});
