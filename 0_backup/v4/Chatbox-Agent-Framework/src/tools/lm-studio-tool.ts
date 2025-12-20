/**
 * LM Studio LLM 工具
 * 调用本地 LM Studio 服务进行文本生成
 */

import { z } from 'zod';
import type { Tool } from '../core/types';

export interface LMStudioConfig {
    baseURL: string;
    model: string;
    temperature?: number;
}

/**
 * 创建 LM Studio LLM 工具
 */
export function createLMStudioTool(config: LMStudioConfig): Tool {
    return {
        name: 'lm-studio-llm',
        description: '调用 LM Studio 本地 LLM 生成文本',

        inputSchema: z.object({
            prompt: z.string().min(1, 'Prompt 不能为空'),
            systemPrompt: z.string().optional(),
            temperature: z.number().min(0).max(2).optional(),
        }),

        outputSchema: z.object({
            content: z.string(),
            usage: z.object({
                promptTokens: z.number(),
                completionTokens: z.number(),
                totalTokens: z.number(),
            }).optional(),
        }),

        timeout: 30000, // 30 秒

        retryPolicy: {
            maxRetries: 2,
            backoffMs: 1000,
            backoffMultiplier: 2,
        },

        permissions: ['llm:generate'],

        async execute(input: unknown, context) {
            const { prompt, systemPrompt, temperature } = input as {
                prompt: string;
                systemPrompt?: string;
                temperature?: number;
            };

            // 构建消息
            const messages: Array<{ role: string; content: string }> = [];

            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }

            messages.push({ role: 'user', content: prompt });

            // 检查是否支持流式传输
            const stream = !!context?.onStream;

            // 调用 LM Studio API（OpenAI 兼容格式）
            const response = await fetch(`${config.baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: config.model,
                    messages,
                    temperature: temperature ?? config.temperature ?? 0.7,
                    stream, // 启用流式传输
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`LM Studio API 错误: ${response.status} ${errorText}`);
            }

            if (stream && response.body) {
                // 处理 SSE 流
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullContent = '';
                let usage = undefined;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            if (dataStr === '[DONE]') continue;

                            try {
                                const data = JSON.parse(dataStr);
                                const content = data.choices[0]?.delta?.content || '';
                                if (content) {
                                    fullContent += content;
                                    context.onStream?.(content);
                                }
                                if (data.usage) {
                                    usage = {
                                        promptTokens: data.usage.prompt_tokens,
                                        completionTokens: data.usage.completion_tokens,
                                        totalTokens: data.usage.total_tokens,
                                    };
                                }
                            } catch (e) {
                                console.warn('SSE 解析错误:', e);
                            }
                        }
                    }
                }

                return {
                    content: fullContent,
                    usage,
                };
            } else {
                // 普通请求
                const data = await response.json();

                return {
                    content: data.choices[0].message.content,
                    usage: data.usage ? {
                        promptTokens: data.usage.prompt_tokens,
                        completionTokens: data.usage.completion_tokens,
                        totalTokens: data.usage.total_tokens,
                    } : undefined,
                };
            }
        },
    };
}

/**
 * 默认 LM Studio 配置
 */
export const defaultLMStudioConfig: LMStudioConfig = {
    baseURL: 'http://127.0.0.1:6354', // Localhost LM Studio
    model: 'zai-org/glm-4.6v-flash',
    temperature: 0.7,
};
