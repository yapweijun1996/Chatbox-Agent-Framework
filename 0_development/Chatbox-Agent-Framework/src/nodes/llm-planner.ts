/**
 * Planner 节点（LLM 版本）
 * 使用 LLM Provider 生成任务计划
 */

import { BaseNode } from '../core/node';
import type { NodeResult, State, TaskStep } from '../core/types';
import { updateState, StateHelpers } from '../core/state';
import type { ToolRegistry } from '../core/tool-registry';
import type { LLMProvider, ChatMessage } from '../core/llm-provider';

export interface LLMPlannerNodeConfig {
    /** LLM Provider 实例（可选，如果不传则从 ToolRegistry 获取） */
    provider?: LLMProvider;
    /** Prompt 模板（支持 {{goal}}/{{tools}} 占位符） */
    promptTemplate?: {
        system?: string;
        user?: string;
    };
    /** Few-shot 示例 */
    examples?: Array<{
        goal: string;
        plan: string;
    }>;
    /** 规划策略 */
    planningStyle?: 'basic' | 'react' | 'cot';
    /** 自我反思 */
    selfReflection?: {
        enabled?: boolean;
        prompt?: string;
    };
    /** Plan-and-Execute 循环优化 */
    planAndExecute?: {
        enabled?: boolean;
        includeToolResults?: boolean;
    };
}

export class LLMPlannerNode extends BaseNode {
    private provider?: LLMProvider;
    private config?: LLMPlannerNodeConfig;

    constructor(
        private toolRegistry: ToolRegistry,
        config?: LLMPlannerNodeConfig
    ) {
        super('planner', 'LLM Planner');
        this.provider = config?.provider;
        this.config = config;
    }

    /**
     * 设置 LLM Provider（支持动态更新）
     */
    setProvider(provider: LLMProvider): void {
        this.provider = provider;
    }

    async execute(state: State, context?: any): Promise<NodeResult> {
        const events: NodeResult['events'] = [];

        try {
            // 使用 LLM 生成计划
            const { content, usage, isReplan } = await this.generatePlanWithLLM(state, state.task.goal, context);
            const finalPlan = await this.reflectPlanIfNeeded(state, content, context);
            const steps = this.parseSteps(finalPlan);
            const mergedSteps = isReplan ? this.mergeReplannedSteps(state, steps) : steps;

            // 更新 State
            let newState = updateState(state, draft => {
                draft.task.plan = this.formatPlan(mergedSteps);
                draft.task.steps = mergedSteps;
                draft.task.progress = 10;
            });

            // 记录 Token 使用量
            if (usage) {
                newState = StateHelpers.addTokenUsage(newState, {
                    prompt: usage.promptTokens,
                    completion: usage.completionTokens,
                    total: usage.totalTokens
                });
            }

            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'node_end',
                nodeId: this.id,
                status: 'success',
                summary: `LLM 生成了 ${mergedSteps.length} 个子任务 (Tokens: ${usage?.totalTokens || 'unknown'})`,
                metadata: {
                    stepCount: mergedSteps.length,
                    usage
                },
            });

