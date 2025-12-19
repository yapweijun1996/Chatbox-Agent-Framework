/**
 * Planner 节点（LLM 版本）
 * 使用 LLM Provider 生成任务计划
 */
import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
import type { ToolRegistry } from '../core/tool-registry';
import type { LLMProvider } from '../core/llm-provider';
export interface LLMPlannerNodeConfig {
    /** LLM Provider 实例（可选，如果不传则从 ToolRegistry 获取） */
    provider?: LLMProvider;
}
export declare class LLMPlannerNode extends BaseNode {
    private toolRegistry;
    private provider?;
    constructor(toolRegistry: ToolRegistry, config?: LLMPlannerNodeConfig);
    /**
     * 设置 LLM Provider（支持动态更新）
     */
    setProvider(provider: LLMProvider): void;
    execute(state: State, context?: any): Promise<NodeResult>;
    /**
     * 使用 LLM 生成计划
     */
    private generatePlanWithLLM;
    /**
     * 使用 Provider 调用 LLM
     */
    private callWithProvider;
    /**
     * 使用 ToolRegistry 调用 LLM（回退方案）
     */
    private callWithToolRegistry;
    /**
     * 解析步骤
     */
    private parseSteps;
}
//# sourceMappingURL=llm-planner.d.ts.map