/**
 * ToolRunner 节点
 * 负责执行工具调用
 */
import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
import type { ToolRegistry } from '../core/tool-registry';
import type { LLMProvider } from '../core/llm-provider';
export interface ToolRunnerNodeConfig {
    /** LLM Provider 实例（用于工具选择决策） */
    provider?: LLMProvider;
}
export declare class ToolRunnerNode extends BaseNode {
    private toolRegistry;
    private provider?;
    constructor(toolRegistry: ToolRegistry, config?: ToolRunnerNodeConfig);
    /** 设置 LLM Provider（支持动态更新） */
    setProvider(provider: LLMProvider): void;
    execute(state: State, context?: any): Promise<NodeResult>;
    /** 决定工具调用 */
    private decideToolCall;
    /** 使用 Provider 决定工具调用 */
    private decideWithProvider;
    /** 使用 Fetch 调用 */
    private decideWithFetch;
    private parseToolDecision;
    private fallbackDecide;
}
//# sourceMappingURL=tool-runner.d.ts.map