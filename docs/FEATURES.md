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
| Action icon click | Background sends `ui:toggle_toolbar` → Content toggles **BookmarksPanel** | 先用扩展图标作为稳定入口（无需额外注入点）；后续再评估页面内入口模块化实现。 |
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
| Open ReaderPanel from a message toolbar | MessageToolbar `Reader` → collect items → `ReaderPanel.show(items, startIndex, theme, options?)` | `src/ui/content/reader/ReaderPanel.ts`, `src/services/reader/collectReaderItems.ts` | `tests/integration/reader/reader-panel.test.ts` | 点击任意消息 Reader 能稳定打开。 |
| Pagination (Prev/Next + index/total) | ReaderPanel internal state | `src/ui/content/reader/ReaderPanel.ts` | integration test | 可翻页且 index/total 正确。 |
| Render Markdown + sanitize | `renderMarkdown(markdown)` | `src/services/renderer/renderMarkdown.ts` | `tests/unit/services/renderer/renderMarkdown.test.ts` | XSS 清洗门禁必须存在。 |
| Copy current page markdown | ReaderPanel `Copy` | `src/ui/content/reader/ReaderPanel.ts`, `src/drivers/content/clipboard/clipboard.ts` | integration test | Reader 页内容与 Copy pipeline 对齐（同一条消息输出一致）。 |
| View Source | ReaderPanel toggle | `src/ui/content/reader/ReaderPanel.ts` | integration test | 可查看源文本、可复制。 |
| Configurable actions (per module reuse) | `ReaderPanel.show(..., { showNav/showCopy/showSource, actions[] })` | `src/ui/content/reader/ReaderPanel.ts` | unit/integration (covered by TypeScript + existing reader test) | 同一 ReaderPanel 可被不同模块复用（如 Bookmarks 预览注入 GoTo），避免重复维护“预览框”。 |
| Message sending (composer sync + send) | ReaderPanel `Send` → `sendText(adapter, text)` | `src/ui/content/reader/ReaderPanel.ts`, `src/services/sending/sendService.ts`, `src/drivers/content/sending/composerPort.ts`, `src/drivers/content/adapters/sites/chatgpt.ts`, `src/core/sending/contenteditable.ts` | `tests/unit/core/sending/*`, `tests/unit/drivers/content/sending/*`, `tests/integration/sending/*` | 多行文本换行保持一致；不会触发语音按钮；等待 send ready 后再点击发送。 |

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

### B.4 Bookmarks Panel（Content UI; ChatGPT-only validation）

说明：BookmarksPanel 的职责是 **展示 + 交互 + intent 触发**，所有写入仍由 background handler 执行（MV3 可审计/可恢复边界不变）。

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Toggle panel via extension icon | Background action click → `ui:toggle_toolbar` → Content toggles panel | `src/runtimes/background/entry.ts`, `src/runtimes/content/entry.ts`, `src/ui/content/bookmarks/BookmarksPanel.ts` | manual | 在 ChatGPT 页面点击扩展图标可打开/关闭面板。 |
| List/search/sort/filter bookmarks | Panel controls → view model | `src/ui/content/bookmarks/BookmarksPanel.ts`, `src/ui/content/bookmarks/BookmarksPanelController.ts`, `src/services/bookmarks/panelModel.ts` | `tests/unit/services/bookmarks/panelModel.test.ts` | 面板内可搜索、排序，列表可读且不污染宿主样式。 |
| Folder tree + CRUD | Panel buttons → `bookmarks:folders:*` | `src/ui/content/bookmarks/BookmarksPanel.ts`, `src/ui/content/bookmarks/BookmarksPanelController.ts` | manual | 文件夹可创建/重命名/移动/删除（删除需要空文件夹约束）。 |
| Preview (reuse ReaderPanel) | Click bookmark row → `ReaderPanel.show(items, startIndex, theme, options)` | `src/ui/content/bookmarks/ui/tabs/BookmarksTabView.ts`, `src/ui/content/reader/ReaderPanel.ts` | manual | 分页范围沿用 legacy：有搜索词→按树顺序翻“全部可见书签”；无搜索词→仅在该 folder 内翻页。 |
| Row actions: Go / Copy / Delete | Panel row buttons → background intents | `src/ui/content/bookmarks/BookmarksPanelController.ts`, `src/drivers/content/bookmarks/navigation.ts` | manual | Go 能定位当前页 position（最佳努力重试）；Copy/删除可用。 |
| Batch ops (delete/move/export) | Selection → bulk handlers | `src/contracts/protocol.ts`, `src/runtimes/background/handlers/bookmarks.ts`, `src/ui/content/bookmarks/BookmarksPanel.ts` | `tests/unit/runtimes/background/bookmarks-handler.test.ts` | 批量删除/移动/导出一次落盘（非循环 sendMessage）。 |
| Import/Export/Repair | Panel buttons → handler | `src/ui/content/bookmarks/BookmarksPanel.ts`, `src/runtimes/background/handlers/bookmarks.ts` | `tests/unit/core/bookmarks/stress.test.ts` | 导入 3000 级别 fixture 仍可用；repair 会 quarantine 再移除。 |
| Toolbar quick toggle (per message) | MessageToolbar `Bookmark` → `bookmarks:positions/save/remove` | `src/ui/content/controllers/MessageToolbarOrchestrator.ts`, `src/ui/content/MessageToolbar.ts` | manual | 每条消息可一键保存/取消，并反映已保存状态（Bookmarked）。 |

