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
| UI entrypoints | **No legacy global toolbar**; compact global page controls are allowed only for ChatGPT navigation and Detached Reader | 减少注入点与 UI 干扰；常规消息动作仍聚焦“每条消息工具栏 + ReaderPanel”，但右下角 ChatGPT message stepper 所在的页面级控制组可承载低频全局动作。Detached Reader 不属于单条消息 toolbar 动作，应放在 stepper 左侧的同组全局按钮。 |
| Action icon click | Background sends `ping` → `ui:toggle_toolbar` → Content toggles **BookmarksPanel** | 扩展图标作为稳定入口；点击前先轻量确认当前 ChatGPT tab 的 content script 可达，失效 tab 静默降级，页面恢复后通过 `content:ready` 重新接回。 |
| Per-message toolbar placement | Official action bar row only; no content fallback | 避免把官方工具栏挤到下方；官方 action row 缺失时不注入，等待后续 DOM 信号重扫。 |
| Injection algorithm | MO as signal + debounced scan + ChatGPT message lifecycle reconcile + targeted stale recovery + route rebind | SPA/React 更稳定；message 可先出现、官方 action bar 后补出现，ChatGPT 可归属的 action-row hydration 只推进对应消息状态；若某条消息在官网 hydration / network jitter 窗口进入 `anchor_pending` 或 `stale`，只对该消息做递增退避的 incremental reconcile，避免失败一次后必须刷新网页；整页重扫仅保留给 init、route change、observer rebind 或无法归属的异常结构。 |
| LaTeX click-to-copy | Enabled by default; configurable from Settings `Formula` and per-platform toggles | 功能性优先，同时允许用户按公式工作流关闭 Markdown 点击复制；公式 PNG/SVG/MathML 悬浮动作默认关闭，可在 Settings 中按需启用。ChatGPT 使用完整页面 runtime；Gemini、Claude、DeepSeek 使用公式复制 runtime，且可在 Platforms 中分别关闭。 |
| ChatGPT message navigation | Optional AI-MarkDone directory rail + optional lower-right stepper | AI-MarkDone 右侧目录条恢复为用户可选能力，默认关闭，由 `chatgptDirectory.enabled` 控制；启用 AI-MarkDone 目录条时同步隐藏可确认的 ChatGPT 官方对话导航，找不到候选则 no-op。右下角轻量 stepper 仍由 `ChatGPTMessageStepperController` 独立持有，默认显示上一条/下一条入口，可通过 `chatgptBehavior.showMessageStepper` 关闭；Detached Reader 的 Split View 全局按钮属于同一个 lower-right page-control cluster，固定放在 Previous/Next 左侧，不进入 per-message toolbar；左右方向键导航由 `chatgptBehavior.enableArrowKeyMessageNavigation` 单独启用/关闭。Reader locate、Bookmark Go 与 pending navigation 继续复用同一条 ChatGPT same-page navigation helper。 |
| ChatGPT send position restore | Optional, default-on page behavior under `chatgptBehavior.restorePositionAfterSend` | 发送后恢复阅读位置默认开启，只在用户主动发送时短生命周期 arm：记录主滚动容器和顶部附近 turn anchor，ChatGPT 跳底或水合位移后尽快 instant restore；用户可在 ChatGPT Settings 关闭；用户手动滚动、触摸、指针/键盘导航、官方滚到底部或显式 Reader/Bookmark 导航会释放，不进入 Reader/Export/Copy/Bookmark 正文链路。 |

---

## B) Capability Matrix（能力矩阵：Copy + Reader）

