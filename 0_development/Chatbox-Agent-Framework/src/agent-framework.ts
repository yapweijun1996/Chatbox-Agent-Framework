/**
 * Agent Framework minimal entry.
 * Focuses on core agent orchestration and execution primitives.
 */

// Core types
export * from './core/types';

// State management
export { createState, updateState, serializeState, deserializeState, validateState, StateHelpers } from './core/state';

// Event stream
export { EventStream } from './core/event-stream';

// Tool registry
export { ToolRegistry } from './core/tool-registry';

// Error handling
export {
    createError,
    getErrorStrategy,
    getBackoffDelay,
    retryWithBackoff,
    rollbackToCheckpoint,
    formatErrorMessage,
} from './core/error-handler';

// Node base
export { BaseNode } from './core/node';

// Runner
export { GraphRunner } from './core/runner';

// Agent core
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

// Abort/Resume
export {
    AgentAbortController,
    createAbortController,
    isAbortError,
    type AbortState,
    type ResumeOptions,
} from './core/abort-controller';

// Debug/Audit/RBAC
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

// Nodes
export { PlannerNode } from './nodes/planner';
export { LLMPlannerNode, type LLMPlannerNodeConfig } from './nodes/llm-planner';
export { ToolRunnerNode, type ToolRunnerNodeConfig } from './nodes/tool-runner';
export { ConfirmationNode, type ConfirmationNodeConfig } from './nodes/confirmation';
export { VerifierNode } from './nodes/verifier';
export { ResponderNode } from './nodes/responder';
export { LLMResponderNode, type LLMResponderNodeConfig } from './nodes/llm-responder';

// Example tools
export { sqlQueryTool, documentSearchTool, getExampleTools } from './tools/example-tools';

// LLM Provider abstraction
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

// LLM Service layer (optional but core-friendly)
export {
    LLMService,
    createLLMService,
    LLMCache,
    LLMStatsCollector,
    DEFAULT_LLM_SERVICE_CONFIG,
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
