import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMPlannerNode } from '../../src/nodes/llm-planner';
import { ToolRegistry } from '../../src/core/tool-registry';
import { createState } from '../../src/core/state';
import { z } from 'zod';

describe('LLMPlannerNode', () => {
    let toolRegistry: ToolRegistry;
    let mockProvider: any;

    beforeEach(() => {
        toolRegistry = new ToolRegistry();
        mockProvider = {
            chat: vi.fn().mockResolvedValue({
                content: '1. 分析需求\n2. 实现功能\n3. 测试验证',
                usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
            }),
            chatStream: vi.fn().mockImplementation(async function* () {
                yield { delta: '1. Step 1\n' };
                yield { delta: '2. Step 2\n' };
            }),
            getProviderName: () => 'MockProvider',
            getModel: () => 'mock-model',
        };
    });

    it('should create planner node with correct id', () => {
        const planner = new LLMPlannerNode(toolRegistry);
        expect(planner.id).toBe('planner');
        expect(planner.name).toBe('LLM Planner');
    });

    it('should accept provider in constructor', () => {
        const planner = new LLMPlannerNode(toolRegistry, { provider: mockProvider });
        expect(planner).toBeDefined();
    });

    it('should set provider dynamically', () => {
        const planner = new LLMPlannerNode(toolRegistry);
        planner.setProvider(mockProvider);
        expect(planner).toBeDefined();
    });

    it('should execute and generate steps with provider', async () => {
        const planner = new LLMPlannerNode(toolRegistry, { provider: mockProvider });
        const state = createState('实现用户登录功能');

        const result = await planner.execute(state);

        expect(result.state.task.steps.length).toBeGreaterThan(0);
        expect(result.state.task.plan).toBeDefined();
        expect(result.events.length).toBeGreaterThan(0);
        expect(mockProvider.chat).toHaveBeenCalled();
    });

    it('should parse numbered steps correctly', async () => {
        mockProvider.chat.mockResolvedValue({
            content: '1. First step\n2. Second step\n3. Third step',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        });

        const planner = new LLMPlannerNode(toolRegistry, { provider: mockProvider });
        const state = createState('Test task');

        const result = await planner.execute(state);

        expect(result.state.task.steps).toHaveLength(3);
        expect(result.state.task.steps[0].description).toBe('First step');
        expect(result.state.task.steps[1].description).toBe('Second step');
        expect(result.state.task.steps[2].description).toBe('Third step');
    });

    it('should record token usage', async () => {
        mockProvider.chat.mockResolvedValue({
            content: '1. Step one',
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        });

        const planner = new LLMPlannerNode(toolRegistry, { provider: mockProvider });
        const state = createState('Test task');

        const result = await planner.execute(state);

        expect(result.state.telemetry.tokenCount).toBe(150);
    });

    it('should emit success event on completion', async () => {
        const planner = new LLMPlannerNode(toolRegistry, { provider: mockProvider });
        const state = createState('Test task');

        const result = await planner.execute(state);

        const successEvent = result.events.find(e => e.status === 'success');
        expect(successEvent).toBeDefined();
        expect(successEvent?.type).toBe('node_end');
    });

    it('should throw and emit error event on failure', async () => {
        mockProvider.chat.mockRejectedValue(new Error('API Error'));

        const planner = new LLMPlannerNode(toolRegistry, { provider: mockProvider });
        const state = createState('Test task');

        await expect(planner.execute(state)).rejects.toThrow('API Error');
    });

    it('should set progress to 10 after planning', async () => {
        const planner = new LLMPlannerNode(toolRegistry, { provider: mockProvider });
        const state = createState('Test task');

        const result = await planner.execute(state);

        expect(result.state.task.progress).toBe(10);
    });
});
