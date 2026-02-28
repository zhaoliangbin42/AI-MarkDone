# Copy (Feature Parity Matrix + Gaps) — Authoritative

目的：用一份“功能矩阵”固化 Copy 模块的能力边界与验收口径，避免多篇重复文档漂移。

范围：本文件仅覆盖 **Copy（Markdown / LaTeX）**。Reader/Bookmarks 不在此处。

基线：Legacy 旧实现（`archive/`）是功能真值；Rewrite 需要 **严格复现旧输出与行为**。

---

## Capabilities Matrix

| Capability | Legacy (archive) | Rewrite (src) | Tests (mocks) | Gap / Notes |
|---|---:|---:|---|---|
| Per-message toolbar injection (assistant message scope) | ✅ | ✅ | (TBD) | Rewrite：基于 adapter 的消息选择器注入到每条 assistant 消息下方；按钮只作用于该消息。 |
| Copy Markdown (current message) | ✅ | ✅ | ✅ | Rewrite：使用 legacy rule engine（严格对齐输出），通过 adapter hooks 做 normalize/noise/deep-research。 |
| Platform-specific DOM normalization (pre-parse) | ✅ | ✅ | ✅ | Rewrite：normalize/noise 以 adapter 为唯一承载点；parity tests 覆盖代表性样本。 |
| Structural-only noise filtering | ✅ | ✅ | ✅ | Rewrite：`adapter.isNoiseNode()` + `getArtifactPlaceholder()` 作为唯一入口。 |
| Rule-based Markdown conversion (stable whitespace/indent/newlines) | ✅ | ✅ | ✅ | Rewrite：迁移 legacy parser engine 并以 parity tests 作为回归门禁。 |
| Streaming guard (avoid copying incomplete output) | ✅ | ✅ | (TBD) | Rewrite：注入工具栏会根据 `adapter.isStreamingMessage()` 禁用按钮（pending）。 |
| Deep Research special handling | ✅ | ✅ | ✅ | Rewrite：当 adapter 提供 panel root 时优先解析（见 Gemini parity）。 |
| LaTeX click-to-copy (math elements) | ✅ | ✅ | ✅ | Rewrite：按消息容器启用 + MutationObserver 跟随 streaming 新节点 + disable 全量清理；样式仅使用 `--aimd-*` tokens（通过 page token 注入）。 |
| Clipboard write + fallback | ✅ | ✅ | ✅ | 已实现（navigator.clipboard + execCommand fallback）。 |

---

## Rewrite Acceptance (Copy)

当且仅当满足以下条件，Copy 模块才可认为“复现完成”：

- 对 `mocks/**` 中代表性样本：新旧输出 **完全一致**（逐平台、逐场景）。
- 复制按钮在 **每条 assistant 消息** 下方，点击只复制该消息的内容。
- 站点差异仅存在于 adapters（normalize/noise/deep-research/streaming），Copy pipeline 逻辑统一。
- 所有核心规则具备 unit tests，所有平台具备 integration/parity tests（mocks）。
