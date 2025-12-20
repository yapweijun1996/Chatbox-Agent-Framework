/**
 * Tool call decision helpers
 */

import type { ToolRegistry } from '../core/tool-registry';
import type { LLMProvider, ChatMessage } from '../core/llm-provider';
import { buildOpenAIToolsList } from '../core/schema-utils';

export interface ToolCallDecision {
    call: { toolName: string; input: unknown } | null;
    usage?: any;
}

export interface ToolCallDeciderOptions {
    provider?: LLMProvider;
    providerConfig?: { baseURL?: string; model?: string } | null;
}

export async function decideToolCall(
    toolRegistry: ToolRegistry,
    stepDescription: string,
    options: ToolCallDeciderOptions = {}
): Promise<ToolCallDecision> {
    if (options.provider) {
        return decideWithProvider(toolRegistry, stepDescription, options.provider);
    }

    const providerConfig = options.providerConfig;
    if (providerConfig?.baseURL) {
        return decideWithFetch(toolRegistry, stepDescription, providerConfig.baseURL, providerConfig.model || 'default-model');
    }

    return decideWithFetch(toolRegistry, stepDescription, 'http://127.0.0.1:6354', 'zai-org/glm-4.6v-flash');
}

async function decideWithProvider(
    toolRegistry: ToolRegistry,
    stepDescription: string,
    provider: LLMProvider
): Promise<ToolCallDecision> {
    const tools = buildOpenAIToolsList(toolRegistry);

    if (tools.length === 0) {
        return { call: null, usage: undefined };
    }

    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: `You are an assistant. Available tools:\n${tools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n')}\n\nRespond with JSON: {"tool": "name", "input": {}} or {"tool": null}`
        },
        { role: 'user', content: `Task: ${stepDescription}` }
    ];

    try {
        const response = await provider.chat({ messages, temperature: 0.1 });
        const parsed = parseToolDecision(response.content);

        if (parsed?.tool && toolRegistry.has(parsed.tool)) {
            return { call: { toolName: parsed.tool, input: parsed.input || {} }, usage: response.usage };
        }
        return { call: null, usage: response.usage };
    } catch (error) {
        console.error('[ToolRunner] Provider error:', error);
        return { call: fallbackDecide(stepDescription), usage: undefined };
    }
}

async function decideWithFetch(
    toolRegistry: ToolRegistry,
    stepDescription: string,
    baseURL: string,
    model: string
): Promise<ToolCallDecision> {
    const tools = buildOpenAIToolsList(toolRegistry);
    if (tools.length === 0) return { call: null, usage: undefined };

    try {
        const response = await fetch(`${baseURL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: 'Select appropriate tool if needed.' },
                    { role: 'user', content: `Task: ${stepDescription}` }
                ],
                tools,
                temperature: 0.1,
            }),
        });

        if (!response.ok) {
            return { call: fallbackDecide(stepDescription), usage: undefined };
        }

        const data = await response.json();
        const toolCalls = data.choices?.[0]?.message?.tool_calls;

        if (toolCalls?.[0]) {
            const { name, arguments: args } = toolCalls[0].function;
            if (toolRegistry.has(name)) {
                return { call: { toolName: name, input: JSON.parse(args) }, usage: data.usage };
            }
        }
        return { call: null, usage: data.usage };
    } catch (error) {
        return { call: fallbackDecide(stepDescription), usage: undefined };
    }
}

function parseToolDecision(content: string): { tool: string | null; input?: any } | null {
    try {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
    } catch { }
    return null;
}

function fallbackDecide(desc: string): { toolName: string; input: unknown } | null {
    const lower = desc.toLowerCase();
    if (lower.includes('sql') || lower.includes('查询')) {
        return { toolName: 'sql-query', input: { query: 'SELECT * FROM users LIMIT 10' } };
    }
    if (lower.includes('文档') || lower.includes('搜索')) {
        return { toolName: 'document-search', input: { keywords: ['优化'] } };
    }
    return null;
}
