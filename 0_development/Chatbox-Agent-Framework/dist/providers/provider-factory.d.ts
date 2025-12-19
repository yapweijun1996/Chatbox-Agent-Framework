/**
 * LLM Provider 工厂
 * 统一创建不同类型的 LLM Provider
 */
import { LLMProvider } from '../core/llm-provider';
import { type OpenAIProviderConfig } from './openai-provider';
import { type GeminiProviderConfig } from './gemini-provider';
import { type LMStudioProviderConfig } from './lm-studio-provider';
/**
 * Provider 配置类型
 */
export type LLMProviderConfig = ({
    type: 'openai';
} & OpenAIProviderConfig) | ({
    type: 'gemini';
} & GeminiProviderConfig) | ({
    type: 'lm-studio';
} & LMStudioProviderConfig);
/**
 * 创建 LLM Provider
 */
export declare function createLLMProvider(config: LLMProviderConfig): LLMProvider;
/**
 * 从设置对象创建 Provider
 */
export interface SettingsBasedConfig {
    provider: 'openai' | 'gemini' | 'lm-studio';
    lmStudio: {
        baseURL: string;
        model: string;
    };
    gemini: {
        apiKey: string;
        model: string;
    };
    openai: {
        apiKey: string;
        baseURL: string;
        model: string;
    };
}
export declare function createProviderFromSettings(settings: SettingsBasedConfig): LLMProvider;
//# sourceMappingURL=provider-factory.d.ts.map