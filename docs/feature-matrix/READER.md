# Reader (Feature Matrix) — Authoritative

目的：用一份“功能矩阵”固化 Reader 模块的能力边界、接口与验收口径，避免多篇重复文档漂移。

范围：本文件仅覆盖 **Reader MVP**（打开/分页/渲染/复制/View Source）。Message sending / Bookmarks 联动不在此处。

原则：

- Reader 复用 Copy pipeline 的 markdown 作为唯一内容真值（避免出现两套解析/净化逻辑）。
- UI 仅渲染与交互；DOM 采集与站点差异仅存在于 adapters/driver；无存储写入（MV3 审计边界清晰）。

---

## Capabilities Matrix

| Capability | Rewrite (src) | Entry / API | Tests | Notes |
|---|---:|---|---|---|
| Open ReaderPanel from a message toolbar | ✅ | `MessageToolbar` → `MessageToolbarController` | `tests/integration/reader/reader-panel.test.ts` | 入口在每条 assistant 消息下方工具栏。 |
| Close ReaderPanel (no residue) | ✅ | `ReaderPanel.hide()` | `tests/integration/reader/reader-panel.test.ts` | 关闭应移除 overlay/事件监听（通过面板生命周期约束）。 |
| Collect assistant messages into pages | ✅ | `collectReaderItems(adapter, startMessageElement)` | `tests/unit/services/reader/collectReaderItems.test.ts` | 仅收集 assistant 消息；去重规则与注入消息发现一致（祖先去重）。 |
| Per-page title/tooltip from user prompt | ✅ | `adapter.extractUserPrompt()` | `tests/unit/services/reader/collectReaderItems.test.ts` | 结构性提取；失败 fallback 为 `Message N`。 |
| Pagination (Prev/Next + index/total) | ✅ | `ReaderPanel` internal state | `tests/integration/reader/reader-panel.test.ts` | 按键与 UI 状态必须与 streaming guard 兼容。 |
| Render Markdown + sanitize | ✅ | `renderMarkdown(markdown)` | `tests/unit/services/renderer/renderMarkdown.test.ts` | 使用 `DOMPurify` 做 XSS 清洗；KaTeX 扩展可用。 |
| Copy current page markdown | ✅ | `ReaderPanel` → `copyToClipboard()` | `tests/integration/reader/reader-panel.test.ts` | clipboard driver 负责 fallback；UI 不直接调用站点 DOM。 |
| View Source (toggle) | ✅ | `ReaderPanel` internal toggle | `tests/integration/reader/reader-panel.test.ts` | MVP：source 展示为纯文本区域（可复制）。 |
| Theme sync (light/dark) | ✅ | `content/entry.ts` theme subscription → `ReaderPanel.setTheme()` | (TBD) | 与 toolbar 同源 theme state；样式只用 `--aimd-*` tokens。 |

---

## Layering & Boundaries

| Layer | Responsibilities | Must NOT do | Key files |
|---|---|---|---|
| Driver (content) | 注入稳定性（scan scheduler/route watcher）、站点差异（selectors/streaming/prompt 提取） | 不实现 Reader 的业务编排；不渲染 Reader UI | `src/drivers/content/injection/*`, `src/drivers/content/adapters/*`, `src/drivers/content/toolbars/message-toolbar-controller.ts` |
| Service | 收集分页 items、渲染/净化、复用 Copy pipeline 作为内容真值 | 不直接触碰 DOM 注入；不依赖 `browser.*` 副作用 | `src/services/reader/*`, `src/services/renderer/*`, `src/services/copy/copy-markdown.ts` |
| UI (content) | ReaderPanel 展示/交互（open/close/pagination/copy/source toggle） | 不直接读写存储；不包含平台差异选择器 | `src/ui/content/reader/ReaderPanel.ts`, `src/ui/content/MessageToolbar.ts` |

---

## Acceptance (Reader MVP)

当且仅当满足以下条件，Reader MVP 才可认为“闭环完成”：

- 任意支持平台：点击某条消息的 Reader 按钮 → ReaderPanel 稳定打开；可翻页；可复制；可查看源；关闭无残留。
- Reader 内容与 Copy 内容严格一致（同一条消息：Copy Markdown == Reader 当前页 markdown）。
- 渲染链路具备 XSS 清洗门禁（单测覆盖）。

