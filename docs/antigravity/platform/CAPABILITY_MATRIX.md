# Platform Capability Matrix

> **Purpose**: 只表达“当前支持哪些宿主平台、有哪些平台特有差异”。具体能力如何工作，请以 `docs/FEATURES.md` 为准。
>
> **Release policy**: v4.5.0 起，AI-MarkDone 的完整页面运行时聚焦 ChatGPT。Gemini、Claude、DeepSeek 保留公式复制运行时，用于单公式 LaTeX 点击复制以及用户启用的公式 PNG/SVG/MathML copy/save；旧书签数据仍可在书签库中查看、筛选、导出和备份。

---

## 1. Supported Hosts

| Platform | Status | Host patterns | Notable deltas |
|:---|:---:|:---|:---|
| ChatGPT | ✅ Active | `chatgpt.com`, `chat.openai.com` | 支持 payload/store-first Reader；可选发送后恢复阅读位置；AI-MarkDone 右侧 conversation directory rail 暂时下架，右下角 message stepper 默认保留且可关闭；保留 classic host 链接与权限一致性门禁。 |
| Gemini | ✅ Formula copy | `gemini.google.com` | 支持公式点击复制与已启用的公式 hover asset actions；扩展图标可打开全局书签管理面板。 |
| Claude | ✅ Formula copy | `claude.ai` | 支持公式点击复制与已启用的公式 hover asset actions；扩展图标可打开全局书签管理面板。 |
| DeepSeek | ✅ Formula copy | `chat.deepseek.com` | 支持公式点击复制与已启用的公式 hover asset actions；扩展图标可打开全局书签管理面板。 |

说明：

- 以上 host 列表必须与 `manifest.chrome.json`、`manifest.firefox.json`、content-script host gating、`src/popup/popup.html` 保持一致；background action gating 对所有 supported hosts 保持 active/no-popup，具体内容能力由 content runtime 决定。
- 当前仓库通过 `tests/unit/governance/supported-hosts-consistency.test.ts` 对这四处的一致性做自动化门禁。
- Settings `platforms.chatgpt` 控制 ChatGPT 完整页面 runtime；`platforms.gemini` / `platforms.claude` / `platforms.deepseek` 控制对应平台的公式复制 runtime。
- Bookmarks platform filter 仍允许旧数据按原平台字符串筛选。

---

## 2. Capability Scope By Platform

- 下列共享能力以 ChatGPT 页面上的行为一致为目标，能力定义与验收口径统一写在 `docs/FEATURES.md`：
  - Message toolbar / Reader / Markdown copy / Word count
  - Bookmarks panel / Settings tab / Sponsor tab
  - Send modal / Reader send / Export actions
- 当前明确的**平台专属**运行能力是：
  - ChatGPT Payload Engine（仅 ChatGPT hosts）
  - ChatGPT send position restore（仅 ChatGPT hosts，默认开启）
  - 可关闭的 ChatGPT message stepper 与可选左右方向键消息导航（仅 ChatGPT conversation 页面）
- 当前明确的**公式复制**平台方向：
  - Gemini、Claude、DeepSeek formula runtime：复用 `FormulaAssetHoverController` / `MathClickHandler` / 单公式 asset renderer，并恢复旧 `MarkdownParserAdapter` 的公式识别、LaTeX 提取和块级判定子链路；extension action 仍发送 toggle 消息，用于打开全局书签管理面板
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
| 设置分组 | 使用平台总开关 `platforms.chatgpt` 控制 ChatGPT runtime；`platforms.gemini` / `platforms.claude` / `platforms.deepseek` 控制对应平台公式复制 runtime；`chatgptBehavior.restorePositionAfterSend` 控制发送后恢复阅读位置；`chatgptBehavior.showMessageStepper` 控制右下角上一条/下一条按钮显示；`chatgptBehavior.enableArrowKeyMessageNavigation` 控制左右方向键消息导航；`chatgptDirectory` 仅保留兼容字段且 `enabled=false` |
