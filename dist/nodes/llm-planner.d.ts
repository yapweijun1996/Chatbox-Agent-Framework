/**
 * Planner 节点（LLM 版本）
 * 使用 LM Studio 本地 LLM 生成任务计划
 */
import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
import type { ToolRegistry } from '../core/tool-registry';
export declare class LLMPlannerNode extends BaseNode {
    private toolRegistry;
    constructor(toolRegistry: ToolRegistry);
    execute(state: State, context?: any): Promise<NodeResult>;
    /**
     * 使用 LLM 生成计划
     */
    private generatePlanWithLLM;
    /**
     * 解析步骤
     */
    private parseSteps;
}
//# sourceMappingURL=llm-planner.d.ts.map