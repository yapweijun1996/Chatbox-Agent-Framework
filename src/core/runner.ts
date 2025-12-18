/**
 * Graph Runner 执行器
 * 负责执行流程图、管理状态、处理错误、生成 checkpoint
 */

import type {
    State,
    GraphDefinition,
    Node,
    NodeResult,
    Checkpoint,
    RunnerHooks,
    PersistenceAdapter,
} from './types';
import { EventStream } from './event-stream';
import { StateHelpers } from './state';
import { createError, getErrorStrategy, getBackoffDelay } from './error-handler';
import { ErrorType } from './types';

export class GraphRunner {
    private eventStream: EventStream;
    private checkpointInterval: number; // 每 N 个节点保存一次 checkpoint

    constructor(
        private graph: GraphDefinition,
        private persistence?: PersistenceAdapter,
        private hooks?: RunnerHooks,
        options?: {
            checkpointInterval?: number;
        }
    ) {
        this.eventStream = new EventStream();
        this.checkpointInterval = options?.checkpointInterval ?? 1; // 默认每个节点都保存
    }

    /**
     * 执行流程
     */
    async execute(initialState: State): Promise<{ state: State; events: EventStream }> {
        let currentState = initialState;
        let currentNodeId = this.graph.entryNode;
        let stepCount = 0;

        try {
            while (currentNodeId && stepCount < this.graph.maxSteps) {
                // 检查预算
                const budgetCheck = StateHelpers.checkBudget(currentState);
                if (budgetCheck.exceeded) {
                    this.eventStream.emit('budget_exceeded', 'failure', budgetCheck.reason!);
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
                const result = await this.executeNode(node, currentState);
                currentState = result.state;

                // 合并事件
                result.events.forEach(event => {
                    this.eventStream.emit(
                        event.type,
                        event.status,
                        event.summary,
                        {
                            nodeId: event.nodeId,
                            payload: event.payloadRef ? this.eventStream.getPayload(event.payloadRef) : undefined,
                            metadata: event.metadata,
                        }
                    );
                });

                // 保存 checkpoint
                if (stepCount % this.checkpointInterval === 0) {
                    await this.saveCheckpoint(currentState);
                }

                // 决定下一个节点
                const nextNode = this.getNextNode(currentNodeId, currentState, result.nextNode);
                if (!nextNode) break;
                currentNodeId = nextNode;
                stepCount++;
            }

            // 检查是否达到最大步数
            if (stepCount >= this.graph.maxSteps) {
                this.eventStream.emit(
                    'budget_exceeded',
                    'warning',
                    `已达到最大步数限制 (${this.graph.maxSteps})`
                );
            }

            return { state: currentState, events: this.eventStream };
        } catch (error) {
            const agentError = createError(
                ErrorType.EXECUTION,
                String(error),
                { originalError: error instanceof Error ? error : undefined }
            );
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
    async resume(checkpointId: string): Promise<{ state: State; events: EventStream }> {
        if (!this.persistence) {
            throw new Error('未配置持久化适配器，无法恢复');
        }

        const checkpoint = await this.persistence.loadCheckpoint(checkpointId);
        if (!checkpoint) {
            throw new Error(`Checkpoint "${checkpointId}" 不存在`);
        }

        this.eventStream.emit('checkpoint', 'info', `从 checkpoint ${checkpointId} 恢复`);

        return this.execute(checkpoint.state);
    }

    /**
     * 获取事件流
     */
    getEventStream(): EventStream {
        return this.eventStream;
    }

    /**
     * 执行单个节点（带错误处理与重试）
     */
    private async executeNode(node: Node, state: State): Promise<NodeResult> {
        await this.hooks?.onNodeStart?.(node.id, state);

        this.eventStream.emit('node_start', 'info', `开始执行节点: ${node.name}`, {
            nodeId: node.id,
        });

        let retryCount = 0;
        let lastError: Error | undefined;

        // 创建节点执行上下文
        const context = {
            emitEvent: (type: any, status: any, summary: string, payload?: unknown) => {
                this.eventStream.emit(type, status, summary, {
                    nodeId: node.id,
                    payload,
                });
            }
        };

        while (retryCount <= state.policy.maxRetries) {
            try {
                const startTime = Date.now();
                const result = await node.execute(state, context);
                const duration = Date.now() - startTime;

                // 记录节点耗时
                result.state = StateHelpers.recordNodeTiming(result.state, node.id, duration);

                await this.hooks?.onNodeEnd?.(node.id, result);

                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                const agentError = createError(
                    ErrorType.EXECUTION,
                    lastError.message,
                    {
                        nodeId: node.id,
                        retryable: true,
                        originalError: lastError,
                    }
                );
                const strategy = getErrorStrategy(agentError, retryCount, state.policy.maxRetries);

                if (strategy.shouldRetry) {
                    retryCount++;
                    const delay = getBackoffDelay(retryCount - 1);

                    this.eventStream.emit('retry', 'warning', strategy.suggestion || '重试中...', {
                        nodeId: node.id,
                        metadata: { retryCount, delay },
                    });

                    state = StateHelpers.incrementRetry(state);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // 不再重试
                    state = StateHelpers.incrementError(state);
                    throw lastError;
                }
            }
        }

        throw lastError;
    }

    /**
     * 获取下一个节点
     */
    private getNextNode(currentNodeId: string, state: State, explicitNext?: string): string | null {
        // 如果节点显式指定了下一个节点，使用它
        if (explicitNext) {
            return explicitNext;
        }

        // 查找匹配的边
        const edges = this.graph.edges.filter(e => e.from === currentNodeId);

        for (const edge of edges) {
            // 如果有条件，检查条件
            if (edge.condition) {
                if (edge.condition(state)) {
                    return edge.to;
                }
            } else {
                // 无条件边，直接返回
                return edge.to;
            }
        }

        // 没有匹配的边，流程结束
        return null;
    }

    /**
     * 保存 checkpoint
     */
    private async saveCheckpoint(state: State): Promise<void> {
        if (!this.persistence) return;

        const checkpoint: Checkpoint = {
            id: `checkpoint-${Date.now()}`,
            stateId: state.id,
            state,
            eventIndex: this.eventStream.getEvents().length,
            timestamp: Date.now(),
        };

        await this.persistence.saveCheckpoint(checkpoint);

        this.eventStream.emit('checkpoint', 'success', `已保存 checkpoint ${checkpoint.id}`, {
            metadata: { checkpointId: checkpoint.id },
        });

        await this.hooks?.onCheckpoint?.(checkpoint);
    }
}