### B.1 Copy（Markdown + LaTeX click-to-copy）

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Copy Markdown for **current message** | MessageToolbar `Copy Markdown` → fresh current `ReaderItem` → shared Reader markdown clipboard helper | `src/services/reader/readerContentSource.ts`, `src/services/reader/readerMarkdownCopy.ts`, `src/drivers/content/clipboard/clipboard.ts`, `src/ui/content/MessageToolbar.ts` | `tests/unit/services/reader/readerContentSource.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.copy-png.test.ts`, `tests/unit/ui/content/MessageToolbar.test.ts`, `tests/integration/reader/reader-panel.test.ts` | 点击某条消息的 Copy，只复制与 Reader 当前页相同来源的当前消息 Markdown（非整页/非最后一条）；当前消息正文必须通过 fresh `ReaderItem` source 获取，不新增独立 DOM copy 主链。 |
| Copy PNG for **current message** | MessageToolbar `Copy Markdown` hover action → fresh current `ReaderItem` → `ChatTurn` → PNG plan/render reuse → image clipboard | `src/services/reader/readerContentSource.ts`, `src/services/copy/copy-turn-png.ts`, `src/drivers/content/clipboard/copyImageToClipboard.ts`, `src/drivers/content/export/renderPng.ts`, `src/ui/content/MessageToolbar.ts` | `tests/unit/services/copy/copy-turn-png.test.ts`, `tests/unit/drivers/content/clipboard/copyImageToClipboard.test.ts`, `tests/unit/ui/content/MessageToolbar.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.copy-png.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.safariSurface.test.ts` | hover 次动作只复制当前消息/turn 的单张 PNG；与 Markdown Copy 共享同一个 fresh current `ReaderItem` source，再复用现有 PNG 渲染链路。Safari App Store target 按 build-time policy 隐藏该二进制剪贴板动作。 |
| Copy Markdown for **last message** (dev helper) | `copyMarkdownFromPage(adapter)` | `src/services/copy/copy-markdown.ts` | `tests/integration/copy/copy-markdown.chatgpt.test.ts` | 仅用于开发/调试；非 UI 验收入口。 |
| Rule-based conversion stability (whitespace/indent/newlines) | Copy pipeline | `src/services/markdown-parser/**` | `tests/parity/copy/*` + goldens | golden 对齐作为输出真值。 |
| Platform noise filtering (structural only) | `adapter.isNoiseNode()` + placeholder | `src/drivers/content/adapters/*`, `src/services/copy/copy-markdown.ts` | parity fixtures | 噪声过滤不基于文本，避免 i18n 漂移。 |
| Streaming guard (pending state) | `adapter.isStreamingMessage()` → disable actions | `src/ui/content/controllers/MessageToolbarOrchestrator.ts` | (covered by manual) | 流式阶段禁用按钮，不影响注入与后续重试。 |
| LaTeX click-to-copy | Enable on injected ChatGPT message containers, formula platform roots, or direct formula elements; Settings `formula.clickCopyMarkdown` gates click interception | `src/drivers/content/math/math-click.ts`, `src/runtimes/content/formulaOnlyRuntime.ts`, `src/runtimes/content/formulaPlatformParsers.ts`, `src/core/settings/formula.ts` | `tests/unit/core/latex/extractLatexSource.test.ts`, `tests/unit/drivers/math-click.test.ts`, `tests/unit/runtimes/content/formulaOnlyRuntime.test.ts`, `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts` | 默认开启，在不破坏页面交互的前提下复制 LaTeX；关闭后点击公式不复制、不拦截宿主事件，但不影响仍启用的公式图片 hover 动作。ChatGPT 由完整 message toolbar 注入链路启用；Gemini、Claude、DeepSeek 由 formula runtime 在 bounded formula roots 上启用旧 `MarkdownParserAdapter` 的公式子链路，使用平台自己的 `isMathNode`、`extractLatex` 与 `isBlockMath` 完成识别、源码提取和块级判定。 |
| Formula PNG/SVG/MathML copy and save | Hover a formula → enabled subset of `Copy as PNG` / `Copy as SVG` / `Copy as MathML` / `Save as PNG` / `Save as SVG`; Settings `formula.assetActions` gates visibility | `src/drivers/content/math/math-click.ts`, `src/runtimes/content/formulaOnlyRuntime.ts`, `src/runtimes/content/formulaPlatformParsers.ts`, `src/ui/content/controllers/FormulaAssetHoverController.ts`, `src/ui/content/components/ToolbarHoverActionPortal.ts`, `src/services/math/formulaAssetActions.ts`, `src/services/math/formulaAssetRenderer.ts`, `src/runtimes/formula-renderer/entry.ts`, `src/drivers/content/clipboard/copySvgToClipboard.ts`, `src/drivers/content/clipboard/copyMathmlToClipboard.ts`, `src/drivers/content/export/renderFormulaPng.ts`, `src/core/settings/formula.ts` | `tests/unit/drivers/math-click.test.ts`, `tests/unit/runtimes/content/formulaOnlyRuntime.test.ts`, `tests/unit/ui/content/FormulaAssetHoverController.test.ts`, `tests/unit/ui/content/formulaAssetHoverController.safariSurface.test.ts`, `tests/unit/ui/components/ToolbarHoverActionPortal.test.ts`, `tests/unit/services/math/formulaAssetActions.test.ts`, `tests/unit/services/math/formulaAssetRenderer.test.ts`, `tests/unit/runtimes/formula-renderer/entry.test.ts`, `tests/unit/drivers/content/clipboard/copySvgToClipboard.test.ts`, `tests/unit/drivers/content/export/renderFormulaPng.test.ts` | 五个 hover 动作必须与点击复制源码共用同一个 LaTeX 提取入口；在 Gemini、Claude、DeepSeek 上，该入口必须使用恢复的旧平台 parser adapter，而不是脱离平台语义的通用 selector/source 兜底；默认全部关闭，Settings 可显示任意 PNG/SVG/MathML copy/save 动作，五个动作全关时不显示 hover 菜单；已存 `formula.assetActions` 的用户选择必须保留，只有缺失该字段的旧设置迁移为全关；Safari App Store target 额外隐藏 `Copy as PNG` / `Copy as SVG`，但保留 `Copy as MathML` 与 Save PNG/SVG；公式 hover 菜单必须 clamp 在 viewport 内，行内公式位于最左/最右侧时不得越出屏幕，顶部空间不足时可翻到公式下方；单公式 SVG 与 MathML 由按需加载的 iframe MathJax renderer 生成，不得静态打入 `content.js`；renderer 必须保持自包含，不允许依赖运行时动态加载 MathJax 字体文件；content-side renderer client 必须缓存同 key asset 并复用 in-flight 请求；MathML 作为单公式 Presentation MathML 复制到剪贴板，并在浏览器支持时同时提供 HTML clipboard payload，适配 Office 粘贴互操作但不声明为 Office 内部 OMML 格式；PNG 由同一份 SVG rasterize；默认公式字号固定为 36px；不改变整条消息 PNG 导出链路。 |

#### Copy goldens（回归策略）

- Goldens：`tests/fixtures/expected/copy/chatgpt/<fixture>.md`
- Parity tests：从 ChatGPT mocks 读取 fixture，跑 rewrite pipeline，对比 golden
- Golden 更新脚本：`scripts/update-copy-goldens.ts`（ChatGPT-only，用于“有意识更新 baseline”，不进入默认 test 流）

#### LaTeX click safety guard（必须落实，避免破坏宿主页面）

当 LaTeX click 默认开启或被用户重新开启时，必须满足：

- selection 非空（用户正在选择文本）时 **不触发复制**，不拦截事件链。
- 仅在确认要复制时才 `preventDefault/stopPropagation`（尽量不干扰宿主交互）。
- hover 公式时可以展示 Settings 允许的单公式 PNG/SVG 复制与保存动作；这些动作必须继续消费同一份 LaTeX source，不得增加第二套公式源码解析链路。

---

