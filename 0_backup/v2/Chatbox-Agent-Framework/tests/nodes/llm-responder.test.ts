import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMResponderNode } from '../../src/nodes/llm-responder';
import { createState, updateState } from '../../src/core/state';

describe('LLMResponderNode', () => {
    let mockProvider: any;

    beforeEach(() => {
        mockProvider = {
            chat: vi.fn().mockResolvedValue({
                content: '任务已经成功完成！我为您查询了数据库，发现了一些有趣的结果。',
                usage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 },
            }),
            chatStream: vi.fn().mockImplementation(async function* () {
                yield { delta: '任务已经' };
                yield { delta: '成功完成！' };
            }),
            getProviderName: () => 'MockProvider',
        };
    });

    it('should create responder node with correct id', () => {
        const responder = new LLMResponderNode();
        expect(responder.id).toBe('responder');
        expect(responder.name).toBe('LLM Responder');
    });

    it('should accept provider in constructor', () => {
        const responder = new LLMResponderNode({ provider: mockProvider });
        expect(responder).toBeDefined();
    });

    it('should set provider dynamically', () => {
        const responder = new LLMResponderNode();
        responder.setProvider(mockProvider);
        expect(responder).toBeDefined();
    });

    it('should generate response using LLM when provider is set', async () => {
        const responder = new LLMResponderNode({ provider: mockProvider });
        let state = createState('查询用户数据');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: '执行数据库查询', status: 'completed', result: { count: 100 } }
            ];
        });

        const result = await responder.execute(state);

        expect(mockProvider.chat).toHaveBeenCalled();
        expect(result.state.conversation.messages.length).toBeGreaterThan(0);
        expect(result.state.task.progress).toBe(100);
    });

    it('should generate template response when no provider', async () => {
        const responder = new LLMResponderNode();
        let state = createState('测试任务');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: '测试步骤', status: 'completed' }
            ];
        });

        const result = await responder.execute(state);

        const lastMessage = result.state.conversation.messages.find(m => m.role === 'assistant');
        expect(lastMessage).toBeDefined();
        expect(lastMessage?.content).toContain('任务');
    });

    it('should handle failed steps in response', async () => {
        const responder = new LLMResponderNode();
        let state = createState('测试任务');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: '步骤1', status: 'completed' },
                { id: 'step-2', description: '步骤2', status: 'failed', error: 'Network error' }
            ];
        });

        const result = await responder.execute(state);

        const lastMessage = result.state.conversation.messages.find(m => m.role === 'assistant');
        expect(lastMessage?.content).toContain('失败');
    });

    it('should include tool results in context', async () => {
        const responder = new LLMResponderNode({ provider: mockProvider });
        let state = createState('测试任务');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: '执行工具', status: 'completed' }
            ];
            draft.artifacts.toolResults = [
                { stepId: 'step-1', toolName: 'sql-query', output: { rows: 10 } }
            ];
        });

        const result = await responder.execute(state);

        // LLM should have been called with context containing tool results
        expect(mockProvider.chat).toHaveBeenCalled();
        const callArgs = mockProvider.chat.mock.calls[0][0];
        const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
        expect(userMessage.content).toContain('sql-query');
    });

    it('should set progress to 100', async () => {
        const responder = new LLMResponderNode();
        let state = createState('测试任务');

        state = updateState(state, draft => {
            draft.task.steps = [
                { id: 'step-1', description: '步骤', status: 'completed' }
            ];
            draft.task.progress = 80;
        });

        const result = await responder.execute(state);

        expect(result.state.task.progress).toBe(100);
    });

    it('should emit success event', async () => {
        const responder = new LLMResponderNode();
        let state = createState('测试任务');

        state = updateState(state, draft => {
            draft.task.steps = [{ id: 'step-1', description: '步骤', status: 'completed' }];
        });

        const result = await responder.execute(state);

        const successEvent = result.events.find(e => e.status === 'success');
        expect(successEvent).toBeDefined();
        expect(successEvent?.summary).toContain('已生成最终答复');
    });

    it('should include stats when configured', async () => {
        const responder = new LLMResponderNode({ includeStats: true });
        let state = createState('测试任务');

        state = updateState(state, draft => {
            draft.task.steps = [{ id: 'step-1', description: '步骤', status: 'completed' }];
            draft.telemetry.toolCallCount = 5;
        });

        const result = await responder.execute(state);

        const lastMessage = result.state.conversation.messages.find(m => m.role === 'assistant');
        expect(lastMessage?.content).toContain('执行统计');
    });
});
