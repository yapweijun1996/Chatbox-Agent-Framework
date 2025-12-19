/**
 * Google Gemini Provider 实现
 */

import {
    LLMProvider,
    LLMProviderError,
    type ChatRequest,
    type ChatResponse,
    type ChatStreamChunk,
    type ChatMessage,
} from '../core/llm-provider';

export interface GeminiProviderConfig {
    apiKey: string;
    model: string;
    temperature?: number;
    timeout?: number;
}

export class GeminiProvider extends LLMProvider {
    private apiKey: string;

    constructor(config: GeminiProviderConfig) {
        super(config);
        this.apiKey = config.apiKey;
    }

    getProviderName(): string {
        return 'Gemini';
    }

    async chat(request: ChatRequest): Promise<ChatResponse> {
        const { temperature } = this.mergeConfig(request);

        // 转换消息格式
        const contents = this.convertMessages(request.messages);

        const requestBody = {
            contents,
            generationConfig: {
                temperature,
                ...(request.topP && { topP: request.topP }),
                ...(request.stopSequences && { stopSequences: request.stopSequences }),
            },
        };

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(this.config.timeout || 60000),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new LLMProviderError(
                    `Gemini API error: ${response.statusText}`,
                    'Gemini',
                    undefined,
                    response.status
                );
            }

            const data = await response.json();

            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new LLMProviderError('Invalid Gemini response format', 'Gemini');
            }

            return {
                content: data.candidates[0].content.parts[0].text,
                finishReason: this.mapFinishReason(data.candidates[0].finishReason),
                usage: data.usageMetadata ? {
                    promptTokens: data.usageMetadata.promptTokenCount || 0,
                    completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                    totalTokens: data.usageMetadata.totalTokenCount || 0,
                } : undefined,
                model: this.config.model,
            };
        } catch (error) {
            if (error instanceof LLMProviderError) throw error;
            throw new LLMProviderError(
                `Failed to call Gemini: ${error instanceof Error ? error.message : String(error)}`,
                'Gemini',
                error instanceof Error ? error : undefined
            );
        }
    }

    async *chatStream(request: ChatRequest): AsyncGenerator<ChatStreamChunk> {
        const { temperature } = this.mergeConfig(request);

        const contents = this.convertMessages(request.messages);

        const requestBody = {
            contents,
            generationConfig: {
                temperature,
                ...(request.topP && { topP: request.topP }),
                ...(request.stopSequences && { stopSequences: request.stopSequences }),
            },
        };

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:streamGenerateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                }
            );

            if (!response.ok) {
                throw new LLMProviderError(
                    `Gemini API error: ${response.statusText}`,
                    'Gemini',
                    undefined,
                    response.status
                );
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const parsed = JSON.parse(line);
                            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                            const finishReason = parsed.candidates?.[0]?.finishReason;

                            if (text) {
                                yield { delta: text };
                            }

                            if (finishReason) {
                                yield {
                                    delta: '',
                                    finishReason: this.mapFinishReason(finishReason),
                                };
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        } catch (error) {
            if (error instanceof LLMProviderError) throw error;
            throw new LLMProviderError(
                `Failed to stream from Gemini: ${error instanceof Error ? error.message : String(error)}`,
                'Gemini',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * 转换标准消息格式为 Gemini 格式
     */
    private convertMessages(messages: ChatMessage[]): any[] {
        const contents: any[] = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                // Gemini 通过在第一条消息中注入 system prompt
                contents.push({
                    role: 'user',
                    parts: [{ text: `System: ${msg.content}` }],
                });
                contents.push({
                    role: 'model',
                    parts: [{ text: 'Understood. I will follow these instructions.' }],
                });
            } else if (msg.role === 'user') {
                contents.push({
                    role: 'user',
                    parts: [{ text: msg.content }],
                });
            } else if (msg.role === 'assistant') {
                contents.push({
                    role: 'model',
                    parts: [{ text: msg.content }],
                });
            }
        }

        return contents;
    }

    private mapFinishReason(reason?: string): ChatResponse['finishReason'] {
        switch (reason) {
            case 'STOP': return 'stop';
            case 'MAX_TOKENS': return 'length';
            case 'SAFETY': return 'content_filter';
            default: return 'stop';
        }
    }
}
