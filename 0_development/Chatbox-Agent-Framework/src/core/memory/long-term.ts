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
import { InMemoryPersistenceAdapter } from './persistence/in-memory-adapter';
import type { MemoryPruningConfig, MemorySummarizer } from './pruning';
import { DEFAULT_MEMORY_PRUNING_CONFIG, SimpleMemorySummarizer } from './pruning';
import { toPlainText } from './utils';

const DEFAULT_SUMMARY_LENGTH = 200;

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
 * 长期记忆存储类
 */
export class LongTermMemoryStore implements LongTermMemory {
    private adapter: MemoryPersistenceAdapter;
    private embeddingGen?: EmbeddingGenerator;
    private summarizer: MemorySummarizer;
    private pruningConfig: MemoryPruningConfig;

    constructor(
        adapter?: MemoryPersistenceAdapter,
        embeddingGenerator?: EmbeddingGenerator,
        summarizer?: MemorySummarizer,
        pruningConfig?: Partial<MemoryPruningConfig>
    ) {
        this.adapter = adapter || new InMemoryPersistenceAdapter();
        this.embeddingGen = embeddingGenerator;
        this.summarizer = summarizer || new SimpleMemorySummarizer();
        this.pruningConfig = { ...DEFAULT_MEMORY_PRUNING_CONFIG, ...pruningConfig };
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
        const summary = options.summary ?? this.createSummary(content);

        // 生成嵌入向量
        let embedding: number[] | undefined;
        if (this.embeddingGen && summary) {
            try {
                embedding = await this.embeddingGen.generateEmbedding(summary);
            } catch (err) {
                console.error('[LongTermMemory] Embedding generation failed:', err);
            }
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

        try {
            await this.adapter.save(memory);
        } catch (err) {
            console.error('[LongTermMemory] Save failed:', err);
            throw new Error(`Failed to save memory: ${err instanceof Error ? err.message : String(err)}`);
        }

        return id;
    }

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

    async query<T>(options: MemoryQueryOptions = {}): Promise<LongTermMemoryItem<T>[]> {
        return this.adapter.query<T>(options);
    }

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

        let resolvedSummary = updates.summary;
        let resolvedEmbedding = updates.embedding;

        if (updates.content !== undefined && resolvedSummary === undefined) {
            resolvedSummary = this.createSummary(updates.content);
        }

        if (resolvedSummary !== undefined && this.embeddingGen && resolvedEmbedding === undefined) {
            resolvedEmbedding = await this.embeddingGen.generateEmbedding(resolvedSummary);
        }

        const mergedMetadata = {
            ...existing.metadata,
            ...updates.metadata,
        };

        if (updates.metadata?.importance !== undefined && updates.metadata.importanceLevel === undefined) {
            mergedMetadata.importanceLevel = getImportanceLevel(mergedMetadata.importance);
        }

        const updated: LongTermMemoryItem<T> = {
            ...existing,
            ...updates,
            id: existing.id, // 保持 ID 不变
            metadata: mergedMetadata,
        };

        if (resolvedSummary !== undefined) {
            updated.summary = resolvedSummary;
        }

        if (resolvedEmbedding !== undefined) {
            updated.embedding = resolvedEmbedding;
        }

        await this.adapter.save(updated);
    }

    async delete(id: string): Promise<boolean> {
        return this.adapter.delete(id);
    }

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
        const remaining: LongTermMemoryItem[] = [];

        for (const memory of memories) {
            if (memory.metadata.importance < 0.3 && memory.metadata.accessCount < 2) {
                toRemove.push(memory.id);
            } else {
                remaining.push(memory);
            }
        }

        for (const id of toRemove) {
            await this.adapter.delete(id);
        }

        await this.pruneMemories(remaining);
    }

    async count(): Promise<number> {
        return this.adapter.count();
    }

    private createSummary(content: unknown): string {
        const text = toPlainText(content);
        if (text.length <= DEFAULT_SUMMARY_LENGTH) return text;
        return text.slice(0, DEFAULT_SUMMARY_LENGTH);
    }

    private shouldPrune<T>(memory: LongTermMemoryItem<T>, now: number): boolean {
        if (!this.pruningConfig.enabled) return false;

        // Don't prune important memories
        if (this.pruningConfig.minImportanceToPreserve !== undefined
            && memory.metadata.importance >= this.pruningConfig.minImportanceToPreserve) {
            return false;
        }

        // Don't prune recently accessed memories
        if (this.pruningConfig.minAgeMs !== undefined
            && now - memory.metadata.lastAccessedAt < this.pruningConfig.minAgeMs) {
            return false;
        }

        // Only prune if content is long enough
        const contentText = toPlainText(memory.content);
        if (contentText.length < this.pruningConfig.minContentLength) return false;

        // Only prune if summary can be further compressed
        const summaryText = memory.summary ?? contentText;
        if (summaryText.length <= this.pruningConfig.maxSummaryLength) return false;

        return true;
    }

    private async pruneMemories<T>(memories: LongTermMemoryItem<T>[]): Promise<void> {
        if (!this.pruningConfig.enabled) return;

        const now = Date.now();
        const updated: LongTermMemoryItem<T>[] = [];
        const maxItems = this.pruningConfig.maxItemsPerRun ?? memories.length;
        let processed = 0;

        for (const memory of memories) {
            if (processed >= maxItems) break;
            if (!this.shouldPrune(memory, now)) continue;

            const summary = await this.summarizer.summarize(memory.content, {
                maxLength: this.pruningConfig.maxSummaryLength,
                existingSummary: memory.summary,
            });

            const trimmed = summary.trim();
            if (!trimmed || trimmed === memory.summary) continue;

            const normalized = trimmed.length > this.pruningConfig.maxSummaryLength
                ? trimmed.slice(0, this.pruningConfig.maxSummaryLength)
                : trimmed;

            const updatedMemory: LongTermMemoryItem<T> = {
                ...memory,
                summary: normalized,
            };

            if (this.embeddingGen && normalized) {
                updatedMemory.embedding = await this.embeddingGen.generateEmbedding(normalized);
            }

            updated.push(updatedMemory);
            processed++;
        }

        if (updated.length > 0) {
            await this.adapter.saveBatch(updated);
        }
    }
}
