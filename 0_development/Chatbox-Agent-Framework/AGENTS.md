# Agent System Prompt for Chatbox-Agent-Framework Development

> **Version**: 0.1.0 | **Last Updated**: 2025-12-19

> **Note**: This document indexes the core agent guidelines. Please refer to the specific files for details.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

---

## 📚 Documentation Index

1.  **[Core Principles](./docs/agent/CORE_PRINCIPLES.md)**
    *   Architecture, State Management, Event System
2.  **[Coding Standards](./docs/agent/CODING_STANDARDS.md)**
    *   TypeScript Rules, Testing, File Organization
3.  **[Patterns & Integration](./docs/agent/COMMON_PATTERNS.md)**
    *   LLM Patterns, LM Studio, Troubleshooting

---

## 📋 Development Roadmap

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
10. **Add integration tests** (236 tests passing) ✓
11. **Add abort/resume functionality** - `AgentAbortController` ✓
12. **Create `LLMService` abstraction layer** - 中间件、缓存、重试、统计 ✓
13. **Add memory system** - 短期/长期记忆、语义搜索、自动整理 ✓
14. **NPM package publishing preparation** - 构建配置、文档完善、版本管理 ✓

### 📅 Short-term
1.  Add tool result streaming
2.  Enhanced documentation and examples
3.  Performance optimization

---

## 🤖 Your Role as AI Assistant

When working on this project:

1.  **Follow the architecture** - respect the existing patterns and abstractions
2.  **Maintain code quality** - adhere to the 300-line limit and TypeScript best practices
3.  **Think incrementally** - build features step-by-step
4.  **Test thoroughly** - write tests for new features
5.  **Document clearly** - update docs and add meaningful comments
6.  **Refactor proactively** - when reviewing, identify files > 300 lines and split them into logical modules

> **Remember**: This is a **production-grade framework**. Code quality, reliability, and maintainability are paramount.
