/**
 * Agent 核心类
 * 提供统一的 Agent 入口，封装 GraphRunner 和 LLM Provider
 */

import { GraphRunner } from './runner';
import { EventStream } from './event-stream';
import { ToolRegistry } from './tool-registry';
import { createState } from './state';
import { LLMProvider, type ChatMessage } from './llm-provider';
import { createProviderFromSettings, createLLMProvider, type SettingsBasedConfig, type LLMProviderConfig } from '../providers';
import { LLMPlannerNode, type LLMPlannerNodeConfig } from '../nodes/llm-planner';
import { ToolRunnerNode } from '../nodes/tool-runner';
import { ConfirmationNode } from '../nodes/confirmation';
import { VerifierNode } from '../nodes/verifier';
import { ResponderNode } from '../nodes/responder';
import { LLMResponderNode } from '../nodes/llm-responder';
import { MemoryNode } from '../nodes/memory';
import { shouldUseAgentMode, formatAgentResponse } from './agent-utils';
import { AgentAbortController, isAbortError, type ResumeOptions } from './abort-controller';
import type { State, Tool, GraphDefinition, RunnerHooks, Checkpoint, ToolConfirmationHandler, PersistenceAdapter } from './types';
import type { MemoryManager } from './memory/types';
import type { IntentDecision, IntentRouter } from './intent-router';
import { LLMIntentRouter } from './intent-router';
import { buildGraphDefinition, getGraphTemplateSettings, type GraphTemplateName } from './graph-templates';
import {
    buildGraphDefinitionFromConfig,
    defaultGraphConditions,
    type GraphConditionRegistry,
    type GraphConfig,
} from './graph-config';
import type { AuditLogger } from './audit';
import { createEventStreamAuditLogger } from './audit';
import type { RBACPolicy } from './rbac';
import { resolvePermissions, resolveRoles } from './rbac';
import type { ChatMemoryRecallPolicy, ChatMemorySavePolicy, ChatMemoryMessageRole } from './memory/chat-memory';
import {
    applyChatMemoryRecallPolicy,
    DEFAULT_CHAT_MEMORY_RECALL_POLICY,
    DEFAULT_CHAT_MEMORY_SAVE_POLICY,
    formatChatMemories,
    saveChatMemoryTurn,
} from './memory/chat-memory';
import { normalizeMemoryContent } from './memory/memory-heuristics';

// ============================================================================
// 类型定义
// ============================================================================

export type AgentMode = 'chat' | 'agent' | 'auto';
export type ProviderConfigInput = LLMProviderConfig | SettingsBasedConfig;

export interface AgentConfig {
    provider: ProviderConfigInput;
    tools?: Tool[];
    mode?: AgentMode;
    systemPrompt?: string;
    streaming?: boolean;
    maxSteps?: number;
    hooks?: RunnerHooks;
    graph?: GraphDefinition;
    graphTemplate?: GraphTemplateName;
    graphConfig?: GraphConfig;
    graphConditions?: GraphConditionRegistry;
    planner?: LLMPlannerNodeConfig;
    toolExecutionPolicy?: {
        allowlist?: string[];
        denylist?: string[];
        defaultTimeoutMs?: number;
        maxTimeoutMs?: number;
        perToolTimeoutMs?: Record<string, number>;
    };
    persistenceAdapter?: PersistenceAdapter;
    /** 是否使用 LLM 生成自然语言回复 */
    useLLMResponder?: boolean;
    /** 工具确认回调（用于人工确认） */
    confirmTool?: ToolConfirmationHandler;
    /** 记忆管理器（可选） */
    memory?: MemoryManager;
    /** 是否启用自动记忆保存 */
    enableMemory?: boolean;
    /** RBAC 配置 */
    rbac?: {
        policy: RBACPolicy;
        roles?: string[];
        actor?: string;
    };
    /** 审计日志记录器 */
    auditLogger?: AuditLogger;
    /** 是否启用 LLM 意图路由 */
    enableIntentRouter?: boolean;
    /** 自定义意图路由器 */
    intentRouter?: IntentRouter;
    /** 意图路由器配置 */
    intentRouterOptions?: {
        systemPrompt?: string;
        temperature?: number;
    };
    /** 是否启用 Chat 模式记忆 */
    enableChatMemory?: boolean;
    /** Chat 模式记忆保存策略 */
    chatMemorySavePolicy?: ChatMemorySavePolicy;
    /** Chat 模式记忆召回策略 */
    chatMemoryRecallPolicy?: ChatMemoryRecallPolicy;
}

