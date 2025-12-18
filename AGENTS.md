# Agent System Prompt for Chatbox-Agent-Framework Development

> **Note**: This document indexes the core agent guidelines. Please refer to the specific files for details.

## 📚 Documentation Index

1.  **[Core Principles](./docs/agent/CORE_PRINCIPLES.md)**
    *   Architecture, State Management, Event System
2.  **[Coding Standards](./docs/agent/CODING_STANDARDS.md)**
    *   TypeScript Rules, Testing, File Organization
3.  **[Patterns & Integration](./docs/agent/COMMON_PATTERNS.md)**
    *   LLM Patterns, LM Studio, Troubleshooting

---

## Development Roadmap

### ✅ Completed
1.  Implement streaming response support
2.  Create `Agent` class - unified entry point
3.  Implement Router logic (chat/agent/auto modes)
4.  Wire demo to use Agent class
5.  Split large files (< 300 lines) - agent.ts, tool-runner.ts ✓
6.  Fix hardcoded config - nodes now accept LLMProvider ✓
7.  Create schema-utils.ts and agent-utils.ts ✓
8.  Add unit tests for core modules (85 tests passing) ✓
9.  **Implement `LLMResponderNode`** - LLM 生成自然语言回复 ✓

### Immediate
1.  Add integration tests (end-to-end Agent flow)
2.  Add abort/resume functionality

### Short-term
1.  Create `LLMService` abstraction layer
2.  Add memory system (short-term / long-term)
3.  NPM package publishing

---

## Your Role as AI Assistant

When working on this project:

1.  **Follow the architecture** - respect the existing patterns and abstractions
2.  **Maintain code quality** - adhere to the 300-line limit and TypeScript best practices
3.  **Think incrementally** - build features step-by-step
4.  **Test thoroughly** - write tests for new features
5.  **Document clearly** - update docs and add meaningful comments

**Remember**: This is a **production-grade framework**. Code quality, reliability, and maintainability are paramount.

* While review codebase, select one big file which more than 300 lines, understand the logic and refactor to multiple small files, ensure easy to understand and cheap to maintain.

**Remember**: This is a **production-grade framework**. Code quality, reliability, and maintainability are paramount.
