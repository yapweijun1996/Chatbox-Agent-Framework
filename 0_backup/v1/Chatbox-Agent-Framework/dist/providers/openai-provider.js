/**
 * OpenAI Provider 实现
 */
import { LLMProvider, LLMProviderError, } from '../core/llm-provider';
export class OpenAIProvider extends LLMProvider {
    apiKey;
    baseURL;
    constructor(config) {
        super(config);
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL || 'https://api.openai.com';
    }
    getProviderName() {
        return 'OpenAI';
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
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.config.timeout || 60000),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new LLMProviderError(`OpenAI API error: ${response.statusText}`, 'OpenAI', undefined, response.status);
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
            throw new LLMProviderError(`Failed to call OpenAI: ${error instanceof Error ? error.message : String(error)}`, 'OpenAI', error instanceof Error ? error : undefined);
        }
    }
    async *chatStream(request) {
        const { temperature } = this.mergeConfig(request);
        const requestBody = {
            model: this.config.model,
            messages: request.messages,
            temperature,
            stream: true,
            stream_options: { include_usage: true },
            ...(request.topP && { top_p: request.topP }),
            ...(request.stopSequences && { stop: request.stopSequences }),
        };
        try {
            const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                throw new LLMProviderError(`OpenAI API error: ${response.statusText}`, 'OpenAI', undefined, response.status);
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
                            if (parsed.usage) {
                                yield {
                                    delta: '',
                                    usage: {
                                        promptTokens: parsed.usage.prompt_tokens,
                                        completionTokens: parsed.usage.completion_tokens,
                                        totalTokens: parsed.usage.total_tokens,
                                    }
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
            throw new LLMProviderError(`Failed to stream from OpenAI: ${error instanceof Error ? error.message : String(error)}`, 'OpenAI', error instanceof Error ? error : undefined);
        }
    }
    mapFinishReason(reason) {
        switch (reason) {
            case 'stop': return 'stop';
            case 'length': return 'length';
            case 'content_filter': return 'content_filter';
            case 'tool_calls': return 'tool_calls';
            default: return 'stop';
        }
    }
}
//# sourceMappingURL=openai-provider.js.map