# AI-MarkDone — Frozen Features & Acceptance (Authoritative)

目的：用 **一个** 权威文档固化“已冻结的功能能力 / 冻结决策 / 验收口径 / 测试映射”，避免多份功能文档漂移。

范围：本文件以 **ChatGPT-only 验证** 为当前重构阶段的唯一目标平台；其它平台适配不作为本阶段验收条件。

术语：

- **Driver**：站点适配 + DOM 采集/注入 + browser APIs（不得依赖 UI/Service）
- **Service**：用例编排与纯逻辑（不得依赖 UI；避免直接触碰 browser APIs）
- **UI**：Shadow DOM 组件渲染与交互（不得直写存储；不得包含平台差异选择器）

---

## A) Frozen Decisions（冻结决策）

这些决策在本阶段视为冻结点，改动必须更新本文件并补齐回归证据。

| Topic | Decision | Rationale |
|---|---|---|
| Validation platform | ChatGPT only | 降低变量，优先把架构与注入稳定性做实。 |
| UI entrypoints | **No global toolbar** (remove `RewriteToolbar`) | 减少注入点与 UI 干扰；聚焦“每条消息工具栏 + ReaderPanel”。 |
| Per-message toolbar placement | Prefer the official action bar row (same line); fallback after message content, aligned right | 避免把官方工具栏挤到下方；同时保留无 action bar 场景的稳定可见兜底。 |
| Injection algorithm | MO as signal + debounced scan + idempotent retry + route rebind | SPA/React 更稳定；允许短暂失败但最终一致。 |
| LaTeX click-to-copy | Enabled by default (no UI toggle) | 功能性优先；后续再引入可审计的开关。 |

---

## B) Capability Matrix（能力矩阵：Copy + Reader）

### B.1 Copy（Markdown + LaTeX click-to-copy）

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Copy Markdown for **current message** | MessageToolbar `Copy Markdown` → `copyMarkdownFromMessage(adapter, messageEl)` → clipboard | `src/services/copy/copy-markdown.ts`, `src/drivers/content/clipboard/clipboard.ts`, `src/ui/content/MessageToolbar.ts` | `tests/parity/copy/*`, `tests/integration/copy/*` | 点击某条消息的 Copy，只复制该消息内容（非整页/非最后一条）。 |
| Copy Markdown for **last message** (dev helper) | `copyMarkdownFromPage(adapter)` | `src/services/copy/copy-markdown.ts` | `tests/integration/copy/copy-markdown.chatgpt.test.ts` | 仅用于开发/调试；非 UI 验收入口。 |
| Rule-based conversion stability (whitespace/indent/newlines) | Copy pipeline | `src/services/markdown-parser/**` | `tests/parity/copy/*` + goldens | golden 对齐作为输出真值。 |
| Platform noise filtering (structural only) | `adapter.isNoiseNode()` + placeholder | `src/drivers/content/adapters/*`, `src/services/copy/copy-markdown.ts` | parity fixtures | 噪声过滤不基于文本，避免 i18n 漂移。 |
| Streaming guard (pending state) | `adapter.isStreamingMessage()` → disable actions | `src/ui/content/controllers/MessageToolbarOrchestrator.ts` | (covered by manual) | 流式阶段禁用按钮，不影响注入与后续重试。 |
| LaTeX click-to-copy | Enable on injected message containers | `src/drivers/content/math/math-click.ts` | `tests/unit/drivers/math-click.test.ts` | 默认开启，在不破坏页面交互的前提下复制 LaTeX。 |

#### Copy goldens（回归策略）

- Goldens：`tests/fixtures/expected/copy/<platform>/<fixture>.md`
- Parity tests：从 `mocks/**` 读取 fixture，跑 rewrite pipeline，对比 golden
- Golden 更新脚本：`scripts/update-copy-goldens.ts`（用于“有意识更新 baseline”，不进入默认 test 流）

#### LaTeX click safety guard（必须落实，避免破坏宿主页面）

当 LaTeX click 默认常开时，必须满足：

- selection 非空（用户正在选择文本）时 **不触发复制**，不拦截事件链。
- 仅在确认要复制时才 `preventDefault/stopPropagation`（尽量不干扰宿主交互）。

---

