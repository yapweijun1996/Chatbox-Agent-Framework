/**
 * LLM Responder 节点
 * 使用 LLM 生成自然语言风格的最终答复
 */

import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
import { StateHelpers } from '../core/state';
import type { LLMProvider, ChatMessage } from '../core/llm-provider';

export interface LLMResponderNodeConfig {
    /** LLM Provider 实例 */
    provider?: LLMProvider;
    /** 是否包含详细的执行统计 */
    includeStats?: boolean;
    /** 回复语言 */
    language?: 'auto' | 'zh' | 'en';
}

export class LLMResponderNode extends BaseNode {
    private provider?: LLMProvider;
    private includeStats: boolean;
    private language: 'auto' | 'zh' | 'en';

    constructor(config?: LLMResponderNodeConfig) {
        super('responder', 'LLM Responder');
        this.provider = config?.provider;
        this.includeStats = config?.includeStats ?? false;
        this.language = config?.language ?? 'auto';
    }

    /** 设置 LLM Provider */
    setProvider(provider: LLMProvider): void {
        this.provider = provider;
    }

    async execute(state: State, context?: any): Promise<NodeResult> {
        const events: NodeResult['events'] = [];

        try {
            // 构建执行摘要上下文
            const executionContext = this.buildExecutionContext(state);

            // 使用 LLM 生成自然语言回复，或回退到模板
            const response = this.provider
                ? await this.generateWithLLM(state, executionContext, context)
                : this.generateTemplateResponse(state, executionContext);

            // 更新 State
            let newState = StateHelpers.addMessage(state, 'assistant', response);
            newState = StateHelpers.updateProgress(newState, 100);

            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'node_end',
                nodeId: this.id,
                status: 'success',
                summary: '已生成最终答复',
                metadata: { responseLength: response.length, usedLLM: !!this.provider },
            });

