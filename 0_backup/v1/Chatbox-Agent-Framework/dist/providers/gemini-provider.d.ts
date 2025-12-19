/**
 * Google Gemini Provider 实现
 */
import { LLMProvider, type ChatRequest, type ChatResponse, type ChatStreamChunk } from '../core/llm-provider';
export interface GeminiProviderConfig {
    apiKey: string;
    model: string;
    temperature?: number;
    timeout?: number;
}
export declare class GeminiProvider extends LLMProvider {
    private apiKey;
    constructor(config: GeminiProviderConfig);
    getProviderName(): string;
    chat(request: ChatRequest): Promise<ChatResponse>;
    chatStream(request: ChatRequest): AsyncGenerator<ChatStreamChunk>;
    /**
     * 转换标准消息格式为 Gemini 格式
     */
    private convertMessages;
    private mapFinishReason;
}
//# sourceMappingURL=gemini-provider.d.ts.map