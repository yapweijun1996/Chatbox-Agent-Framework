/**
 * Confirmation 节点
 * 在敏感工具执行前请求人工确认
 */

import { BaseNode } from '../core/node';
import type {
    NodeContext,
    NodeResult,
    State,
    ToolConfirmationDecision,
    ToolConfirmationHandler,
    ToolConfirmationRequest
} from '../core/types';
import { updateState } from '../core/state';

export interface ConfirmationNodeConfig {
    /** 确认处理器（未提供则自动批准） */
    onConfirm?: ToolConfirmationHandler;
    /** 是否默认自动批准 */
    autoApprove?: boolean;
}

export class ConfirmationNode extends BaseNode {
    private onConfirm?: ToolConfirmationHandler;
    private autoApprove: boolean;

    constructor(config?: ConfirmationNodeConfig) {
        super('confirmation', 'Confirmation');
        this.onConfirm = config?.onConfirm;
        this.autoApprove = config?.autoApprove ?? true;
    }

    setConfirmationHandler(handler?: ToolConfirmationHandler): void {
        this.onConfirm = handler;
    }

    async execute(state: State, context?: NodeContext): Promise<NodeResult> {
        const events: NodeResult['events'] = [];
        const pending = state.task.pendingToolCall;

        if (!pending || pending.status !== 'pending') {
            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'node_end',
                nodeId: this.id,
                status: 'info',
                summary: '没有需要确认的工具调用',
            });
            return this.createResult(state, events);
        }

        const request: ToolConfirmationRequest = {
            toolName: pending.toolName,
            input: pending.input,
            stepId: pending.stepId,
            stepDescription: pending.stepDescription,
            permissions: pending.permissions,
            confirmationMessage: pending.confirmationMessage,
            requestedAt: pending.requestedAt,
        };

        context?.emitEvent('confirmation_required', 'warning', `等待工具确认: ${pending.toolName}`, request);

        const decision = await this.resolveDecision(request);
        const updatedState = updateState(state, draft => {
            if (draft.task.pendingToolCall) {
                draft.task.pendingToolCall.status = decision.approved ? 'approved' : 'denied';
                draft.task.pendingToolCall.decidedAt = Date.now();
                if (decision.reason) {
                    draft.task.pendingToolCall.decisionReason = decision.reason;
                }
            }
        });

        events.push({
            id: `evt-${Date.now()}`,
            timestamp: Date.now(),
            type: 'confirmation_result',
            nodeId: this.id,
            status: decision.approved ? 'success' : 'warning',
            summary: decision.approved
                ? `已批准工具: ${pending.toolName}`
                : `已拒绝工具: ${pending.toolName}`,
            metadata: {
                toolName: pending.toolName,
                approved: decision.approved,
                reason: decision.reason,
            },
        });

        events.push({
            id: `evt-${Date.now()}`,
            timestamp: Date.now(),
            type: 'node_end',
            nodeId: this.id,
            status: decision.approved ? 'success' : 'warning',
            summary: decision.approved ? '工具已批准' : '工具已拒绝',
        });

        return this.createResult(updatedState, events);
    }

    private async resolveDecision(request: ToolConfirmationRequest): Promise<ToolConfirmationDecision> {
        if (this.onConfirm) {
            const decision = await this.onConfirm(request);
            if (typeof decision === 'boolean') {
                return { approved: decision };
            }
            return decision;
        }

        if (this.autoApprove) {
            return { approved: true, reason: 'auto-approved' };
        }

        return { approved: false, reason: 'no confirmation handler' };
    }
}
