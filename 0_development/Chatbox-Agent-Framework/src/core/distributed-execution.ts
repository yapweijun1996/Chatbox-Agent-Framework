/**
 * Distributed execution primitives.
 */

import type { AgentResult, ChatOptions } from './agent';
import type { AgentClient } from './multi-agent';
import type { Checkpoint, PersistenceAdapter } from './types';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DistributedTask {
    id: string;
    message: string;
    agentId?: string;
    options?: ChatOptions;
    status?: TaskStatus;
    createdAt: number;
    updatedAt?: number;
}

export interface DistributedTaskResult {
    taskId: string;
    agentId: string;
    result?: AgentResult;
    error?: string;
    completedAt: number;
}

export interface TaskQueue {
    enqueue(task: DistributedTask): Promise<void>;
    claim(): Promise<DistributedTask | null>;
    complete(taskId: string, result: DistributedTaskResult): Promise<void>;
    fail(taskId: string, error: string): Promise<void>;
    getResult?(taskId: string): Promise<DistributedTaskResult | null>;
    listResults?(): Promise<DistributedTaskResult[]>;
}

export interface TaskQueueStore {
    save(task: DistributedTask): Promise<void>;
    load(taskId: string): Promise<DistributedTask | null>;
    listByStatus(status: TaskStatus): Promise<DistributedTask[]>;
    saveResult(result: DistributedTaskResult): Promise<void>;
    getResult(taskId: string): Promise<DistributedTaskResult | null>;
    listResults(): Promise<DistributedTaskResult[]>;
}

export interface TaskQueueFactory {
    create(): TaskQueue;
}

export type DistributedCheckpointStore = PersistenceAdapter;

export class InMemoryTaskQueue implements TaskQueue {
    private tasks: Map<string, DistributedTask> = new Map();
    private results: Map<string, DistributedTaskResult> = new Map();

    async enqueue(task: DistributedTask): Promise<void> {
        this.tasks.set(task.id, { ...task, status: 'pending' });
    }

    async claim(): Promise<DistributedTask | null> {
        for (const task of this.tasks.values()) {
            if (task.status === 'pending') {
                task.status = 'running';
                task.updatedAt = Date.now();
                return { ...task };
            }
        }
        return null;
    }

    async complete(taskId: string, result: DistributedTaskResult): Promise<void> {
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'completed';
            task.updatedAt = Date.now();
        }
        this.results.set(taskId, result);
    }

    async fail(taskId: string, error: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'failed';
            task.updatedAt = Date.now();
        }
        this.results.set(taskId, {
            taskId,
            agentId: task?.agentId || 'unknown',
            error,
            completedAt: Date.now(),
        });
    }
}

export class InMemoryTaskQueueStore implements TaskQueueStore {
    private tasks: Map<string, DistributedTask> = new Map();
    private results: Map<string, DistributedTaskResult> = new Map();

    async save(task: DistributedTask): Promise<void> {
        this.tasks.set(task.id, { ...task });
    }

    async load(taskId: string): Promise<DistributedTask | null> {
        return this.tasks.get(taskId) || null;
    }

    async listByStatus(status: TaskStatus): Promise<DistributedTask[]> {
        return Array.from(this.tasks.values()).filter(task => task.status === status);
    }

    async saveResult(result: DistributedTaskResult): Promise<void> {
        this.results.set(result.taskId, result);
    }

    async getResult(taskId: string): Promise<DistributedTaskResult | null> {
        return this.results.get(taskId) || null;
    }

    async listResults(): Promise<DistributedTaskResult[]> {
        return Array.from(this.results.values());
    }
}

export class PersistentTaskQueue implements TaskQueue {
    constructor(private readonly store: TaskQueueStore) {}

    async enqueue(task: DistributedTask): Promise<void> {
        await this.store.save({ ...task, status: 'pending' });
    }

    async claim(): Promise<DistributedTask | null> {
        const pending = await this.store.listByStatus('pending');
        if (!pending.length) return null;
        const task = pending[0];
        const running = { ...task, status: 'running', updatedAt: Date.now() };
        await this.store.save(running);
        return running;
    }

    async complete(taskId: string, result: DistributedTaskResult): Promise<void> {
        const task = await this.store.load(taskId);
        if (task) {
            await this.store.save({ ...task, status: 'completed', updatedAt: Date.now() });
        }
        await this.store.saveResult(result);
    }

