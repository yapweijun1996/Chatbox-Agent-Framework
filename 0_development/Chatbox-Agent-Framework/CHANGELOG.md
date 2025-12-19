# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-19

### 🎉 Initial Release

#### Added

**核心功能**
- ✅ Agent 核心系统 (chat/agent/auto 三种模式)
- ✅ 状态管理系统 (不可变状态、检查点、序列化)
- ✅ 事件流系统 (完整事件追踪)
- ✅ 工具注册与执行
- ✅ 错误处理与重试机制

**LLM 集成**
- ✅ LLM Provider 抽象层
- ✅ OpenAI Provider
- ✅ Gemini Provider  
- ✅ LM Studio Provider
- ✅ Provider 工厂函数

**LLM 服务层 (v0.1)**
- ✅ 中间件系统 (请求/响应/错误)
- ✅ 响应缓存 (LRU + TTL)
- ✅ 自动重试 (指数退避)
- ✅ 速率限制
- ✅ 统计收集
- ✅ 10+ 内置中间件

**记忆系统 (v0.1)**
- ✅ 短期记忆 (键值对存储、TTL、LRU 淘汰)
- ✅ 长期记忆 (持久化接口、语义搜索)
- ✅ 记忆管理器 (智能提升、自动整理)
- ✅ 嵌入生成器 (SimpleTFIDF、OpenAI)
- ✅ 访问统计和重要性评分

**中断/恢复**
- ✅ AgentAbortController
- ✅ 检查点管理
- ✅ 任务中断与恢复

**工作流节点**
- ✅ PlannerNode (规划节点)
- ✅ LLMPlannerNode (LLM 驱动规划)
- ✅ ToolRunnerNode (工具执行)
- ✅ VerifierNode (验证节点)
- ✅ ResponderNode (响应节点)
- ✅ LLMResponderNode (LLM 驱动响应)

**持久化**
- ✅ IndexedDB 适配器
- ✅ 内存持久化适配器

**测试**
- ✅ 236 个单元测试用例
- ✅ 端到端集成测试
- ✅ 高代码覆盖率

**文档**
- ✅ README.md
- ✅ API 文档
- ✅ 记忆系统指南
- ✅ 核心原则文档
- ✅ 编码标准
- ✅ 常见模式

#### Technical Details

- **Language**: TypeScript 5.3+
- **Runtime**: Node.js >= 18.0.0
- **Module System**: ESM
- **Build**: TypeScript Compiler
- **Test Framework**: Vitest
- **Dependencies**: 
  - zod (schema validation)
  - idb (IndexedDB wrapper)
  - marked (markdown parsing)

#### Package Info

- **Package Name**: `agent-workflow-framework`
- **License**: MIT
- **Repository**: GitHub
- **NPM**: [agent-workflow-framework](https://www.npmjs.com/package/agent-workflow-framework)

---

## [Unreleased]

### Planned Features

- [ ] 工具结果流式传输
- [ ] 增强的长期记忆持久化 (Vector DB)
- [ ] 多 Agent 协作
- [ ] 高级规划算法 (ReAct, Plan-and-Solve)
- [ ] 更多 LLM Provider (Claude, Cohere, etc.)
- [ ] 可视化调试工具
- [ ] 性能优化和基准测试
- [ ] 更多示例和教程

---

## Version History

### Versioning Guide

- **MAJOR**: 不兼容的 API 变更
- **MINOR**: 向下兼容的功能新增
- **PATCH**: 向下兼容的问题修复

### Release Notes by Version

#### [0.1.0] - Initial Public Release
首次公开发布，包含核心 Agent 系统、LLM 服务层和记忆系统。

---

**Legend**:
- ✅ Completed
- 🚧 In Progress
- 📅 Planned
- ⚠️ Deprecated
- 🔥 Breaking Change
