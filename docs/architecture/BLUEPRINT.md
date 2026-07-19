# Architecture Blueprint (To-Be)

本文定义 AI-MarkDone 的目标架构蓝图，用于指导当前主线代码的持续演进。蓝图的目标不是复刻旧实现，而是把边界做成可执行的契约，并让模块能并行演进、互不干扰，且更符合 MV3 的可审计/可恢复要求。

重写总纲见：

- `docs/rewrite/PROGRAM.md`
- `docs/rewrite/FEATURE_PARITY.md`

---

## 1. 核心原则（以 MV3 哲学为基准）

- 最小权限：敏感能力（存储写入、网络、跨 tab 广播）集中在可审计的边界
- 组件隔离：content / background / extension pages 通过明确协议协作
- 可恢复：MV3 service worker 可被回收，关键状态必须可恢复，操作应幂等
- 契约优先：接口/协议是协作面，禁止跨层互相 import 具体实现

---

## 2. 总体框架（二维结构）

扩展天然存在“运行时组件边界”，同时我们需要“逻辑分层”。建议采用二维框架：

### 2.1 运行时组件（Runtime Components）

- Page Side（Content Script）：负责页面 DOM 交互与 UI 注入
- Background Side（Service Worker / background script）：负责副作用能力中心
- Extension Pages（unsupported popup / Detached Reader）：承载宿主外的用户界面；设置继续由 Bookmarks Settings surface 持有
- Image Export：消息图片由 content-side 闭合 profile 与分段栅格化 driver 负责；authoritative TeX 公式资产由按需 extension page iframe 负责；两者都不持有交付副作用

### 2.1.1 前后端分离定义（Extension Frontend vs Backend）

为避免“浏览器扩展只有前端”的误区，这里给出项目内的明确术语约定：

- **扩展前端（Frontend）**：Content Script + 页面内 UI（Shadow DOM/overlay）+ Extension Pages + 隔离的 Export Renderer
  - 负责：与页面交互、采集数据、呈现 UI、收集用户意图
  - 禁止：成为敏感副作用的权威执行者（例如任意写存储/任意网络/跨 tab 广播）
- **扩展后端（Backend）**：Background（Chrome MV3 service worker / Firefox MV2 background）
  - 负责：作为“能力中心（capabilities hub）”执行敏感副作用，并提供可审计的统一入口
  - 特别强调：MV3 service worker 可被回收，后端逻辑必须事件化、可恢复、可重放/幂等

### 2.2 逻辑三层（3-Layer Logical Architecture）

把“层数减少”落到可执行边界：

1) **UI 层**
   - 只负责：渲染、交互状态、事件绑定、把用户意图发给 Service
2) **Service 层（用例编排）**
   - 分为：
     - `pure/domain service`：统一操作逻辑（跨站一致），不触碰 DOM/存储写入细节
     - `content-facing feature service`：允许处理 DOM clone、parser node、content fragment，但不得直接持有 host selector、runtime wiring、UI shell
3) **Driver 层（适配/基础设施）**
   - 只负责：站点适配、DOM 采集与注入、Browser API、存储/网络/权限等基础设施

补充：Driver 并非“只存在于 content”，而是跨 runtime 的基础设施层：

- Content runtime 的 driver：adapters/observers/injectors/datasource
- Background runtime 的 driver：storage/network/tab routing/permissions（capabilities）

关键点：三层是“依赖规则”，不是“目录名字”。同一 runtime 内可同时存在 UI/Service/Driver，但依赖方向必须单向可审计。

---

## 2.3 闭环链路（Self-Contained Closed Loops）

“自闭环”的标准：每条用户可见能力都能在**清晰边界**内完成输入、执行、持久化、恢复与回归验证；并且任何站点差异只影响 driver，不影响 service 与 UI。

### 2.3.1 扩展启动闭环（Boot）

1. Content 入口启动（Page runtime）：选择 adapter → 读取 settings → 注入 UI → 绑定 observers
2. Background 启动（Background runtime）：host gating/action 状态更新 → 接收 content intent → 执行副作用
3. 两端通过 protocol handshake（version/ping）确认“协议可用”

