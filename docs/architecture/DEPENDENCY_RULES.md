# Dependency Rules

本文件定义当前仓库应遵守的依赖方向与边界，用于把“分层”变成可执行约束，并为后续 lint/CI 门禁提供依据。

## 0. Active ChatGPT content boundary

ChatGPT production content has one composition root, one accumulated pool, and
one PageIndex-owned mounted-message seam:

```text
Official action row + ChatGPT DOM -> one PageIndex -> DOM-local current actions
                         |
                         +-> Host Monitor -> ConversationContentRepository
                                                  |
                                                  +-> Content Port
                                                  +-> Conversation Surface
                                                        -> Directory / Stepper /
                                                           Navigation / multi-message Reader

Canonical identity + existing bookmark contract -> bookmark availability
Mounted formula DOM + parser Adapter -> Formula Copy / PNG / SVG / MathML
```

- `ConversationContentRepository` is the only accumulated ChatGPT content owner. It stores tab-local bodies keyed by stable `assistantMessageId` and a private ordered skeleton keyed by outer `data-turn-id-container`. A complete observed slot sequence may only retain or contiguously extend the skeleton; subwindows cannot shrink it and conflicts cannot reorder it. Bodies bind to their containing `hostSlotId`; empty slots are not public V1 turns and do not change `contentToken`. UUIDs and mutable `conversation-turn-N` values are never sorted as ordinals. Equal bodies are no-ops, changed bodies update in place, and unmount never deletes accepted slots or content.
- `ChatGPTConversationSurface` is the accumulated pool↔PageIndex join for Directory, Stepper, navigation and multi-message consumers. Toolbar placement and current-message actions may consume its PageIndex-derived mounted facts, but Repository `obtained` is not an admission gate. No consumer may create a second observer or accumulated pool.
- Current-message word count, whole-message copy, Reader/export fallback, local selection and annotation read only the owning mounted DOM on explicit action. `readerContentSource` remains the sole multi-message Reader projection. Formula actions resolve directly from formula DOM and parser Adapter. Bookmark submission still requires canonical conversation identity and a proven pool position.
- Ordinary consumer actions read the current published cache through that projection. `refresh()` is a local DOM flush compatibility seam; it cannot issue a request or discover unloaded history. `pageshow`, `resume`, and visible restoration may request one coalesced current-DOM rescan. There is no baseline API, upgrade probe, Settings Retry, polling loop, or hidden network acquisition.
- The former `ChatGPTConversationDiscoveryCoordinator`, `ChatGPTConversationIndex`, and standalone `ChatGPTConversationMaterialization` modules are retired and deleted. Runtime owns lifecycle ordering, Repository owns obtained content/order, PageIndex owns host facts, and Conversation Surface owns the sole Content↔DOM join. A compatibility `ConversationMaterializationPortV1` may only be projected from that same Frame; no consumer may recreate one of the deleted layers.
- `RenderedContentCompilerV2` is used only behind `ChatGPTConversationHostMonitor`. It performs one clone-normalize-convert pass per eligible root and retains basic size/time budgets; it must not pre-scan formula/code trees or run a second whole-body semantic comparison.
- ChatGPT discovery must not read Cookie/Storage/Token/Authorization data, inspect network responses, construct conversation requests, use React internals, or poll content. The explicit `?message=` full-history controller may use the adapter-owned scroll root during one bounded, cancellable materialization sweep; user-facing `locate()` may still use its bounded seek. Neither path creates a second observer, source, or permanent auto-scroll.

Consumer-path performance rules:

- `ChatGPTPageSelectionCoordinator` is the only ordinary ChatGPT page selection owner. Atomic Selection and Page Annotation must consume its frame and must not register another `document.selectionchange` listener, selection rAF, settle timer, or direct `captureSelection()` path. Reader is a separate Reader-document surface and may own its own visual rAF; it must not cause page annotations or persistent anchors to re-resolve.
- `ContentSurfaceAdapter.locateSelection()` is the drag-time operation. It may validate an existing Range and typed message/root identity only; it must not stringify ranges, scan formula descendants or compile Markdown. `materializeSelection()` is an explicit-action operation behind `PageMarkdownSelectionResolver`; the resolver may prefer canonical `SurfaceProjection` and otherwise compile only the still-connected owning message DOM. It may cache one result per selection revision but cannot discover or retain multiple messages.
- `ChatGptToolbarFrameIndex` and `ChatGPTActivePositionTracker` are frame-local derived indexes. They may memoize typed turn/position/geometry references and publish only changed navigation state, but they must not become an SSOT, issue discovery work, read message bodies, or call `resolveElement`/`readTurn` once per record after a frame has already supplied the mapping.
- Reader rendering must keep persistent annotation anchors/highlights separate from transient selection actions. A selection visual pass may diff atomic IDs and action state, but it must not rebuild persistent markers, re-anchor existing records, compile Markdown, or recursively export content. Page annotation markers must read geometry before writing and patch only changed root-local keyed records.
- Formula and composer consumers must use bounded event delegation/shared binding sources. No consumer may add a formula subtree scan, per-formula listener, formula MutationObserver, duplicate composer observer, polling timer, or new content observer to compensate for a rendering update. Lifecycle disable/dispose must release listeners, rAFs, overlays, tooltip delegates, and detached DOM/Range references.