export interface ChatOptions {
    stream?: boolean;
    onStream?: (chunk: string) => void;
    temperature?: number;
    useChatMemory?: boolean;
    chatMemorySavePolicy?: ChatMemorySavePolicy;
    chatMemoryRecallPolicy?: ChatMemoryRecallPolicy;
}

export interface AgentResult {
    content: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    mode: 'chat' | 'agent';
    steps?: Array<{ description: string; status: string; result?: unknown }>;
    duration: number;
    /** 是否被中断 */
    aborted?: boolean;
    /** 中断原因 */
    abortReason?: string;
}

// ============================================================================
// Agent 类
// ============================================================================

export class Agent {
    private provider: LLMProvider;
    private toolRegistry: ToolRegistry;
    private runner: GraphRunner | null = null;
    private eventStream: EventStream | null = null;
    private abortController: AgentAbortController;
    private isRunning: boolean = false;
    private lastState: State | null = null;
    private config: {
        provider: ProviderConfigInput;
        tools: Tool[];
        mode: AgentMode;
        systemPrompt: string;
        streaming: boolean;
        maxSteps: number;
        hooks: RunnerHooks;
        graph?: GraphDefinition;
        graphTemplate?: GraphTemplateName;
        graphConfig?: GraphConfig;
        graphConditions?: GraphConditionRegistry;
        planner?: LLMPlannerNodeConfig;
        toolExecutionPolicy?: {
            allowlist?: string[];
            denylist?: string[];
            defaultTimeoutMs?: number;
            maxTimeoutMs?: number;
            perToolTimeoutMs?: Record<string, number>;
        };
        persistenceAdapter?: PersistenceAdapter;
        useLLMResponder: boolean;
        confirmTool?: ToolConfirmationHandler;
        memory?: MemoryManager;
        enableMemory: boolean;
        rbac?: {
            policy: RBACPolicy;
            roles?: string[];
            actor?: string;
        };
        auditLogger?: AuditLogger;
        enableIntentRouter: boolean;
        intentRouter?: IntentRouter;
        intentRouterOptions?: {
            systemPrompt?: string;
            temperature?: number;
        };
        enableChatMemory: boolean;
        chatMemorySavePolicy?: ChatMemorySavePolicy;
        chatMemoryRecallPolicy?: ChatMemoryRecallPolicy;
    };
    private intentRouter?: IntentRouter;
    private conversationHistory: ChatMessage[] = [];
    private auditLogger?: AuditLogger;

    constructor(config: AgentConfig) {
        this.config = {
            provider: config.provider,
            tools: config.tools || [],
            mode: config.mode || 'auto',
            systemPrompt: config.systemPrompt || 'You are a helpful AI assistant.',
            streaming: config.streaming ?? true,
            maxSteps: config.maxSteps || 15,
            hooks: config.hooks || {},
            graph: config.graph,
            graphTemplate: config.graphTemplate,
            graphConfig: config.graphConfig,
            graphConditions: config.graphConditions,
            planner: config.planner,
            toolExecutionPolicy: config.toolExecutionPolicy,
            persistenceAdapter: config.persistenceAdapter,
            useLLMResponder: config.useLLMResponder ?? false,
            confirmTool: config.confirmTool,
            memory: config.memory,
            enableMemory: config.enableMemory ?? false,
            rbac: config.rbac,
            auditLogger: config.auditLogger,
            enableIntentRouter: config.enableIntentRouter ?? false,
            intentRouter: config.intentRouter,
            intentRouterOptions: config.intentRouterOptions,
            enableChatMemory: config.enableChatMemory ?? false,
            chatMemorySavePolicy: config.chatMemorySavePolicy,
            chatMemoryRecallPolicy: config.chatMemoryRecallPolicy,
        };

        this.provider = this.createProvider(this.config.provider);
        this.toolRegistry = new ToolRegistry(this.config.toolExecutionPolicy);
        this.abortController = new AgentAbortController();
        this.intentRouter = this.createIntentRouter();
        this.config.tools.forEach(tool => this.toolRegistry.register(tool));
        this.initializeRunner();
        this.auditLogger = this.config.auditLogger ?? (this.eventStream ? createEventStreamAuditLogger(this.eventStream) : undefined);
    }

