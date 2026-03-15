# Testing Blueprint (To-Be)

目的：为即将到来的“功能不变的彻底重构”提供测试体系蓝图，使测试成为架构边界的执行者（contracts + regression gates），并逐步覆盖到关键逻辑函数。

约束：重构过程中优先保证稳定性与可审计性；测试结构必须可演进，不应被历史文档路径强绑。

---

## 1. 好的浏览器插件测试体系应满足的基本要求

- **按运行时边界分层**：content/background/extension pages 的行为分别验证
- **按契约驱动**：协议（protocol）、适配器契约（adapter contract）、存储契约（storage contract）必须有独立测试
- **可回归**：关键能力（bookmarks、reader、parse/render、settings、i18n）必须有可重复回归套件
- **可定位**：失败能快速映射到模块（而不是“全局 E2E 才能发现”）
- **兼容性**：Chrome MV3 / Firefox MV2 的差异点必须被测试锁定（至少 release gates）
- **可视验收**：UI 模块在并入插件前必须先完成 mock-first 浏览器视觉验证，而不是只依赖 build 或 jsdom

---

## 2. UI Mock Visual Testing Blueprint

所有新 UI 模块与高风险 UI 重构都必须先通过 mock-first 视觉验收，再进入插件实现。

固定流程：

1. 在 `mocks/components/<module>/index.html` 建立真实组件挂载型 mock。
2. mock 必须复用真实组件、真实 token 注入链路、真实 Shadow DOM 挂载方式。
3. 在浏览器中打开 mock 页面，验证：
   - `light / dark`
   - hover / focus / active / disabled / open 等关键状态
   - 两个独立实例同时挂载
   - live `shadowRoot` 中的运行时样式节点
   - 溢出、滚动、分层、对齐和密度
4. 留存截图或快照作为视觉验收依据。
5. mock 页面视觉达到批准基线后，才能把实现迁入 `src/ui/**`。
6. 迁入插件后，再执行真实 content runtime 集成验证与双浏览器回归。

模块差异：

- Toolbar：重点看高密度多实例、注入稳定性、轻量布局、样式隔离
- Overlay：重点看单例打开/关闭、主题同步、层级、焦点管理、滚动与定位

---

## 3. 目标测试分层（建议目录结构）

建议把测试按“目的/层级”拆清楚（避免 `unit`、`integration`、`release` 概念混用）：

```
tests/
  unit/                # 纯逻辑/纯函数/小对象（不依赖真实 DOM 或仅轻量 jsdom）
    contracts/         # protocol/schema/error codes
    parser/            # parser v3 rules/engine
    renderer/          # renderer core/sanitizer/diagnostics
    settings/          # schema/migration/defaults
    bookmarks/         # storage utils/identity/path/tree builder
  integration/         # 多模块协作（jsdom + 多对象编排）
    content/           # content wiring/observer lifecycles
    bookmarks/         # import/export closed-loop
    reader/            # render+pagination+clipboard paths
  release/             # 产物一致性/manifest/host allowlists/资源完整性门禁
  fixtures/            # JSON/HTML/markdown 输入夹具（集中管理）
```

迁移策略：允许逐步迁移，保持现有用例稳定绿；每次移动都同步更新 `vitest.config.ts` 的 include/exclude 策略。

---

## 4. “每个逻辑函数单测”的可执行定义（避免空泛）

不现实也不必要对所有私有方法逐一写测试；建议采用可执行口径：

- **必须覆盖**：所有导出的纯函数、关键策略函数、schema/contract 校验函数
- **强烈建议覆盖**：大型类/模块的“公开方法闭环”（例如 `show()/toggle()/refresh()`）
- **不要求逐个覆盖**：纯 UI 模板拼接的细碎私有方法（除非曾经出过 bug）

可衡量标准（示例）：

- 每个 Phase 的重构落地必须新增/更新至少 N 个单元/集成用例，覆盖新增的契约与边界
- 对高风险热点（`SimpleBookmarkPanel`、`ReaderPanel`、协议与存储写入路径）优先补齐用例

---

## 5. 现有体系中的问题（As-Is）

- 测试中存在对历史文档路径的硬依赖（例如 round-3 artifacts），会锁死 docs 结构
- 大文件热点已经超过文件治理门禁，但测试只能“提醒”，不能强制拆分完成
- 存储/协议/适配器契约尚未形成统一 schema，因此测试难以作为“架构门禁”
- UI 视觉迭代如果直接在插件内进行，回归成本高，且很难沉淀稳定的视觉验收证据

---

## 6. 与重构 checklist 的关系

本蓝图将被落实到：

- `docs/refactor/REFACTOR_CHECKLIST.md` 的新增阶段（Testing System Refactor）
- 协议/存储/适配器契约的门禁测试（contracts）
- mock-first 视觉验收与 runtime integration 的双阶段 UI 门禁

---

## 7. Entry Bundle Release Gates

针对浏览器扩展 entry（尤其 `content.js` / `background.js`），构建门禁必须覆盖“运行时加载格式”而不只看 TypeScript/单测是否通过。

要求：

- entry bundle 不得包含 top-level `import`
- entry bundle 不得包含会在运行时继续拉取 JS chunk 的动态加载语法（例如 `import('./assets/...')`、`await import(...)`、`__vitePreload(...)`）
- 该门禁必须同时作用于 Chrome MV3 与 Firefox MV2 产物

原因：

- content script 运行时一旦被 entry 格式问题打断，会导致工具栏注入、header icon、Reader 等上层 UI 全部“看起来一起失效”
- 这类问题可能通过单元测试和常规 build，但会在真实页面里以 `Unexpected token 'export'` 之类运行时错误暴露

执行口径：

- 保持 `scripts/verify-extension-entry-format.sh` 作为 release gate
- 每次引入新的 markdown/runtime enhancement、懒加载库或 content-side UI enhancement 时，必须重新验证 entry bundle 仍是单体可执行格式
