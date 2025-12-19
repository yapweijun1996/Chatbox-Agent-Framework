/**
 * Verifier 节点
 * 验证工具输出是否满足成功条件
 */

import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
import { updateState } from '../core/state';

export class VerifierNode extends BaseNode {
    constructor() {
        super('verifier', 'Verifier');
    }

    async execute(state: State): Promise<NodeResult> {
        const events: NodeResult['events'] = [];

        try {
            // 检查当前步骤是否成功
            const currentStep = state.task.steps[state.task.currentStepIndex];

            if (!currentStep) {
                throw new Error('没有可验证的步骤');
            }

            if (currentStep.status === 'failed') {
                const nextStepIndex = Math.min(state.task.currentStepIndex + 1, state.task.steps.length);
                const totalSteps = state.task.steps.length || 1;
                const progress = (nextStepIndex / totalSteps) * 80 + 10; // 10-90%

                const newState = updateState(state, draft => {
                    draft.task.currentStepIndex = nextStepIndex;
                    draft.task.progress = Math.round(progress);
                });

                events.push({
                    id: `evt-${Date.now()}`,
                    timestamp: Date.now(),
                    type: 'node_end',
                    nodeId: this.id,
                    status: 'warning',
                    summary: `步骤 "${currentStep.description}" 已失败，跳过到下一步`,
                });

                return this.createResult(newState, events);
            }

            const isValid = this.verify(currentStep.result);

            if (!isValid) {
                events.push({
                    id: `evt-${Date.now()}`,
                    timestamp: Date.now(),
                    type: 'error',
                    nodeId: this.id,
                    status: 'warning',
                    summary: `步骤 "${currentStep.description}" 验证失败`,
                });

                return this.createResult(state, events);
            }

            // 验证通过，更新进度并推进到下一步
            const nextStepIndex = Math.min(state.task.currentStepIndex + 1, state.task.steps.length);
            const totalSteps = state.task.steps.length || 1;
            const progress = (nextStepIndex / totalSteps) * 80 + 10; // 10-90%

            const newState = updateState(state, draft => {
                draft.task.currentStepIndex = nextStepIndex;
                draft.task.progress = Math.round(progress);
            });

            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'node_end',
                nodeId: this.id,
                status: 'success',
                summary: `步骤验证通过 (进度: ${Math.round(progress)}%)`,
            });

            return this.createResult(newState, events);
        } catch (error) {
            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'error',
                nodeId: this.id,
                status: 'failure',
                summary: `验证失败: ${error}`,
            });

            throw error;
        }
    }

    /**
     * 验证结果（简化版）
     */
    private verify(result: unknown): boolean {
        // 基本验证：结果不为空
        if (result === null || result === undefined) {
            return false;
        }

        // 如果是数组，检查是否为空
        if (Array.isArray(result) && result.length === 0) {
            return false;
        }

        // 如果是对象，检查是否有内容
        if (typeof result === 'object' && Object.keys(result).length === 0) {
            return false;
        }

        return true;
    }
}
