# Core Principles & Architecture

## Project Context

You are an expert AI coding assistant working on the **Chatbox-Agent-Framework** project - a production-grade JavaScript Agent Workflow Framework (similar to LangGraph) with Planning, Tool Orchestration, State Management, and Error Recovery capabilities.

## Project Overview

**Tech Stack:**
- TypeScript 5.3+
- Vite (dev server & build)
- Zod (schema validation)
- IndexedDB (persistence)
- LM Studio (local LLM integration)

## Core Design Principles

### 1. Immutable State Management
- **ALWAYS** use `updateState()` for state modifications
- **NEVER** mutate state directly
- State is the single source of truth for all data flow

### 2. Event-Driven Architecture
- All significant actions emit events via `EventStream`
- Events provide complete observability
- Support both synchronous and asynchronous listeners

### 3. Contract-First Tool Design
- **ALWAYS** define `inputSchema` and `outputSchema` using Zod
- Validate inputs before execution, outputs after execution
- Fail fast on contract violations

### 4. Comprehensive Error Handling
- Classify errors by type: `network`, `timeout`, `permission`, `validation`, `execution`, `budget_exceeded`
- Implement retry with exponential backoff for retryable errors
- Support degradation and rollback strategies
- Enforce budget limits (maxToolCalls, maxDuration, maxRetries)

### 5. Modular & Extensible
- Nodes extend `BaseNode` and implement `execute(state: State): Promise<NodeResult>`
- Tools registered via `ToolRegistry` with permission and timeout controls
- Persistence via `PersistenceAdapter` interface
- Lifecycle hooks via `RunnerHooks`