---

## 1. Runtime Boundary Rules

### Content runtime

- 入口位于 `src/runtimes/content/*`
- 允许依赖：
  - `src/ui/*`
  - `src/services/*`
  - `src/drivers/content/*`
  - `src/drivers/shared/*`
  - `src/contracts/*`
  - `src/core/*`
  - `src/style/*`
- 禁止直接依赖 background-only storage implementation
- manifest 启动入口 `entry.ts` / `formulaOnlyRuntime.ts` 只能依赖重型 surface 的 port、controller 与 lazy factory；不得静态导入 `ReaderPanel`、`BookmarksPanel`、Save/Bookmark dialogs 或 Copy PNG 实现
- `contentFeatures.ts` 是唯一重型 content feature module facade；它的公开方法必须按功能分别动态导入实现，不得重新变成一次触发即加载全部 surface 的静态聚合入口
- lazy loader 只能通过 `browser.runtime.getURL()` + `config/extension/assets.ts` 中的固定 entry 名称加载扩展自身模块；不得拼接宿主 URL、读取页面提供的模块地址或执行任意脚本文本

### Background runtime

- 入口位于 `src/runtimes/background/*`
- 允许依赖：
  - `src/services/*`
  - `src/drivers/background/*`
  - `src/drivers/shared/*`
  - `src/contracts/*`
  - `src/core/*`
- 禁止依赖 `src/ui/*`

### Image export boundaries

- 消息 PNG 的语义与样式入口位于 `src/services/export/messageExportDocument.ts` 和 `src/services/export/messageCardProfile.ts`；content-side 栅格化入口仅为 `src/drivers/content/export/renderPng.ts`
- 消息 service 只提交 `ExportDocumentV1` 与 options，不得提交 HTML/CSS/renderer function；driver 只消费 profile 生成的闭合 DOM，不得读取或复制宿主计算样式
- 消息栅格化 driver 可以依赖本地 `html-to-image` 和纯预算/取消逻辑；禁止访问网络、读取 settings/storage、拥有 clipboard/download 或依赖 UI shell
- authoritative TeX 公式资产入口位于 `src/runtimes/export-renderer/*`，由按需 extension-origin `export-renderer.html` iframe 承载；只允许依赖版本化私有协议、纯公式 capability 与本地 MathJax
- 公式 renderer 禁止读取 settings/storage、访问网络、调用 clipboard/download/background runtime messaging 或依赖 UI shell；无法跨 iframe 传递 Element 的 `dom-only` 公式 PNG 只允许使用现有唯一 content-side compatibility adapter
- 消息 profile/content renderer 与公式 host 必须保持动态拆包：消息动作不得加载公式 MathJax capability，公式动作不得加载 Markdown/highlight capability
- 只有 `export-renderer.html` 可作为 host-facing web-accessible resource；formula entry/capability chunks 只能从 extension origin 内部解析

---

## 2. Logical Layer Rules

- UI → Service → Driver 是默认依赖方向
- Driver 禁止反向依赖 Service 或 UI
- `src/core/*` 应尽量保持纯逻辑，可被 service、driver、runtime 复用

### Service categories

当前仓库中的 `src/services/*` 统一分为两类：

- `pure/domain service`
  - 纯逻辑、数据转换、规则编排
  - 不允许依赖 DOM API、browser globals、host selector、UI shell/component
- `content-facing feature service`
  - 允许处理 DOM clone、parser node、HTML fragment、content fragment
  - 仍不允许依赖 host selector、runtime wiring、adapter registry、UI shell/component

当前典型归类：

- `pure/domain service`
  - `src/services/settings/*`
  - `src/services/bookmarks/*`
  - `src/services/cloudBackup/*`
  - `src/services/semantic-content/SemanticContent.ts`
