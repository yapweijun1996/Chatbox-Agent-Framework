import { describe, it, expect, vi } from 'vitest';
import { CrewCoordinator } from '../../src/core/crew-collaboration';

const createMockAgent = (content: string) => ({
    chat: vi.fn().mockResolvedValue({
        content,
        mode: 'chat',
        duration: 1,
    }),
});

describe('CrewCoordinator', () => {
    it('should run tasks sequentially with role hints', async () => {
        const coordinator = new CrewCoordinator([
            { id: 'research', role: 'research', agent: createMockAgent('research'), keywords: ['research'] },
            { id: 'ops', role: 'ops', agent: createMockAgent('ops'), keywords: ['deploy'] },
        ]);

        const results = await coordinator.run({
            goal: 'research then deploy',
            tasks: ['research findings', 'deploy'],
        });

        expect(results).toHaveLength(2);
        expect(results[0].agentId).toBe('research');
        expect(results[1].agentId).toBe('ops');
    });
});
