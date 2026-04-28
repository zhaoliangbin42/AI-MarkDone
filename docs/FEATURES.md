# AI-MarkDone — Product Capabilities & Acceptance (Authoritative)

目的：用 **一个** 权威文档固化当前产品能力、验收口径与测试映射，避免多份功能文档漂移。

范围：本文件定义“能力在支持的平台上应如何工作”。各平台支持状态与支持级别，以 `docs/antigravity/platform/CAPABILITY_MATRIX.md` 为准。

术语：

- **Driver**：站点适配 + DOM 采集/注入 + browser APIs（不得依赖 UI/Service）
- **Service**：分为 pure/domain service 与 content-facing feature service（都不得依赖 UI；前者避免直接触碰 DOM/browser APIs，后者允许处理 DOM clone / parser node / content fragment）
- **UI**：Shadow DOM 组件渲染与交互（不得直写存储；不得包含平台差异选择器）

---

## A) Product Decisions（产品决策）

这些决策属于当前稳定产品行为。改动必须更新本文件并补齐回归证据。

| Topic | Decision | Rationale |
|---|---|---|
| Platform support policy | Capability behavior is defined here, support level lives in `CAPABILITY_MATRIX.md` | 把“产品能力”与“平台支持状态”分开治理，减少文档职责混叠。 |
| UI entrypoints | **No global toolbar** (remove `RewriteToolbar`) | 减少注入点与 UI 干扰；聚焦“每条消息工具栏 + ReaderPanel”。 |
| Action icon click | Background sends `ui:toggle_toolbar` → Content toggles **BookmarksPanel** | 先用扩展图标作为稳定入口（无需额外注入点）；后续再评估页面内入口模块化实现。 |
| Per-message toolbar placement | Prefer the official action bar row (same line); fallback after message content, aligned right | 避免把官方工具栏挤到下方；同时保留无 action bar 场景的稳定可见兜底。 |
| Injection algorithm | MO as signal + debounced scan + idempotent retry + route rebind | SPA/React 更稳定；允许短暂失败但最终一致。 |
| LaTeX click-to-copy | Enabled by default (no UI toggle) | 功能性优先；后续再引入可审计的开关。 |
| ChatGPT conversation directory | Treated as a ChatGPT-only navigation layer backed by the internal conversation payload | 目录条负责完整历史导航；官方线程继续承担正文显示与输入交互；跳转后的轻量校准只能修正 host hydration 导致的位置漂移，且必须让位于用户主动滚动、触摸、指针或键盘导航。 |

---

## B) Capability Matrix（能力矩阵：Copy + Reader）