### B.2 Reader（MVP）

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Open ReaderPanel from a message toolbar | MessageToolbar `Reader` → fresh `readerContentSource` → `ReaderPanel.show(items, startIndex, theme, { profile, actions? })` | `src/ui/content/reader/ReaderPanel.ts`, `src/services/reader/readerContentSource.ts` | `tests/unit/services/reader/readerContentSource.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts`, `tests/integration/reader/reader-panel.test.ts` | 点击任意消息 Reader 能稳定打开；ChatGPT Reader 打开入口消费 fresh `ReaderItem[]`，不自行选择 DOM 正文来源。 |
| Open detached Reader tab from the lower-right page controls | Lower-right Split View button → first-use experimental notice modal → confirm → fresh `readerContentSource` → `readerSession:create` → extension page `reader.html#sessionId=...` → shared fullscreen `ReaderPanel.show(...)` | `src/ui/content/controllers/ChatGPTMessageStepperController.ts`, `src/ui/content/controllers/MessageToolbarOrchestrator.ts`, `src/runtimes/background/handlers/readerSession.ts`, `src/runtimes/reader/entry.ts`, `src/services/reader/readerSessionSnapshot.ts` | `tests/unit/runtimes/background/readerSession-handler.test.ts`, `tests/unit/services/reader/readerSessionSnapshot.test.ts`, `tests/unit/contracts/protocol.test.ts`, `tests/unit/ui/content/controllers/ChatGPTMessageStepperController.test.ts`, `tests/unit/ui/reader/readerPanel.presentation.test.ts` | Detached Reader 入口必须是右下角 page-control cluster 内的 icon-only Split View 按钮，位于 Previous/Next 左侧，不放在 per-message toolbar。首次点击先显示复用现有 modal/changelog notice 风格的实验性功能提示，说明它会把 Reader 打开到独立扩展页以绕开 ChatGPT 官方页渲染卡顿、仍需源 ChatGPT tab 执行刷新/发送/定位、源页不可达时只能保留快照、v1 不做实时同步或强保活；modal 提供“确定跳转”和“取消返回”，确认状态写入 settings/storage，取消不创建 session。每个 detached Reader 只连接自己的源 ChatGPT tab；多个 ChatGPT tabs 并发时按 `sessionId + sourceTabId + readerTabId` 隔离。独立页必须复用同一个 ReaderPanel、Reader settings surface、Markdown renderer、copy/comment/Sticky/prompt 能力，默认以 fullscreen Reader 打开；refresh/send/locate 经 runtime protocol 回源页执行。关闭源 ChatGPT tab 会 best-effort 关闭对应 Reader tab，关闭 Reader tab 不影响源页。 |
| Reader display settings and resizing | Reader header Settings → display/settings dialog → default size, typography, content width, rendering, outline, comment prompts/template; Reader panel resize handle persists panel ratios | `src/core/settings/types.ts`, `src/ui/content/reader/ReaderPanel.ts`, `src/ui/content/reader/readerPanelTemplate.ts`, `src/runtimes/reader/entry.ts` | `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts`, `tests/unit/ui/reader/readerPanel.presentation.test.ts`, `tests/integration/reader/reader-panel.test.ts` | Reader 专属设置不再展示在 Settings 页面；官网内 Reader 和 detached Reader 都从 Reader header 的 settings icon 打开同一弹框。弹框复用现有 Reader settings dialog/modal family，包含 default open size（`fullscreen`/`panel`，默认 `fullscreen`）、Reader 正文字号 `bodyFontSizePx` 的 `- / +` 即时预览、正文最大宽度、代码块渲染、outline、comment prompt 位置、prompt 管理与 comment copy template 管理。Fullscreen surface 占满可视区域；panel 模式居中显示。panel resize 从右下角 handle 触发中心对称缩放，`dx/dy` 同时扩大或缩小两侧，保存 viewport `widthRatio/heightRatio` 而非绝对 px；viewport 尺寸变化后按 ratio 重算并 clamp 在可视区内。拖拽只改变 Reader shell presentation，不改变 Markdown source、分页、复制、发送、评论、Sticky 或 runtime protocol 合同。 |
| Shared update notice in Reader | `ReaderPanel.show(..., { profile: 'conversation-reader' })` → shared changelog notice presenter → `bookmarks:changelogNotice:get/ack` | `src/ui/content/reader/ReaderPanel.ts`, `src/ui/content/changelog/ChangelogNoticePresenter.ts` | `tests/unit/ui/reader/readerPanel.presentation.test.ts`, `tests/unit/ui/bookmarks/bookmarksPanel.test.ts` | 更新后首次打开 Reader 也会展示更新日志提示；Reader 与书签面板共用同一条 ack 状态，因此同一版本只提示一次。 |
| Pagination (Prev/Next + index/total) | ReaderPanel internal state | `src/ui/content/reader/ReaderPanel.ts` | integration test + `tests/unit/ui/reader/readerPanel.navigation.test.ts` | 可翻页且 index/total 正确；页数超过 10 时，底部分页器最多显示 10 个页码点，中间页使用 `3 + ellipsis + 4 + ellipsis + 3` 的窗口，靠近开头/结尾时合并重叠窗口并保留当前页附近的前后页，避免长对话页码挤压或遮挡。 |
| ChatGPT open Reader tail page sync | MessageToolbar scan/mutation sync → DOM round position pending state → refreshed `ChatGPTConversationEngine snapshot` → ready append → `ReaderPanel.appendItem()` | `src/ui/content/controllers/MessageToolbarOrchestrator.ts`, `src/services/reader/chatgptReaderItems.ts`, `src/ui/content/reader/ReaderPanel.ts` | `tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.scheduler.test.ts` | Reader 已打开时，如果用户在 Reader 内发送新消息并让官方页面追加新轮次，分页器应在该 round 的 snapshot assistant 内容非空后追加新页且不切走当前页；ChatGPT 新页必须来自刷新后的 snapshot，DOM 只负责按 position 标记 pending，不能用 DOM fallback 构造 ChatGPT 正文。 |
| Render Markdown + sanitize | `renderMarkdown(markdown)` | `src/services/renderer/renderMarkdown.ts`, `src/services/markdown-parser/rules/block/TableRule.ts` | `tests/unit/services/renderer/renderMarkdown.test.ts`, `tests/unit/services/copy/copy-markdown.contract.test.ts` | XSS 清洗门禁必须存在；GFM 表格单元格里的标准 `$...$` 公式以及从页面 HTML 表格提取出的 KaTeX 公式都必须保留为可再次渲染的 Markdown math。Mermaid 图表渲染不属于 Reader 支持范围；Mermaid fenced code 只按普通代码块保留源码，不再接入独立 renderer、iframe 或预览层。 |
| Tokenized Markdown rendering | Reader uses the shared markdown theme and sanitize pipeline | `src/ui/content/reader/ReaderPanel.ts`, `src/ui/content/reader/readerPanelTemplate.ts`, `src/services/renderer/renderMarkdown.ts` | unit + governance + acceptance | Reader 正文始终使用默认 tokenized Markdown 主题；主题只影响正文视觉，不改变 Reader shell chrome。 |
| Reader heading outline navigation | `renderMarkdownForReader().outlineItems` → ReaderPanel right-side outline rail; Reader settings dialog `reader.showOutlineInReader` controls visibility | `src/services/renderer/renderMarkdown.ts`, `src/ui/content/reader/ReaderPanel.ts`, `src/ui/content/reader/readerPanelTemplate.ts` | `tests/unit/services/renderer/renderMarkdown.test.ts`, `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/reader/readerPanel.navigation.test.ts`, `tests/integration/reader/reader-panel.test.ts` | 当前 Reader 页有至少两个非空 Markdown heading 且设置开启时，右侧显示 tokenized compact outline rail；hover/focus 展开为 `H1/H2/H3` 前缀 + 单行截断标题的左对齐列表，并按 heading level 缩进；click 只在当前 Reader 页内跳转到对应 heading，不改变消息分页、copy/export 或 Markdown 渲染合同。 |
| Reader content width preference | Reader settings dialog → Reader content width | `src/core/settings/types.ts`, `src/ui/content/reader/ReaderPanel.ts` | `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/reader/readerPanel.presentation.test.ts` | Reader 正文最大宽度默认保持 1000px，可在 Reader 内 settings dialog 调整；正文宽度必须继续 clamp 到当前 Reader shell 宽度内，不决定 shell 本身的 fullscreen/panel 模式，也不改变 Markdown 渲染链路。 |
| Copy current page markdown | ReaderPanel `Copy` | `src/ui/content/reader/ReaderPanel.ts`, `src/drivers/content/clipboard/clipboard.ts` | integration test | Reader 页内容与 Copy pipeline 对齐（同一条消息输出一致）。 |
| Surface-owned reader profiles | `ReaderPanel.show(..., { profile, actions[] })` | `src/ui/content/reader/ReaderPanel.ts` | unit/integration + governance | 同一 ReaderPanel 在多个入口下保持稳定 baseline chrome；入口差异通过命名 profile 和批准的 action rail 表达，不允许入口直接传 CSS 或低层 chrome flags。 |
| Message sending (composer sync + send) | ReaderPanel `Send` → `sendText(adapter, text)` | `src/ui/content/reader/ReaderPanel.ts`, `src/services/sending/sendService.ts`, `src/drivers/content/sending/composerPort.ts`, `src/drivers/content/adapters/sites/chatgpt.ts`, `src/core/sending/contenteditable.ts` | `tests/unit/core/sending/*`, `tests/unit/drivers/content/sending/*`, `tests/integration/sending/*` | 多行文本换行保持一致；不会触发语音按钮；等待 send ready 后再点击发送。 |
| Atomic closed-unit source selection | Native text selection + Reader-only atomic unit highlighting + `Ctrl/Cmd+C` | `src/ui/content/reader/ReaderPanel.ts`, `src/services/reader/atomicSelection.ts`, `src/services/reader/atomicExport.ts` | `tests/unit/services/reader/atomicSelection.test.ts`, `tests/unit/services/reader/atomicExport.test.ts`, `tests/integration/reader/reader-panel.test.ts` | 只允许 assistant markdown 正文选区触发 Reader selection actions；inline math / display math / inline code / code block / table / image 会整单元高亮并按源码复制，不改变普通文本选区手感。 |
| Reader Sticky temporary excerpts | Selection action `Stick` → Reader-local sticky workspace blocks | `src/ui/content/reader/ReaderPanel.ts`, `src/ui/content/reader/readerPanelTemplate.ts` | `tests/integration/reader/reader-panel.sticky.test.ts` | 仅 `conversation-reader` profile 启用；选中正文后可把当前 selection Markdown 作为 sanitized Markdown block 暂存到 Reader 左侧工作区，翻页和关闭/重开 Reader 时保持不变；block 不使用卡片外框、不限高，左侧只保留拖拽与删除两枚纵向操作按钮；只允许页面刷新或 content runtime 重新初始化时丢失；不写入 background/storage，不进入导出、书签、发送或评论数据合同；宽屏下 Sticky 可拖拽调宽，最大为 Reader body 宽度的 2/3，最小保持可用宽度；窄屏不进入三栏，Sticky 打开时作为 Reader 内部左侧 drawer 覆盖正文；展开入口位于 Reader footer 左侧 action cluster 前。 |
| Inline Reader comments | Selection action → comment popover → page-lifetime highlight + right gutter anchor | `src/ui/content/reader/ReaderPanel.ts`, `src/ui/content/reader/ReaderCommentPopover.ts`, `src/services/reader/commentSession.ts`, `src/services/reader/commentAnchoring.ts` | `tests/unit/services/reader/commentSession.test.ts`, `tests/unit/services/reader/commentAnchoring.test.ts`, `tests/integration/reader/reader-panel.comment.test.ts` | Reader 内选中 assistant markdown 正文后可添加评论；评论在页面生命周期内保留，高亮和 gutter anchor 可重开编辑；关闭 Reader 不丢，整页刷新后清空。 |
| Comment export prompts | Reader settings dialog → reusable prompts + prompt position + comments copy template; Reader header `Copy comments` → preview + clipboard | `src/ui/content/reader/ReaderPromptSettingsPopover.ts`, `src/ui/content/reader/ReaderCommentTemplateSettingsPopover.ts`, `src/ui/content/reader/ReaderCommentExportPopover.ts`, `src/services/reader/commentExport.ts`, `src/core/settings/readerCommentExport.ts` | `tests/unit/services/reader/commentExport.test.ts`, `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/reader/readerCommentExportPopover.test.ts`, `tests/integration/reader/reader-panel.comment.test.ts` | 评论导出按创建顺序生成编号列表，使用 `sourceMarkdown` 而不是渲染文本；可在 Reader 内 settings dialog 管理多条 user prompt、Prompt 在复制内容顶部或底部的位置偏好，以及唯一的 token-based copy template；Reader 内展示最终结果预览并一键复制。 |