    private createProvider(config: ProviderConfigInput): LLMProvider {
        if ('type' in config) {
            return createLLMProvider(config as LLMProviderConfig);
        }
        return createProviderFromSettings(config as SettingsBasedConfig);
    }

    private createIntentRouter(): IntentRouter | undefined {
        if (this.config.intentRouter) {
            return this.config.intentRouter;
        }

        if (!this.config.enableIntentRouter) {
            return undefined;
        }

        return new LLMIntentRouter(this.provider, this.config.intentRouterOptions);
    }

    private initializeRunner(): void {
        const planner = new LLMPlannerNode(this.toolRegistry, {
            ...this.config.planner,
            provider: this.provider,
        });
        const toolRunner = new ToolRunnerNode(this.toolRegistry, { provider: this.provider });
        const templateName = this.config.graphTemplate ?? 'standard';
        const templateSettings = getGraphTemplateSettings(templateName);
        const confirmer = new ConfirmationNode({
            onConfirm: this.config.confirmTool,
            autoApprove: templateSettings.confirmationAutoApprove,
        });
        const verifier = new VerifierNode();

        // 根据配置选择 Responder 类型
        const responder = this.config.useLLMResponder
            ? new LLMResponderNode({ provider: this.provider })
            : new ResponderNode();

        // Build nodes list
        const nodes: Array<typeof planner | typeof toolRunner | typeof confirmer | typeof verifier | typeof responder | MemoryNode> = [
            planner,
            toolRunner,
            confirmer,
            verifier,
            responder,
        ];

        // Add memory node if enabled
        let memoryNode: MemoryNode | null = null;
        if (this.config.enableMemory && this.config.memory) {
            memoryNode = new MemoryNode({
                memoryManager: this.config.memory,
                saveCompletedTasks: true,
                saveUserPreferences: true,
                saveToolResults: false,
            });
            nodes.push(memoryNode);
        }

        const graph: GraphDefinition = this.config.graph
            ?? (this.config.graphConfig
                ? buildGraphDefinitionFromConfig(
                    {
                        ...this.config.graphConfig,
                        maxSteps: this.config.graphConfig.maxSteps ?? this.config.maxSteps,
                    },
                    new Map(nodes.map(node => [node.id, node])),
                    { ...defaultGraphConditions, ...this.config.graphConditions }
                )
                : buildGraphDefinition(
                    templateName,
                    nodes,
                    {
                        maxSteps: this.config.maxSteps,
                        includeMemory: Boolean(memoryNode),
                    }
                ));

        this.runner = new GraphRunner(graph, this.config.persistenceAdapter, this.buildRunnerHooks());
        this.eventStream = this.runner.getEventStream();
    }