### B.1 Copy（Markdown + LaTeX click-to-copy）

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Copy Markdown for **current message** | MessageToolbar `Copy Markdown` → `readerContentSource` current `ReaderItem` → clipboard | `src/services/reader/readerContentSource.ts`, `src/drivers/content/clipboard/clipboard.ts`, `src/ui/content/MessageToolbar.ts` | `tests/unit/services/reader/readerContentSource.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.copy-png.test.ts`, `tests/parity/copy/*` | 点击某条消息的 Copy，只复制与 Reader 相同来源的当前消息 Markdown（非整页/非最后一条）。 |
| Copy PNG for **current message** | MessageToolbar `Copy Markdown` hover action → PNG plan/render reuse → image clipboard | `src/services/copy/copy-turn-png.ts`, `src/drivers/content/clipboard/copyImageToClipboard.ts`, `src/drivers/content/export/renderPng.ts`, `src/ui/content/MessageToolbar.ts` | `tests/unit/services/copy/copy-turn-png.test.ts`, `tests/unit/drivers/content/clipboard/copyImageToClipboard.test.ts`, `tests/unit/ui/content/MessageToolbar.test.ts` | hover 次动作只复制当前消息/turn 的单张 PNG；复用现有 PNG 渲染链路；不改变原有 Markdown Copy 主按钮语义。 |
| Copy Markdown for **last message** (dev helper) | `copyMarkdownFromPage(adapter)` | `src/services/copy/copy-markdown.ts` | `tests/integration/copy/copy-markdown.chatgpt.test.ts` | 仅用于开发/调试；非 UI 验收入口。 |
| Rule-based conversion stability (whitespace/indent/newlines) | Copy pipeline | `src/services/markdown-parser/**` | `tests/parity/copy/*` + goldens | golden 对齐作为输出真值。 |
| Platform noise filtering (structural only) | `adapter.isNoiseNode()` + placeholder | `src/drivers/content/adapters/*`, `src/services/copy/copy-markdown.ts` | parity fixtures | 噪声过滤不基于文本，避免 i18n 漂移。 |
| Streaming guard (pending state) | `adapter.isStreamingMessage()` → disable actions | `src/ui/content/controllers/MessageToolbarOrchestrator.ts` | (covered by manual) | 流式阶段禁用按钮，不影响注入与后续重试。 |
| LaTeX click-to-copy | Enable on injected message containers | `src/drivers/content/math/math-click.ts` | `tests/unit/drivers/math-click.test.ts` | 默认开启，在不破坏页面交互的前提下复制 LaTeX。适合只想快速拿走单个公式，不必先复制整段内容再二次提取。 |

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
| Open ReaderPanel from a message toolbar | MessageToolbar `Reader` → collect items → `ReaderPanel.show(items, startIndex, theme, { profile, actions? })` | `src/ui/content/reader/ReaderPanel.ts`, `src/services/reader/collectReaderItems.ts` | `tests/integration/reader/reader-panel.test.ts` | 点击任意消息 Reader 能稳定打开。 |
| Pagination (Prev/Next + index/total) | ReaderPanel internal state | `src/ui/content/reader/ReaderPanel.ts` | integration test | 可翻页且 index/total 正确。 |
| Render Markdown + sanitize | `renderMarkdown(markdown)` | `src/services/renderer/renderMarkdown.ts` | `tests/unit/services/renderer/renderMarkdown.test.ts` | XSS 清洗门禁必须存在。 |
| Tokenized Markdown rendering | Reader uses the shared markdown theme and sanitize pipeline | `src/ui/content/reader/ReaderPanel.ts`, `src/ui/content/reader/readerPanelTemplate.ts`, `src/services/renderer/renderMarkdown.ts` | unit + governance + acceptance | Reader 正文始终使用默认 tokenized Markdown 主题；主题只影响正文视觉，不改变 Reader shell chrome。 |
| Reader content width preference | Settings `Advanced Settings` → Reader content width | `src/core/settings/types.ts`, `src/ui/content/bookmarks/ui/tabs/SettingsTabView.ts`, `src/ui/content/reader/ReaderPanel.ts` | `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts`, `tests/unit/ui/reader/readerPanel.presentation.test.ts` | Reader 正文最大宽度默认保持 1000px，可在高级设置中调整；正文宽度必须继续 clamp 到面板宽度内，不改变 Reader shell 宽度、fullscreen 或 Markdown 渲染链路。 |
| Copy current page markdown | ReaderPanel `Copy` | `src/ui/content/reader/ReaderPanel.ts`, `src/drivers/content/clipboard/clipboard.ts` | integration test | Reader 页内容与 Copy pipeline 对齐（同一条消息输出一致）。 |
| Surface-owned reader profiles | `ReaderPanel.show(..., { profile, actions[] })` | `src/ui/content/reader/ReaderPanel.ts` | unit/integration + governance | 同一 ReaderPanel 在多个入口下保持稳定 baseline chrome；入口差异通过命名 profile 和批准的 action rail 表达，不允许入口直接传 CSS 或低层 chrome flags。 |
| Message sending (composer sync + send) | ReaderPanel `Send` → `sendText(adapter, text)` | `src/ui/content/reader/ReaderPanel.ts`, `src/services/sending/sendService.ts`, `src/drivers/content/sending/composerPort.ts`, `src/drivers/content/adapters/sites/chatgpt.ts`, `src/core/sending/contenteditable.ts` | `tests/unit/core/sending/*`, `tests/unit/drivers/content/sending/*`, `tests/integration/sending/*` | 多行文本换行保持一致；不会触发语音按钮；等待 send ready 后再点击发送。 |
| Atomic closed-unit source selection | Native text selection + Reader-only atomic unit highlighting + `Ctrl/Cmd+C` | `src/ui/content/reader/ReaderPanel.ts`, `src/services/reader/atomicSelection.ts`, `src/services/reader/atomicExport.ts` | `tests/unit/services/reader/atomicSelection.test.ts`, `tests/unit/services/reader/atomicExport.test.ts`, `tests/integration/reader/reader-panel.test.ts` | 只允许 assistant markdown 正文选区触发 Reader selection actions；inline math / display math / inline code / code block / table / image 会整单元高亮并按源码复制，不改变普通文本选区手感。 |
| Inline Reader comments | Selection action → comment popover → page-lifetime highlight + right gutter anchor | `src/ui/content/reader/ReaderPanel.ts`, `src/ui/content/reader/ReaderCommentPopover.ts`, `src/services/reader/commentSession.ts`, `src/services/reader/commentAnchoring.ts` | `tests/unit/services/reader/commentSession.test.ts`, `tests/unit/services/reader/commentAnchoring.test.ts`, `tests/integration/reader/reader-panel.comment.test.ts` | Reader 内选中 assistant markdown 正文后可添加评论；评论在页面生命周期内保留，高亮和 gutter anchor 可重开编辑；关闭 Reader 不丢，整页刷新后清空。 |
| Comment export prompts | Settings `Reader` → reusable prompts + comments copy template; Reader header `Copy comments` → preview + clipboard | `src/ui/content/bookmarks/ui/tabs/SettingsTabView.ts`, `src/ui/content/bookmarks/ui/popovers/ReaderPromptEditorPopover.ts`, `src/ui/content/bookmarks/ui/popovers/ReaderCommentTemplateSettingsPopover.ts`, `src/ui/content/reader/ReaderCommentExportPopover.ts`, `src/services/reader/commentExport.ts`, `src/core/settings/readerCommentExport.ts` | `tests/unit/services/reader/commentExport.test.ts`, `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts`, `tests/unit/ui/reader/readerCommentExportPopover.test.ts`, `tests/integration/reader/reader-panel.comment.test.ts` | 评论导出按创建顺序生成编号列表，使用 `sourceMarkdown` 而不是渲染文本；可在 Settings 中管理多条 user prompt 和唯一的 token-based copy template，Reader 内只展示最终结果预览并一键复制。 |

