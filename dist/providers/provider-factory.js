/**
 * LLM Provider 工厂
 * 统一创建不同类型的 LLM Provider
 */
import { OpenAIProvider } from './openai-provider';
import { GeminiProvider } from './gemini-provider';
import { LMStudioProvider } from './lm-studio-provider';
/**
 * 创建 LLM Provider
 */
export function createLLMProvider(config) {
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
            throw new Error(`Unknown provider type: ${config.type}`);
    }
}
export function createProviderFromSettings(settings) {
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
//# sourceMappingURL=provider-factory.js.map