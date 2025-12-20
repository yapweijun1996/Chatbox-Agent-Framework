# RBAC & Audit Logs

This framework supports role-based access control (RBAC) by mapping roles to permissions and emitting audit events.

## RBAC Policy

```typescript
import { createAgent } from 'agent-workflow-framework';

const rbacPolicy = {
    roles: {
        admin: ['sql:read', 'document:read', 'tool:run'],
        analyst: ['sql:read', 'document:read'],
    },
    defaultRoles: ['analyst'],
};

const agent = createAgent({
    provider: { type: 'openai', apiKey: 'key', model: 'gpt-4' },
    tools: [],
    rbac: {
        policy: rbacPolicy,
        roles: ['admin'],
        actor: 'user:alice',
    },
});
```

Permissions are resolved into `state.policy.permissions` when the agent enters agent mode. Tool execution enforces these permissions through `ToolRegistry`.

## Audit Logs

Audit events are emitted to the agent event stream with `type: 'audit'`.

```typescript
const stream = agent.getEventStream();
stream.on('audit', (event) => {
    console.log(event.summary, event.metadata);
});
```

Typical audit actions include:
- `route_decision`
- `tool_call`
- `tool_result`
- `memory_recall` (optional, only if memory is enabled)
- `memory_save` (optional, only if memory is enabled)
