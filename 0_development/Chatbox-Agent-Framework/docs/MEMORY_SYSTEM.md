# 记忆系统使用指南

Chatbox-Agent-Framework 提供了完整的记忆系统，支持短期和长期记忆管理。

## 📋 快速开始

```typescript
import { createMemoryManager } from 'agent-workflow-framework';

// 创建记忆管理器
const memory = createMemoryManager({
    shortTermMaxSize: 1000,
    shortTermDefaultTTL: 30 * 60 * 1000, // 30 分钟
    autoConsolidate: true,
});

// 记住信息
const id = memory.remember('用户喜欢咖啡', {
    tags: ['user-preference'],
    importance: 0.8,
});

// 回忆信息
const results = await memory.recall({ tags: ['user-preference'] });
console.log(results);
```

## 🧠 核心概念

### 短期记忆 (Short-term Memory)

- **用途**: 当前会话的临时信息
- **生命周期**: 会话结束或超时后清除
- **特点**: 快速访问，内存存储

```typescript
// 直接使用短期记忆
memory.shortTerm.set('currentTask', 'Preparing report', {
    importance: 0.6,
    ttl: 10 * 60 * 1000, // 10 分钟
});

const task = memory.shortTerm.get('currentTask');
```

### 长期记忆 (Long-term Memory)

- **用途**: 跨会话的持久化信息
- **生命周期**: 持久化存储，直到手动删除
- **特点**: 支持语义搜索、嵌入向量

```typescript
// 直接使用长期记忆
const id = await memory.longTerm.add('用户的工作流程偏好', {
    tags: ['workflow', 'preference'],
    importance: 0.9,
    summary: '用户倾向于使用敏捷开发方法',
});

// 语义搜索
const results = await memory.longTerm.search('工作方式');
```

## 🔧 高级功能

### 自动提升

高价值的短期记忆会自动提升到长期存储：

```typescript
const key = memory.remember('重要决策', { importance: 0.9 });

// 多次访问增加价值
memory.shortTerm.get(key);
memory.shortTerm.get(key);

// 整理时会自动提升
await memory.consolidate();
```

### 重要性评分

```typescript
memory.remember('关键信息', {
    importance: 0.95,  // 0-1，越高越重要
    tags: ['critical'],
});
```

### 查询与过滤

```typescript
// 按多个条件查询
const results = memory.shortTerm.query({
    minImportance: 0.7,
    tags: ['user-preference'],
    sortBy: 'importance',
    limit: 10,
});
```

### 语义搜索（需要嵌入生成器）

```typescript
import { SimpleTFIDFEmbedding, createMemoryManager } from 'agent-workflow-framework';

const embedding = new SimpleTFIDFEmbedding(128);
const memory = createMemoryManager({}, undefined, embedding);

// 现在可以进行语义搜索
const results = await memory.longTerm.search('如何提高效率', {
    limit: 5,
    threshold: 0.7,
});
```

## 📊 统计与监控

```typescript
const stats = memory.getStats();
console.log({
    shortTermSize: stats.shortTerm.size,
    shortTermAccesses: stats.shortTerm.totalAccesses,
    averageImportance: stats.shortTerm.averageImportance,
});
```

## 🔌 持久化适配器

### 使用内存适配器（默认）

```typescript
import { InMemoryPersistenceAdapter, createMemoryManager } from 'agent-workflow-framework';

const adapter = new InMemoryPersistenceAdapter();
const memory = createMemoryManager({}, adapter);
```

### 自定义持久化适配器

```typescript
import type { MemoryPersistenceAdapter, LongTermMemoryItem } from 'agent-workflow-framework';

class CustomAdapter implements MemoryPersistenceAdapter {
    async save<T>(memory: LongTermMemoryItem<T>): Promise<void> {
        // 实现持久化逻辑（如保存到数据库）
    }

    async get<T>(id: string): Promise<LongTermMemoryItem<T> | null> {
        // 实现检索逻辑
    }

    // ... 实现其他方法
}

const memory = createMemoryManager({}, new CustomAdapter());
```

