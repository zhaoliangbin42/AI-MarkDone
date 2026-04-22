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
- Extension UI（Popup/Options）：负责全局 UI 与设置入口（当前较薄）

### 2.1.1 前后端分离定义（Extension Frontend vs Backend）

为避免“浏览器扩展只有前端”的误区，这里给出项目内的明确术语约定：

- **扩展前端（Frontend）**：Content Script + 页面内 UI（Shadow DOM/overlay）+ Popup/Options
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

1. Driver（adapter/datasource）采集 `ReaderItem[]`（live page / bookmarks 等来源）
2. Service 进行编排：解析/渲染策略、缓存、错误回退、性能节流
3. UI 只负责呈现与交互（分页/复制/打开浮层/触发发送）
4. 副作用（写书签、写设置、网络等）通过 Background 执行并返回结果

### 2.3.3 Bookmarks 闭环（保存/导入导出/恢复）

1. UI 收集意图（保存/删除/移动/导入/导出/批量操作）
2. Service 进行校验与拆分（幂等 key、判重策略、错误分类）
3. Driver 执行写入与监听（优先 Background 作为 write authority）
4. UI 仅消费“状态快照/事件”刷新（避免 UI 直写 storage）

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
- `docs/antigravity/platform/ADAPTER_CONTRACT.md`（适配器与协议协作方式）

### 3.2 Site Adapter Contract（站点差异收敛点）

目标：站点差异只能存在于 adapter（driver）实现里，Service 层不感知 DOM 选择器，也不按 platform id 分支选择 parser 实现。

补充约束：

- 页面级入口（例如 header bookmark icon）的 DOM 锚点与注入规则，同样属于 adapter 契约的一部分
- ChatGPT conversation group discovery、turn root、conversation root、streaming 判定同样属于 adapter/driver 契约的一部分；UI/controller 只能消费已经抽象好的 group refs，包括完整 body roots、user prompt title 与稳定 anchor hints
- ChatGPT 稳定态性能优化所需的重子树结构提示（如 KaTeX / code-heavy subtree refs）同样属于 adapter/driver 契约；UI/controller 只能消费 adapter 返回的结构化 hints，不得自行扩张宿主 selector 集合
- runtime 只允许持有平台无关的生命周期编排器（如 toolbar/header icon orchestrator），不得在入口层写平台选择器

契约位置：

- `docs/antigravity/platform/ADAPTER_CONTRACT.md`

### 3.3 Storage Contract（单一写入路径）

目标：把“写存储”收敛为可审计路径，减少竞态与恢复复杂度。

建议策略（待在重构阶段确认）：

- Background 作为“写入权威（write authority）”
- Content/UI 只提交 intent，不直接写入敏感存储

---

## 4. 目标模块边界（按功能域拆分）

重构后希望达到的“模块可替换边界”（不等同于目录）：

- Platform（Site Adapters）：选择器/主题探测/噪声过滤/normalizeDOM
- Reader（Preview/Panel）：仅消费 `ReaderItem[]` 与 Service 提供的数据
- Bookmarks：数据模型/迁移/导入导出/面板 UI（与 Reader 解耦）
- Parse/Render：parser v3 与 renderer 的纯逻辑能力
- Settings：schema、迁移、默认值、cache、与 UI/Service 的边界
- Background Capabilities：storage/network/permissions/tab routing（intent 执行者）

---

## 4.1 现有代码到目标边界的映射（As-Is → To-Be）

本节用于把“蓝图”落到当前仓库中可定位的模块，避免重构时讨论停留在抽象层面。

### UI 层（目标：仅渲染与交互）

当前主要落点：

- 内容页组件与控制器：`src/ui/content/*`
- ReaderPanel UI：`src/ui/content/reader/ReaderPanel.ts`
- Bookmarks Panel UI：`src/ui/content/bookmarks/*`
- React/Shadow foundation：`src/ui/foundation/*`

Surface profile / motion ownership 规则补充：

- 同一个 named surface 一旦被 2 个以上入口复用，baseline chrome 必须由 surface 自己持有
- 入口只能选择 named `profile`，不能直接传 low-level chrome flags 或自定义 CSS
- `ReaderPanel` 当前就是这条规则的首个正式落点：
  - `profile` 负责 header/footer/action rail
  - Markdown body 视觉继续由 Reader 自己持有的默认正文主题负责
  - baseline chrome 与正文主题都属于 surface-owned contract，而不是 caller-owned override
- shared overlay/modal surface 的 enter/exit motion 也必须由 surface 自己持有；caller 不得注入自定义 open/close motion
- `panel-window` family 与 `modal-dialog` family 可以拥有不同的共享 motion contract，但都必须使用 tokenized shared chrome CSS，而不是每个 surface 各自定义 keyframes
- 共享 surface 的 open-focus / restore-focus 也必须由 surface owner 持有并复用共享 lifecycle helper；不得只让 `ModalHost` 独占完整的焦点语义，而让其它 panel family 各自零散实现
- 同一 surface 在首次打开后，外层 shell/backdrop 必须保持 stable ownership；后续异步数据刷新只能更新内部内容区，不能通过重建外层 DOM 重新消费 opening motion

### Service 层（目标：统一用例编排，跨站一致）

当前主要落点（后续需“搬离 UI/driver 细节”）：

- Bookmarks use cases：`src/services/bookmarks/*`
- Copy / Reader / Export / Sending：`src/services/copy/*`, `src/services/reader/*`, `src/services/export/*`, `src/services/sending/*`
- Markdown parser / renderer：`src/services/markdown-parser/*`, `src/services/renderer/*`
- Settings use cases：`src/services/settings/*`

补充说明：