    async fail(taskId: string, error: string): Promise<void> {
        const task = await this.store.load(taskId);
        if (task) {
            await this.store.save({ ...task, status: 'failed', updatedAt: Date.now() });
        }
        await this.store.saveResult({
            taskId,
            agentId: task?.agentId || 'unknown',
            error,
            completedAt: Date.now(),
        });
    }

    async getResult(taskId: string): Promise<DistributedTaskResult | null> {
        return this.store.getResult(taskId);
    }

    async listResults(): Promise<DistributedTaskResult[]> {
        return this.store.listResults();
    }
}

export class PersistentTaskQueueFactory implements TaskQueueFactory {
    constructor(private readonly store: TaskQueueStore) {}

    create(): TaskQueue {
        return new PersistentTaskQueue(this.store);
    }
}

export class InMemoryCheckpointStore implements PersistenceAdapter {
    private checkpoints: Map<string, Checkpoint> = new Map();

    async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
        this.checkpoints.set(checkpoint.id, checkpoint);
    }

    async loadCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
        return this.checkpoints.get(checkpointId) || null;
    }

    async listCheckpoints(stateId: string): Promise<Checkpoint[]> {
        return Array.from(this.checkpoints.values()).filter(cp => cp.stateId === stateId);
    }

    async deleteCheckpoint(checkpointId: string): Promise<void> {
        this.checkpoints.delete(checkpointId);
    }
}

export class PersistenceCheckpointStore implements PersistenceAdapter {
    constructor(private readonly adapter: PersistenceAdapter) {}

    async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
        await this.adapter.saveCheckpoint(checkpoint);
    }

    async loadCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
        return this.adapter.loadCheckpoint(checkpointId);
    }

    async listCheckpoints(stateId: string): Promise<Checkpoint[]> {
        return this.adapter.listCheckpoints(stateId);
    }

    async deleteCheckpoint(checkpointId: string): Promise<void> {
        return this.adapter.deleteCheckpoint(checkpointId);
    }
}

export class DistributedExecutor {
    constructor(
        private readonly queue: TaskQueue,
        private readonly agents: Map<string, AgentClient>,
        private readonly checkpointStore?: DistributedCheckpointStore
    ) {}

    async runNext(): Promise<DistributedTaskResult | null> {
        const task = await this.queue.claim();
        if (!task) return null;

        const agentId = task.agentId || this.pickAgentId();
        const agent = this.agents.get(agentId);
        if (!agent) {
            await this.queue.fail(task.id, 'Agent not found');
            return {
                taskId: task.id,
                agentId,
                error: 'Agent not found',
                completedAt: Date.now(),
            };
        }

        try {
            const result = await agent.chat(task.message, task.options);
            const record: DistributedTaskResult = {
                taskId: task.id,
                agentId,
                result,
                completedAt: Date.now(),
            };
            await this.queue.complete(task.id, record);
            return record;
        } catch (error) {
            const message = String(error);
            await this.queue.fail(task.id, message);
            return {
                taskId: task.id,
                agentId,
                error: message,
                completedAt: Date.now(),
            };
        }
    }

    getCheckpointStore(): PersistenceAdapter | undefined {
        return this.checkpointStore;
    }

    private pickAgentId(): string {
        const first = this.agents.keys().next();
        if (first.done) {
            throw new Error('No agents available for distributed executor.');
        }
        return first.value;
    }
}

export class DistributedWorkerPool {
    private running = false;
    private workers: Array<Promise<void>> = [];
    private stats = { processed: 0, failed: 0 };

    constructor(
        private readonly executor: DistributedExecutor,
        private readonly concurrency: number = 2,
        private readonly pollIntervalMs: number = 50
    ) {}

    start(): void {
        if (this.running) return;
        this.running = true;
        for (let i = 0; i < this.concurrency; i += 1) {
            this.workers.push(this.runLoop());
        }
    }

    async stop(): Promise<void> {
        this.running = false;
        await Promise.all(this.workers);
        this.workers = [];
    }

    getStats(): { processed: number; failed: number } {
        return { ...this.stats };
    }

    private async runLoop(): Promise<void> {
        while (this.running) {
            const result = await this.executor.runNext();
            if (!result) {
                await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
                continue;
            }
            this.stats.processed += 1;
            if (result.error) {
                this.stats.failed += 1;
            }
        }
    }
}
