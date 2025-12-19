/**
 * State 管理器
 * 提供 State 的创建、更新、序列化功能
 */

import type { State, Conversation, Task, Memory, Artifacts, Telemetry, Policy } from './types';

/**
 * 创建初始 State
 */
export function createState(goal: string, policy?: Partial<Policy>): State {
    const now = Date.now();

    return {
        id: generateId(),
        conversation: {
            messages: [],
            toolResultsSummary: [],
        },
        task: {
            goal,
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
            maxToolCalls: 20,
            maxDuration: 300000, // 5 分钟
            maxRetries: 3,
            permissions: {},
            useStreaming: true, // 默认启用流式
            ...policy,
        },
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * 更新 State（不可变更新）
 * 使用深拷贝确保不可变性
 */
export function updateState(
    state: State,
    updater: (draft: State) => void | State
): State {
    // 深拷贝当前状态
    const draft = deepClone(state);

    // 执行更新
    const result = updater(draft);

    // 如果 updater 返回新状态，使用返回值；否则使用 draft
    const newState = result || draft;

    // 更新时间戳
    newState.updatedAt = Date.now();

    return newState;
}

/**
 * 序列化 State
 */
export function serializeState(state: State): string {
    return JSON.stringify(state);
}

/**
 * 反序列化 State
 */
export function deserializeState(json: string): State {
    return JSON.parse(json);
}

/**
 * 验证 State 完整性
 */
export function validateState(state: State): boolean {
    return !!(
        state.id &&
        state.conversation &&
        state.task &&
        state.memory &&
        state.artifacts &&
        state.telemetry &&
        state.policy
    );
}

// ============================================================================
// 辅助函数
// ============================================================================

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function deepClone<T>(obj: T): T {
    // 优先使用现代浏览器/Node 原生的高性能结构化克隆
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }

    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as T;
    }

    if (obj instanceof Array) {
        return obj.map(item => deepClone(item)) as T;
    }

    if (obj instanceof Object) {
        const clonedObj = {} as T;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }

    return obj;
}

/**
 * 便捷的 State 更新辅助函数
 */
export const StateHelpers = {
    /** 添加消息 */
    addMessage(state: State, role: 'user' | 'assistant' | 'system' | 'tool', content: string) {
        return updateState(state, draft => {
            draft.conversation.messages.push({
                role,
                content,
                timestamp: Date.now(),
            });
        });
    },

    /** 更新任务进度 */
    updateProgress(state: State, progress: number) {
        return updateState(state, draft => {
            draft.task.progress = Math.min(100, Math.max(0, progress));
        });
    },

    /** 设置当前节点 */
    setCurrentNode(state: State, nodeId: string) {
        return updateState(state, draft => {
            draft.task.currentNode = nodeId;
        });
    },

    /** 添加工具调用计数 */
    incrementToolCall(state: State) {
        return updateState(state, draft => {
            draft.telemetry.toolCallCount += 1;
        });
    },

    /** 添加错误计数 */
    incrementError(state: State) {
        return updateState(state, draft => {
            draft.telemetry.errorCount += 1;
        });
    },

    /** 添加重试计数 */
    incrementRetry(state: State) {
        return updateState(state, draft => {
            draft.telemetry.retryCount += 1;
        });
    },

    /** 记录节点耗时 */
    recordNodeTiming(state: State, nodeId: string, duration: number) {
        return updateState(state, draft => {
            draft.telemetry.nodeTimings[nodeId] =
                (draft.telemetry.nodeTimings[nodeId] || 0) + duration;
            draft.telemetry.totalDuration += duration;
        });
    },

    /** 记录 Token 使用情况 */
    addTokenUsage(state: State, usage: { prompt?: number; completion?: number; total?: number }) {
        return updateState(state, draft => {
            if (usage.prompt) draft.telemetry.tokenCount += usage.prompt;
            if (usage.completion) draft.telemetry.tokenCount += usage.completion;
            // 如果只有总计，且没有分项，则使用总计
            if (!usage.prompt && !usage.completion && usage.total) {
                draft.telemetry.tokenCount += usage.total;
            }
        });
    },

    /** 检查预算是否超限 */
    checkBudget(state: State): { exceeded: boolean; reason?: string } {
        const { telemetry, policy } = state;

        if (telemetry.toolCallCount >= policy.maxToolCalls) {
            return { exceeded: true, reason: `工具调用次数超限 (${telemetry.toolCallCount}/${policy.maxToolCalls})` };
        }

        if (telemetry.totalDuration >= policy.maxDuration) {
            return { exceeded: true, reason: `总耗时超限 (${telemetry.totalDuration}ms/${policy.maxDuration}ms)` };
        }

        if (telemetry.retryCount >= policy.maxRetries) {
            return { exceeded: true, reason: `重试次数超限 (${telemetry.retryCount}/${policy.maxRetries})` };
        }

        return { exceeded: false };
    },
};
