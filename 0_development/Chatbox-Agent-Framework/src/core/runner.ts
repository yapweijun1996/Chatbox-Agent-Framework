/**
 * Graph Runner 执行器
 * 负责执行流程图、管理状态、处理错误、生成 checkpoint
 */

import type {
    State,
    GraphDefinition,
    RunnerHooks,
    PersistenceAdapter,
    NodeResult,
} from './types';
import { EventStream } from './event-stream';
import { StateHelpers } from './state';
import { createError } from './error-handler';
import { ErrorType } from './types';
import { NodeExecutor } from './runner/node-executor';
import { resolveNextNode } from './runner/next-node-resolver';
import { CheckpointManager } from './runner/checkpoint-manager';
import { validateGraphDefinition } from './runner/graph-validator';
import { mergeParallelStates } from './runner/parallel-state-merge';

export class GraphRunner {
    private eventStream: EventStream;
    private checkpointInterval: number; // 每 N 个节点保存一次 checkpoint
    private nodeExecutor: NodeExecutor;
    private checkpointManager: CheckpointManager;
    private hooks?: RunnerHooks;

    constructor(
        private graph: GraphDefinition,
        private persistence?: PersistenceAdapter,
        hooks?: RunnerHooks,
        options?: {
            checkpointInterval?: number;
        }
    ) {
        validateGraphDefinition(this.graph);
        this.eventStream = new EventStream();
        this.checkpointInterval = options?.checkpointInterval ?? 1; // 默认每个节点都保存
        this.hooks = mergeRunnerHooks(this.graph.hooks, hooks);
        this.nodeExecutor = new NodeExecutor({
            eventStream: this.eventStream,
            hooks: this.hooks,
        });
        this.checkpointManager = new CheckpointManager(this.persistence, this.eventStream, this.hooks);
    }

    /**
     * 执行流程
     */
    async execute(initialState: State): Promise<{ state: State; events: EventStream }> {
        let currentState = initialState;
        let currentNodeId = this.graph.entryNode;
        let stepCount = 0;
        const startTime = Date.now();

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
                const result = await this.nodeExecutor.run(node, currentState);
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
                    await this.checkpointManager.save(currentState);
                }

                // 决定下一个节点
                const transition = resolveNextNode(this.graph, currentNodeId, currentState, result.nextNode);
                if (!transition) break;

                if (transition.type === 'parallel') {
                    const { mergedState, results } = await this.executeParallelNodes(
                        transition.nodeIds,
                        currentState
                    );

                    for (const parallelResult of results) {
                        parallelResult.events.forEach(event => {
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
                    }

                    currentState = mergedState;
                    stepCount += transition.nodeIds.length;
                    currentNodeId = transition.join;

                    if (stepCount % this.checkpointInterval === 0) {
                        await this.checkpointManager.save(currentState);
                    }
                } else {
                    currentNodeId = transition.nodeId;
                    stepCount++;
                }
            }

            // 检查是否达到最大步数
            if (stepCount >= this.graph.maxSteps) {
                this.eventStream.emit(
                    'budget_exceeded',
                    'warning',
                    `已达到最大步数限制 (${this.graph.maxSteps})`
                );
            }

            const totalDuration = Date.now() - startTime;
            this.eventStream.emit('health_metrics', 'info', 'Execution health metrics', {
                metadata: {
                    totalDurationMs: totalDuration,
                    tokenCount: currentState.telemetry.tokenCount,
                    toolCallCount: currentState.telemetry.toolCallCount,
                    errorCount: currentState.telemetry.errorCount,
                },
            });

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

    private async executeParallelNodes(
        nodeIds: string[],
        baseState: State
    ): Promise<{ mergedState: State; results: NodeResult[] }> {
        const order = this.graph.parallelMerge?.order === 'sorted'
            ? [...nodeIds].sort()
            : nodeIds;
        const nodes = order.map(nodeId => {
            const node = this.graph.nodes.find(n => n.id === nodeId);
            if (!node) {
                throw new Error(`节点 "${nodeId}" 不存在`);
            }
            return node;
        });

        const results = await Promise.all(
            nodes.map(node => {
                const nodeState = StateHelpers.setCurrentNode(baseState, node.id);
                return this.nodeExecutor.run(node, nodeState);
            })
        );
        const mergedState = mergeParallelStates(
            baseState,
            results.map(result => result.state),
            this.graph.parallelMerge
        );

        return { mergedState, results };
    }

    /**
     * 从 checkpoint 恢复执行
     */
    async resume(checkpointId: string): Promise<{ state: State; events: EventStream }> {
        const checkpoint = await this.checkpointManager.load(checkpointId);

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
     * 获取图定义（用于调试）
     */
    getGraphDefinition() {
        return this.graph;
    }

}

function mergeRunnerHooks(primary?: RunnerHooks, secondary?: RunnerHooks): RunnerHooks | undefined {
    if (!primary && !secondary) return undefined;

    return {
        onNodeStart: async (nodeId, state) => {
            await primary?.onNodeStart?.(nodeId, state);
            await secondary?.onNodeStart?.(nodeId, state);
        },
        onNodeEnd: async (nodeId, result) => {
            await primary?.onNodeEnd?.(nodeId, result);
            await secondary?.onNodeEnd?.(nodeId, result);
        },
        onToolCall: async (toolName, input) => {
            await primary?.onToolCall?.(toolName, input);
            await secondary?.onToolCall?.(toolName, input);
        },
        onToolResult: async (toolName, output) => {
            await primary?.onToolResult?.(toolName, output);
            await secondary?.onToolResult?.(toolName, output);
        },
        onError: async (error) => {
            await primary?.onError?.(error);
            await secondary?.onError?.(error);
        },
        onCheckpoint: async (checkpoint) => {
            await primary?.onCheckpoint?.(checkpoint);
            await secondary?.onCheckpoint?.(checkpoint);
        },
        onBudgetWarning: async (metric, current, limit) => {
            await primary?.onBudgetWarning?.(metric, current, limit);
            await secondary?.onBudgetWarning?.(metric, current, limit);
        },
    };
}
