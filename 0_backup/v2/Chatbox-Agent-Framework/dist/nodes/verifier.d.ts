/**
 * Verifier 节点
 * 验证工具输出是否满足成功条件
 */
import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
export declare class VerifierNode extends BaseNode {
    constructor();
    execute(state: State): Promise<NodeResult>;
    /**
     * 验证结果（简化版）
     */
    private verify;
}
//# sourceMappingURL=verifier.d.ts.map