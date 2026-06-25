# DeepSeek Obsidian Plugin — 完整技术方案

## 一、与 Claudian 的架构差异

| 维度 | Claudian | DeepSeek Obsidian Plugin（本项目） |
|------|----------|-------------------------------------|
| AI 驱动方式 | 依赖外部 CLI（Claude Code CLI） | 直接调用 DeepSeek API，自建 Agent 循环 |
| Agent 循环 | 由 Claude Code 进程内部实现 | 自主实现 ReAct / Tool-Use 循环 |
| 依赖 | 必须安装 Claude Code CLI | 零外部依赖，仅需 API Key |
| Tool 系统 | 继承 Claude Code 的 Tool 集 | 自建 Obsidian 专用 Tool 集 |
| MCP 支持 | 依赖 Claude Code 内置 MCP | 可选内置 MCP Client |
| 架构复杂度 | 较重（子进程管理 + JSON-RPC） | 较轻（纯 HTTP API + 本地 Agent Loop） |

**核心设计思路**：不依赖外部 CLI，直接用 TypeScript 实现轻量 Agent 循环，围绕 Obsidian Vault 构建专用 Tool 集。

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     Obsidian App                          │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Chat Panel  │  │ Inline Edit  │  │ Command Palette│  │
│  │ (侧边栏)     │  │ (内联编辑)    │  │ (命令面板)      │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                │                   │            │
│  ┌──────┴────────────────┴───────────────────┴────────┐  │
│  │              Plugin Core (main.ts)                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ Settings │  │  i18n    │  │  Command Register │  │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  └─────────────────────┬───────────────────────────────┘  │
│                        │                                   │
│  ┌─────────────────────┴───────────────────────────────┐  │
│  │                  Agent 引擎层                         │  │
│  │  ┌───────────┐  ┌───────────┐  ┌────────────────┐  │  │
│  │  │Agent Loop │  │Tool Registry│ │Context Builder │  │  │
│  │  │(ReAct循环)│  │(工具注册表) │  │(上下文构建器)   │  │  │
│  │  └─────┬─────┘  └─────┬─────┘  └───────┬────────┘  │  │
│  │        │              │                 │            │  │
│  │  ┌─────┴──────────────┴─────────────────┴────────┐  │  │
│  │  │            LLM Provider 适配层                 │  │  │
│  │  │  DeepSeek Chat API / FIM / 流式 SSE           │  │  │
│  │  └───────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
│                        │                                   │
│  ┌─────────────────────┴───────────────────────────────┐  │
│  │               Vault 操作层 (Tools)                    │  │
│  │  read_file │ write_file │ search │ list_dir │ ...   │  │
│  │  insert_at_cursor │ replace_selection │ frontmatter │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │ HTTPS
                   ┌──────────┴──────────┐
                   │   DeepSeek API       │
                   │   api.deepseek.com   │
                   │   /chat/completions  │
                   │   /fim/completions   │
                   └─────────────────────┘
```

---

## 三、功能模块对标 Claudian

| Claudian 功能 | 本项目实现方式 |
|---------------|---------------|
| **Chat Sidebar** | 右侧可折叠面板，React/Preact 实现，支持多标签 |
| **Inline Edit** | 选中文本 + 快捷键 → Agent 直接修改编辑器内容，diff 预览 |
| **Slash Commands & Skills** | `/` 触发命令面板，`$` 触发预定义 Skill 模板，存储为 `.md` 文件 |
| **@mention** | `@` 触发文件/文件夹模糊搜索，注入上下文 |
| **Plan Mode** | Shift+Tab 切换，先让 AI 输出计划再执行，通过 system prompt 控制 |
| **Instruction Mode (#)** | `#` 触发自定义指令输入，作为本次对话的额外 system message |
| **Multi-Tab Conversations** | 每个标签独立 Agent 会话，持久化到 `vault/.deepseek/` |
| **Fork / Resume** | 从任意历史消息分叉，创建新对话分支 |
| **MCP Servers** | 可选内置 MCP Client（stdio / SSE / HTTP），连接外部工具 |
| **图片视觉分析** | DeepSeek 支持 vision，拖入图片即可分析 |

---

## 四、技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 语言 | TypeScript 5.x | Obsidian 官方要求 |
| 构建 | esbuild | Obsidian 插件标配，快 |
| UI 框架 | Preact + hooks | 轻量（3KB），无需 React 生态 |
| 状态管理 | Zustand | 极简，适合插件场景 |
| HTTP | 原生 `fetch` + ReadableStream | 流式 SSE 解析，零依赖 |
| 数据持久化 | Obsidian `PluginData` API + JSON 文件 | 官方推荐方式 |
| Markdown 解析 | `obsidian` 内置 MarkdownRenderer | 渲染对话内容 |

