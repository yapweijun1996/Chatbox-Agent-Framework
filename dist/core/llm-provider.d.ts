/**
 * LLM Provider 抽象层
 * 统一的 LLM 客户端接口，支持多种提供商
 */
/**
 * 标准化的聊天消息格式
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    toolCallId?: string;
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
export declare abstract class LLMProvider {
    protected config: LLMProviderConfig;
    constructor(config: LLMProviderConfig);
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
    getModel(): string;
    /**
     * 简便方法：发送单条消息
     */
    complete(prompt: string, systemPrompt?: string): Promise<string>;
    /**
     * 辅助方法：构建消息列表
     */
    protected buildMessages(request: ChatRequest): ChatMessage[];
    /**
     * 辅助方法：合并配置
     */
    protected mergeConfig(request: ChatRequest): Required<Pick<ChatRequest, 'temperature'>>;
}
/**
 * LLM Provider 工厂
 */
export type LLMProviderType = 'openai' | 'gemini' | 'lm-studio';
export interface ProviderFactoryConfig {
    type: LLMProviderType;
    config: any;
}
/**
 * 错误类型
 */
export declare class LLMProviderError extends Error {
    provider: string;
    originalError?: Error | undefined;
    statusCode?: number | undefined;
    constructor(message: string, provider: string, originalError?: Error | undefined, statusCode?: number | undefined);
}
//# sourceMappingURL=llm-provider.d.ts.map