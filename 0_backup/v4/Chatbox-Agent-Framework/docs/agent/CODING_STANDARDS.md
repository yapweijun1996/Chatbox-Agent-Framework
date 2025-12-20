# Coding Standards & Best Practices

## File Organization
- **Maximum 300 lines per file** - split larger files into logical modules
- Use clear, descriptive names: `llm-planner.ts`, not `planner2.ts`
- Group related functionality in subdirectories

## TypeScript Best Practices
```typescript
// ✅ DO: Use strict types
interface ToolResult<T = unknown> {
  success: boolean;
  output?: T;
  error?: string;
}

// ❌ DON'T: Use 'any'
function process(data: any) { ... }

// ✅ DO: Use proper error handling
try {
  const result = await tool.execute(input);
} catch (error) {
  const agentError = createError(ErrorType.EXECUTION, 'Tool failed', {
    originalError: error instanceof Error ? error : undefined
  });
  throw agentError;
}
```

## State Updates
```typescript
// ✅ DO: Use updateState with draft pattern
const newState = updateState(state, draft => {
  draft.task.progress = 50;
  draft.telemetry.toolCallCount += 1;
});

// ❌ DON'T: Mutate state directly
state.task.progress = 50; // WRONG!
```

## Tool Development
```typescript
// ✅ DO: Complete tool definition
export const myTool: Tool = {
  name: 'my-tool',
  description: 'Clear description',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ results: z.array(z.unknown()) }),
  timeout: 5000,
  retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
  permissions: ['data:read'],
  async execute(input) { ... },
};
```

## Node Development
```typescript
// ✅ DO: Extend BaseNode properly
export class MyNode extends BaseNode {
  async execute(state: State): Promise<NodeResult> {
    // 1. Perform work
    // 2. Update state immutably
    // 3. Emit events
    return this.createResult(newState, events);
  }
}
```

## Testing Strategy

### Unit Tests (Priority: High)
```typescript
describe('State Management', () => {
  it('should update state immutably', () => {
    const state = createState('test');
    const newState = updateState(state, draft => {
      draft.task.progress = 50;
    });
    expect(state.task.progress).toBe(0);
    expect(newState.task.progress).toBe(50);
  });
});
```

## Documentation Standards
- **Inline Comments**: Explain WHY, not WHAT.
- **Function Docs**: Use JSDoc with @param and @return.
