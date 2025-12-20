/**
 * IndexedDB memory adapter tests
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDBMemoryAdapter } from '../../../src/core/memory/persistence/indexeddb-memory-adapter';
import type { LongTermMemoryItem } from '../../../src/core/memory/types';

const createMetadata = () => ({
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    accessCount: 0,
    importance: 0.5,
    importanceLevel: 'medium' as const,
    expiresAt: null,
});

describe('IndexedDBMemoryAdapter', () => {
    let adapter: IndexedDBMemoryAdapter;

    beforeEach(async () => {
        adapter = new IndexedDBMemoryAdapter();
        await adapter.clear();
    });

    it('should save and load memory', async () => {
        const memory: LongTermMemoryItem<string> = {
            id: 'mem_1',
            content: 'Hello world',
            summary: 'Hello world',
            metadata: createMetadata(),
        };

        await adapter.save(memory);
        const loaded = await adapter.get<string>('mem_1');

        expect(loaded).not.toBeNull();
        expect(loaded?.content).toBe('Hello world');
    });

    it('should search by text', async () => {
        const memory: LongTermMemoryItem<string> = {
            id: 'mem_2',
            content: 'Alpha content',
            summary: 'Alpha content',
            metadata: createMetadata(),
        };

        await adapter.save(memory);
        const results = await adapter.semanticSearch<string>({ query: 'alpha' });

        expect(results.length).toBe(1);
        expect(results[0].id).toBe('mem_2');
    });

    it('should search by vector', async () => {
        const memory: LongTermMemoryItem<string> = {
            id: 'mem_3',
            content: 'Vector content',
            summary: 'Vector content',
            embedding: [1, 0, 0],
            metadata: createMetadata(),
        };

        await adapter.save(memory);
        const results = await adapter.semanticSearch<string>({
            query: [1, 0, 0],
            threshold: 0.9,
        });

        expect(results.length).toBe(1);
        expect(results[0].id).toBe('mem_3');
    });
});
