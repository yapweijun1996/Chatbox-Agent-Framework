/**
 * Memory Node Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryNode } from '../../src/nodes/memory';
import { createMemoryManager } from '../../src/core/memory/manager';
import { createState } from '../../src/core/state';
import type { State } from '../../src/core/types';

describe('MemoryNode', () => {
    let memoryManager: ReturnType<typeof createMemoryManager>;
    let memoryNode: MemoryNode;

    beforeEach(() => {
        memoryManager = createMemoryManager({
            autoConsolidate: false,
        });

        memoryNode = new MemoryNode({
            memoryManager,
            saveCompletedTasks: true,
            saveUserPreferences: true,
            saveToolResults: false,
        });
    });

    it('should save completed tasks to memory', async () => {
        const state = createState('Test goal');
        state.task.steps = [
            {
                id: '1',
                description: 'Step 1',
                status: 'completed',
                result: { success: true },
            },
        ];

        await memoryNode.execute(state);

        const memories = await memoryManager.recall({ tags: ['completed-task'] });
        expect(memories.length).toBeGreaterThan(0);
    });

    it('should detect and save user preferences', async () => {
        const state = createState('Test goal');
        state.conversation.messages.push({
            role: 'user',
            content: 'I prefer using TypeScript for all my projects',
            timestamp: Date.now(),
        });

        await memoryNode.execute(state);

        const memories = await memoryManager.recall({ tags: ['user-preference'] });
        expect(memories.length).toBeGreaterThan(0);
        expect(memories[0].content).toContain('TypeScript');
    });

    it('should save artifacts when present', async () => {
        const state = createState('Test goal');
        state.artifacts.sql = ['SELECT * FROM users', 'INSERT INTO logs VALUES (1, 2, 3)'];

        await memoryNode.execute(state);

        const memories = await memoryManager.recall({ tags: ['sql'] });
        expect(memories.length).toBeGreaterThan(0);
    });

    it('should not fail execution if memory saving fails', async () => {
        // Create a memory manager that throws errors
        const failingMemory = {
            ...memoryManager,
            remember: async () => {
                throw new Error('Memory save failed');
            },
        } as any;

        const failingNode = new MemoryNode({
            memoryManager: failingMemory,
        });

        const state = createState('Test goal');
        state.task.steps = [
            {
                id: '1',
                description: 'Step 1',
                status: 'completed',
                result: { success: true },
            },
        ];

        // Should not throw
        const result = await failingNode.execute(state);
        expect(result.state).toBeDefined();
        expect(result.events).toBeDefined();
    });

    it('should calculate task importance based on complexity', async () => {
        const complexState = createState('Complex task');
        complexState.task.steps = new Array(10).fill(null).map((_, i) => ({
            id: `${i}`,
            description: `Step ${i}`,
            status: 'completed' as const,
        }));
        complexState.artifacts.sql = ['SELECT * FROM users'];

        await memoryNode.execute(complexState);

        const memories = await memoryManager.recall({ tags: ['completed-task'] });
        expect(memories.length).toBeGreaterThan(0);
        // Complex tasks should have higher importance
        expect(memories[0].metadata.importance).toBeGreaterThan(0.6);
    });
});