    /** 主入口：发送消息并获取回复 */
    async chat(message: string, options: ChatOptions = {}): Promise<AgentResult> {
        if (this.isRunning) {
            throw new Error('Agent is already running. Call abort() first.');
        }

        this.isRunning = true;
        this.abortController.reset();
        const startTime = Date.now();
        const decision = await this.determineRouting(message);
        const mode = decision.mode;
        this.logAudit({
            action: 'route_decision',
            status: 'info',
            metadata: {
                mode,
                reason: decision.reason,
                allowedTools: decision.toolPolicy?.allowedTools,
                memoryPolicy: decision.memoryPolicy,
                clarification: decision.clarification?.question,
                routingAnalysis: decision.analysis,
            },
        });

        this.conversationHistory.push({ role: 'user', content: message });

        try {
            if (decision.clarification?.question) {
                const clarification = decision.clarification.question;
                this.conversationHistory.push({ role: 'assistant', content: clarification });
                return {
                    content: clarification,
                    mode: 'chat',
                    duration: Date.now() - startTime,
                };
            }

            if (mode === 'chat') {
                return await this.handleChatMode(message, options, startTime, decision);
            }
            return await this.handleAgentMode(message, startTime, decision);
        } catch (error) {
            if (isAbortError(error)) {
                return {
                    content: '[任务已中断]',
                    mode,
                    duration: Date.now() - startTime,
                    aborted: true,
                    abortReason: this.abortController.getAbortState().reason,
                };
            }
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    private async determineRouting(message: string): Promise<IntentDecision> {
        if (this.config.mode === 'chat') return { mode: 'chat', reason: 'config' };
        if (this.config.mode === 'agent') return { mode: 'agent', reason: 'config' };

        const hasTools = this.toolRegistry.list().length > 0;
        if (!this.intentRouter) {
            return {
                mode: shouldUseAgentMode(message, hasTools) ? 'agent' : 'chat',
                reason: 'rule-based',
            };
        }

        const decision = await this.intentRouter.route({
            message,
            hasTools,
            availableTools: this.toolRegistry.list(),
        });

        if (!hasTools && decision.mode === 'agent') {
            return { ...decision, mode: 'chat' };
        }

        return decision;
    }

    private buildRunnerHooks(): RunnerHooks {
        const baseHooks = this.config.hooks || {};

        return {
            ...baseHooks,
            onToolCall: async (toolName, input) => {
                await baseHooks.onToolCall?.(toolName, input);
                this.logAudit({
                    action: 'tool_call',
                    status: 'info',
                    metadata: {
                        toolName,
                        input,
                    },
                });
            },
            onToolResult: async (toolName, output) => {
                await baseHooks.onToolResult?.(toolName, output);
                const result = output as { success?: boolean; error?: string };
                const status = result?.success === false ? 'failure' : 'success';
                this.logAudit({
                    action: 'tool_result',
                    status,
                    metadata: {
                        toolName,
                        output,
                        error: result?.error,
                    },
                });
            },
            onCheckpoint: async (checkpoint) => {
                await baseHooks.onCheckpoint?.(checkpoint);
                this.abortController.saveCheckpoint(checkpoint);
            },
        };
    }

    private async handleChatMode(
        message: string,
        options: ChatOptions,
        startTime: number,
        decision?: IntentDecision
    ): Promise<AgentResult> {
        const messages: ChatMessage[] = [{ role: 'system', content: this.config.systemPrompt }];
        const rbac = this.resolveRBAC();
        const canRecall = this.isPermissionAllowed(rbac.permissions, 'memory:read');
        const canWrite = this.isPermissionAllowed(rbac.permissions, 'memory:write');
        const useChatMemory = options.useChatMemory
            ?? decision?.memoryPolicy?.enableChatMemory
            ?? this.config.enableChatMemory;

        if (useChatMemory && this.config.memory) {
            const recallPolicy = this.mergeChatMemoryRecallPolicy(options.chatMemoryRecallPolicy);
            if (canRecall) {
                const memoryMessage = await this.buildChatMemoryMessage(message, recallPolicy);
                if (memoryMessage) {
                    messages.push(memoryMessage);
                }
            } else {
                this.logAudit({
                    action: 'memory_recall_blocked',
                    status: 'warning',
                    metadata: { scope: 'chat', reason: 'permission' },
                });
            }
        }

        messages.push(...this.conversationHistory);

        const useStream = options.stream ?? this.config.streaming;

        if (useStream && options.onStream) {
            let fullContent = '';
            let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
            const stream = this.provider.chatStream({
                messages,
                temperature: options.temperature,
                signal: this.abortController.signal
            });

            for await (const chunk of stream) {
                if (chunk.delta) {
                    fullContent += chunk.delta;
                    options.onStream(chunk.delta);
                }
                if (chunk.usage) {
                    usage = chunk.usage;
                }
            }

            this.conversationHistory.push({ role: 'assistant', content: fullContent });
            if (useChatMemory && this.config.memory) {
                if (!canWrite) {
                    this.logAudit({
                        action: 'memory_save_blocked',
                        status: 'warning',
                        metadata: { scope: 'chat', reason: 'permission' },
                    });
                } else {
                await this.saveChatMemory(message, fullContent, options.chatMemorySavePolicy);
                }
            }
            return {
                content: fullContent,
                mode: 'chat',
                duration: Date.now() - startTime,
                usage
            };
        }

        const response = await this.provider.chat({
            messages,
            temperature: options.temperature,
            signal: this.abortController.signal
        });
        this.conversationHistory.push({ role: 'assistant', content: response.content });
        if (useChatMemory && this.config.memory) {
            if (!canWrite) {
                this.logAudit({
                    action: 'memory_save_blocked',
                    status: 'warning',
                    metadata: { scope: 'chat', reason: 'permission' },
                });
            } else {
            await this.saveChatMemory(message, response.content, options.chatMemorySavePolicy);
            }
        }

        return {
            content: response.content,
            usage: response.usage,
            mode: 'chat',
            duration: Date.now() - startTime,
        };
    }

    private async handleAgentMode(
        message: string,
        startTime: number,
        decision?: IntentDecision
    ): Promise<AgentResult> {
        if (!this.runner) throw new Error('GraphRunner not initialized');

        // Recall relevant memories before task execution
        let relevantMemories: string[] = [];
        const memoryEnabled = decision?.memoryPolicy?.enableMemory ?? this.config.enableMemory;
        const rbac = this.resolveRBAC();
        const permissions = rbac.permissions ?? { 'sql:read': true, 'document:read': true };
        const roles = rbac.roles;
        const canRecall = this.isPermissionAllowed(rbac.permissions, 'memory:read');
        const canWrite = this.isPermissionAllowed(rbac.permissions, 'memory:write');
        const memoryEnabledForWrite = memoryEnabled && canWrite;
        if (memoryEnabled && this.config.memory) {
            if (!canRecall) {
                this.logAudit({
                    action: 'memory_recall_blocked',
                    status: 'warning',
                    metadata: { scope: 'agent', reason: 'permission' },
                });
            } else {
            relevantMemories = await this.recallRelevantMemories(message);
            }
        }

        const initialState = createState(message, {
            permissions,
            allowedTools: decision?.toolPolicy?.allowedTools,
            memoryEnabled: memoryEnabledForWrite,
            roles,
            planAndExecute: this.config.planner?.planAndExecute?.enabled ?? false,
        });

        // Add relevant memories to initial state context
        if (relevantMemories.length > 0) {
            initialState.memory.shortTerm['recalled_context'] = relevantMemories;
        }

        // 使用 AbortController 包装执行
        const result = await this.abortController.wrapWithAbort(
            this.runner.execute(initialState)
        );
        const finalState = result.state;
        this.lastState = finalState;

        const lastMessage = finalState.conversation.messages.filter(m => m.role === 'assistant').pop();
        const content = lastMessage?.content || formatAgentResponse(
            finalState.task.goal,
            finalState.task.steps.map(s => ({ description: s.description, status: s.status }))
        );

        this.conversationHistory.push({ role: 'assistant', content });

        return {
            content,
            mode: 'agent',
            steps: finalState.task.steps.map(s => ({ description: s.description, status: s.status, result: s.result })),
            duration: Date.now() - startTime,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: finalState.telemetry.tokenCount },
        };
    }

    /**
     * Recall relevant memories for a given query
     */
    private async recallRelevantMemories(query: string): Promise<string[]> {
        if (!this.config.memory) return [];

        try {
            const memories = await this.config.memory.recall(query);
            this.eventStream?.emit('memory_recall', 'info', 'Recalled agent memories', {
                metadata: {
                    query,
                    count: memories.length,
                    source: 'agent',
                },
            });
            this.logAudit({
                action: 'memory_recall',
                status: 'info',
                metadata: { scope: 'agent', query, count: memories.length },
            });
            return memories.slice(0, 5).map(m => normalizeMemoryContent(m.content));
        } catch (error) {
            console.error('[Agent] Failed to recall memories:', error);
            return [];
        }
    }

    private mergeChatMemoryRecallPolicy(override?: ChatMemoryRecallPolicy): ChatMemoryRecallPolicy {
        return {
            ...DEFAULT_CHAT_MEMORY_RECALL_POLICY,
            ...this.config.chatMemoryRecallPolicy,
            ...override,
        };
    }

    private mergeChatMemorySavePolicy(override?: ChatMemorySavePolicy): ChatMemorySavePolicy {
        return {
            ...DEFAULT_CHAT_MEMORY_SAVE_POLICY,
            ...this.config.chatMemorySavePolicy,
            ...override,
        };
    }

    private async buildChatMemoryMessage(
        query: string,
        policy: ChatMemoryRecallPolicy
    ): Promise<ChatMessage | null> {
        if (!this.config.memory) return null;

        try {
            const memories = await this.config.memory.recall(query);
            this.eventStream?.emit('memory_recall', 'info', 'Recalled chat memories', {
                metadata: {
                    query,
                    count: memories.length,
                    source: 'chat',
                },
            });
            this.logAudit({
                action: 'memory_recall',
                status: 'info',
                metadata: { scope: 'chat', query, count: memories.length },
            });
            const filtered = applyChatMemoryRecallPolicy(memories, policy);
            const formatted = formatChatMemories(filtered);
            if (!formatted) return null;

            const role = (policy.messageRole ?? DEFAULT_CHAT_MEMORY_RECALL_POLICY.messageRole) as ChatMemoryMessageRole;
            return { role, content: formatted };
        } catch (error) {
            console.error('[Agent] Failed to recall chat memories:', error);
            return null;
        }
    }

    private async saveChatMemory(
        userMessage: string,
        assistantMessage: string,
        overridePolicy?: ChatMemorySavePolicy
    ): Promise<void> {
        if (!this.config.memory) return;

        const savePolicy = this.mergeChatMemorySavePolicy(overridePolicy);
        try {
            await saveChatMemoryTurn(this.config.memory, userMessage, assistantMessage, savePolicy);
            this.eventStream?.emit('memory_save', 'info', 'Saved chat memory', {
                metadata: {
                    source: 'chat',
                    saveIntentMessages: !!savePolicy.saveIntentMessages,
                    saveUserPreferences: !!savePolicy.saveUserPreferences,
                    saveConversationTurns: !!savePolicy.saveConversationTurns,
                },
            });
            this.logAudit({
                action: 'memory_save',
                status: 'info',
                metadata: {
                    scope: 'chat',
                    saveIntentMessages: !!savePolicy.saveIntentMessages,
                    saveUserPreferences: !!savePolicy.saveUserPreferences,
                    saveConversationTurns: !!savePolicy.saveConversationTurns,
                },
            });
        } catch (error) {
            console.error('[Agent] Failed to save chat memories:', error);
        }
    }

    private resolveRBAC(): { roles?: string[]; permissions?: Record<string, boolean> } {
        const policy = this.config.rbac?.policy;
        if (!policy) return {};
        const roles = resolveRoles(policy, this.config.rbac?.roles);
        const permissions = resolvePermissions(policy, roles);
        return { roles, permissions };
    }

    private isPermissionAllowed(permissions: Record<string, boolean> | undefined, permission: string): boolean {
        if (!permissions) return true;
        return permissions[permission] === true;
    }

    private logAudit(entry: Omit<import('./audit').AuditEntry, 'actor' | 'roles'>): void {
        if (!this.auditLogger) return;
        const policy = this.config.rbac?.policy;
        const roles = policy ? resolveRoles(policy, this.config.rbac?.roles) : this.config.rbac?.roles;
        this.auditLogger.log({
            ...entry,
            actor: this.config.rbac?.actor,
            roles,
        });
    }

    // Public API
    getEventStream(): EventStream {
        if (!this.eventStream) {
            throw new Error('EventStream not initialized');
        }
        return this.eventStream;
    }
    getToolRegistry(): ToolRegistry { return this.toolRegistry; }
    getProvider(): LLMProvider { return this.provider; }
    getHistory(): ChatMessage[] { return [...this.conversationHistory]; }
    getMemory(): MemoryManager | undefined { return this.config.memory; }
    getGraphDefinition() { return this.runner?.getGraphDefinition(); }

    registerTool(tool: Tool): void { this.toolRegistry.register(tool); }
    clearHistory(): void { this.conversationHistory = []; }
    setHistory(history: ChatMessage[]): void { this.conversationHistory = [...history]; }

    // ========================================================================
    // Abort/Resume API
    // ========================================================================

    /**
     * 中断当前执行
     * @param reason 中断原因
     */
    abort(reason?: string): void {
        if (!this.isRunning) {
            console.warn('Agent is not running, nothing to abort.');
            return;
        }
        this.abortController.abort(reason);
        this.eventStream?.emit('abort', 'warning', reason || 'User initiated abort');
    }

    /**
     * 从最近的 checkpoint 恢复执行
     * @param options 恢复选项
     */
    async resume(options: ResumeOptions = {}): Promise<AgentResult> {
        if (this.isRunning) {
            throw new Error('Agent is already running.');
        }

        const checkpointId = options.fromCheckpoint;
        let resumeState: State | null = null;

        if (checkpointId) {
            const checkpoint = this.abortController.getCheckpoint(checkpointId);
            if (!checkpoint) {
                const persisted = await this.config.persistenceAdapter?.loadCheckpoint(checkpointId);
                if (!persisted) {
                    throw new Error(`Checkpoint "${checkpointId}" not found.`);
                }
                resumeState = persisted.state;
            } else {
                resumeState = checkpoint.state;
            }
        } else {
            // 使用最近一次保存的状态
            const latestCheckpoint = this.abortController.getLatestCheckpoint();
            resumeState = latestCheckpoint?.state || this.lastState;
        }

        if (!resumeState) {
            throw new Error('No state available to resume from.');
        }

        // 应用修改（如果有）
        if (options.modifiedState) {
            resumeState = {
                ...resumeState,
                ...options.modifiedState,
                updatedAt: Date.now(),
            };
        }

        this.isRunning = true;
        this.abortController.reset();
        const startTime = Date.now();

        try {
            if (!this.runner) throw new Error('GraphRunner not initialized');

            this.eventStream?.emit('resume', 'info', 'Resuming from checkpoint');

            const result = await this.runner.execute(resumeState);
            const finalState = result.state;
            this.lastState = finalState;

            const lastMessage = finalState.conversation.messages
                .filter(m => m.role === 'assistant').pop();
            const content = lastMessage?.content || formatAgentResponse(
                finalState.task.goal,
                finalState.task.steps.map(s => ({ description: s.description, status: s.status }))
            );

            this.conversationHistory.push({ role: 'assistant', content });

            return {
                content,
                mode: 'agent',
                steps: finalState.task.steps.map(s => ({
                    description: s.description,
                    status: s.status,
                    result: s.result,
                })),
                duration: Date.now() - startTime,
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: finalState.telemetry.tokenCount },
            };
        } catch (error) {
            if (isAbortError(error)) {
                return {
                    content: '[任务已中断]',
                    mode: 'agent',
                    duration: Date.now() - startTime,
                    aborted: true,
                    abortReason: this.abortController.getAbortState().reason,
                };
            }
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * 检查 Agent 是否正在运行
     */
    isAgentRunning(): boolean {
        return this.isRunning;
    }

    /**
     * 获取 AbortController
     */
    getAbortController(): AgentAbortController {
        return this.abortController;
    }

    /**
     * 获取可用的 checkpoints
     */
    listCheckpoints(): Checkpoint[] {
        return this.abortController.listCheckpoints();
    }
}

/** 创建 Agent 实例 */
export function createAgent(config: AgentConfig): Agent {
    return new Agent(config);
}