---

### B.5 Settings Core（storage.sync; legacy key `app_settings`; no UI）

说明：本阶段只交付 **Settings Core**（通用逻辑 + background write authority + sync 存储），用于后续功能开关与行为配置。暂不交付 Settings UI。

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Read all settings (normalized) | `settings:getAll` | `src/core/settings/*`, `src/services/settings/settingsService.ts`, `src/runtimes/background/handlers/settings.ts` | `tests/unit/core/settings/migrations.test.ts`, `tests/unit/runtimes/background/settings-handler.test.ts` | 老用户升级后 `app_settings` 不丢；新字段 merge defaults。 |
| Set settings category | `settings:setCategory` | `src/services/settings/settingsService.ts`, `src/drivers/background/storage/syncStoragePort.ts` | unit tests | Service 只做 plan；background 统一落盘。 |
| Reset to defaults | `settings:reset` | 同上 | unit tests | reset 后可再次读取并得到 defaults。 |
| Content-side cache + subscribe | `SettingsClient.subscribe()` | `src/drivers/content/settings/settingsClient.ts` | (covered by unit tests + TypeScript) | storage.onChanged 触发后可 best-effort 刷新缓存。 |

---

### B.6 Save Messages Export Core（Markdown + PDF; no UI entry yet）

说明：本阶段交付 **导出核心能力**（采集/构建/副作用 drivers + 门禁测试）。为便于端到端回归，目前已提供一个“低耦合的 UI 入口”：

- MessageToolbar 打开 ReaderPanel 后，在 ReaderPanel footer 的 custom actions 中提供 `Export MD / Export PDF`（导出当前页对应消息）。

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Export Markdown (download) | `exportConversationMarkdown(adapter, selectedIndices, {t})` | `src/services/export/saveMessagesFacade.ts`, `src/services/export/saveMessagesMarkdown.ts`, `src/drivers/content/export/downloadFile.ts` | `tests/unit/services/export/saveMessagesMarkdown.test.ts`, `tests/unit/services/export/saveMessagesFacade.test.ts`, `tests/unit/drivers/content/export/downloadFile.test.ts` | selection 为空不触发下载；文件名 sanitize；标题 heading 归一化；内容编号按 1..n 连续。 |
| Export PDF (print) | `exportConversationPdf(adapter, selectedIndices, {t})` | `src/services/export/saveMessagesPdf.ts`, `src/drivers/content/export/printPdf.ts` | `tests/unit/drivers/content/export/printPdf.test.ts`, `tests/unit/services/export/saveMessagesPdf.sanitization.test.ts` | print container 创建后能 afterprint/timeout cleanup；metadata/userPrompt escape；assistant HTML 走 sanitize 路径。 |
| DOM collection (assistant turns) | `collectConversationMessageRefs(adapter)` | `src/drivers/content/conversation/collectConversationMessageRefs.ts` | `tests/unit/drivers/content/conversation/collectConversationMessageRefs.test.ts` | 仅采集 assistant message roots；去除嵌套重复；能提取 userPrompt。 |

---

### B.7 Word Count Core（CJK aware; exclude code/math; no UI）

说明：本阶段只交付 **字数统计 Core**（纯逻辑）。为便于端到端回归，目前已提供一个“低耦合的 UI 入口”：

- MessageToolbar 打开 ReaderPanel 后，在 ReaderPanel footer 的 custom actions 中提供 `Word Count`（统计当前页对应 markdown 的 words/chars）。

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Count words/chars (CJK + Latin) | `new WordCounter().count(markdown)` | `src/core/text/wordCounter.ts` | `tests/unit/core/text/wordCounter.test.ts` | CJK=1 char→1 word + 2 chars；排除 fenced code 与 `$...$`/`$$...$$` math。 |
| Format result | `WordCounter.format(result)` | 同上 | unit tests | code-only 内容返回 `0 Words / 0 Chars`（避免 UI loading 卡住）。 |

---

## C) Non-goals（明确不做）

以下内容不作为本阶段验收目标：

- i18n（语言选择/迁移/无 raw key）
- Settings UI（当前仅 Core）
- Save Messages UI entry（当前仅 Core）
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
