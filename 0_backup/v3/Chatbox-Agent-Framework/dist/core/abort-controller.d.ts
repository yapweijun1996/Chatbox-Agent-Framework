/**
 * Agent Abort Controller
 * 管理 Agent 执行的中断和恢复功能
 */
import type { Checkpoint, State } from './types';
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
/**
 * AgentAbortController
 * 封装 AbortController，提供 Agent 特定的中断控制功能
 */
export declare class AgentAbortController {
    private controller;
    private abortState;
    private checkpoints;
    constructor();
    /**
     * 获取 AbortSignal
     */
    get signal(): AbortSignal;
    /**
     * 检查是否已中断
     */
    get isAborted(): boolean;
    /**
     * 获取中断状态
     */
    getAbortState(): Readonly<AbortState>;
    /**
     * 中断执行
     */
    abort(reason?: string): void;
    /**
     * 重置控制器（用于恢复执行）
     */
    reset(): void;
    /**
     * 保存 checkpoint
     */
    saveCheckpoint(checkpoint: Checkpoint): void;
    /**
     * 获取 checkpoint
     */
    getCheckpoint(id: string): Checkpoint | undefined;
    /**
     * 获取最新的 checkpoint
     */
    getLatestCheckpoint(): Checkpoint | undefined;
    /**
     * 获取所有 checkpoints
     */
    listCheckpoints(): Checkpoint[];
    /**
     * 清除所有 checkpoints
     */
    clearCheckpoints(): void;
    /**
     * 检查是否应该继续执行
     * @throws 如果已中断则抛出 AbortError
     */
    throwIfAborted(): void;
    /**
     * 创建带中断检测的 Promise wrapper
     */
    wrapWithAbort<T>(promise: Promise<T>): Promise<T>;
}
/**
 * 检查错误是否为 AbortError
 */
export declare function isAbortError(error: unknown): boolean;
/**
 * 创建 AgentAbortController 实例
 */
export declare function createAbortController(): AgentAbortController;
//# sourceMappingURL=abort-controller.d.ts.map