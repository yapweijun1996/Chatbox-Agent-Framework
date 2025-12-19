/**
 * Node 基类
 * 所有节点的基础实现
 */

import type { Node, NodeResult, State, NodeContext } from './types';

export abstract class BaseNode implements Node {
    constructor(
        public readonly id: string,
        public readonly name: string
    ) { }

    /**
     * 执行节点逻辑（子类必须实现）
     */
    abstract execute(state: State, context?: NodeContext): Promise<NodeResult>;

    /**
     * 创建基础 NodeResult
     */
    protected createResult(state: State, events: NodeResult['events'] = []): NodeResult {
        return { state, events };
    }
}
