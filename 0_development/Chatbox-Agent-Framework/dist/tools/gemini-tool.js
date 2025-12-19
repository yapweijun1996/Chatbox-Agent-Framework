/**
 * Google Gemini LLM 工具
 * 调用 Google Gemini API 进行文本生成
 */
import { z } from 'zod';
/**
 * 创建 Gemini LLM 工具
 */
export function createGeminiTool(config) {
    return {
        name: 'gemini-llm',
        description: '调用 Google Gemini API 生成文本',
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
            // 构建请求内容
            const contents = [];
            if (systemPrompt) {
                contents.push({
                    role: 'user',
                    parts: [{ text: `System: ${systemPrompt}` }]
                });
                contents.push({
                    role: 'model',
                    parts: [{ text: 'Understood. I will follow these instructions.' }]
                });
            }
            contents.push({
                role: 'user',
                parts: [{ text: prompt }]
            });
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: temperature ?? config.temperature ?? 0.7,
                    },
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API 错误: ${response.status} ${errorText}`);
            }
            const data = await response.json();
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error('Gemini 返回格式异常');
            }
            return {
                content: data.candidates[0].content.parts[0].text,
                usage: data.usageMetadata ? {
                    promptTokens: data.usageMetadata.promptTokenCount || 0,
                    completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                    totalTokens: data.usageMetadata.totalTokenCount || 0,
                } : undefined,
            };
        },
    };
}
/**
 * 默认 Gemini 配置
 */
export const defaultGeminiConfig = {
    model: 'gemini-2.0-flash-exp',
    temperature: 0.7,
};
//# sourceMappingURL=gemini-tool.js.map