### B.2.C ChatGPT Conversation Directory（ChatGPT only）

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Payload/store-first snapshot | `ChatGPTConversationEngine.getSnapshot()` | `src/drivers/content/chatgpt/ChatGPTConversationEngine.ts`, `public/page-bridges/chatgpt-conversation-bridge.js` | `tests/unit/drivers/content/chatgpt/ChatGPTConversationEngine.test.ts`, `tests/unit/drivers/content/chatgpt/chatgptConversationBridge.test.ts` | 在 ChatGPT conversation 页面优先从 `/backend-api/conversation/<id>` payload 的 `mapping/current_node` 还原完整轮次，不依赖当前 DOM hydration 范围；payload 不可用时，先从 `main` 内结构化 turn 数据恢复完整 user/assistant 轮次，包括旧的 `[data-turn-id-container]` 和当前 `data-testid^="conversation-turn-"` / `data-turn` / `data-message-author-role` 结构，最后才回退到内部 thread store 发现与可见 DOM fallback。低优先级来源不得静默污染更完整的同 conversationId 结果。 |
| Reader content source | `collectReaderItems -> readerContentSource -> ReaderPanel.show()` | `src/services/reader/readerContentSource.ts`, `src/services/reader/collectReaderItems.ts`, `src/ui/content/controllers/MessageToolbarOrchestrator.ts` | `tests/unit/services/reader/readerContentSource.test.ts`, `tests/unit/drivers/content/chatgpt/chatgptReaderItems.test.ts`, `tests/unit/ui/reader/readerPanel.bookmarkAction.test.ts` | Reader 在 ChatGPT 上优先消费 DOM-discovered conversation turn model 产出的 Reader Markdown；只有 DOM start element 不可用时才使用 snapshot fallback。 |
| Save Messages Reader source | `readerContentSource -> Save Messages export` | `src/services/reader/readerContentSource.ts`, `src/ui/content/export/SaveMessagesDialog.ts`, `src/services/export/saveMessagesFacade.ts` | `tests/unit/services/reader/readerContentSource.test.ts`, `tests/unit/ui/export/saveMessagesDialog.test.ts` | Save Messages 不自行 force refresh ChatGPT snapshot；正文内容与 Reader 消费同一份 `ReaderItem[]`，再转换为 Markdown/PDF/PNG 导出 turns。 |
| Conversation directory rail | ChatGPT runtime → `ChatGPTDirectoryController`; Settings `chatgptDirectory` | `src/ui/content/controllers/ChatGPTDirectoryController.ts`, `src/ui/content/chatgptDirectory/ChatGPTDirectoryRail.ts` | `tests/unit/runtimes/content/entry.test.ts`, `tests/unit/ui/content/controllers/ChatGPTDirectoryController.test.ts`, `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts` | 右侧目录条按完整用户轮次展示历史；默认开启并保持 compact preview 模式；Settings 可单独隐藏目录条或切换 expanded list 模式；expanded 模式 hover/focus 展开全量用户消息条目、hover 高亮、单条标题最多 30 字符；目录很长时允许垂直滚动，expanded 行必须用明确的编号/文案/短线列布局和稳定 scrollbar gutter，hover/active 条目不得被 scrollbar 挤压裁切；click 在同页跳转到对应轮次；用户滚动页面时，active 高亮按整轮 user/assistant DOM 范围判定，并在用户未操作目录时让 rail 自身跟随 active 条目；上一条/下一条消息按钮是同一 controller 拥有的 body-level step controls，视觉上与 rail 分离但复用相同 active position 与 directory navigation helper；目录条设置不复用 `platforms.chatgpt`，关闭目录条不影响 Reader locate、书签 Go 或跨页 pending navigation；跳转不得抢占页面焦点或阻止用户继续浏览。 |
| ChatGPT same-page navigation helper | `navigateChatGPTDirectoryTarget({ position, messageId })`, `resolveChatGPTSkeletonPositionForMessage()` | `src/ui/content/chatgptDirectory/navigation.ts`, `src/ui/content/controllers/ChatGPTDirectoryController.ts`, `src/ui/content/controllers/MessageToolbarOrchestrator.ts`, `src/ui/content/bookmarks/BookmarksPanelController.ts`, `src/runtimes/content/entry.ts` | `tests/unit/ui/content/chatgptDirectory.navigation.test.ts`, `tests/unit/ui/content/controllers/ChatGPTDirectoryController.test.ts`, `tests/unit/ui/reader/readerPanel.bookmarkAction.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts`, `tests/unit/ui/bookmarks/bookmarksPanelController.test.ts`, `tests/unit/runtimes/content/entry.test.ts` | ChatGPT 目录条、Reader locate、书签面板 Go、跨页 pending navigation 共用同一条同页定位路径：优先消费 adapter/content-discovery 产出的用户轮次 anchor，失败后再回退到共享 bookmark navigation；导航层不得自行追加 ChatGPT DOM selector 规则，也不得用 assistant 数量决定目录轮次数；命中 anchor 后允许基于目标位置偏移做短生命周期 re-align，以抵消 host hydration/layout shift，但用户主动 wheel/pointer/touch/keyboard 导航必须中止后续校准；工具栏书签保存/高亮先解析 payload 绝对轮次，再复用现有书签身份。 |

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

