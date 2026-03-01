# Rewrite Checklist (Archive → Rebuild → Delete)

目的：以“功能模块”为边界推进 **推倒重来（greenfield rewrite）**。旧实现整体进入 `archive/`，新实现按目标架构从标准路径重建。每完成功能闭环并通过验收后，删除 `archive/` 中对应旧代码，直到完全替换。

约束：每个阶段结束必须满足验证门禁（测试/构建/人工回归）；并且不得把旧结构性债务（反向依赖、协议分散、UI 直写存储等）搬运到新实现。

重写总纲与功能对齐清单：

- `docs/rewrite/PROGRAM.md`
- `docs/rewrite/FEATURE_PARITY.md`

---

## Phase 0 — 文档与蓝图固化（Docs Foundation）

- [x] 建立权威文档入口：`docs/README.md`
- [x] 固化 as-is 分析：`docs/architecture/AS_IS.md`
- [x] 固化 to-be 蓝图：`docs/architecture/BLUEPRINT.md`
- [x] 固化依赖规则：`docs/architecture/DEPENDENCY_RULES.md`
- [x] 固化站点适配器契约：`docs/antigravity/platform/ADAPTER_CONTRACT.md`

验证：

- [ ] 团队共识评审通过（架构/契约/阶段划分）

---

## Phase 1 — Archive 旧代码（Freeze Legacy）

目标：把当前实现整体归档到 `archive/`，并冻结旧代码（不再新增功能），为新架构腾出标准路径。

Checklist：

- [x] 创建 `archive/`（保留可追溯性）
- [x] 移动旧 `src/` → `archive/src/`（或等价路径）
- [x] 移动旧 `tests/` → `archive/tests/`（保留历史用例）
- [x] 移动旧与实现强绑定的说明 → `archive/docs/`（可选）
- [x] 明确“Legacy Freeze”：`archive/` 内禁止新增/修改逻辑（仅允许查看对照）

验证：

- [x] 新 `src/` 仍可独立构建（即便仅包含 skeleton）

---

## Phase 2 — New Skeleton（Runtime + Contracts First）

目标：先把“后续所有功能都要走的骨架”建起来：运行时入口、协议单点、依赖规则、样式系统入口、测试分层结构。

Checklist：

- [x] 新 `src/` 建立 runtime 入口（content/background/options/popup 的目录结构）
- [x] 建立 `shared/contracts`（版本化协议、错误码、requestId）
- [x] 建立 driver ports（storage/network/tab routing/theme 等抽象）
- [x] 建立样式系统入口（tokens + shadow DOM 注入模式）
- [x] 建立测试骨架（见 `docs/testing/TESTING_BLUEPRINT.md`）

验证：

- [x] `npm run build`（至少能产出空壳扩展并能加载）
- [x] `npm run test:smoke`（contracts + 基础工具链）

---

## Phase 3 — Rebuild by Domains（Feature Parity Iterations）

目标：按功能域逐个重建闭环，完成一个删一个旧模块。

执行顺序以 `docs/rewrite/FEATURE_PARITY.md` 为准。

Checklist（每个域通用）：

- [ ] 定义该域的契约（types/protocol/ports）
- [ ] 实现 driver（站点差异/基础设施）
- [ ] 实现 service（用例编排）
- [ ] 实现 UI（渲染与交互）
- [ ] unit/integration/release tests 到位
- [ ] 回归清单通过（E2E + 关键用例）
- [ ] 删除 `archive/` 中对应旧实现

验证（每次迭代）：

- [ ] `npm run test:core`
- [ ] `npm run build`

### Module A — Foundation（Toolbar + Theme, minimal visible loop）

- [x] Contracts：`src/contracts/protocol.ts` / `src/contracts/platform.ts` / `src/contracts/storage.ts`
- [x] Driver：Theme detection + observer（`src/drivers/content/theme/theme-manager.ts`）
- [x] UI：消息级工具栏骨架（`src/ui/content/MessageToolbar.ts`）
- [x] 自动化门禁：`npm run test:smoke` / `npm run build`
- [ ] 人工验收：ChatGPT 打开后每条消息工具栏出现（稳定注入）

### Module B — Copy（Markdown + LaTeX click mode + Code + Tables）