### B.2.C ChatGPT Conversation Directory（ChatGPT only）

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Payload/store-first snapshot | `ChatGPTConversationEngine.getSnapshot()` | `src/drivers/content/chatgpt/ChatGPTConversationEngine.ts`, `public/page-bridges/chatgpt-conversation-bridge.js` | `tests/unit/drivers/content/chatgpt/ChatGPTConversationEngine.test.ts`, `tests/unit/drivers/content/chatgpt/chatgptConversationBridge.test.ts` | 在 ChatGPT conversation 页面优先从 `/backend-api/conversation/<id>` payload 的 `mapping/current_node` 还原完整轮次，不依赖当前 DOM hydration 范围；payload 不可用时，先从 `main` 内结构化 turn 数据恢复完整 user/assistant 轮次，包括旧的 `[data-turn-id-container]` 和当前 `data-testid^="conversation-turn-"` / `data-turn` / `data-message-author-role` 结构，最后才回退到内部 thread store 发现与可见 DOM fallback。Firefox 只在 page bridge transport 层使用 JSON string `CustomEvent.detail`，Chrome/Chromium 保持 object detail；Reader、Bookmark、Copy、Save Messages 上层不新增浏览器分支。低优先级来源不得静默污染更完整的同 conversationId 结果。 |
| Reader content source | `readerContentSource -> fresh ChatGPTConversationEngine snapshot -> ReaderPanel.show()` | `src/services/reader/readerContentSource.ts`, `src/services/reader/chatgptReaderItems.ts`, `src/ui/content/controllers/MessageToolbarOrchestrator.ts` | `tests/unit/services/reader/readerContentSource.test.ts`, `tests/unit/drivers/content/chatgpt/chatgptReaderItems.test.ts`, `tests/unit/ui/reader/readerPanel.bookmarkAction.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts` | Reader 在 ChatGPT 上消费 fresh `ChatGPTConversationEngine` snapshot 构造出的 `ReaderItem[]`，避免被旧缓存或当前 DOM hydration/virtualization 范围截断；工具栏 Copy/Copy PNG、Save Messages 与书签保存正文复用同一份 `ReaderItem` 语义。 |
| Save Messages Reader source | `readerContentSource -> fresh ReaderItem[] -> Save Messages export` | `src/services/reader/readerContentSource.ts`, `src/ui/content/export/SaveMessagesDialog.ts`, `src/services/export/saveMessagesFacade.ts` | `tests/unit/services/reader/readerContentSource.test.ts`, `tests/unit/ui/export/saveMessagesDialog.test.ts` | Save Messages 的正文条目与 Reader 来自同一条 fresh `ReaderItem[]` 链路，再转换为 Markdown/PDF/PNG 导出 turns；工具栏打开导出时默认只选中 Reader source 定位到的当前条目，全选仍由用户显式触发。 |
| Conversation directory rail | Optional ChatGPT right-side directory, default off | `src/ui/content/controllers/ChatGPTDirectoryController.ts`, `src/ui/content/chatgptDirectory/ChatGPTDirectoryRail.ts`, `src/ui/content/controllers/ChatGPTOfficialNavigationVisibilityController.ts` | `tests/unit/runtimes/content/entry.test.ts`, `tests/unit/ui/content/controllers/ChatGPTDirectoryController.test.ts`, `tests/unit/ui/content/controllers/ChatGPTOfficialNavigationVisibilityController.test.ts`, `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts` | AI-MarkDone 可在 ChatGPT Settings 中启用右侧目录条；目录条复用 `collectChatGPTRoundPositions(adapter)`、active following 与 `navigateChatGPTDirectoryTarget(...)`，不新增正文发现链路。目录条不再拥有旧 lower-right step controls；相邻消息跳转继续由 `ChatGPTMessageStepperController` 管理。启用目录条时会同步隐藏 ChatGPT conversation highlight root 下贴右侧的 fixed 直接子容器；官方容器延迟出现时由 CSS direct-child guard 立即覆盖，并由 MutationObserver refresh 继续同步，同时明确排除左侧历史侧边栏。 |
| ChatGPT message stepper | Optional lower-right Previous/Next buttons + optional Left/Right keyboard navigation | `src/ui/content/controllers/ChatGPTMessageStepperController.ts`, `src/ui/content/chatgptDirectory/navigation.ts`, `src/runtimes/content/entry.ts`, `src/core/settings/types.ts` | `tests/unit/ui/content/controllers/ChatGPTMessageStepperController.test.ts`, `tests/unit/runtimes/content/entry.test.ts`, `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts` | 右下角 stepper 在 ChatGPT conversation 页面默认提供左右排列的上一条/下一条按钮，点击复用 same-page navigation helper，并可通过 `chatgptBehavior.showMessageStepper` 关闭；左右方向键默认开启但由 `chatgptBehavior.enableArrowKeyMessageNavigation` 单独控制。键盘监听必须跳过 input、textarea、contenteditable、role=textbox、组合键、IME composing、AI-MarkDone 面板/弹窗/输入区，避免抢输入框光标移动。 |
| ChatGPT viewport resize suspend | `ViewportResizeSuspendController -> data-aimd-viewport-resizing -> aimd:viewport-resize-idle` | `src/ui/content/controllers/ViewportResizeSuspendController.ts`, `src/runtimes/content/entry.ts` | `tests/unit/ui/content/controllers/ViewportResizeSuspendController.test.ts`, `tests/unit/runtimes/content/entry.test.ts` | ChatGPT viewport 宽度变化超过 8px 时，AI-MarkDone action-row message toolbar chrome 会立即短暂隐藏并暂停子树渲染，让官方页面优先完成布局；该行为只由浏览器 resize + 宽度阈值驱动，不依赖 ChatGPT DOM/mutation；停止 resize 1 秒后恢复插件 chrome，不卸载 DOM、不重建 toolbar record、不折叠 action-row toolbar 布局、不改变 Reader、Save Messages 或书签数据合同。 |
| ChatGPT send position restore | `chatgptBehavior.restorePositionAfterSend` → `ChatGPTSendPositionRestoreController` | `src/ui/content/controllers/ChatGPTSendPositionRestoreController.ts`, `src/drivers/content/chatgpt/sendPositionRestoreEvents.ts`, `src/runtimes/content/entry.ts`, `src/ui/content/sending/SendModal.ts`, `src/ui/content/sending/SendPopover.ts` | `tests/unit/ui/content/controllers/ChatGPTSendPositionRestoreController.test.ts`, `tests/unit/runtimes/content/entry.test.ts`, `tests/unit/ui/sending/sendModal.test.ts`, `tests/unit/ui/sending/sendPopover.pendingSync.test.ts` | 默认开启；仅在官方 composer 或 AI-MarkDone send surface 真正发送前 arm。若当前离底部不超过 160px 则不干预；否则记录主滚动容器、scrollTop 和顶部附近 turn anchor，短生命周期 MutationObserver / scroll listener / rAF 合并恢复，最长 90 秒或 20 次恢复后释放。用户 wheel/touch/pointer/keyboard、官方滚到底部、Reader locate、Bookmark Go 与其他显式导航必须立即 release。该能力只负责发送后的阅读位置恢复，不读取正文、不触发 snapshot、不进入 Reader/Export/Copy/Bookmark 内容 SSOT。 |
| ChatGPT same-page navigation helper | `navigateChatGPTDirectoryTarget({ position, messageId })`, `resolveChatGPTSkeletonPositionForMessage()` | `src/ui/content/chatgptDirectory/navigation.ts`, `src/ui/content/controllers/MessageToolbarOrchestrator.ts`, `src/ui/content/bookmarks/BookmarksPanelController.ts`, `src/runtimes/content/entry.ts` | `tests/unit/ui/content/chatgptDirectory.navigation.test.ts`, `tests/unit/ui/reader/readerPanel.bookmarkAction.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts`, `tests/unit/ui/bookmarks/bookmarksPanelController.test.ts`, `tests/unit/runtimes/content/entry.test.ts` | Reader locate、书签面板 Go、跨页 pending navigation 共用同一条同页定位路径：优先消费 adapter/content-discovery 产出的用户轮次 anchor，失败后再回退到共享 bookmark navigation；导航层不得自行追加 ChatGPT DOM selector 规则，也不得用 assistant 数量决定轮次数；命中 anchor 后允许基于目标位置偏移做短生命周期 re-align，以抵消 host hydration/layout shift，但用户主动 wheel/pointer/touch/keyboard 导航必须中止后续校准；工具栏书签保存/高亮先解析 payload 绝对轮次，再复用现有书签身份。 |

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
| Toggle panel via extension icon | Background action click → `ping` → `ui:toggle_toolbar`; content startup → `content:ready` | `src/runtimes/background/entry.ts`, `src/runtimes/content/entry.ts`, `src/ui/content/bookmarks/BookmarksPanel.ts` | `tests/unit/runtimes/background/entry.changelogNotice.test.ts`, `tests/unit/runtimes/content/entry.test.ts` | 在支持书签面板的平台页面点击扩展图标可打开/关闭面板；长时间休眠或 tab 恢复后的失效消息不产生 unchecked runtime error。 |
| List/search/sort/filter bookmarks | Panel controls → view model | `src/ui/content/bookmarks/BookmarksPanel.ts`, `src/ui/content/bookmarks/BookmarksPanelController.ts`, `src/services/bookmarks/panelModel.ts` | `tests/unit/services/bookmarks/panelModel.test.ts` | 面板内可搜索、排序，列表可读且不污染宿主样式。 |
| Folder tree + CRUD | Panel buttons → `bookmarks:folders:*` | `src/ui/content/bookmarks/BookmarksPanel.ts`, `src/ui/content/bookmarks/BookmarksPanelController.ts` | manual | 文件夹可创建/重命名/移动/删除（删除需要空文件夹约束）。 |
| Preview (reuse ReaderPanel) | Click bookmark row → `ReaderPanel.show(items, startIndex, theme, { profile: 'bookmark-preview' })` | `src/ui/content/bookmarks/ui/tabs/BookmarksTabView.ts`, `src/ui/content/reader/ReaderPanel.ts` | manual | 分页范围沿用 legacy：有搜索词→按树顺序翻“全部可见书签”；无搜索词→仅在该 folder 内翻页。 |
| Row actions: Go / Copy / Delete | Panel row buttons → background intents | `src/ui/content/bookmarks/BookmarksPanelController.ts`, `src/drivers/content/bookmarks/navigation.ts`, `src/ui/content/chatgptDirectory/navigation.ts` | `tests/unit/ui/bookmarks/bookmarksPanelController.test.ts` | Go 能定位当前页 position（最佳努力重试）；ChatGPT 使用同页 skeleton/container anchor helper，其他平台继续使用共享 bookmark navigation；Copy/删除可用。 |
| Batch ops (delete/move/export) | Selection → bulk handlers | `src/contracts/protocol.ts`, `src/runtimes/background/handlers/bookmarks.ts`, `src/ui/content/bookmarks/BookmarksPanel.ts` | `tests/unit/runtimes/background/bookmarks-handler.test.ts` | 批量删除/移动/导出一次落盘（非循环 sendMessage）。 |
| Import/Export/Repair | Panel buttons → handler | `src/ui/content/bookmarks/BookmarksPanel.ts`, `src/runtimes/background/handlers/bookmarks.ts` | `tests/unit/core/bookmarks/stress.test.ts` | 导入 3000 级别 fixture 仍可用；repair 会 quarantine 再移除。 |
| Info tabs | Bookmarks panel tabs → Changelog / FAQ / About / Buy Me Coffee / Feedback | `src/ui/content/bookmarks/BookmarksPanel.ts`, `src/ui/content/bookmarks/ui/tabs/FeedbackTabView.ts`, `src/ui/content/bookmarks/ui/tabs/AboutTabView.ts`, `src/ui/content/bookmarks/ui/tabs/SponsorTabView.ts` | `tests/unit/ui/bookmarks/bookmarksPanel.test.ts`, `tests/unit/ui/bookmarks/bookmarksPanel.safariSurface.test.ts`, `tests/unit/ui/bookmarks/sponsorTabView.test.ts` | Feedback 是底部反馈入口 tab，三端保留，并集中承载反馈邮箱与官网入口；Chrome/Firefox 保留 About 的小红书入口与 Buy Me Coffee tab；Safari App Store target 按 build-time policy 移除 sponsor tab、付款二维码资源、赞助文案资源与 About 的小红书关注卡。About 只保留作者与项目背景。 |
| Google Drive backup | Settings → Data Management → Google Drive Backup (Experimental) | `config/extension/cloudBackup.ts`, `src/ui/content/bookmarks/ui/cloudBackup/CloudBackupSettingsPanel.ts`, `src/drivers/shared/clients/cloudBackupClient.ts`, `src/runtimes/background/handlers/cloudBackup.ts`, `src/drivers/background/cloudBackup/googleDriveProvider.ts` | `tests/unit/governance/manifest-generation.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts`, `tests/unit/runtimes/background/cloudBackup-handler.test.ts`, `tests/unit/drivers/background/googleDriveProvider.test.ts` | v1 只备份书签；Chromium 构建以 manifest `oauth2` 作为 `getAuthToken` 的 OAuth SSOT，按能力先用浏览器托管身份缓存，失败后再用 Web application OAuth client + `identity.getRedirectURL()` 走 `identity.launchWebAuthFlow`；Firefox 使用同一 WebAuth fallback；Safari 仍隐藏；连接前先显示简短确认，用户确认后才启动 Google 授权；上传不可变 snapshot 到用户 Google Drive 的 `AI-MarkDone/Backups/bookmarks`，上传后回读校验；恢复入口先预览共享导入合并详情页，用户确认后只新增远端独有书签；齿轮面板只显示当前账号、测试连接、极简隐私说明和云端备份管理，用户可见删除会把备份文件移入 Drive 回收站。 |
| Toolbar quick toggle (per message) | MessageToolbar `Bookmark` → `bookmarks:positions/save/remove` | `src/ui/content/controllers/MessageToolbarOrchestrator.ts`, `src/ui/content/MessageToolbar.ts`, `src/ui/content/chatgptDirectory/navigation.ts` | `tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts` | 每条消息可一键保存/取消，并反映已保存状态（Bookmarked）；ChatGPT 会用 skeleton/container 轮次解析避免动态加载窗口内的局部 position 污染书签状态。 |

