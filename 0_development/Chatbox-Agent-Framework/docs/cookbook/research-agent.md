# Research Agent

A focused agent that gathers sources and summarizes findings.

## Goals

- Use tools to search and fetch documents.
- Track sources in artifacts for traceability.
- Provide a concise summary with references.

## Suggested Setup

```typescript
import {
    createAgent,
    createLLMProvider,
    documentSearchTool,
} from 'agent-workflow-framework';

const provider = createLLMProvider({
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
});

const agent = createAgent({
    provider,
    mode: 'agent',
    tools: [documentSearchTool],
    systemPrompt: 'You are a research assistant. Always cite sources.',
    maxSteps: 10,
});

const result = await agent.chat('Find recent papers about agent tool orchestration.');
console.log(result.content);
```

## Notes

- Use `documentSearchTool` to collect sources.
- Store references in `state.artifacts.references` inside custom tools if needed.
