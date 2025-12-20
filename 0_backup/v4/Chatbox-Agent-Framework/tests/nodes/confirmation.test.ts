import { describe, it, expect, vi } from 'vitest';
import { ConfirmationNode } from '../../src/nodes/confirmation';
import { createState, updateState } from '../../src/core/state';

describe('ConfirmationNode', () => {
    it('should auto-approve when no handler is provided', async () => {
        const node = new ConfirmationNode();
        let state = createState('Confirm task');

        state = updateState(state, draft => {
            draft.task.pendingToolCall = {
                toolName: 'test-tool',
                input: { query: 'test' },
                stepId: 'step-1',
                stepDescription: 'Test step',
                permissions: ['sql:read'],
                requestedAt: Date.now(),
                status: 'pending',
            };
        });

        const streamEvents: Array<{ type: string }> = [];
        const result = await node.execute(state, {
            emitEvent: (type: any) => streamEvents.push({ type }),
        });

        expect(streamEvents.find(e => e.type === 'confirmation_required')).toBeDefined();
        expect(result.state.task.pendingToolCall?.status).toBe('approved');
        const confirmationEvent = result.events.find(e => e.type === 'confirmation_result');
        expect(confirmationEvent?.status).toBe('success');
    });

    it('should mark denied when handler rejects', async () => {
        const handler = vi.fn().mockResolvedValue({ approved: false, reason: 'Nope' });
        const node = new ConfirmationNode({ onConfirm: handler });
        let state = createState('Confirm task');

        state = updateState(state, draft => {
            draft.task.pendingToolCall = {
                toolName: 'test-tool',
                input: { query: 'test' },
                stepId: 'step-1',
                stepDescription: 'Test step',
                permissions: ['sql:read'],
                requestedAt: Date.now(),
                status: 'pending',
            };
        });

        const result = await node.execute(state);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(result.state.task.pendingToolCall?.status).toBe('denied');
        const confirmationEvent = result.events.find(e => e.type === 'confirmation_result');
        expect(confirmationEvent?.status).toBe('warning');
    });
});