---

### B.5 Settings Core（storage.sync; legacy key `app_settings`; no UI）

说明：Settings Core（通用逻辑 + background write authority + sync 存储）仍是权威写入边界；当前用户入口位于 BookmarksPanel 的 Settings tab。

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Read all settings (normalized) | `settings:getAll` | `src/core/settings/*`, `src/services/settings/settingsService.ts`, `src/runtimes/background/handlers/settings.ts` | `tests/unit/core/settings/migrations.test.ts`, `tests/unit/runtimes/background/settings-handler.test.ts` | 老用户升级后 `app_settings` 不丢；新字段 merge defaults。 |
| Set settings category | `settings:setCategory` | `src/services/settings/settingsService.ts`, `src/drivers/background/storage/syncStoragePort.ts` | unit tests | Service 只做 plan；background 统一落盘。 |
| Formula preferences | Settings tab `Formula` → Markdown click-copy toggle + PNG/SVG/MathML action popup; Settings tab `Platforms` → per-platform formula copy toggles | `src/core/settings/formula.ts`, `src/core/settings/types.ts`, `src/services/settings/settingsService.ts`, `src/ui/content/bookmarks/ui/tabs/SettingsTabView.ts`, `src/ui/content/controllers/FormulaAssetHoverController.ts`, `src/runtimes/content/formulaOnlyRuntime.ts`, `src/runtimes/content/entry.ts` | `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/core/settings/migrations.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts`, `tests/unit/runtimes/content/formulaOnlyRuntime.test.ts`, `tests/unit/ui/content/FormulaAssetHoverController.test.ts`, `tests/unit/runtimes/content/entry.test.ts` | 公式设置由 `formula` category 持久化；平台开关由 `platforms` category 持久化。`platforms.chatgpt` 控制 ChatGPT 完整 runtime；`platforms.gemini` / `platforms.claude` / `platforms.deepseek` 控制对应平台的页面公式交互能力。Gemini、Claude、DeepSeek 不恢复 Reader、消息 toolbar、发送、整条消息复制/导出等完整平台适配，但允许 formula runtime 复用全局书签管理面板作为扩展图标入口，用于查看/管理既有书签数据和设置；该面板复用不改变这些平台的页面能力边界。旧 `behavior.enableClickToCopy` 只作为迁移/兼容输入；v4 默认关闭全部公式图片/资产 hover 动作；已存 `formula.assetActions` 的用户选择必须保留；关闭 Markdown 点击复制不得关闭仍启用的图片动作；关闭全部图片动作不得影响 Markdown 点击复制。 |
| Export preferences | Settings tab `Export` → preset + width + image scale | `src/core/settings/export.ts`, `src/services/settings/settingsService.ts`, `src/ui/content/bookmarks/ui/tabs/SettingsTabView.ts`, `src/runtimes/content/entry.ts` | `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts`, `tests/unit/runtimes/background/settings-handler.test.ts` | PNG 导出宽度与图片倍率由全局 settings 真相持有；宽度支持 mobile / tablet / desktop / custom；图片倍率支持 1x–3x 并在渲染时受浏览器 Canvas 上限保护。 |
| ChatGPT settings | Settings tab `ChatGPT Settings` → restore-position toggle + stepper toggle + arrow-key navigation + directory controls | `src/core/settings/types.ts`, `src/services/settings/settingsService.ts`, `src/ui/content/bookmarks/ui/tabs/SettingsTabView.ts`, `src/runtimes/content/entry.ts` | `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/runtimes/background/settings-handler.test.ts`, `tests/unit/runtimes/content/entry.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts` | `chatgptBehavior.restorePositionAfterSend` 默认开启，并只控制 ChatGPT 发送后恢复阅读位置；`chatgptBehavior.showMessageStepper` 默认开启，并只控制右下角 Previous/Next 按钮显示；`chatgptBehavior.enableArrowKeyMessageNavigation` 默认开启，并只控制 Left/Right 键切换消息。`chatgptDirectory.enabled` 默认关闭；Settings 提供目录条开关、preview/expanded 显示方式、prompt label 模式；目录条开关说明会明示开启后同步隐藏 ChatGPT 官方对话导航，不再提供单独隐藏开关。 |
| Appearance preferences | Settings `Advanced Settings` → Global font size stepper + theme color swatches | `src/core/settings/types.ts`, `src/core/settings/migrations.ts`, `src/style/system-tokens.ts`, `src/runtimes/content/entry.ts`, `src/ui/content/bookmarks/ui/tabs/SettingsTabView.ts` | `tests/unit/services/settings/settingsService.test.ts`, `tests/unit/core/settings/migrations.test.ts`, `tests/unit/style/tokens.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts`, `tests/unit/runtimes/content/entry.test.ts` | `appearance.fontSizePx` 是全局界面字号真相，默认 16px，只允许通过 12–20px 的加减 stepper 调整；`appearance.accentColor` 只能来自 `THEME_ACCENT_SWATCHES` 预设色块，默认 `null` 表示品牌蓝；运行时只映射到 `UserThemeOverrides.baseFontScale` / `UserThemeOverrides.accentColor` 并通过 token 注入刷新 surface，组件不得直接解析该设置。 |
| Advanced settings surface | Settings tab footer → collapsible advanced section | `src/ui/content/bookmarks/ui/tabs/SettingsTabView.ts`, `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts` | `tests/unit/ui/bookmarks/settingsTabView.test.ts` | 高级设置默认收起，只承载少量低频调参项；展开状态不持久化，实际设置值仍写入对应 settings category，不新增 `advanced` 顶层配置域。 |
| Data Management surface | Settings tab → Data Management | `src/ui/content/bookmarks/ui/tabs/SettingsTabView.ts`, `src/ui/content/bookmarks/ui/cloudBackup/CloudBackupSettingsPanel.ts` | `tests/unit/ui/bookmarks/settingsTabView.test.ts` | 分为 Google Drive Backup (Experimental) 与 Local Backup 两张卡片；Google Drive Backup 只在当前浏览器具备可用认证策略时显示云端书签备份/恢复入口，Local Backup 保留本地 storage usage 与全部导出；云端副作用必须经 runtime protocol，不允许 UI 直连 provider。 |
| Reset to defaults | `settings:reset` | 同上 | unit tests | reset 后可再次读取并得到 defaults。 |
| Content-side cache + subscribe | `SettingsClient.subscribe()` | `src/drivers/content/settings/settingsClient.ts` | (covered by unit tests + TypeScript) | storage.onChanged 触发后可 best-effort 刷新缓存。 |

