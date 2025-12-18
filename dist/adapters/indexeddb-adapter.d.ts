/**
 * IndexedDB 持久化适配器
 * 实现 Checkpoint 的保存、加载、列表、删除
 */
import type { Checkpoint, PersistenceAdapter } from '../core/types';
export declare class IndexedDBAdapter implements PersistenceAdapter {
    private db;
    /**
     * 初始化数据库
     */
    init(): Promise<void>;
    /**
     * 保存 checkpoint
     */
    saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
    /**
     * 加载 checkpoint
     */
    loadCheckpoint(checkpointId: string): Promise<Checkpoint | null>;
    /**
     * 列出某个 State 的所有 checkpoints（按时间倒序）
     */
    listCheckpoints(stateId: string): Promise<Checkpoint[]>;
    /**
     * 删除 checkpoint
     */
    deleteCheckpoint(checkpointId: string): Promise<void>;
    /**
     * 获取最新的 checkpoint
     */
    getLatestCheckpoint(stateId: string): Promise<Checkpoint | null>;
    /**
     * 清空所有 checkpoints
     */
    clear(): Promise<void>;
    private ensureDB;
}
//# sourceMappingURL=indexeddb-adapter.d.ts.map