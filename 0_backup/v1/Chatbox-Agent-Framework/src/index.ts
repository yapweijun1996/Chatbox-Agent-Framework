/**
 * 框架主入口
 * 导出所有核心模块
 */

// 核心类型
export * from './core/types';

// State 管理
export { createState, updateState, serializeState, deserializeState, validateState, StateHelpers } from './core/state';

// 事件流
export { EventStream } from './core/event-stream';

// 工具注册
export { ToolRegistry } from './core/tool-registry';

// 错误处理
export {
    createError,
    getErrorStrategy,
    getBackoffDelay,
    retryWithBackoff,
    rollbackToCheckpoint,
    formatErrorMessage,
} from './core/error-handler';

// 节点基类
export { BaseNode } from './core/node';

// 执行器
export { GraphRunner } from './core/runner';

// Agent 核心类
export { Agent, createAgent, type AgentConfig, type AgentResult, type ChatOptions, type AgentMode, type ProviderConfigInput } from './core/agent';

// Debug Bundle
export {
    createDebugBundle,
    exportDebugBundle,
    downloadDebugBundle,
    importDebugBundle,
    type DebugBundle,
} from './core/debug-bundle';

// 节点实现
export { PlannerNode } from './nodes/planner';
export { LLMPlannerNode, type LLMPlannerNodeConfig } from './nodes/llm-planner';
export { ToolRunnerNode, type ToolRunnerNodeConfig } from './nodes/tool-runner';
export { VerifierNode } from './nodes/verifier';
export { ResponderNode } from './nodes/responder';
export { LLMResponderNode, type LLMResponderNodeConfig } from './nodes/llm-responder';

// 示例工具
export { sqlQueryTool, documentSearchTool, getExampleTools } from './tools/example-tools';

// LLM 工具 (旧版 - 逐步废弃)
export { createLMStudioTool, defaultLMStudioConfig, type LMStudioConfig } from './tools/lm-studio-tool';
export { createGeminiTool, defaultGeminiConfig, type GeminiConfig } from './tools/gemini-tool';
export { createOpenAITool, defaultOpenAIConfig, type OpenAIConfig } from './tools/openai-tool';

// LLM Provider 抽象层 (推荐使用)
export {
    LLMProvider,
    LLMProviderError,
    type ChatMessage,
    type ChatRequest,
    type ChatResponse,
    type ChatStreamChunk,
    type TokenUsage,
    type LLMProviderConfig as BaseLLMProviderConfig,
} from './core/llm-provider';

export {
    OpenAIProvider,
    GeminiProvider,
    LMStudioProvider,
    createLLMProvider,
    createProviderFromSettings,
    type OpenAIProviderConfig,
    type GeminiProviderConfig,
    type LMStudioProviderConfig,
    type LLMProviderConfig,
    type SettingsBasedConfig,
} from './providers';

// 持久化适配器
export { IndexedDBAdapter } from './adapters/indexeddb-adapter';
