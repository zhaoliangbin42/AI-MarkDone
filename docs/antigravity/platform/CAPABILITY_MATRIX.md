# Platform Capability Matrix

> **Purpose**: 只表达“当前支持哪些宿主平台、有哪些平台特有差异”。具体能力如何工作，请以 `docs/FEATURES.md` 为准。

---

## 1. Supported Hosts

| Platform | Status | Host patterns | Notable deltas |
|:---|:---:|:---|:---|
| ChatGPT | ✅ Active | `chatgpt.com`, `chat.openai.com` | 支持 payload/store-first Reader 与右侧 conversation directory rail；保留 classic host 链接与权限一致性门禁。 |
| Gemini | ✅ Active | `gemini.google.com` | 支持 Gemini-specific DOM 结构与 thought/noise 过滤。 |
| Claude | ✅ Active | `claude.ai` | 支持 Claude action-row 缺席时的稳定注入与发送桥接。 |
| DeepSeek | ✅ Active | `chat.deepseek.com` | 支持 DeepSeek DOM 结构、噪音过滤与消息入口。 |

说明：

- 以上 host 列表必须与 `manifest.chrome.json`、`manifest.firefox.json`、background host gating、`src/popup/popup.html` 保持一致。
- 当前仓库通过 `tests/unit/governance/supported-hosts-consistency.test.ts` 对这四处的一致性做自动化门禁。

---

## 2. Capability Scope By Platform

- 下列共享能力以“支持的平台页面上行为一致”为目标，能力定义与验收口径统一写在 `docs/FEATURES.md`：
  - Message toolbar / Reader / Markdown copy / Word count
  - Bookmarks panel / Settings tab / Sponsor tab
  - Send modal / Reader send / Export actions
- 当前唯一明确的**平台专属**能力是：
  - ChatGPT Conversation Directory / Payload Engine（仅 ChatGPT hosts）
- 当前明确**不继续推进**的平台方向：
  - Gemini Deep Research（不纳入产品支持范围）

---

## 3. Platform-Specific Configuration

### ChatGPT

| 项目 | 值 |
|:---|:---|
| URL 匹配 | `chatgpt.com`, `chat.openai.com` |
| 输入框 | ProseMirror (`#prompt-textarea`) |
| 发送按钮 | `.composer-submit-button-color` |
| 特殊处理 | payload/store-first Reader；右侧 conversation directory rail |
| 设置分组 | 使用平台总开关 `platforms.chatgpt`；无 ChatGPT 专属折叠/目录设置 |

### Gemini

| 项目 | 值 |
|:---|:---|
| URL 匹配 | `gemini.google.com` |
| 输入框 | Quill (`rich-textarea .ql-editor`) |
| 发送按钮 | `.send-button.submit` |
| 特殊处理 | `model-thoughts` 噪音过滤 |

### Claude

| 项目 | 值 |
|:---|:---|
| URL 匹配 | `claude.ai` |
| 输入框 | Contenteditable div (`div[contenteditable="true"][data-testid="chat-input"]`) |
| 发送按钮 | `button[type="submit"]` |
| 特殊处理 | 工具栏注入在消息内容之后（非action bar之前）|

### DeepSeek

| 项目 | 值 |
|:---|:---|
| URL 匹配 | `chat.deepseek.com` |
| 输入框 | Textarea (`.d96f2d2a`, `._27c9245`) |
| 发送按钮 | `.ds-floating-button` (via file input anchor) |
| 特殊处理 | `.ds-think-content` 噪音过滤，代码块 banner 移除 |
