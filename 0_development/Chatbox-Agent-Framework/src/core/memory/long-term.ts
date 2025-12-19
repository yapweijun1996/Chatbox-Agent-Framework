/**
 * 长期记忆实现
 * 支持持久化存储和语义搜索
 */

import type {
    LongTermMemory,
    LongTermMemoryItem,
    MemoryQueryOptions,
    SemanticSearchOptions,
    MemoryPersistenceAdapter,
    EmbeddingGenerator,
    MemoryImportance,
} from './types';

/**
 * 生成唯一 ID
 */
function generateId(): string {
    return `ltm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
 * 简单的内存持久化适配器（用于测试或无持久化需求场景）
 */
export class InMemoryPersistenceAdapter implements MemoryPersistenceAdapter {
    private storage: Map<string, LongTermMemoryItem> = new Map();

    async save<T>(memory: LongTermMemoryItem<T>): Promise<void> {
        this.storage.set(memory.id, memory as LongTermMemoryItem);
    }

    async saveBatch<T>(memories: LongTermMemoryItem<T>[]): Promise<void> {
        for (const memory of memories) {
            await this.save(memory);
        }
    }

    async get<T>(id: string): Promise<LongTermMemoryItem<T> | null> {
        return (this.storage.get(id) as LongTermMemoryItem<T>) || null;
    }

    async query<T>(options: MemoryQueryOptions = {}): Promise<LongTermMemoryItem<T>[]> {
        let items = Array.from(this.storage.values()) as LongTermMemoryItem<T>[];

        // 过滤
        if (options.minImportance !== undefined) {
            items = items.filter(item => item.metadata.importance >= options.minImportance!);
        }

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

        if (options.limit) {
            items = items.slice(0, options.limit);
        }

        return items;
    }

    async semanticSearch<T>(options: SemanticSearchOptions): Promise<LongTermMemoryItem<T>[]> {
        // 简单实现：如果查询是字符串，进行文本匹配
        if (typeof options.query === 'string') {
            const queryLower = options.query.toLowerCase();
            let items = Array.from(this.storage.values()) as LongTermMemoryItem<T>[];

            items = items.filter(item => {
                const contentStr = JSON.stringify(item.content).toLowerCase();
                const summaryStr = item.summary?.toLowerCase() || '';
                return contentStr.includes(queryLower) || summaryStr.includes(queryLower);
            });

            // 应用其他过滤条件
            const queryOptions: MemoryQueryOptions = {
                limit: options.limit,
                minImportance: options.minImportance,
                tags: options.tags,
                sortBy: options.sortBy || 'importance',
                sortOrder: options.sortOrder || 'desc',
            };

            return this.query(queryOptions);
        }

        // 如果是向量查询，需要计算相似度（此处简化返回空）
        return [];
    }

    async delete(id: string): Promise<boolean> {
        return this.storage.delete(id);
    }

    async clear(): Promise<void> {
        this.storage.clear();
    }

    async count(): Promise<number> {
        return this.storage.size;
    }
}

/**
 * 长期记忆存储类
 */
export class LongTermMemoryStore implements LongTermMemory {
    private adapter: MemoryPersistenceAdapter;
    private embeddingGen?: EmbeddingGenerator;

    constructor(
        adapter?: MemoryPersistenceAdapter,
        embeddingGenerator?: EmbeddingGenerator
    ) {
        this.adapter = adapter || new InMemoryPersistenceAdapter();
        this.embeddingGen = embeddingGenerator;
    }

    /**
     * 添加记忆
     */
    async add<T>(
        content: T,
        options: {
            summary?: string;
            importance?: number;
            tags?: string[];
            source?: string;
        } = {}
    ): Promise<string> {
        const id = generateId();
        const now = Date.now();
        const importance = options.importance ?? 0.5;

        // 生成摘要
        let summary = options.summary;
        if (!summary && typeof content === 'string') {
            summary = content.slice(0, 200);
        } else if (!summary) {
            summary = JSON.stringify(content).slice(0, 200);
        }

        // 生成嵌入向量
        let embedding: number[] | undefined;
        if (this.embeddingGen && summary) {
            embedding = await this.embeddingGen.generateEmbedding(summary);
        }

        const memory: LongTermMemoryItem<T> = {
            id,
            content,
            summary,
            embedding,
            metadata: {
                createdAt: now,
                lastAccessedAt: now,
                accessCount: 0,
                importance,
                importanceLevel: getImportanceLevel(importance),
                expiresAt: null, // 长期记忆不过期
                source: options.source,
                tags: options.tags,
            },
        };

        await this.adapter.save(memory);
        return id;
    }

    /**
     * 获取记忆
     */
    async get<T>(id: string): Promise<LongTermMemoryItem<T> | null> {
        const memory = await this.adapter.get<T>(id);
        if (memory) {
            // 更新访问统计
            memory.metadata.lastAccessedAt = Date.now();
            memory.metadata.accessCount++;
            await this.adapter.save(memory);
        }
        return memory;
    }

    /**
     * 查询记忆
     */
    async query<T>(options: MemoryQueryOptions = {}): Promise<LongTermMemoryItem<T>[]> {
        return this.adapter.query<T>(options);
    }

    /**
     * 语义搜索
     */
    async search<T>(
        query: string,
        options: Partial<SemanticSearchOptions> = {}
    ): Promise<LongTermMemoryItem<T>[]> {
        const searchOptions: SemanticSearchOptions = {
            query,
            limit: options.limit || 10,
            threshold: options.threshold || 0.7,
            minImportance: options.minImportance,
            tags: options.tags,
            sortBy: options.sortBy || 'importance',
            sortOrder: options.sortOrder || 'desc',
        };

        // 如果有嵌入生成器，生成查询向量
        if (this.embeddingGen) {
            const queryEmbedding = await this.embeddingGen.generateEmbedding(query);
            searchOptions.query = queryEmbedding;
        }

        return this.adapter.semanticSearch<T>(searchOptions);
    }

    /**
     * 更新记忆
     */
    async update<T>(id: string, updates: Partial<LongTermMemoryItem<T>>): Promise<void> {
        const existing = await this.adapter.get<T>(id);
        if (!existing) {
            throw new Error(`Memory with id ${id} not found`);
        }

        const updated: LongTermMemoryItem<T> = {
            ...existing,
            ...updates,
            id: existing.id, // 保持 ID 不变
            metadata: {
                ...existing.metadata,
                ...updates.metadata,
            },
        };

        await this.adapter.save(updated);
    }

    /**
     * 删除记忆
     */
    async delete(id: string): Promise<boolean> {
        return this.adapter.delete(id);
    }

    /**
     * 清空所有记忆
     */
    async clear(): Promise<void> {
        await this.adapter.clear();
    }

    /**
     * 整理记忆（压缩、归档）
     */
    async consolidate(): Promise<void> {
        // 获取所有记忆
        const memories = await this.adapter.query({ sortBy: 'importance', sortOrder: 'asc' });

        // 移除低重要性且访问次数少的记忆
        const toRemove: string[] = [];
        for (const memory of memories) {
            if (memory.metadata.importance < 0.3 && memory.metadata.accessCount < 2) {
                toRemove.push(memory.id);
            }
        }

        // 批量删除
        for (const id of toRemove) {
            await this.adapter.delete(id);
        }
    }

    /**
     * 获取记忆总数
     */
    async count(): Promise<number> {
        return this.adapter.count();
    }
}
