/**
 * ToolRunner 节点
 * 负责执行工具调用
 */

import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
import { updateState, StateHelpers } from '../core/state';
import type { ToolRegistry } from '../core/tool-registry';
import type { LLMProvider, ChatMessage } from '../core/llm-provider';
import { createError, ErrorType } from '../core/error-handler';
import { buildOpenAIToolsList } from '../core/schema-utils';

export interface ToolRunnerNodeConfig {
    /** LLM Provider 实例（用于工具选择决策） */
    provider?: LLMProvider;
}

export class ToolRunnerNode extends BaseNode {
    private provider?: LLMProvider;

    constructor(
        private toolRegistry: ToolRegistry,
        config?: ToolRunnerNodeConfig
    ) {
        super('tool-runner', 'ToolRunner');
        this.provider = config?.provider;
    }

    /** 设置 LLM Provider（支持动态更新） */
    setProvider(provider: LLMProvider): void {
        this.provider = provider;
    }

    async execute(state: State, context?: any): Promise<NodeResult> {
        const events: NodeResult['events'] = [];
        let currentState = state;

        const currentStep = state.task.steps[state.task.currentStepIndex];
        if (!currentStep) {
            throw new Error('没有可执行的步骤');
        }

        currentState = updateState(currentState, draft => {
            draft.task.steps[draft.task.currentStepIndex].status = 'running';
        });

        try {
            const { call: toolCall, usage } = await this.decideToolCall(state, currentStep.description);

            if (usage) {
                currentState = StateHelpers.addTokenUsage(currentState, {
                    prompt: usage.promptTokens,
                    completion: usage.completionTokens,
                    total: usage.totalTokens
                });
            }

            if (!toolCall) {
                currentState = updateState(currentState, draft => {
                    draft.task.steps[draft.task.currentStepIndex].status = 'completed';
                    draft.task.steps[draft.task.currentStepIndex].result = '已完成';
                    draft.task.currentStepIndex += 1;
                });

                events.push({
                    id: `evt-${Date.now()}`,
                    timestamp: Date.now(),
                    type: 'node_end',
                    nodeId: this.id,
                    status: 'info',
                    summary: `步骤 "${currentStep.description}" 无需工具调用`,
                });

                return this.createResult(currentState, events);
            }

            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'tool_call',
                nodeId: this.id,
                status: 'info',
                summary: `调用工具: ${toolCall.toolName}`,
                metadata: { toolName: toolCall.toolName, input: toolCall.input },
            });

            const startTime = Date.now();
            const result = await this.toolRegistry.execute(toolCall.toolName, toolCall.input, {
                nodeId: this.id,
                permissions: state.policy.permissions,
            });
            const duration = Date.now() - startTime;

            if (!result.success) {
                throw createError(ErrorType.EXECUTION, result.error || '工具执行失败', {
                    nodeId: this.id,
                    toolName: toolCall.toolName,
                });
            }

