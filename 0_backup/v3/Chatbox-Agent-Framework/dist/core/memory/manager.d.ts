/**
 * 记忆管理器
 * 统一管理短期和长期记忆，提供高级 API
 */
import type { MemoryManager, MemoryManagerConfig, ShortTermMemory, LongTermMemory, MemoryStats, MemoryQueryOptions, MemoryItem, MemoryPersistenceAdapter, EmbeddingGenerator } from './types';
/**
 * 记忆管理器实现类
 */
export declare class MemoryManagerImpl implements MemoryManager {
    shortTerm: ShortTermMemory;
    longTerm: LongTermMemory;
    private config;
    private consolidateTimer?;
    constructor(config?: Partial<MemoryManagerConfig>, persistenceAdapter?: MemoryPersistenceAdapter, embeddingGenerator?: EmbeddingGenerator);
    /**
     * 记住信息（自动选择短期/长期）
     */
    remember<T>(content: T, options?: {
        longTerm?: boolean;
        importance?: number;
        ttl?: number;
        tags?: string[];
        source?: string;
    }): Promise<string> | string;
    /**
     * 回忆信息（从短期和长期记忆中搜索）
     */
    recall<T>(query: string | MemoryQueryOptions): Promise<MemoryItem<T>[]>;
    /**
     * 提升记忆到长期存储
     */
    promoteToLongTerm(shortTermKey: string): Promise<string | null>;
    /**
     * 获取统计信息
     */
    getStats(): MemoryStats;
    /**
     * 清理过期记忆
     */
    cleanup(): Promise<void>;
    /**
     * 整理记忆
     */
    consolidate(): Promise<void>;
    /**
     * 启动自动整理
     */
    private startAutoConsolidate;
    /**
     * 停止自动整理
     */
    stopAutoConsolidate(): void;
    /**
     * 销毁资源
     */
    destroy(): void;
}
/**
 * 创建记忆管理器
 */
export declare function createMemoryManager(config?: Partial<MemoryManagerConfig>, persistenceAdapter?: MemoryPersistenceAdapter, embeddingGenerator?: EmbeddingGenerator): MemoryManager;
//# sourceMappingURL=manager.d.ts.map