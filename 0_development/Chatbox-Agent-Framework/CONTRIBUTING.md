# 贡献指南

感谢您考虑为 Agent Workflow Framework 做出贡献！

## 📋 行为准则

请遵循我们的行为准则，保持友好和尊重的沟通。

## 🚀 如何贡献

### 报告 Bug

在创建 Bug 报告前，请：
1. 检查[现有 Issues](https://github.com/yapweijun1996/Chatbox-Agent-Framework/issues)
2. 确保使用最新版本
3. 准备最小可复现示例

提交 Bug 时请包含：
- 清晰的标题和描述
- 复现步骤
- 预期行为 vs 实际行为
- 环境信息（Node 版本、OS 等）
- 代码示例或错误日志

### 功能请求

提交功能请求时请：
1. 说明用例和动机
2. 描述期望的 API 设计
3. 考虑向后兼容性
4. 提供示例代码（如适用）

### Pull Request

1. **Fork 仓库**
   ```bash
   git clone https://github.com/yapweijun1996/Chatbox-Agent-Framework.git
   cd agent-workflow-framework
   npm install
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bugfix-name
   ```

3. **进行修改**
   - 遵循编码标准（见 `docs/agent/CODING_STANDARDS.md`）
   - 添加测试
   - 更新文档

4. **运行测试**
   ```bash
   npm test          # 交互式测试
   npm run test:run  # 单次运行
   npm run lint      # 类型检查
   ```

5. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

   提交消息格式：
   - `feat:` 新功能
   - `fix:` Bug 修复
   - `docs:` 文档更新
   - `test:` 测试相关
   - `refactor:` 代码重构
   - `perf:` 性能优化
   - `chore:` 构建/工具变更

6. **推送并创建 PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   
   然后在 GitHub 上创建 Pull Request

## 📝 编码标准

### TypeScript 规范

```typescript
// ✅ 好的示例
export interface UserConfig {
    name: string;
    age?: number;  // 可选字段
}

export function createUser(config: UserConfig): User {
    // 实现
}

// ❌ 避免
function doSomething(x: any) {  // 不使用 any
    // ...
}
```

### 文件组织

```
src/
├── core/          # 核心功能（< 300 行/文件）
├── nodes/         # 工作流节点
├── providers/     # Provider 实现
└── tools/         # 工具实现
```

### 测试规范

```typescript
describe('ModuleName', () => {
    describe('functionName', () => {
        it('should do something specific', () => {
            // Arrange
            const input = {};
            
            // Act
            const result = functionName(input);
            
            // Assert
            expect(result).toBe(expected);
        });
    });
});
```

## 🧪 测试要求

- 所有新功能必须有测试覆盖
- Bug 修复应包含回归测试
- 保持测试覆盖率 > 80%
- 测试应该：
  - 独立且可重复
  - 有清晰的描述
  - 快速执行

## 📚 文档要求

更新以下文档（如适用）：
- `README.md` - 主要功能介绍
- `CHANGELOG.md` - 版本变更
- API 文档 - JSDoc 注释
- 示例代码
- 相关指南（`docs/` 目录）

### JSDoc 示例

```typescript
/**
 * 创建新的 Agent 实例
 * 
 * @param config - Agent 配置选项
 * @returns 配置好的 Agent 实例
 * 
 * @example
 * ```typescript
 * const agent = createAgent({
 *     provider,
 *     mode: 'chat',
 * });
 * ```
 */
export function createAgent(config: AgentConfig): Agent {
    // ...
}
```

## 🔍 代码审查流程

PR 将经过以下审查：
1. **自动检查** - CI/CD 运行测试和 lint
2. **代码审查** - 维护者审查代码质量
3. **文档检查** - 确保文档完整
4. **性能评估** - 评估性能影响（如适用）

审查标准：
- [ ] 代码符合项目风格
- [ ] 测试通过且覆盖充分
- [ ] 文档完整且准确
- [ ] 无明显性能问题
- [ ] 向后兼容（或有迁移指南）

## 🎯 优先级领域

我们特别欢迎以下方面的贡献：

**高优先级**
- Bug 修复
- 性能优化
- 文档改进
- 测试覆盖率提升

**中优先级**
- 新的 LLM Provider
- 新的工具实现
- 示例和教程

**低优先级**
- 依赖项升级
- 代码风格调整

## 💡 开发提示

### 本地开发

```bash
# 安装依赖
npm install

# 运行开发服务器
npm run dev

# 运行测试（watch 模式）
npm test

# 构建（单文件 Bundle + Demo）
npm run build
```

### 调试

```typescript
// 使用 console.log
console.log('[Debug]', variable);

// 或使用 EventStream 追踪
agent.eventStream.on('*', (event) => {
    console.log('Event:', event);
});
```

### 常见问题

**Q: 如何添加新的 LLM Provider？**

A: 参考 `src/providers/openai-provider.ts`：
1. 继承 `LLMProvider`
2. 实现 `chat()` 和 `chatStream()`
3. 添加到 `provider-factory.ts`
4. 编写测试

**Q: 如何添加新工具？**

A: 参考 `src/tools/example-tools.ts`：
1. 定义工具 schema
2. 实现 `execute` 函数
3. 注册到 `ToolRegistry`

## 📞 联系方式

- **Issues**: [GitHub Issues](https://github.com/yapweijun1996/Chatbox-Agent-Framework/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yapweijun1996/Chatbox-Agent-Framework/discussions)
- **Email**: yapweijun1996@gmail.com

## 🙏 致谢

感谢所有贡献者！您的努力让这个项目变得更好。

## 📄 许可证

通过贡献代码，您同意您的贡献将在 [MIT 许可证](./LICENSE) 下发布。
