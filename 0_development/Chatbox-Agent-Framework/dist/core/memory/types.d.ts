/**
 * 记忆系统类型定义
 * 定义短期和长期记忆的结构与接口
 */
/**
 * 记忆项的重要性级别
 */
export type MemoryImportance = 'low' | 'medium' | 'high' | 'critical';
/**
 * 记忆项元数据
 */
export interface MemoryMetadata {
    /** 创建时间戳 */
    createdAt: number;
    /** 最后访问时间 */
    lastAccessedAt: number;
    /** 访问次数 */
    accessCount: number;
    /** 重要性评分 (0-1) */
    importance: number;
    /** 重要性级别 */
    importanceLevel: MemoryImportance;
    /** 过期时间（毫秒），null 表示不过期 */
    expiresAt: number | null;
    /** 来源标签 */
    source?: string;
    /** 自定义标签 */
    tags?: string[];
}
/**
 * 记忆项基础接口
 */
export interface MemoryItem<T = unknown> {
    /** 唯一 ID */
    id: string;
    /** 记忆内容 */
    content: T;
    /** 元数据 */
    metadata: MemoryMetadata;
}
/**
 * 记忆查询选项
 */
export interface MemoryQueryOptions {
    /** 最大返回数量 */
    limit?: number;
    /** 最小重要性评分 */
    minImportance?: number;
    /** 标签过滤 */
    tags?: string[];
    /** 按时间排序 */
    sortBy?: 'createdAt' | 'lastAccessedAt' | 'importance' | 'accessCount';
    /** 排序方向 */
    sortOrder?: 'asc' | 'desc';
}
/**
 * 短期记忆存储
 * 键值对存储，用于当前会话的临时数据
 */
export interface ShortTermMemory {
    /** 存储记忆项 */
    set<T>(key: string, value: T, options?: Partial<MemoryMetadata>): void;
    /** 获取记忆项 */
    get<T>(key: string): T | undefined;
    /** 检查是否存在 */
    has(key: string): boolean;
    /** 删除记忆项 */
    delete(key: string): boolean;
    /** 清空所有记忆 */
    clear(): void;
    /** 获取所有键 */
    keys(): string[];
    /** 获取所有记忆项 */
    getAll<T>(): Map<string, MemoryItem<T>>;
    /** 查询记忆 */
    query<T>(options: MemoryQueryOptions): MemoryItem<T>[];
    /** 获取大小 */
    size(): number;
    /** 清理过期记忆 */
    cleanup(): number;
}
/**
 * 长期记忆项（带向量）
 */
export interface LongTermMemoryItem<T = unknown> extends MemoryItem<T> {
    /** 文本摘要（用于检索） */
    summary?: string;
    /** 向量嵌入（用于语义搜索） */
    embedding?: number[];
    /** 关联的记忆 ID */
    relatedMemoryIds?: string[];
}
/**
 * 语义搜索选项
 */
export interface SemanticSearchOptions extends MemoryQueryOptions {
    /** 查询文本或向量 */
    query: string | number[];
    /** 相似度阈值 (0-1) */
    threshold?: number;
}
/**
 * 记忆持久化适配器接口
 */
export interface MemoryPersistenceAdapter {
    /** 保存记忆项 */
    save<T>(memory: LongTermMemoryItem<T>): Promise<void>;
    /** 批量保存 */
    saveBatch<T>(memories: LongTermMemoryItem<T>[]): Promise<void>;
    /** 通过 ID 获取 */
    get<T>(id: string): Promise<LongTermMemoryItem<T> | null>;
    /** 查询记忆 */
    query<T>(options: MemoryQueryOptions): Promise<LongTermMemoryItem<T>[]>;
    /** 语义搜索 */
    semanticSearch<T>(options: SemanticSearchOptions): Promise<LongTermMemoryItem<T>[]>;
    /** 删除记忆 */
    delete(id: string): Promise<boolean>;
    /** 清空所有记忆 */
    clear(): Promise<void>;
    /** 获取总数 */
    count(): Promise<number>;
}
/**
 * 文本嵌入生成器接口
 */
export interface EmbeddingGenerator {
    /** 生成文本嵌入向量 */
    generateEmbedding(text: string): Promise<number[]>;
    /** 批量生成 */
    generateEmbeddings(texts: string[]): Promise<number[][]>;
    /** 计算相似度 */
    calculateSimilarity(embedding1: number[], embedding2: number[]): number;
}
/**
 * 长期记忆存储接口
 */
export interface LongTermMemory {
    /** 添加记忆 */
    add<T>(content: T, options?: {
        summary?: string;
        importance?: number;
        tags?: string[];
        source?: string;
    }): Promise<string>;
    /** 获取记忆 */
    get<T>(id: string): Promise<LongTermMemoryItem<T> | null>;
    /** 查询记忆 */
    query<T>(options: MemoryQueryOptions): Promise<LongTermMemoryItem<T>[]>;
    /** 语义搜索 */
    search<T>(query: string, options?: Partial<SemanticSearchOptions>): Promise<LongTermMemoryItem<T>[]>;
    /** 更新记忆 */
    update<T>(id: string, updates: Partial<LongTermMemoryItem<T>>): Promise<void>;
    /** 删除记忆 */
    delete(id: string): Promise<boolean>;
    /** 清空所有记忆 */
    clear(): Promise<void>;
    /** 整理记忆（压缩、归档） */
    consolidate(): Promise<void>;
}
/**
 * 记忆管理器配置
 */
export interface MemoryManagerConfig {
    /** 短期记忆最大容量 */
    shortTermMaxSize: number;
    /** 短期记忆默认 TTL（毫秒） */
    shortTermDefaultTTL: number;
    /** 长期记忆持久化适配器 */
    persistenceAdapter?: MemoryPersistenceAdapter;
    /** 嵌入生成器 */
    embeddingGenerator?: EmbeddingGenerator;
    /** 是否启用自动整理 */
    autoConsolidate: boolean;
    /** 自动整理间隔（毫秒） */
    consolidateIntervalMs: number;
    /** 重要性阈值（低于此值的记忆将被清理） */
    importanceThreshold: number;
}
/**
 * 记忆统计信息
 */
export interface MemoryStats {
    shortTerm: {
        size: number;
        totalAccesses: number;
        averageImportance: number;
    };
    longTerm: {
        count: number;
        averageImportance: number;
    };
}
/**
 * 记忆管理器接口
 */
export interface MemoryManager {
    /** 短期记忆实例 */
    shortTerm: ShortTermMemory;
    /** 长期记忆实例 */
    longTerm: LongTermMemory;
    /** 记住信息（自动选择短期/长期） */
    remember<T>(content: T, options?: {
        longTerm?: boolean;
        importance?: number;
        ttl?: number;
        tags?: string[];
    }): Promise<string> | string;
    /** 回忆信息（从短期和长期记忆中搜索） */
    recall<T>(query: string | MemoryQueryOptions): Promise<MemoryItem<T>[]>;
    /** 提升记忆到长期存储 */
    promoteToLongTerm(shortTermKey: string): Promise<string | null>;
    /** 获取统计信息 */
    getStats(): MemoryStats;
    /** 清理过期记忆 */
    cleanup(): Promise<void>;
    /** 整理记忆 */
    consolidate(): Promise<void>;
}
/**
 * 默认配置
 */
export declare const DEFAULT_MEMORY_CONFIG: MemoryManagerConfig;
//# sourceMappingURL=types.d.ts.map