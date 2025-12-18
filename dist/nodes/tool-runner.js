/**
 * ToolRunner 节点
 * 负责执行工具调用
 */
import { BaseNode } from '../core/node';
import { updateState, StateHelpers } from '../core/state';
import { createError, ErrorType } from '../core/error-handler';
export class ToolRunnerNode extends BaseNode {
    toolRegistry;
    constructor(toolRegistry) {
        super('tool-runner', 'ToolRunner');
        this.toolRegistry = toolRegistry;
    }
    async execute(state, context) {
        const events = [];
        let currentState = state;
        // 获取当前步骤
        const currentStep = state.task.steps[state.task.currentStepIndex];
        if (!currentStep) {
            throw new Error('没有可执行的步骤');
        }
        // 更新步骤状态为 running
        currentState = updateState(currentState, draft => {
            draft.task.steps[draft.task.currentStepIndex].status = 'running';
        });
        try {
            // 根据步骤描述决定调用哪个工具 (LLM 版)
            const { call: toolCall, usage } = await this.decideToolCallWithLLM(state, currentStep.description, context);
            // 记录 Token 使用量 (决策工具消耗的)
            if (usage) {
                currentState = StateHelpers.addTokenUsage(currentState, {
                    prompt: usage.promptTokens,
                    completion: usage.completionTokens,
                    total: usage.totalTokens
                });
            }
            if (!toolCall) {
                // 无需工具调用的步骤，直接标记完成
                currentState = updateState(currentState, draft => {
                    draft.task.steps[draft.task.currentStepIndex].status = 'completed';
                    draft.task.steps[draft.task.currentStepIndex].result = '已完成';
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
            // 发射工具调用事件
            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'tool_call',
                nodeId: this.id,
                status: 'info',
                summary: `调用工具: ${toolCall.toolName}`,
                metadata: { toolName: toolCall.toolName, input: toolCall.input },
            });
            // 执行工具
            const startTime = Date.now();
            const result = await this.toolRegistry.execute(toolCall.toolName, toolCall.input, {
                nodeId: this.id,
                permissions: state.policy.permissions,
                onStream: (chunk) => {
                    context?.emitEvent('stream_chunk', 'info', `Executing ${toolCall.toolName}...`, { chunk });
                }
            });
            const duration = Date.now() - startTime;
            if (!result.success) {
                throw createError(ErrorType.EXECUTION, result.error || '工具执行失败', {
                    nodeId: this.id,
                    toolName: toolCall.toolName,
                });
            }
            // 更新 State
            currentState = StateHelpers.incrementToolCall(currentState);
            currentState = StateHelpers.recordNodeTiming(currentState, this.id, duration);
            currentState = updateState(currentState, draft => {
                draft.task.steps[draft.task.currentStepIndex].status = 'completed';
                draft.task.steps[draft.task.currentStepIndex].result = result.output;
                // 将工具结果添加到 artifacts
                if (!draft.artifacts.toolResults) {
                    draft.artifacts.toolResults = [];
                }
                draft.artifacts.toolResults.push({
                    stepId: currentStep.id,
                    toolName: toolCall.toolName,
                    output: result.output,
                    timestamp: Date.now(),
                });
                // 递增步骤索引（重要！）
                draft.task.currentStepIndex += 1;
            });
            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'tool_result',
                nodeId: this.id,
                status: 'success',
                summary: `工具 ${toolCall.toolName} 执行成功 (${duration}ms)`,
                payloadRef: `tool-result-${currentStep.id}`,
                metadata: { duration, toolName: toolCall.toolName },
            });
            return this.createResult(currentState, events);
        }
        catch (error) {
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
    /**
     * 使用 LLM 决定工具调用
     */
    async decideToolCallWithLLM(state, stepDescription, context) {
        // 1. 获取所有可用工具的描述
        const tools = this.toolRegistry.list().map(name => {
            const tool = this.toolRegistry.get(name);
            // 简单的 schema 描述，实际项目中可能需要更详细的 JSON schema 转字符串
            return `- ${name}: ${tool.description}`;
        }).join('\n');
        const systemPrompt = `你是一个智能工具选择助手。你的任务是根据用户给出的步骤描述，从可用工具列表中选择最合适的一个，并构造调用参数。

可用工具列表：
${tools}

要求：
1. 如果步骤需要使用工具，请返回一个 JSON 对象，包含 "toolName" 和 "input" 字段。
2. "input" 必须符合该工具的参数要求。
3. 如果步骤不需要使用任何工具（例如纯粹的分析、思考或无需操作的步骤），请返回 null。
4. 只输出 JSON，不要包含 markdown 格式或其他废话。

示例输出：
{
  "toolName": "sql-query",
  "input": { "query": "SELECT * FROM users" }
}`;
        const prompt = `当前步骤任务：${stepDescription}\n\n请决策：`;
        const useStreaming = state.policy.useStreaming !== false;
        try {
            // 调用 LLM 工具 (假设 lm-studio-llm 已注册)
            const result = await this.toolRegistry.execute('lm-studio-llm', {
                prompt,
                systemPrompt,
                temperature: 0.1,
                onStream: useStreaming ? (chunk) => {
                    context?.emitEvent('stream_chunk', 'info', 'Deciding tool...', { chunk });
                } : undefined
            });
            if (!result.success || !result.output) {
                console.warn('LLM 工具选择失败，回退到规则判断');
                return { call: this.fallbackDecideToolCall(stepDescription), usage: undefined };
            }
            const output = result.output;
            const outputContent = output.content.trim();
            // 处理可能的 markdown 代码块
            const jsonStr = outputContent.replace(/^```json\s*|\s*```$/g, '');
            if (jsonStr === 'null')
                return { call: null, usage: output.usage };
            const parsed = JSON.parse(jsonStr);
            // 简单验证结构
            if (parsed && typeof parsed.toolName === 'string' && parsed.input) {
                // 验证工具是否存在
                if (this.toolRegistry.has(parsed.toolName)) {
                    return {
                        call: {
                            toolName: parsed.toolName,
                            input: parsed.input
                        },
                        usage: output.usage
                    };
                }
            }
            return { call: null, usage: output.usage };
        }
        catch (error) {
            console.error('LLM 决策工具失败:', error);
            return { call: this.fallbackDecideToolCall(stepDescription), usage: undefined };
        }
    }
    /**
     * 回退策略：基于规则的简单判断
     */
    fallbackDecideToolCall(stepDescription) {
        const desc = stepDescription.toLowerCase();
        if (desc.includes('sql') || desc.includes('查询')) {
            return {
                toolName: 'sql-query',
                input: { query: 'SELECT * FROM users LIMIT 10' },
            };
        }
        if (desc.includes('文档') || desc.includes('搜索') || desc.includes('检索')) {
            return {
                toolName: 'document-search',
                input: { keywords: ['优化', 'SQL'] },
            };
        }
        return null;
    }
}
//# sourceMappingURL=tool-runner.js.map