### 2.3.2 Reader 闭环（预览/复制/发送）

1. Driver（adapter/datasource）采集 `ReaderItem[]`（live page / bookmarks 等来源）；ChatGPT live page 只允许 `ChatGPTConversationEngine` 的 verified conversation graph snapshot 作为 canonical semantic source，DOM 不能补齐或降级正文
2. Service 进行编排：解析/渲染策略、缓存、错误回退、性能节流
3. UI 只负责呈现与交互（分页/复制/打开浮层/触发发送）
4. 副作用（写书签、写设置、网络等）通过 Background 执行并返回结果

Detached Reader 是 Reader 闭环的跨 runtime 形态，而不是第三套 Reader：

1. ChatGPT content runtime 仍通过既有 `readerContentSource` 生成 fresh `ReaderItem[]`
2. Background 只持有 `sessionId + sourceTabId + readerTabId` 路由与可恢复快照，不理解 ChatGPT 正文结构
3. Extension page 复用 ReaderPanel、Reader settings surface、Markdown rendering、bookmark、copy/comment/Sticky/prompt 与 conversation Reader action service；发送弹框必须复用同一个 tokenized SendPopover，通过完整 SendPort contract 在 content adapter 与 detached reader-session bridge 之间切换：draft 读写走 `readerSession:draft`，发送前准备走 `readerSession:beforeSend`，真实提交走 `readerSession:send`，不得退回 `window.prompt` 或一次性原生弹框
4. Reader header refresh 必须复用同一条 fresh Reader source：官网内 Reader 直接刷新，detached Reader 通过 `readerSession:refresh` 回源 content runtime 刷新；draft/beforeSend/send/locate 同样继续回源执行，不能在 extension page 直接操作 ChatGPT DOM；detached send 会在转发前 best-effort 激活源 ChatGPT tab 后调用官方 composer 发送链路，detached locate 必须激活源 ChatGPT tab 并定位目标消息，但不得关闭 detached Reader tab
5. 首次打开的实验性说明属于用户意图确认边界，必须复用现有 modal/notice family，不新增孤立提示框组件
6. Reader 专属配置由 Reader 内 settings dialog 拥有；Settings 页面不再承载 Reader rendering、Reader typography、Reader prompt/template 或 Reader presentation 控件
7. Reader panel resize 只保存相对于 viewport 的比例，viewport 变化后由 Reader surface 自己重算并 clamp；调用方不得传入 CSS 或绝对几何值覆盖 shared Reader
8. Reader visual assets 由 Reader surface 自己持有：Markdown/KaTeX layout CSS 注入 Reader Shadow DOM，KaTeX `@font-face` 在 document 层注册；detached extension page 不得依赖 ChatGPT 宿主页面已有的公式字体或样式

### 2.3.3 Bookmarks 闭环（保存/导入导出/恢复）

1. UI 收集意图（保存/删除/移动/导入/导出/批量操作）
2. Service 进行校验与拆分（幂等 key、判重策略、错误分类）
3. Driver 执行写入与监听（优先 Background 作为 write authority）
4. UI 仅消费“状态快照/事件”刷新（避免 UI 直写 storage）

### 2.3.4 Google Drive Backup 闭环（v1）

