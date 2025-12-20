# Data Extraction Agent

An agent that extracts structured data with tool calls and validation.

## Goals

- Parse documents or APIs into a strict schema.
- Validate outputs with Zod.
- Emit clean JSON for downstream systems.

## Suggested Setup

```typescript
import { createAgent, createLLMProvider } from 'agent-workflow-framework';
import { z } from 'zod';

const provider = createLLMProvider({
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
});

const extractInvoiceTool = {
    name: 'extract_invoice',
    description: 'Extract invoice fields from raw text',
    inputSchema: z.object({ text: z.string() }),
    outputSchema: z.object({
        vendor: z.string(),
        total: z.number(),
        currency: z.string(),
        date: z.string(),
    }),
    timeout: 10000,
    retryPolicy: { maxRetries: 1, backoffMs: 200, backoffMultiplier: 2 },
    permissions: [],
    execute: async ({ text }: { text: string }) => {
        // Custom parsing or model call
        return {
            vendor: 'ACME Corp',
            total: 123.45,
            currency: 'USD',
            date: '2025-01-15',
        };
    },
};

const agent = createAgent({
    provider,
    mode: 'agent',
    tools: [extractInvoiceTool],
    systemPrompt: 'Extract data and return validated JSON only.',
});

const result = await agent.chat('Extract invoice data from: ...');
console.log(result.content);
```

## Notes

- Keep tool output schema strict to prevent hallucinated fields.
