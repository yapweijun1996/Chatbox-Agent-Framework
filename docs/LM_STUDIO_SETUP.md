# LM Studio 配置说明

## 当前配置

框架已配置为使用 LM Studio 本地 LLM：

- **API 地址**: `http://127.0.0.1:6354`
- **模型**: `zai-org/glm-4.6v-flash`
- **Temperature**: `0.7`（可调整）
- **Max Tokens**: `2048`（可调整）

## 使用方法

### 1. 启动 LM Studio

确保 LM Studio 已启动并加载了 `zai-org/glm-4.6v-flash` 模型。

### 2. 运行 Demo

```bash
npm run dev
```

访问 `http://localhost:5173/`

### 3. 测试 LLM Planner

在输入框输入任务目标，例如：
- "优化这段 SQL 并保持结果一致"
- "分析用户行为数据并生成报告"
- "设计一个用户注册流程"

点击"开始执行"，Planner 节点会调用 LM Studio 生成任务步骤。

## 自定义配置

### 修改 LM Studio 地址或模型

编辑 `src/tools/lm-studio-tool.ts`：

```typescript
export const defaultLMStudioConfig: LMStudioConfig = {
  baseURL: 'http://127.0.0.1:YOUR_PORT', // 修改端口
  model: 'your-model-name', // 修改模型
  temperature: 0.7,
  maxTokens: 2048,
};
```

### 在代码中动态配置

```typescript
import { createLMStudioTool } from './tools/lm-studio-tool';

const customTool = createLMStudioTool({
  baseURL: 'http://127.0.0.1:6354',
  model: 'another-model',
  temperature: 0.5,
  maxTokens: 4096,
});

toolRegistry.register(customTool);
```

## API 兼容性

LM Studio 使用 OpenAI 兼容 API，支持以下端点：

- `POST /v1/chat/completions` - 聊天补全（框架使用）
- `GET /v1/models` - 列出可用模型

## 故障排除

### 1. 连接失败

**错误**: `LM Studio API 错误: Failed to fetch`

**解决**:
- 检查 LM Studio 是否正在运行
- 确认端口号正确（默认 6354）
- 检查防火墙设置

### 2. 模型未加载

**错误**: `No models loaded`

**解决**:
- 在 LM Studio 中加载 `zai-org/glm-4.6v-flash` 模型
- 等待模型加载完成（查看 LM Studio 状态）

### 3. 超时

**错误**: `工具执行超时 (30000ms)`

**解决**:
- 增加超时时间（编辑 `lm-studio-tool.ts` 中的 `timeout`）
- 检查模型是否响应缓慢
- 考虑使用更小的模型

## 性能优化

### 1. 调整 Temperature

- **低温度 (0.1-0.3)**: 更确定、一致的输出（适合任务规划）
- **中温度 (0.5-0.7)**: 平衡创造性和一致性
- **高温度 (0.8-1.0)**: 更有创造性的输出

### 2. 调整 Max Tokens

- **任务规划**: 500-1000 tokens 足够
- **复杂分析**: 2000-4096 tokens
- **注意**: 更多 tokens = 更慢的响应

### 3. 使用更快的模型

如果响应太慢，考虑使用更小的模型：
- `llama-3.2-3b`
- `phi-3-mini`
- `qwen-2.5-7b`

## 下一步

- 查看 [扩展指南](../docs/EXTENDING.md) 了解如何添加更多 LLM 工具
- 查看 [README](../README.md) 了解框架完整功能