- `content-facing feature service`
  - `src/services/copy/*`
  - `src/services/reader/*`
  - `src/services/markdown-parser/*`
  - `src/services/export/*`
  - `src/services/sending/*`

---

## 3. Contract Placement Rules

所有 content ↔ background 的协议常量、类型、错误码、request/response shape 必须收敛在单点契约模块：

- `src/contracts/protocol.ts`

平台契约与存储契约分别位于：

- `src/contracts/platform.ts`
- `src/contracts/storage.ts`

Content ↔ export renderer 的私有协议不经过 background runtime message，必须单点定义在：

- `src/services/export/exportRenderHostProtocol.ts`

Semantic ChatGPT content contracts are separate from runtime protocol contracts:

- `src/contracts/conversationContent.ts` owns the provider-neutral `ConversationContentSourceV1`, document/turn identity, immutable snapshot, and state union.
- `src/contracts/conversationMaterialization.ts` owns the content-runtime-only DOM target and materialization port.
- `src/contracts/conversationSurface.ts` owns the content-runtime-only atomic Frame that joins obtained turns with current mounted or pending surfaces.
- `src/contracts/semanticContent.ts` owns the provider-neutral Semantic Content Module interface, project-owned immutable node model, source spans, selectors, provenance, diagnostics, and projection outcomes.
- `src/contracts/contentSurface.ts` owns platform-neutral rendered-surface evidence. It must not expose DOM nodes, Range coordinates, selectors, or parser-library types.

ChatGPT route token parsing, selectors, typed identity, official action/stop lifecycle facts and rendered semantic carriers remain inside `src/drivers/content/chatgpt/*`. `ChatGPTConversationContentRuntime` is the sole lifecycle owner for initial synchronization, PageIndex facts, History `pushState`/`replaceState`, `popstate`, `hashchange`, `pageshow`, document `resume`, and visible restoration; wake signals share one private bounded reconciliation. The content chain must not introduce a page bridge, polling RouteWatcher, active network acquisition, or second observer. Reader/Directory/Copy/Export/Bookmark/Annotation consumers may import the semantic contract or a downstream projection, but may not import driver internals. Surface/materialization may expose `HTMLElement` only inside content runtime; it must never cross background or extension-page boundaries.

Conversation content-discovery rules:

- `src/services/content/ConversationContentRepository.ts` owns page identity promotion, active conversation switching, tab-local `Map<conversationKey, ConversationPool>`, immutable snapshots, `projectionId`, `contentToken`, and `ConversationTurnReadPortV1`; it must not import DOM, browser globals, provider selectors, or UI, and it must not store DOM nodes.
- `src/contracts/conversationContent.ts` exposes only read/subscribe/local-refresh/current-token consumer semantics. Public contracts and UI consumers must not expose or call generic acquisition/reconcile APIs.
+ `ChatGPTConversationHostMonitor` owns the official-action readiness check and one page-level debounce. It may require only assistant message ID, nonempty assistant body, connected official action row, and non-streaming state. User prompt lookup is best-effort; missing prompt and assistant-only mounting are admissible. An explicit `?message=` sweep reuses this monitor to materialize the persistent slot skeleton without adding another observer.
- Every Runtime begins with a non-persisted page identity. Page→canonical promotion preserves pool, projection and token. Canonical A→B selects a distinct pool; A→B→A restores A. Full page reload/dispose destroys every pool. Virtualized unmounts affect only Surface and never delete obtained content.
+ `ConversationSnapshotV1.coverage` remains `complete` for admitted bodies; ordinary DOM-only snapshots report `historyStatus: partial` and `proof.basis: host`. After the explicit `?message=` sweep proves the official navigation count and all assistant bodies, the same snapshot may report `historyStatus: complete`; new topology returns it to partial. Current-message and selection actions may compile only their mounted owning DOM; multi-message consumers must use the Repository snapshot and cannot rebuild an independent pool.
- Content, materialization, and surface revisions must remain separate. No consumer may add a second content observer/cache. Formula actions are the explicit exception to Repository sourcing: they read the clicked/hovered formula DOM directly through the parser Adapter.
- ChatGPT message-bookmark highlighting and toolbar state must use the read-only `conversationBookmarkResolver` over canonical turn identities. Without a canonical conversation ID and URL, bookmark preparation is unavailable and no save/remove request or incomplete record may be created; all other content consumers remain available from the page-scoped pool. Identity promotion re-enables the existing path without changing bookmark types, protocol, storage fields, migrations, old records or import/export payloads. Persisted assistant `messageId` remains authoritative; stored `position` is validated and is only a compatibility fallback when identity is absent from the canonical source. Identity/position conflicts fail closed.
- The same resolver owns ChatGPT bookmark state in the Directory, message toolbar and Reader footer. When a ChatGPT `ConversationContentSourceV1` is injected, a missing source snapshot or an unloaded message-bookmark projection must return no active position; `isPositionBookmarked()` is not a fallback for that production path. Position-only compatibility is permitted only when the canonical ChatGPT source seam is absent (legacy/non-ChatGPT composition), never alongside an injected source.

