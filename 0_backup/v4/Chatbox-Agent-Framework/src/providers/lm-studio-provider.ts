/**
 * LM Studio Provider 实现
 * 使用 OpenAI 兼容的 API 格式
 */

import {
    LLMProvider,
    LLMProviderError,
    type ChatRequest,
    type ChatResponse,
    type ChatStreamChunk,
} from '../core/llm-provider';

export interface LMStudioProviderConfig {
    baseURL: string;
    model: string;
    temperature?: number;
    timeout?: number;
}

export class LMStudioProvider extends LLMProvider {
    private baseURL: string;

    constructor(config: LMStudioProviderConfig) {
        super(config);
        this.baseURL = config.baseURL;
    }

    getProviderName(): string {
        return 'LM Studio';
    }

    async chat(request: ChatRequest): Promise<ChatResponse> {
        const { temperature } = this.mergeConfig(request);

        const requestBody = {
            model: this.config.model,
            messages: request.messages,
            temperature,
            ...(request.topP && { top_p: request.topP }),
            ...(request.stopSequences && { stop: request.stopSequences }),
        };

        try {
            // Combine user signal with timeout
            const timeoutSignal = AbortSignal.timeout(this.config.timeout || 60000);
            const controller = new AbortController();

            // Abort if either signal fires
            const onAbort = () => controller.abort();
            request.signal?.addEventListener('abort', onAbort);
            timeoutSignal.addEventListener('abort', onAbort);

            const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            // Cleanup listeners
            request.signal?.removeEventListener('abort', onAbort);

            if (!response.ok) {
                const errorText = await response.text();
                throw new LLMProviderError(
                    `LM Studio API error: ${response.statusText}`,
                    'LM Studio',
                    undefined,
                    response.status
                );
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
        } catch (error) {
            if (error instanceof LLMProviderError) throw error;
            throw new LLMProviderError(
                `Failed to call LM Studio: ${error instanceof Error ? error.message : String(error)}`,
                'LM Studio',
                error instanceof Error ? error : undefined
            );
        }
    }

    async *chatStream(request: ChatRequest): AsyncGenerator<ChatStreamChunk> {
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
                },
                body: JSON.stringify(requestBody),
                signal: request.signal, // Pass through the abort signal for streaming
            });

            if (!response.ok) {
                throw new LLMProviderError(
                    `LM Studio API error: ${response.statusText}`,
                    'LM Studio',
                    undefined,
                    response.status
                );
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';

            let reasoningOpen = false;

            while (true) {
                // Check if abort was requested
                if (request.signal?.aborted) {
                    await reader.cancel();
                    break;
                }

                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const contentDelta = parsed.choices[0]?.delta?.content;
                            const reasoningDelta = parsed.choices[0]?.delta?.reasoning_content;
                            const finishReason = parsed.choices[0]?.finish_reason;

                            if (reasoningDelta) {
                                const prefix = reasoningOpen ? '' : '<think>';
                                reasoningOpen = true;
                                yield { delta: `${prefix}${reasoningDelta}` };
                            }

                            if (contentDelta) {
                                const prefix = reasoningOpen ? '</think>' : '';
                                reasoningOpen = false;
                                yield { delta: `${prefix}${contentDelta}` };
                            }

                            if (finishReason) {
                                if (reasoningOpen) {
                                    reasoningOpen = false;
                                    yield { delta: '</think>' };
                                }
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
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }

            if (reasoningOpen) {
                yield { delta: '</think>' };
            }
        } catch (error) {
            if (error instanceof LLMProviderError) throw error;
            throw new LLMProviderError(
                `Failed to stream from LM Studio: ${error instanceof Error ? error.message : String(error)}`,
                'LM Studio',
                error instanceof Error ? error : undefined
            );
        }
    }

    private mapFinishReason(reason: string): ChatResponse['finishReason'] {
        switch (reason) {
            case 'stop': return 'stop';
            case 'length': return 'length';
            case 'content_filter': return 'content_filter';
            default: return 'stop';
        }
    }
}
