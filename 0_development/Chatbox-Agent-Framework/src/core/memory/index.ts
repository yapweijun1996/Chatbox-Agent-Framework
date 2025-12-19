/**
 * 记忆系统模块导出
 */

// 核心实现
export { ShortTermMemoryStore } from './short-term';
export { LongTermMemoryStore, InMemoryPersistenceAdapter } from './long-term';
export { MemoryManagerImpl, createMemoryManager } from './manager';
export { SimpleTFIDFEmbedding, OpenAIEmbedding, cosineSimilarity } from './embedding';

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
    LongTermMemory,

    // 管理器
    MemoryManagerConfig,
    MemoryStats,
    MemoryManager,
} from './types';

export { DEFAULT_MEMORY_CONFIG } from './types';