Semantic-content dependency rules:

- `SemanticContent.ts` may depend on `src/contracts/*` and pure parser libraries only. It must not depend on `src/drivers/*`, `src/ui/*`, `src/runtimes/*`, DOM/browser globals, platform IDs, host selectors, clipboard, storage, or renderer implementation types.
- Parser-library AST types are private implementation details. The public Interface must expose only AI-MarkDone-owned immutable types.
- `ContentSurfaceAdapter` lives in `src/drivers/content/*`; it may consume Site Adapter and Materialization contracts, but must not import services or return DOM handles inside `ContentSurfaceSelectionEvidenceV1`.
- `src/services/semantic-content/SurfaceProjection.ts` is the sole service seam that may join `contentSurface` evidence with `conversationContent` source. Other consumers receive its result or a downstream projection; they must not repeat source/surface matching.
- Rendering remains a separate Module. Semantic Content may describe structure and source spans, but it does not own HTML, KaTeX, syntax highlighting, sanitization, export layout, clipboard, or download.

该协议必须版本化，只传语义 job、进度、稳定错误码、artifact metadata 与 transferable `ArrayBuffer` chunk；禁止 base64、大型 JSON 二进制、DOM、HTML/CSS 或 renderer function。

禁止：

- 在 content 与 background 两侧重复定义协议常量
- 通过未版本化的“任意对象”跨 runtime 传递
- 让 UI 或 feature 代码私自定义新的 runtime message shape

---

## 4. Browser And Host Abstraction Rules

- Browser API 抽象优先经过 `src/drivers/shared/browser.ts`
- 站点选择器、主题探测、message root 识别只能位于 `src/drivers/content` 下的平台 adapter/driver
- conversation group discovery、turn root、conversation root、streaming 判定同样只能位于 adapter/driver；UI controller 不得新增宿主专有 selector
- KaTeX / code-heavy subtree 的宿主结构识别与 selector 也只能位于 adapter/driver；UI/controller 只能消费 adapter 暴露的结构化 hints
- 页面 selection 的 message/content-root 识别只能位于 `ContentSurfaceAdapter`；Service 只能消费 typed target、revision tokens 与 TextQuote evidence
- 公式源码识别属于 parser Adapter capability。共享 core 可识别语义化 TeX source attributes/annotations，但 UI/controller 不得自行遍历 KaTeX 视觉子树或把 visual text 提升为 authoritative TeX
- UI 层不得持有平台专有选择器
- Service 层不得按 platform id 分支选择 DOM 行为
- `content-facing feature service` 可消费 adapter 暴露的抽象结果，但不得自行持有平台 selector 或注册 adapter

---

## 5. Side-Effect Ownership

目标：敏感副作用尽量集中在 background，可审计、可恢复、权限最小化。

允许：

- Content/UI 通过协议发起 intent
- Background 执行存储写入、恢复、广播并返回结果
- Background 执行云端备份 provider 副作用，包括 OAuth/identity、Google Drive API 调用、上传后回读校验、provider 错误映射

例外：

- 如果某项副作用必须在 content 侧执行，必须在 `BLUEPRINT.md` 与 `REFACTOR_CHECKLIST.md` 中明确记录原因与边界
- 图片 clipboard 与下载必须留在 content driver，因为它们需要真实用户激活与页面侧交付；export renderer 只能返回 artifact，不得反向执行这些副作用

禁止：

- UI 或 Service 直接 import `src/drivers/background/cloudBackup/*`
- Google Drive Backup 凭据、OAuth token、WebDAV/app password 等进入 `storage.sync`、书签 snapshot 或导出 payload
- Export renderer 读取 storage、联网、写 clipboard/download，或通过 background runtime message 传输大 PNG

---

## 6. Change Rule

当依赖方向或边界发生变化时，必须同步更新：

- `docs/architecture/CURRENT_STATE.md`
- 本文档
- `docs/architecture/BLUEPRINT.md`
