import { describe, it, expect, vi } from 'vitest';
import { DistributedExecutor, DistributedWorkerPool, InMemoryCheckpointStore, InMemoryTaskQueue, InMemoryTaskQueueStore, PersistentTaskQueue } from '../../src/core/distributed-execution';
import { createState } from '../../src/core/state';

const createMockAgent = (content: string) => ({
    chat: vi.fn().mockResolvedValue({
        content,
        mode: 'chat',
        duration: 1,
    }),
});

describe('DistributedExecutor', () => {
    it('should claim tasks and run agents', async () => {
        const queue = new InMemoryTaskQueue();
        const agents = new Map([
            ['alpha', createMockAgent('alpha')],
        ]);
        const executor = new DistributedExecutor(queue, agents);

        await queue.enqueue({
            id: 'task-1',
            message: 'hello',
            agentId: 'alpha',
            createdAt: Date.now(),
        });

        const result = await executor.runNext();

        expect(result?.taskId).toBe('task-1');
        expect(result?.result?.content).toBe('alpha');
    });

    it('should process tasks with worker pool', async () => {
        const queue = new InMemoryTaskQueue();
        const agents = new Map([
            ['alpha', createMockAgent('alpha')],
        ]);
        const executor = new DistributedExecutor(queue, agents);
        const pool = new DistributedWorkerPool(executor, 2, 5);

        await queue.enqueue({ id: 'task-1', message: 'a', agentId: 'alpha', createdAt: Date.now() });
        await queue.enqueue({ id: 'task-2', message: 'b', agentId: 'alpha', createdAt: Date.now() });

        pool.start();
        await new Promise(resolve => setTimeout(resolve, 50));
        await pool.stop();

        const stats = pool.getStats();
        expect(stats.processed).toBeGreaterThanOrEqual(2);
    });

    it('should persist checkpoints via store', async () => {
        const store = new InMemoryCheckpointStore();
        const state = createState('checkpoint');
        const checkpoint = {
            id: 'checkpoint-1',
            stateId: state.id,
            state,
            eventIndex: 0,
            timestamp: Date.now(),
        };

        await store.saveCheckpoint(checkpoint);
        const loaded = await store.loadCheckpoint('checkpoint-1');

        expect(loaded?.id).toBe('checkpoint-1');
    });

    it('should persist tasks with queue store', async () => {
        const store = new InMemoryTaskQueueStore();
        const queue = new PersistentTaskQueue(store);

        await queue.enqueue({
            id: 'task-1',
            message: 'work',
            agentId: 'alpha',
            createdAt: Date.now(),
        });

        const claimed = await queue.claim();
        expect(claimed?.status).toBe('running');

        await queue.complete('task-1', {
            taskId: 'task-1',
            agentId: 'alpha',
            completedAt: Date.now(),
            result: { content: 'ok', mode: 'chat', duration: 1 },
        });
        const result = await queue.getResult?.('task-1');
        expect(result?.agentId).toBe('alpha');
    });
});
