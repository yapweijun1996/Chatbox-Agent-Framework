/**
 * 工具注册中心
 * 管理工具注册、校验、调用
 */

import type { Tool, ToolStreamChunk } from './types';
import { z } from 'zod';

export interface ToolRegistryPolicy {
    allowlist?: string[];
    denylist?: string[];
    defaultTimeoutMs?: number;
    maxTimeoutMs?: number;
    perToolTimeoutMs?: Record<string, number>;
}

export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();
    private policy?: ToolRegistryPolicy;

    constructor(policy?: ToolRegistryPolicy) {
        this.policy = policy;
    }

    setPolicy(policy?: ToolRegistryPolicy): void {
        this.policy = policy;
    }

    /**
     * 注册工具
     */
    register(tool: Tool): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`工具 "${tool.name}" 已注册`);
        }
        this.tools.set(tool.name, tool);
    }

    /**
     * 批量注册工具
     */
    registerAll(tools: Tool[]): void {
        tools.forEach(tool => this.register(tool));
    }

    /**
     * 获取工具
     */
    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * 检查工具是否存在
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * 获取所有工具名称
     */
    list(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * 校验输入
     */
    validateInput(toolName: string, input: unknown): { valid: boolean; error?: string; data?: unknown } {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return { valid: false, error: `工具 "${toolName}" 不存在` };
        }

        try {
            const data = tool.inputSchema.parse(input);
            return { valid: true, data };
        } catch (error) {
            if (error instanceof z.ZodError) {
                return { valid: false, error: `输入校验失败: ${error.errors.map(e => e.message).join(', ')}` };
            }
            return { valid: false, error: String(error) };
        }
    }

    /**
     * 校验输出
     */
    validateOutput(toolName: string, output: unknown): { valid: boolean; error?: string; data?: unknown } {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return { valid: false, error: `工具 "${toolName}" 不存在` };
        }

        try {
            const data = tool.outputSchema.parse(output);
            return { valid: true, data };
        } catch (error) {
            if (error instanceof z.ZodError) {
                return { valid: false, error: `输出校验失败: ${error.errors.map(e => e.message).join(', ')}` };
            }
            return { valid: false, error: String(error) };
        }
    }

    /**
     * 检查权限
     */
    checkPermission(toolName: string, permissions: Record<string, boolean>): boolean {
        const tool = this.tools.get(toolName);
        if (!tool) return false;

        // 如果工具没有权限要求，默认允许
        if (!tool.permissions || tool.permissions.length === 0) {
            return true;
        }

        const mode = tool.permissionsMode ?? 'all';
        if (mode === 'any') {
            return tool.permissions.some(perm => permissions[perm] === true);
        }
        // 检查是否拥有所有必需权限
        return tool.permissions.every(perm => permissions[perm] === true);
    }

    /**
     * 检查节点是否允许调用工具
     */
    checkNodeAllowed(toolName: string, nodeId: string): boolean {
        const tool = this.tools.get(toolName);
        if (!tool) return false;

        // 如果没有节点白名单，默认允许所有节点
        if (!tool.allowedNodes || tool.allowedNodes.length === 0) {
            return true;
        }

        return tool.allowedNodes.includes(nodeId);
    }

    checkRoleAllowed(toolName: string, roles?: string[]): boolean {
        const tool = this.tools.get(toolName);
        if (!tool) return false;
        const currentRoles = roles || [];

        if (tool.deniedRoles?.some(role => currentRoles.includes(role))) {
            return false;
        }

        if (!tool.allowedRoles || tool.allowedRoles.length === 0) {
            return true;
        }

        return tool.allowedRoles.some(role => currentRoles.includes(role));
    }

    /**
     * 执行工具（带超时控制）
     */
    async execute(
        toolName: string,
        input: unknown,
        options?: {
            nodeId?: string;
            permissions?: Record<string, boolean>;
            roles?: string[];
            onStream?: (chunk: ToolStreamChunk) => void;
        }
    ): Promise<{ success: boolean; output?: unknown; error?: string }> {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return { success: false, error: `工具 "${toolName}" 不存在` };
        }

        // 全局工具白名单/黑名单
        if (!this.isToolAllowed(toolName)) {
            return { success: false, error: `工具 "${toolName}" 被工具策略阻止` };
        }

        // 检查节点权限
        if (options?.nodeId && !this.checkNodeAllowed(toolName, options.nodeId)) {
            return { success: false, error: `节点 "${options.nodeId}" 不允许调用工具 "${toolName}"` };
        }

        // 检查用户权限
        if (options?.permissions && !this.checkPermission(toolName, options.permissions)) {
            return { success: false, error: `缺少必需权限: ${tool.permissions.join(', ')}` };
        }

        if (!this.checkRoleAllowed(toolName, options?.roles)) {
            return { success: false, error: `角色无权调用工具 "${toolName}"` };
        }

        // 校验输入
        const inputValidation = this.validateInput(toolName, input);
        if (!inputValidation.valid) {
            return { success: false, error: inputValidation.error };
        }

        try {
            const timeoutMs = this.resolveTimeout(toolName, tool.timeout);
            const executionMode = tool.execution?.mode ?? 'main';
            let output: unknown;

            if (executionMode === 'child-process') {
                const modulePath = tool.execution?.modulePath;
                if (!modulePath) {
                    return { success: false, error: `工具 "${toolName}" 缺少 child-process modulePath` };
                }
                const childExecution = await this.executeInChildProcess(
                    modulePath,
                    tool.execution?.exportName,
                    inputValidation.data,
                    {
                        execArgv: tool.execution?.childProcessExecArgv,
                        resourceLimits: tool.execution?.resourceLimits,
                    }
                );
                output = await this.executeWithTimeout(childExecution.promise, timeoutMs, childExecution.cancel);
            } else if (executionMode === 'worker') {
                const modulePath = tool.execution?.modulePath;
                if (!modulePath) {
                    return { success: false, error: `工具 "${toolName}" 缺少 worker modulePath` };
                }
                const workerExecution = await this.executeInWorker(
                    tool.execution?.workerScript,
                    modulePath,
                    tool.execution?.exportName,
                    inputValidation.data,
                    tool.execution?.resourceLimits
                );
                output = await this.executeWithTimeout(workerExecution.promise, timeoutMs, workerExecution.cancel);
            } else {
                output = await this.executeWithTimeout(
                    tool.execute(inputValidation.data, {
                        onStream: options?.onStream,
                    }),
                    timeoutMs
                );
            }

            // 校验输出
            const outputValidation = this.validateOutput(toolName, output);
            if (!outputValidation.valid) {
                return { success: false, error: `契约错误: ${outputValidation.error}` };
            }

            return { success: true, output: outputValidation.data };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    private executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout?: () => void): Promise<T> {
        let timeoutHandle: ReturnType<typeof setTimeout>;

        const timeoutPromise = new Promise<T>((_, reject) => {
            timeoutHandle = setTimeout(() => {
                onTimeout?.();
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

    private isToolAllowed(toolName: string): boolean {
        if (!this.policy) return true;

        const allowlist = this.policy.allowlist;
        const denylist = this.policy.denylist;

        if (Array.isArray(denylist) && denylist.includes(toolName)) {
            return false;
        }

        if (Array.isArray(allowlist) && allowlist.length > 0) {
            return allowlist.includes(toolName);
        }

        return true;
    }

    private resolveTimeout(toolName: string, toolTimeout: number): number {
        const policy = this.policy;
        if (!policy) return toolTimeout;

        const perTool = policy.perToolTimeoutMs?.[toolName];
        const baseTimeout = perTool ?? toolTimeout ?? policy.defaultTimeoutMs ?? 0;
        const maxTimeout = policy.maxTimeoutMs;

        if (maxTimeout !== undefined) {
            return Math.min(baseTimeout, maxTimeout);
        }

        return baseTimeout;
    }

    private async executeInChildProcess(
        modulePath: string,
        exportName: string | undefined,
        input: unknown,
        options?: {
            execArgv?: string[];
            resourceLimits?: {
                maxOldGenerationSizeMb?: number;
                maxYoungGenerationSizeMb?: number;
                stackSizeMb?: number;
            };
        }
    ): { promise: Promise<unknown>; cancel: () => void } {
        const { spawn } = await import('node:child_process');
        const { fileURLToPath, pathToFileURL } = await import('node:url');
        const runnerPath = fileURLToPath(new URL('./tool-sandbox/child-process-runner.mjs', import.meta.url));
        const execArgv = [
            ...(options?.execArgv ?? []),
            ...this.buildChildProcessArgv(options?.resourceLimits),
        ];
        const child = spawn(process.execPath, [...execArgv, runnerPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        const promise = new Promise<unknown>((resolve, reject) => {
            child.stdout.on('data', chunk => {
                stdout += String(chunk);
            });
            child.stderr.on('data', chunk => {
                stderr += String(chunk);
            });
            child.on('error', err => reject(err));
            child.on('close', () => {
                if (!stdout.trim()) {
                    return reject(new Error(stderr || '子进程无输出'));
                }
                try {
                    const parsed = JSON.parse(stdout);
                    if (parsed?.success) {
                        return resolve(parsed.output);
                    }
                    return reject(new Error(parsed?.error || '子进程执行失败'));
                } catch (error) {
                    return reject(new Error(`子进程输出解析失败: ${String(error)}`));
                }
            });
        });

        const payload = {
            modulePath: modulePath.startsWith('file:')
                ? modulePath
                : pathToFileURL(modulePath).toString(),
            exportName: exportName || 'execute',
            input,
        };

        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();

        return {
            promise,
            cancel: () => child.kill(),
        };
    }

    private async executeInWorker(
        workerScript: string | undefined,
        modulePath: string,
        exportName: string | undefined,
        input: unknown,
        resourceLimits?: {
            maxOldGenerationSizeMb?: number;
            maxYoungGenerationSizeMb?: number;
            codeRangeSizeMb?: number;
            stackSizeMb?: number;
        }
    ): Promise<{ promise: Promise<unknown>; cancel: () => void }> {
        const payload = {
            modulePath: modulePath.startsWith('file:')
                ? modulePath
                : modulePath,
            exportName: exportName || 'execute',
            input,
        };

        if (typeof Worker !== 'undefined') {
            const workerUrl = workerScript
                ? workerScript
                : new URL('./tool-sandbox/worker-runner.mjs', import.meta.url).toString();
            const worker = new Worker(workerUrl, { type: 'module' });

            const promise = new Promise<unknown>((resolve, reject) => {
                worker.onmessage = (event: MessageEvent) => {
                    const data = event.data;
                    if (data?.success) {
                        resolve(data.output);
                    } else {
                        reject(new Error(data?.error || 'Worker 执行失败'));
                    }
                    worker.terminate();
                };
                worker.onerror = (event: Event) => {
                    reject(new Error((event as ErrorEvent).message || 'Worker 错误'));
                    worker.terminate();
                };
            });

            worker.postMessage(payload);
            return {
                promise,
                cancel: () => worker.terminate(),
            };
        }

        const { pathToFileURL } = await import('node:url');
        const { Worker: NodeWorker } = await import('node:worker_threads');
        const workerPath = workerScript
            ? workerScript
            : new URL('./tool-sandbox/worker-runner.mjs', import.meta.url);
        const nodePayload = {
            ...payload,
            modulePath: payload.modulePath.startsWith('file:')
                ? payload.modulePath
                : pathToFileURL(payload.modulePath).toString(),
        };
        const worker = new NodeWorker(workerPath, {
            type: 'module',
            resourceLimits: resourceLimits ?? undefined,
        });

        const promise = new Promise<unknown>((resolve, reject) => {
            worker.on('message', (data: any) => {
                if (data?.success) {
                    resolve(data.output);
                } else {
                    reject(new Error(data?.error || 'Worker 执行失败'));
                }
                worker.terminate();
            });
            worker.on('error', (error: Error) => {
                reject(error);
                worker.terminate();
            });
            worker.on('exit', (code: number) => {
                if (code !== 0) {
                    reject(new Error(`Worker 异常退出 (${code})`));
                }
            });
        });

        worker.postMessage(nodePayload);

        return {
            promise,
            cancel: () => worker.terminate(),
        };
    }

    private buildChildProcessArgv(resourceLimits?: {
        maxOldGenerationSizeMb?: number;
        maxYoungGenerationSizeMb?: number;
        stackSizeMb?: number;
    }): string[] {
        if (!resourceLimits) return [];

        const args: string[] = [];
        if (resourceLimits.maxOldGenerationSizeMb !== undefined) {
            args.push(`--max-old-space-size=${resourceLimits.maxOldGenerationSizeMb}`);
        }
        if (resourceLimits.maxYoungGenerationSizeMb !== undefined) {
            args.push(`--max-semi-space-size=${resourceLimits.maxYoungGenerationSizeMb}`);
        }
        if (resourceLimits.stackSizeMb !== undefined) {
            args.push(`--stack_size=${resourceLimits.stackSizeMb}`);
        }
        return args;
    }
}
