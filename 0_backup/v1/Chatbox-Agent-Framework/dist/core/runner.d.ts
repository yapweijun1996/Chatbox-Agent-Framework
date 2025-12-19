/**
 * Graph Runner 执行器
 * 负责执行流程图、管理状态、处理错误、生成 checkpoint
 */
import type { State, GraphDefinition, RunnerHooks, PersistenceAdapter } from './types';
import { EventStream } from './event-stream';
export declare class GraphRunner {
    private graph;
    private persistence?;
    private hooks?;
    private eventStream;
    private checkpointInterval;
    constructor(graph: GraphDefinition, persistence?: PersistenceAdapter | undefined, hooks?: RunnerHooks | undefined, options?: {
        checkpointInterval?: number;
    });
    /**
     * 执行流程
     */
    execute(initialState: State): Promise<{
        state: State;
        events: EventStream;
    }>;
    /**
     * 从 checkpoint 恢复执行
     */
    resume(checkpointId: string): Promise<{
        state: State;
        events: EventStream;
    }>;
    /**
     * 获取事件流
     */
    getEventStream(): EventStream;
    /**
     * 执行单个节点（带错误处理与重试）
     */
    private executeNode;
    /**
     * 获取下一个节点
     */
    private getNextNode;
    /**
     * 保存 checkpoint
     */
    private saveCheckpoint;
}
//# sourceMappingURL=runner.d.ts.map