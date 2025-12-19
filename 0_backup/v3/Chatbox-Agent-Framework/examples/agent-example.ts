/**
 * Agent 使用示例
 * 展示如何使用新的 Agent API
 */

import { createAgent, getExampleTools } from '../src/index';

// ============================================================================
// 示例 1: 简单对话模式
// ============================================================================

async function chatExample() {
    const agent = createAgent({
        provider: {
            type: 'lm-studio',
            baseURL: 'http://127.0.0.1:6354',
            model: 'zai-org/glm-4.6v-flash',
        },
        mode: 'chat', // 强制使用对话模式
        systemPrompt: 'You are a friendly assistant.',
    });

    // 简单对话
    const result = await agent.chat('Hello! How are you?');
    console.log('Response:', result.content);
    console.log('Mode:', result.mode);
    console.log('Duration:', result.duration, 'ms');
}

// ============================================================================
// 示例 2: Agent 模式（带工具）
// ============================================================================

async function agentExample() {
    const agent = createAgent({
        provider: {
            type: 'lm-studio',
            baseURL: 'http://127.0.0.1:6354',
            model: 'zai-org/glm-4.6v-flash',
        },
        tools: getExampleTools(),
        mode: 'agent', // 强制使用 Agent 模式
        maxSteps: 10,
    });

    // 执行复杂任务
    const result = await agent.chat('Search for SQL optimization best practices');
    console.log('Response:', result.content);
    console.log('Mode:', result.mode);
    console.log('Steps:', result.steps);
}

// ============================================================================
// 示例 3: 自动模式（推荐）
// ============================================================================

async function autoModeExample() {
    const agent = createAgent({
        provider: {
            type: 'lm-studio',
            baseURL: 'http://127.0.0.1:6354',
            model: 'zai-org/glm-4.6v-flash',
        },
        tools: getExampleTools(),
        mode: 'auto', // 自动判断使用哪种模式
    });

    // 简单问候 -> 自动使用 Chat 模式
    const greeting = await agent.chat('Hi!');
    console.log('Greeting mode:', greeting.mode); // 'chat'

    // 复杂任务 -> 自动使用 Agent 模式
    const task = await agent.chat('Query the database for user statistics');
    console.log('Task mode:', task.mode); // 'agent'
}

// ============================================================================
// 示例 4: 流式输出
// ============================================================================

async function streamingExample() {
    const agent = createAgent({
        provider: {
            type: 'lm-studio',
            baseURL: 'http://127.0.0.1:6354',
            model: 'zai-org/glm-4.6v-flash',
        },
        streaming: true,
    });

    // 流式输出
    const result = await agent.chat('Tell me a short story', {
        stream: true,
        onStream: (chunk) => {
            process.stdout.write(chunk); // 实时打印
        },
    });

    console.log('\n--- Complete ---');
    console.log('Total content length:', result.content.length);
}

// ============================================================================
// 示例 5: 使用 Gemini Provider
// ============================================================================

async function geminiExample() {
    const agent = createAgent({
        provider: {
            type: 'gemini',
            apiKey: process.env.GEMINI_API_KEY || 'your-api-key',
            model: 'gemini-1.5-flash',
        },
        mode: 'chat',
    });

    const result = await agent.chat('What is the capital of France?');
    console.log('Response:', result.content);
}

// ============================================================================
// 运行示例
// ============================================================================

async function main() {
    console.log('=== Agent Framework Examples ===\n');

    try {
        console.log('1. Chat Example:');
        await chatExample();
    } catch (e) {
        console.log('Chat example skipped:', (e as Error).message);
    }

    console.log('\n');
}

main().catch(console.error);
