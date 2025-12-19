/**
 * OpenAI LLM 工具
 * 调用 OpenAI API 进行文本生成
 */
import type { Tool } from '../core/types';
export interface OpenAIConfig {
    apiKey: string;
    baseURL?: string;
    model: string;
    temperature?: number;
}
/**
 * 创建 OpenAI LLM 工具
 */
export declare function createOpenAITool(config: OpenAIConfig): Tool;
/**
 * 默认 OpenAI 配置
 */
export declare const defaultOpenAIConfig: Omit<OpenAIConfig, 'apiKey'>;
//# sourceMappingURL=openai-tool.d.ts.map