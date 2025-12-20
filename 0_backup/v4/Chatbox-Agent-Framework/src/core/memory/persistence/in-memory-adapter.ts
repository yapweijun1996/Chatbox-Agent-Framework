import type {
    LongTermMemoryItem,
    MemoryPersistenceAdapter,
    MemoryQueryOptions,
    SemanticSearchOptions,
} from '../types';
import { cosineSimilarity } from '../embedding';
import { applyQueryOptions, filterByQueryOptions, matchesTextQuery } from '../utils';

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
        const items = Array.from(this.storage.values()) as LongTermMemoryItem<T>[];
        return applyQueryOptions(items, options);
    }

    async semanticSearch<T>(options: SemanticSearchOptions): Promise<LongTermMemoryItem<T>[]> {
        const items = Array.from(this.storage.values()) as LongTermMemoryItem<T>[];

        if (typeof options.query === 'string') {
            const queryLower = options.query.toLowerCase();
            const matches = items.filter(item => matchesTextQuery(item, queryLower));
            const queryOptions: MemoryQueryOptions = {
                limit: options.limit,
                minImportance: options.minImportance,
                tags: options.tags,
                sortBy: options.sortBy,
                sortOrder: options.sortOrder,
            };
            return applyQueryOptions(matches, queryOptions);
        }

        const threshold = options.threshold ?? 0.7;
        const candidates = filterByQueryOptions(items, options);
        const scored: Array<{ item: LongTermMemoryItem<T>; similarity: number }> = [];

        for (const item of candidates) {
            if (!item.embedding || item.embedding.length !== options.query.length) continue;
            const similarity = cosineSimilarity(options.query, item.embedding);
            if (similarity >= threshold) {
                scored.push({ item, similarity });
            }
        }

        scored.sort((a, b) => b.similarity - a.similarity);
        let results = scored.map(entry => entry.item);

        if (options.limit) {
            results = results.slice(0, options.limit);
        }

        return results;
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
