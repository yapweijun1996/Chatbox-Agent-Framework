/**
 * Graph Runner 执行器
 * 负责执行流程图、管理状态、处理错误、生成 checkpoint
 */
import { EventStream } from './event-stream';
import { StateHelpers } from './state';
import { createError } from './error-handler';
import { ErrorType } from './types';
import { NodeExecutor } from './runner/node-executor';
import { resolveNextNode } from './runner/next-node-resolver';
import { CheckpointManager } from './runner/checkpoint-manager';
export class GraphRunner {
    graph;
    persistence;
    hooks;
    eventStream;
    checkpointInterval; // 每 N 个节点保存一次 checkpoint
    nodeExecutor;
    checkpointManager;
    constructor(graph, persistence, hooks, options) {
        this.graph = graph;
        this.persistence = persistence;
        this.hooks = hooks;
        this.eventStream = new EventStream();
        this.checkpointInterval = options?.checkpointInterval ?? 1; // 默认每个节点都保存
        this.nodeExecutor = new NodeExecutor({
            eventStream: this.eventStream,
            hooks: this.hooks,
        });
        this.checkpointManager = new CheckpointManager(this.persistence, this.eventStream, this.hooks);
    }
    /**
     * 执行流程
     */
    async execute(initialState) {
        let currentState = initialState;
        let currentNodeId = this.graph.entryNode;
        let stepCount = 0;
        try {
            while (currentNodeId && stepCount < this.graph.maxSteps) {
                // 检查预算
                const budgetCheck = StateHelpers.checkBudget(currentState);
                if (budgetCheck.exceeded) {
                    this.eventStream.emit('budget_exceeded', 'failure', budgetCheck.reason);
                    await this.hooks?.onBudgetWarning?.('budget', 0, 0);
                    break;
                }
                // 查找节点
                const node = this.graph.nodes.find(n => n.id === currentNodeId);
                if (!node) {
                    throw new Error(`节点 "${currentNodeId}" 不存在`);
                }
                // 更新当前节点
                currentState = StateHelpers.setCurrentNode(currentState, currentNodeId);
                // 执行节点
                const result = await this.nodeExecutor.run(node, currentState);
                currentState = result.state;
                // 合并事件
                result.events.forEach(event => {
                    this.eventStream.emit(event.type, event.status, event.summary, {
                        nodeId: event.nodeId,
                        payload: event.payloadRef ? this.eventStream.getPayload(event.payloadRef) : undefined,
                        metadata: event.metadata,
                    });
                });
                // 保存 checkpoint
                if (stepCount % this.checkpointInterval === 0) {
                    await this.checkpointManager.save(currentState);
                }
                // 决定下一个节点
                const nextNode = resolveNextNode(this.graph, currentNodeId, currentState, result.nextNode);
                if (!nextNode)
                    break;
                currentNodeId = nextNode;
                stepCount++;
            }
            // 检查是否达到最大步数
            if (stepCount >= this.graph.maxSteps) {
                this.eventStream.emit('budget_exceeded', 'warning', `已达到最大步数限制 (${this.graph.maxSteps})`);
            }
            return { state: currentState, events: this.eventStream };
        }
        catch (error) {
            const agentError = createError(ErrorType.EXECUTION, String(error), { originalError: error instanceof Error ? error : undefined });
            this.eventStream.emit('error', 'failure', agentError.message, {
                payload: agentError,
            });
            await this.hooks?.onError?.(agentError);
            throw error;
        }
    }
    /**
     * 从 checkpoint 恢复执行
     */
    async resume(checkpointId) {
        const checkpoint = await this.checkpointManager.load(checkpointId);
        this.eventStream.emit('checkpoint', 'info', `从 checkpoint ${checkpointId} 恢复`);
        return this.execute(checkpoint.state);
    }
    /**
     * 获取事件流
     */
    getEventStream() {
        return this.eventStream;
    }
}
//# sourceMappingURL=runner.js.map