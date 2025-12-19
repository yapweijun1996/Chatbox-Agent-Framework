/**
 * Node 基类
 * 所有节点的基础实现
 */
import type { Node, NodeResult, State, NodeContext } from './types';
export declare abstract class BaseNode implements Node {
    readonly id: string;
    readonly name: string;
    constructor(id: string, name: string);
    /**
     * 执行节点逻辑（子类必须实现）
     */
    abstract execute(state: State, context?: NodeContext): Promise<NodeResult>;
    /**
     * 创建基础 NodeResult
     */
    protected createResult(state: State, events?: NodeResult['events']): NodeResult;
}
//# sourceMappingURL=node.d.ts.map