            return this.createResult(newState, events);
        } catch (error) {
            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'error',
                nodeId: this.id,
                status: 'failure',
                summary: `生成答复失败: ${error}`,
            });

            throw error;
        }
    }

    /** 构建执行上下文 */
    private buildExecutionContext(state: State): ExecutionContext {
        const completedSteps = state.task.steps.filter(s => s.status === 'completed');
        const failedSteps = state.task.steps.filter(s => s.status === 'failed');
        const toolResults = state.artifacts.toolResults as ToolResult[] | undefined;

        return {
            goal: state.task.goal,
            totalSteps: state.task.steps.length,
            completedSteps: completedSteps.map(s => ({
                description: s.description,
                result: s.result,
            })),
            failedSteps: failedSteps.map(s => ({
                description: s.description,
                error: s.error,
            })),
            toolResults: toolResults || [],
            stats: {
                duration: state.telemetry.totalDuration,
                toolCalls: state.telemetry.toolCallCount,
                tokenCount: state.telemetry.tokenCount,
            },
        };
    }

    /** 使用 LLM 生成回复 */
    private async generateWithLLM(
        state: State,
        ctx: ExecutionContext,
        nodeContext?: any
    ): Promise<string> {
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(ctx);

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];

        const useStreaming = state.policy.useStreaming !== false;

        if (useStreaming && nodeContext?.emitEvent) {
            let fullContent = '';
            const stream = this.provider!.chatStream({
                messages,
                temperature: 0.7,
            });

            for await (const chunk of stream) {
                if (chunk.delta) {
                    fullContent += chunk.delta;
                    nodeContext.emitEvent('stream_chunk', 'info', 'generating response...', { chunk: chunk.delta });
                }
            }

            return this.appendStats(fullContent.trim(), ctx);
        }

        const response = await this.provider!.chat({
            messages,
            temperature: 0.7,
        });

        return this.appendStats(response.content.trim(), ctx);
    }

    /** 构建系统提示词 */
    private buildSystemPrompt(): string {
        const langInstruction = this.language === 'zh'
            ? '请用中文回复。'
            : this.language === 'en'
                ? 'Please respond in English.'
                : '请根据用户的原始问题语言来回复。';

        return `你是一个智能助手，正在向用户汇报任务执行结果。

要求：
1. 用自然、友好的语言总结任务完成情况
2. 突出重要的结果和发现
3. 如果有失败的步骤，简要说明原因
4. 回复要简洁明了，避免冗长的技术细节
5. ${langInstruction}

示例回复风格：
- "我已经完成了您的请求！以下是主要发现：..."
- "任务执行完毕。关于您询问的内容，我发现..."
- "好的，我为您查询了相关信息。结果显示..."`;
    }

    /** 构建用户提示词 */
    private buildUserPrompt(ctx: ExecutionContext): string {
        let prompt = `用户的原始目标：${ctx.goal}\n\n`;

        prompt += `执行情况：\n`;
        prompt += `- 总步骤数：${ctx.totalSteps}\n`;
        prompt += `- 完成：${ctx.completedSteps.length}\n`;
        prompt += `- 失败：${ctx.failedSteps.length}\n\n`;

        if (ctx.completedSteps.length > 0) {
            prompt += `已完成的步骤：\n`;
            ctx.completedSteps.forEach((step, i) => {
                prompt += `${i + 1}. ${step.description}\n`;
                if (step.result) {
                    prompt += `   结果: ${JSON.stringify(step.result).substring(0, 200)}\n`;
                }
            });
            prompt += '\n';
        }

        if (ctx.toolResults.length > 0) {
            prompt += `工具执行结果：\n`;
            ctx.toolResults.forEach(result => {
                prompt += `- ${result.toolName}: ${JSON.stringify(result.output).substring(0, 300)}\n`;
            });
            prompt += '\n';
        }

        if (ctx.failedSteps.length > 0) {
            prompt += `失败的步骤：\n`;
            ctx.failedSteps.forEach(step => {
                prompt += `- ${step.description}: ${step.error}\n`;
            });
        }

        prompt += `\n请根据以上执行情况，用自然语言向用户汇报结果。`;

        return prompt;
    }

    /** 附加统计信息 */
    private appendStats(response: string, ctx: ExecutionContext): string {
        if (!this.includeStats) return response;

        return response + `\n\n---\n*执行统计: ${ctx.stats.toolCalls} 次工具调用, ${ctx.stats.tokenCount} tokens, ${ctx.stats.duration}ms*`;
    }

    /** 模板回复（回退方案） */
    private generateTemplateResponse(state: State, ctx: ExecutionContext): string {
        const allSuccess = ctx.failedSteps.length === 0;

        let response = allSuccess
            ? `✅ 任务已完成！\n\n`
            : `⚠️ 任务部分完成。\n\n`;

        response += `**目标**: ${ctx.goal}\n\n`;

        if (ctx.completedSteps.length > 0) {
            response += `**已完成的步骤**:\n`;
            ctx.completedSteps.forEach((step, i) => {
                response += `${i + 1}. ${step.description}\n`;
            });
            response += '\n';
        }

        if (ctx.toolResults.length > 0) {
            response += `**执行结果**:\n`;
            ctx.toolResults.forEach(result => {
                response += `- **${result.toolName}**: `;
                const output = JSON.stringify(result.output);
                response += output.length > 100 ? output.substring(0, 100) + '...' : output;
                response += '\n';
            });
        }

        if (ctx.failedSteps.length > 0) {
            response += `\n**失败的步骤**:\n`;
            ctx.failedSteps.forEach(step => {
                response += `- ${step.description}: ${step.error}\n`;
            });
        }

        return this.appendStats(response, ctx);
    }
}

// ============================================================================
// 类型定义
// ============================================================================

interface ExecutionContext {
    goal: string;
    totalSteps: number;
    completedSteps: Array<{ description: string; result?: unknown }>;
    failedSteps: Array<{ description: string; error?: string }>;
    toolResults: ToolResult[];
    stats: {
        duration: number;
        toolCalls: number;
        tokenCount: number;
    };
}

interface ToolResult {
    stepId: string;
    toolName: string;
    output: unknown;
}
