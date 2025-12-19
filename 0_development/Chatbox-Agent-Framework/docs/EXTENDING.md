# 扩展指南

本文档说明如何扩展 Agent Workflow Framework。

## 如何新增节点

### 1. 创建节点类

继承 `BaseNode` 并实现 `execute` 方法：

```typescript
import { BaseNode } from '../core/node';
import type { NodeResult, State } from '../core/types';
import { updateState } from '../core/state';

export class MyCustomNode extends BaseNode {
  constructor() {
    super('my-custom-node', 'MyCustomNode');
  }

  async execute(state: State): Promise<NodeResult> {
    const events: NodeResult['events'] = [];

    try {
      // 你的节点逻辑
      const newState = updateState(state, draft => {
        // 修改 state
        draft.task.progress += 10;
      });

      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: 'node_end',
        nodeId: this.id,
        status: 'success',
        summary: '节点执行成功',
      });

      return this.createResult(newState, events);
    } catch (error) {
      events.push({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: 'error',
        nodeId: this.id,
        status: 'failure',
        summary: `节点执行失败: ${error}`,
      });

      throw error;
    }
  }
}
```

### 2. 注册到流程图

```typescript
const graph: GraphDefinition = {
  nodes: [
    new PlannerNode(),
    new MyCustomNode(), // 添加你的节点
    new ResponderNode(),
  ],
  edges: [
    { from: 'planner', to: 'my-custom-node' },
    { from: 'my-custom-node', to: 'responder' },
  ],
  entryNode: 'planner',
  maxSteps: 50,
};
```

---

## 如何新增工具

### 1. 定义工具

使用 Zod 定义输入输出 schema：

```typescript
import { z } from 'zod';
import type { Tool } from '../core/types';

export const myTool: Tool = {
  name: 'my-tool',
  description: '我的自定义工具',
  
  // 输入 schema
  inputSchema: z.object({
    param1: z.string(),
    param2: z.number().optional(),
  }),
  
  // 输出 schema
  outputSchema: z.object({
    result: z.string(),
    metadata: z.record(z.unknown()),
  }),
  
  timeout: 5000,
  
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
  },
  
  permissions: ['my:permission'], // 所需权限
  
  allowedNodes: ['tool-runner'], // 允许调用的节点
  
  async execute(input: unknown) {
    const { param1, param2 } = input as { param1: string; param2?: number };
    
    // 你的工具逻辑
    return {
      result: `处理结果: ${param1}`,
      metadata: { param2 },
    };
  },
};
```

### 2. 注册工具

```typescript
const toolRegistry = new ToolRegistry();
toolRegistry.register(myTool);
```

### 3. 授予权限

```typescript
const state = createState(goal, {
  permissions: {
    'my:permission': true, // 授予权限
  },
});
```

---

## 如何接入持久化

### 1. 实现 PersistenceAdapter 接口

```typescript
import type { Checkpoint, PersistenceAdapter } from '../core/types';

export class MyPersistenceAdapter implements PersistenceAdapter {
  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    // 保存到你的存储（Redis/DB/文件等）
  }

  async loadCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    // 从存储加载
    return null;
  }

  async listCheckpoints(stateId: string): Promise<Checkpoint[]> {
    // 列出所有 checkpoints
    return [];
  }

  async deleteCheckpoint(checkpointId: string): Promise<void> {
    // 删除 checkpoint
  }
}
```

### 2. 传入 Runner

```typescript
const persistence = new MyPersistenceAdapter();
const runner = new GraphRunner(graph, persistence);
```

---

## 如何接入 UI 事件流

### 1. 订阅事件

```typescript
const runner = new GraphRunner(graph, persistence, {
  onNodeStart: (nodeId, state) => {
    console.log(`节点 ${nodeId} 开始执行`);
    // 更新 UI
  },
  
  onNodeEnd: (nodeId, result) => {
    console.log(`节点 ${nodeId} 执行完成`);
    // 更新 UI
  },
  
  onToolCall: (toolName, input) => {
    console.log(`调用工具: ${toolName}`, input);
    // 显示工具调用日志
  },
  
  onError: (error) => {
    console.error('错误:', error);
    // 显示错误提示
  },
  
  onCheckpoint: (checkpoint) => {
    console.log('已保存 checkpoint:', checkpoint.id);
    // 启用恢复按钮
  },
});
```

### 2. 访问事件流

```typescript
const eventStream = runner.getEventStream();

// 订阅所有事件
eventStream.on('*', (event) => {
  console.log('事件:', event);
  // 渲染到 UI
});

// 订阅特定类型事件
eventStream.on('tool_call', (event) => {
  console.log('工具调用:', event);
});

// 获取所有事件
const allEvents = eventStream.getEvents();

// 获取 payload
const payload = eventStream.getPayload(event.payloadRef!);
```

---

## 最佳实践

### 1. 节点设计

- **单一职责**：每个节点只做一件事
- **无副作用**：节点只能通过 State 传递数据，不能直接修改外部状态
- **错误处理**：始终捕获异常并发射 error 事件

### 2. 工具设计

- **严格校验**：使用 Zod schema 确保输入输出结构稳定
- **超时控制**：设置合理的 timeout，避免长时间阻塞
- **权限控制**：敏感操作必须声明所需权限
- **幂等性**：工具应尽可能设计为幂等，便于重试

### 3. 状态管理

- **不可变更新**：始终使用 `updateState` 而非直接修改
- **最小化 State**：只存储必要数据，避免 State 过大
- **结构化 artifacts**：工具输出应存储到 `artifacts`，便于后续引用

### 4. 错误恢复

- **分类错误**：使用正确的 `ErrorType`
- **合理重试**：网络/超时错误可重试，权限/校验错误不应重试
- **降级策略**：提供备用工具或简化输入

---

## 示例：完整的自定义节点与工具

```typescript
// 1. 定义工具
const weatherTool: Tool = {
  name: 'weather',
  description: '查询天气',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ temp: z.number(), condition: z.string() }),
  timeout: 3000,
  retryPolicy: { maxRetries: 2, backoffMs: 500, backoffMultiplier: 2 },
  permissions: ['weather:read'],
  async execute(input: unknown) {
    const { city } = input as { city: string };
    return { temp: 25, condition: 'Sunny' };
  },
};

// 2. 定义节点
class WeatherNode extends BaseNode {
  constructor(private toolRegistry: ToolRegistry) {
    super('weather-node', 'WeatherNode');
  }

  async execute(state: State): Promise<NodeResult> {
    const result = await this.toolRegistry.execute('weather', { city: 'Beijing' });
    
    const newState = updateState(state, draft => {
      draft.artifacts.weather = result.output;
    });

    return this.createResult(newState, []);
  }
}

// 3. 注册并使用
const toolRegistry = new ToolRegistry();
toolRegistry.register(weatherTool);

const graph: GraphDefinition = {
  nodes: [new WeatherNode(toolRegistry)],
  edges: [],
  entryNode: 'weather-node',
  maxSteps: 10,
};

const runner = new GraphRunner(graph);
const result = await runner.execute(createState('查询天气', { permissions: { 'weather:read': true } }));
```
