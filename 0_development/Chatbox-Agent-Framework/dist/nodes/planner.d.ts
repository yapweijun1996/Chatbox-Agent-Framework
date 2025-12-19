/**
 * Planner 节点
 * 负责解析用户目标，生成任务计划与步骤
 */
import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
export declare class PlannerNode extends BaseNode {
    constructor();
    execute(state: State): Promise<NodeResult>;
    /**
     * 生成计划（简化版规则引擎）
     * 实际项目中应调用 LLM API
     */
    private generatePlan;
    /**
     * 解析步骤
     */
    private parseSteps;
}
//# sourceMappingURL=planner.d.ts.map