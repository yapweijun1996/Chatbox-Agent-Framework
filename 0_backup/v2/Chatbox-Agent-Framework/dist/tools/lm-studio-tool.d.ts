/**
 * LM Studio LLM 工具
 * 调用本地 LM Studio 服务进行文本生成
 */
import type { Tool } from '../core/types';
export interface LMStudioConfig {
    baseURL: string;
    model: string;
    temperature?: number;
}
/**
 * 创建 LM Studio LLM 工具
 */
export declare function createLMStudioTool(config: LMStudioConfig): Tool;
/**
 * 默认 LM Studio 配置
 */
export declare const defaultLMStudioConfig: LMStudioConfig;
//# sourceMappingURL=lm-studio-tool.d.ts.map