---

### B.6 Save Messages Export Core（Markdown + PDF + PNG; no UI entry yet）

说明：本阶段交付 **导出核心能力**（采集/构建/副作用 drivers + 门禁测试）。为便于端到端回归，目前已提供一个“低耦合的 UI 入口”：

- MessageToolbar 打开 ReaderPanel 后，在 ReaderPanel footer 的 custom actions 中提供 `Export MD / Export PDF / Export PNG`（导出当前页对应消息）。

| Capability | Entry / API | Key files | Tests | Acceptance |
|---|---|---|---|---|
| Save Messages source | `SaveMessagesDialog -> fresh readerContentSource -> ReaderItem[] -> ChatTurn[]` | `src/services/reader/readerContentSource.ts`, `src/ui/content/export/SaveMessagesDialog.ts` | `tests/unit/services/reader/readerContentSource.test.ts`, `tests/unit/services/reader/collectReaderItems.test.ts`, `tests/unit/services/reader/collectReaderItems.thinking.test.ts`, `tests/unit/ui/export/saveMessagesDialog.test.ts` | Save Messages 的条目来源与 Reader 完全一致；导出层不自行从 adapter 收集 turns，只消费统一 fresh `ReaderItem[]` source，并用该 source 返回的 `startIndex` 作为默认选中项。 |
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
- 超出 `CAPABILITY_MATRIX.md` 当前支持范围的平台承诺；Gemini、Claude、DeepSeek 当前保留公式复制 runtime

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

- 刷新 / 切换对话 / 连续生成：每条已出现官方 action bar 的 assistant 消息最终出现工具栏（不重复、不漂移）；ChatGPT 官网中 action row 后 hydrate 时应局部推进对应消息状态，而不是常规触发整页补扫
- Copy Markdown：复制当前消息内容
- Reader：打开/翻页/复制，关闭无残留
- LaTeX click：可用且不影响用户选择/复制公式文本（selection guard 生效）
