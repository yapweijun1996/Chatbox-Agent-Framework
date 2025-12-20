import { openDB, type IDBPDatabase } from 'idb';
import type { DistributedTask, DistributedTaskResult, TaskQueueStore } from '../distributed-execution';
import { PersistentTaskQueue } from '../distributed-execution';

const DB_NAME = 'agent-task-queue-db';
const DB_VERSION = 1;
const TASK_STORE = 'tasks';
const RESULT_STORE = 'task_results';

export class IndexedDBTaskQueueStore implements TaskQueueStore {
    private db: IDBPDatabase | null = null;

    async init(): Promise<void> {
        if (typeof indexedDB === 'undefined') {
            throw new Error('IndexedDB is not available in this environment.');
        }

        this.db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(TASK_STORE)) {
                    const store = db.createObjectStore(TASK_STORE, { keyPath: 'id' });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                if (!db.objectStoreNames.contains(RESULT_STORE)) {
                    db.createObjectStore(RESULT_STORE, { keyPath: 'taskId' });
                }
            },
        });
    }

    async save(task: DistributedTask): Promise<void> {
        await this.ensureDB();
        await this.db!.put(TASK_STORE, task);
    }

    async load(taskId: string): Promise<DistributedTask | null> {
        await this.ensureDB();
        const task = await this.db!.get(TASK_STORE, taskId);
        return (task as DistributedTask) || null;
    }

    async listByStatus(status: DistributedTask['status']): Promise<DistributedTask[]> {
        await this.ensureDB();
        const tasks = await this.db!.getAllFromIndex(TASK_STORE, 'status', status);
        return tasks as DistributedTask[];
    }

    async saveResult(result: DistributedTaskResult): Promise<void> {
        await this.ensureDB();
        await this.db!.put(RESULT_STORE, result);
    }

    async getResult(taskId: string): Promise<DistributedTaskResult | null> {
        await this.ensureDB();
        const result = await this.db!.get(RESULT_STORE, taskId);
        return (result as DistributedTaskResult) || null;
    }

    async listResults(): Promise<DistributedTaskResult[]> {
        await this.ensureDB();
        const results = await this.db!.getAll(RESULT_STORE);
        return results as DistributedTaskResult[];
    }

    async clear(): Promise<void> {
        await this.ensureDB();
        await this.db!.clear(TASK_STORE);
        await this.db!.clear(RESULT_STORE);
    }

    static createQueue(): PersistentTaskQueue {
        return new PersistentTaskQueue(new IndexedDBTaskQueueStore());
    }

    private async ensureDB(): Promise<void> {
        if (!this.db) {
            await this.init();
        }
    }
}
