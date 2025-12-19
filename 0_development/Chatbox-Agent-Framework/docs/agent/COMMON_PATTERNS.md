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
