# Dependency Rules

本文件定义当前仓库应遵守的依赖方向与边界，用于把“分层”变成可执行约束，并为后续 lint/CI 门禁提供依据。

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

### Export renderer runtime

- 入口位于 `src/runtimes/export-renderer/*`，由按需 extension-origin `export-renderer.html` iframe 与 static PNG worker 承载
- 只允许依赖：
  - `src/services/export/*` 的版本化协议、profile 与纯 planner
  - `src/core/*` 的纯编码/数学逻辑
  - 渲染所需的本地 Markdown/KaTeX/MathJax capability
- Renderer capability 只负责编译、布局、band 栅格化与编码；禁止读取 settings/storage、访问网络、调用 clipboard/download/browser runtime messaging 或依赖 UI shell
- 消息与公式 capability 必须保持动态拆包；消息 job 不得加载公式 MathJax capability，公式 job 不得加载 Markdown/highlight capability
- 所有高内存图片任务必须先进入 `exportTaskScheduler`。可序列化任务必须复用 renderer host/protocol；只有无法跨 iframe 传递 Element 的 `dom-only` 公式 PNG 可以使用现有唯一 content-side compatibility adapter，且不得绕过 scheduler 或复制第二套 TeX/Markdown renderer
- PNG worker 只消费 `start/writeBand/finish/cancel`，必须校验等宽和连续 Y；禁止创建总高度 Canvas 或接收 DOM/HTML
- 只有 `export-renderer.html` 可作为 host-facing web-accessible resource；entry、capability chunks 与 worker 只能从 extension origin 内部解析

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

该协议必须版本化，只传语义 job、进度、稳定错误码、artifact metadata 与 transferable `ArrayBuffer` chunk；禁止 base64、大型 JSON 二进制、DOM、HTML/CSS 或 renderer function。

禁止：

- 在 content 与 background 两侧重复定义协议常量
- 通过未版本化的“任意对象”跨 runtime 传递
- 让 UI 或 feature 代码私自定义新的 runtime message shape

---

## 4. Browser And Host Abstraction Rules

- Browser API 抽象优先经过 `src/drivers/shared/browser.ts`
- 站点选择器、主题探测、message root 识别只能位于 `src/drivers/content/adapters/sites/*`
- conversation group discovery、turn root、conversation root、streaming 判定同样只能位于 adapter/driver；UI controller 不得新增宿主专有 selector
- KaTeX / code-heavy subtree 的宿主结构识别与 selector 也只能位于 adapter/driver；UI/controller 只能消费 adapter 暴露的结构化 hints
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