            return this.createResult(newState, events);
        } catch (error) {
            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'error',
                nodeId: this.id,
                status: 'failure',
                summary: `规划失败: ${error}`,
            });

            throw error;
        }
    }

    /**
     * 使用 LLM 生成计划
     */
    private async generatePlanWithLLM(
        state: State,
        goal: string,
        context?: any
    ): Promise<{ content: string, usage?: any, isReplan: boolean }> {
        const tools = this.toolRegistry.list().join(', ') || '无';
        const styleInstruction = this.getPlanningStyleInstruction(this.config?.planningStyle);
        const isReplan = this.shouldReplan(state);
        const completedSteps = this.formatCompletedSteps(state);
        const toolResults = this.formatToolResults(state);

        const defaultSystemPrompt = `你是一个任务规划助手。用户会给你一个目标，你需要将其拆解为清晰的步骤。

要求：
1. 每个步骤一行，格式为 "1. 步骤描述"
2. 步骤要具体、可执行
3. 步骤数量控制在 3-6 个
4. 只输出步骤列表，不要其他内容
${styleInstruction ? `5. ${styleInstruction}` : ''}
${isReplan ? '6. 仅输出剩余步骤列表，不要重复已完成步骤' : ''}

可用工具：{{tools}}

示例：
用户目标：优化这段 SQL 并保持结果一致
你的输出：
1. 分析当前 SQL 语句结构
2. 识别性能瓶颈和优化点
3. 生成优化后的 SQL 语句
4. 验证优化前后结果一致性`;

        const defaultUserPrompt = isReplan
            ? `用户目标：{{goal}}\n\n已完成步骤：\n{{completed_steps}}\n\n最新工具结果：\n{{tool_results}}\n\n请基于已有执行结果，生成剩余任务步骤：`
            : `用户目标：{{goal}}\n\n请生成任务步骤：`;

        const systemPromptTemplate = this.config?.promptTemplate?.system || defaultSystemPrompt;
        const userPromptTemplate = this.config?.promptTemplate?.user || defaultUserPrompt;

        const systemPrompt = this.interpolateTemplate(systemPromptTemplate, {
            goal,
            tools,
            completed_steps: completedSteps,
            tool_results: toolResults,
        });
        const userPrompt = this.interpolateTemplate(userPromptTemplate, {
            goal,
            tools,
            completed_steps: completedSteps,
            tool_results: toolResults,
        });

        // 优先使用注入的 Provider
        if (this.provider) {
            const response = await this.callWithProvider(systemPrompt, userPrompt, state, context, this.config?.examples);
            return { ...response, isReplan };
        }

        // 回退：使用 ToolRegistry 中的 LLM 工具
        const response = await this.callWithToolRegistry(systemPrompt, userPrompt, state, context, this.config?.examples);
        return { ...response, isReplan };
    }

    /**
     * 使用 Provider 调用 LLM
     */
    private async callWithProvider(
        systemPrompt: string,
        userPrompt: string,
        state: State,
        context?: any,
        examples?: LLMPlannerNodeConfig['examples']
    ): Promise<{ content: string, usage?: any }> {
        const messages: ChatMessage[] = this.buildMessages(systemPrompt, userPrompt, examples);

        const useStreaming = state.policy.useStreaming !== false;

        if (useStreaming && context?.emitEvent) {
            // 流式响应
            let fullContent = '';
            const stream = this.provider!.chatStream({
                messages,
                temperature: 0.3,
            });

            for await (const chunk of stream) {
                if (chunk.delta) {
                    fullContent += chunk.delta;
                    context.emitEvent('stream_chunk', 'info', 'generating plan...', { chunk: chunk.delta });
                }
            }

            console.log('[LLMPlanner] LLM Raw Output:', fullContent);

            return {
                content: fullContent.trim(),
                usage: undefined, // 流式模式通常不返回 usage
            };
        } else {
            // 非流式响应
            const response = await this.provider!.chat({
                messages,
                temperature: 0.3,
            });

            console.log('[LLMPlanner] LLM Raw Output:', response.content);

            return {
                content: response.content.trim(),
                usage: response.usage,
            };
        }
    }

    /**
     * 使用 ToolRegistry 调用 LLM（回退方案）
     */
    private async callWithToolRegistry(
        systemPrompt: string,
        userPrompt: string,
        state: State,
        context?: any,
        examples?: LLMPlannerNodeConfig['examples']
    ): Promise<{ content: string, usage?: any }> {
        const useStreaming = state.policy.useStreaming !== false;
        const messages = this.buildMessages(systemPrompt, userPrompt, examples);
        const formattedPrompt = messages.map(message => `${message.role}: ${message.content}`).join('\n');

        const result = await this.toolRegistry.execute('lm-studio-llm', {
            prompt: formattedPrompt,
            systemPrompt,
            temperature: 0.3,
            onStream: useStreaming ? (chunk: string) => {
                context?.emitEvent('stream_chunk', 'info', 'generating plan...', { chunk });
            } : undefined
        });

        if (!result.success || !result.output) {
            console.error('[LLMPlanner] ❌ LLM 调用失败');
            throw new Error('LLM 调用失败');
        }

        const output = result.output as { content: string, usage?: any };
        console.log('[LLMPlanner] LLM Raw Output:', output.content);

        return {
            content: output.content.trim(),
            usage: output.usage
        };
    }

    /**
     * 解析步骤
     */
    private parseSteps(plan: string): TaskStep[] {
        const lines = plan.split('\n').filter(line => line.trim());

        return lines.map((line, index) => ({
            id: `step-${index + 1}`,
            description: line.replace(/^\d+\.\s*/, ''), // 移除序号
            status: 'pending' as const,
        }));
    }

    private buildMessages(
        systemPrompt: string,
        userPrompt: string,
        examples?: LLMPlannerNodeConfig['examples']
    ): ChatMessage[] {
        const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

        if (examples && examples.length > 0) {
            for (const example of examples) {
                messages.push({ role: 'user', content: `用户目标：${example.goal}\n\n请生成任务步骤：` });
                messages.push({ role: 'assistant', content: example.plan.trim() });
            }
        }

        messages.push({ role: 'user', content: userPrompt });
        return messages;
    }

    private interpolateTemplate(template: string, values: Record<string, string>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
    }

    private getPlanningStyleInstruction(style?: LLMPlannerNodeConfig['planningStyle']): string {
        switch (style) {
            case 'react':
                return '使用 ReAct 风格进行思考，但仅输出步骤列表，不展示中间推理';
            case 'cot':
                return '进行链式推理，但仅输出步骤列表，不展示推理过程';
            default:
                return '';
        }
    }

    private async reflectPlanIfNeeded(state: State, plan: string, context?: any): Promise<string> {
        if (!this.config?.selfReflection?.enabled) {
            return plan;
        }

        const reflectionSystemPrompt = this.config.selfReflection.prompt
            || `你是任务规划审查员。请检查当前计划是否可执行、完整、步骤清晰，并在必要时改进。

要求：
1. 仍然只输出步骤列表，格式为 "1. 步骤描述"
2. 若计划已足够好，可进行微调但不要引入多余内容`;

        const reflectionUserPrompt = `用户目标：${state.task.goal}\n\n当前计划：\n${plan}\n\n请给出优化后的计划：`;

        if (this.provider) {
            const response = await this.callWithProvider(reflectionSystemPrompt, reflectionUserPrompt, state, context);
            return response.content.trim();
        }

        const response = await this.callWithToolRegistry(reflectionSystemPrompt, reflectionUserPrompt, state, context);
        return response.content.trim();
    }

    private shouldReplan(state: State): boolean {
        const enabled = this.config?.planAndExecute?.enabled ?? false;
        return enabled && state.task.steps.length > 0 && state.task.currentStepIndex > 0;
    }

    private mergeReplannedSteps(state: State, remainingSteps: TaskStep[]): TaskStep[] {
        const completed = state.task.steps.slice(0, state.task.currentStepIndex);
        const merged = [...completed];
        remainingSteps.forEach((step, index) => {
            merged.push({
                ...step,
                id: `step-${completed.length + index + 1}`,
            });
        });
        return merged;
    }

    private formatPlan(steps: TaskStep[]): string {
        return steps.map((step, index) => `${index + 1}. ${step.description}`).join('\n');
    }

    private formatCompletedSteps(state: State): string {
        if (state.task.steps.length === 0) {
            return '无';
        }

        const completed = state.task.steps.slice(0, state.task.currentStepIndex);
        if (completed.length === 0) {
            return '无';
        }

        return completed
            .map((step, index) => {
                const result = step.result ? ` (结果: ${this.formatValue(step.result)})` : '';
                return `${index + 1}. ${step.description}${result}`;
            })
            .join('\n');
    }

    private formatToolResults(state: State): string {
        if (this.config?.planAndExecute?.includeToolResults === false) {
            return '已关闭';
        }

        const results = state.artifacts.toolResults as Array<{ toolName: string; output: unknown }> | undefined;
        if (!results || results.length === 0) {
            return '无';
        }

        return results.slice(-3).map((result, index) => {
            return `${index + 1}. ${result.toolName}: ${this.formatValue(result.output)}`;
        }).join('\n');
    }

    private formatValue(value: unknown): string {
        if (typeof value === 'string') {
            return value;
        }

        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
}
