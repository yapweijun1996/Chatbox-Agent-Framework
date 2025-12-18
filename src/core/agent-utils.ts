/**
 * Agent 模式判断工具
 * 判断用户输入应该使用 chat 还是 agent 模式
 */

/** 简单问候列表 */
const GREETINGS = ['hi', 'hello', 'hey', '你好', '嗨', 'thanks', 'thank you', '谢谢'];

/** 简单问题模式 */
const SIMPLE_PATTERNS = [
    /^what is your name/,
    /^who are you/,
    /^你是谁/,
    /^how are you/,
    /^你好吗/,
];

/** 复杂任务关键词 */
const TASK_KEYWORDS = [
    'search', 'find', 'query', 'analyze', 'research',
    'create', 'generate', 'build', 'make', 'write',
    '搜索', '查询', '分析', '研究', '创建', '生成', '编写',
    'sql', 'database', '数据库',
    'optimize', '优化',
    'calculate', '计算',
    'summarize', '总结',
];

/**
 * 判断是否应该使用 Agent 模式
 */
export function shouldUseAgentMode(message: string, hasTools: boolean): boolean {
    // 如果没有注册工具，只能用 chat 模式
    if (!hasTools) {
        return false;
    }

    const lowerMessage = message.toLowerCase().trim();

    // 简单问候 -> Chat
    if (GREETINGS.some(g => lowerMessage === g || lowerMessage.startsWith(g + ' '))) {
        return false;
    }

    // 简单问题 -> Chat
    if (SIMPLE_PATTERNS.some(p => p.test(lowerMessage))) {
        return false;
    }

    // 复杂任务关键词 -> Agent
    if (TASK_KEYWORDS.some(k => lowerMessage.includes(k))) {
        return true;
    }

    // 默认使用 Chat
    return false;
}

/**
 * 格式化 Agent 执行结果为可读文本
 */
export function formatAgentResponse(
    goal: string,
    steps: Array<{ description: string; status: string }>
): string {
    const completedSteps = steps.filter(s => s.status === 'completed');

    let response = `任务已完成！\n\n`;
    response += `**目标**: ${goal}\n\n`;

    if (completedSteps.length > 0) {
        response += `**执行步骤**:\n`;
        completedSteps.forEach((step, i) => {
            response += `${i + 1}. ${step.description}\n`;
        });
    }

    return response;
}
