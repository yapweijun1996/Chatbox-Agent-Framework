# Chatbox Demo UI / UX 布局概览

本文帮助工程师快速理解当前 Demo 的界面结构、控件分布与交互逻辑，便于后续迭代或重构。

## 1. 整体框架

- **三栏式信息架构**：左侧是对话历史（Sidebar），中间是主要聊天视图（Chat Surface），右侧是可滑出的调试抽屉（Debug Drawer）。
- **顶部控制区**：主视图顶部固定一个 Top Bar，集中放置模型显示、流式开关、设置、调试入口等关键按钮。
- **底部 Composer**：输入区域固定在底部，含多行自适应文本框与发送按钮，并附加提示文本。
- **欢迎态**：当没有对话时，中间区域展示欢迎屏和四张快捷 Prompt 卡片。

## 2. 左侧 Sidebar

1. **Header 区域**：
   - Logo + 产品名「Chatbox / Agent Framework」。
   - `X` 按钮在桌面端用于收起侧栏；移动端同样通过此按钮或顶部汉堡按钮控制。
2. **主操作**：
   - 「+ New chat」按钮创建新会话，触发 `store.setState` 并清空消息列表。
3. **历史列表** (`#history-list`)：
   - 分组标签（Today 等）。
   - 每条记录包含标题、活动状态点、悬浮时的 rename/delete 图标。
   - 点击记录会加载对应会话的消息数组，并在 UI 中重放。
4. **底部用户卡片**：显示当前用户头像、名称、套餐等，在 UI 上作为视觉占位。
5. **响应式行为**：
   - 宽度 < 768px 时，侧栏变为抽屉模式，使用 `#sidebar-overlay` 遮罩和 `sidebarManager` 控制开合。

## 3. 中间 Chat Surface

### 3.1 Top Bar

- **左侧**：移动端菜单（汉堡按钮）控制侧栏。
- **中间**：模型选择 Chip，展示当前 Provider（如 “LM Studio (Local)”）。点击打开设置 Modal。
- **右侧按钮**：
  1. `Stream` pill 开关，切换是否使用流式响应，并更新全局状态。
  2. `Settings`（齿轮）打开 Modal。
  3. `<>`（双箭头）打开/关闭 Debug Drawer。

### 3.2 欢迎屏 & Prompt 卡片

- 组件 `#welcome-screen`，在没有消息时显示。
- 四张卡片（Explain framework、Show me how to extend tools、Debug an agent step、Sample conversation），点击自动填充输入框并触发发送。

### 3.3 消息时间线

- `#messages-list` 按顺序渲染 `message-row`：
  - `user` / `ai` / `thinking` 三种样式，含头像、内容、统计信息。
  - AI 消息支持 Markdown、代码块、统计徽章（token、时间、tps）。
- **Thinking 卡片**：发送后插入 `thinking` 行，Detail 面板展示模式（Chat vs Agent）、耗时、工具步骤等。
- **滚动行为**：
  - `ChatViewport` 追踪是否接近底部，决定是否自动滚动。
  - `#scroll-bottom-btn` 在离底部 >100px 时显示，点击滚动到底。

### 3.4 Composer 输入区

- 多行文本框 `#user-input`：自动扩展高度到 200px 上限。
- 发送按钮：在输入为空或 `isGenerating` 为真时禁用。
- 辅助说明 “ChatGPT can make mistakes...” 固定在输入框下方。
- `Enter` 发送，`Shift+Enter` 换行。

## 4. 右侧 Debug Drawer

- 默认隐藏在右侧，通过 Top Bar 的调试按钮或 `toggleDebug` 手势滑入。
- 内容区：
  1. **搜索**：顶部 Search box，可过滤日志文本。
  2. **过滤标签**：All / Steps / Events / Errors，实时显示数量。
  3. **Execution Steps** (`#steps-list`)：
     - 追踪 Agent Node 的 onStart/onEnd，含状态指示灯、detail 展开按钮。
     - `Export` 按钮导出当前日志。
  4. **Events** (`#events-container`)：显示 `agent.getEventStream()` 推送的事件摘要。
- Actions：`Clear` 清空日志，`X` 关闭抽屉。

## 5. 设置 Modal（Provider 配置）

- 三个 Provider 卡片（LM Studio / Gemini / OpenAI）切换不同表单。
- 表单字段：
  - **LM Studio**：Base URL、Model（含历史 datalist）。
  - **Gemini**：API Key、Model 下拉。
  - **OpenAI**：API Key、Base URL、Model 下拉。
- 保存逻辑：
  1. 复制当前设置到 `tempSettings`，在 Modal 中编辑。
  2. `Save` 按钮触发校验（必须提供所选 Provider 的凭证）。
  3. 成功后写入 localStorage，重建 Agent 实例，更新 UI。
- Modal 支持 Esc/Overlay 关闭，移动端全屏遮罩。

## 6. 关键交互流程

1. **发送消息**：
   - 用户输入 → `onSendMessage` (handleSend) 置 `isGenerating`=true。
   - UI 立即追加 User 消息 + AI Typing 占位。
   - Agent `chat()` 返回流式 chunk 时更新 AI 消息文本。
   - 完成后，显示统计、更新 Thinking 卡片、写入会话历史。
2. **切换会话**：
   - 点击历史记录 → 清空当前消息 → 重新渲染所选会话。
   - 删除/重命名通过 HistoryView 的回调与 store 更新。
3. **Stream Toggle**：
   - 点击后更新 store 并重新初始化 Agent，使新的 streaming 选项生效。
4. **Debug 追踪**：
   - Agent hooks 将节点状态写入 Steps 列表。
   - 事件总线的 `*` 监听器把所有 event 推入 Events 列表，方便排查。

## 7. 响应式 / 状态反馈

- Sidebar 与 Debug Drawer 都支持移动端滑入/滑出，避免占用主区域。
- Scroll to bottom、Typing Indicator、Thinking Steps 等状态反馈帮助用户理解 Agent 工作过程。
- 顶部 Provider Chip、Stream 状态点、Stats 徽章等视觉元素强调当前上下文。

---

通过以上分区与交互说明，工程师可以快速定位任一 UI 元素（按钮、列表、Modal、调试面板）及其对应的数据流与事件，便于扩展功能或重新设计界面。
