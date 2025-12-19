/**
 * IndexedDB 持久化适配器
 * 实现 Checkpoint 的保存、加载、列表、删除
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Checkpoint, PersistenceAdapter } from '../core/types';

const DB_NAME = 'agent-workflow-db';
const DB_VERSION = 1;
const CHECKPOINT_STORE = 'checkpoints';

export class IndexedDBAdapter implements PersistenceAdapter {
    private db: IDBPDatabase | null = null;

    /**
     * 初始化数据库
     */
    async init(): Promise<void> {
        this.db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // 创建 checkpoint 存储
                if (!db.objectStoreNames.contains(CHECKPOINT_STORE)) {
                    const store = db.createObjectStore(CHECKPOINT_STORE, { keyPath: 'id' });
                    store.createIndex('stateId', 'stateId', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            },
        });
    }

    /**
     * 保存 checkpoint
     */
    async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
        await this.ensureDB();
        await this.db!.put(CHECKPOINT_STORE, checkpoint);
    }

    /**
     * 加载 checkpoint
     */
    async loadCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
        await this.ensureDB();
        const checkpoint = await this.db!.get(CHECKPOINT_STORE, checkpointId);
        return checkpoint || null;
    }

    /**
     * 列出某个 State 的所有 checkpoints（按时间倒序）
     */
    async listCheckpoints(stateId: string): Promise<Checkpoint[]> {
        await this.ensureDB();
        const tx = this.db!.transaction(CHECKPOINT_STORE, 'readonly');
        const index = tx.store.index('stateId');
        const checkpoints = await index.getAll(stateId);

        // 按时间倒序排序
        return checkpoints.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * 删除 checkpoint
     */
    async deleteCheckpoint(checkpointId: string): Promise<void> {
        await this.ensureDB();
        await this.db!.delete(CHECKPOINT_STORE, checkpointId);
    }

    /**
     * 获取最新的 checkpoint
     */
    async getLatestCheckpoint(stateId: string): Promise<Checkpoint | null> {
        const checkpoints = await this.listCheckpoints(stateId);
        return checkpoints[0] || null;
    }

    /**
     * 清空所有 checkpoints
     */
    async clear(): Promise<void> {
        await this.ensureDB();
        await this.db!.clear(CHECKPOINT_STORE);
    }

    private async ensureDB(): Promise<void> {
        if (!this.db) {
            await this.init();
        }
    }
}
