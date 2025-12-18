/**
 * OpenAI LLM 工具
 * 调用 OpenAI API 进行文本生成
 */
import { z } from 'zod';
/**
 * 创建 OpenAI LLM 工具
 */
export function createOpenAITool(config) {
    return {
        name: 'openai-llm',
        description: '调用 OpenAI API 生成文本',
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
        timeout: 60000, // 60 秒
        retryPolicy: {
            maxRetries: 2,
            backoffMs: 1000,
            backoffMultiplier: 2,
        },
        permissions: ['llm:generate'],
        async execute(input) {
            const { prompt, systemPrompt, temperature } = input;
            const messages = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: prompt });
            const baseURL = config.baseURL || 'https://api.openai.com';
            const response = await fetch(`${baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify({
                    model: config.model,
                    messages,
                    temperature: temperature ?? config.temperature ?? 0.7,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API 错误: ${response.status} ${errorText}`);
            }
            const data = await response.json();
            return {
                content: data.choices[0].message.content,
                usage: data.usage ? {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens,
                } : undefined,
            };
        },
    };
}
/**
 * 默认 OpenAI 配置
 */
export const defaultOpenAIConfig = {
    model: 'gpt-4o-mini',
    temperature: 0.7,
};
//# sourceMappingURL=openai-tool.js.map