/**
 * OpenAI Provider 实现
 */
import { LLMProvider, type ChatRequest, type ChatResponse, type ChatStreamChunk } from '../core/llm-provider';
export interface OpenAIProviderConfig {
    apiKey: string;
    model: string;
    baseURL?: string;
    temperature?: number;
    timeout?: number;
}
export declare class OpenAIProvider extends LLMProvider {
    private apiKey;
    private baseURL;
    constructor(config: OpenAIProviderConfig);
    getProviderName(): string;
    chat(request: ChatRequest): Promise<ChatResponse>;
    chatStream(request: ChatRequest): AsyncGenerator<ChatStreamChunk>;
    private mapFinishReason;
}
//# sourceMappingURL=openai-provider.d.ts.map