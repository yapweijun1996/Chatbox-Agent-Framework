/**
 * Google Gemini LLM 工具
 * 调用 Google Gemini API 进行文本生成
 */
import type { Tool } from '../core/types';
export interface GeminiConfig {
    apiKey: string;
    model: string;
    temperature?: number;
}
/**
 * 创建 Gemini LLM 工具
 */
export declare function createGeminiTool(config: GeminiConfig): Tool;
/**
 * 默认 Gemini 配置
 */
export declare const defaultGeminiConfig: Omit<GeminiConfig, 'apiKey'>;
//# sourceMappingURL=gemini-tool.d.ts.map