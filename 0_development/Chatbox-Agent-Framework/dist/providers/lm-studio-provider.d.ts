/**
 * LM Studio Provider 实现
 * 使用 OpenAI 兼容的 API 格式
 */
import { LLMProvider, type ChatRequest, type ChatResponse, type ChatStreamChunk } from '../core/llm-provider';
export interface LMStudioProviderConfig {
    baseURL: string;
    model: string;
    temperature?: number;
    timeout?: number;
}
export declare class LMStudioProvider extends LLMProvider {
    private baseURL;
    constructor(config: LMStudioProviderConfig);
    getProviderName(): string;
    chat(request: ChatRequest): Promise<ChatResponse>;
    chatStream(request: ChatRequest): AsyncGenerator<ChatStreamChunk>;
    private mapFinishReason;
}
//# sourceMappingURL=lm-studio-provider.d.ts.map