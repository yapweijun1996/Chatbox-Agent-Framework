# Debug Bundle 格式说明

Debug Bundle 是框架导出的完整调试信息，包含 State、事件流、checkpoints 等所有运行时数据。

## JSON 结构

```json
{
  "version": "0.1.0",
  "timestamp": 1702886400000,
  "state": { /* State 对象 */ },
  "events": {
    "events": [ /* Event 数组 */ ],
    "payloads": { /* Payload 映射 */ }
  },
  "checkpoints": [ /* Checkpoint 数组（可选） */ ],
  "metadata": {
    "userAgent": "Mozilla/5.0...",
    "platform": "MacIntel",
    /* 其他元数据 */
  }
}
```

## 字段说明

### 顶层字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | string | Debug Bundle 格式版本 |
| `timestamp` | number | 导出时间戳（毫秒） |
| `state` | State | 当前完整 State 对象 |
| `events` | EventsExport | 事件流导出数据 |
| `checkpoints` | Checkpoint[] | Checkpoint 数组（可选） |
| `metadata` | object | 元数据（浏览器信息等） |

### State 对象

```json
{
  "id": "1702886400000-abc123",
  "conversation": {
    "messages": [
      {
        "role": "user",
        "content": "优化这段 SQL",
        "timestamp": 1702886400000
      }
    ],
    "toolResultsSummary": []
  },
  "task": {
    "goal": "优化这段 SQL 并保持结果一致",
    "plan": "1. 分析 SQL\n2. 优化\n3. 验证",
    "steps": [
      {
        "id": "step-1",
        "description": "分析 SQL",
        "status": "completed",
        "result": { /* 结果数据 */ }
      }
    ],
    "currentNode": "tool-runner",
    "currentStepIndex": 0,
    "progress": 50
  },
  "memory": {
    "shortTerm": {},
    "longTermKeys": []
  },
  /* memory 字段仅在启用可选记忆模块时出现 */
  "artifacts": {
    "toolResults": [
      {
        "stepId": "step-1",
        "toolName": "sql-query",
        "output": { /* 工具输出 */ },
        "timestamp": 1702886400000
      }
    ]
  },
  "telemetry": {
    "totalDuration": 1500,
    "tokenCount": 0,
    "toolCallCount": 2,
    "errorCount": 0,
    "retryCount": 0,
    "nodeTimings": {
      "planner": 100,
      "tool-runner": 1400
    }
  },
  "policy": {
    "maxToolCalls": 20,
    "maxDuration": 300000,
    "maxRetries": 3,
    "permissions": {
      "sql:read": true
    }
  },
  "createdAt": 1702886400000,
  "updatedAt": 1702886401500
}
```

### EventsExport 对象

```json
{
  "events": [
    {
      "id": "evt-1702886400000-xyz789",
      "timestamp": 1702886400000,
      "type": "node_start",
      "nodeId": "planner",
      "status": "info",
      "summary": "开始执行节点: Planner",
      "metadata": {}
    },
    {
      "id": "evt-1702886400100-abc456",
      "timestamp": 1702886400100,
      "type": "tool_call",
      "nodeId": "tool-runner",
      "status": "info",
      "summary": "调用工具: sql-query",
      "payloadRef": "payload-evt-1702886400100-abc456",
      "metadata": {
        "toolName": "sql-query",
        "input": { "query": "SELECT * FROM users" }
      }
    }
  ],
  "payloads": {
    "payload-evt-1702886400100-abc456": {
      "rows": [
        { "id": 1, "name": "Alice" }
      ],
      "rowCount": 1
    }
  }
}
```

### Event 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 事件唯一 ID |
| `timestamp` | number | 事件时间戳（毫秒） |
| `type` | EventType | 事件类型（见下表） |
| `nodeId` | string | 触发事件的节点 ID（可选） |
| `status` | 'success' \| 'failure' \| 'warning' \| 'info' | 事件状态 |
| `summary` | string | 事件摘要（用户可读） |
| `payloadRef` | string | Payload 引用（可选） |
| `metadata` | object | 额外元数据（可选） |

### EventType 枚举

| 类型 | 说明 |
|------|------|
| `node_start` | 节点开始执行 |
| `node_end` | 节点执行完成 |
| `tool_call` | 工具调用 |
| `tool_result` | 工具返回结果 |
| `error` | 错误发生 |
| `retry` | 重试 |
| `checkpoint` | 保存 checkpoint |
| `budget_warning` | 预算警告 |
| `budget_exceeded` | 预算超限 |

### Checkpoint 对象

```json
{
  "id": "checkpoint-1702886400500",
  "stateId": "1702886400000-abc123",
  "state": { /* 完整 State 对象 */ },
  "eventIndex": 5,
  "timestamp": 1702886400500,
  "metadata": {}
}
```

## 使用示例

### 导出 Debug Bundle

```typescript
import { createDebugBundle, downloadDebugBundle } from './core/debug-bundle';

const bundle = createDebugBundle(state, eventStream, {
  checkpoints: await persistence.listCheckpoints(state.id),
  metadata: {
    customField: 'custom value',
  },
});

// 下载为文件
downloadDebugBundle(bundle, 'my-debug-bundle.json');
```

### 导入并分析

```typescript
import { importDebugBundle } from './core/debug-bundle';

const json = await fetch('debug-bundle.json').then(r => r.text());
const bundle = importDebugBundle(json);

console.log('State:', bundle.state);
console.log('Events:', bundle.events.events);
console.log('Telemetry:', bundle.state.telemetry);
```

### 复现问题

```typescript
// 1. 从 bundle 恢复 State
const state = bundle.state;

// 2. 重新执行（使用相同配置）
const runner = new GraphRunner(graph, persistence);
const result = await runner.execute(state);
```

## 最佳实践

1. **定期导出**：在关键节点（如错误发生时）自动导出 Debug Bundle
2. **包含 Checkpoints**：导出时包含所有 checkpoints，便于回溯
3. **添加元数据**：在 `metadata` 中记录环境信息（版本、配置等）
4. **压缩存储**：对于大型 bundle，考虑使用 gzip 压缩
5. **隐私保护**：导出前移除敏感数据（如 API 密钥、用户信息）

## 常见问题

### Q: Bundle 文件过大怎么办？

A: 可以：
- 限制 `events` 数量（只保留最近 N 条）
- 移除 `payloads` 中的大型数据
- 使用 gzip 压缩

### Q: 如何在生产环境使用？

A: 建议：
- 仅在错误发生时导出
- 上传到服务器而非下载到本地
- 实施访问控制，避免泄露敏感信息

### Q: 能否从 Bundle 恢复执行？

A: 可以，但需注意：
- 工具调用可能产生副作用（如数据库写入）
- 外部状态可能已变化（如 API 数据更新）
- 建议仅用于调试，不用于生产恢复
