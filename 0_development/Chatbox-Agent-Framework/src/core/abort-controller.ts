/**
 * Agent Abort Controller
 * 管理 Agent 执行的中断和恢复功能
 */

import type { Checkpoint, State } from './types';

// ============================================================================
// 类型定义
// ============================================================================

export interface AbortState {
    aborted: boolean;
    reason?: string;
    timestamp?: number;
    checkpoint?: Checkpoint;
}

export interface ResumeOptions {
    fromCheckpoint?: string;
    modifiedState?: Partial<State>;
}

// ============================================================================
// AgentAbortController 类
// ============================================================================

/**
 * AgentAbortController
 * 封装 AbortController，提供 Agent 特定的中断控制功能
 */
export class AgentAbortController {
    private controller: AbortController;
    private abortState: AbortState = { aborted: false };
    private checkpoints: Map<string, Checkpoint> = new Map();

    constructor() {
        this.controller = new AbortController();
    }

    /**
     * 获取 AbortSignal
     */
    get signal(): AbortSignal {
        return this.controller.signal;
    }

    /**
     * 检查是否已中断
     */
    get isAborted(): boolean {
        return this.abortState.aborted;
    }

    /**
     * 获取中断状态
     */
    getAbortState(): Readonly<AbortState> {
        return { ...this.abortState };
    }

    /**
     * 中断执行
     */
    abort(reason?: string): void {
        if (this.abortState.aborted) return;

        this.abortState = {
            aborted: true,
            reason: reason || 'User initiated abort',
            timestamp: Date.now(),
        };
        this.controller.abort(reason);
    }

    /**
     * 重置控制器（用于恢复执行）
     */
    reset(): void {
        this.controller = new AbortController();
        this.abortState = { aborted: false };
    }

    /**
     * 保存 checkpoint
     */
    saveCheckpoint(checkpoint: Checkpoint): void {
        this.checkpoints.set(checkpoint.id, checkpoint);
        this.abortState.checkpoint = checkpoint;
    }

    /**
     * 获取 checkpoint
     */
    getCheckpoint(id: string): Checkpoint | undefined {
        return this.checkpoints.get(id);
    }

    /**
     * 获取最新的 checkpoint
     */
    getLatestCheckpoint(): Checkpoint | undefined {
        return this.abortState.checkpoint;
    }

    /**
     * 获取所有 checkpoints
     */
    listCheckpoints(): Checkpoint[] {
        return Array.from(this.checkpoints.values())
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * 清除所有 checkpoints
     */
    clearCheckpoints(): void {
        this.checkpoints.clear();
        if (this.abortState.checkpoint) {
            delete this.abortState.checkpoint;
        }
    }

    /**
     * 检查是否应该继续执行
     * @throws 如果已中断则抛出 AbortError
     */
    throwIfAborted(): void {
        if (this.controller.signal.aborted) {
            const error = new Error(this.abortState.reason || 'Operation aborted');
            error.name = 'AbortError';
            throw error;
        }
    }

    /**
     * 创建带中断检测的 Promise wrapper
     */
    wrapWithAbort<T>(promise: Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            // 如果已经中断，直接拒绝
            if (this.controller.signal.aborted) {
                const error = new Error(this.abortState.reason || 'Operation aborted');
                error.name = 'AbortError';
                reject(error);
                return;
            }

            // 监听中断事件
            const abortHandler = () => {
                const error = new Error(this.abortState.reason || 'Operation aborted');
                error.name = 'AbortError';
                reject(error);
            };
            this.controller.signal.addEventListener('abort', abortHandler);

            // 执行原始 promise
            promise
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    this.controller.signal.removeEventListener('abort', abortHandler);
                });
        });
    }
}

/**
 * 检查错误是否为 AbortError
 */
export function isAbortError(error: unknown): boolean {
    if (error instanceof Error) {
        return error.name === 'AbortError' || error.message.includes('aborted');
    }
    return false;
}

/**
 * 创建 AgentAbortController 实例
 */
export function createAbortController(): AgentAbortController {
    return new AgentAbortController();
}
