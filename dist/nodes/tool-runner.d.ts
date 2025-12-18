/**
 * ToolRunner 节点
 * 负责执行工具调用
 */
import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
import type { ToolRegistry } from '../core/tool-registry';
export declare class ToolRunnerNode extends BaseNode {
    private toolRegistry;
    constructor(toolRegistry: ToolRegistry);
    execute(state: State, context?: any): Promise<NodeResult>;
    /**
     * 使用 LLM 决定工具调用
     */
    private decideToolCallWithLLM;
    /**
     * 回退策略：基于规则的简单判断
     */
    private fallbackDecideToolCall;
}
//# sourceMappingURL=tool-runner.d.ts.map