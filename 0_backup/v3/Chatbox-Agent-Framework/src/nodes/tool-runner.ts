/**
 * ToolRunner 节点
 * 负责执行工具调用
 */

import { BaseNode } from '../core/node';
import type { NodeContext, NodeResult, PendingToolCall, State, TaskStep } from '../core/types';
import { updateState, StateHelpers } from '../core/state';
import type { ToolRegistry } from '../core/tool-registry';
import type { LLMProvider } from '../core/llm-provider';
import { createError, ErrorType } from '../core/error-handler';
import { decideToolCall } from './tool-call-decider';

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

    async execute(state: State, context?: NodeContext): Promise<NodeResult> {
        const events: NodeResult['events'] = [];
        let currentState = state;

        const currentStep = state.task.steps[state.task.currentStepIndex];
        if (!currentStep) {
            throw new Error('没有可执行的步骤');
        }

        currentState = updateState(currentState, draft => {
            const step = draft.task.steps[draft.task.currentStepIndex];
            if (step) {
                step.status = 'running';
            }
        });

        try {
            const pendingCall = currentState.task.pendingToolCall;
            if (pendingCall) {
                if (pendingCall.stepId !== currentStep.id) {
                    currentState = updateState(currentState, draft => {
                        delete draft.task.pendingToolCall;
                    });
                } else if (pendingCall.status === 'pending') {
                    return this.createResult(currentState, events);
                } else if (pendingCall.status === 'approved') {
                    return await this.executeToolCall(currentState, currentStep, pendingCall, context, events);
                } else if (pendingCall.status === 'denied') {
                    currentState = this.handleDeniedToolCall(currentState, pendingCall);
                    events.push({
                        id: `evt-${Date.now()}`,
                        timestamp: Date.now(),
                        type: 'tool_result',
                        nodeId: this.id,
                        status: 'warning',
                        summary: `工具 ${pendingCall.toolName} 已被拒绝`,
                        metadata: { toolName: pendingCall.toolName, reason: pendingCall.decisionReason },
                    });
                    return this.createResult(currentState, events);
                }
            }

            const { call: toolCall, usage } = await decideToolCall(
                this.toolRegistry,
                currentStep.description,
                { provider: this.provider, providerConfig: state.artifacts.providerConfig as any }
            );

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
                    delete draft.task.pendingToolCall;
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

            const tool = this.toolRegistry.get(toolCall.toolName);
            if (tool && tool.requiresConfirmation) {
                const pending = this.buildPendingToolCall(toolCall.toolName, toolCall.input, currentStep, tool);
                currentState = updateState(currentState, draft => {
                    draft.task.pendingToolCall = pending;
                });
                return this.createResult(currentState, events);
            }

            return await this.executeToolCall(currentState, currentStep, toolCall, context, events);
        } catch (error) {
            currentState = StateHelpers.incrementError(currentState);
            currentState = updateState(currentState, draft => {
                const step = draft.task.steps[draft.task.currentStepIndex];
                if (step) {
                    step.status = 'failed';
                    step.error = String(error);
                }
                delete draft.task.pendingToolCall;
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

    private buildPendingToolCall(
        toolName: string,
        input: unknown,
        step: TaskStep,
        tool: { permissions: string[]; confirmationMessage?: string }
    ): PendingToolCall {
        return {
            toolName,
            input,
            stepId: step.id,
            stepDescription: step.description,
            permissions: tool.permissions || [],
            confirmationMessage: tool.confirmationMessage,
            requestedAt: Date.now(),
            status: 'pending',
        };
    }

    private handleDeniedToolCall(state: State, pendingCall: PendingToolCall): State {
        return updateState(state, draft => {
            const step = draft.task.steps[draft.task.currentStepIndex];
            if (step) {
                step.status = 'failed';
                step.error = pendingCall.decisionReason || 'Tool execution denied';
            }
            delete draft.task.pendingToolCall;
        });
    }

    private async executeToolCall(
        currentState: State,
        currentStep: TaskStep,
        toolCall: { toolName: string; input: unknown },
        context: NodeContext | undefined,
        events: NodeResult['events']
    ): Promise<NodeResult> {
        events.push({
            id: `evt-${Date.now()}`,
            timestamp: Date.now(),
            type: 'tool_call',
            nodeId: this.id,
            status: 'info',
            summary: `调用工具: ${toolCall.toolName}`,
            metadata: { toolName: toolCall.toolName, input: toolCall.input },
        });

        const useStreaming = currentState.policy.useStreaming !== false;
        const onStream = useStreaming && context?.emitEvent
            ? (chunk: string) => {
                context.emitEvent('stream_chunk', 'info', `tool stream: ${toolCall.toolName}`, {
                    toolName: toolCall.toolName,
                    stepId: currentStep.id,
                    chunk,
                });
            }
            : undefined;

        const startTime = Date.now();
        const result = await this.toolRegistry.execute(toolCall.toolName, toolCall.input, {
            nodeId: this.id,
            permissions: currentState.policy.permissions,
            onStream,
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
            const step = draft.task.steps[draft.task.currentStepIndex];
            if (step) {
                step.status = 'completed';
                step.result = result.output;
            }

            delete draft.task.pendingToolCall;
            if (!draft.artifacts.toolResults) {
                draft.artifacts.toolResults = [];
            }
            (draft.artifacts.toolResults as unknown[]).push({
                stepId: currentStep.id,
                toolName: toolCall.toolName,
                output: result.output,
                timestamp: Date.now(),
            });
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
    }

}
