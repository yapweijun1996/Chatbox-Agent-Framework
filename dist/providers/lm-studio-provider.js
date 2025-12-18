/**
 * LM Studio Provider 实现
 * 使用 OpenAI 兼容的 API 格式
 */
import { LLMProvider, LLMProviderError, } from '../core/llm-provider';
export class LMStudioProvider extends LLMProvider {
    baseURL;
    constructor(config) {
        super(config);
        this.baseURL = config.baseURL;
    }
    getProviderName() {
        return 'LM Studio';
    }
    async chat(request) {
        const { temperature } = this.mergeConfig(request);
        const requestBody = {
            model: this.config.model,
            messages: request.messages,
            temperature,
            ...(request.topP && { top_p: request.topP }),
            ...(request.stopSequences && { stop: request.stopSequences }),
        };
        try {
            const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.config.timeout || 60000),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new LLMProviderError(`LM Studio API error: ${response.statusText}`, 'LM Studio', undefined, response.status);
            }
            const data = await response.json();
            return {
                content: data.choices[0].message.content,
                finishReason: this.mapFinishReason(data.choices[0].finish_reason),
                usage: data.usage ? {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens,
                } : undefined,
                model: data.model,
            };
        }
        catch (error) {
            if (error instanceof LLMProviderError)
                throw error;
            throw new LLMProviderError(`Failed to call LM Studio: ${error instanceof Error ? error.message : String(error)}`, 'LM Studio', error instanceof Error ? error : undefined);
        }
    }
    async *chatStream(request) {
        const { temperature } = this.mergeConfig(request);
        const requestBody = {
            model: this.config.model,
            messages: request.messages,
            temperature,
            stream: true,
            ...(request.topP && { top_p: request.topP }),
            ...(request.stopSequences && { stop: request.stopSequences }),
        };
        try {
            const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                throw new LLMProviderError(`LM Studio API error: ${response.statusText}`, 'LM Studio', undefined, response.status);
            }
            const reader = response.body?.getReader();
            if (!reader)
                throw new Error('No response body');
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]')
                            continue;
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices[0]?.delta?.content;
                            const finishReason = parsed.choices[0]?.finish_reason;
                            if (delta) {
                                yield { delta };
                            }
                            if (finishReason) {
                                yield {
                                    delta: '',
                                    finishReason: this.mapFinishReason(finishReason),
                                };
                            }
                        }
                        catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        }
        catch (error) {
            if (error instanceof LLMProviderError)
                throw error;
            throw new LLMProviderError(`Failed to stream from LM Studio: ${error instanceof Error ? error.message : String(error)}`, 'LM Studio', error instanceof Error ? error : undefined);
        }
    }
    mapFinishReason(reason) {
        switch (reason) {
            case 'stop': return 'stop';
            case 'length': return 'length';
            case 'content_filter': return 'content_filter';
            default: return 'stop';
        }
    }
}
//# sourceMappingURL=lm-studio-provider.js.map