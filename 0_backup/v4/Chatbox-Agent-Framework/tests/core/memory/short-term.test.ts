/**
 * Short-term memory tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShortTermMemoryStore } from '../../../src/core/memory/short-term';

// ============================================================================
// Short-term memory tests
// ============================================================================

describe('ShortTermMemoryStore', () => {
    let memory: ShortTermMemoryStore;

    beforeEach(() => {
        memory = new ShortTermMemoryStore({ maxSize: 10, defaultTTL: 1000 });
    });

    describe('basic operations', () => {
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

    describe('capacity management', () => {
        it('should respect max size', () => {
            for (let i = 0; i < 15; i++) {
                memory.set(`key${i}`, `value${i}`, { importance: i / 15 });
            }
            expect(memory.size()).toBeLessThanOrEqual(10);
        });

        it('should evict least important items', () => {
            memory.set('low', 'value', { importance: 0.1 });
            memory.set('high', 'value', { importance: 0.9 });

            // Access high to increase its score
            memory.get('high');
            memory.get('high');

            for (let i = 0; i < 10; i++) {
                memory.set(`filler${i}`, 'value', { importance: 0.5 });
            }

            expect(memory.has('high')).toBe(true);
            expect(memory.has('low')).toBe(false);
        });
    });

    describe('ttl and expiration', () => {
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

    describe('query', () => {
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

    describe('access stats', () => {
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