### 不引入的依赖（与 Claudian 的关键区别）

- 不依赖任何外部 CLI 进程（无需 `child_process.spawn`）
- 不引入 `openai` npm 包（直接用 fetch，DeepSeek API 格式简单）
- 不引入 `better-sqlite3` 等 native 模块（避免跨平台编译问题）

---

## 五、项目结构

```
deepseek-obsidian/
├── manifest.json              # Obsidian 插件清单
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── styles.css                  # 全局样式
├── versions.json               # 版本兼容性
│
├── src/
│   ├── main.ts                 # 插件入口，注册命令/视图/设置
│   │
│   ├── settings/
│   │   ├── SettingsTab.ts      # 设置面板 UI
│   │   └── types.ts            # 设置类型定义
│   │
│   ├── agent/
│   │   ├── AgentLoop.ts        # 核心 ReAct 循环
│   │   ├── AgentSession.ts     # 单个对话会话管理
│   │   ├── SessionManager.ts   # 多标签/多会话管理
│   │   ├── ContextBuilder.ts   # 上下文构建器（系统提示+历史+文件）
│   │   └── ConversationFork.ts # 对话分叉逻辑
│   │
│   ├── llm/
│   │   ├── DeepSeekProvider.ts # DeepSeek API 调用（chat + FIM）
│   │   ├── StreamParser.ts     # SSE 流式解析
│   │   ├── types.ts            # Message / ToolCall / Token 类型
│   │   └── TokenCounter.ts     # Token 估算（用于上下文窗口管理）
│   │
│   ├── tools/
│   │   ├── ToolRegistry.ts     # 工具注册表 + 调度
│   │   ├── vault/
│   │   │   ├── ReadFile.ts     # 读取笔记内容
│   │   │   ├── WriteFile.ts    # 创建/覆盖笔记
│   │   │   ├── EditFile.ts     # 精确字符串替换编辑
│   │   │   ├── SearchVault.ts  # 全文搜索（利用 Obsidian Search API）
│   │   │   ├── ListDir.ts      # 列出目录下文件
│   │   │   ├── GetFrontmatter.ts # 读取 YAML frontmatter
│   │   │   ├── GetBacklinks.ts # 获取反向链接
│   │   │   └── MoveRename.ts   # 移动/重命名文件
│   │   ├── editor/
│   │   │   ├── GetSelection.ts # 获取当前选中文本
│   │   │   ├── ReplaceSelection.ts # 替换选中文本
│   │   │   ├── InsertAtCursor.ts   # 在光标处插入
│   │   │   ├── GetActiveNote.ts    # 获取当前活跃笔记内容
│   │   │   └── OpenNote.ts         # 打开指定笔记
│   │   ├── knowledge/
│   │   │   ├── SemanticSearch.ts   # 语义搜索（可选，需 Embedding）
│   │   │   ├── AutoTag.ts          # 智能标签建议
│   │   │   └── LinkSuggestion.ts   # 双向链接建议
│   │   └── external/
│   │       ├── WebFetch.ts      # 抓取网页内容
│   │       └── ShellCommand.ts  # 执行 Shell 命令（需用户授权）
│   │
│   ├── ui/
│   │   ├── ChatView.ts          # 侧边栏聊天视图（Obsidian ItemView）
│   │   ├── ChatPanel.tsx        # 聊天面板 Preact 组件
│   │   ├── MessageBubble.tsx    # 消息气泡（Markdown 渲染）
│   │   ├── ToolCallBubble.tsx   # Tool Call 展示卡片
│   │   ├── InputBar.tsx         # 输入栏（@mention、/command、附件）
│   │   ├── ConversationTabs.tsx # 多标签切换
│   │   ├── InlineEditModal.ts   # 内联编辑 diff 预览弹窗
│   │   ├── DiffViewer.tsx       # 字级 Diff 对比组件
│   │   └── PlanApproval.tsx     # Plan Mode 审批卡片
│   │
│   ├── skills/
│   │   ├── SkillLoader.ts       # 加载 vault 级/用户级 Skill
│   │   └── templates/           # 内置 Skill 模板
│   │       ├── summarize.md
│   │       ├── translate.md
│   │       ├── outline.md
│   │       ├── brainstorm.md
│   │       └── review.md
│   │
│   ├── mcp/
│   │   ├── MCPClient.ts         # MCP 客户端（stdio/SSE/HTTP）
│   │   ├── MCPToolAdapter.ts    # MCP Tool → 内部 Tool 适配
│   │   └── MCPManager.ts        # MCP 服务器生命周期管理
│   │
│   ├── storage/
│   │   ├── ConversationStore.ts # 对话持久化
│   │   └── SkillStore.ts        # Skill 存储
│   │
│   ├── i18n/
│   │   ├── index.ts             # i18n 入口
│   │   ├── zh-CN.ts             # 简体中文
│   │   └── en.ts                # 英文
│   │
│   └── utils/
│       ├── path.ts              # 路径处理
│       ├── debounce.ts          # 防抖
│       └── logger.ts            # 日志
```

