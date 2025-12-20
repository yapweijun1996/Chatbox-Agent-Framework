# Project Plan: Chatbox Agent Framework

> Version: v0.2.0 (Code Review & Optimization)  
> Status: Active  
> Last Updated: 2025-12-20

---

## 🎯 Project Overview

**Chatbox-Agent-Framework** 是一个生产级的 JavaScript/TypeScript AI Agent 工作流框架，核心设计参考了业界最佳实践。

### 设计方向

聚焦轻量、可扩展的 Agent Framework：工作流、工具编排、状态与执行可靠性。

---

## 📊 当前状态总结（v0.2.0）

### ✅ 已完成的核心功能（精简）

#### 1. Agent Framework（代理框架）
- [x] **三种运行模式**: chat / agent / auto
- [x] **GraphRunner**: 状态机执行引擎，支持 checkpoint 和恢复
- [x] **工作流节点**: Planner, ToolCallDecider, ToolRunner, Verifier, Responder, Confirmation
- [x] **Intent Router**: Rule-based 和 LLM-based 两种实现
- [x] **状态管理**: 不可变状态（Immer），telemetry 追踪
- [x] **错误处理**: 分类错误、重试策略、fallback
- [x] **RBAC**: 角色和权限管理
- [x] **Audit Log**: 审计日志

#### 2. LLM Service Layer（LLM 服务层）
- [x] **Middleware System**: 请求/响应/错误中间件
- [x] **Retry & Rate Limiting**: 指数退避、速率限制

#### 3. 多 Provider 支持
- [x] OpenAI Provider
- [x] Google Gemini Provider
- [x] LM Studio Provider（本地）

#### 4. 工具和测试
- [x] **测试覆盖**：236 个用例通过
- [x] **TypeScript 严格类型**

---

## 🔍 深度审查发现（2025-12-20）

### ⚠️ Agent Framework 优化点

#### 问题 4：工作流编排灵活性不足
**位置**: `src/core/agent.ts` Line 203-257

**现状**:
- Graph 定义硬编码在 `initializeRunner` 中
- 不支持用户自定义节点顺序
- 不支持并行节点执行

**建议优化**:
- [x] 暴露 `GraphDefinition` API
- [x] 支持 parallel edges（并行工具调用）
- [x] 参考 LangGraph 的 Conditional Edges

**最小验收标准（建议补充）**:
- GraphDefinition API 最小能力：节点注册、边类型（顺序/条件/并行）、执行钩子、静态校验（入口存在、节点唯一、边合法）
- 并行边状态合并模型：明确合并规则（合并次序、冲突策略、telemetry 合并），并保证不可变状态一致性（默认确定性重放，合并顺序固定/可配置）
- 向后兼容/迁移：保留默认图契约（现有 initializeRunner 的等价默认图），未指定 GraphDefinition 时行为不变
- Conditional edges 语义：谓词输入仅 State、无副作用、顺序固定、失败时回退策略（默认 false 或抛错）
- 测试目标：图校验错误、并行竞态、可重复性（确定性重放或显式声明非确定性）

#### 问题 5：LLM Planner 规划质量依赖 Prompt
**位置**: `src/nodes/llm-planner.ts`

**现状**:
- Prompt 是静态的，不适应不同领域
- 没有 Few-shot examples
- 缺少自我反思（Self-reflection）

**建议优化**:
- [x] 支持动态 Prompt 模板
- [x] 增加 ReAct、Chain-of-Thought 规划策略
- [x] 实现 Self-reflection 规划复盘
- [x] 实现 Plan-and-Execute 循环优化

#### 问题 6：Intent Router 决策准确性不足
**位置**: `src/core/intent-router.ts`

**现状**:
- Rule-based router 过于简单（仅判断是否有工具）
- LLM router 依赖单次调用，容易误判
- 没有学习机制

**建议优化**:
- [x] 增加更多启发式规则
- [x] 支持多轮澄清对话
- [ ] 考虑强化学习优化路由

#### 问题 7：工具执行缺少沙盒隔离
**位置**: `src/nodes/tool-runner.ts`

**安全风险**:
- 工具直接在主进程执行，无隔离
- 没有资源限制（CPU、内存）
- 没有网络隔离

**建议优化**:
- [x] 使用 Child Process 隔离
- [x] 使用 Web Workers 隔离
- [x] 实现资源配额（CPU/内存，参考 Codex CLI）
- [x] 支持工具白名单和黑名单

---

## 🗺️ 改进路线图

### Phase 1: 短期优化（1-2 周）
**目标**: 提升核心功能稳定性与可用性

#### 1.1 Intent Router 改进
- [x] 增加启发式规则（关键词、问题类型）
- [x] 支持多轮澄清对话
- [x] 添加决策日志和分析

#### 1.2 工具安全性完善
- [x] 实现工具执行白名单
- [x] 添加执行超时保护（per-tool timeout）
- [x] 记录工具调用审计日志

#### 1.3 工作流编排可扩展
- [x] 暴露 `GraphDefinition` API（自定义节点顺序/条件）
- [x] 支持 parallel edges（并行工具调用）
- [x] 提供默认 Graph 模板（轻量/标准/严格）
- [x] 最小验收标准：GraphDefinition 能力、并行合并、兼容性、Conditional 语义、测试目标

