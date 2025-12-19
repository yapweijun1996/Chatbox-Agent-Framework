/**
 * 工具注册中心
 * 管理工具注册、校验、调用
 */
import { z } from 'zod';
export class ToolRegistry {
    tools = new Map();
    /**
     * 注册工具
     */
    register(tool) {
        if (this.tools.has(tool.name)) {
            throw new Error(`工具 "${tool.name}" 已注册`);
        }
        this.tools.set(tool.name, tool);
    }
    /**
     * 批量注册工具
     */
    registerAll(tools) {
        tools.forEach(tool => this.register(tool));
    }
    /**
     * 获取工具
     */
    get(name) {
        return this.tools.get(name);
    }
    /**
     * 检查工具是否存在
     */
    has(name) {
        return this.tools.has(name);
    }
    /**
     * 获取所有工具名称
     */
    list() {
        return Array.from(this.tools.keys());
    }
    /**
     * 校验输入
     */
    validateInput(toolName, input) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return { valid: false, error: `工具 "${toolName}" 不存在` };
        }
        try {
            const data = tool.inputSchema.parse(input);
            return { valid: true, data };
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return { valid: false, error: `输入校验失败: ${error.errors.map(e => e.message).join(', ')}` };
            }
            return { valid: false, error: String(error) };
        }
    }
    /**
     * 校验输出
     */
    validateOutput(toolName, output) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return { valid: false, error: `工具 "${toolName}" 不存在` };
        }
        try {
            const data = tool.outputSchema.parse(output);
            return { valid: true, data };
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return { valid: false, error: `输出校验失败: ${error.errors.map(e => e.message).join(', ')}` };
            }
            return { valid: false, error: String(error) };
        }
    }
    /**
     * 检查权限
     */
    checkPermission(toolName, permissions) {
        const tool = this.tools.get(toolName);
        if (!tool)
            return false;
        // 如果工具没有权限要求，默认允许
        if (!tool.permissions || tool.permissions.length === 0) {
            return true;
        }
        // 检查是否拥有所有必需权限
        return tool.permissions.every(perm => permissions[perm] === true);
    }
    /**
     * 检查节点是否允许调用工具
     */
    checkNodeAllowed(toolName, nodeId) {
        const tool = this.tools.get(toolName);
        if (!tool)
            return false;
        // 如果没有节点白名单，默认允许所有节点
        if (!tool.allowedNodes || tool.allowedNodes.length === 0) {
            return true;
        }
        return tool.allowedNodes.includes(nodeId);
    }
    /**
     * 执行工具（带超时控制）
     */
    async execute(toolName, input, options) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return { success: false, error: `工具 "${toolName}" 不存在` };
        }
        // 检查节点权限
        if (options?.nodeId && !this.checkNodeAllowed(toolName, options.nodeId)) {
            return { success: false, error: `节点 "${options.nodeId}" 不允许调用工具 "${toolName}"` };
        }
        // 检查用户权限
        if (options?.permissions && !this.checkPermission(toolName, options.permissions)) {
            return { success: false, error: `缺少必需权限: ${tool.permissions.join(', ')}` };
        }
        // 校验输入
        const inputValidation = this.validateInput(toolName, input);
        if (!inputValidation.valid) {
            return { success: false, error: inputValidation.error };
        }
        try {
            // 执行工具（带超时）
            const output = await this.executeWithTimeout(tool.execute(inputValidation.data, {
                onStream: options?.onStream,
            }), tool.timeout);
            // 校验输出
            const outputValidation = this.validateOutput(toolName, output);
            if (!outputValidation.valid) {
                return { success: false, error: `契约错误: ${outputValidation.error}` };
            }
            return { success: true, output: outputValidation.data };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    executeWithTimeout(promise, timeoutMs) {
        let timeoutHandle;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(`工具执行超时 (${timeoutMs}ms)`));
            }, timeoutMs);
        });
        return Promise.race([
            promise,
            timeoutPromise,
        ]).finally(() => {
            // 确保定时器被清理，防止内存泄露和进程挂起
            clearTimeout(timeoutHandle);
        });
    }
}
//# sourceMappingURL=tool-registry.js.map