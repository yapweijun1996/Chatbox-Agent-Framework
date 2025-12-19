# LLM Provider 使用指南

## 概述

**LLM Provider** 是 Chatbox-Agent-Framework 的核心抽象层，提供统一的接口来调用不同的 LLM 服务（OpenAI、Gemini、LM Studio 等）。

## 核心优势

✅ **统一接口** - 无论底层使用哪个 LLM，代码保持一致  
✅ **类型安全** - 完整的 TypeScript 类型支持  
✅ **流式支持** - 原生支持流式响应  
✅ **错误处理** - 统一的错误类型和处理机制  
✅ **易于切换** - 一行代码切换不同的 LLM 提供商  

---

## 快速开始

### 1. 创建 Provider

#### OpenAI

```typescript
import { createLLMProvider } from './src/index';

const provider = createLLMProvider({
    type: 'openai',
    apiKey: 'your-api-key',
    model: 'gpt-4o-mini',
    temperature: 0.7,
});
```

#### Google Gemini

```typescript
const provider = createLLMProvider({
    type: 'gemini',
    apiKey: 'your-gemini-api-key',
    model: 'gemini-2.0-flash-exp',
});
```

#### LM Studio (本地)

```typescript
const provider = createLLMProvider({
    type: 'lm-studio',
    baseURL: 'http://127.0.0.1:6354',
    model: 'zai-org/glm-4.6v-flash',
});
```

### 2. 基本调用

```typescript
// 简单对话
const response = await provider.complete(
    "Explain quantum computing in one sentence",
    "You are a helpful assistant"
);

console.log(response); // "Quantum computing uses..."
```

### 3. 多轮对话

```typescript
const messages = [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'What is TypeScript?' },
    { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript...' },
    { role: 'user', content: 'What are its benefits?' },
];

const response = await provider.chat({ messages });

console.log(response.content);
console.log(response.usage); // { promptTokens, completionTokens, totalTokens }
```

### 4. 流式响应

```typescript
const stream = provider.chatStream({
    messages: [
        { role: 'user', content: 'Write a poem about TypeScript' }
    ],
    temperature: 0.9,
});

for await (const chunk of stream) {
    process.stdout.write(chunk.delta);
    
    if (chunk.finishReason) {
        console.log(`\n[Finished: ${chunk.finishReason}]`);
    }
}
```

---

## 在框架中使用

### 方式 1: 从设置创建

```typescript
import { createProviderFromSettings } from './src/index';
import { loadSettings } from './demo/settings';

const settings = loadSettings();
const provider = createProviderFromSettings(settings);
```

### 方式 2: 在 Node 中直接使用

```typescript
import { LLMProvider, ChatMessage } from './src/index';

export class MyCustomNode extends BaseNode {
    constructor(private llmProvider: LLMProvider) {
        super('my-node', 'My Custom Node');
    }

    async execute(state: State): Promise<NodeResult> {
        const messages: ChatMessage[] = [
            { role: 'system', content: 'You are an agent planner' },
            { role: 'user', content: state.task.goal },
        ];

        const response = await this.llmProvider.chat({ messages });

        const newState = updateState(state, draft => {
            draft.task.plan = response.content;
        });

        return this.createResult(newState, []);
    }
}
```

---

## API 参考

### `ChatRequest`

```typescript
interface ChatRequest {
    messages: ChatMessage[];
    temperature?: number;      // 0.0 - 2.0, 默认 0.7
    maxTokens?: number;        // 默认 2048
    topP?: number;             // 0.0 - 1.0
    stopSequences?: string[];
    stream?: boolean;
}
```

### `ChatResponse`

```typescript
interface ChatResponse {
    content: string;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model?: string;
}
```

### `ChatMessage`

```typescript
interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;           // 用于 tool 消息
    toolCallId?: string;     // 用于 tool response
}
```

---

## 高级用法

### 错误处理

```typescript
import { LLMProviderError } from './src/index';

try {
    const response = await provider.chat({ messages });
} catch (error) {
    if (error instanceof LLMProviderError) {
        console.error(`Provider: ${error.provider}`);
        console.error(`Status: ${error.statusCode}`);
        console.error(`Message: ${error.message}`);
    }
}
```

### 自定义超时

```typescript
const provider = createLLMProvider({
    type: 'openai',
    apiKey: 'your-key',
    model: 'gpt-4o',
    timeout: 30000, // 30 秒
});
```

### 混合使用多个 Provider

```typescript
const fastProvider = createLLMProvider({
    type: 'gemini',
    apiKey: 'key',
    model: 'gemini-2.0-flash-exp',
});

const smartProvider = createLLMProvider({
    type: 'openai',
    apiKey: 'key',
    model: 'gpt-4o',
});

// 简单任务用快速模型
const quickAnswer = await fastProvider.complete('2+2=?');

// 复杂任务用强大模型
const deepAnalysis = await smartProvider.complete('Analyze this...');
```

---

## 迁移指南

### 从旧版 Tool API 迁移

**旧版（Tool-based）**:
```typescript
const lmStudioTool = createLMStudioTool(defaultLMStudioConfig);
toolRegistry.register(lmStudioTool);

const result = await toolRegistry.execute('lm-studio-llm', {
    prompt: 'Hello',
    systemPrompt: 'You are helpful',
});
```

**新版（Provider-based）**:
```typescript
const provider = createLLMProvider({
    type: 'lm-studio',
    baseURL: 'http://127.0.0.1:6354',
    model: 'zai-org/glm-4.6v-flash',
});

const response = await provider.complete('Hello', 'You are helpful');
```

---

## 最佳实践

1. **使用工厂模式**: 优先使用 `createLLMProvider` 而不是直接实例化。
2. **复用 Provider**: 创建一次，多次使用，避免重复创建。
3. **错误处理**: 始终捕获 `LLMProviderError`。
4. **流式响应**: 长文本生成使用 `chatStream` 提升用户体验。
5. **Token 管理**: 监控 `usage` 字段控制成本。

---

## 下一步

- 查看 `examples/` 目录的完整示例
- 阅读 `EXTENDING.md` 了解如何创建自定义 Provider
- 参考 `src/nodes/llm-planner.ts` 了解在 Node 中的使用
