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
            requiresConfirmation: false,
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

    it('should defer execution when tool requires confirmation', async () => {
        mockTool.requiresConfirmation = true;
        const runner = new ToolRunnerNode(toolRegistry, { provider: mockProvider });
        let state = createState('Test task');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: 'Step needing confirmation', status: 'pending' }
            ];
            draft.task.currentStepIndex = 0;
        });

        const result = await runner.execute(state);

        expect(mockTool.execute).not.toHaveBeenCalled();
        expect(result.state.task.pendingToolCall?.status).toBe('pending');
    });

    it('should execute approved pending tool call', async () => {
        const runner = new ToolRunnerNode(toolRegistry, { provider: mockProvider });
        let state = createState('Test task');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: 'Approved step', status: 'pending' }
            ];
            draft.task.currentStepIndex = 0;
            draft.task.pendingToolCall = {
                toolName: 'test-tool',
                input: { query: 'test' },
                stepId: 'step-1',
                stepDescription: 'Approved step',
                permissions: [],
                requestedAt: Date.now(),
                status: 'approved',
            };
        });

        const result = await runner.execute(state);

        expect(mockTool.execute).toHaveBeenCalledTimes(1);
        expect(result.state.task.pendingToolCall).toBeUndefined();
        expect(result.state.task.steps[0].status).toBe('completed');
    });

    it('should emit stream_chunk events for tool streaming', async () => {
        const streamTool = {
            name: 'stream-tool',
            description: 'Stream tool',
            inputSchema: z.object({}),
            outputSchema: z.object({ result: z.string() }),
            timeout: 5000,
            retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
            permissions: [],
            execute: vi.fn().mockImplementation(async (_input: unknown, ctx: any) => {
                ctx?.onStream?.('chunk-1');
                ctx?.onStream?.('chunk-2');
                return { result: 'done' };
            }),
        };
        toolRegistry.register(streamTool);
        mockProvider.chat.mockResolvedValue({
            content: '{"tool": "stream-tool", "input": {}}',
            usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        });

        const runner = new ToolRunnerNode(toolRegistry, { provider: mockProvider });
        let state = createState('Test task');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: 'Streaming step', status: 'pending' }
            ];
            draft.task.currentStepIndex = 0;
        });

        const streamEvents: Array<{ payload: any }> = [];
        await runner.execute(state, {
            emitEvent: (type: any, _status: any, _summary: string, payload?: unknown) => {
                if (type === 'stream_chunk') {
                    streamEvents.push({ payload });
                }
            },
        });

        expect(streamEvents.length).toBe(2);
        expect(streamEvents[0].payload).toMatchObject({ chunk: 'chunk-1', toolName: 'stream-tool' });
        expect(streamEvents[1].payload).toMatchObject({ chunk: 'chunk-2', toolName: 'stream-tool' });
    });
});
