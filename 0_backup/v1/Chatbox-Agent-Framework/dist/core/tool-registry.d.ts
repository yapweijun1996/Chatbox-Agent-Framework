/**
 * 工具注册中心
 * 管理工具注册、校验、调用
 */
import type { Tool } from './types';
export declare class ToolRegistry {
    private tools;
    /**
     * 注册工具
     */
    register(tool: Tool): void;
    /**
     * 批量注册工具
     */
    registerAll(tools: Tool[]): void;
    /**
     * 获取工具
     */
    get(name: string): Tool | undefined;
    /**
     * 检查工具是否存在
     */
    has(name: string): boolean;
    /**
     * 获取所有工具名称
     */
    list(): string[];
    /**
     * 校验输入
     */
    validateInput(toolName: string, input: unknown): {
        valid: boolean;
        error?: string;
        data?: unknown;
    };
    /**
     * 校验输出
     */
    validateOutput(toolName: string, output: unknown): {
        valid: boolean;
        error?: string;
        data?: unknown;
    };
    /**
     * 检查权限
     */
    checkPermission(toolName: string, permissions: Record<string, boolean>): boolean;
    /**
     * 检查节点是否允许调用工具
     */
    checkNodeAllowed(toolName: string, nodeId: string): boolean;
    /**
     * 执行工具（带超时控制）
     */
    execute(toolName: string, input: unknown, options?: {
        nodeId?: string;
        permissions?: Record<string, boolean>;
        onStream?: (chunk: string) => void;
    }): Promise<{
        success: boolean;
        output?: unknown;
        error?: string;
    }>;
    private executeWithTimeout;
}
//# sourceMappingURL=tool-registry.d.ts.map