/**
 * Planner 节点
 * 负责解析用户目标，生成任务计划与步骤
 */

import { BaseNode } from '../core/node';
import type { NodeResult, State, TaskStep } from '../core/types';
import { updateState } from '../core/state';

export class PlannerNode extends BaseNode {
    constructor() {
        super('planner', 'Planner');
    }

    async execute(state: State): Promise<NodeResult> {
        const events: NodeResult['events'] = [];
        const startTime = Date.now();

        try {
            // 从用户目标生成计划（v0.1 使用规则引擎，后续可接入 LLM）
            const plan = await this.generatePlan(state.task.goal);
            const steps = this.parseSteps(plan);

            // 更新 State
            const newState = updateState(state, draft => {
                draft.task.plan = plan;
                draft.task.steps = steps;
                draft.task.progress = 10; // 规划完成 10%
            });

            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'node_end',
                nodeId: this.id,
                status: 'success',
                summary: `生成了 ${steps.length} 个子任务`,
                metadata: { stepCount: steps.length },
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
     * 生成计划（简化版规则引擎）
     * 实际项目中应调用 LLM API
     */
    private async generatePlan(goal: string): Promise<string> {
        // 模拟异步处理
        await new Promise(resolve => setTimeout(resolve, 100));

        // 简单规则：根据关键词生成计划
        if (goal.includes('SQL') || goal.includes('sql')) {
            return `1. 分析当前 SQL 语句\n2. 识别优化点\n3. 生成优化后的 SQL\n4. 验证结果一致性`;
        }

        if (goal.includes('文档') || goal.includes('搜索')) {
            return `1. 解析搜索关键词\n2. 检索相关文档\n3. 提取关键信息\n4. 汇总结果`;
        }

        // 默认通用计划
        return `1. 理解用户需求\n2. 收集必要信息\n3. 执行相关操作\n4. 验证结果\n5. 生成答复`;
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
}
