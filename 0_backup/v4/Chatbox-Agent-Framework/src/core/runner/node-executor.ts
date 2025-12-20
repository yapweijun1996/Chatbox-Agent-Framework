import type { Node, NodeContext, NodeResult, RunnerHooks, State } from '../types';
import { EventStream } from '../event-stream';
import { StateHelpers } from '../state';
import { createError, getErrorStrategy, getBackoffDelay, ErrorType } from '../error-handler';

interface NodeExecutorDeps {
    eventStream: EventStream;
    hooks?: RunnerHooks;
}

export class NodeExecutor {
    constructor(private readonly deps: NodeExecutorDeps) { }

    async run(node: Node, state: State): Promise<NodeResult> {
        await this.deps.hooks?.onNodeStart?.(node.id, state);

        this.deps.eventStream.emit('node_start', 'info', `开始执行节点: ${node.name}`, {
            nodeId: node.id,
            metadata: {
                nodeName: node.name,
            },
        });

        let retryCount = 0;
        let lastError: Error | undefined;

        const context: NodeContext = {
            emitEvent: (type: any, status: any, summary: string, payload?: unknown) => {
                this.deps.eventStream.emit(type, status, summary, {
                    nodeId: node.id,
                    payload,
                });
            },
            onToolCall: this.deps.hooks?.onToolCall,
            onToolResult: this.deps.hooks?.onToolResult,
        };

        while (retryCount <= state.policy.maxRetries) {
            const attemptStartTime = Date.now();
            try {
                const result = await node.execute(state, context);
                const duration = Date.now() - attemptStartTime;

                result.state = StateHelpers.recordNodeTiming(result.state, node.id, duration);

                await this.deps.hooks?.onNodeEnd?.(node.id, result);

                this.deps.eventStream.emit('node_end', 'success', `完成节点: ${node.name}`, {
                    nodeId: node.id,
                    metadata: {
                        nodeName: node.name,
                        durationMs: duration,
                    },
                });

                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const duration = Date.now() - attemptStartTime;

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

                    this.deps.eventStream.emit('retry', 'warning', strategy.suggestion || '重试中...', {
                        nodeId: node.id,
                        metadata: { retryCount, delay },
                    });

                    state = StateHelpers.incrementRetry(state);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    state = StateHelpers.incrementError(state);

                    this.deps.eventStream.emit('node_end', 'failure', `节点执行失败: ${node.name}`, {
                        nodeId: node.id,
                        metadata: {
                            nodeName: node.name,
                            error: lastError.message,
                            attemptedRetries: retryCount,
                            durationMs: duration,
                        },
                    });

                    throw lastError;
                }
            }
        }

        throw lastError;
    }
}
