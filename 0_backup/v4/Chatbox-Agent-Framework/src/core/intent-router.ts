/**
 * Intent router for choosing chat/agent modes with optional policies.
 */

import type { LLMProvider, ChatMessage } from './llm-provider';
import { shouldUseAgentMode } from './agent-utils';

export type IntentMode = 'chat' | 'agent';

export interface IntentRouterContext {
    message: string;
    hasTools: boolean;
    availableTools: string[];
}

export interface IntentToolPolicy {
    allowedTools?: string[];
}

export interface IntentMemoryPolicy {
    enableMemory?: boolean;
    enableChatMemory?: boolean;
}

export interface IntentDecision {
    mode: IntentMode;
    toolPolicy?: IntentToolPolicy;
    memoryPolicy?: IntentMemoryPolicy;
    reason?: string;
    clarification?: {
        question: string;
    };
    analysis?: {
        router: 'rule-based' | 'llm' | 'fallback';
        signals?: string[];
        llmAttempts?: number;
        fallbackReason?: 'invalid-response' | 'error';
    };
}

export interface IntentRouter {
    route(context: IntentRouterContext): Promise<IntentDecision>;
}

export interface RuleBasedIntentRouterOptions {
    agentKeywords?: string[];
    chatKeywords?: string[];
    minAgentMessageLength?: number;
}

export class RuleBasedIntentRouter implements IntentRouter {
    private options: Required<RuleBasedIntentRouterOptions>;

    constructor(options?: RuleBasedIntentRouterOptions) {
        this.options = {
            agentKeywords: options?.agentKeywords ?? [
                'search', 'query', 'fetch', 'lookup', 'download', 'run', 'execute', 'call',
                'tool', 'api', 'file', 'database', 'sql', 'csv', 'log', 'grep',
                '搜索', '查询', '获取', '下载', '执行', '调用', '工具', '接口', '文件', '数据库', '日志',
            ],
            chatKeywords: options?.chatKeywords ?? [
                'explain', 'what is', 'define', 'why', 'how does', 'tell me about',
                '介绍', '解释', '是什么', '为什么', '原理', '区别', '比较', '概念',
            ],
            minAgentMessageLength: options?.minAgentMessageLength ?? 12,
        };
    }

    async route(context: IntentRouterContext): Promise<IntentDecision> {
        if (!context.hasTools) {
            return { mode: 'chat', reason: 'no-tools', analysis: { router: 'rule-based', signals: ['no-tools'] } };
        }

        const message = context.message.trim();
        const normalized = message.toLowerCase();

        if (message.length <= this.options.minAgentMessageLength) {
            return {
                mode: 'chat',
                reason: 'short-message',
                clarification: {
                    question: '你希望我直接回答问题，还是使用工具执行任务？',
                },
                analysis: { router: 'rule-based', signals: ['short-message'] },
            };
        }

        if (this.matchAny(normalized, this.options.chatKeywords)) {
            return { mode: 'chat', reason: 'chat-keyword', analysis: { router: 'rule-based', signals: ['chat-keyword'] } };
        }

        if (this.matchAny(normalized, this.options.agentKeywords)) {
            return { mode: 'agent', reason: 'agent-keyword', analysis: { router: 'rule-based', signals: ['agent-keyword'] } };
        }

        if (context.availableTools.some(tool => normalized.includes(tool.toLowerCase()))) {
            return { mode: 'agent', reason: 'tool-mention', analysis: { router: 'rule-based', signals: ['tool-mention'] } };
        }

        const mode = shouldUseAgentMode(message, context.hasTools) ? 'agent' : 'chat';
        return { mode, reason: 'rule-based', analysis: { router: 'rule-based', signals: ['heuristic'] } };
    }

    private matchAny(message: string, keywords: string[]): boolean {
        return keywords.some(keyword => message.includes(keyword));
    }
}

export interface LLMIntentRouterOptions {
    systemPrompt?: string;
    temperature?: number;
    fallbackRouter?: IntentRouter;
    retries?: number;
}

