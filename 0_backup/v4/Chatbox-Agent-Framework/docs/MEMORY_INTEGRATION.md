# Memory Integration Guide

> Optional module: memory is not part of the core Agent Framework bundle. This guide applies only when you explicitly enable memory.

The memory system has been successfully integrated into the Agent execution flow. This guide explains how the agent automatically saves and recalls information.

## Overview

The agent now supports **automatic memory management** through:
1. **MemoryNode** - Automatically saves important information after task completion
2. **Memory Recall** - Recalls relevant context before starting new tasks
3. **Manual Access** - Full programmatic access to the memory system
4. **Chat Memory** - Optional save/recall hooks for chat mode

## Quick Start

```typescript
import { createAgent, createMemoryManager } from 'agent-workflow-framework';

// Create memory manager
const memory = createMemoryManager({
    autoConsolidate: true,
});

// Create agent with memory enabled
const agent = createAgent({
    provider: { type: 'openai', apiKey: 'your-key', model: 'gpt-4' },
    memory,              // Attach memory manager
    enableMemory: true,  // Enable automatic saving
});

// Use the agent - it will automatically save and recall
await agent.chat('My name is Alice and I prefer dark mode');
await agent.chat('What UI theme should I use?'); // Recalls "dark mode" preference
```

## Chat Mode Memory

Chat mode can also save and recall memories without running the full agent graph:

```typescript
const agent = createAgent({
    provider: { type: 'openai', apiKey: 'your-key', model: 'gpt-4' },
    mode: 'chat',
    memory,
    enableChatMemory: true,
    chatMemorySavePolicy: {
        saveUserPreferences: true,
        saveIntentMessages: true,
    },
    chatMemoryRecallPolicy: {
        limit: 5,
        messageRole: 'system',
    },
});

await agent.chat('Remember that I like concise answers');
await agent.chat('How should you respond?'); // Recalls the preference
```

Per-call overrides are supported:

```typescript
await agent.chat('One-off question', {
    useChatMemory: false,
});
```

## What Gets Saved Automatically?

When `enableMemory: true` is set, the **MemoryNode** automatically saves:

### 1. **Completed Tasks** (always saved)
- Task goal and status
- Steps executed
- Importance based on task complexity

**Example saved memory:**
```json
{
  "goal": "Calculate user's total expenses",
  "status": "completed",
  "steps": [
    { "description": "Query database", "status": "completed", "tool": "sql_query" },
    { "description": "Sum amounts", "status": "completed" }
  ],
  "completedAt": 1703001234567
}
```

**Tags**: `['completed-task', 'completed']`
**Importance**: 0.5-0.9 (based on complexity)

### 2. **User Preferences** (auto-detected)
Detected when user says:
- "I prefer..."
- "I like..."
- "I want..."
- "I always..."
- "Please always..."
- "By default..."

**Example:**
```
User: "I prefer TypeScript for all my projects"
→ Saved with tags: ['user-preference', 'conversation']
→ Importance: 0.85
```

### 3. **Artifacts** (when present)
- SQL queries
- File references
- Generated code

**Example:**
```typescript
// If task generated SQL:
{
  "type": "sql",
  "queries": ["SELECT * FROM users WHERE active = true"],
  "goal": "Find active users"
}
```

**Tags**: `['artifact', 'sql', 'query']`

### 4. **Tool Results** (optional)
Enable with:
```typescript
const memory = new MemoryNode({
    memoryManager: memory,
    saveToolResults: true,  // Enable tool result saving
});
```

## Memory Recall

Before executing a task, the agent **automatically recalls** relevant memories:

```typescript
// Internally, before execution:
const relevantMemories = await memory.recall(userMessage);
// Top 5 most relevant memories are added to execution context
```

This allows the agent to:
- Remember user preferences
- Reference past tasks
- Build on previous conversations

## Manual Memory Operations

You can also interact with memory directly:

```typescript
const agent = createAgent({ /* ... */, memory, enableMemory: true });

// Get memory manager
const mem = agent.getMemory();

// Manually save important information
await mem.remember('User is working on ML project with Python', {
    tags: ['user-project', 'ml', 'python'],
    importance: 0.9,
    longTerm: true,
});

// Search memories
const memories = await mem.recall('python');

// Get statistics
const stats = await mem.getStats();
console.log(`Memories: ${stats.shortTerm.size} short, ${stats.longTerm.count} long`);

// Clean up low-value memories
await mem.consolidate();
```

## Configuration Options

### AgentConfig
```typescript
interface AgentConfig {
    memory?: MemoryManager;        // Memory manager instance
    enableMemory?: boolean;         // Enable automatic saving (default: false)
    enableChatMemory?: boolean;     // Enable chat memory (default: false)
    chatMemorySavePolicy?: ChatMemorySavePolicy;
    chatMemoryRecallPolicy?: ChatMemoryRecallPolicy;
    // ... other options
}
```