1. UI 只呈现 Settings → Data Management → Google Drive Backup，并通过 `cloudBackup:*` runtime protocol 提交连接、备份、列表、恢复预览、安全合并恢复等用户意图
2. Service 只编排用例：构建书签 snapshot、校验下载结果、生成恢复计划；不得持有 browser API、OAuth、provider token 或直接读写 extension storage
3. Background driver/provider 作为云端副作用边界：Google Chrome 以 manifest `oauth2` 作为 `chrome.identity.getAuthToken` 的 SSOT；支持 WebAuth 的浏览器环境使用 Web application OAuth client、`identity.getRedirectURL()` 和 `identity.launchWebAuthFlow`；Google Drive API、上传后回读校验、provider 错误映射都收敛在 background 侧
4. 本地书签写入继续复用 bookmarks 的 storage/index 与现有导入导出能力；Google Drive Backup v1 是用户主动触发的不可变 snapshot 备份/恢复，不会实时双向更新
5. 恢复必须先做安全合并预览；用户确认后才允许进入 background storage queue，并写入 pre-restore emergency snapshot
6. Build config 由 `config/extension/cloudBackup.ts` 与 `config/extension/chromeWebStore.ts` 驱动：Chrome/Chromium build 同时包含 Chrome Extension OAuth client ID、manifest `oauth2`、Web OAuth client ID、`identity` 与 Google host permissions；Google Chrome 使用 Chrome Extension client，WebAuth-compatible browser 使用 Web OAuth client；Chrome 默认注入 Chrome Web Store public key 固定 extension ID；Firefox 使用 Web OAuth client ID、`launchWebAuthFlow` 和 `identity.getRedirectURL()` 的实际返回值
7. OAuth client ID 是公开的应用身份，不是共享 Google 账号。Provider 不请求 `identity.email`，不把 refresh token/cookie/account id 写入 extension storage；账号展示只来自 Drive `about.get` 的邮箱、显示名与头像 URL 摘要。浏览器 identity cache 管理长期授权体验；provider 只把短期 access token 缓存在 extension local storage，过期前用于抗 service worker 重启。

### 2.3.5 Image Export 闭环（消息长图 + 公式资产）

1. UI 只保留当前消息 Copy PNG、Save Messages PNG、公式资产三个入口；入口不持有 HTML/CSS/renderer function，也不自行决定 Markdown、KaTeX、highlight 或分片算法。
2. 消息路径从 fresh `ReaderItem[]` 转换为 `ChatTurn[]`，再构建版本化 `ExportDocumentV1`；authoritative TeX 提交结构化 spec。`dom-only` source 不能跨 iframe 传递，因此只允许由 `renderFormulaAsset()` 背后的唯一 content-side compatibility adapter 消费。Markdown 文件导出保持现有 formatter，不因图片重构改变 canonical 内容语义。
3. 消息路径在 content runtime 内由 `message-card-v1` 编译闭合静态 DOM，并进入同一个 `renderPngBlob()`；它不依赖 iframe handshake。authoritative 公式资产才通过 lazy `export-renderer.html` iframe、私有 `MessageChannel` 与 scheduler 执行；启动期不得加载两条路径的重模块。
4. 消息 profile 自持 Markdown、highlight、KaTeX 与静态图片规则，不复制宿主计算样式；content driver 按消息 section 和 Markdown 顶层 block 分段栅格化，公式 renderer 只处理结构化公式 spec。两条路径都不读 storage、不联网。
5. 消息 PNG 优先生成一张长图；最终 Canvas 超过 16,384px 单边或 24,000,000 pixels 的保守预算时自动降低 effective ratio，以稳定产出为先。代码、表格和 display formula 必须在导出宽度内换行或等比收敛，不得以横向滚动区域进入图片。
6. authoritative TeX 的 SVG/PNG/MathML 共享同一 MathJax 语义资产；`dom-only` 只允许兼容 PNG，SVG/MathML 返回 `SOURCE_UNAVAILABLE`。公式 PNG 保持单图，可等比降低到 1x 以下，SVG 保持无损出口。
7. Content driver 继续独占 clipboard 与 download 交付；Chrome 与 Firefox 共用同一消息 profile/content renderer 与公式 host/DOM compatibility adapter，不新增 offscreen document、background renderer、权限、服务端或远程资源代理。

---

## 3. 契约（Contracts）与可审计边界

### 3.1 Runtime Message Protocol（Content ↔ Background）

目标：把 runtime message 从“散落常量/弱类型对象”升级为“版本化协议”。

协议最低要求：

- `v`：协议版本
- `id`：requestId（用于追踪、幂等、日志）
- `type`：消息类型（枚举）
- `payload`：可序列化数据（禁止 DOM/函数/类实例）
- `result`：`ok` + `errorCode` + `data`（统一错误码）

对应权威文档：

