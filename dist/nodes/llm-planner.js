/**
 * Planner 节点（LLM 版本）
 * 使用 LM Studio 本地 LLM 生成任务计划
 */
import { BaseNode } from '../core/node';
import { updateState, StateHelpers } from '../core/state';
export class LLMPlannerNode extends BaseNode {
    toolRegistry;
    constructor(toolRegistry) {
        super('planner', 'LLM Planner');
        this.toolRegistry = toolRegistry;
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
        const prompt = `用户目标：${goal}

请生成任务步骤：`;
        const useStreaming = state.policy.useStreaming !== false;
        // 调用 LLM 工具
        const result = await this.toolRegistry.execute('lm-studio-llm', {
            prompt,
            systemPrompt,
            temperature: 0.3, // 较低温度，保证输出稳定
            onStream: useStreaming ? (chunk) => {
                context?.emitEvent('stream_chunk', 'info', 'generating plan...', { chunk });
            } : undefined
        });
        if (!result.success || !result.output) {
            throw new Error('LLM 调用失败');
        }
        const output = result.output;
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