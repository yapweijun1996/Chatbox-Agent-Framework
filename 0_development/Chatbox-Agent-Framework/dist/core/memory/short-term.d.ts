/**
 * 短期记忆实现
 * 基于 Map 的内存存储，支持 TTL 和重要性评分
 */
import type { ShortTermMemory, MemoryItem, MemoryMetadata, MemoryQueryOptions } from './types';
/**
 * 短期记忆实现类
 */
export declare class ShortTermMemoryStore implements ShortTermMemory {
    private store;
    private maxSize;
    private defaultTTL;
    constructor(options?: {
        maxSize?: number;
        defaultTTL?: number;
    });
    /**
     * 存储记忆项
     */
    set<T>(key: string, value: T, options?: Partial<MemoryMetadata>): void;
    /**
     * 获取记忆项
     */
    get<T>(key: string): T | undefined;
    /**
     * 检查是否存在
     */
    has(key: string): boolean;
    /**
     * 删除记忆项
     */
    delete(key: string): boolean;
    /**
     * 清空所有记忆
     */
    clear(): void;
    /**
     * 获取所有键
     */
    keys(): string[];
    /**
     * 获取所有记忆项
     */
    getAll<T>(): Map<string, MemoryItem<T>>;
    /**
     * 查询记忆
     */
    query<T>(options?: MemoryQueryOptions): MemoryItem<T>[];
    /**
     * 获取大小
     */
    size(): number;
    /**
     * 清理过期记忆
     */
    cleanup(): number;
    /**
     * 检查是否过期
     */
    private isExpired;
    /**
     * 淘汰最不重要的记忆
     */
    private evictLeastImportant;
    /**
     * 导出所有记忆（用于持久化或调试）
     */
    export(): MemoryItem[];
    /**
     * 导入记忆
     */
    import(items: MemoryItem[]): void;
}
//# sourceMappingURL=short-term.d.ts.map