- `docs/architecture/DEPENDENCY_RULES.md`（协议文件只能在 contract 层）
- `docs/architecture/RUNTIME_PROTOCOL.md`（当前协议语义与错误模型）
- `src/drivers/content/adapters/base.ts`（适配器源代码契约）
- `docs/architecture/CURRENT_STATE.md`（当前适配器与平台边界）

### 3.2 Site Adapter Contract（站点差异收敛点）

目标：站点差异只能存在于 adapter（driver）实现里，Service 层不感知 DOM 选择器，也不按 platform id 分支选择 parser 实现。

补充约束：

- 页面级入口必须由 AI-MarkDone 自有 surface 承载，不得为入口修改宿主页面 header 的内部 DOM；若未来新增宿主锚点，相关 DOM 差异仍必须收敛在 adapter 契约内
- ChatGPT conversation group discovery、turn root、conversation root、streaming 判定同样属于 adapter/driver 契约的一部分；UI/controller 只能消费已经抽象好的 structural refs，不得在 UI 层按 ChatGPT selector 重新推导轮次、正文或 identity
- `ChatGPTConversationEngine` 是唯一 semantic SSOT；`readerContentSource` 把其 verified graph snapshot 投影成 Reader/Copy/Save Messages/书签正文共用的 `ReaderItem[]`
- `ChatGPTPageIndex` 只按宿主 DOM revision 缓存当前 connected materialization anchors；`ChatGPTConversationIndex` 以 Engine snapshot 的完整顺序为事实，并以 typed identity 连接这些可选 anchors，作为 Directory、Stepper、Reader locate、Bookmark Go 与 pending navigation 的唯一 navigation projection。DOM window replacement 不得改变 canonical count；索引必须忽略 AI-MarkDone 自有节点和 `data-aimd-*` bookkeeping，conversation root 更换或 runtime disable→enable 时必须正确重建、重绑与释放
- ChatGPT 稳定态性能优化所需的重子树结构提示（如 KaTeX / code-heavy subtree refs）同样属于 adapter/driver 契约；UI/controller 只能消费 adapter 返回的结构化 hints，不得自行扩张宿主 selector 集合
- runtime 只允许持有平台无关的生命周期编排器（如 toolbar orchestrator），不得在入口层写平台选择器
- toolbar observer 只能作为事件信号：消息内 mutation 必须定向进入该消息的 incremental reconcile，无关文本必须忽略，只有 message 集合/顺序、route/init、conversation root replacement 或无法归属的官方 action-row 结构变化才能进入 full reconcile；不得在一次 scheduled reconcile 后再做第二次全量 toolbar 遍历
- 同一 content runtime 内的 route-aware controllers 必须共享底层 URL poll/event hub，不得各自创建长期 timer；formula interaction 必须共享 document observer、按 enabled container 过滤 mutation，并让相同 gate 的 settings update 保持幂等
- 当前消息 Reader item cache 只允许在同一消息 revision 内服务多个用户动作；可归属 mutation 精确失效该消息，消息集合/顺序、route 或 dispose 失效整个 cache
- manifest content entry 必须保持轻量 classic startup graph；Reader、Bookmarks、Save/Bookmark dialogs 与 Copy PNG 通过 typed ports 延迟到真实用户动作。动态模块地址只能由 `browser.runtime.getURL()` 从固定 asset contract 生成，功能 facade 必须继续按 surface 分段加载，并与 detached Reader 共用构建图，避免把重型 renderer 重复打包或重新带回页面启动路径

契约位置：

- `src/drivers/content/adapters/base.ts`
- `docs/architecture/CURRENT_STATE.md`

### 3.3 Storage Contract（单一写入路径）

目标：把“写存储”收敛为可审计路径，减少竞态与恢复复杂度。

建议策略（待在重构阶段确认）：

- Background 作为“写入权威（write authority）”
- Content/UI 只提交 intent，不直接写入敏感存储

### 3.4 Export Renderer Contract（Content ↔ Extension Page）

目标：为 authoritative TeX 公式资产提供版本化、可取消、可分块交付的隔离渲染边界，同时避免把二进制塞进 background runtime protocol。消息图片的 SSOT 是 `ExportDocumentV1` 与 `message-card-v1`，但生产栅格化留在 content-side driver，不经过该协议。

