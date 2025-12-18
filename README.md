# Agent Workflow Framework v0.1

一个产品级 JS Agent Workflow Framework（类似 LangGraph），提供稳定的 Planning、Tool Orchestration、State Management、Error Recovery 能力。

## ✨ 核心特性

- **统一状态管理**：所有数据流经单一 State 容器，可序列化、可恢复
- **可插拔节点系统**：Planner → ToolRunner → Verifier → Responder 完整闭环
- **LLM 集成**：支持 LM Studio 本地 LLM（已配置 `zai-org/glm-4.6v-flash`）
- **工具契约与校验**：使用 Zod 严格校验输入输出，防止契约错误
- **错误分类与恢复**：自动重试（指数退避）、降级、回滚、预算控制
- **Checkpoint 持久化**：支持中断恢复，避免重复调用昂贵工具
- **完整可观测性**：事件流、Debug Bundle 导出、实时进度展示
- **安全控制**：工具权限、SELECT-only SQL、预算限制
- **流式响应 (SSE)**：支持实时打字机效果，提升用户体验

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 配置 LM Studio（可选）

框架已集成 LM Studio 本地 LLM 支持。如需使用：

1. 启动 LM Studio 并加载模型 `zai-org/glm-4.6v-flash`
2. 确保 API 地址为 `http://127.0.0.1:6354`
3. 查看 [LM Studio 配置指南](docs/LM_STUDIO_SETUP.md)

### 运行 Demo

```bash
npm run dev
```

访问 `http://localhost:5173/demo/demo.html`

### 基础用法（推荐）

```typescript
import { createAgent, getExampleTools } from './src/index';

// 创建 Agent
const agent = createAgent({
  provider: {
    type: 'lm-studio',
    baseURL: 'http://127.0.0.1:6354',
    model: 'zai-org/glm-4.6v-flash',
  },
  tools: getExampleTools(),
  mode: 'auto', // 自动判断使用 chat 或 agent 模式
});

// 简单对话
const response = await agent.chat('Hello!');
console.log(response.content);

// 复杂任务（自动触发 Agent 模式）
const result = await agent.chat('Query the database for user statistics');
console.log('Steps:', result.steps);
console.log('Response:', result.content);

// 流式输出
await agent.chat('Tell me a story', {
  stream: true,
  onStream: (chunk) => process.stdout.write(chunk),
});
```

### 高级用法（GraphRunner）

```typescript
import {
  createState,
  GraphRunner,
  ToolRegistry,
  LLMPlannerNode,
  ToolRunnerNode,
  VerifierNode,
  ResponderNode,
  getExampleTools,
} from './src/index';

// 1. 注册工具
const toolRegistry = new ToolRegistry();
getExampleTools().forEach(tool => toolRegistry.register(tool));

// 2. 定义流程图
const graph = {
  nodes: [
    new LLMPlannerNode(toolRegistry),
    new ToolRunnerNode(toolRegistry),
    new VerifierNode(),
    new ResponderNode(),
  ],
  edges: [
    { from: 'planner', to: 'tool-runner' },
    { from: 'tool-runner', to: 'verifier' },
    { from: 'verifier', to: 'responder' },
  ],
  entryNode: 'planner',
  maxSteps: 50,
};

// 3. 创建 Runner 并执行
const runner = new GraphRunner(graph);
const initialState = createState('优化这段 SQL 并保持结果一致', {
  permissions: { 'sql:read': true, 'document:read': true },
});

const result = await runner.execute(initialState);
console.log('最终结果:', result.state);
```

## 📦 项目结构

```
src/
├── core/              # 核心框架
│   ├── types.ts       # 类型定义
│   ├── state.ts       # State 管理
│   ├── event-stream.ts # 事件流
│   ├── tool-registry.ts # 工具注册
│   ├── error-handler.ts # 错误处理
│   ├── node.ts        # Node 基类
│   ├── runner.ts      # 执行器
│   └── debug-bundle.ts # Debug 导出
├── nodes/             # 节点实现
│   ├── planner.ts
│   ├── tool-runner.ts
│   ├── verifier.ts
│   └── responder.ts
├── tools/             # 示例工具
│   └── example-tools.ts
├── adapters/          # 持久化适配器
│   └── indexeddb-adapter.ts
└── index.ts           # 主入口

demo/                  # Demo 应用
├── demo.html
├── demo.ts
└── demo.css

docs/                  # 文档
├── EXTENDING.md       # 扩展指南
└── DEBUG_BUNDLE_FORMAT.md # Debug Bundle 格式
```

## 📚 文档

- [扩展指南](docs/EXTENDING.md) - 如何新增节点、工具、持久化
- [Debug Bundle 格式](docs/DEBUG_BUNDLE_FORMAT.md) - 调试信息导出格式
- [LM Studio 配置](docs/LM_STUDIO_SETUP.md) - 本地 LLM 集成指南

## 🔧 核心概念

### State（状态容器）

所有数据流经单一 State，包含：
- `conversation`: 消息历史
- `task`: 任务目标、计划、步骤、进度
- `memory`: 短期/长期记忆
- `artifacts`: 工具结果、文件等
- `telemetry`: 耗时、token、调用次数
- `policy`: 预算、权限、重试策略

### Node（节点）

所有节点实现统一接口：`execute(state: State) => Promise<NodeResult>`

内置节点：
- **Planner**: 解析目标，生成计划与步骤
- **ToolRunner**: 执行工具调用
- **Verifier**: 验证结果有效性
- **Responder**: 汇总结果，生成答复

### Tool（工具）

工具必须注册并声明：
- `inputSchema` / `outputSchema`: Zod schema 校验
- `timeout`: 超时时间
- `retryPolicy`: 重试策略
- `permissions`: 所需权限
- `allowedNodes`: 允许调用的节点
- `execute(input, context)`: 支持 `context.onStream` 回调实现流式输出

### Error Handling（错误处理）

错误分类：
- `network` / `timeout`: 可重试
- `permission` / `validation`: 不可重试
- `budget_exceeded`: 直接终止

策略：
- 重试（指数退避）
- 降级（备用工具）
- 回滚（恢复 checkpoint）
- 终止（带原因）

### Checkpoint（检查点）

每个节点完成后自动保存 checkpoint，包含：
- 完整 State 快照
- 事件流索引
- 时间戳

支持从 checkpoint 恢复，避免重复工具调用。

## 🛡️ 安全特性

- **SQL 工具**: 默认 SELECT-only，拒绝 INSERT/UPDATE/DELETE
- **权限控制**: 工具必须声明所需权限，State 必须授予
- **预算限制**: 最大工具调用次数、总耗时、重试次数
- **契约校验**: 输入输出严格校验，防止意外数据

## 🧪 测试

```bash
npm run test
npm run test:coverage
```

## 📝 License

MIT

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📧 联系

如有问题，请提交 Issue。
