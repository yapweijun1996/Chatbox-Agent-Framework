/**
 * Agent 模式判断工具
 * 判断用户输入应该使用 chat 还是 agent 模式
 */
/**
 * 判断是否应该使用 Agent 模式
 */
export declare function shouldUseAgentMode(message: string, hasTools: boolean): boolean;
/**
 * 格式化 Agent 执行结果为可读文本
 */
export declare function formatAgentResponse(goal: string, steps: Array<{
    description: string;
    status: string;
}>): string;
//# sourceMappingURL=agent-utils.d.ts.map