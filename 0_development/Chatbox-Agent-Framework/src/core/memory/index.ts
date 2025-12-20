/**
 * 记忆系统模块导出
 */

// 核心实现
export { ShortTermMemoryStore } from './short-term';
export { LongTermMemoryStore } from './long-term';
export { InMemoryPersistenceAdapter } from './persistence/in-memory-adapter';
export { IndexedDBMemoryAdapter } from './persistence/indexeddb-memory-adapter';
export { MemoryManagerImpl, createMemoryManager } from './manager';
export { SimpleTFIDFEmbedding, OpenAIEmbedding, cosineSimilarity } from './embedding';
export { SimpleMemorySummarizer, DEFAULT_MEMORY_PRUNING_CONFIG } from './pruning';
export {
    applyChatMemoryRecallPolicy,
    DEFAULT_CHAT_MEMORY_RECALL_POLICY,
    DEFAULT_CHAT_MEMORY_SAVE_POLICY,
    formatChatMemories,
    saveChatMemoryTurn,
} from './chat-memory';
export {
    DEFAULT_INTENT_PATTERNS,
    DEFAULT_PREFERENCE_PATTERNS,
    extractIntentMemory,
    isPreferenceStatement,
    normalizeMemoryContent,
} from './memory-heuristics';

// 类型
export type {
    // 基础类型
    MemoryImportance,
    MemoryMetadata,
    MemoryItem,
    MemoryQueryOptions,

    // 短期记忆
    ShortTermMemory,

    // 长期记忆
    LongTermMemoryItem,
    SemanticSearchOptions,
    MemoryPersistenceAdapter,
    EmbeddingGenerator,
    MemorySummarizer,
    MemoryPruningConfig,
    MemorySummaryOptions,
    LongTermMemory,

    // 管理器
    MemoryManagerConfig,
    MemoryStats,
    MemoryManager,
} from './types';

export { DEFAULT_MEMORY_CONFIG } from './types';
export type { ChatMemoryMessageRole, ChatMemoryRecallPolicy, ChatMemorySavePolicy } from './chat-memory';
