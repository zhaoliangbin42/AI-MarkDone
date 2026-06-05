# Platform Capability Matrix

> **Purpose**: 只表达“当前支持哪些宿主平台、有哪些平台特有差异”。具体能力如何工作，请以 `docs/FEATURES.md` 为准。
>
> **Release policy**: v4.5.0 起，AI-MarkDone 只支持 ChatGPT 页面运行时。Gemini、Claude、DeepSeek 页面适配已下线；旧书签数据仍可在书签库中查看、筛选、导出和备份。

---

## 1. Supported Hosts

| Platform | Status | Host patterns | Notable deltas |
|:---|:---:|:---|:---|
| ChatGPT | ✅ Active | `chatgpt.com`, `chat.openai.com` | 支持 payload/store-first Reader；可选发送后恢复阅读位置；AI-MarkDone 右侧 conversation directory rail 暂时下架，右下角 message stepper 默认保留且可关闭；保留 classic host 链接与权限一致性门禁。 |

说明：

- 以上 host 列表必须与 `manifest.chrome.json`、`manifest.firefox.json`、background host gating、`src/popup/popup.html` 保持一致。
- 当前仓库通过 `tests/unit/governance/supported-hosts-consistency.test.ts` 对这四处的一致性做自动化门禁。
- Gemini、Claude、DeepSeek 已下线的是页面运行时支持，不是用户历史书签数据。Bookmarks platform filter 仍允许旧数据按原平台字符串筛选。

---

## 2. Capability Scope By Platform

- 下列共享能力以 ChatGPT 页面上的行为一致为目标，能力定义与验收口径统一写在 `docs/FEATURES.md`：
  - Message toolbar / Reader / Markdown copy / Word count
  - Bookmarks panel / Settings tab / Sponsor tab
  - Send modal / Reader send / Export actions
- 当前唯一明确的**平台专属**运行能力是：
  - ChatGPT Payload Engine（仅 ChatGPT hosts）
  - ChatGPT send position restore（仅 ChatGPT hosts，默认开启）
  - 可关闭的 ChatGPT message stepper 与可选左右方向键消息导航（仅 ChatGPT conversation 页面）
- 当前明确**不继续推进**的平台方向：
  - Gemini、Claude、DeepSeek 页面运行时适配
  - Gemini Deep Research（不纳入产品支持范围）

---

## 3. Platform-Specific Configuration

### ChatGPT

| 项目 | 值 |
|:---|:---|
| URL 匹配 | `chatgpt.com`, `chat.openai.com` |
| 输入框 | ProseMirror (`#prompt-textarea`) |
| 发送按钮 | `.composer-submit-button-color` |
| 特殊处理 | payload/store-first Reader；可选发送后恢复阅读位置；右侧 conversation directory rail 暂时下架；右下角 message stepper 默认保留且可关闭 |
| 设置分组 | 使用平台总开关 `platforms.chatgpt` 控制 ChatGPT runtime；`chatgptBehavior.restorePositionAfterSend` 控制发送后恢复阅读位置；`chatgptBehavior.showMessageStepper` 控制右下角上一条/下一条按钮显示；`chatgptBehavior.enableArrowKeyMessageNavigation` 控制左右方向键消息导航；`chatgptDirectory` 仅保留兼容字段且 `enabled=false` |
