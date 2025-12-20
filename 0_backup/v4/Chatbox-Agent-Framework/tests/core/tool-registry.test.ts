import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../src/core/tool-registry';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';

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

    it('should block tools based on allowlist/denylist', async () => {
        const registry = new ToolRegistry({ allowlist: ['allowed-tool'], denylist: ['blocked-tool'] });
        const allowedTool = {
            name: 'allowed-tool',
            description: 'allowed',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            timeout: 1000,
            retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
            permissions: [],
            execute: async () => ({}),
        };
        const blockedTool = {
            name: 'blocked-tool',
            description: 'blocked',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            timeout: 1000,
            retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
            permissions: [],
            execute: async () => ({}),
        };

        registry.register(allowedTool);
        registry.register(blockedTool);

        const allowedResult = await registry.execute('allowed-tool', {});
        const blockedResult = await registry.execute('blocked-tool', {});

        expect(allowedResult.success).toBe(true);
        expect(blockedResult.success).toBe(false);
        expect(blockedResult.error).toContain('工具策略');
    });

    it('should override tool timeout with policy', async () => {
        const registry = new ToolRegistry({ perToolTimeoutMs: { 'slow-tool': 50 } });
        const tool = {
            name: 'slow-tool',
            description: 'slow',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            timeout: 5000,
            retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
            permissions: [],
            execute: async () => {
                await new Promise(resolve => setTimeout(resolve, 200));
                return {};
            },
        };

        registry.register(tool);
        const result = await registry.execute('slow-tool', {});

        expect(result.success).toBe(false);
        expect(result.error).toContain('工具执行超时');
    });

    it('should execute tool in child process when configured', async () => {
        const registry = new ToolRegistry();
        const modulePath = fileURLToPath(new URL('../fixtures/child-tool.mjs', import.meta.url));
        const tool = {
            name: 'child-tool',
            description: 'child',
            inputSchema: z.object({ value: z.string() }),
            outputSchema: z.object({ result: z.string() }),
            timeout: 1000,
            retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
            permissions: [],
            execution: { mode: 'child-process', modulePath, exportName: 'execute' },
            execute: async () => ({ result: 'should-not-run' }),
        };

        registry.register(tool);
        const result = await registry.execute('child-tool', { value: 'ok' });

        expect(result.success).toBe(true);
        expect(result.output).toEqual({ result: 'child:ok' });
    });

    it('should execute tool in worker when configured', async () => {
        const registry = new ToolRegistry();
        const modulePath = fileURLToPath(new URL('../fixtures/child-tool.mjs', import.meta.url));
        const tool = {
            name: 'worker-tool',
            description: 'worker',
            inputSchema: z.object({ value: z.string() }),
            outputSchema: z.object({ result: z.string() }),
            timeout: 1000,
            retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
            permissions: [],
            execution: { mode: 'worker', modulePath, exportName: 'execute' },
            execute: async () => ({ result: 'should-not-run' }),
        };

        registry.register(tool);
        const result = await registry.execute('worker-tool', { value: 'ok' });

        expect(result.success).toBe(true);
        expect(result.output).toEqual({ result: 'child:ok' });
    });

    it('should accept worker resource limits', async () => {
        const registry = new ToolRegistry();
        const modulePath = fileURLToPath(new URL('../fixtures/child-tool.mjs', import.meta.url));
        const tool = {
            name: 'worker-limited',
            description: 'worker limited',
            inputSchema: z.object({ value: z.string() }),
            outputSchema: z.object({ result: z.string() }),
            timeout: 1000,
            retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
            permissions: [],
            execution: {
                mode: 'worker',
                modulePath,
                exportName: 'execute',
                resourceLimits: { maxOldGenerationSizeMb: 64 },
            },
            execute: async () => ({ result: 'should-not-run' }),
        };

        registry.register(tool);
        const result = await registry.execute('worker-limited', { value: 'ok' });

        expect(result.success).toBe(true);
        expect(result.output).toEqual({ result: 'child:ok' });
    });

    it('should respect permission modes and role restrictions', async () => {
        const registry = new ToolRegistry();
        const tool = {
            name: 'role-tool',
            description: 'role',
            inputSchema: z.object({}),
            outputSchema: z.object({ result: z.string() }),
            timeout: 1000,
            retryPolicy: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 0 },
            permissions: ['tool:read', 'tool:write'],
            permissionsMode: 'any' as const,
            allowedRoles: ['admin'],
            deniedRoles: ['banned'],
            execute: async () => ({ result: 'ok' }),
        };

        registry.register(tool);
        const allowed = await registry.execute('role-tool', {}, {
            permissions: { 'tool:read': true },
            roles: ['admin'],
        });
        const denied = await registry.execute('role-tool', {}, {
            permissions: { 'tool:read': true },
            roles: ['banned'],
        });

        expect(allowed.success).toBe(true);
        expect(denied.success).toBe(false);
        expect(denied.error).toContain('角色无权');
    });
});
