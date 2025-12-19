/**
 * Planner 节点（LLM 版本）
 * 使用 LLM Provider 生成任务计划
 */
import { BaseNode } from '../core/node';
import { updateState, StateHelpers } from '../core/state';
export class LLMPlannerNode extends BaseNode {
    toolRegistry;
    provider;
    constructor(toolRegistry, config) {
        super('planner', 'LLM Planner');
        this.toolRegistry = toolRegistry;
        this.provider = config?.provider;
    }
    /**
     * 设置 LLM Provider（支持动态更新）
     */
    setProvider(provider) {
        this.provider = provider;
    }
    async execute(state, context) {
        const events = [];
        try {
            // 使用 LLM 生成计划
            const { content, usage } = await this.generatePlanWithLLM(state, state.task.goal, context);
            const steps = this.parseSteps(content);
            // 更新 State
            let newState = updateState(state, draft => {
                draft.task.plan = content;
                draft.task.steps = steps;
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
                summary: `LLM 生成了 ${steps.length} 个子任务 (Tokens: ${usage?.totalTokens || 'unknown'})`,
                metadata: {
                    stepCount: steps.length,
                    usage
                },
            });
            return this.createResult(newState, events);
        }
        catch (error) {
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
    async generatePlanWithLLM(state, goal, context) {
        const systemPrompt = `你是一个任务规划助手。用户会给你一个目标，你需要将其拆解为清晰的步骤。

要求：
1. 每个步骤一行，格式为 "1. 步骤描述"
2. 步骤要具体、可执行
3. 步骤数量控制在 3-6 个
4. 只输出步骤列表，不要其他内容

示例：
用户目标：优化这段 SQL 并保持结果一致
你的输出：
1. 分析当前 SQL 语句结构
2. 识别性能瓶颈和优化点
3. 生成优化后的 SQL 语句
4. 验证优化前后结果一致性`;
        const userPrompt = `用户目标：${goal}\n\n请生成任务步骤：`;
        // 优先使用注入的 Provider
        if (this.provider) {
            return this.callWithProvider(systemPrompt, userPrompt, state, context);
        }
        // 回退：使用 ToolRegistry 中的 LLM 工具
        return this.callWithToolRegistry(systemPrompt, userPrompt, state, context);
    }
    /**
     * 使用 Provider 调用 LLM
     */
    async callWithProvider(systemPrompt, userPrompt, state, context) {
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];
        const useStreaming = state.policy.useStreaming !== false;
        if (useStreaming && context?.emitEvent) {
            // 流式响应
            let fullContent = '';
            const stream = this.provider.chatStream({
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
        }
        else {
            // 非流式响应
            const response = await this.provider.chat({
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
    async callWithToolRegistry(systemPrompt, userPrompt, state, context) {
        const useStreaming = state.policy.useStreaming !== false;
        const result = await this.toolRegistry.execute('lm-studio-llm', {
            prompt: userPrompt,
            systemPrompt,
            temperature: 0.3,
            onStream: useStreaming ? (chunk) => {
                context?.emitEvent('stream_chunk', 'info', 'generating plan...', { chunk });
            } : undefined
        });
        if (!result.success || !result.output) {
            console.error('[LLMPlanner] ❌ LLM 调用失败');
            throw new Error('LLM 调用失败');
        }
        const output = result.output;
        console.log('[LLMPlanner] LLM Raw Output:', output.content);
        return {
            content: output.content.trim(),
            usage: output.usage
        };
    }
    /**
     * 解析步骤
     */
    parseSteps(plan) {
        const lines = plan.split('\n').filter(line => line.trim());
        return lines.map((line, index) => ({
            id: `step-${index + 1}`,
            description: line.replace(/^\d+\.\s*/, ''), // 移除序号
            status: 'pending',
        }));
    }
}
//# sourceMappingURL=llm-planner.js.map