## 🎯 最佳实践

### 1. 合理设置重要性

```typescript
// 临时计算结果 - 低重要性
memory.remember(tempResult, { importance: 0.3 });

// 用户偏好 - 中等重要性
memory.remember(userPreference, { importance: 0.6 });

// 关键决策 - 高重要性
memory.remember(criticalDecision, { importance: 0.9 });
```

### 2. 使用标签组织

```typescript
memory.remember(data, {
    tags: ['user-profile', 'preference', 'ui'],
    importance: 0.7,
});

// 按标签检索
const uiPrefs = await memory.recall({ tags: ['ui'] });
```

### 3. 定期整理

```typescript
// 手动整理
await memory.consolidate();

// 或启用自动整理
const memory = createMemoryManager({
    autoConsolidate: true,
    consolidateIntervalMs: 60 * 60 * 1000, // 每小时
});
```

### 4. 清理过期数据

```typescript
// 短期记忆会自动过期
memory.shortTerm.set('temp', data, {
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 分钟后过期
});

// 手动清理
await memory.cleanup();
```

## 🔍 完整示例

```typescript
import { createMemoryManager, SimpleTFIDFEmbedding } from 'agent-workflow-framework';

// 创建带嵌入功能的记忆管理器
const embedding = new SimpleTFIDFEmbedding(128);
const memory = createMemoryManager(
    {
        shortTermMaxSize: 1000,
        shortTermDefaultTTL: 30 * 60 * 1000,
        autoConsolidate: true,
    },
    undefined, // 使用默认持久化
    embedding
);

// 记住用户交互
async function rememberUserInteraction(interaction: string) {
    const id = await memory.remember(interaction, {
        longTerm: true,
        tags: ['user-interaction'],
        importance: 0.7,
    });
    console.log(`Saved interaction: ${id}`);
}

// 查找相关历史
async function findRelevantHistory(query: string) {
    const results = await memory.longTerm.search(query, {
        limit: 5,
        threshold: 0.6,
    });
    return results.map(r => r.content);
}

// 使用
await rememberUserInteraction('用户询问了如何导出数据');
await rememberUserInteraction('用户请求生成报表');

const relevant = await findRelevantHistory('数据导出');
console.log('相关历史:', relevant);

// 获取统计
console.log('记忆统计:', memory.getStats());
```

## 📖 API 参考

### MemoryManager

| 方法 | 描述 |
|------|------|
| `remember<T>(content, options?)` | 记住信息（自动选择短期/长期） |
| `recall<T>(query)` | 从所有记忆中搜索 |
| `promoteToLongTerm(key)` | 提升短期记忆到长期 |
| `getStats()` | 获取统计信息 |
| `cleanup()` | 清理过期记忆 |
| `consolidate()` | 整理记忆（提升高价值项） |

### ShortTermMemory

| 方法 | 描述 |
|------|------|
| `set<T>(key, value, options?)` | 存储记忆 |
| `get<T>(key)` | 获取记忆 |
| `has(key)` | 检查是否存在 |
| `delete(key)` | 删除记忆 |
| `query<T>(options)` | 查询记忆 |
| `clear()` | 清空所有记忆 |

### LongTermMemory

| 方法 | 描述 |
|------|------|
| `add<T>(content, options?)` | 添加记忆 |
| `get<T>(id)` | 获取记忆 |
| `query<T>(options)` | 查询记忆 |
| `search<T>(query, options?)` | 语义搜索 |
| `update<T>(id, updates)` | 更新记忆 |
| `delete(id)` | 删除记忆 |
| `consolidate()` | 整理记忆 |

## 🎓 了解更多

- 查看 [源码](../src/core/memory/) 了解实现细节
- 查看 [测试用例](../tests/core/memory.test.ts) 了解更多使用示例