### B.4 Bookmarks Panel（Content UI）

说明：BookmarksPanel 的职责是 **展示 + 交互 + intent 触发**，所有写入仍由 background handler 执行（MV3 可审计/可恢复边界不变）。

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Toggle panel via extension icon | Background action click → `ui:toggle_toolbar` → Content toggles panel | `src/runtimes/background/entry.ts`, `src/runtimes/content/entry.ts`, `src/ui/content/bookmarks/BookmarksPanel.ts` | manual | 在支持书签面板的平台页面点击扩展图标可打开/关闭面板。 |
| List/search/sort/filter bookmarks | Panel controls → view model | `src/ui/content/bookmarks/BookmarksPanel.ts`, `src/ui/content/bookmarks/BookmarksPanelController.ts`, `src/services/bookmarks/panelModel.ts` | `tests/unit/services/bookmarks/panelModel.test.ts` | 面板内可搜索、排序，列表可读且不污染宿主样式。 |
| Folder tree + CRUD | Panel buttons → `bookmarks:folders:*` | `src/ui/content/bookmarks/BookmarksPanel.ts`, `src/ui/content/bookmarks/BookmarksPanelController.ts` | manual | 文件夹可创建/重命名/移动/删除（删除需要空文件夹约束）。 |
| Preview (reuse ReaderPanel) | Click bookmark row → `ReaderPanel.show(items, startIndex, theme, { profile: 'bookmark-preview' })` | `src/ui/content/bookmarks/ui/tabs/BookmarksTabView.ts`, `src/ui/content/reader/ReaderPanel.ts` | manual | 分页范围沿用 legacy：有搜索词→按树顺序翻“全部可见书签”；无搜索词→仅在该 folder 内翻页。 |
| Row actions: Go / Copy / Delete | Panel row buttons → background intents | `src/ui/content/bookmarks/BookmarksPanelController.ts`, `src/drivers/content/bookmarks/navigation.ts`, `src/ui/content/chatgptDirectory/navigation.ts` | `tests/unit/ui/bookmarks/bookmarksPanelController.test.ts` | Go 能定位当前页 position（最佳努力重试）；ChatGPT 使用目录条 skeleton/container anchor 链路，其他平台继续使用共享 bookmark navigation；Copy/删除可用。 |
| Batch ops (delete/move/export) | Selection → bulk handlers | `src/contracts/protocol.ts`, `src/runtimes/background/handlers/bookmarks.ts`, `src/ui/content/bookmarks/BookmarksPanel.ts` | `tests/unit/runtimes/background/bookmarks-handler.test.ts` | 批量删除/移动/导出一次落盘（非循环 sendMessage）。 |
| Import/Export/Repair | Panel buttons → handler | `src/ui/content/bookmarks/BookmarksPanel.ts`, `src/runtimes/background/handlers/bookmarks.ts` | `tests/unit/core/bookmarks/stress.test.ts` | 导入 3000 级别 fixture 仍可用；repair 会 quarantine 再移除。 |
| Toolbar quick toggle (per message) | MessageToolbar `Bookmark` → `bookmarks:positions/save/remove` | `src/ui/content/controllers/MessageToolbarOrchestrator.ts`, `src/ui/content/MessageToolbar.ts`, `src/ui/content/chatgptDirectory/navigation.ts` | `tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts` | 每条消息可一键保存/取消，并反映已保存状态（Bookmarked）；ChatGPT 会用 skeleton/container 轮次解析避免动态加载窗口内的局部 position 污染书签状态。 |