#### 1.4 文档和示例
- [ ] 更新 cookbook 示例（自定义 Graph、工具确认）
- [ ] 创建 Agent Framework 最佳实践文档

---

### Phase 2: 中期增强（1-2 个月）
**目标**: 扩展高级编排能力

#### 2.1 动态工作流编排
- [x] 实现 Conditional Edges（条件分支）
- [x] 添加工作流可视化工具
- [x] 提供配置化编排 JSON Schema
- [x] GraphDefinition 形态扩展：Phase 2 增加 JSON Schema（配置式），Phase 1 保持 TS API

#### 2.2 高级规划策略
- [x] 支持 ReAct（Reasoning + Acting）
- [x] 实现 Plan-and-Execute 循环优化

#### 2.3 工具沙盒隔离
- [x] Web Workers 工具隔离
- [x] Child Process 沙盒（Node.js）
- [x] 资源配额管理（CPU/内存）
- [x] 工具权限细粒度控制

---

### Phase 3: 长期演进（3-6 个月）
**目标**: 规模化与企业级能力

#### 3.1 多 Agent 协作
- [x] Agent-to-Agent 通信协议
- [x] 任务分解和分配
- [x] 协作模式（参考 CrewAI）
- [x] Agent 路由和负载均衡

#### 3.2 可视化调试器
- [x] 实时状态图可视化
- [x] 工具调用追踪

#### 3.3 分布式执行
- [x] 多机并行执行（worker pool 草案）
- [x] 分布式 Checkpoint（接口草案）
- [x] 任务队列系统（接口草案）
- [ ] 云部署模板（AWS、GCP、Azure）
- [x] 任务队列持久化适配（接口草案）
- [x] IndexedDB 任务队列持久化适配
- [x] 任务队列工厂（可配置创建）
- [x] Checkpoint 持久化接入 Agent/Runner
- [x] 任务结果查询（getResult/listResults）

#### 3.4 性能优化
- [ ] 工具调用批处理
- [ ] LLM 请求合并
- [ ] 增量更新和懒加载

#### 3.5 企业级功能
- [ ] SSO 集成（OAuth、SAML）
- [ ] 审计日志导出
- [ ] SLA 监控和告警

---

## ✅ 成功指标

| 指标 | 目标 | 当前 | 状态 |
|------|------|------|------|
| Test Coverage | 100% | 100% | ✅ |
| Documentation | Complete | 10+ docs | ✅ |
| Time to "Hello World" | < 5 mins | ~10 mins | 🔄 |
| Intent Router Accuracy | > 95% | ~80% | 🔄 |
| Tool Execution Safety | Sandboxed | Direct | ❌ |
| Workflow Flexibility | Custom Graphs | Fixed | ❌ |

---

## 🚀 即将发布

### v0.2.1-alpha (本周)
- [ ] 提交审查报告和优化建议
- [ ] 更新 CHANGELOG.md
- [ ] Tag release: v0.2.1-alpha

### v0.3.0 (2-3 周后)
- [ ] 完成 Phase 1 短期优化
- [ ] 发布 Agent Framework 核心增强版
- [ ] NPM 正式发布

---

## 📝 设计原则确认

本项目严格遵循以下设计原则（来自 ChatGPT 和 Codex CLI）：

1. **不可变状态管理** - 所有状态更新通过 `updateState()`
2. **事件驱动架构** - 完整的 EventStream 可观测性
3. **契约优先工具** - Zod schema 验证（输入/输出）
4. **全面错误处理** - 分类、重试、降级、回滚
5. **模块化和可扩展** - 节点、工具可插拔（持久化为可选模块）
6. **安全和权限** - RBAC、审计、工具确认
7. **性能和可靠性** - 缓存、批处理、资源限制

---

**最后更新**: 2025-12-20  
**下一次审查**: 2025-12-27（完成 Phase 1.1 后）

---

## 📝 最近审查记录

### 2025-12-20: Stop Logic & Memory System Review

**审查内容**:
1. ✅ Stop 按钮逻辑 - 已验证正确
2. ✅ LM Studio Provider Abort 处理 - 已优化流式模式
3. ✅ Context 保存机制 - 已验证部分内容保存
4. ✅ Agent Abort 感知 - 已验证完整可观测性
5. ✅ Memory System 启用 - **已修复配置问题**

**发现的问题**:
- ❌ Memory 未启用：`demo/main.ts` 缺少 `memory` 和 `enableMemory` 配置
- ⚠️ 流式 Abort 不完整：`lm-studio-provider.ts` 缺少流读取中的 abort 检查
- ⚠️ 中断对话未保存到记忆系统

**已修复**:
- ✅ 在 `demo/main.ts` 中启用 Memory Manager
- ✅ 配置 Chat Memory 和 Agent Memory 策略
- ✅ 在 `lm-studio-provider.ts` 流式读取中添加 abort 检查
- ✅ 中断对话保存到短期记忆（标记为 'interrupted'）

**详细报告**: 见 `STOP_LOGIC_REVIEW.md`
