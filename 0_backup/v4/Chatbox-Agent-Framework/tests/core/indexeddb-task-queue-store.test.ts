import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDBTaskQueueStore } from '../../src/core/persistence/indexeddb-task-queue-store';
import { PersistentTaskQueueFactory } from '../../src/core/distributed-execution';

describe('IndexedDBTaskQueueStore', () => {
    let store: IndexedDBTaskQueueStore;

    beforeEach(async () => {
        store = new IndexedDBTaskQueueStore();
        await store.clear();
    });

    it('should save and load tasks', async () => {
        await store.save({
            id: 'task-1',
            message: 'work',
            agentId: 'alpha',
            status: 'pending',
            createdAt: Date.now(),
        });

        const loaded = await store.load('task-1');
        expect(loaded?.message).toBe('work');
    });

    it('should list tasks by status', async () => {
        await store.save({
            id: 'task-1',
            message: 'work',
            status: 'pending',
            createdAt: Date.now(),
        });
        await store.save({
            id: 'task-2',
            message: 'run',
            status: 'running',
            createdAt: Date.now(),
        });

        const pending = await store.listByStatus('pending');
        expect(pending).toHaveLength(1);
        expect(pending[0].id).toBe('task-1');
    });

    it('should build queue via factory', async () => {
        const factory = new PersistentTaskQueueFactory(new IndexedDBTaskQueueStore());
        const queue = factory.create();

        await queue.enqueue({
            id: 'task-1',
            message: 'work',
            status: 'pending',
            createdAt: Date.now(),
        });

        const claimed = await queue.claim();
        expect(claimed?.id).toBe('task-1');
    });

    it('should store and fetch results', async () => {
        await store.saveResult({
            taskId: 'task-1',
            agentId: 'alpha',
            completedAt: Date.now(),
            result: { content: 'ok', mode: 'chat', duration: 1 },
        });

        const result = await store.getResult('task-1');
        expect(result?.agentId).toBe('alpha');
    });
});