const DEFAULT_SYSTEM_PROMPT =
    'You are a routing assistant. Decide whether to use chat or agent mode. ' +
    'Return JSON only with fields: ' +
    '{"mode":"chat|agent","allowedTools"?:string[],"enableMemory"?:boolean,"enableChatMemory"?:boolean,"reason"?:string,"clarification"?:string}.';

export class LLMIntentRouter implements IntentRouter {
    private fallbackRouter: IntentRouter;

    constructor(
        private readonly provider: LLMProvider,
        private readonly options: LLMIntentRouterOptions = {}
    ) {
        this.fallbackRouter = options.fallbackRouter ?? new RuleBasedIntentRouter();
    }

    async route(context: IntentRouterContext): Promise<IntentDecision> {
        if (!context.hasTools) {
            return { mode: 'chat', reason: 'no-tools', analysis: { router: 'llm', signals: ['no-tools'] } };
        }

        const maxAttempts = Math.max(1, (this.options.retries ?? 1) + 1);
        let lastFailure: 'invalid-response' | 'error' | undefined;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const messages = this.buildMessages(context, attempt > 0);
            try {
                const response = await this.provider.chat({
                    messages,
                    temperature: this.options.temperature ?? 0.1,
                });

                const decision = parseIntentDecision(response.content);
                if (!decision) {
                    lastFailure = 'invalid-response';
                    continue;
                }

                const normalized = normalizeIntentDecision(decision, context);
                return {
                    ...normalized,
                    analysis: {
                        router: 'llm',
                        llmAttempts: attempt + 1,
                    },
                };
            } catch (error) {
                console.error('[IntentRouter] Failed to route with LLM:', error);
                lastFailure = 'error';
                break;
            }
        }

        const fallbackDecision = await this.fallbackRouter.route(context);
        return {
            ...fallbackDecision,
            analysis: {
                router: 'fallback',
                llmAttempts: maxAttempts,
                fallbackReason: lastFailure,
            },
        };
    }

    private buildMessages(context: IntentRouterContext, strictJson: boolean): ChatMessage[] {
        const systemPrompt = strictJson
            ? 'Return JSON only. No markdown, no code fence, no extra text. ' + DEFAULT_SYSTEM_PROMPT
            : this.options.systemPrompt || DEFAULT_SYSTEM_PROMPT;

        return [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    `User message: ${context.message}`,
                    `Available tools: ${context.availableTools.join(', ') || 'none'}`,
                ].join('\n'),
            },
        ];
    }
}

function parseIntentDecision(content: string): IntentDecision | null {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
}

function normalizeIntentDecision(decision: IntentDecision, context: IntentRouterContext): IntentDecision {
    const mode = decision.mode === 'agent' ? 'agent' : 'chat';
    const allowedTools = decision.toolPolicy?.allowedTools || (decision as any).allowedTools;
    const enableMemory = decision.memoryPolicy?.enableMemory ?? (decision as any).enableMemory;
    const enableChatMemory = decision.memoryPolicy?.enableChatMemory ?? (decision as any).enableChatMemory;
    const clarification = (decision as any).clarification;

    const normalized: IntentDecision = {
        mode,
        reason: decision.reason,
        toolPolicy: undefined,
        memoryPolicy: undefined,
        clarification: undefined,
        analysis: decision.analysis,
    };

    if (Array.isArray(allowedTools) && allowedTools.length > 0) {
        normalized.toolPolicy = {
            allowedTools: allowedTools.filter(tool => context.availableTools.includes(tool)),
        };
    }

    if (enableMemory !== undefined || enableChatMemory !== undefined) {
        normalized.memoryPolicy = {
            enableMemory: enableMemory === undefined ? undefined : Boolean(enableMemory),
            enableChatMemory: enableChatMemory === undefined ? undefined : Boolean(enableChatMemory),
        };
    }

    if (clarification) {
        const question = typeof clarification === 'string'
            ? clarification
            : clarification?.question;
        if (question) {
            normalized.clarification = { question };
        }
    }

    if (!context.hasTools) {
        normalized.mode = 'chat';
    }

    return normalized;
}
