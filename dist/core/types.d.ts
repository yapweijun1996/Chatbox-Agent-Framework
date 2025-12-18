/**
 * 核心类型定义
 * 定义框架的所有核心接口与类型
 */
import { z } from 'zod';
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
    toolResultsSummary: string[];
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
    goal: string;
    plan?: string;
    steps: TaskStep[];
    currentNode: string;
    currentStepIndex: number;
    progress: number;
}
/** 记忆存储 */
export interface Memory {
    shortTerm: Record<string, unknown>;
    longTermKeys: string[];
}
/** 工件存储 */
export interface Artifacts {
    sql?: string[];
    results?: unknown[];
    references?: string[];
    files?: Array<{
        name: string;
        path: string;
        metadata: Record<string, unknown>;
    }>;
    [key: string]: unknown;
}
/** 遥测数据 */
export interface Telemetry {
    totalDuration: number;
    tokenCount: number;
    toolCallCount: number;
    errorCount: number;
    retryCount: number;
    nodeTimings: Record<string, number>;
}
/** 策略配置 */
export interface Policy {
    maxToolCalls: number;
    maxDuration: number;
    maxRetries: number;
    allowedTools?: string[];
    permissions: Record<string, boolean>;
    useStreaming?: boolean;
}
/** 统一状态容器 */
export interface State {
    id: string;
    conversation: Conversation;
    task: Task;
    memory: Memory;
    artifacts: Artifacts;
    telemetry: Telemetry;
    policy: Policy;
    createdAt: number;
    updatedAt: number;
}
export type EventType = 'node_start' | 'node_end' | 'tool_call' | 'tool_result' | 'error' | 'retry' | 'checkpoint' | 'budget_warning' | 'budget_exceeded' | 'stream_chunk';
export interface Event {
    id: string;
    timestamp: number;
    type: EventType;
    nodeId?: string;
    status: 'success' | 'failure' | 'warning' | 'info';
    summary: string;
    payloadRef?: string;
    metadata?: Record<string, unknown>;
}
export interface NodeResult {
    state: State;
    events: Event[];
    nextNode?: string;
}
export interface Node {
    id: string;
    name: string;
    execute(state: State, context?: NodeContext): Promise<NodeResult>;
}
/** 节点执行上下文 */
export interface NodeContext {
    emitEvent: (type: EventType, status: Event['status'], summary: string, payload?: unknown) => void;
}
/** 工具重试策略 */
export interface RetryPolicy {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier: number;
}
/** 工具定义 */
export interface Tool {
    name: string;
    description: string;
    inputSchema: z.ZodSchema;
    outputSchema: z.ZodSchema;
    timeout: number;
    retryPolicy: RetryPolicy;
    permissions: string[];
    allowedNodes?: string[];
    execute(input: unknown, context?: ToolContext): Promise<unknown>;
}
/** 工具执行上下文 */
export interface ToolContext {
    onStream?: (chunk: string) => void;
    signal?: AbortSignal;
}
export declare enum ErrorType {
    NETWORK = "network",
    TIMEOUT = "timeout",
    PERMISSION = "permission",
    VALIDATION = "validation",
    EXECUTION = "execution",
    EMPTY_RESULT = "empty_result",
    UNTRUSTED_RESULT = "untrusted_result",
    BUDGET_EXCEEDED = "budget_exceeded",
    UNKNOWN = "unknown"
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
export interface Checkpoint {
    id: string;
    stateId: string;
    state: State;
    eventIndex: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
export type EdgeCondition = (state: State) => boolean;
export interface Edge {
    from: string;
    to: string;
    condition?: EdgeCondition;
}
export interface GraphDefinition {
    nodes: Node[];
    edges: Edge[];
    entryNode: string;
    maxSteps: number;
}
export interface PersistenceAdapter {
    saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
    loadCheckpoint(checkpointId: string): Promise<Checkpoint | null>;
    listCheckpoints(stateId: string): Promise<Checkpoint[]>;
    deleteCheckpoint(checkpointId: string): Promise<void>;
}
export interface RunnerHooks {
    onNodeStart?(nodeId: string, state: State): void | Promise<void>;
    onNodeEnd?(nodeId: string, result: NodeResult): void | Promise<void>;
    onToolCall?(toolName: string, input: unknown): void | Promise<void>;
    onToolResult?(toolName: string, output: unknown): void | Promise<void>;
    onError?(error: AgentError): void | Promise<void>;
    onCheckpoint?(checkpoint: Checkpoint): void | Promise<void>;
    onBudgetWarning?(metric: string, current: number, limit: number): void | Promise<void>;
}
//# sourceMappingURL=types.d.ts.map