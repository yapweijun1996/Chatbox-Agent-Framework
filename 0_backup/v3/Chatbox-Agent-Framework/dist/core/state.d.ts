/**
 * State 管理器
 * 提供 State 的创建、更新、序列化功能
 */
import type { State, Policy } from './types';
/**
 * 创建初始 State
 */
export declare function createState(goal: string, policy?: Partial<Policy>): State;
/**
 * 更新 State（不可变更新）
 * 使用深拷贝确保不可变性
 */
export declare function updateState(state: State, updater: (draft: State) => void | State): State;
/**
 * 序列化 State
 */
export declare function serializeState(state: State): string;
/**
 * 反序列化 State
 */
export declare function deserializeState(json: string): State;
/**
 * 验证 State 完整性
 */
export declare function validateState(state: State): boolean;
/**
 * 便捷的 State 更新辅助函数
 */
export declare const StateHelpers: {
    /** 添加消息 */
    addMessage(state: State, role: "user" | "assistant" | "system" | "tool", content: string): State;
    /** 更新任务进度 */
    updateProgress(state: State, progress: number): State;
    /** 设置当前节点 */
    setCurrentNode(state: State, nodeId: string): State;
    /** 添加工具调用计数 */
    incrementToolCall(state: State): State;
    /** 添加错误计数 */
    incrementError(state: State): State;
    /** 添加重试计数 */
    incrementRetry(state: State): State;
    /** 记录节点耗时 */
    recordNodeTiming(state: State, nodeId: string, duration: number): State;
    /** 记录 Token 使用情况 */
    addTokenUsage(state: State, usage: {
        prompt?: number;
        completion?: number;
        total?: number;
    }): State;
    /** 检查预算是否超限 */
    checkBudget(state: State): {
        exceeded: boolean;
        reason?: string;
    };
};
//# sourceMappingURL=state.d.ts.map