- 公式生产调用只允许 `start(jobId, formula-asset)` 与 `cancel(jobId)`；协议中保留的 `message-png` capability 不是当前消息导出主链
- 事件固定为 progress、artifact-start、零基连续 artifact-chunk、artifact-complete、failed；二进制必须用 transferable `ArrayBuffer`
- 同一 artifact 的 metadata、chunk sequence、part number/count 必须严格连续；未知版本、乱序、重叠 completion 或不稳定错误码属于 protocol failure
- Host client 负责队列、生命周期、一次重建重试、取消与 bounded cache；renderer runtime 负责 capability dispatch 与纯渲染，不得反向拥有 clipboard/download/storage/network
- `ExportDocumentV1` 与 `message-card-v1` 是消息图片语义/样式 SSOT；service 不得绕过 profile 传入 HTML、CSS 或自定义 renderer，content driver 只消费 profile 结果
- 公式 source confidence 是资产正确性边界；只有 authoritative TeX 能请求 SVG/MathML，DOM compatibility 不得被扩张为默认公式主链
- 详细可执行门禁见 `docs/testing/IMAGE_EXPORT_GATES.md`

---

## 4. 目标模块边界（按功能域拆分）

重构后希望达到的“模块可替换边界”（不等同于目录）：

- Platform（Site Adapters）：选择器/主题探测/噪声过滤/normalizeDOM
- Reader（Preview/Panel）：仅消费 `ReaderItem[]` 与 Service 提供的数据
- Bookmarks：数据模型/迁移/导入导出/面板 UI（与 Reader 解耦）
- Parse/Render：parser v3 与 renderer 的纯逻辑能力
- Image Export：版本化语义文档、host protocol、message/formula capability、band planner 与 streaming encoder
- Settings：schema、迁移、默认值、cache、与 UI/Service 的边界
- Background Capabilities：storage/network/permissions/tab routing（intent 执行者）

---

## 4.1 当前代码到模块边界的映射

本节把蓝图映射到当前仓库中的可定位模块，避免边界只停留在抽象描述。

### UI 层（渲染、交互与 Surface 编排）

当前主要落点：

- 内容页组件与控制器：`src/ui/content/*`
- ReaderPanel UI：`src/ui/content/reader/ReaderPanel.ts`
- Bookmarks Panel UI：`src/ui/content/bookmarks/*`
- Appearance value/scope：`src/style/appearance.ts`、`src/style/appearanceScope.ts`
- Surface lifecycle：`src/ui/content/components/SurfaceRuntime.ts`
- 通用 overlay lifecycle：`src/ui/content/overlay/*`
- 通用 chrome、motion 与输入样式：`src/ui/content/components/styles/*`
- token 与 ShadowRoot style 注入：`src/style/*`
- Prompt workflow / geometry / rendering：`src/ui/content/prompts/*`
- Reader workflow / view-model / rendering / host adapter：`src/ui/content/reader/ReaderWorkflow.ts`、`ReaderViewModel.ts`、`ReaderRendering.ts`、`ReaderHostAdapter.ts`
- Bookmarks tab / Cloud Backup workflows：`src/ui/content/bookmarks/workflows/*`

Surface profile / motion ownership 规则补充：

- 同一个 named surface 一旦被 2 个以上入口复用，baseline chrome 必须由 surface 自己持有
- 入口只能选择 named `profile`，不能直接传 low-level chrome flags 或自定义 CSS
- `ReaderPanel` 当前就是这条规则的首个正式落点：
  - `profile` 负责 header/footer/action rail
  - Markdown body 视觉继续由 Reader 自己持有的默认正文主题负责
  - baseline chrome 与正文主题都属于 surface-owned contract，而不是 caller-owned override
