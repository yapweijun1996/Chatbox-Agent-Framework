/**
 * LLM Provider 抽象层
 * 统一的 LLM 客户端接口，支持多种提供商
 */

import { z } from 'zod';

/**
 * 标准化的聊天消息格式
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string; // 用于 tool 消息
    toolCallId?: string; // 用于 tool response
}

/**
 * LLM 调用请求
 */
export interface ChatRequest {
    messages: ChatMessage[];
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
    stream?: boolean;
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

/**
 * LLM 调用响应
 */
export interface ChatResponse {
    content: string;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
    usage?: TokenUsage;
    model?: string;
}

/**
 * 流式响应块
 */
export interface ChatStreamChunk {
    delta: string;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
    usage?: TokenUsage;
}

/**
 * LLM Provider 配置基类
 */
export interface LLMProviderConfig {
    model: string;
    temperature?: number;
    timeout?: number;
}

/**
 * LLM Provider 抽象接口
 */
export abstract class LLMProvider {
    protected config: LLMProviderConfig;

    constructor(config: LLMProviderConfig) {
        this.config = {
            temperature: 0.7,
            timeout: 60000,
            ...config,
        };
    }

    /**
     * 执行聊天请求（非流式）
     */
    abstract chat(request: ChatRequest): Promise<ChatResponse>;

    /**
     * 执行聊天请求（流式）
     */
    abstract chatStream(request: ChatRequest): AsyncGenerator<ChatStreamChunk>;

    /**
     * 获取提供商名称
     */
    abstract getProviderName(): string;

    /**
     * 获取当前模型
     */
    getModel(): string {
        return this.config.model;
    }

    /**
     * 简便方法：发送单条消息
     */
    async complete(prompt: string, systemPrompt?: string): Promise<string> {
        const messages: ChatMessage[] = [];

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
    protected buildMessages(request: ChatRequest): ChatMessage[] {
        return request.messages;
    }

    /**
     * 辅助方法：合并配置
     */
    protected mergeConfig(request: ChatRequest): Required<Pick<ChatRequest, 'temperature'>> {
        return {
            temperature: request.temperature ?? this.config.temperature ?? 0.7,
        };
    }
}

/**
 * LLM Provider 工厂
 */
export type LLMProviderType = 'openai' | 'gemini' | 'lm-studio';

export interface ProviderFactoryConfig {
    type: LLMProviderType;
    config: any; // 具体的配置由各个 Provider 定义
}

/**
 * 错误类型
 */
export class LLMProviderError extends Error {
    constructor(
        message: string,
        public provider: string,
        public originalError?: Error,
        public statusCode?: number
    ) {
        super(message);
        this.name = 'LLMProviderError';
    }
}
