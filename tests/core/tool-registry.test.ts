import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../src/core/tool-registry';
import { z } from 'zod';

describe('ToolRegistry', () => {
    it('should register and retrieve a tool', () => {
        const registry = new ToolRegistry();
        const tool = {
            name: 'test-tool',
            description: 'test',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            timeout: 1000,
            retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
            permissions: [],
            execute: async () => ({}),
        };

        registry.register(tool);
        expect(registry.get('test-tool')).toBe(tool);
    });

    it('should timeout if execution takes too long', async () => {
        const registry = new ToolRegistry();
        const tool = {
            name: 'slow-tool',
            description: 'slow',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            timeout: 100, // Short timeout
            retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
            permissions: [],
            execute: async () => {
                await new Promise(resolve => setTimeout(resolve, 500));
                return {};
            },
        };

        registry.register(tool);
        const result = await registry.execute('slow-tool', {});

        expect(result.success).toBe(false);
        expect(result.error).toContain('工具执行超时');
    });
});
