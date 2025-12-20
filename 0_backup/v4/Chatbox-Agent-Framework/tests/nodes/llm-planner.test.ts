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

    it('should apply custom prompt template and examples', async () => {
        const planner = new LLMPlannerNode(toolRegistry, {
            provider: mockProvider,
            promptTemplate: {
                system: 'SYSTEM {{tools}}',
                user: 'GOAL {{goal}}',
            },
            examples: [
                { goal: '示例目标', plan: '1. 示例步骤' },
            ],
        });
        const state = createState('自定义目标');

        await planner.execute(state);

        const firstCall = mockProvider.chat.mock.calls[0][0];
        expect(firstCall.messages[0].content).toBe('SYSTEM 无');
        expect(firstCall.messages[1].content).toContain('示例目标');
        expect(firstCall.messages[2].content).toBe('1. 示例步骤');
        expect(firstCall.messages[3].content).toBe('GOAL 自定义目标');
    });

    it('should run self-reflection when enabled', async () => {
        mockProvider.chat
            .mockResolvedValueOnce({
                content: '1. 初始计划',
                usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
            })
            .mockResolvedValueOnce({
                content: '1. 改进计划',
                usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
            });

        const planner = new LLMPlannerNode(toolRegistry, {
            provider: mockProvider,
            selfReflection: { enabled: true },
        });
        const state = createState('Test task');

        const result = await planner.execute(state);

        expect(mockProvider.chat).toHaveBeenCalledTimes(2);
        expect(result.state.task.plan).toBe('1. 改进计划');
    });

    it('should replan remaining steps when plan-and-execute is enabled', async () => {
        mockProvider.chat.mockResolvedValue({
            content: '1. 新的后续步骤',
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        });

        const planner = new LLMPlannerNode(toolRegistry, {
            provider: mockProvider,
            planAndExecute: { enabled: true },
        });

        const state = createState('Test task');
        state.task.steps = [
            { id: 'step-1', description: '已完成步骤', status: 'completed', result: 'ok' },
            { id: 'step-2', description: '旧步骤', status: 'pending' },
        ];
        state.task.currentStepIndex = 1;
        state.artifacts.toolResults = [{ toolName: 'mock-tool', output: { value: 1 } }];

        const result = await planner.execute(state);

        expect(result.state.task.steps).toHaveLength(2);
        expect(result.state.task.steps[0].description).toBe('已完成步骤');
        expect(result.state.task.steps[1].description).toBe('新的后续步骤');
        expect(result.state.task.currentStepIndex).toBe(1);
    });
});