---

### B.5 Settings Core（storage.sync; legacy key `app_settings`; no UI）

说明：Settings Core（通用逻辑 + background write authority + sync 存储）仍是权威写入边界；当前用户入口位于 BookmarksPanel 的 Settings tab。

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Read all settings (normalized) | `settings:getAll` | `src/core/settings/*`, `src/services/settings/settingsService.ts`, `src/runtimes/background/handlers/settings.ts` | `tests/unit/core/settings/migrations.test.ts`, `tests/unit/runtimes/background/settings-handler.test.ts` | 老用户升级后 `app_settings` 不丢；新字段 merge defaults。 |
| Set settings category | `settings:setCategory` | `src/services/settings/settingsService.ts`, `src/drivers/background/storage/syncStoragePort.ts` | unit tests | Service 只做 plan；background 统一落盘。 |
| Export preferences | Settings tab `Export` → preset + width + image scale | `src/core/settings/export.ts`, `src/services/settings/settingsService.ts`, `src/ui/content/bookmarks/ui/tabs/SettingsTabView.ts`, `src/runtimes/content/entry.ts` | `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts`, `tests/unit/runtimes/background/settings-handler.test.ts` | PNG 导出宽度与图片倍率由全局 settings 真相持有；宽度支持 mobile / tablet / desktop / custom；图片倍率支持 1x–3x 并在渲染时受浏览器 Canvas 上限保护。 |
| Advanced settings surface | Settings tab footer → collapsible advanced section | `src/ui/content/bookmarks/ui/tabs/SettingsTabView.ts`, `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts` | `tests/unit/ui/bookmarks/settingsTabView.test.ts` | 高级设置默认收起，只承载少量低频调参项；展开状态不持久化，实际设置值仍写入对应 settings category，不新增 `advanced` 顶层配置域。 |
| Reset to defaults | `settings:reset` | 同上 | unit tests | reset 后可再次读取并得到 defaults。 |
| Content-side cache + subscribe | `SettingsClient.subscribe()` | `src/drivers/content/settings/settingsClient.ts` | (covered by unit tests + TypeScript) | storage.onChanged 触发后可 best-effort 刷新缓存。 |

---

### B.6 Save Messages Export Core（Markdown + PDF + PNG; no UI entry yet）

说明：本阶段交付 **导出核心能力**（采集/构建/副作用 drivers + 门禁测试）。为便于端到端回归，目前已提供一个“低耦合的 UI 入口”：

