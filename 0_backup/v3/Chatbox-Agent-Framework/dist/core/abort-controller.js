/**
 * Agent Abort Controller
 * 管理 Agent 执行的中断和恢复功能
 */
// ============================================================================
// AgentAbortController 类
// ============================================================================
/**
 * AgentAbortController
 * 封装 AbortController，提供 Agent 特定的中断控制功能
 */
export class AgentAbortController {
    controller;
    abortState = { aborted: false };
    checkpoints = new Map();
    constructor() {
        this.controller = new AbortController();
    }
    /**
     * 获取 AbortSignal
     */
    get signal() {
        return this.controller.signal;
    }
    /**
     * 检查是否已中断
     */
    get isAborted() {
        return this.abortState.aborted;
    }
    /**
     * 获取中断状态
     */
    getAbortState() {
        return { ...this.abortState };
    }
    /**
     * 中断执行
     */
    abort(reason) {
        if (this.abortState.aborted)
            return;
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
    reset() {
        this.controller = new AbortController();
        this.abortState = { aborted: false };
    }
    /**
     * 保存 checkpoint
     */
    saveCheckpoint(checkpoint) {
        this.checkpoints.set(checkpoint.id, checkpoint);
        this.abortState.checkpoint = checkpoint;
    }
    /**
     * 获取 checkpoint
     */
    getCheckpoint(id) {
        return this.checkpoints.get(id);
    }
    /**
     * 获取最新的 checkpoint
     */
    getLatestCheckpoint() {
        return this.abortState.checkpoint;
    }
    /**
     * 获取所有 checkpoints
     */
    listCheckpoints() {
        return Array.from(this.checkpoints.values())
            .sort((a, b) => b.timestamp - a.timestamp);
    }
    /**
     * 清除所有 checkpoints
     */
    clearCheckpoints() {
        this.checkpoints.clear();
        if (this.abortState.checkpoint) {
            delete this.abortState.checkpoint;
        }
    }
    /**
     * 检查是否应该继续执行
     * @throws 如果已中断则抛出 AbortError
     */
    throwIfAborted() {
        if (this.controller.signal.aborted) {
            const error = new Error(this.abortState.reason || 'Operation aborted');
            error.name = 'AbortError';
            throw error;
        }
    }
    /**
     * 创建带中断检测的 Promise wrapper
     */
    wrapWithAbort(promise) {
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
export function isAbortError(error) {
    if (error instanceof Error) {
        return error.name === 'AbortError' || error.message.includes('aborted');
    }
    return false;
}
/**
 * 创建 AgentAbortController 实例
 */
export function createAbortController() {
    return new AgentAbortController();
}
//# sourceMappingURL=abort-controller.js.map