# NPM 发布指南

本文档说明如何将 `agent-workflow-framework` 发布到 NPM。

## 📋 发布前准备

### 1. 环境要求

- Node.js >= 18.0.0
- NPM 账号（需要登录）
- Git 版本控制

### 2. NPM 账号配置

```bash
# 登录 NPM
npm login

# 验证登录状态
npm whoami
```

### 3. 检查权限

如果是组织包，确保有发布权限：
```bash
npm access ls-packages
```

## 🚀 发布流程

### 版本号规范 (Semantic Versioning)

- **MAJOR** (1.0.0 → 2.0.0): 不兼容的 API 变更
- **MINOR** (1.0.0 → 1.1.0): 向下兼容的功能新增
- **PATCH** (1.0.0 → 1.0.1): 向下兼容的问题修复

### 标准发布步骤

#### 1. 确保代码质量

```bash
# 运行所有测试
npm run test:run

# 类型检查
npm run lint

# 确保没有错误
```

#### 2. 更新版本号

```bash
# Patch 版本 (0.1.0 → 0.1.1)
npm version patch

# Minor 版本 (0.1.0 → 0.2.0)
npm version minor

# Major 版本 (0.1.0 → 1.0.0)
npm version major

# 或手动指定版本
npm version 0.2.0
```

`npm version` 会自动：
- 更新 `package.json` 中的版本号
- 创建 git commit
- 创建 git tag
- 运行 `preversion`, `version`, `postversion` 钩子

#### 3. 更新 CHANGELOG.md

```markdown
## [0.2.0] - 2025-01-15

### Added
- 新功能描述

### Changed
- 变更说明

### Fixed
- Bug 修复
```

#### 4. 构建发布包

```bash
# 构建单文件 Bundle + 类型定义
npm run build:bundle
npm run build:lib

# 检查 dist 目录
ls -la dist/
```

#### 5. 验证发布内容

```bash
# 查看将要发布的文件
npm pack --dry-run

# 或实际打包查看
npm pack
tar -tzf agent-workflow-framework-0.1.0.tgz
```

#### 6. 运行发布检查

```bash
# 运行检查脚本
node scripts/check-publish.js
```

#### 7. 发布到 NPM

```bash
# 发布（生产版本）
npm publish

# 发布（beta 版本）
npm publish --tag beta

# 发布（测试，不会实际发布）
npm publish --dry-run
```

#### 8. 推送代码和标签

```bash
# 推送代码
git push

# 推送标签
git push --tags
```

## 🔄 版本管理策略

### Pre-release 版本

```bash
# 发布 alpha 版本
npm version prerelease --preid=alpha
# 结果: 0.1.0 → 0.1.1-alpha.0

npm publish --tag alpha
```

```bash
# 发布 beta 版本
npm version prerelease --preid=beta
# 结果: 0.1.0 → 0.1.1-beta.0

npm publish --tag beta
```

### 维护旧版本

```bash
# 切换到旧版本分支
git checkout v0.1.x

# 应用修复
git cherry-pick <commit-hash>

# 发布补丁版本
npm version patch
npm publish
```

## 📦 package.json 配置说明

### 关键字段

```json
{
  "name": "agent-workflow-framework",
  "version": "0.1.0",
  "main": "./dist/agent-framework.js",      // 单文件入口
  "module": "./dist/agent-framework.js",    // ESM 入口
  "types": "./dist/agent-framework.d.ts",   // TypeScript 类型定义
  "files": [                       // 包含的文件
    "dist",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ]
}
```

### 发布钩子

```json
{
  "scripts": {
    "prepublishOnly": "npm run test:run && npm run build:bundle && npm run build:lib",
    "preversion": "npm run test:run",
    "version": "npm run build:bundle && npm run build:lib && git add -A",
    "postversion": "git push && git push --tags"
  }
}
```

## 🔍 发布后验证

### 1. 检查 NPM 页面

访问: https://www.npmjs.com/package/agent-workflow-framework

验证：
- ✅ 版本号正确
- ✅ README 显示正确
- ✅ 下载统计开始记录

### 2. 测试安装

```bash
# 创建测试目录
mkdir test-install
cd test-install
npm init -y

# 安装包
npm install agent-workflow-framework

# 测试导入
node -e "import('agent-workflow-framework').then(m => console.log(Object.keys(m)))"
```

### 3. 验证 TypeScript 支持

```typescript
// test.ts
import { createAgent, createLLMProvider } from 'agent-workflow-framework';

const provider = createLLMProvider({
    type: 'lm-studio',
    baseURL: 'http://localhost:1234/v1',
    model: 'test-model',
});

const agent = createAgent({ provider });
```

```bash
npx tsc test.ts --noEmit
```

## 🛡️ 安全检查

### 运行安全审计

```bash
# 检查依赖漏洞
npm audit

# 自动修复
npm audit fix
```

### 检查包大小

```bash
# 安装 package-size 工具
npx package-size ./

# 或使用 bundlephobia
# 访问: https://bundlephobia.com/package/agent-workflow-framework
```

## 📊 发布清单

发布前确认：

- [ ] 所有测试通过 (`npm run test:run`)
- [ ] 类型检查通过 (`npm run lint`)
- [ ] 版本号已更新 (`npm version`)
- [ ] CHANGELOG 已更新
- [ ] README 准确反映当前功能
- [ ] 构建成功 (`npm run build`)
- [ ] 检查脚本通过 (`node scripts/check-publish.js`)
- [ ] Git 工作区干净
- [ ] 已登录 NPM (`npm whoami`)

## 🔧 常见问题

### Q: 发布失败，提示权限不足

A: 检查 NPM 登录状态和包名是否已被占用：
```bash
npm whoami
npm view agent-workflow-framework
```

### Q: 如何撤回已发布的版本？

A: 发布后 72 小时内可以撤回：
```bash
npm unpublish agent-workflow-framework@0.1.0
```

注意：不建议撤回已被下载的版本，应发布新的修复版本。

### Q: 如何废弃某个版本？

A: 使用 deprecate 命令：
```bash
npm deprecate agent-workflow-framework@0.1.0 "此版本存在问题，请升级到 0.1.1"
```

### Q: 如何管理 dist-tag？

```bash
# 查看所有 tag
npm dist-tag ls agent-workflow-framework

# 添加 tag
npm dist-tag add agent-workflow-framework@0.2.0 beta

# 删除 tag
npm dist-tag rm agent-workflow-framework beta
```

## 🔗 相关资源

- [NPM 官方文档](https://docs.npmjs.com/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [NPM Package Best Practices](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)

## 📝 发布记录模板

建议维护发布记录：

```markdown
## 发布记录

### v0.1.0 - 2025-12-19
- **发布人**: Your Name
- **测试状态**: ✅ 236/236 通过
- **构建状态**: ✅ 成功
- **发布时间**: 2025-12-19 10:00:00
- **NPM 链接**: https://www.npmjs.com/package/agent-workflow-framework/v/0.1.0
- **说明**: 首次公开发布
```
