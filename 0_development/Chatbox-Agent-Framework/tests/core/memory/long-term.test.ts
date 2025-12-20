/**
 * Long-term memory tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LongTermMemoryStore } from '../../../src/core/memory/long-term';
import { InMemoryPersistenceAdapter } from '../../../src/core/memory/persistence/in-memory-adapter';
import { SimpleTFIDFEmbedding } from '../../../src/core/memory/embedding';
import { SimpleMemorySummarizer } from '../../../src/core/memory/pruning';

// ============================================================================
// Long-term memory tests
// ============================================================================

describe('LongTermMemoryStore', () => {
    let memory: LongTermMemoryStore;
    let adapter: InMemoryPersistenceAdapter;

    beforeEach(() => {
        adapter = new InMemoryPersistenceAdapter();
        memory = new LongTermMemoryStore(adapter);
    });

    describe('basic operations', () => {
        it('should add memory', async () => {
            const id = await memory.add('Test content', { importance: 0.7 });
            expect(id).toMatch(/^ltm_/);
        });

        it('should get memory by id', async () => {
            const id = await memory.add('Test content');
            const item = await memory.get(id);

            expect(item).not.toBeNull();
            expect(item?.content).toBe('Test content');
        });

        it('should return null for non-existent id', async () => {
            const item = await memory.get('non-existent');
            expect(item).toBeNull();
        });

        it('should delete memory', async () => {
            const id = await memory.add('Test content');
            const deleted = await memory.delete(id);

            expect(deleted).toBe(true);
            expect(await memory.get(id)).toBeNull();
        });

        it('should clear all memories', async () => {
            await memory.add('Content 1');
            await memory.add('Content 2');
            await memory.clear();

            expect(await memory.count()).toBe(0);
        });
    });

    describe('metadata', () => {
        it('should store tags', async () => {
            const id = await memory.add('Content', { tags: ['tag1', 'tag2'] });
            const item = await memory.get(id);

            expect(item?.metadata.tags).toContain('tag1');
            expect(item?.metadata.tags).toContain('tag2');
        });

        it('should store source', async () => {
            const id = await memory.add('Content', { source: 'test-source' });
            const item = await memory.get(id);

            expect(item?.metadata.source).toBe('test-source');
        });

        it('should track access count', async () => {
            const id = await memory.add('Content');
            await memory.get(id);
            await memory.get(id);

            const item = await memory.get(id);
            expect(item?.metadata.accessCount).toBe(3);
        });
    });

    describe('query', () => {
        beforeEach(async () => {
            await memory.add('Content 1', { importance: 0.8, tags: ['tag1'] });
            await memory.add('Content 2', { importance: 0.5, tags: ['tag2'] });
            await memory.add('Content 3', { importance: 0.3, tags: ['tag1', 'tag2'] });
        });

        it('should query by importance', async () => {
            const results = await memory.query({ minImportance: 0.6 });
            expect(results.length).toBe(1);
        });

        it('should query by tags', async () => {
            const results = await memory.query({ tags: ['tag1'] });
            expect(results.length).toBe(2);
        });

        it('should limit results', async () => {
            const results = await memory.query({ limit: 2 });
            expect(results.length).toBe(2);
        });
    });

    describe('update', () => {
        it('should update memory content', async () => {
            const id = await memory.add('Original content');
            await memory.update(id, { content: 'Updated content' });

            const item = await memory.get(id);
            expect(item?.content).toBe('Updated content');
            expect(item?.summary).toContain('Updated content');
        });

        it('should throw on non-existent id', async () => {
            await expect(memory.update('non-existent', { content: 'test' }))
                .rejects.toThrow();
        });
    });

    describe('search', () => {
        it('should search by text when no embedding generator is provided', async () => {
            await memory.add('Alpha content');
            await memory.add('Beta content');

            const results = await memory.search('alpha');
            expect(results.length).toBeGreaterThan(0);
            expect(results.map(item => item.content)).toContain('Alpha content');
        });

        it('should search by vector when embedding generator is provided', async () => {
            const embedding = new SimpleTFIDFEmbedding(64);
            memory = new LongTermMemoryStore(adapter, embedding);

            await memory.add('Machine learning');
            await memory.add('Cooking recipe');

            const results = await memory.search('Machine learning');
            expect(results.map(item => item.content)).toContain('Machine learning');
        });
    });

    describe('consolidate', () => {
        it('should remove low-value memories', async () => {
            await memory.add('Low value', { importance: 0.1 });
            await memory.add('High value', { importance: 0.9 });

            await memory.consolidate();

            expect(await memory.count()).toBe(1);
        });

        it('should prune long summaries', async () => {
            const summarizer = new SimpleMemorySummarizer();
            const longContent = 'A'.repeat(500);
            memory = new LongTermMemoryStore(
                adapter,
                undefined,
                summarizer,
                {
                    enabled: true,
                    minContentLength: 10,
                    maxSummaryLength: 50,
                    minAgeMs: 0,
                    maxImportance: 1,
                    maxItemsPerRun: 5,
                }
            );

            const id = await memory.add(longContent, { importance: 0.5 });
            await memory.consolidate();

            const item = await memory.get(id);
            expect(item?.summary?.length).toBeLessThanOrEqual(50);
            expect(item?.content).toBe(longContent);
        });
    });
});