- `src/services/settings/*`、`src/services/bookmarks/*` 更接近 `pure/domain service`
- `src/services/copy/*`、`src/services/reader/*`、`src/services/export/*`、`src/services/sending/*` 当前更接近 `content-facing feature service`
- `saveMessagesPdf.ts` 属于明确允许的导出例外：service 生成最终文档并消费样式 token

### Driver 层（目标：站点差异与基础设施能力中心）

当前主要落点：

- Site adapters：`src/drivers/content/adapters/*`
- Injection / conversation / clipboard / theme / sending bridges：`src/drivers/content/*`
- Browser abstraction：`src/drivers/shared/browser.ts`
- Background capabilities：`src/drivers/background/storage/*`, `src/runtimes/background/handlers/*`

### Contracts（非“层”，是协作面）

当前落点（待升级为版本化协议）：

- runtime protocol：`src/contracts/protocol.ts`
- platform contract：`src/contracts/platform.ts`
- storage contract：`src/contracts/storage.ts`

---

## 5. 样式系统与主题（统一管理）

目标：跨站 UI 外观一致、与宿主样式隔离、可主题同步、可审计（禁止硬编码、禁止 `!important`）。

权威规范：

- Tokens 规范：`docs/antigravity/style/TOKEN_REFERENCE.md`
- 样式系统：`docs/style/STYLE_SYSTEM.md`

工程落地要求：

- 组件样式必须使用 `--aimd-*` token
- `--aimd-*` 是唯一 canonical design token source；Tailwind 只能通过语义 alias 消费这些 token
- Tailwind 只允许用于 overlay-style singleton UI；toolbar 与高频注入 UI 保持轻量实现，不引入 Tailwind
- overlay/panel family 的 header/footer/icon/action chrome 必须优先复用共享 primitive；不得在 Reader/Source/Bookmarks/Dialogs 内各自复制一套近似实现
- 同一个 named surface 一旦拥有 2 个以上入口，baseline chrome 必须稳定；入口不得直接传 low-level layout/chrome flags，差异必须由 surface 自己声明 named profiles
- shared overlay / modal motion 必须由正式 shared contract 持有；不得由 caller 自己注入 enter/exit chrome 或在单个 surface 私下复制一套近似动画
- 一旦 overlay / transient dismiss contract 出现第二个明确消费者，就必须提升到共享 `components/*` 或 `overlay/*`；只有带明显业务假设的 primitive 才允许继续保持 family-scoped
- `OverlaySession` 只约束 overlay surfaces；anchored popover 可以保留 local interaction boundary，但必须在 `CURRENT_STATE.md` 中明确标记为 intentional local，而不是共享 contract 缺口
- toolbar component token 必须统一使用 `--aimd-toolbar-*`，禁止继续出现 `--aimd-tb-*` 这类未显式标明组件域的局部伪系统 token
- 若使用 Tailwind，必须使用 `tw` 前缀并禁用 Preflight，避免其成为第二套样式真源
- 页面内 UI 必须使用 Shadow DOM（或等效隔离容器）避免样式冲突
- 主题同步必须通过稳定机制（如 `data-aimd-theme`）驱动 token 切换
- 禁止把站点特化主题探测逻辑扩散到 UI：通过 driver 提供 ThemeDetector 或通过 ports 注入
- 新 UI 模块在并入插件前，必须先通过 `mocks/components/<module>/index.html` 的 mock-first 浏览器视觉验收

---

## 5. 大文件拆分蓝图（先结构后优化）

### 5.1 `BookmarksPanel.ts` 拆分方向（示例）

拆分目标：把“UI / state / operations / infra”分离，并移除对 content/ReaderPanel 实现的反向依赖。

建议拆分子模块（示意命名）：

- `src/ui/content/bookmarks/ui/*`：模板与 DOM 渲染（UI）
- `src/ui/content/bookmarks/*Controller*`：交互状态机（selection/tab/keyboard）
- `src/services/bookmarks/*`：导入合并/判重/分析（Service）
- `src/drivers/content/bookmarks/*` 与 `src/drivers/background/storage/*`：导航与存储基础设施（Driver）

当前实现约束：

- `BookmarksPanel` 应继续向 shell/orchestrator 收缩，只保留 overlay lifecycle、tab orchestration、snapshot wiring、scroll memory
- `BookmarksTabView`、`SettingsTabView`、`SponsorTabView` 是 tab 内容唯一 owner
- 树的 inline / virtualized 渲染必须通过 `BookmarksTreeViewport` 收口，避免 shell 与 tab view 双重拥有树
- Bookmarks family 的 overlay / modal / input-boundary 交互栈必须通过共享 session 收口，避免 `BookmarkSaveDialog` 再维护第二套 nested modal host
- 在尚未泛化到全项目前，Bookmarks family 可以保留 family-scoped select / stepper primitive，但 shell 只能通过 transient-ui contract 与其交互，不能依赖具体 selector

### 5.2 `ReaderPanel.ts` 拆分方向

拆分目标：ReaderPanel UI 与数据采集/书签联动/发送逻辑解耦。

建议拆分：

- `src/ui/content/reader/*`：Panel UI + navigation + styles
- `src/services/reader/*`：数据准备、缓存策略、bookmark intent
- `src/drivers/content/conversation/*`：从 live page 采集 `ReaderItem[]` 所需的页面引用

### 5.3 `src/runtimes/content/entry.ts` 拆分方向

拆分目标：入口只做 bootstrap；把 platform gating、message handler、observer wiring、feature wiring 拆出模块。

---

## 6. 演进策略（保证功能不变）

- 以“契约先行”的方式逐步替换内部实现：先立协议与 ports，再搬迁逻辑
- 每阶段保持可回归：重构 checklist 里定义了每一步的验证门禁

分阶段执行见：`docs/refactor/REFACTOR_CHECKLIST.md`
