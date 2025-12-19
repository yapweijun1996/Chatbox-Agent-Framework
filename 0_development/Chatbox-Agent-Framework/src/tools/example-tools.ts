/**
 * 示例工具实现
 * 提供 SQL 查询和文档搜索的模拟工具
 */

import { z } from 'zod';
import type { Tool } from '../core/types';

/**
 * SQL 查询工具（模拟）
 * 默认 SELECT-only，拒绝 INSERT/UPDATE/DELETE
 */
export const sqlQueryTool: Tool = {
    name: 'sql-query',
    description: 'Execute SQL SELECT queries on the database. Use this tool when the user wants to query data, list records, or get information from the database. Examples: "show all users", "list products", "get customer data".',

    inputSchema: z.object({
        query: z.string().min(1, 'Query cannot be empty').describe('The SQL SELECT query to execute'),
        database: z.string().optional().describe('Optional database name'),
    }),

    outputSchema: z.object({
        rows: z.array(z.record(z.unknown())),
        rowCount: z.number(),
        executionTime: z.number(),
    }),

    timeout: 5000,

    retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
    },

    permissions: ['sql:read'],
    requiresConfirmation: true,
    confirmationMessage: 'Execute database query?',

    allowedNodes: ['tool-runner'],

    async execute(input: unknown) {
        const { query } = input as { query: string };

        // 安全检查：仅允许 SELECT
        const normalizedQuery = query.trim().toUpperCase();
        if (!normalizedQuery.startsWith('SELECT')) {
            throw new Error('Only SELECT queries are allowed');
        }

        console.log('[SQL-Query] Executing:', query);

        // 模拟查询延迟
        await new Promise(resolve => setTimeout(resolve, 100));

        // 返回模拟数据
        return {
            rows: [
                { id: 1, name: 'Alice', email: 'alice@example.com' },
                { id: 2, name: 'Bob', email: 'bob@example.com' },
                { id: 3, name: 'Charlie', email: 'charlie@example.com' },
            ],
            rowCount: 3,
            executionTime: 100,
        };
    },
};

/**
 * 文档搜索工具（模拟）
 */
export const documentSearchTool: Tool = {
    name: 'document-search',
    description: 'Search for documents and articles in the knowledge base. Use this tool when the user wants to find documentation, tutorials, guides, or articles. Examples: "find SQL optimization docs", "search for performance guide", "look up tutorial".',

    inputSchema: z.object({
        keywords: z.array(z.string()).min(1, 'At least one keyword required').describe('Keywords to search for'),
        limit: z.number().min(1).max(50).optional().default(10).describe('Maximum number of results'),
    }),

    outputSchema: z.object({
        documents: z.array(z.object({
            id: z.string(),
            title: z.string(),
            snippet: z.string(),
            relevance: z.number(),
        })),
        totalCount: z.number(),
    }),

    timeout: 3000,

    retryPolicy: {
        maxRetries: 2,
        backoffMs: 500,
        backoffMultiplier: 2,
    },

    permissions: ['document:read'],

    async execute(input: unknown) {
        const { keywords, limit = 10 } = input as { keywords: string[]; limit?: number };

        // 模拟搜索延迟
        await new Promise(resolve => setTimeout(resolve, 200));

        // 返回模拟文档
        const mockDocs = [
            {
                id: 'doc-1',
                title: 'SQL 优化最佳实践',
                snippet: '本文介绍了常见的 SQL 优化技巧，包括索引使用、查询重写等...',
                relevance: 0.95,
            },
            {
                id: 'doc-2',
                title: '数据库性能调优指南',
                snippet: '深入探讨数据库性能调优的各个方面，从硬件到查询优化...',
                relevance: 0.87,
            },
            {
                id: 'doc-3',
                title: 'PostgreSQL 查询优化器原理',
                snippet: '详细解析 PostgreSQL 查询优化器的工作原理和优化策略...',
                relevance: 0.76,
            },
        ];

        return {
            documents: mockDocs.slice(0, limit),
            totalCount: mockDocs.length,
        };
    },
};

/**
 * 获取所有示例工具
 */
export function getExampleTools(): Tool[] {
    return [sqlQueryTool, documentSearchTool];
}