- Reader 的 fullscreen/panel opening size 与 panel resize 都属于 `ReaderPanel` surface-owned state。调用方只能通过设置或命名 profile 选择语义，不得传 CSS、像素宽度或外部 layout override。Detached Reader extension page 的默认 presentation 是 fullscreen；半屏/panel 模式必须复用同一个 Reader shell 与 motion/focus 合同。
- shared overlay/modal surface 的 enter/exit motion 也必须由 surface 自己持有；caller 不得注入自定义 open/close motion
- `panel-window` family 与 `modal-dialog` family 可以拥有不同的共享 motion contract，但都必须使用 tokenized shared chrome CSS，而不是每个 surface 各自定义 keyframes
- 共享 surface 的 open-focus / restore-focus 也必须由 surface owner 持有并复用共享 lifecycle helper；不得只让 `ModalHost` 独占完整的焦点语义，而让其它 panel family 各自零散实现
- 同一 surface 在首次打开后，外层 shell/backdrop 必须保持 stable ownership；后续异步数据刷新只能更新内部内容区，不能通过重建外层 DOM 重新消费 opening motion
- Detached Reader 的首次实验性提示必须归入既有 modal/notice family，复用 tokenized chrome、focus restore、ESC/outside-click 语义和按钮样式；不能用 `window.confirm`、host page 原生 dialog 或自定义一次性 DOM。

### Service 层（统一用例编排，跨站一致）

当前主要落点：

- Bookmarks use cases：`src/services/bookmarks/*`
- Cloud Backup use cases：`src/services/cloudBackup/*`
- Copy / Reader / Export / Sending：`src/services/copy/*`, `src/services/reader/*`, `src/services/export/*`, `src/services/sending/*`
- Markdown parser / renderer：`src/services/markdown-parser/*`, `src/services/renderer/*`
- Settings use cases：`src/services/settings/*`

补充说明：

- `src/services/settings/*`、`src/services/bookmarks/*` 更接近 `pure/domain service`
- `src/services/cloudBackup/*` 属于 `pure/domain service` 的用例编排层：可复用 core/bookmarks 纯逻辑，但不得依赖 Chrome identity、Google Drive provider、browser storage implementation 或 UI
- `src/services/copy/*`、`src/services/reader/*`、`src/services/export/*`、`src/services/sending/*` 当前更接近 `content-facing feature service`
- `src/services/export/*` 持有 `ExportDocumentV1`、profile、预算/文件名 planner、host client 与交付编排；入口只提交语义数据，不得重新持有页面截图算法或 capability CSS
- `saveMessagesPdf.ts` 属于明确允许的导出例外：service 生成最终文档并消费样式 token

### Driver 层（站点差异与基础设施能力中心）

当前主要落点：

- Site adapters：`src/drivers/content/adapters/*`
- Injection / conversation / clipboard / theme / sending bridges：`src/drivers/content/*`
- ChatGPT 内容发现：`ChatGPTConversationEngine` 持有 canonical semantic snapshot，`ChatGPTPageIndex` 持有 connected anchors，`ChatGPTConversationIndex` 是唯一 navigation projection，`ChatGPTConversationNavigation` 负责 bounded exact-identity materialization；UI 不拥有宿主 selector 或第二套定位算法
- Browser abstraction：`src/drivers/shared/browser.ts`
- Message image export：`src/services/export/messageCardProfile.ts` + `src/drivers/content/export/renderPng.ts`；Formula asset runtime：`src/runtimes/export-renderer/*`；content driver 继续持有 clipboard/download
- Background capabilities：`src/drivers/background/storage/*`, `src/drivers/background/cloudBackup/*`, `src/runtimes/background/handlers/*`
- Google Drive provider 属于 background-only driver；UI/service 只能通过 `src/contracts/protocol.ts` 与 background handler 间接触发

### Contracts（非“层”，是协作面）

当前落点：

- runtime protocol：`src/contracts/protocol.ts`
- platform contract：`src/contracts/platform.ts`
- storage contract：`src/contracts/storage.ts`
- formula export renderer protocol：`src/services/export/exportRenderHostProtocol.ts`（extension page 私有协议，不属于 content ↔ background runtime message）

---

## 5. UI Surface、样式系统与主题（统一管理）

合同：跨站 UI 外观一致、与宿主样式隔离、可主题同步、可审计（禁止硬编码、禁止 `!important`）。

权威规范：

- 设计与样式系统：`docs/design.md`

### 5.1 Appearance Token Runtime

