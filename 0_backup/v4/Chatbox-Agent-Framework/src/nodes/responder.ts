/**
 * Responder 节点
 * 汇总结果并生成最终答复
 */

import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
import { updateState, StateHelpers } from '../core/state';

export class ResponderNode extends BaseNode {
    constructor() {
        super('responder', 'Responder');
    }

    async execute(state: State): Promise<NodeResult> {
        const events: NodeResult['events'] = [];

        try {
            // 汇总所有步骤结果
            const summary = this.summarizeResults(state);

            // 生成最终答复
            const response = this.generateResponse(state, summary);

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
                metadata: { responseLength: response.length },
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

    /**
     * 汇总结果
     */
    private summarizeResults(state: State): string {
        const completedSteps = state.task.steps.filter(s => s.status === 'completed');
        const failedSteps = state.task.steps.filter(s => s.status === 'failed');

        let summary = `## 任务执行摘要\n\n`;
        summary += `**目标**: ${state.task.goal}\n\n`;
        summary += `**完成步骤**: ${completedSteps.length}/${state.task.steps.length}\n\n`;

        if (completedSteps.length > 0) {
            summary += `### 已完成步骤\n`;
            completedSteps.forEach(step => {
                summary += `- ${step.description}\n`;
            });
            summary += '\n';
        }

        if (failedSteps.length > 0) {
            summary += `### 失败步骤\n`;
            failedSteps.forEach(step => {
                summary += `- ${step.description}: ${step.error}\n`;
            });
            summary += '\n';
        }

        return summary;
    }

    /**
     * 生成最终答复
     */
    private generateResponse(state: State, summary: string): string {
        let response = summary;

        // 添加工具结果（如果有）
        const toolResults = state.artifacts.toolResults as Array<{
            stepId: string;
            toolName: string;
            output: unknown;
        }> | undefined;

        if (toolResults && toolResults.length > 0) {
            response += `### 工具执行结果\n\n`;
            toolResults.forEach(result => {
                response += `**${result.toolName}**:\n`;
                response += `\`\`\`json\n${JSON.stringify(result.output, null, 2)}\n\`\`\`\n\n`;
            });
        }

        // 添加遥测数据
        response += `### 性能统计\n`;
        response += `- 总耗时: ${state.telemetry.totalDuration}ms\n`;
        response += `- 工具调用次数: ${state.telemetry.toolCallCount}\n`;
        response += `- 错误次数: ${state.telemetry.errorCount}\n`;
        response += `- 重试次数: ${state.telemetry.retryCount}\n`;

        return response;
    }
}