- [x] Service：copy pipeline（`src/services/copy/copy-markdown.ts`）
- [x] Driver：站点 copy root + noise filtering hooks（`src/drivers/content/adapters/sites/*`）
- [x] Driver：clipboard 写入（`src/drivers/content/clipboard/clipboard.ts`）
- [x] Driver：LaTeX click mode（`src/drivers/content/math/math-click.ts`）
- [x] UI：每条消息 Copy Markdown 按钮（`src/ui/content/MessageToolbar.ts`）
- [x] 自动化门禁：`npm run test:core` / `npm run build`
- [x] 人工验收：各站点消息级复制可用；LaTeX click 默认开启，点公式可复制
- [x] 冻结功能与验收口径：`docs/FEATURES.md`

### Module C — Reader MVP（打开/分页/渲染/复制/View Source）

- [x] Service：Reader items 收集（`src/services/reader/collectReaderItems.ts`）
- [x] Service：markdown 渲染+净化（`src/services/renderer/renderMarkdown.ts`）
- [x] UI：ReaderPanel（`src/ui/content/reader/ReaderPanel.ts`）
- [x] UI：ReaderPanel 可配置（按钮开关 + 注入 actions，用于跨模块复用）
- [x] UI：消息工具栏增加 Reader 入口（`src/ui/content/MessageToolbar.ts`）
- [x] Driver：注入框架稳定性升级（debounce scan + route watcher）（`src/drivers/content/injection/*`）
- [x] 冻结功能与验收口径：`docs/FEATURES.md`
- [x] 自动化门禁：`npm run test:core` / `npm run build`
- [ ] 人工验收：任意平台点击 Reader → 打开/翻页/复制/查看源，关闭无残留

### Module D — Bookmarks Core（存储/文件夹/导入导出/修复；无 UI）

- [x] Contracts：书签 metadata keys（index/journal/quarantine）登记（`src/contracts/storage.ts`）
- [x] Protocol：Bookmarks intents（`src/contracts/protocol.ts` + background handler）
- [x] Core：keys/path/import-export/merge/quota/repair/tree/journal（`src/core/bookmarks/*`）
- [x] Service：纯逻辑 plans（`src/services/bookmarks/bookmarksService.ts`）
- [x] Driver：background storage ports + queue（`src/drivers/background/storage/*`）
- [x] Runtime：Background write authority + journal recovery（`src/runtimes/background/handlers/bookmarks.ts`）
- [x] 自动化门禁：`npm run test:core` / `npm run build`
- [ ] 人工验收：Bookmarks UI 上线前，先通过脚本/console 调用完成 save/import/export/repair/rename/move 的闭环验证

### Module E — Bookmarks Panel（UI：面板 + Toolbar 快捷入口；ChatGPT-only）

- [x] UI：BookmarksPanel overlay（打开/关闭/ESC/Shadow DOM + tokens）（`src/ui/content/bookmarks/BookmarksPanel.ts`）
- [x] UI：BookmarksPanelController（状态管理 + intents 编排）（`src/ui/content/bookmarks/BookmarksPanelController.ts`）
- [x] Service：panel view model（过滤/排序/文件夹树）（`src/services/bookmarks/panelModel.ts`）
- [x] Driver/Protocol：positions snapshot + bulk ops（`src/contracts/protocol.ts`, `src/runtimes/background/handlers/bookmarks.ts`）
- [x] UI：书签条目点击预览复用 ReaderPanel（搜索=全局顺序翻页；非搜索=folder 范围翻页）
- [x] UI：MessageToolbar 增加 Bookmark 快捷按钮（保存/取消 + 状态同步）（`src/ui/content/controllers/MessageToolbarOrchestrator.ts`）
- [x] 自动化门禁：`npm run test:core` / `npm run build`
- [ ] 人工验收：扩展图标打开面板；面板内导入/导出/repair；Go To 定位与高亮；批量移动/删除

---

## Phase 4 — Docs & Tests Evolution（持续演进）

目标：重写期间持续维护权威文档与测试体系，避免“实现漂移但无人察觉”。

Checklist：

- [ ] 每引入一个新契约/协议/存储 schema：同步更新权威 docs
- [ ] 每完成功能闭环：补齐对应 unit/integration/release tests
- [ ] 逐步下调风险热点门禁（文件尺寸、协议覆盖率、存储写入路径数量）