- 内部 `AppearanceSnapshot` 是 appearance 传播的唯一值对象，由 `Theme + UserThemeOverrides` 组成并按值比较。settings 中与外观无关的变化不得触发 token 重写。
- `UserThemeOverrides` 只保留真实产品设置拥有的全局 appearance 值。Reader content width 与 Reader body font size 归 Reader state；未接入产品设置的 density/corner scale 不得继续作为伪全局合同。
- 内部 `AppearanceScope` 统一 page、ShadowRoot、light-DOM portal 三种 scope 的 token 生成、应用、缓存与释放；`getTokenCss()`、`getPageTokenCss()`、`ensureStyle()` 保持为底层兼容实现，不再由每个 controller 自行拼接 scope CSS。
- Reference、System、Public、Family、Private 五类 token 必须有唯一 owner。Reference 只能供 System 消费；Public 映射 System 或无环组合其它 Public alias；Family 由一个 UI family Module 暴露；单 Surface geometry 使用 `--_*`。
- token graph gate 覆盖 shipped CSS 和运行时 CSS template，阻止未定义引用、重复定义、循环依赖、未消费 Public alias、不可达 foundation token 与未登记的 Family token owner。删除 token 前必须证明定义图和消费图都不可达。
- page token 只生成 base-light 与 explicit dark override；不得保留内容相同的第二份 explicit-light block。
- 相同 `AppearanceSnapshot` 的 ShadowRoot 优先共享 constructed stylesheet；Firefox 等不支持路径继续使用稳定 style-tag fallback。

### 5.2 Surface Runtime

- 内部 `SurfaceProfile` 固定为 `panel`、`modal`、`anchored`、`inline` 四类行为族；产品 Surface 可以在族内声明具名 profile，但调用方不能传低层 CSS、motion 或 geometry flags。
- `ResponsiveProfile` 统一 viewport gutter、宽高 clamp、flip、collision、唯一 scroll owner 与窄屏降级。host selector 与 anchor rect 仍由 Platform Adapter 提供，Surface Runtime 不读取站点私有 DOM。
- `SurfaceMotionProfile` 是 CSS animation 与 JS delayed-unmount timing 的共同数据源，并内建 reduced-motion 语义；同一时长不得在 CSS 与 TypeScript 中重复维护。
- `SurfaceSession` 统一 appearance、locale、focus、Escape、outside-click、position、close 与 destroy。`OverlaySession` 是 modal/panel profile 的共享 Adapter；anchored Surface 直接或通过 family owner 组合同一个 session。唯一登记的例外是 transform-owned toolbar hover portal：它保留 motion-free 的既有 pointer boundary，防止 opening motion 覆盖锚定几何；其他 anchored Surface 不得各自复制 window listeners 和 viewport clamp。
- Surface 外壳在一次 session 内保持 stable ownership；异步数据、设置回流与错误状态只更新内容区，不重建 host/backdrop 或重复进入动画。
- 当前实现没有为 UI 收敛保留长期 feature flag 或第二套 lifecycle。新增 Surface 必须在真实入口、双实例（适用时）和销毁验证完成后接入 catalog。

### 5.3 Chrome Family Modules

- panel/dialog、anchored popover、toolbar/compact control、form/settings row、feedback 五个 family 分别拥有自己的 chrome Module 和具名 profile。
- header、footer、icon button、primary/secondary action、input、toggle、focus ring、pending/error/disabled 状态只在对应 family 定义一次；不得创建一个以大量 boolean flag 驱动的通用大组件。
- 同一个 named Surface 一旦拥有 2 个以上入口，baseline chrome 必须由 Surface 自己持有；入口只选择 profile。
- 高频重复 Surface 的低频子功能必须按首次真实触发创建；调用方已提供结构化 tooltip 数据时，不得为禁用的 title-upgrade 路径保留空转 observer。
- toolbar family token 统一使用 `--aimd-toolbar-*`；跨文件消费必须由 toolbar family Module 明确导出，不得依赖某一实例恰好先注入 token。

### 5.4 长期样式与响应式规则

