/**
 * LLM Provider 使用示例
 * 演示如何使用统一的 LLM Provider 接口
 */

import {
    createLLMProvider,
    createProviderFromSettings,
    type ChatMessage,
} from '../src/index';

// ============================================
// 示例 1: 创建不同的 Provider
// ============================================

async function example1_CreateProviders() {
    console.log('=== 示例 1: 创建 Provider ===\n');

    // LM Studio (本地)
    const lmStudioProvider = createLLMProvider({
        type: 'lm-studio',
        baseURL: 'http://127.0.0.1:6354',
        model: 'zai-org/glm-4.6v-flash',
    });
    console.log(`✓ ${lmStudioProvider.getProviderName()} Provider 已创建`);

    // Gemini
    const geminiProvider = createLLMProvider({
        type: 'gemini',
        apiKey: 'your-gemini-api-key',
        model: 'gemini-2.0-flash-exp',
    });
    console.log(`✓ ${geminiProvider.getProviderName()} Provider 已创建`);

    // OpenAI
    const openaiProvider = createLLMProvider({
        type: 'openai',
        apiKey: 'your-openai-api-key',
        model: 'gpt-4o-mini',
    });
    console.log(`✓ ${openaiProvider.getProviderName()} Provider 已创建\n`);
}

// ============================================
// 示例 2: 简单对话
// ============================================

async function example2_SimpleChat() {
    console.log('=== 示例 2: 简单对话 ===\n');

    const provider = createLLMProvider({
        type: 'lm-studio',
        baseURL: 'http://127.0.0.1:6354',
        model: 'zai-org/glm-4.6v-flash',
    });

    try {
        const response = await provider.complete(
            'What is the capital of France?',
            'You are a knowledgeable assistant'
        );

        console.log('Question: What is the capital of France?');
        console.log(`Answer: ${response}\n`);
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================
// 示例 3: 多轮对话
// ============================================

async function example3_MultiTurnChat() {
    console.log('=== 示例 3: 多轮对话 ===\n');

    const provider = createLLMProvider({
        type: 'lm-studio',
        baseURL: 'http://127.0.0.1:6354',
        model: 'zai-org/glm-4.6v-flash',
    });

    const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful coding assistant' },
        { role: 'user', content: 'What is TypeScript?' },
    ];

    try {
        // 第一轮
        const response1 = await provider.chat({ messages });
        console.log('User: What is TypeScript?');
        console.log(`Assistant: ${response1.content}\n`);

        // 添加第一轮的响应
        messages.push({ role: 'assistant', content: response1.content });

        // 第二轮
        messages.push({ role: 'user', content: 'Give me a simple example' });
        const response2 = await provider.chat({ messages });

        console.log('User: Give me a simple example');
        console.log(`Assistant: ${response2.content}\n`);

        // 显示 Token 使用情况
        if (response2.usage) {
            console.log('Token Usage:');
            console.log(`  Prompt: ${response2.usage.promptTokens}`);
            console.log(`  Completion: ${response2.usage.completionTokens}`);
            console.log(`  Total: ${response2.usage.totalTokens}\n`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================
// 示例 4: 流式响应
// ============================================

async function example4_StreamingChat() {
    console.log('=== 示例 4: 流式响应 ===\n');

    const provider = createLLMProvider({
        type: 'lm-studio',
        baseURL: 'http://127.0.0.1:6354',
        model: 'zai-org/glm-4.6v-flash',
    });

    const messages: ChatMessage[] = [
        { role: 'user', content: 'Write a short poem about coding' },
    ];

    try {
        console.log('User: Write a short poem about coding');
        console.log('Assistant: ');

        const stream = provider.chatStream({ messages, temperature: 0.9 });

        for await (const chunk of stream) {
            process.stdout.write(chunk.delta);

            if (chunk.finishReason) {
                console.log(`\n[Finished: ${chunk.finishReason}]\n`);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================
// 示例 5: 从设置创建 Provider
// ============================================

async function example5_FromSettings() {
    console.log('=== 示例 5: 从设置创建 ===\n');

    const settings = {
        provider: 'lm-studio' as const,
        lmStudio: {
            baseURL: 'http://127.0.0.1:6354',
            model: 'zai-org/glm-4.6v-flash',
        },
        gemini: {
            apiKey: '',
            model: 'gemini-2.0-flash-exp',
        },
        openai: {
            apiKey: '',
            baseURL: 'https://api.openai.com',
            model: 'gpt-4o-mini',
        },
    };

    const provider = createProviderFromSettings(settings);
    console.log(`✓ 从设置创建了 ${provider.getProviderName()} Provider`);
    console.log(`Model: ${provider.getModel()}\n`);
}

// ============================================
// 示例 6: 错误处理
// ============================================

async function example6_ErrorHandling() {
    console.log('=== 示例 6: 错误处理 ===\n');

    const provider = createLLMProvider({
        type: 'lm-studio',
        baseURL: 'http://invalid-url:9999', // 无效的 URL
        model: 'test-model',
    });

    try {
        await provider.complete('Hello');
    } catch (error: any) {
        console.log('✓ 成功捕获错误:');
        console.log(`  Provider: ${error.provider}`);
        console.log(`  Message: ${error.message}`);
        console.log(`  Error Name: ${error.name}\n`);
    }
}

// ============================================
// 运行所有示例
// ============================================

async function runAllExamples() {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   LLM Provider 使用示例集合              ║');
    console.log('╚══════════════════════════════════════════╝\n');

    await example1_CreateProviders();
    // await example2_SimpleChat();         // 需要 LM Studio 运行
    // await example3_MultiTurnChat();      // 需要 LM Studio 运行
    // await example4_StreamingChat();      // 需要 LM Studio 运行
    await example5_FromSettings();
    await example6_ErrorHandling();

    console.log('✓ 所有示例执行完成\n');
}

// 运行示例
runAllExamples();
