/**
 * LLM Provider 抽象层
 * 统一的 LLM 客户端接口，支持多种提供商
 */
/**
 * LLM Provider 抽象接口
 */
export class LLMProvider {
    config;
    constructor(config) {
        this.config = {
            temperature: 0.7,
            timeout: 60000,
            ...config,
        };
    }
    /**
     * 获取当前模型
     */
    getModel() {
        return this.config.model;
    }
    /**
     * 简便方法：发送单条消息
     */
    async complete(prompt, systemPrompt) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        const response = await this.chat({ messages });
        return response.content;
    }
    /**
     * 辅助方法：构建消息列表
     */
    buildMessages(request) {
        return request.messages;
    }
    /**
     * 辅助方法：合并配置
     */
    mergeConfig(request) {
        return {
            temperature: request.temperature ?? this.config.temperature ?? 0.7,
        };
    }
}
/**
 * 错误类型
 */
export class LLMProviderError extends Error {
    provider;
    originalError;
    statusCode;
    constructor(message, provider, originalError, statusCode) {
        super(message);
        this.provider = provider;
        this.originalError = originalError;
        this.statusCode = statusCode;
        this.name = 'LLMProviderError';
    }
}
//# sourceMappingURL=llm-provider.js.map