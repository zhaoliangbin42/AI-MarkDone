# Architecture Blueprint (To-Be)

本文定义 AI-MarkDone 的目标架构蓝图，用于指导 **推倒重来（greenfield rewrite）**。蓝图的目标不是复刻旧实现，而是把边界做成可执行的契约，并让模块能并行演进、互不干扰，且更符合 MV3 的可审计/可恢复要求。

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
   - 只负责：统一操作逻辑（跨站一致），不触碰 DOM/存储写入细节
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

- `docs/architecture/DEPENDENCY_RULES.md`（协议文件只能在 shared/contract 层）
- `docs/antigravity/platform/ADAPTER_CONTRACT.md`（适配器与协议协作方式）

### 3.2 Site Adapter Contract（站点差异收敛点）

目标：站点差异只能存在于 adapter（driver）实现里，Service 层不感知 DOM 选择器，也不按 platform id 分支选择 parser 实现。

补充约束：

- 页面级入口（例如 header bookmark icon）的 DOM 锚点与注入规则，同样属于 adapter 契约的一部分
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

- Toolbar/Modal/Buttons：`src/content/components/*`
- ReaderPanel UI（需拆分）：`src/content/features/re-render.ts`
- Bookmarks Panel UI（需拆分）：`src/bookmarks/components/SimpleBookmarkPanel.ts`
- Bookmark modals：`src/bookmarks/components/BookmarkSaveModal.ts`

### Service 层（目标：统一用例编排，跨站一致）

当前主要落点（后续需“搬离 UI/driver 细节”）：

- Content features：`src/content/features/*`（save/export/folding/math-click/deep-research/message sending）
- Parse/Render orchestration：`src/content/parsers/markdown-parser.ts`, `src/parser/*`, `src/renderer/*`
- Bookmarks operations（目前混在面板内）：`src/bookmarks/components/SimpleBookmarkPanel.ts`（导入合并/判重/分析等）

### Driver 层（目标：站点差异与基础设施能力中心）

当前主要落点：

- Site adapters：`src/content/adapters/*`, `src/content/adapters/registry.ts`
- Observers/injectors/datasource：`src/content/observers/*`, `src/content/injectors/*`, `src/content/datasource/*`
- Browser abstraction：`src/utils/browser.ts`
- Background capabilities（需增强）：`src/background/service-worker.ts`, `src/background/background-firefox.js`
- Storage infra：`src/settings/SettingsManager.ts`, `src/bookmarks/storage/*`

### Contracts（非“层”，是协作面）

当前落点（待升级为版本化协议）：

- runtime messages：`src/shared/runtime-messages.ts` + guards（需要收敛）

---

## 5. 样式系统与主题（统一管理）

目标：跨站 UI 外观一致、与宿主样式隔离、可主题同步、可审计（禁止硬编码、禁止 `!important`）。

权威规范：

- Tokens 规范：`docs/antigravity/style/TOKEN_REFERENCE.md`
- 样式系统：`docs/style/STYLE_SYSTEM.md`

工程落地要求：

- 组件样式必须使用 `--aimd-*` token
- 页面内 UI 必须使用 Shadow DOM（或等效隔离容器）避免样式冲突
- 主题同步必须通过稳定机制（如 `data-aimd-theme`）驱动 token 切换
- 禁止把站点特化主题探测逻辑扩散到 UI：通过 driver 提供 ThemeDetector 或通过 ports 注入

---

## 5. 大文件拆分蓝图（先结构后优化）

### 5.1 `SimpleBookmarkPanel.ts` 拆分方向（示例）

拆分目标：把“UI / state / operations / infra”分离，并移除对 content/ReaderPanel 实现的反向依赖。

建议拆分子模块（示意命名）：

- `bookmarks/panel/view/*`：模板与 DOM 渲染（UI）
- `bookmarks/panel/controller/*`：交互状态机（selection/tab/keyboard）
- `bookmarks/panel/services/*`：导入合并/判重/分析（Service）
- `bookmarks/panel/infra/*`：storage sync/theme sync（Driver）

### 5.2 `re-render.ts`（ReaderPanel）拆分方向

拆分目标：ReaderPanel UI 与数据采集/书签联动/发送逻辑解耦。

建议拆分：

- `reader/ui/*`：Panel DOM + navigation + styles
- `reader/service/*`：数据准备、缓存策略、bookmark intent
- `reader/driver/*`：从 live page 采集 `ReaderItem[]`（保留在 content datasource）

### 5.3 `content/index.ts` 拆分方向

拆分目标：入口只做 bootstrap；把 platform gating、message handler、observer wiring、feature wiring 拆出模块。

---

## 6. 演进策略（保证功能不变）

- 以“契约先行”的方式逐步替换内部实现：先立协议与 ports，再搬迁逻辑
- 每阶段保持可回归：重构 checklist 里定义了每一步的验证门禁

分阶段执行见：`docs/refactor/REFACTOR_CHECKLIST.md`
