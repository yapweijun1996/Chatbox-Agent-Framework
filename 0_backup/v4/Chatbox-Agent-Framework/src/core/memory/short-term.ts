/**
 * 短期记忆实现
 * 基于 Map 的内存存储，支持 TTL 和重要性评分
 */

import type {
    ShortTermMemory,
    MemoryItem,
    MemoryMetadata,
    MemoryQueryOptions,
    MemoryImportance,
} from './types';

/**
 * 生成唯一 ID
 */
function generateId(): string {
    return `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 计算重要性级别
 */
function getImportanceLevel(score: number): MemoryImportance {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
}

/**
 * 短期记忆实现类
 */
export class ShortTermMemoryStore implements ShortTermMemory {
    private store: Map<string, MemoryItem> = new Map();
    private maxSize: number;
    private defaultTTL: number;

    constructor(options: { maxSize?: number; defaultTTL?: number } = {}) {
        this.maxSize = options.maxSize ?? 1000;
        this.defaultTTL = options.defaultTTL ?? 30 * 60 * 1000; // 30 分钟
    }

    /**
     * 存储记忆项
     */
    set<T>(key: string, value: T, options: Partial<MemoryMetadata> = {}): void {
        // 检查容量限制
        if (!this.store.has(key) && this.store.size >= this.maxSize) {
            this.evictLeastImportant();
        }

        const now = Date.now();
        const importance = options.importance ?? 0.5;
        const expiresAt = options.expiresAt ?? (this.defaultTTL > 0 ? now + this.defaultTTL : null);

        const metadata: MemoryMetadata = {
            createdAt: options.createdAt ?? now,
            lastAccessedAt: now,
            accessCount: options.accessCount ?? 0,
            importance,
            importanceLevel: getImportanceLevel(importance),
            expiresAt,
            source: options.source,
            tags: options.tags,
        };

        this.store.set(key, {
            id: key,
            content: value,
            metadata,
        });
    }

    /**
     * 获取记忆项
     */
    get<T>(key: string): T | undefined {
        const item = this.store.get(key);
        if (!item) return undefined;

        // 检查过期
        if (this.isExpired(item)) {
            this.store.delete(key);
            return undefined;
        }

        // 更新访问统计
        item.metadata.lastAccessedAt = Date.now();
        item.metadata.accessCount++;

        return item.content as T;
    }

    /**
     * 检查是否存在
     */
    has(key: string): boolean {
        const item = this.store.get(key);
        if (!item) return false;

        if (this.isExpired(item)) {
            this.store.delete(key);
            return false;
        }

        return true;
    }

    /**
     * 删除记忆项
     */
    delete(key: string): boolean {
        return this.store.delete(key);
    }

    /**
     * 清空所有记忆
     */
    clear(): void {
        this.store.clear();
    }

    /**
     * 获取所有键
     */
    keys(): string[] {
        this.cleanup(); // 先清理过期项
        return Array.from(this.store.keys());
    }

    /**
     * 获取所有记忆项
     */
    getAll<T>(): Map<string, MemoryItem<T>> {
        this.cleanup();
        return new Map(this.store as Map<string, MemoryItem<T>>);
    }

    /**
     * 查询记忆
     */
    query<T>(options: MemoryQueryOptions = {}): MemoryItem<T>[] {
        this.cleanup();

        let items = Array.from(this.store.values()) as MemoryItem<T>[];

        // 过滤：最小重要性
        if (options.minImportance !== undefined) {
            items = items.filter(item => item.metadata.importance >= options.minImportance!);
        }

        // 过滤：标签
        if (options.tags && options.tags.length > 0) {
            items = items.filter(item =>
                item.metadata.tags?.some(tag => options.tags!.includes(tag))
            );
        }

        // 排序
        const sortBy = options.sortBy || 'importance';
        const sortOrder = options.sortOrder || 'desc';
        items.sort((a, b) => {
            let compareValue = 0;
            switch (sortBy) {
                case 'createdAt':
                    compareValue = a.metadata.createdAt - b.metadata.createdAt;
                    break;
                case 'lastAccessedAt':
                    compareValue = a.metadata.lastAccessedAt - b.metadata.lastAccessedAt;
                    break;
                case 'importance':
                    compareValue = a.metadata.importance - b.metadata.importance;
                    break;
                case 'accessCount':
                    compareValue = a.metadata.accessCount - b.metadata.accessCount;
                    break;
            }
            return sortOrder === 'asc' ? compareValue : -compareValue;
        });

        // 限制数量
        if (options.limit) {
            items = items.slice(0, options.limit);
        }

        return items;
    }

    /**
     * 获取大小
     */
    size(): number {
        this.cleanup();
        return this.store.size;
    }

    /**
     * 清理过期记忆
     */
    cleanup(): number {
        const now = Date.now();
        let removed = 0;

        for (const [key, item] of this.store.entries()) {
            if (this.isExpired(item)) {
                this.store.delete(key);
                removed++;
            }
        }

        return removed;
    }

    /**
     * 检查是否过期
     */
    private isExpired(item: MemoryItem): boolean {
        if (item.metadata.expiresAt === null) return false;
        return Date.now() > item.metadata.expiresAt;
    }

    /**
     * 淘汰最不重要的记忆
     */
    private evictLeastImportant(): void {
        if (this.store.size === 0) return;

        // 找到重要性最低且最少访问的项
        let minKey: string | null = null;
        let minScore = Infinity;

        for (const [key, item] of this.store.entries()) {
            // 综合评分：重要性 * 访问次数
            const score = item.metadata.importance * Math.log(item.metadata.accessCount + 1);
            if (score < minScore) {
                minScore = score;
                minKey = key;
            }
        }

        if (minKey) {
            this.store.delete(minKey);
        }
    }

    /**
     * 导出所有记忆（用于持久化或调试）
     */
    export(): MemoryItem[] {
        this.cleanup();
        return Array.from(this.store.values());
    }

    /**
     * 导入记忆
     */
    import(items: MemoryItem[]): void {
        for (const item of items) {
            if (!this.isExpired(item)) {
                this.store.set(item.id, item);
            }
        }
    }
}