---

## 六、核心实现细节

### 6.1 Agent Loop（ReAct 循环）

```
用户输入
    │
    ▼
┌─────────────────────────────────────┐
│  1. ContextBuilder 构建上下文        │
│     - System Prompt（角色+可用工具） │
│     - 历史消息                       │
│     - 当前文件/选中文本（如有）       │
│     - @mention 引用的文件内容        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. 调用 DeepSeek Chat API          │
│     - 携带 tools 定义               │
│     - 流式接收响应                   │
└──────────────┬──────────────────────┘
               │
               ▼
       ┌───────┴────────┐
       │ 响应类型判断     │
       └───┬────────┬───┘
           │        │
     text_content  tool_calls
           │        │
           ▼        ▼
    ┌──────────┐ ┌──────────────────┐
    │ 直接输出  │ │ 3. 执行 Tool Call │
    │ 给用户    │ │   安全审批检查     │
    └──────────┘ │   执行并获取结果    │
                 │   结果注入回上下文  │
                 └────────┬─────────┘
                          │
                          ▼
                   回到步骤 1（循环）
              （最多 N 轮，可配置）
```

### 6.2 Tool Call 安全模型

每个 Tool 定义包含风险等级：

```typescript
enum RiskLevel {
  READ_ONLY,    // 只读：read_file, search, list_dir, get_selection
  EDIT_SAFE,    // 安全编辑：insert_at_cursor, replace_selection（有撤销支持）
  EDIT_DANGER,  // 危险编辑：write_file, move_rename（覆盖/移动文件）
  EXTERNAL,     // 外部操作：shell_command, web_fetch（需显式授权）
}
```

- `READ_ONLY`：直接执行，无需确认
- `EDIT_SAFE`：首次执行前弹窗确认"允许 AI 编辑当前笔记"
- `EDIT_DANGER`：每次都弹窗确认
- `EXTERNAL`：每次弹窗 + 显示完整命令

### 6.3 DeepSeek API 调用

```typescript
// 关键：DeepSeek 完全兼容 OpenAI Chat Completions 格式
// 包括 function calling / tool_use

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

async function chat(
  messages: DeepSeekMessage[],
  tools: ToolDefinition[],
  onChunk: (delta: string) => void,
  signal: AbortSignal
): Promise<DeepSeekMessage> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',  // 或 deepseek-reasoner
      messages,
      tools,
      tool_choice: 'auto',
      stream: true,
      max_tokens: 8192,
    }),
    signal,
  });

  // SSE 流式解析...
  // 累积 tool_calls，实时推送 text delta
}
```

### 6.4 上下文窗口管理

DeepSeek 支持 1M tokens 上下文，但为控制成本：

```typescript
class ContextManager {
  private maxTokens = 64000; // 可配置

  // 智能压缩策略
  async compact(messages: Message[]): Promise<Message[]> {
    // 1. 保留最近 N 轮完整对话
    // 2. 对更早的消息做摘要压缩
    // 3. 始终保留 system prompt
    // 4. Tool Call 结果超长时截断并标注
  }
}
```

### 6.5 Inline Edit Diff 实现

```
用户选中文本 → 按快捷键 → 弹出输入框
→ AI 返回修改后的文本
→ 展示 DiffViewer（基于 diff-match-patch 或简易实现）
→ 用户确认 → 替换选中文本
→ 支持 Ctrl+Z 撤销
```

---

## 七、开发路线图

### Phase 1：脚手架 + 基础对话（Week 1）

