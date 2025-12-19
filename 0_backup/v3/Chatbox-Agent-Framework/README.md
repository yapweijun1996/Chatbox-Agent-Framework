# Agent Workflow Framework

[![npm version](https://img.shields.io/npm/v/agent-workflow-framework.svg)](https://www.npmjs.com/package/agent-workflow-framework)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-236%20passing-brightgreen.svg)](https://github.com/yapweijun1996/Chatbox-Agent-Framework)

一个生产级的 JavaScript/TypeScript AI Agent 工作流框架，提供规划、工具编排、状态管理和错误恢复等核心功能。

## ✨ 特性

- 🤖 **智能 Agent 系统** - 支持 chat/agent/auto 三种运行模式
- 🧠 **记忆系统** - 短期/长期记忆管理，支持语义搜索
- 🔧 **LLM 服务层** - 中间件、缓存、重试、统计等高级功能
- 🛠️ **工具编排** - 动态工具注册和执行
- 📊 **状态管理** - 不可变状态、检查点、回滚
- 🔄 **错误恢复** - 自动重试、降级策略
- ⏸️ **中断/恢复** - 支持长时间运行的任务
- 📈 **事件流** - 完整的事件系统和进度追踪
- 🎯 **TypeScript** - 完整的类型定义
- ✅ **高测试覆盖** - 236 个测试用例全部通过

## 📦 安装

```bash
npm install agent-workflow-framework
```

## 🚀 快速开始

### 基础 Agent 使用

```typescript
import { createAgent, createLLMProvider } from 'agent-workflow-framework';

// 创建 LLM Provider
const provider = createLLMProvider({
    type: 'lm-studio',
    baseURL: 'http://localhost:1234/v1',
    model: 'qwen2.5-coder-7b-instruct',
});

// 创建 Agent
const agent = createAgent({
    llmProvider: provider,
    mode: 'chat', // 或 'agent', 'auto'
});

// 发送消息
const result = await agent.chat('你好，请帮我分析这段代码');
console.log(result.response);
```

### 使用记忆系统

```typescript
import { createMemoryManager, SimpleTFIDFEmbedding } from 'agent-workflow-framework';

// 创建记忆管理器
const memory = createMemoryManager({
    shortTermMaxSize: 1000,
    autoConsolidate: true,
}, undefined, new SimpleTFIDFEmbedding());

// 记住信息
memory.remember('用户偏好使用深色主题', {
    tags: ['ui', 'preference'],
    importance: 0.8,
});

// 回忆信息
const results = await memory.recall({ tags: ['ui'] });

// 语义搜索
const relevant = await memory.longTerm.search('界面设置');
```

### 使用 LLM 服务层

```typescript
import { 
    createLLMService, 
    createSystemPromptMiddleware,
    createLoggingMiddleware 
} from 'agent-workflow-framework';

// 创建服务
const service = createLLMService(provider, {
    cache: { enabled: true, ttl: 60000 },
    retry: { maxRetries: 3 },
});

// 添加中间件
const logging = createLoggingMiddleware();
service.useRequest(logging.request);
service.useResponse(logging.response);
service.useRequest(createSystemPromptMiddleware('You are a helpful assistant.'));

// 发送请求
const result = await service.chat({
    messages: [{ role: 'user', content: 'Hello!' }],
});

// 查看统计
console.log(service.getStats());
```

### 注册和使用工具

```typescript
import { ToolRegistry } from 'agent-workflow-framework';

const registry = new ToolRegistry();

// 注册工具
registry.register({
    name: 'searchDatabase',
    description: 'Search the database for information',
    schema: {
        type: 'object',
        properties: {
            query: { type: 'string' },
            limit: { type: 'number' },
        },
        required: ['query'],
    },
    execute: async (params) => {
        // 执行搜索
        return { results: [...] };
    },
});

// 在 Agent 中使用
const agent = createAgent({
    llmProvider: provider,
    toolRegistry: registry,
    mode: 'agent', // 启用工具调用
});
```

## 📚 核心概念

### Agent 模式

| 模式 | 描述 | 使用场景 |
|------|------|---------|
| **chat** | 直接对话，不使用工具 | 简单问答、对话 |
| **agent** | 使用工具执行任务 | 需要工具调用的复杂任务 |
| **auto** | 自动选择模式 | 通用场景 |

### 状态管理

```typescript
import { createState, updateState } from 'agent-workflow-framework';

// 创建状态
const state = createState({
    user: 'Alice',
    task: 'analyze_data',
});

// 更新状态（不可变）
const newState = updateState(state, {
    progress: 0.5,
    status: 'processing',
});
```

### 事件系统

```typescript
import { EventStream } from 'agent-workflow-framework';

const eventStream = new EventStream();

// 监听事件
eventStream.on('progress', (event) => {
    console.log(`Progress: ${event.progress}%`);
});

eventStream.on('tool_start', (event) => {
    console.log(`Tool ${event.tool} started`);
});

// 在 Agent 中使用
const agent = createAgent({
    llmProvider: provider,
    eventStream,
});
```

### 中断和恢复

```typescript
import { createAbortController } from 'agent-workflow-framework';

// 创建中断控制器
const abortController = createAbortController();

// 开始任务
const resultPromise = agent.chat('执行长时间任务', {
    abortController,
});

// 中断任务
setTimeout(() => {
    abortController.abort('用户取消');
}, 5000);

// 恢复任务
const checkpoint = abortController.getCurrentCheckpoint();
if (checkpoint) {
    const resumedResult = await agent.resume(checkpoint);
}
```

## 🔧 API 文档

### Agent

```typescript
class Agent {
    // 发送消息
    chat(message: string, options?: ChatOptions): Promise<AgentResult>
    
    // 中断执行
    abort(reason?: string): void
    
    // 恢复执行
    resume(checkpoint: Checkpoint): Promise<AgentResult>
    
    // 检查状态
    isAgentRunning(): boolean
}
```

### MemoryManager

```typescript
interface MemoryManager {
    // 记住信息
    remember<T>(content: T, options?): Promise<string> | string
    
    // 回忆信息
    recall<T>(query): Promise<MemoryItem<T>[]>
    
    // 提升到长期记忆
    promoteToLongTerm(key: string): Promise<string | null>
    
    // 获取统计
    getStats(): MemoryStats
}
```

### LLMService

```typescript
class LLMService {
    // 发送请求
    chat(request: ChatRequest, options?): Promise<LLMResult>
    
    // 流式请求
    chatStream(request: ChatRequest, options?): Promise<LLMStreamResult>
    
    // 添加中间件
    useRequest(middleware: LLMRequestMiddleware): this
    useResponse(middleware: LLMResponseMiddleware): this
    useError(middleware: LLMErrorMiddleware): this
    
    // 获取统计
    getStats(): LLMAggregateStats
}
```

## 📖 更多文档

- [记忆系统指南](./docs/MEMORY_SYSTEM.md)
- [核心原则](./docs/agent/CORE_PRINCIPLES.md)
- [编码标准](./docs/agent/CODING_STANDARDS.md)
- [常见模式](./docs/agent/COMMON_PATTERNS.md)

## 🧪 测试

```bash
# 运行测试
npm test

# 运行测试（单次）
npm run test:run

# 生成覆盖率报告
npm run test:coverage
```

## 🏗️ 构建

```bash
# 构建库
npm run build:lib

# 构建 Demo
npm run build
```

## 📊 架构

```
agent-workflow-framework/
├── src/
│   ├── core/              # 核心模块
│   │   ├── agent.ts       # Agent 核心逻辑
│   │   ├── state.ts       # 状态管理
│   │   ├── event-stream.ts # 事件系统
│   │   ├── llm-provider.ts # LLM 抽象层
│   │   ├── llm-service/   # LLM 服务层
│   │   ├── memory/        # 记忆系统
│   │   └── ...
│   ├── nodes/             # 工作流节点
│   ├── providers/         # LLM Provider 实现
│   ├── tools/             # 示例工具
│   └── index.ts           # 主入口
├── tests/                 # 测试文件
└── docs/                  # 文档
```

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详情。

## 📄 许可证

[MIT](./LICENSE)

## 🙏 致谢

本项目受到以下项目的启发：
- [LangGraph](https://github.com/langchain-ai/langgraph)
- [CrewAI](https://github.com/joaomdmoura/crewAI)
- [AutoGPT](https://github.com/Significant-Gravitas/AutoGPT)

## 🔗 相关链接

- [GitHub Repository](https://github.com/yapweijun1996/Chatbox-Agent-Framework)
- [NPM Package](https://www.npmjs.com/package/agent-workflow-framework)
- [Issues](https://github.com/yapweijun1996/Chatbox-Agent-Framework/issues)
- [Changelog](./CHANGELOG.md)

## 💬 支持

如果您遇到问题或有建议，请：
1. 查看 [文档](./docs/)
2. 搜索 [已有 Issues](https://github.com/yapweijun1996/Chatbox-Agent-Framework/issues)
3. 创建 [新 Issue](https://github.com/yapweijun1996/Chatbox-Agent-Framework/issues/new)

---

**Made with ❤️ for the AI Agent Community**
