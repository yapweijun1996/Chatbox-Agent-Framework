import { describe, it, expect } from 'vitest';
import { VerifierNode } from '../../src/nodes/verifier';
import { createState, updateState } from '../../src/core/state';

describe('VerifierNode', () => {
    it('should advance to next step when verification succeeds', async () => {
        const verifier = new VerifierNode();
        let state = createState('验证任务');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: '完成步骤', status: 'completed', result: { ok: true } },
                { id: 'step-2', description: '后续步骤', status: 'pending' },
            ];
            draft.task.currentStepIndex = 0;
            draft.task.progress = 0;
        });

        const result = await verifier.execute(state);

        expect(result.state.task.currentStepIndex).toBe(1);
        expect(result.state.task.progress).toBeGreaterThan(0);
    });

    it('should keep current step when verification fails', async () => {
        const verifier = new VerifierNode();
        let state = createState('验证任务');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: '失败步骤', status: 'completed', result: null }
            ];
            draft.task.currentStepIndex = 0;
        });

        const result = await verifier.execute(state);

        expect(result.state.task.currentStepIndex).toBe(0);
        const warningEvent = result.events.find(evt => evt.status === 'warning');
        expect(warningEvent).toBeDefined();
    });
});
