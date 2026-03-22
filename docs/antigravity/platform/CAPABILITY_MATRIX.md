# Platform Capability Matrix

> **Version**: 2.9.0
> **Last Updated**: 2026-02-06
> **Purpose**: 各平台功能支持状态一览

---

## 功能支持矩阵

| 功能 | ChatGPT | Gemini | Claude | Deepseek | 备注 |
|:---|:---:|:---:|:---:|:---:|:---|
| **基础功能** | | | | | |
| Markdown 复制 | ✅ | ✅ | 🔲 | ✅ | |
| LaTeX 公式复制 | ✅ | ✅ | 🔲 | ✅ | KaTeX 渲染 |
| 代码块复制 | ✅ | ✅ | 🔲 | ✅ | |
| 字数统计 | ✅ | ✅ | ✅ | ✅ | CJK 感知 |
| 工具栏注入 | ✅ | ✅ | ✅ | ✅ | |
| ChatGPT 消息折叠 + 右侧快捷按钮 | ✅ | ❌ | ❌ | ❌ | ChatGPT 专属设置 |
| **阅读器功能** | | | | | |
| ReaderPanel 打开 | ✅ | ✅ | 🔲 | ✅ | |
| 分页导航 | ✅ | ✅ | 🔲 | ✅ | |
| 流式输出检测 | ✅ | ✅ | ✅ | ✅ | Copy Button 机制 |
| 用户提问提取 | ✅ | ✅ | ✅ | ✅ | Pagination Tooltip |
| **书签功能** | | | | | |
| 消息收藏 | ✅ | ✅ | 🔲 | ✅ | |
| 书签管理面板 | ✅ | ✅ | 🔲 | ✅ | |
| **消息发送** _(v2.4.0)_ | | | | | |
| 输入框同步 | 🔲 | 🔲 | 🔲 | 🔲 | 待实现 |
| 发送按钮模拟 | 🔲 | 🔲 | 🔲 | 🔲 | 待实现 |
| 回复完成检测 | 🔲 | 🔲 | 🔲 | 🔲 | 待实现 |
| **导出功能** _(v2.7.0)_ | | | | | |
| Markdown 导出 | 🔲 | 🔲 | 🔲 | 🔲 | 计划中 |
| PDF 导出 | 🔲 | 🔲 | 🔲 | 🔲 | 计划中 |

---

## 图例

| 符号 | 含义 |
|:---:|:---|
| ✅ | 已实现 |
| 🔲 | 计划中 |
| ⚠️ | 部分支持 |
| ❌ | 不支持 |

---

## 平台特有配置

### ChatGPT

| 项目 | 值 |
|:---|:---|
| URL 匹配 | `chatgpt.com`, `chat.openai.com` |
| 输入框 | ProseMirror (`#prompt-textarea`) |
| 发送按钮 | `.composer-submit-button-color` |
| 特殊处理 | 消息折叠；右侧固定折叠/展开按钮 |
| 设置分组 | `chatgpt`（`foldingMode`, `defaultExpandedCount`, `showFoldDock`） |

### Gemini

| 项目 | 值 |
|:---|:---|
| URL 匹配 | `gemini.google.com` |
| 输入框 | Quill (`rich-textarea .ql-editor`) |
| 发送按钮 | `.send-button.submit` |
| 特殊处理 | `model-thoughts` 噪音过滤 |

### Claude _(v2.6.0)_

| 项目 | 值 |
|:---|:---|
| URL 匹配 | `claude.ai` |
| 输入框 | Contenteditable div (`div[contenteditable="true"][data-testid="chat-input"]`) |
| 发送按钮 | `button[type="submit"]` |
| 特殊处理 | 工具栏注入在消息内容之后（非action bar之前）|

### Deepseek _(v2.7.0)_

| 项目 | 值 |
|:---|:---|
| URL 匹配 | `chat.deepseek.com` |
| 输入框 | Textarea (`.d96f2d2a`, `._27c9245`) |
| 发送按钮 | `.ds-floating-button` (via file input anchor) |
| 特殊处理 | `.ds-think-content` 噪音过滤，代码块 banner 移除 |

---

## 变更记录

| 版本 | 日期 | 变更内容 |
|:---|:---|:---|
| 2.9.0 | 2026-02-06 | ChatGPT 新增消息折叠与右侧快捷按钮，设置迁移到 ChatGPT 专属分组 |
| 2.7.0 | 2026-01-17 | 添加 Deepseek 平台支持，更新功能矩阵 |
| 2.6.0 | 2026-01-12 | 添加 Claude.ai 平台支持，工具栏注入和流式检测 |
| 2.3.0 | 2026-01-07 | 初始版本，列出已实现功能 |
