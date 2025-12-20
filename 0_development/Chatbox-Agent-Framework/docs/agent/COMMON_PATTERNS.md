# Common Patterns & Integration

## Common Patterns

### Pattern 1: LLM Integration
```typescript
// Use LM Studio tool for text generation
const result = await toolRegistry.execute('lm-studio-llm', {
  prompt: 'Generate a plan for: ' + goal,
  systemPrompt: 'You are a task planning assistant...',
  temperature: 0.3,
});
```

### Pattern 2: Conditional Routing
```typescript
const graph: GraphDefinition = {
  edges: [
    { from: 'nodeA', to: 'nodeB' },
    {
      from: 'nodeB',
      to: 'nodeC',
      condition: (state) => state.task.currentStepIndex < state.task.steps.length,
    },
  ],
};
```

### Pattern 3: Error Recovery
```typescript
try {
    return await retryWithBackoff(() => tool.execute(input), ...);
} catch (error) {
    if (fallbackTool) return await fallbackTool.execute(simplifiedInput);
    throw error;
}
```

### Pattern 4: Human-in-the-loop Tool Confirmation
```typescript
const agent = createAgent({
  provider,
  tools: [mySensitiveTool],
  confirmTool: async (request) => {
    const approved = await showApprovalModal(request);
    return { approved, reason: approved ? 'user approved' : 'user denied' };
  },
});
```

### Pattern 5: Graph Templates
```typescript
const agent = createAgent({
  provider,
  graphTemplate: 'light', // light | standard | strict
});
```

Template behavior:
- light: skips plan-and-execute replan edge; auto-approves confirmations
- standard: includes plan-and-execute edge; auto-approves confirmations
- strict: includes plan-and-execute edge; condition errors throw; confirmations default to manual

### Pattern 6: JSON Config Graph
Graph JSON schema: `docs/agent/graph-definition.schema.json`

```typescript
const graphConfig = {
  nodes: ['planner', 'tool-runner', 'verifier', 'responder'],
  edges: [
    { from: 'planner', to: 'tool-runner', type: 'sequential' },
    { from: 'tool-runner', to: 'verifier', type: 'sequential' },
    { from: 'verifier', to: 'responder', type: 'conditional', condition: 'steps_complete' },
    { from: 'verifier', to: 'tool-runner', type: 'conditional', condition: 'steps_remaining' }
  ],
  entryNode: 'planner',
  maxSteps: 20
};

const agent = createAgent({
  provider,
  graphConfig,
});
```

### Pattern 7: Graph Visualization
```typescript
import { toMermaid } from '../core/graph-visualizer';

const graph = agent.getGraphDefinition();
if (graph) {
  const diagram = toMermaid(graph);
  console.log(diagram);
}
```

### Pattern 8: Agent Handoff
```typescript
const coordinator = new AgentCoordinator({ defaultAgentId: 'general' });
coordinator.registerAgent({ id: 'general', agent: generalAgent });
coordinator.registerAgent({ id: 'ops', agent: opsAgent });

const result = await coordinator.handoff({
  fromAgentId: 'general',
  toAgentId: 'ops',
  reason: 'Deployment request',
  payload: {
    summary: 'User asked to deploy the latest build',
    context: { env: 'staging' }
  }
});
```

### Pattern 9: Task Decomposition + Assignment
```typescript
const orchestrator = new MultiAgentOrchestrator({
  agents: [
    { id: 'analysis', agent: analysisAgent, keywords: ['analyze'] },
    { id: 'ops', agent: opsAgent, keywords: ['deploy'] },
  ],
});

const results = await orchestrator.decomposeAndRun(
  '1. analyze the logs\n2. deploy the fix',
  { parallel: true }
);
```

### Pattern 10: Crew Collaboration
```typescript
const crew = new CrewCoordinator([
  { id: 'research', role: 'research', agent: researchAgent, keywords: ['research'] },
  { id: 'ops', role: 'ops', agent: opsAgent, keywords: ['deploy'] },
]);

const results = await crew.run({
  goal: 'Research options and deploy the fix',
  tasks: ['research options', 'deploy fix'],
});
```

### Pattern 11: Load-Balanced Routing
```typescript
const orchestrator = new MultiAgentOrchestrator({ agents: [/* ... */] });
const decision = await orchestrator.routeWithLoadBalancing('handle this');
console.log(decision.agentId, decision.reason);
```

### Pattern 12: Live Debugger
```typescript
const graph = agent.getGraphDefinition();
const eventStream = agent.getEventStream();
const debuggerInstance = new LiveDebugger(eventStream, graph);

console.log(debuggerInstance.getMermaidDiagram());
console.log(debuggerInstance.getToolTraces());
```

### Pattern 13: Distributed Queue Draft
```typescript
const queue = new InMemoryTaskQueue();
const executor = new DistributedExecutor(queue, new Map([
  ['alpha', alphaAgent],
]));

await queue.enqueue({
  id: 'task-1',
  message: 'process data',
  agentId: 'alpha',
  createdAt: Date.now(),
});

await executor.runNext();
```

### Pattern 14: Distributed Worker Pool
```typescript
const pool = new DistributedWorkerPool(executor, 4, 100);
pool.start();
// later...
await pool.stop();
```

### Pattern 15: Checkpoint Store Adapter
```typescript
const store = new InMemoryCheckpointStore();
await store.saveCheckpoint(checkpoint);
const loaded = await store.loadCheckpoint(checkpoint.id);
```

### Pattern 16: Persistent Task Queue
```typescript
const store = new InMemoryTaskQueueStore();
const queue = new PersistentTaskQueue(store);

await queue.enqueue({
  id: 'task-1',
  message: 'work',
  agentId: 'alpha',
  createdAt: Date.now(),
});

await queue.claim();
```

### Pattern 17: IndexedDB Task Queue Store
```typescript
const store = new IndexedDBTaskQueueStore();
await store.save({
  id: 'task-1',
  message: 'work',
  status: 'pending',
  createdAt: Date.now(),
});
```

### Pattern 18: Task Results
```typescript
await queue.complete('task-1', {
  taskId: 'task-1',
  agentId: 'alpha',
  completedAt: Date.now(),
  result: { content: 'ok', mode: 'chat', duration: 1 },
});
const result = await queue.getResult?.('task-1');
```

### Pattern 19: Queue Factory
```typescript
const factory = new PersistentTaskQueueFactory(new IndexedDBTaskQueueStore());
const queue = factory.create();
```

## LM Studio Integration Guide

**Configuration:**
```typescript
const lmStudioConfig = {
  baseURL: 'http://127.0.0.1:6354',
  model: 'zai-org/glm-4.6v-flash',
  temperature: 0.7,
  maxTokens: 2048,
};
const lmStudioTool = createLMStudioTool(lmStudioConfig);
```

## Troubleshooting Guide

### Issue: "Tool execution timeout"
- **Check**: Tool timeout configuration
- **Fix**: Increase `timeout` value or optimize tool implementation

### Issue: "Permission denied"
- **Check**: `state.policy.permissions` and `tool.permissions`
- **Fix**: Grant required permissions when creating state

### Issue: "Budget exceeded"
- **Check**: `state.telemetry` vs `state.policy` limits
- **Fix**: Increase limits or optimize workflow to use fewer tools
