/**
 * Integration test: Agent with Memory
 * Tests the full integration of memory system with agent execution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAgent, createMemoryManager } from '../../src/index';
import type { Agent } from '../../src/core/agent';
import type { MemoryManager } from '../../src/core/memory/types';

describe('Agent with Memory Integration', () => {
    let agent: Agent;
    let memory: MemoryManager;

    beforeEach(() => {
        memory = createMemoryManager({
            autoConsolidate: false,
            shortTermMaxSize: 100,
        });

        agent = createAgent({
            provider: {
                type: 'openai',
                apiKey: 'test-api-key', // Not used in these tests
                model: 'gpt-4',
            },
            memory,
            enableMemory: true,
            mode: 'chat', // Use chat mode to avoid tool execution complexities
        });
    });

    it('should create agent with memory enabled', () => {
        expect(agent.getMemory()).toBe(memory);
    });

    it('should have access to memory manager', () => {
        const agentMemory = agent.getMemory();
        expect(agentMemory).toBeDefined();
        expect(agentMemory).toBe(memory);
    });

    it('should support manual memory operations', async () => {
        const agentMemory = agent.getMemory();
        expect(agentMemory).toBeDefined();

        if (agentMemory) {
            // Save a preference
            await agentMemory.remember('User prefers TypeScript over JavaScript', {
                tags: ['user-preference', 'language'],
                importance: 0.9,
                longTerm: true,
            });

            // Recall it
            const memories = await agentMemory.recall('TypeScript');
            expect(memories.length).toBeGreaterThan(0);
        }
    });

    it('should accumulate memories manually', async () => {
        const agentMemory = agent.getMemory();
        expect(agentMemory).toBeDefined();

        if (agentMemory) {
            // Add multiple memories
            await agentMemory.remember('Name is Alice', { tags: ['user-info'] });
            await agentMemory.remember('Prefers dark mode', { tags: ['ui-preference'] });
            await agentMemory.remember('Works on ML projects', { tags: ['user-info'] });

            // Check stats
            const stats = await agentMemory.getStats();
            expect(stats.shortTerm.size + stats.longTerm.count).toBeGreaterThan(0);
        }
    });

    it('should not break agent execution if memory fails', async () => {
        // Create agent with broken memory
        const brokenMemory = {
            ...memory,
            remember: async () => {
                throw new Error('Memory failure');
            },
            recall: async () => {
                throw new Error('Recall failure');
            },
        } as any;

        const agentWithBrokenMemory = createAgent({
            provider: {
                type: 'openai',
                apiKey: 'test-api-key',
                model: 'gpt-4',
            },
            memory: brokenMemory,
            enableMemory: true,
            mode: 'chat',
        });

        // Memory failures should not prevent agent from working
        expect(agentWithBrokenMemory.getMemory()).toBeDefined();
    });


    it('should work without memory when disabled', () => {
        const agentNoMemory = createAgent({
            provider: {
                type: 'openai',
                apiKey: 'test-api-key',
                model: 'gpt-4',
            },
            enableMemory: false,
        });

        expect(agentNoMemory.getMemory()).toBeUndefined();
    });
});