- [ ] 用官方 `obsidian-sample-plugin` 初始化项目
- [ ] 配置 esbuild + TypeScript
- [ ] 实现 SettingsTab：API Key、Base URL、模型选择
- [ ] 实现 DeepSeekProvider：基础 Chat API（无 tool calling）
- [ ] 实现 ChatView + ChatPanel：侧边栏对话面板
- [ ] 流式输出渲染
- [ ] 单会话持久化

**可交付**：能在 Obsidian 侧边栏和 DeepSeek 对话。

### Phase 2：Agent + Tool 系统（Week 2）

- [ ] 实现 ToolRegistry + Tool 基类
- [ ] 实现核心 Vault Tools：read_file, search, list_dir
- [ ] 实现 AgentLoop：ReAct 循环
- [ ] 实现 Tool Call 安全审批
- [ ] Tool Call 结果卡片 UI
- [ ] 多轮对话 + 历史管理

**可交付**：DeepSeek 能读取、搜索你的 Vault。

### Phase 3：编辑能力 + 上下文增强（Week 3）

- [ ] 实现 Editor Tools：get_selection, replace_selection, insert_at_cursor
- [ ] 实现 InlineEditModal + DiffViewer
- [ ] 实现 @mention 文件引用
- [ ] 实现 ContextBuilder（当前文件自动注入）
- [ ] 实现 / 斜杠命令
- [ ] 实现 $ 技能模板

**可交付**：AI 能编辑笔记内容，选中文本直接改。

### Phase 4：多会话 + 高级功能（Week 4）

- [ ] 多标签对话管理
- [ ] 对话分叉（Fork）
- [ ] Plan Mode
- [ ] Instruction Mode (#)
- [ ] 图片附件支持（vision）
- [ ] i18n（中/英）

**可交付**：完整对标 Claudian 的对话体验。

### Phase 5：知识管理 + MCP（Week 5-6）

- [ ] 知识检索：AutoTag、LinkSuggestion
- [ ] 可选语义搜索（Embedding + 向量存储）
- [ ] MCP Client（stdio/SSE/HTTP）
- [ ] Shell 命令执行（高级权限模型）
- [ ] 性能优化 + 上下文压缩
- [ ] 发布到 Obsidian Community Plugins

**可交付**：可发布的 Obsidian 社区插件。

---

## 八、DeepSeek 特定优势

| DeepSeek 特性 | 在插件中的利用 |
|--------------|---------------|
| **1M 上下文** | 可加载大量笔记片段到上下文，减少检索轮次 |
| **deepseek-reasoner** | Plan Mode 使用推理模型，先思考再执行 |
| **FIM 补全** | 内联编辑时使用 FIM API，更精准地插入/替换文本 |
| **极低成本** | 用户使用门槛低，¥1/百万 tokens 级别 |
| **Tool Calling** | 原生支持 function calling，Agent 循环无需特殊适配 |
| **JSON Mode** | 结构化输出（标签提取、元数据处理）可用 JSON mode |

---

## 九、启动命令

```bash
# 1. 克隆模板
git clone https://github.com/obsidianmd/obsidian-sample-plugin.git deepseek-obsidian
cd deepseek-obsidian

# 2. 安装依赖
npm install

# 3. 添加 UI 依赖（可选，先原生 Obsidian UI 也可以）
npm install preact zustand

# 4. 开发模式
npm run dev

# 5. 将插件目录软链接到测试 Vault
# 在 Obsidian 中启用社区插件 → 加载本地插件
```

---

## 十、manifest.json

```json
{
  "id": "deepseek-ai",
  "name": "DeepSeek AI Assistant",
  "version": "0.1.0",
  "minAppVersion": "1.7.2",
  "description": "DeepSeek AI agent as your vault's brain. Read, write, search, and manage notes with natural language.",
  "author": "Your Name",
  "authorUrl": "https://github.com/yourname/deepseek-obsidian",
  "isDesktopOnly": true
}
```

---

## 十一、关键对比总结

| | Claudian | DeepSeek Plugin |
|---|---------|----------------|
| AI 后端 | Claude (via CLI) | DeepSeek (via HTTP API) |
| 安装复杂度 | 需装 Claude Code CLI | 只需 API Key |
| 离线能力 | 不支持（CLI 也需要网络） | 不支持 |
| MCP | Claude Code 内置 | 自建 MCP Client |
| 成本 | Claude 定价 | DeepSeek 极低 |
| 架构重量 | 子进程 + JSON-RPC | 纯 HTTP + Agent Loop |
| 可定制性 | 受 Claude Code CLI 限制 | 完全自主控制 |
*（内容由AI生成，仅供参考）*
