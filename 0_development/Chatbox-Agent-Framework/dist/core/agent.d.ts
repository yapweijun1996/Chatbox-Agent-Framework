/**
 * Agent 核心类
 * 提供统一的 Agent 入口，封装 GraphRunner 和 LLM Provider
 */
import { EventStream } from './event-stream';
import { ToolRegistry } from './tool-registry';
import { LLMProvider, type ChatMessage } from './llm-provider';
import { type SettingsBasedConfig, type LLMProviderConfig } from '../providers';
import { AgentAbortController, type ResumeOptions } from './abort-controller';
import type { Tool, RunnerHooks, Checkpoint } from './types';
export type AgentMode = 'chat' | 'agent' | 'auto';
export type ProviderConfigInput = LLMProviderConfig | SettingsBasedConfig;
export interface AgentConfig {
    provider: ProviderConfigInput;
    tools?: Tool[];
    mode?: AgentMode;
    systemPrompt?: string;
    streaming?: boolean;
    maxSteps?: number;
    hooks?: RunnerHooks;
    /** 是否使用 LLM 生成自然语言回复 */
    useLLMResponder?: boolean;
}
export interface ChatOptions {
    stream?: boolean;
    onStream?: (chunk: string) => void;
    temperature?: number;
}
export interface AgentResult {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    mode: 'chat' | 'agent';
    steps?: Array<{
        description: string;
        status: string;
        result?: unknown;
    }>;
    duration: number;
    /** 是否被中断 */
    aborted?: boolean;
    /** 中断原因 */
    abortReason?: string;
}
export declare class Agent {
    private provider;
    private toolRegistry;
    private runner;
    private eventStream;
    private abortController;
    private isRunning;
    private lastState;
    private config;
    private conversationHistory;
    constructor(config: AgentConfig);
    private createProvider;
    private initializeRunner;
    /** 主入口：发送消息并获取回复 */
    chat(message: string, options?: ChatOptions): Promise<AgentResult>;
    private determineMode;
    private handleChatMode;
    private handleAgentMode;
    getEventStream(): EventStream;
    getToolRegistry(): ToolRegistry;
    getProvider(): LLMProvider;
    getHistory(): ChatMessage[];
    registerTool(tool: Tool): void;
    clearHistory(): void;
    setHistory(history: ChatMessage[]): void;
    /**
     * 中断当前执行
     * @param reason 中断原因
     */
    abort(reason?: string): void;
    /**
     * 从最近的 checkpoint 恢复执行
     * @param options 恢复选项
     */
    resume(options?: ResumeOptions): Promise<AgentResult>;
    /**
     * 检查 Agent 是否正在运行
     */
    isAgentRunning(): boolean;
    /**
     * 获取 AbortController
     */
    getAbortController(): AgentAbortController;
    /**
     * 获取可用的 checkpoints
     */
    listCheckpoints(): Checkpoint[];
}
/** 创建 Agent 实例 */
export declare function createAgent(config: AgentConfig): Agent;
//# sourceMappingURL=agent.d.ts.map