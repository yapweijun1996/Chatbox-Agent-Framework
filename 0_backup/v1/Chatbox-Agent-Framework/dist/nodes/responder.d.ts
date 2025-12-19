/**
 * Responder 节点
 * 汇总结果并生成最终答复
 */
import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
export declare class ResponderNode extends BaseNode {
    constructor();
    execute(state: State): Promise<NodeResult>;
    /**
     * 汇总结果
     */
    private summarizeResults;
    /**
     * 生成最终答复
     */
    private generateResponse;
}
//# sourceMappingURL=responder.d.ts.map