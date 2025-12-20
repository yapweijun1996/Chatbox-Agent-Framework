import { openDB, type IDBPDatabase } from 'idb';
import type {
    LongTermMemoryItem,
    MemoryPersistenceAdapter,
    MemoryQueryOptions,
    SemanticSearchOptions,
} from '../types';
import { cosineSimilarity } from '../embedding';
import { applyQueryOptions, filterByQueryOptions, matchesTextQuery } from '../utils';

const DB_NAME = 'agent-memory-db';
const DB_VERSION = 1;
const MEMORY_STORE = 'long_term_memory';

export class IndexedDBMemoryAdapter implements MemoryPersistenceAdapter {
    private db: IDBPDatabase | null = null;

    async init(): Promise<void> {
        if (typeof indexedDB === 'undefined') {
            throw new Error('IndexedDB is not available in this environment.');
        }

        this.db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(MEMORY_STORE)) {
                    const store = db.createObjectStore(MEMORY_STORE, { keyPath: 'id' });
                    store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
                    store.createIndex('lastAccessedAt', 'metadata.lastAccessedAt', { unique: false });
                    store.createIndex('importance', 'metadata.importance', { unique: false });
                    store.createIndex('accessCount', 'metadata.accessCount', { unique: false });
                    store.createIndex('tags', 'metadata.tags', { unique: false, multiEntry: true });
                }
            },
        });
    }

    async save<T>(memory: LongTermMemoryItem<T>): Promise<void> {
        await this.ensureDB();
        await this.db!.put(MEMORY_STORE, memory);
    }

    async saveBatch<T>(memories: LongTermMemoryItem<T>[]): Promise<void> {
        await this.ensureDB();
        const tx = this.db!.transaction(MEMORY_STORE, 'readwrite');
        for (const memory of memories) {
            await tx.store.put(memory);
        }
        await tx.done;
    }

    async get<T>(id: string): Promise<LongTermMemoryItem<T> | null> {
        await this.ensureDB();
        const memory = await this.db!.get(MEMORY_STORE, id);
        return (memory as LongTermMemoryItem<T>) || null;
    }

    async query<T>(options: MemoryQueryOptions = {}): Promise<LongTermMemoryItem<T>[]> {
        await this.ensureDB();
        const items = (await this.db!.getAll(MEMORY_STORE)) as LongTermMemoryItem<T>[];
        return applyQueryOptions(items, options);
    }

    async semanticSearch<T>(options: SemanticSearchOptions): Promise<LongTermMemoryItem<T>[]> {
        await this.ensureDB();
        const items = (await this.db!.getAll(MEMORY_STORE)) as LongTermMemoryItem<T>[];

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
        await this.ensureDB();
        await this.db!.delete(MEMORY_STORE, id);
        return true;
    }

    async clear(): Promise<void> {
        await this.ensureDB();
        await this.db!.clear(MEMORY_STORE);
    }

    async count(): Promise<number> {
        await this.ensureDB();
        return this.db!.count(MEMORY_STORE);
    }

    private async ensureDB(): Promise<void> {
        if (!this.db) {
            await this.init();
        }
    }
}
