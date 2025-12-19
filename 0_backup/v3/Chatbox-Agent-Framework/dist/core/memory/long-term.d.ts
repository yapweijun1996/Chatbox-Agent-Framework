/**
 * 长期记忆实现
 * 支持持久化存储和语义搜索
 */
import type { LongTermMemory, LongTermMemoryItem, MemoryQueryOptions, SemanticSearchOptions, MemoryPersistenceAdapter, EmbeddingGenerator } from './types';
/**
 * 简单的内存持久化适配器（用于测试或无持久化需求场景）
 */
export declare class InMemoryPersistenceAdapter implements MemoryPersistenceAdapter {
    private storage;
    save<T>(memory: LongTermMemoryItem<T>): Promise<void>;
    saveBatch<T>(memories: LongTermMemoryItem<T>[]): Promise<void>;
    get<T>(id: string): Promise<LongTermMemoryItem<T> | null>;
    query<T>(options?: MemoryQueryOptions): Promise<LongTermMemoryItem<T>[]>;
    semanticSearch<T>(options: SemanticSearchOptions): Promise<LongTermMemoryItem<T>[]>;
    delete(id: string): Promise<boolean>;
    clear(): Promise<void>;
    count(): Promise<number>;
}
/**
 * 长期记忆存储类
 */
export declare class LongTermMemoryStore implements LongTermMemory {
    private adapter;
    private embeddingGen?;
    constructor(adapter?: MemoryPersistenceAdapter, embeddingGenerator?: EmbeddingGenerator);
    /**
     * 添加记忆
     */
    add<T>(content: T, options?: {
        summary?: string;
        importance?: number;
        tags?: string[];
        source?: string;
    }): Promise<string>;
    /**
     * 获取记忆
     */
    get<T>(id: string): Promise<LongTermMemoryItem<T> | null>;
    /**
     * 查询记忆
     */
    query<T>(options?: MemoryQueryOptions): Promise<LongTermMemoryItem<T>[]>;
    /**
     * 语义搜索
     */
    search<T>(query: string, options?: Partial<SemanticSearchOptions>): Promise<LongTermMemoryItem<T>[]>;
    /**
     * 更新记忆
     */
    update<T>(id: string, updates: Partial<LongTermMemoryItem<T>>): Promise<void>;
    /**
     * 删除记忆
     */
    delete(id: string): Promise<boolean>;
    /**
     * 清空所有记忆
     */
    clear(): Promise<void>;
    /**
     * 整理记忆（压缩、归档）
     */
    consolidate(): Promise<void>;
    /**
     * 获取记忆总数
     */
    count(): Promise<number>;
}
//# sourceMappingURL=long-term.d.ts.map