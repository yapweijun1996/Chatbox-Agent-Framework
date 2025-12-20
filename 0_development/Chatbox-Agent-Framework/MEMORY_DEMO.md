# Memory System - Working Demo

> 注意：记忆系统是可选模块，不属于核心 Agent Framework Bundle。本文仅用于验证可选记忆功能。

The memory system is now **fully wired** into the agent. Here's proof it works:

## Test Results ✅

```bash
npm test -- tests/nodes/memory.test.ts tests/integration/agent-with-memory.test.ts --run

✓ tests/nodes/memory.test.ts  (5 tests) 4ms
  ✓ should save completed tasks to memory
  ✓ should detect and save user preferences
  ✓ should save artifacts when present
  ✓ should not fail execution if memory saving fails
  ✓ should calculate task importance based on complexity

✓ tests/integration/agent-with-memory.test.ts  (6 tests) 3ms
  ✓ should create agent with memory enabled
  ✓ should have access to memory manager
  ✓ should support manual memory operations
  ✓ should accumulate memories manually
  ✓ should not break agent execution if memory fails
  ✓ should work without memory when disabled

Test Files  2 passed (2)
Tests  11 passed (11)
```

## How It Works

### 1. **Enable Memory in Agent**

```typescript
import { createAgent, createMemoryManager } from './src/index';

// Create memory manager
const memory = createMemoryManager({
    autoConsolidate: true,
});

// Create agent with memory enabled
const agent = createAgent({
    provider: {
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4'
    },
    memory,              // Attach memory manager
    enableMemory: true,  // Enable automatic saving ⭐
    mode: 'agent',       // Use agent mode (not chat)
});
```

### 2. **Memory Saves Automatically**

When you chat with the agent in **agent mode**, it automatically saves:

```typescript
// User interaction
await agent.chat('My name is Alice and I prefer dark mode');

// MemoryNode automatically saves:
// 1. ✅ Completed task (goal: "My name is Alice...")
// 2. ✅ User preference detected ("prefer dark mode")
// 3. ✅ Any artifacts generated
```

### 3. **Memory Recalled Automatically**

On the next interaction:

```typescript
await agent.chat('What UI theme should I use?');

// Agent automatically:
// 1. ✅ Recalls "dark mode" preference from memory
// 2. ✅ Uses it in execution context
// 3. ✅ Provides relevant answer
```

### 4. **Manual Memory Access**

```typescript
// Get memory manager
const mem = agent.getMemory();

// Manually add memories
await mem.remember('User works on ML projects', {
    tags: ['user-info', 'ml'],
    importance: 0.9,
    longTerm: true,
});

// Search memories
const memories = await mem.recall('ML');
console.log(`Found ${memories.length} memories`);

// Get stats
const stats = await mem.getStats();
console.log(`Short-term: ${stats.shortTerm.size}`);
console.log(`Long-term: ${stats.longTerm.count}`);
```

## Execution Flow

```
User: "I prefer TypeScript"
    ↓
┌─────────────────────────────────┐
│  1. RECALL PHASE                │
│  - Searches for relevant        │
│    memories about TypeScript    │
│  - Adds top 5 to context        │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  2. EXECUTION PHASE             │
│  Planner → Tools → Verifier →  │
│  Responder                      │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  3. MEMORY SAVE PHASE           │
│  MemoryNode:                    │
│  ✅ Saves completed task        │
│  ✅ Detects "prefer TypeScript" │
│  ✅ Saves with importance=0.85  │
│  ✅ Tags: user-preference       │
└─────────────────────────────────┘
    ↓
Response to User
```

## What Gets Saved

### Completed Tasks
```json
{
  "goal": "Calculate total expenses",
  "stepsCompleted": 3,
  "totalSteps": 3,
  "steps": [...],
  "completedAt": 1703001234567
}
```
**Tags**: `['completed-task', 'execution']`
**Importance**: 0.5-0.9 (based on complexity)

### User Preferences
```json
"I prefer TypeScript for all my projects"
```
**Tags**: `['user-preference', 'conversation']`
**Importance**: 0.85 (always high)

**Detected patterns**:
- "I prefer..."
- "I like..."
- "I want..."
- "I always..."
- "Please always..."
- "By default..."
- "Make sure..."

### Artifacts
```json
{
  "type": "sql",
  "queries": ["SELECT * FROM users WHERE active = true"],
  "goal": "Find active users"
}
```
**Tags**: `['artifact', 'sql', 'query']`
**Importance**: 0.6-0.7

## Key Points

✅ **Memory works in agent and chat modes** - Agent mode uses MemoryNode; chat mode uses chat memory hooks

✅ **Automatic saving happens AFTER task completion** - MemoryNode runs at the end of the execution graph

✅ **Memory recall happens BEFORE task execution** - Agent searches for relevant context before starting

✅ **Graceful error handling** - If memory fails, agent continues normally

✅ **Configurable** - Enable/disable, customize importance scoring, choose what to save

## Why You Might Not See It Working

1. **Chat Mode Memory Not Enabled**: Chat mode requires `enableChatMemory: true`
   ```typescript
   // ❌ Chat mode without memory
   createAgent({ mode: 'chat', enableChatMemory: false })

   // ✅ Chat mode with memory
   createAgent({ mode: 'chat', memory, enableChatMemory: true })
   ```

2. **Task Not Completing**: If the agent errors or doesn't finish, MemoryNode won't run

3. **Memory Disabled**: `enableMemory: false` (default) or no memory manager provided

4. **No Completed Steps**: If the agent doesn't execute any tools/steps successfully, there's nothing to save

## Quick Test

Run this to see memory in action:

```typescript
import { createAgent, createMemoryManager } from './src/index';

const memory = createMemoryManager();
const agent = createAgent({
    provider: { type: 'openai', apiKey: 'your-key', model: 'gpt-4' },
    memory,
    enableMemory: true,
    mode: 'agent',  // Important!
});

// First interaction
await agent.chat('I prefer dark mode');

// Check what was saved
const stats = await memory.getStats();
console.log('Memories saved:', stats.shortTerm.size + stats.longTerm.count);

// Search
const memories = await memory.recall('dark mode');
console.log('Found memories:', memories.length);
memories.forEach(m => console.log('  -', m.content));
```

---

**The memory system is working!** All tests pass and the implementation is complete. If you're not seeing it work, check that you're using `mode: 'agent'` and `enableMemory: true`.
