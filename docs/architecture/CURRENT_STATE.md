# Architecture Current State (As-Is)

本文描述 AI-MarkDone 当前仓库已经落地的结构事实，用于帮助开发者和 Codex 理解“现在是什么”。它不描述目标蓝图，也不描述未来计划。

---

## 1. 当前代码分层

仓库当前主要按以下目录分层：

- `src/runtimes/*`
  - 运行时入口
- `src/drivers/*`
  - 浏览器 API、站点适配、注入、主题、导出、存储等基础设施
- `src/services/*`
  - 用例编排与跨站共享逻辑
- `src/ui/*`
  - 页面内 UI、控制器、React/Shadow DOM UI foundation
- `src/contracts/*`
  - runtime 协议、平台契约、存储契约
- `src/core/*`
  - 更偏纯逻辑的数据与算法能力
- `src/style/*`
  - token、页面级 token 注入、Shadow DOM 样式入口

当前主线已经不再沿用旧的 `src/content/*` / `src/background/*` 目录组织，权威实现路径应以 `src/runtimes/*`、`src/drivers/*`、`src/services/*`、`src/ui/*` 为准。

---

## 2. 当前运行时入口

### Content runtime

- 入口：`src/runtimes/content/entry.ts`
- 当前职责：
  - 选择当前站点 adapter
  - 初始化 theme、math click、reader、send controller
  - 初始化 bookmarks panel 与 message toolbar orchestrator
  - 监听 background 发来的 `ui:toggle_toolbar`
  - 处理 best-effort 的书签跳转恢复

### Background runtime

- 入口：`src/runtimes/background/entry.ts`
- 当前职责：
  - 响应 content 发起的 protocol request
  - 路由到 bookmarks handler / settings handler
  - 处理 action icon 状态
  - 在启动时执行 best-effort journal recovery

---

## 3. 当前协议与契约

- runtime 协议：`src/contracts/protocol.ts`
- 平台契约：`src/contracts/platform.ts`
- 存储契约：`src/contracts/storage.ts`

当前 content ↔ background 协议已经具备：

- 固定版本字段 `v`
- request id `id`
- type-based request/response
- 统一错误码

当前协议语义说明已经以 `docs/architecture/RUNTIME_PROTOCOL.md` 为权威；阅读时应以它和 `src/contracts/protocol.ts` 共同作为当前真相。

---

## 4. 当前已稳定的能力边界

### Platform adapter

- 主要实现在 `src/drivers/content/adapters/sites/*`
- 平台差异已集中在 driver 层，而不是 UI 或 service 层

### Bookmarks

- background 负责写入和恢复
- content UI 负责意图触发与界面交互
- `BookmarksPanel` 现在主要承担 shell / overlay lifecycle / tab orchestration
- `BookmarksTabView`、`SettingsTabView`、`SponsorTabView` 是 bookmarks family 的主内容真相
- 书签树渲染与 virtualization 已收口到 `BookmarksTreeViewport`
- `src/ui/content/overlay/OverlaySession.ts` 现在是通用 overlay session wrapper，负责组合 overlay host、keyboard scope、input boundary 与 modal slot
- `BookmarksPanel`、`BookmarkSaveDialog` 与 `SaveMessagesDialog` 已直接复用通用 `OverlaySession`；Bookmarks family 不再保留独立 overlay wrapper
- `Deep Research` 已退出产品范围；当前 `src/` 中不再保留 active compatibility hook，仓库只保留文档与测试中的退场声明
- `src/ui/content/components/transientUi.ts` 现在是共享 outside-click / transient-root contract；Bookmarks family 只保留对它的 family-level 组合，而不再拥有私有实现
- Bookmarks family 内部的 inline select / number-stepper 目前仍保持为 family-scoped primitive，并通过统一 transient-ui contract 与 panel shell 协作
- `ModalHost` 现在只承担 dialog render、topmost modal ownership 与 focus restore；shared host boundary 与 keyboard scope 由 `OverlaySession` 负责

### Reader / Copy / Sending

- `pure/domain service` 负责纯逻辑与规则
- `content-facing feature service` 负责数据准备和行为编排
- content driver 负责 DOM 采集、剪贴板、导出、发送桥接
- UI 层负责 Shadow DOM / React UI 呈现
- `ReaderPanel` 当前通过 surface-owned named profiles 收口多入口差异；消息工具栏与书签预览不再直接传 low-level chrome flags，而是分别选择 `conversation-reader` 与 `bookmark-preview`

说明：

- `src/services/copy/*`
- `src/services/reader/*`
- `src/services/markdown-parser/*`
- `src/services/export/*`

当前都属于 `content-facing feature service`，不是严格意义上的“纯 service”。
- `src/services/export/saveMessagesPdf.ts` 属于明确例外：它负责构建最终导出文档，并消费样式 token 生成 PDF/打印用 CSS。
- `SendPopover` 仍是 anchored popover，而不是 overlay surface；它保留 textarea-level `inputEventBoundary` 作为 intentional local boundary，不视为 shared overlay contract 的例外缺口

### Style system

- 主入口为 `src/style/reference-tokens.ts`
- `src/style/system-tokens.ts`
- `src/style/tokens.ts`
- `src/style/pageTokens.ts`

---

## 5. 当前仍需注意的历史遗留

- `docs/antigravity/*` 仍是活跃文档路径的一部分，但它表示历史命名空间，不代表当前依赖任何旧工具链
- 一些较老的架构描述仍可能引用旧目录或旧实现形态，阅读时以本文件和实际代码路径为准
- 文档体系已经迁移到 `AGENTS.md` + `.codex/*` + `docs/*`，旧规范目录不再是活跃规范来源

---

## 6. 与其它文档的边界

- 想看目标架构：读 `docs/architecture/BLUEPRINT.md`
- 想看依赖方向：读 `docs/architecture/DEPENDENCY_RULES.md`
- 想看 runtime 协议：读 `docs/architecture/RUNTIME_PROTOCOL.md`
- 想看重构阶段：读 `docs/refactor/REFACTOR_CHECKLIST.md`
