/**
 * Memory manager tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryManagerImpl, createMemoryManager } from '../../../src/core/memory/manager';

// ============================================================================
// Memory manager tests
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
        it('should remember to short-term by default', async () => {
            const id = await manager.remember('Test data', { importance: 0.5 });
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
            await manager.remember('Short term data', { tags: ['test'] });
            await manager.remember('Long term data', { longTerm: true, tags: ['test'] });

            const results = await manager.recall({ tags: ['test'] });
            expect(results.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('promoteToLongTerm', () => {
        it('should promote short-term to long-term', async () => {
            const shortId = await manager.remember('Data to promote');
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
        it('should return memory statistics', async () => {
            await manager.remember('Data 1');
            await manager.remember('Data 2');

            const stats = await manager.getStats();
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
            const key = await manager.remember('Valuable data', { importance: 0.9 });

            manager.shortTerm.get(key);
            manager.shortTerm.get(key);
            manager.shortTerm.get(key);

            await manager.consolidate();

            expect(manager.shortTerm.has(key)).toBe(false);
        });
    });
});
