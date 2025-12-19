/**
 * 记忆系统单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShortTermMemoryStore } from '../../src/core/memory/short-term';
import { LongTermMemoryStore, InMemoryPersistenceAdapter } from '../../src/core/memory/long-term';
import { MemoryManagerImpl, createMemoryManager } from '../../src/core/memory/manager';
import { SimpleTFIDFEmbedding, cosineSimilarity } from '../../src/core/memory/embedding';
import type { MemoryItem, LongTermMemoryItem } from '../../src/core/memory/types';

// ============================================================================
// 短期记忆测试
// ============================================================================

describe('ShortTermMemoryStore', () => {
    let memory: ShortTermMemoryStore;

    beforeEach(() => {
        memory = new ShortTermMemoryStore({ maxSize: 10, defaultTTL: 1000 });
    });

    describe('基本操作', () => {
        it('should store and retrieve values', () => {
            memory.set('key1', 'value1');
            expect(memory.get('key1')).toBe('value1');
        });

        it('should return undefined for non-existent keys', () => {
            expect(memory.get('nonexistent')).toBeUndefined();
        });

        it('should check existence', () => {
            memory.set('key1', 'value1');
            expect(memory.has('key1')).toBe(true);
            expect(memory.has('key2')).toBe(false);
        });

        it('should delete values', () => {
            memory.set('key1', 'value1');
            expect(memory.delete('key1')).toBe(true);
            expect(memory.has('key1')).toBe(false);
            expect(memory.delete('key1')).toBe(false);
        });

        it('should clear all values', () => {
            memory.set('key1', 'value1');
            memory.set('key2', 'value2');
            memory.clear();
            expect(memory.size()).toBe(0);
        });

        it('should get all keys', () => {
            memory.set('key1', 'value1');
            memory.set('key2', 'value2');
            const keys = memory.keys();
            expect(keys).toContain('key1');
            expect(keys).toContain('key2');
        });
    });

    describe('容量管理', () => {
        it('should respect max size', () => {
            for (let i = 0; i < 15; i++) {
                memory.set(`key${i}`, `value${i}`, { importance: i / 15 });
            }
            expect(memory.size()).toBeLessThanOrEqual(10);
        });

        it('should evict least important items', () => {
            memory.set('low', 'value', { importance: 0.1 });
            memory.set('high', 'value', { importance: 0.9 });

            // 访问 high 增加其访问计数
            memory.get('high');
            memory.get('high');

            // 填满容量（会触发淘汰）
            for (let i = 0; i < 10; i++) {
                memory.set(`filler${i}`, 'value', { importance: 0.5 });
            }

            // high 因为重要性高且有访问记录应该被保留
            expect(memory.has('high')).toBe(true);
            // low 应该被淘汰
            expect(memory.has('low')).toBe(false);
        });
    });

    describe('TTL 和过期', () => {
        it('should expire items after TTL', async () => {
            memory.set('key1', 'value1', { expiresAt: Date.now() + 100 });
            expect(memory.has('key1')).toBe(true);

            await new Promise(resolve => setTimeout(resolve, 150));
            expect(memory.has('key1')).toBe(false);
        });

        it('should cleanup expired items', async () => {
            memory.set('key1', 'value1', { expiresAt: Date.now() + 50 });
            memory.set('key2', 'value2', { expiresAt: Date.now() + 1000 });

            await new Promise(resolve => setTimeout(resolve, 100));
            const removed = memory.cleanup();

            expect(removed).toBe(1);
            expect(memory.has('key1')).toBe(false);
            expect(memory.has('key2')).toBe(true);
        });
    });

    describe('查询功能', () => {
        beforeEach(() => {
            memory.set('item1', { data: 'data1' }, { importance: 0.8, tags: ['tag1'] });
            memory.set('item2', { data: 'data2' }, { importance: 0.5, tags: ['tag2'] });
            memory.set('item3', { data: 'data3' }, { importance: 0.3, tags: ['tag1', 'tag2'] });
        });

        it('should query by importance', () => {
            const results = memory.query({ minImportance: 0.6 });
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('item1');
        });

        it('should query by tags', () => {
            const results = memory.query({ tags: ['tag1'] });
            expect(results.length).toBe(2);
        });

        it('should sort by importance descending', () => {
            const results = memory.query({ sortBy: 'importance', sortOrder: 'desc' });
            expect(results[0].metadata.importance).toBeGreaterThanOrEqual(results[1].metadata.importance);
        });

        it('should limit results', () => {
            const results = memory.query({ limit: 2 });
            expect(results.length).toBe(2);
        });
    });

    describe('访问统计', () => {
        it('should track access count', () => {
            memory.set('key1', 'value1');
            memory.get('key1');
            memory.get('key1');
            memory.get('key1');

            const items = memory.getAll();
            const item = items.get('key1');
            expect(item?.metadata.accessCount).toBe(3);
        });

        it('should update last accessed time', () => {
            memory.set('key1', 'value1');
            const before = Date.now();
            memory.get('key1');
            const after = Date.now();

            const items = memory.getAll();
            const item = items.get('key1');
            expect(item?.metadata.lastAccessedAt).toBeGreaterThanOrEqual(before);
            expect(item?.metadata.lastAccessedAt).toBeLessThanOrEqual(after);
        });
    });
});

// ============================================================================
// 长期记忆测试
// ============================================================================

describe('LongTermMemoryStore', () => {
    let memory: LongTermMemoryStore;
    let adapter: InMemoryPersistenceAdapter;

    beforeEach(() => {
        adapter = new InMemoryPersistenceAdapter();
        memory = new LongTermMemoryStore(adapter);
    });

    describe('基本操作', () => {
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

    describe('元数据', () => {
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

    describe('查询', () => {
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

    describe('更新', () => {
        it('should update memory content', async () => {
            const id = await memory.add('Original content');
            await memory.update(id, { content: 'Updated content' });

            const item = await memory.get(id);
            expect(item?.content).toBe('Updated content');
        });

        it('should throw on non-existent id', async () => {
            await expect(memory.update('non-existent', { content: 'test' }))
                .rejects.toThrow();
        });
    });

    describe('整理', () => {
        it('should remove low-value memories', async () => {
            await memory.add('Low value', { importance: 0.1 });
            await memory.add('High value', { importance: 0.9 });

            await memory.consolidate();

            expect(await memory.count()).toBe(1);
        });
    });
});

// ============================================================================
// 记忆管理器测试
// ============================================================================

describe('MemoryManagerImpl', () => {
    let manager: MemoryManagerImpl;

    beforeEach(() => {
        manager = createMemoryManager({
            shortTermMaxSize: 10,
            autoConsolidate: false,
        }) as MemoryManagerImpl;
    });

    describe('remember/recall', () => {
        it('should remember to short-term by default', () => {
            const id = manager.remember('Test data', { importance: 0.5 });
            expect(typeof id).toBe('string');
            expect(id).toMatch(/^stm_/);
        });

        it('should remember to long-term when specified', async () => {
            const id = await manager.remember('Test data', { longTerm: true });
            expect(id).toMatch(/^ltm_/);
        });

        it('should remember to long-term for high importance', async () => {
            const id = await manager.remember('Important data', { importance: 0.9 });
            expect(id).toMatch(/^ltm_/);
        });

        it('should recall from memories', async () => {
            manager.remember('Short term data', { tags: ['test'] });
            await manager.remember('Long term data', { longTerm: true, tags: ['test'] });

            const results = await manager.recall({ tags: ['test'] });
            expect(results.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('promoteToLongTerm', () => {
        it('should promote short-term to long-term', async () => {
            const shortId = manager.remember('Data to promote') as string;
            const longId = await manager.promoteToLongTerm(shortId);

            expect(longId).not.toBeNull();
            expect(manager.shortTerm.has(shortId)).toBe(false);
        });

        it('should return null for non-existent key', async () => {
            const result = await manager.promoteToLongTerm('non-existent');
            expect(result).toBeNull();
        });
    });

    describe('getStats', () => {
        it('should return memory statistics', () => {
            manager.remember('Data 1');
            manager.remember('Data 2');

            const stats = manager.getStats();
            expect(stats.shortTerm.size).toBe(2);
        });
    });

    describe('cleanup', () => {
        it('should cleanup expired items', async () => {
            manager.shortTerm.set('temp', 'data', { expiresAt: Date.now() - 1000 });
            await manager.cleanup();

            expect(manager.shortTerm.has('temp')).toBe(false);
        });
    });

    describe('consolidate', () => {
        it('should promote high-value short-term memories', async () => {
            const key = manager.remember('Valuable data', { importance: 0.9 }) as string;

            // 多次访问增加价值
            manager.shortTerm.get(key);
            manager.shortTerm.get(key);
            manager.shortTerm.get(key);

            await manager.consolidate();

            // 应该被提升到长期记忆
            expect(manager.shortTerm.has(key)).toBe(false);
        });
    });
});

// ============================================================================
// 嵌入生成器测试
// ============================================================================

describe('SimpleTFIDFEmbedding', () => {
    let embedding: SimpleTFIDFEmbedding;

    beforeEach(() => {
        embedding = new SimpleTFIDFEmbedding(128);
    });

    describe('generateEmbedding', () => {
        it('should generate embedding vector', async () => {
            const vector = await embedding.generateEmbedding('Hello world');
            expect(vector).toHaveLength(128);
            expect(vector.every(v => typeof v === 'number')).toBe(true);
        });

        it('should generate normalized vectors', async () => {
            const vector = await embedding.generateEmbedding('Test text');
            const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
            expect(norm).toBeCloseTo(1, 5);
        });

        it('should generate different vectors for different text', async () => {
            const vec1 = await embedding.generateEmbedding('Hello world');
            const vec2 = await embedding.generateEmbedding('Goodbye world');

            expect(vec1).not.toEqual(vec2);
        });
    });

    describe('calculateSimilarity', () => {
        it('should calculate similarity between vectors', async () => {
            const vec1 = await embedding.generateEmbedding('machine learning');
            const vec2 = await embedding.generateEmbedding('deep learning');
            const vec3 = await embedding.generateEmbedding('cooking recipe');

            const sim12 = embedding.calculateSimilarity(vec1, vec2);
            const sim13 = embedding.calculateSimilarity(vec1, vec3);

            expect(sim12).toBeGreaterThan(sim13);
        });

        it('should return 1 for identical vectors', () => {
            const vec = [1, 0, 0, 0];
            expect(embedding.calculateSimilarity(vec, vec)).toBe(1);
        });

        it('should return 0 for orthogonal vectors', () => {
            const vec1 = [1, 0, 0, 0];
            const vec2 = [0, 1, 0, 0];
            expect(embedding.calculateSimilarity(vec1, vec2)).toBe(0);
        });
    });

    describe('batch generation', () => {
        it('should generate embeddings for multiple texts', async () => {
            const texts = ['text 1', 'text 2', 'text 3'];
            const vectors = await embedding.generateEmbeddings(texts);

            expect(vectors).toHaveLength(3);
            expect(vectors.every(v => v.length === 128)).toBe(true);
        });
    });
});

describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
        const vec1 = [1, 0, 0];
        const vec2 = [1, 0, 0];
        expect(cosineSimilarity(vec1, vec2)).toBe(1);
    });

    it('should handle zero vectors', () => {
        const vec1 = [0, 0, 0];
        const vec2 = [1, 2, 3];
        expect(cosineSimilarity(vec1, vec2)).toBe(0);
    });

    it('should throw on mismatched dimensions', () => {
        const vec1 = [1, 2];
        const vec2 = [1, 2, 3];
        expect(() => cosineSimilarity(vec1, vec2)).toThrow();
    });
});