### MemoryNodeConfig
```typescript
interface MemoryNodeConfig {
    memoryManager: MemoryManager;
    saveCompletedTasks?: boolean;      // Default: true
    saveUserPreferences?: boolean;     // Default: true
    saveToolResults?: boolean;         // Default: false
    taskImportanceScorer?: (state: State) => number;  // Custom scorer
}
```

### Custom Importance Scoring

Provide a custom function to calculate task importance:

```typescript
const memory = new MemoryNode({
    memoryManager: memory,
    taskImportanceScorer: (state) => {
        // Custom logic
        if (state.task.goal.includes('critical')) return 1.0;
        if (state.task.steps.length > 5) return 0.8;
        return 0.5;
    },
});
```

## Memory Lifecycle

1. **User sends message** → Agent recalls relevant memories
2. **Task executes** → Steps are completed, artifacts generated
3. **Task completes** → MemoryNode saves:
   - Completed task summary
   - Detected user preferences
   - Important artifacts
4. **Auto-consolidation** (if enabled) → Low-value memories pruned hourly

## Execution Graph with Memory

```
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌───────────┐
│ Planner │ ──> │ Tool Runner  │ ──> │ Verifier │ ──> │ Responder │
└─────────┘     └──────────────┘     └──────────┘     └───────────┘
                                                              │
                                                              ▼
                                                       ┌──────────┐
                                                       │  Memory  │
                                                       │   Node   │
                                                       └──────────┘
                                                       (saves info)
```

The MemoryNode runs **after** the Responder, ensuring all execution context is available.

## Best Practices

### 1. **Use Appropriate Importance Scores**
```typescript
// Low importance - temporary calculation
await memory.remember(tempResult, { importance: 0.3 });

// Medium - useful information
await memory.remember(userPreference, { importance: 0.6 });

// High - critical information
await memory.remember(securitySetting, { importance: 0.95 });
```

### 2. **Tag Consistently**
```typescript
await memory.remember(data, {
    tags: ['user-profile', 'preference', 'ui'],  // Hierarchical tags
    importance: 0.7,
});
```

### 3. **Enable Auto-Consolidation for Long-Running Apps**
```typescript
const memory = createMemoryManager({
    autoConsolidate: true,
    consolidateIntervalMs: 60 * 60 * 1000,  // Every hour
});
```

### 4. **Use Persistence for Production**
```typescript
import { IndexedDBMemoryAdapter } from 'agent-workflow-framework';

const memory = createMemoryManager(
    { /* config */ },
    new IndexedDBMemoryAdapter(),  // Persists across sessions
    embeddingGenerator
);
```

## Error Handling

Memory failures **do not break agent execution**. If memory operations fail:
- Errors are logged to console
- Agent continues normal execution
- Graceful degradation ensures reliability

```typescript
// Even if memory.remember() fails internally:
await agent.chat('Hello');  // ✅ Still works
```

## Examples

See:
- [examples/agent-with-memory.ts](../examples/agent-with-memory.ts) - Complete working example
- [tests/integration/agent-with-memory.test.ts](../tests/integration/agent-with-memory.test.ts) - Integration tests
- [tests/nodes/memory.test.ts](../tests/nodes/memory.test.ts) - MemoryNode tests

## API Reference

### Agent Methods
- `getMemory(): MemoryManager | undefined` - Get the attached memory manager

### Memory Manager Methods
- `remember<T>(content, options?): Promise<string>` - Save to memory
- `recall<T>(query): Promise<MemoryItem<T>[]>` - Search memories
- `getStats(): Promise<MemoryStats>` - Get statistics
- `consolidate(): Promise<void>` - Clean up low-value memories

See [MEMORY_SYSTEM.md](./MEMORY_SYSTEM.md) for full memory API documentation.

## Migration from Manual Memory

If you were using memory manually:

**Before:**
```typescript
const memory = createMemoryManager();
// Manual saving after agent execution
await agent.chat('...');
await memory.remember(/* manually save result */);
```

**After:**
```typescript
const agent = createAgent({
    // ... other config
    memory,
    enableMemory: true,  // Automatic saving
});

await agent.chat('...');  // Memory saved automatically
```

## Troubleshooting

**Memory not saving?**
- Ensure `enableMemory: true` is set
- Check that `memory` is passed to `AgentConfig`
- Verify task completes successfully (check `task.status === 'completed'`)

**Too many memories accumulating?**
- Enable `autoConsolidate: true`
- Adjust `importanceThreshold` in config
- Manually call `memory.consolidate()` periodically

**Memories not being recalled?**
- Check that memories have relevant tags
- Try semantic search: `memory.recall('query text')`
- Ensure embedding generator is configured for better recall

---

**Ready to use memory?** Check out the [example](../examples/agent-with-memory.ts) to get started!
