/**
 * Agent 核心类
 * 提供统一的 Agent 入口，封装 GraphRunner 和 LLM Provider
 */
import { GraphRunner } from './runner';
import { ToolRegistry } from './tool-registry';
import { createState } from './state';
import { createProviderFromSettings, createLLMProvider } from '../providers';
import { LLMPlannerNode } from '../nodes/llm-planner';
import { ToolRunnerNode } from '../nodes/tool-runner';
import { VerifierNode } from '../nodes/verifier';
import { ResponderNode } from '../nodes/responder';
import { LLMResponderNode } from '../nodes/llm-responder';
import { shouldUseAgentMode, formatAgentResponse } from './agent-utils';
// ============================================================================
// Agent 类
// ============================================================================
export class Agent {
    provider;
    toolRegistry;
    runner = null;
    eventStream = null;
    config;
    conversationHistory = [];
    constructor(config) {
        this.config = {
            provider: config.provider,
            tools: config.tools || [],
            mode: config.mode || 'auto',
            systemPrompt: config.systemPrompt || 'You are a helpful AI assistant.',
            streaming: config.streaming ?? true,
            maxSteps: config.maxSteps || 15,
            hooks: config.hooks || {},
            useLLMResponder: config.useLLMResponder ?? false,
        };
        this.provider = this.createProvider(this.config.provider);
        this.toolRegistry = new ToolRegistry();
        this.config.tools.forEach(tool => this.toolRegistry.register(tool));
        this.initializeRunner();
    }
    createProvider(config) {
        if ('type' in config) {
            return createLLMProvider(config);
        }
        return createProviderFromSettings(config);
    }
    initializeRunner() {
        const planner = new LLMPlannerNode(this.toolRegistry, { provider: this.provider });
        const toolRunner = new ToolRunnerNode(this.toolRegistry, { provider: this.provider });
        const verifier = new VerifierNode();
        // 根据配置选择 Responder 类型
        const responder = this.config.useLLMResponder
            ? new LLMResponderNode({ provider: this.provider })
            : new ResponderNode();
        const graph = {
            nodes: [planner, toolRunner, verifier, responder],
            edges: [
                { from: 'planner', to: 'tool-runner' },
                { from: 'tool-runner', to: 'verifier' },
                { from: 'verifier', to: 'responder', condition: (s) => s.task.currentStepIndex >= s.task.steps.length },
                { from: 'verifier', to: 'tool-runner', condition: (s) => s.task.currentStepIndex < s.task.steps.length },
            ],
            entryNode: 'planner',
            maxSteps: this.config.maxSteps,
        };
        this.runner = new GraphRunner(graph, undefined, this.config.hooks);
        this.eventStream = this.runner.getEventStream();
    }
    /** 主入口：发送消息并获取回复 */
    async chat(message, options = {}) {
        const startTime = Date.now();
        const mode = this.determineMode(message);
        this.conversationHistory.push({ role: 'user', content: message });
        if (mode === 'chat') {
            return this.handleChatMode(message, options, startTime);
        }
        return this.handleAgentMode(message, startTime);
    }
    determineMode(message) {
        if (this.config.mode === 'chat')
            return 'chat';
        if (this.config.mode === 'agent')
            return 'agent';
        return shouldUseAgentMode(message, this.toolRegistry.list().length > 0) ? 'agent' : 'chat';
    }
    async handleChatMode(message, options, startTime) {
        const messages = [
            { role: 'system', content: this.config.systemPrompt },
            ...this.conversationHistory,
        ];
        const useStream = options.stream ?? this.config.streaming;
        if (useStream && options.onStream) {
            let fullContent = '';
            let usage;
            const stream = this.provider.chatStream({ messages, temperature: options.temperature });
            for await (const chunk of stream) {
                if (chunk.delta) {
                    fullContent += chunk.delta;
                    options.onStream(chunk.delta);
                }
                if (chunk.usage) {
                    usage = chunk.usage;
                }
            }
            this.conversationHistory.push({ role: 'assistant', content: fullContent });
            return {
                content: fullContent,
                mode: 'chat',
                duration: Date.now() - startTime,
                usage
            };
        }
        const response = await this.provider.chat({ messages, temperature: options.temperature });
        this.conversationHistory.push({ role: 'assistant', content: response.content });
        return {
            content: response.content,
            usage: response.usage,
            mode: 'chat',
            duration: Date.now() - startTime,
        };
    }
    async handleAgentMode(message, startTime) {
        if (!this.runner)
            throw new Error('GraphRunner not initialized');
        const initialState = createState(message, {
            permissions: { 'sql:read': true, 'document:read': true },
        });
        const result = await this.runner.execute(initialState);
        const finalState = result.state;
        const lastMessage = finalState.conversation.messages.filter(m => m.role === 'assistant').pop();
        const content = lastMessage?.content || formatAgentResponse(finalState.task.goal, finalState.task.steps.map(s => ({ description: s.description, status: s.status })));
        this.conversationHistory.push({ role: 'assistant', content });
        return {
            content,
            mode: 'agent',
            steps: finalState.task.steps.map(s => ({ description: s.description, status: s.status, result: s.result })),
            duration: Date.now() - startTime,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: finalState.telemetry.tokenCount },
        };
    }
    // Public API
    getEventStream() {
        if (!this.eventStream) {
            throw new Error('EventStream not initialized');
        }
        return this.eventStream;
    }
    getToolRegistry() { return this.toolRegistry; }
    getProvider() { return this.provider; }
    getHistory() { return [...this.conversationHistory]; }
    registerTool(tool) { this.toolRegistry.register(tool); }
    clearHistory() { this.conversationHistory = []; }
}
/** 创建 Agent 实例 */
export function createAgent(config) {
    return new Agent(config);
}
//# sourceMappingURL=agent.js.map