/**
 * LLM Provider 工厂
 * 统一创建不同类型的 LLM Provider
 */

import { LLMProvider } from '../core/llm-provider';
import { OpenAIProvider, type OpenAIProviderConfig } from './openai-provider';
import { GeminiProvider, type GeminiProviderConfig } from './gemini-provider';
import { LMStudioProvider, type LMStudioProviderConfig } from './lm-studio-provider';

/**
 * Provider 配置类型
 */
export type LLMProviderConfig =
    | ({ type: 'openai' } & OpenAIProviderConfig)
    | ({ type: 'gemini' } & GeminiProviderConfig)
    | ({ type: 'lm-studio' } & LMStudioProviderConfig);

/**
 * 创建 LLM Provider
 */
export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
    switch (config.type) {
        case 'openai':
            return new OpenAIProvider({
                apiKey: config.apiKey,
                model: config.model,
                baseURL: config.baseURL,
                temperature: config.temperature,
                timeout: config.timeout,
            });

        case 'gemini':
            return new GeminiProvider({
                apiKey: config.apiKey,
                model: config.model,
                temperature: config.temperature,
                timeout: config.timeout,
            });

        case 'lm-studio':
            return new LMStudioProvider({
                baseURL: config.baseURL,
                model: config.model,
                temperature: config.temperature,
                timeout: config.timeout,
            });

        default:
            throw new Error(`Unknown provider type: ${(config as any).type}`);
    }
}

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

export function createProviderFromSettings(settings: SettingsBasedConfig): LLMProvider {
    switch (settings.provider) {
        case 'openai':
            return createLLMProvider({
                type: 'openai',
                apiKey: settings.openai.apiKey,
                model: settings.openai.model,
                baseURL: settings.openai.baseURL,
            });

        case 'gemini':
            return createLLMProvider({
                type: 'gemini',
                apiKey: settings.gemini.apiKey,
                model: settings.gemini.model,
            });

        case 'lm-studio':
            return createLLMProvider({
                type: 'lm-studio',
                baseURL: settings.lmStudio.baseURL,
                model: settings.lmStudio.model,
            });

        default:
            throw new Error(`Unknown provider: ${settings.provider}`);
    }
}