            currentState = StateHelpers.incrementToolCall(currentState);
            currentState = StateHelpers.recordNodeTiming(currentState, this.id, duration);
            currentState = updateState(currentState, draft => {
                draft.task.steps[draft.task.currentStepIndex].status = 'completed';
                draft.task.steps[draft.task.currentStepIndex].result = result.output;

                if (!draft.artifacts.toolResults) {
                    draft.artifacts.toolResults = [];
                }
                (draft.artifacts.toolResults as unknown[]).push({
                    stepId: currentStep.id,
                    toolName: toolCall.toolName,
                    output: result.output,
                    timestamp: Date.now(),
                });

                draft.task.currentStepIndex += 1;
            });

            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'tool_result',
                nodeId: this.id,
                status: 'success',
                summary: `工具 ${toolCall.toolName} 执行成功 (${duration}ms)`,
                metadata: { duration, toolName: toolCall.toolName },
            });

            return this.createResult(currentState, events);
        } catch (error) {
            currentState = StateHelpers.incrementError(currentState);
            currentState = updateState(currentState, draft => {
                const step = draft.task.steps[draft.task.currentStepIndex];
                if (step) {
                    step.status = 'failed';
                    step.error = String(error);
                }
            });

            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'error',
                nodeId: this.id,
                status: 'failure',
                summary: `工具执行失败: ${error}`,
            });

            throw error;
        }
    }

    /** 决定工具调用 */
    private async decideToolCall(
        state: State,
        stepDescription: string
    ): Promise<{ call: { toolName: string; input: unknown } | null, usage?: any }> {
        if (this.provider) {
            return this.decideWithProvider(stepDescription);
        }

        const providerConfig = state.artifacts.providerConfig as any;
        if (providerConfig?.baseURL) {
            return this.decideWithFetch(stepDescription, providerConfig.baseURL, providerConfig.model);
        }

        return this.decideWithFetch(stepDescription, 'http://127.0.0.1:6354', 'zai-org/glm-4.6v-flash');
    }

    /** 使用 Provider 决定工具调用 */
    private async decideWithProvider(stepDescription: string): Promise<{ call: { toolName: string; input: unknown } | null, usage?: any }> {
        const tools = buildOpenAIToolsList(this.toolRegistry);

        if (tools.length === 0) {
            return { call: null, usage: undefined };
        }

        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: `You are an assistant. Available tools:\n${tools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n')}\n\nRespond with JSON: {"tool": "name", "input": {}} or {"tool": null}`
            },
            { role: 'user', content: `Task: ${stepDescription}` }
        ];

        try {
            const response = await this.provider!.chat({ messages, temperature: 0.1 });
            const parsed = this.parseToolDecision(response.content);

            if (parsed?.tool && this.toolRegistry.has(parsed.tool)) {
                return { call: { toolName: parsed.tool, input: parsed.input || {} }, usage: response.usage };
            }
            return { call: null, usage: response.usage };
        } catch (error) {
            console.error('[ToolRunner] Provider error:', error);
            return { call: this.fallbackDecide(stepDescription), usage: undefined };
        }
    }

    /** 使用 Fetch 调用 */
    private async decideWithFetch(
        stepDescription: string,
        baseURL: string,
        model: string
    ): Promise<{ call: { toolName: string; input: unknown } | null, usage?: any }> {
        const tools = buildOpenAIToolsList(this.toolRegistry);
        if (tools.length === 0) return { call: null, usage: undefined };

        try {
            const response = await fetch(`${baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: 'Select appropriate tool if needed.' },
                        { role: 'user', content: `Task: ${stepDescription}` }
                    ],
                    tools,
                    temperature: 0.1,
                }),
            });

            if (!response.ok) {
                return { call: this.fallbackDecide(stepDescription), usage: undefined };
            }

            const data = await response.json();
            const toolCalls = data.choices?.[0]?.message?.tool_calls;

            if (toolCalls?.[0]) {
                const { name, arguments: args } = toolCalls[0].function;
                if (this.toolRegistry.has(name)) {
                    return { call: { toolName: name, input: JSON.parse(args) }, usage: data.usage };
                }
            }
            return { call: null, usage: data.usage };
        } catch (error) {
            return { call: this.fallbackDecide(stepDescription), usage: undefined };
        }
    }

    private parseToolDecision(content: string): { tool: string | null, input?: any } | null {
        try {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
        } catch { }
        return null;
    }

    private fallbackDecide(desc: string): { toolName: string; input: unknown } | null {
        const lower = desc.toLowerCase();
        if (lower.includes('sql') || lower.includes('查询')) {
            return { toolName: 'sql-query', input: { query: 'SELECT * FROM users LIMIT 10' } };
        }
        if (lower.includes('文档') || lower.includes('搜索')) {
            return { toolName: 'document-search', input: { keywords: ['优化'] } };
        }
        return null;
    }
}
