import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRunnerNode } from '../../src/nodes/tool-runner';
import { ToolRegistry } from '../../src/core/tool-registry';
import { createState, updateState } from '../../src/core/state';
import { z } from 'zod';

describe('ToolRunnerNode', () => {
    let toolRegistry: ToolRegistry;
    let mockProvider: any;
    let mockTool: any;

    beforeEach(() => {
        toolRegistry = new ToolRegistry();

        mockTool = {
            name: 'test-tool',
            description: 'A test tool',
            inputSchema: z.object({ query: z.string() }),
            outputSchema: z.object({ result: z.string() }),
            timeout: 5000,
            retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
            permissions: [],
            execute: vi.fn().mockResolvedValue({ result: 'success' }),
        };

        toolRegistry.register(mockTool);

        mockProvider = {
            chat: vi.fn().mockResolvedValue({
                content: '{"tool": "test-tool", "input": {"query": "test"}}',
                usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            }),
            getProviderName: () => 'MockProvider',
            getModel: () => 'mock-model',
        };
    });

    it('should create tool runner node with correct id', () => {
        const runner = new ToolRunnerNode(toolRegistry);
        expect(runner.id).toBe('tool-runner');
        expect(runner.name).toBe('ToolRunner');
    });

    it('should accept provider in constructor', () => {
        const runner = new ToolRunnerNode(toolRegistry, { provider: mockProvider });
        expect(runner).toBeDefined();
    });

    it('should set provider dynamically', () => {
        const runner = new ToolRunnerNode(toolRegistry);
        runner.setProvider(mockProvider);
        expect(runner).toBeDefined();
    });

    it('should throw when no steps available', async () => {
        const runner = new ToolRunnerNode(toolRegistry);
        const state = createState('Test task');
        // State has no steps

        await expect(runner.execute(state)).rejects.toThrow('没有可执行的步骤');
    });

    it('should execute tool and update state', async () => {
        const runner = new ToolRunnerNode(toolRegistry, { provider: mockProvider });
        let state = createState('Test task');

        // Add a step
        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: 'Test step using test-tool', status: 'pending' }
            ];
            draft.task.currentStepIndex = 0;
        });

        const result = await runner.execute(state);

        expect(result.state.task.steps[0].status).toBe('completed');
        expect(result.state.task.currentStepIndex).toBe(0);
    });

    it('should keep step index for verifier to advance', async () => {
        const runner = new ToolRunnerNode(toolRegistry, { provider: mockProvider });
        let state = createState('Test task');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: 'Step 1', status: 'pending' },
                { id: 'step-2', description: 'Step 2', status: 'pending' }
            ];
            draft.task.currentStepIndex = 0;
        });

        const result = await runner.execute(state);

        expect(result.state.task.currentStepIndex).toBe(0);
    });

    it('should emit tool_call event', async () => {
        const runner = new ToolRunnerNode(toolRegistry, { provider: mockProvider });
        let state = createState('Test task');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: 'Test step', status: 'pending' }
            ];
        });

        const result = await runner.execute(state);

        const toolCallEvent = result.events.find(e => e.type === 'tool_call');
        expect(toolCallEvent).toBeDefined();
    });

    it('should emit tool_result event on success', async () => {
        const runner = new ToolRunnerNode(toolRegistry, { provider: mockProvider });
        let state = createState('Test task');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: 'Test step', status: 'pending' }
            ];
        });

        const result = await runner.execute(state);

        const toolResultEvent = result.events.find(e => e.type === 'tool_result');
        expect(toolResultEvent).toBeDefined();
        expect(toolResultEvent?.status).toBe('success');
    });

    it('should store tool results in artifacts', async () => {
        const runner = new ToolRunnerNode(toolRegistry, { provider: mockProvider });
        let state = createState('Test task');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: 'Test step', status: 'pending' }
            ];
        });

        const result = await runner.execute(state);

        expect(result.state.artifacts.toolResults).toBeDefined();
        expect((result.state.artifacts.toolResults as any[]).length).toBeGreaterThan(0);
    });

    it('should increment tool call count', async () => {
        const runner = new ToolRunnerNode(toolRegistry, { provider: mockProvider });
        let state = createState('Test task');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: 'Test step', status: 'pending' }
            ];
        });

        const result = await runner.execute(state);

        expect(result.state.telemetry.toolCallCount).toBe(1);
    });

    it('should handle null tool decision (no tool needed)', async () => {
        mockProvider.chat.mockResolvedValue({
            content: '{"tool": null}',
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        });

        const runner = new ToolRunnerNode(toolRegistry, { provider: mockProvider });
        let state = createState('Test task');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: 'Simple step', status: 'pending' }
            ];
        });

        const result = await runner.execute(state);

        expect(result.state.task.steps[0].status).toBe('completed');
        expect(result.state.task.currentStepIndex).toBe(0);
    });
});
