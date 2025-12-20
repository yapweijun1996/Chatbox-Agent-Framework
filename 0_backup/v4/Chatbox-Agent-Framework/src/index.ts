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
export { toMermaid, toMermaidWithState } from './core/graph-visualizer';
export { LiveDebugger } from './core/live-debugger';
export {
    DistributedExecutor,
    InMemoryTaskQueue,
    InMemoryCheckpointStore,
    DistributedWorkerPool,
    InMemoryTaskQueueStore,
    PersistentTaskQueue,
    PersistentTaskQueueFactory,
    type TaskQueueFactory,
    type TaskQueueStore,
    type DistributedCheckpointStore,
    type DistributedTask,
    type DistributedTaskResult,
    type TaskQueue,
} from './core/distributed-execution';
export { IndexedDBTaskQueueStore } from './core/persistence/indexeddb-task-queue-store';

// Agent 核心类
export { Agent, createAgent, type AgentConfig, type AgentResult, type ChatOptions, type AgentMode, type ProviderConfigInput } from './core/agent';
export {
    LLMIntentRouter,
    RuleBasedIntentRouter,
    type IntentDecision,
    type IntentMemoryPolicy,
    type IntentMode,
    type IntentRouter,
    type IntentRouterContext,
    type IntentToolPolicy,
} from './core/intent-router';
export {
    MultiAgentOrchestrator,
    RuleBasedMultiAgentRouter,
    LLMultiAgentRouter,
    type AgentClient,
    type AgentDescriptor,
    type MultiAgentDecision,
    type MultiAgentRouter,
    type MultiAgentRouterContext,
    type MultiAgentTask,
    type MultiAgentTaskResult,
} from './core/multi-agent';
export {
    AgentCoordinator,
} from './core/agent-coordinator';
export {
    CrewCoordinator,
} from './core/crew-collaboration';

// Abort/Resume 控制
export {
    AgentAbortController,
    createAbortController,
    isAbortError,
    type AbortState,
    type ResumeOptions,
} from './core/abort-controller';

// Debug Bundle
export {
    createDebugBundle,
    exportDebugBundle,
    downloadDebugBundle,
    importDebugBundle,
    type DebugBundle,
} from './core/debug-bundle';
export {
    createEventStreamAuditLogger,
    type AuditEntry,
    type AuditLogger,
    type AuditStatus,
} from './core/audit';
export {
    resolvePermissions,
    resolveRoles,
    type RBACContext,
    type RBACPolicy,
} from './core/rbac';

// 节点实现
export { PlannerNode } from './nodes/planner';
export { LLMPlannerNode, type LLMPlannerNodeConfig } from './nodes/llm-planner';
export { ToolRunnerNode, type ToolRunnerNodeConfig } from './nodes/tool-runner';
export { ConfirmationNode, type ConfirmationNodeConfig } from './nodes/confirmation';
export { VerifierNode } from './nodes/verifier';
export { ResponderNode } from './nodes/responder';
export { LLMResponderNode, type LLMResponderNodeConfig } from './nodes/llm-responder';
export { MemoryNode, type MemoryNodeConfig } from './nodes/memory';

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

// LLM Service 高级服务层
export {
    // 核心服务
    LLMService,
    createLLMService,
    // 缓存
    LLMCache,
    // 统计
    LLMStatsCollector,
    // 默认配置
    DEFAULT_LLM_SERVICE_CONFIG,
    // 内置中间件
    createRequestLoggingMiddleware,
    createResponseLoggingMiddleware,
    createLoggingMiddleware,
    createSystemPromptMiddleware,
    createContentFilterMiddleware,
    createTruncationMiddleware,
    createValidationMiddleware,
    createTransformMiddleware,
    createJsonParseMiddleware,
    createFallbackMiddleware,
    createErrorLoggingMiddleware,
    createErrorTransformMiddleware,
    // 类型
    type LLMRequestOptions,
    type LLMRequestContext,
    type LLMResult,
    type LLMStreamResult,
    type LLMRequestMiddleware,
    type LLMResponseMiddleware,
    type LLMErrorMiddleware,
    type LLMCallStats,
    type LLMAggregateStats,
    type LLMServiceConfig,
    type RetryConfig,
    type CacheConfig,
    type RateLimitConfig,
} from './core/llm-service';

// 记忆系统
export {
    // 核心实现
    ShortTermMemoryStore,
    LongTermMemoryStore,
    InMemoryPersistenceAdapter,
    IndexedDBMemoryAdapter,
    MemoryManagerImpl,
    createMemoryManager,
    SimpleTFIDFEmbedding,
    OpenAIEmbedding,
    cosineSimilarity,
    SimpleMemorySummarizer,
    applyChatMemoryRecallPolicy,
    DEFAULT_CHAT_MEMORY_RECALL_POLICY,
    DEFAULT_CHAT_MEMORY_SAVE_POLICY,
    formatChatMemories,
    saveChatMemoryTurn,
    DEFAULT_INTENT_PATTERNS,
    DEFAULT_PREFERENCE_PATTERNS,
    extractIntentMemory,
    isPreferenceStatement,
    normalizeMemoryContent,
    // 默认配置
    DEFAULT_MEMORY_CONFIG,
    DEFAULT_MEMORY_PRUNING_CONFIG,
    // 类型
    type MemoryImportance,
    type MemoryMetadata,
    type MemoryItem,
    type MemoryQueryOptions,
    type ShortTermMemory,
    type LongTermMemoryItem,
    type SemanticSearchOptions,
    type MemoryPersistenceAdapter,
    type EmbeddingGenerator,
    type MemorySummarizer,
    type MemoryPruningConfig,
    type MemorySummaryOptions,
    type LongTermMemory,
    type MemoryManagerConfig,
    type MemoryStats,
    type MemoryManager,
    type ChatMemoryMessageRole,
    type ChatMemoryRecallPolicy,
    type ChatMemorySavePolicy,
} from './core/memory';
