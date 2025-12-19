/**
 * LLM Responder 节点
 * 使用 LLM 生成自然语言风格的最终答复
 */
import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
import type { LLMProvider } from '../core/llm-provider';
export interface LLMResponderNodeConfig {
    /** LLM Provider 实例 */
    provider?: LLMProvider;
    /** 是否包含详细的执行统计 */
    includeStats?: boolean;
    /** 回复语言 */
    language?: 'auto' | 'zh' | 'en';
}
export declare class LLMResponderNode extends BaseNode {
    private provider?;
    private includeStats;
    private language;
    constructor(config?: LLMResponderNodeConfig);
    /** 设置 LLM Provider */
    setProvider(provider: LLMProvider): void;
    execute(state: State, context?: any): Promise<NodeResult>;
    /** 构建执行上下文 */
    private buildExecutionContext;
    /** 使用 LLM 生成回复 */
    private generateWithLLM;
    /** 构建系统提示词 */
    private buildSystemPrompt;
    /** 构建用户提示词 */
    private buildUserPrompt;
    /** 附加统计信息 */
    private appendStats;
    /** 模板回复（回退方案） */
    private generateTemplateResponse;
}
//# sourceMappingURL=llm-responder.d.ts.map