### B.2 Reader（MVP）

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Open ReaderPanel from a message toolbar | MessageToolbar `Reader` → collect items → `ReaderPanel.show(items, startIndex, theme)` | `src/ui/content/reader/ReaderPanel.ts`, `src/services/reader/collectReaderItems.ts` | `tests/integration/reader/reader-panel.test.ts` | 点击任意消息 Reader 能稳定打开。 |
| Pagination (Prev/Next + index/total) | ReaderPanel internal state | `src/ui/content/reader/ReaderPanel.ts` | integration test | 可翻页且 index/total 正确。 |
| Render Markdown + sanitize | `renderMarkdown(markdown)` | `src/services/renderer/renderMarkdown.ts` | `tests/unit/services/renderer/renderMarkdown.test.ts` | XSS 清洗门禁必须存在。 |
| Copy current page markdown | ReaderPanel `Copy` | `src/ui/content/reader/ReaderPanel.ts`, `src/drivers/content/clipboard/clipboard.ts` | integration test | Reader 页内容与 Copy pipeline 对齐（同一条消息输出一致）。 |
| View Source | ReaderPanel toggle | `src/ui/content/reader/ReaderPanel.ts` | integration test | 可查看源文本、可复制。 |

---

### B.3 Bookmarks Core（Storage + Folders + Import/Export + Repair; no UI）

说明：本阶段只交付 **Bookmarks Core**（通用逻辑 + background write authority），不交付面板 UI。目标是保证：

- legacy 数据 **完全兼容**（key/schema/导入导出格式）
- 写入路径 **可审计**（background 统一落盘）
- 大数据下性能稳定（index）
- 中断可恢复（journal）
- repair 沿用旧行为，但删除前写入 quarantine（避免数据真正丢失）

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| List bookmarks | `runtime.sendMessage({type:'bookmarks:list'})` | `src/runtimes/background/handlers/bookmarks.ts`, `src/services/bookmarks/bookmarksService.ts` | `tests/unit/runtimes/background/bookmarks-handler.test.ts` | 可列出所有书签（排序/筛选参数可用）。 |
| Save bookmark | `bookmarks:save` | `src/services/bookmarks/bookmarksService.ts`, `src/drivers/background/storage/*` | `tests/unit/runtimes/background/bookmarks-handler.test.ts` | 写入 key schema 与 legacy 一致（`bookmark:${urlWithoutProtocol}:${position}`）。 |
| Remove bookmark | `bookmarks:remove` | 同上 | unit tests | 删除后 index 同步更新。 |
| Export | `bookmarks:export` | `src/core/bookmarks/importExport.ts` | `tests/unit/core/bookmarks/importExport.test.ts` | 输出 v2.0 wrapper（支持 flat export）。 |
| Import | `bookmarks:import`（JSON text） | `src/core/bookmarks/merge.ts`, `src/services/bookmarks/bookmarksService.ts` | unit tests | 支持 array/v2 两格式；去重（url+position）；同 folder title 冲突自动 rename。 |
| Folder create/delete/list | `bookmarks:folders:*` | `src/services/bookmarks/bookmarksService.ts` | unit tests | `folderPaths` 与 `folder:*` 记录一致。 |
| Folder rename/move (relocate) | `bookmarks:folders:rename/move` | `src/runtimes/background/handlers/bookmarks.ts` | (covered by unit tests) | 递归更新子 folder 与 bookmarks.folderPath。 |
| Repair + Quarantine | `bookmarks:repair` | `src/core/bookmarks/repair.ts`, `src/drivers/background/storage/quarantineStore.ts` | `tests/unit/core/bookmarks/repair.test.ts` | 修复缺字段；不可修复项删除前写入 quarantine。 |
| Journal recovery | background startup `recoverJournalIfAny()` | `src/runtimes/background/entry.ts` | (covered by unit tests) | MV3 中断后可重放 relocate，最终一致。 |

---

## C) Non-goals（明确不做）

以下内容不作为本阶段验收目标：

- Bookmarks Panel UI（搜索/筛选/排序/批量操作）
- Message sending（输入框同步/发送按钮模拟/完成检测）
- i18n
- 字数统计（CJK 感知）
- 多平台适配与一致性（仅 ChatGPT）

---

## D) Gates（门禁与验收）

### D.1 工程门禁（每次变更必过）

- `npm run type-check`
- `npm run test:core`
- `npm run build`（Chrome MV3 + Firefox MV2）

### D.2 手工验收清单（ChatGPT-only）

- 刷新 / 切换对话 / 连续生成：每条 assistant 消息最终出现工具栏（不重复、不漂移）
- Copy Markdown：复制当前消息内容
- Reader：打开/翻页/复制/View Source，关闭无残留
- LaTeX click：可用且不影响用户选择/复制公式文本（selection guard 生效）
