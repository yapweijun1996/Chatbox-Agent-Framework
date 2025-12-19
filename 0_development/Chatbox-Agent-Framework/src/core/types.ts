/**
 * 核心类型定义
 * 定义框架的所有核心接口与类型
 */

import { z } from 'zod';

// ============================================================================
// State 相关类型
// ============================================================================

/** 对话消息 */
export interface Message {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/** 对话上下文 */
export interface Conversation {
    messages: Message[];
    systemPrompt?: string;
    toolResultsSummary: string[]; // 工具结果摘要
}

/** 任务子步骤 */
export interface TaskStep {
    id: string;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
}

/** 任务信息 */
export interface Task {
    goal: string; // 用户目标
    plan?: string; // Planner 产出的计划
    steps: TaskStep[]; // 子任务列表
    currentNode: string; // 当前执行节点
    currentStepIndex: number; // 当前步骤索引
    progress: number; // 进度 0-100
    pendingToolCall?: PendingToolCall; // 等待确认的工具调用
}

/** 记忆存储 */
export interface Memory {
    shortTerm: Record<string, unknown>; // 短期任务记忆
    longTermKeys: string[]; // 长期记忆指针（可扩展为向量库键）
}

/** 工件存储 */
export interface Artifacts {
    sql?: string[]; // SQL 语句
    results?: unknown[]; // 结果集摘要
    references?: string[]; // 引用来源
    files?: Array<{ name: string; path: string; metadata: Record<string, unknown> }>;
    [key: string]: unknown; // 允许扩展
}

/** 遥测数据 */
export interface Telemetry {
    totalDuration: number; // 总耗时（ms）
    tokenCount: number; // token 数
    toolCallCount: number; // 工具调用次数
    errorCount: number; // 错误次数
    retryCount: number; // 重试次数
    nodeTimings: Record<string, number>; // 各节点耗时
}

/** 策略配置 */
export interface Policy {
    maxToolCalls: number; // 最大工具调用次数
    maxDuration: number; // 最大总耗时（ms）
    maxRetries: number; // 最大重试次数
    allowedTools?: string[]; // 允许的工具白名单
    permissions: Record<string, boolean>; // 权限控制
    useStreaming?: boolean; // 是否启用流式输出（默认 true）
}

/** 统一状态容器 */
export interface State {
    id: string; // 状态唯一 ID
    conversation: Conversation;
    task: Task;
    memory: Memory;
    artifacts: Artifacts;
    telemetry: Telemetry;
    policy: Policy;
    createdAt: number;
    updatedAt: number;
}

// ============================================================================
// Event 相关类型
// ============================================================================

export type EventType =
    | 'node_start'
    | 'node_end'
    | 'tool_call'
    | 'tool_result'
    | 'confirmation_required'
    | 'confirmation_result'
    | 'error'
    | 'retry'
    | 'checkpoint'
    | 'budget_warning'
    | 'budget_exceeded'
    | 'stream_chunk'
    | 'abort'   // 任务中断
    | 'resume'; // 任务恢复

export interface Event {
    id: string;
    timestamp: number;
    type: EventType;
    nodeId?: string;
    status: 'success' | 'failure' | 'warning' | 'info';
    summary: string;
    payloadRef?: string; // 指向详细数据的引用（避免事件过大）
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Node 相关类型
// ============================================================================

export interface NodeResult {
    state: State;
    events: Event[];
    nextNode?: string; // 下一个节点（用于动态路由）
}

export interface Node {
    id: string;
    name: string;
    execute(state: State, context?: NodeContext): Promise<NodeResult>; // 更新：增加 context 参数
}

/** 节点执行上下文 */
export interface NodeContext {
    emitEvent: (type: EventType, status: Event['status'], summary: string, payload?: unknown) => void;
}

// ============================================================================
// Tool 相关类型
// ============================================================================

/** 工具重试策略 */
export interface RetryPolicy {
    maxRetries: number;
    backoffMs: number; // 初始退避时间
    backoffMultiplier: number; // 退避倍数
}

/** 工具定义 */
export interface Tool {
    name: string;
    description: string;
    inputSchema: z.ZodSchema; // 使用 Zod 进行 schema 校验
    outputSchema: z.ZodSchema;
    timeout: number; // 超时时间（ms）
    retryPolicy: RetryPolicy;
    permissions: string[]; // 所需权限
    requiresConfirmation?: boolean; // 是否需要人工确认
    confirmationMessage?: string; // 确认提示文本
    allowedNodes?: string[]; // 允许调用的节点白名单
    execute(input: unknown, context?: ToolContext): Promise<unknown>; // 更新：增加 context 参数
}

/** 工具执行上下文 */
export interface ToolContext {
    onStream?: (chunk: string) => void; // 流式回调
    signal?: AbortSignal; // 中断信号
}

/** 待确认的工具调用 */
export interface PendingToolCall {
    toolName: string;
    input: unknown;
    stepId: string;
    stepDescription: string;
    permissions: string[];
    confirmationMessage?: string;
    requestedAt: number;
    status: 'pending' | 'approved' | 'denied';
    decisionReason?: string;
    decidedAt?: number;
}

export interface ToolConfirmationRequest {
    toolName: string;
    input: unknown;
    stepId: string;
    stepDescription: string;
    permissions: string[];
    confirmationMessage?: string;
    requestedAt: number;
}

export interface ToolConfirmationDecision {
    approved: boolean;
    reason?: string;
}

export type ToolConfirmationHandler = (
    request: ToolConfirmationRequest
) => Promise<ToolConfirmationDecision | boolean>;

// ============================================================================
// Error 相关类型
// ============================================================================

export enum ErrorType {
    NETWORK = 'network',
    TIMEOUT = 'timeout',
    PERMISSION = 'permission',
    VALIDATION = 'validation',
    EXECUTION = 'execution',
    EMPTY_RESULT = 'empty_result',
    UNTRUSTED_RESULT = 'untrusted_result',
    BUDGET_EXCEEDED = 'budget_exceeded',
    UNKNOWN = 'unknown',
}

export interface AgentError {
    type: ErrorType;
    message: string;
    nodeId?: string;
    toolName?: string;
    retryable: boolean;
    originalError?: Error;
    timestamp: number;
}

// ============================================================================
// Checkpoint 相关类型
// ============================================================================

export interface Checkpoint {
    id: string;
    stateId: string;
    state: State;
    eventIndex: number; // 事件流索引
    timestamp: number;
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Graph 相关类型
// ============================================================================

export type EdgeCondition = (state: State) => boolean;

export interface Edge {
    from: string;
    to: string;
    condition?: EdgeCondition; // 条件边（用于分支）
}

export interface GraphDefinition {
    nodes: Node[];
    edges: Edge[];
    entryNode: string;
    maxSteps: number; // 最大执行步数（防止无限循环）
}

// ============================================================================
// Persistence 相关类型
// ============================================================================

export interface PersistenceAdapter {
    saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
    loadCheckpoint(checkpointId: string): Promise<Checkpoint | null>;
    listCheckpoints(stateId: string): Promise<Checkpoint[]>;
    deleteCheckpoint(checkpointId: string): Promise<void>;
}

// ============================================================================
// Hooks 相关类型
// ============================================================================

export interface RunnerHooks {
    onNodeStart?(nodeId: string, state: State): void | Promise<void>;
    onNodeEnd?(nodeId: string, result: NodeResult): void | Promise<void>;
    onToolCall?(toolName: string, input: unknown): void | Promise<void>;
    onToolResult?(toolName: string, output: unknown): void | Promise<void>;
    onError?(error: AgentError): void | Promise<void>;
    onCheckpoint?(checkpoint: Checkpoint): void | Promise<void>;
    onBudgetWarning?(metric: string, current: number, limit: number): void | Promise<void>;
}
