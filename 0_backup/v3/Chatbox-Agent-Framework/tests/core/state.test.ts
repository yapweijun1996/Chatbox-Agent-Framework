import { describe, it, expect } from 'vitest';
import { createState, updateState } from '../../src/core/state';

describe('State Management', () => {
    it('should create initial state with correct defaults', () => {
        const goal = 'test goal';
        const state = createState(goal);

        expect(state.task.goal).toBe(goal);
        expect(state.task.progress).toBe(0);
        expect(state.policy.maxToolCalls).toBe(20);
    });

    it('should update state immutably', () => {
        const state = createState('test');
        const newState = updateState(state, draft => {
            draft.task.progress = 50;
        });

        // Original state should not change
        expect(state.task.progress).toBe(0);
        // New state should reflect changes
        expect(newState.task.progress).toBe(50);
        // IDs should be preserved (unless expected otherwise, but here we just check ref equality)
        expect(state).not.toBe(newState);
    });

    it('should handle nested updates correctly', () => {
        const state = createState('test');
        const newState = updateState(state, draft => {
            draft.memory.shortTerm = { key: 'value' };
        });

        expect(state.memory.shortTerm).toEqual({});
        expect(newState.memory.shortTerm).toEqual({ key: 'value' });
    });
});
