# Dependency Rules

本文件定义当前仓库应遵守的依赖方向与边界，用于把“分层”变成可执行约束，并为后续 lint/CI 门禁提供依据。

## 0. Active ChatGPT content boundary

ChatGPT production content has one composition root and one consumer seam:

```text
Website-owned conversation GET
        -> document_start passive bridge
        -> once-only Baseline Adapter -----------+
                                                  |
ChatGPT DOM -> one PageIndex -> Host Monitor -----+
                         |                        |
                         +-> Materialization      v
                                  ConversationContentRepository
        -> ConversationContentSourceV1
                         ↓
       Reader / Bookmark / Copy / Formula / Directory / Export
                         ↑
              ConversationMaterializationPortV1
              (current DOM anchor only)
```

- `ConversationContentRepository` is the only active ChatGPT semantic content owner. It admits one passive Graph baseline per conversation epoch, then appends only compiler-verified stable host turns to the same immutable cache; consumers must not import provider payloads, ChatGPT selectors, or DOM text to recover a second content path.
- `ConversationMaterializationPortV1` may return only the current typed target, assistant surface and anchor. It may publish a typed pending host target before the message enters the cache, but cannot produce prompts, Markdown, global ordinal positions, or a fallback snapshot.
- `readerContentSource` is the sole ReaderItem projection. Reader, word count, whole-message copy, Bookmark Preparation, formula, local selection, and Save Messages export must receive the same V1 source instance from the composition root.
- Ordinary consumer actions read the current published cache through that projection. `refresh()` is a local flush compatibility seam: it may await work already in flight, but it cannot start baseline admission, issue a request, replay Bridge memory, or reopen a closed baseline gate. `ConversationContentSourceV1` exports no coordinator/acquisition methods; `enterCurrentEpoch()` and `notifyBaselineCaptured()` belong only to the Session's driver-side lifecycle port. A message already in the cache remains consumable; a missing message is pending/unavailable rather than a stale cache state.
- `ChatGPTConversationIndex` is the navigation projection over that same V1 source plus optional mounted anchors. It is not a second content repository.
- `RenderedContentCompilerV2` is the production provider-neutral compiler used only behind `ChatGPTConversationHostMonitor`. The retired discovery repositories, ledgers and virtual host adapters are not part of the production graph; retained V2 contracts are used only by surface/materialization compatibility paths.
- ChatGPT discovery must not read Cookie/Storage/Token/Authorization data, construct POST/SSE or conversation GET requests, use React internals, synthesize scroll, or poll content. Only the user-facing bounded `locate()` operation may call the host adapter's one coarse and one precise scroll operation.

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
- `src/contracts/semanticContent.ts` owns the provider-neutral Semantic Content Module interface, project-owned immutable node model, source spans, selectors, provenance, diagnostics, and projection outcomes.
- `src/contracts/contentSurface.ts` owns platform-neutral rendered-surface evidence. It must not expose DOM nodes, Range coordinates, selectors, or parser-library types.

ChatGPT routes, selectors, bridge transport, provider payloads, graph decoding, once-only baseline policy, typed identity, completion facts and rendered semantic carriers remain inside `src/drivers/content/chatgpt/*` and `public/page-bridges/*`. Reader/Directory/Copy/Export/Bookmark/Annotation consumers may import the semantic contract or a downstream projection, but may not import those driver internals. Materialization may expose `HTMLElement` only inside content runtime; it must never cross background or extension-page boundaries.

Conversation content-discovery rules:

- `src/services/content/ConversationContentRepository.ts` is the page-scoped deep Session. It owns conversation-epoch fencing, the once-only baseline gate, the immutable message cache, append-only host admission, `projectionId`, proof and `ConversationTurnReadPortV1`; it must not import DOM, browser globals, provider selectors, or UI.
- `src/contracts/conversationContent.ts` exposes only read/subscribe/local-refresh/current-token consumer semantics. Baseline lifecycle methods must remain on the concrete Session and a driver-local coordinator type; public contracts and UI consumers must not expose or call generic acquire/reconcile APIs.
- `ChatGPTConversationHostMonitor` owns host stability and predecessor checks while `RenderedContentCompilerV2` accepts cloned semantic surfaces and injected parser capabilities. Selectors, streaming and node lookup stay in the ChatGPT driver; the compiler contains no ChatGPT selectors.
- Baseline and host observation are independent typed inputs to the same Session. A DOM window can create a first `host-born` projection only after the blank-page birth route/facts are established, or append a stable new turn after the baseline. It cannot reconstruct existing history, and it cannot overwrite a message already in the cache. Virtualized unmounts only affect materialization anchors.
- `ConversationSnapshotV1.coverage` is always `complete`; `proof.basis` is diagnostic (`source | hybrid | host-born`) and does not gate consumers. Compiler-verified `host-rendered/normalized` turns are canonical inputs for Reader, word count, whole-message copy, bookmark, export, and uniquely proven local Markdown selection. Surface selection still requires `SurfaceProjection` token/identity/TextQuote proof; reconstructed content and provider-exact persistent annotation claims remain rejected. Consumers needing one mounted message use `readTurn()` instead of rebuilding Markdown from DOM.
- Source, host, materialization, and surface revisions must remain separate. No consumer may reuse a revision as another layer's cache key or add a second content observer/fallback.
- ChatGPT message-bookmark highlighting and toolbar state must use the read-only `conversationBookmarkResolver` over the canonical turn identities. Persisted assistant `messageId` is authoritative; stored `position` is validated and is only a compatibility fallback when the identity is absent from the canonical source. Identity/position conflicts fail closed. This resolver must not write bookmarks, migrate old records, alter storage keys, or change import/export payloads.
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