- 组件样式必须使用 `--aimd-*` token；`--aimd-*` 是唯一 canonical design token source，外部样式框架不得成为第二套样式真源。
- 页面内 UI 使用 Shadow DOM；light-DOM 只允许记录在 Surface Catalog 中的宿主集成例外，并必须通过 `AppearanceScope` 获取 token。
- 站点主题探测只存在于 driver；UI 只接收 `AppearanceSnapshot`。
- 每个 Surface 必须登记 desktop、narrow-width、short-height、200% zoom、中文/英文长文案、reduced-motion、overflow 与 collision 行为。响应式优先按语义 profile 复用，不按 Surface 堆叠一次性 media query。
- overlay、toolbar 与高频注入 UI 继续使用自定义 CSS + token，保持启动路径轻量；重型 Surface 继续通过现有 lazy feature graph 加载。
- 若未来重新评估外部样式库，必须先更新 `docs/design.md` 并通过治理测试证明其不会成为第二套样式真源。
- 新 UI Module 或高风险重构必须先通过真实组件、真实 token、真实 Shadow DOM 的 mock-first 浏览器视觉验收，再完成生产入口测试；视觉探索页不能替代产品 Surface mock。

---

## 6. UI 长链职责拆分（已落地边界）

### 6.1 Bookmarks

Bookmarks 按 shell、tab workflow、data workflow 与 family styles 分责，而不是按文件长度机械切分：

- `BookmarksPanel` 保留 overlay lifecycle、tab orchestration、snapshot wiring 与 shell mounting
- `BookmarksPanelTabWorkflow` 持有 tab model、选择与 scroll memory
- `BookmarksCloudBackupWorkflow` 持有 Cloud Backup modal/RPC workflow
- `bookmarksWorkspaceResponsiveCss` 持有 workspace family responsive contract
- `BookmarksTabView`、`SettingsTabView`、`SponsorTabView` 是 tab 内容唯一 owner
- 树的 inline / virtualized 渲染必须通过 `BookmarksTreeViewport` 收口，避免 shell 与 tab view 双重拥有树
- Bookmarks family 的 overlay / modal / input-boundary 交互栈通过 `OverlaySession` 与 shared transient contract 收口；不存在 Bookmarks 私有 overlay session
- family-scoped select / stepper primitive 通过 transient-ui contract 与 shell 协作，不成为全局 UI 系统

### 6.2 Reader

ReaderPanel 是 orchestration owner，职责拆分为：

- `ReaderWorkflow`：profile 与 workflow state
- `ReaderViewModel`：展示模型构造
- `ReaderRendering`：Markdown、代码与页面内容渲染协调
- `ReaderHostAdapter`：window/document/browser host boundary
- `ReaderPanelContracts` / `ReaderPanelPort`：调用方合同，不反向依赖 `ReaderPanel` 实现
- `src/services/reader/*` 与 content conversation drivers：正文准备、缓存、bookmark intent 和 live-page 采集

### 6.3 Prompt

`ChatGPTPromptAutocompleteController` 只做 orchestration：

- `PromptWorkflow` 持有模式、候选、草稿与 library 调用
- `PromptGeometryAdapter` 持有 contenteditable/textarea caret 和 anchor 定位
- `PromptSurfaceRenderer` 持有 DOM 渲染
- `promptSurfaceCss` 持有 Prompt family visual contract

### 6.4 Content Runtime

`src/runtimes/content/entry.ts` 仍是 bootstrap/wiring root；重型 Reader、Bookmarks、save dialogs、Copy PNG 与 formula assets 继续通过 `lazyContentFeatures.ts` 和固定 extension-origin feature facade 按真实触发加载。UI 收敛不得把这些模块重新拉回启动 chunk，也不得增加全局 observer。

---

## 7. 演进策略（保证功能不变）

- 继续以“契约先行”更新内部实现：先调整协议、ports 或 Surface/family owner，再移动实现
- 每次变更保持可回归；当前可执行门禁由 `docs/testing/CURRENT_TEST_GATES.md` 定义

全 UI 收敛的交付历史与 Phase 7 closeout 见：`docs/refactor/UI_SYSTEM_REFACTOR_PLAN.md`。