- MessageToolbar 打开 ReaderPanel 后，在 ReaderPanel footer 的 custom actions 中提供 `Export MD / Export PDF / Export PNG`（导出当前页对应消息）。

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Save Messages source | `SaveMessagesDialog -> readerContentSource -> ReaderItem[] -> ChatTurn[]` | `src/services/reader/readerContentSource.ts`, `src/ui/content/export/SaveMessagesDialog.ts` | `tests/unit/services/reader/readerContentSource.test.ts`, `tests/unit/services/reader/collectReaderItems.thinking.test.ts`, `tests/unit/ui/export/saveMessagesDialog.test.ts` | Save Messages 的正文来源与 Reader 完全一致；导出层不再自行从 adapter 收集 turns，也不再自行 force refresh ChatGPT snapshot。 |
| Export Markdown (download) | `exportTurnsMarkdown(turns, selectedIndices, metadata, {t})` | `src/services/export/saveMessagesFacade.ts`, `src/services/export/saveMessagesMarkdown.ts`, `src/drivers/content/export/downloadFile.ts` | `tests/unit/services/export/saveMessagesMarkdown.test.ts`, `tests/unit/services/export/saveMessagesFacade.test.ts`, `tests/unit/ui/export/saveMessagesDialog.test.ts` | selection 为空不触发下载；文件名 sanitize；标题 heading 归一化；内容编号按 1..n 连续。 |
| Export PDF (print) | `exportTurnsPdf(turns, selectedIndices, metadata, {t})` | `src/services/export/saveMessagesFacade.ts`, `src/services/export/saveMessagesPdf.ts`, `src/drivers/content/export/printPdf.ts` | `tests/unit/drivers/content/export/printPdf.test.ts`, `tests/unit/services/export/saveMessagesPdf.sanitization.test.ts`, `tests/unit/services/export/saveMessagesPdf.styleParity.test.ts` | print container 创建后能 afterprint/timeout cleanup；metadata/userPrompt escape；assistant HTML 走 sanitize 路径；导出 CSS 自持普通 Markdown list marker，避免宿主页面 reset 吞掉 bullet/number。 |
| Export PNG (download / zip) | `exportTurnsPng(turns, selectedIndices, metadata, {t, onProgress, png})` | `src/services/export/saveMessagesFacade.ts`, `src/services/export/saveMessagesPng.ts`, `src/services/export/saveMessagesDocument.ts`, `src/drivers/content/export/renderPng.ts`, `src/drivers/content/export/downloadBlob.ts`, `src/drivers/content/export/zipBlobs.ts` | `tests/unit/services/export/saveMessagesPng.test.ts`, `tests/unit/services/export/saveMessagesFacade.test.ts`, `tests/unit/drivers/content/export/renderPng.test.ts`, `tests/unit/drivers/content/export/downloadBlob.test.ts`, `tests/unit/drivers/content/export/zipBlobs.test.ts`, `tests/unit/ui/export/saveMessagesDialog.test.ts` | 单条导出 `.png`；多条串行渲染为多张 `.png` 并打包 `.zip`；复用 PDF/PNG shared document builder、sanitize 与 Reader markdown theme；导出弹窗可显示 PNG 渲染/打包进度，并消费 Settings 中的全局 PNG 宽度与图片倍率偏好；长内容会在触及浏览器 Canvas 单边上限前显式下调有效倍率；单条长内容第一版不自动切片，渲染失败时返回明确错误。 |
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

- 新增 i18n 能力扩展（例如更多 locale 或整站文案重写）
- 独立 Settings 页面（当前沿用 BookmarksPanel Settings tab 入口）
- 超出 `CAPABILITY_MATRIX.md` 当前支持范围的平台承诺

---

## D) Gates（门禁与验收）

### D.1 工程门禁（每次变更按风险选择）

当前日常开发的可执行门禁权威，以 `docs/testing/CURRENT_TEST_GATES.md` 为准。

发布前或高风险跨模块改动的推荐全量门禁为：

- `npm run test:smoke`
- `npm run test:core`
- `npm run test:acceptance`（平台支持状态、release-level 文档/manifest 一致性）
- `npm run build`（Chrome MV3 + Firefox MV2）

### D.2 手工验收清单（在支持的平台上）

- 刷新 / 切换对话 / 连续生成：每条 assistant 消息最终出现工具栏（不重复、不漂移）
- Copy Markdown：复制当前消息内容
- Reader：打开/翻页/复制，关闭无残留
- LaTeX click：可用且不影响用户选择/复制公式文本（selection guard 生效）
