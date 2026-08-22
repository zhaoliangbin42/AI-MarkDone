# Testing Architecture Blueprint

目的：定义 AI-MarkDone 长期测试架构，使测试成为 runtime、contract、UI Surface、token、bundle 与回归边界的执行者，并为后续改动提供稳定扩展规则。

约束：优先保证稳定性、可定位性与可审计性；测试结构可以演进，但不得被临时阶段名或历史文档路径强绑。

---

## 1. 好的浏览器插件测试体系应满足的基本要求

- **按运行时边界分层**：content/background/extension pages 的行为分别验证
- **按契约驱动**：协议（protocol）、适配器契约（adapter contract）、存储契约（storage contract）必须有独立测试
- **可回归**：关键能力（bookmarks、reader、parse/render、settings、i18n）必须有可重复回归套件
- **可定位**：失败能快速映射到模块（而不是“全局 E2E 才能发现”）
- **兼容性**：Chrome MV3 / Firefox MV2 的差异点必须被测试锁定（至少 release gates）
- **可视验收**：UI 模块在并入插件前必须先完成 mock-first 浏览器视觉验证，而不是只依赖 build 或 jsdom

---

## 2. UI Coverage And Visual Testing Blueprint

所有新 UI 模块与高风险 UI 重构都必须先通过 mock-first 视觉验收，再进入插件实现。

### 2.1 Surface coverage manifest

`tests/support/uiSurfaceCoverage.ts` 定义 `UiSurfaceCoverageEntry`，它只进入 governance/visual tooling，不进入 production bundle。每个用户可见 Surface 必须登记：

- 稳定 id、产品 family、owner Module 与真实用户入口
- `panel / modal / anchored / inline` profile
- Shadow DOM、light-DOM portal 或 extension page scope
- appearance、locale、focus、dismiss、motion、overflow 和 responsive owner
- real-component mock 路径与至少一个 production trigger-path test
- 支持的 viewport、状态与浏览器目标

`tests/unit/governance/uiSurfaceCoverage.test.ts` 校验重复 id、owner/production entry、真实 trigger test、tracked mock、profile/scope、双浏览器目标和 direct/family evidence 完整性。隐藏 export renderer、fixture 与纯探索页面不进入产品 Surface manifest。

### 2.2 Mock-first visual flow

固定流程：

1. 在 `mocks/components/<module>/index.html` 建立真实组件挂载型 mock。
2. mock 必须复用真实组件、真实 token 注入链路、真实 Shadow DOM 挂载方式。
3. 在浏览器中打开 mock 页面，验证：
   - `light / dark`
   - hover / focus / active / disabled / open 等关键状态
   - 两个独立实例同时挂载
   - live `shadowRoot` 中的运行时样式节点
   - 溢出、滚动、分层、对齐和密度
4. 留存截图或快照作为视觉验收依据；证据目录不进入 Git。
5. 视觉修改与真实 Module fixture 必须在同一变更中保持一致，不能用重绘页面冒充产品基线。
6. 视觉工具通过后，再执行真实 content runtime trigger 验证与双浏览器回归。

模块差异：

- Toolbar：重点看高密度多实例、注入稳定性、轻量布局、样式隔离
- Overlay：重点看单例打开/关闭、主题同步、层级、焦点管理、滚动与定位
- Anchored Surface：重点看 anchor 丢失、上下翻转、viewport clamp、外部点击、短高度与输入法
- Panel/workspace：重点看唯一 scroll owner、sticky header/footer、窄屏单列和长内容

`npm run test:ui:visual` 已复用仓库 Playwright 与 Vite，按 coverage manifest 自动发现 direct real-component fixture。默认模式执行小型 smoke；`-- --full` 执行完整矩阵；`-- --mock=<fixture-name>` 定向执行一个 direct fixture。它挂载真实 Module、真实 token 和真实 Shadow DOM，并执行：

- 320/390/768/1024/1440px 宽度，必要时加 568/900px 高度
- 100%/200% zoom，light/dark，English/Chinese，default/reduced motion
- default/hover/active/focus-visible/disabled/pending/error/empty/long-copy/two-instance 状态
- console error、横向溢出、裁切、viewport escape、重复 host 与 destroy 后残留检查

Playwright 截图用于审查视觉变化，不把脆弱的整页像素完全相等当作唯一正确性证明；geometry、ARIA、focus、overflow 与 lifecycle 仍需结构化断言。

### 2.3 Token graph governance

Token gate 通过 `tests/support/uiStyleInventory.ts` 自动扫描 `src/style/*`、shipped UI CSS、TypeScript 内 CSS template 和 extension popup，并建立定义与 `var()` 引用图，而不是用字符串出现次数猜测 dead token。

当前必须阻止：

- 未定义引用、重复 non-isolated owner、循环引用、未消费 Public alias 与不可达的 Reference/System/Public definition
- component CSS 直接消费 Reference/System token
- Family token 未登记唯一 definition owner 或越过允许的 consumer boundary
- shipped UI 中未获文档例外的硬编码颜色、间距、圆角、阴影、z-index、motion 和非 print `!important`

popup 静态 fallback 与导出/打印输出使用精确 declaration signature 的最小 exception list；每项必须记录 owner 和理由，不能按目录整体放行。快速 token closure 进入 `test:smoke`，token/Surface/style/visual-harness governance 进入 `test:acceptance`。

### 2.4 Reader Annotation Manager Coverage (v1 shipped)

The annotation manager is one Reader-family modal with two scopes, not a second workspace. Its required coverage proves:

- the real Reader header trigger opens the manager even when the current conversation has no annotations;
- current-conversation and all-annotation scopes share one client and one list model;
- grouped and timeline projections, search, empty/loading/failure/pending/unanchored states, long quote/comment text, focus return, Escape, and delete confirmation;
- same-conversation locate and cross-conversation new-tab navigation enter through the production trigger path;
- with new-annotation persistence disabled, previously durable records and the global durable collection remain visible and durably editable/deletable, while newly created records stay only in the current page runtime;
- light/dark, English/Chinese, 320/390/768/1024/1440 widths, 200% zoom, reduced motion, and no horizontal overflow;
- two independent Reader instances do not share UI state accidentally, while both observe the same persisted annotation changes.

The fixture must mount the production annotation manager and token injection. It must not redraw a representative list or replace the modal with a mock-only implementation. The data layer and runtime protocol require separate contract, storage, anchor, and cross-runtime integration tests; visual coverage does not replace those tests.

### 2.5 ChatGPT page annotation entry coverage

The production page annotation trigger path must prove:

- a mouse selection shows the copy/comment toolbar beside the pointer release position with viewport clamping/flipping; keyboard or programmatic selection without a pointer anchor may use selection geometry as fallback; a second selection after create, save, cancel, edit, delete, resize, or selection collapse never remains blocked by stale toolbar state;
- the shared selection coordinator remains the only ordinary page selection owner and semantic materialization occurs only after Copy, Comment, or an explicit insert/compose action;
- page-manager Current keeps locate/edit, single delete, search, and annotation insertion; All keeps search and management but does not offer cross-conversation insertion, and page-manager bulk copy/delete actions are absent;
- ordinary page insertion reuses Reader `buildCommentsExport` with an empty user prompt, while autocomplete ArrowRight composes the selected prompt through the same builder; Enter/Tab and no-annotation ArrowRight retain their existing semantics;
- prompt composition preserves Reader template, sort, numbering, cursor-marker stripping, and prompt-position rules, and the provider is scoped to the current conversation;
- pointer/selection listeners, rAFs, overlay hosts, and transient ranges are released by disable/dispose with no additional observer, polling, or persistent selection timer.

---

## 3. 当前测试分层

### 3.0 ChatGPT content discovery contract

The discovery refactor has a dedicated contract and lifecycle layer in addition to the existing driver and consumer suites:

- `tests/unit/contracts/conversationContent.test.ts` locks page/canonical document identity, deep immutability, contiguous typed turns, coverage, and content-token semantics.
- Repository scenario tests cover page-scoped DOM publication, page-to-canonical identity promotion, per-conversation tab-local pool switching, direct reads, authoritative outer-slot sequence extension by prefix/tail/both, retained topology for mounted subwindows, conflict rejection, private empty-slot idempotency, virtualized-window preservation, assistant-to-slot binding conflicts, duplicate assistant identity idempotency, and latest eligible DOM body updates.
- Runtime and governance tests prove the Graph bridge, baseline acquisition, retry ladder and Graph diagnostics are absent, and the extension issues zero conversation GET/POST requests.
- The first-turn lifecycle fixture observes assistant DOM before canonical identity and proves the official action row mounts the plugin toolbar without waiting for Repository publication. Current-message word count, copy, Reader/export preparation and selection/annotation resolve the owning DOM-local message; Repository ingestion occurs independently after eligible compilation. Formula actions use formula DOM directly; bookmark submission remains disabled and sends no save/remove request until canonical identity exists. A later `/c/:id` promotion preserves accumulated projection/content tokens and enables the existing bookmark chain.
- Route identity tests keep `/c/<id>`, `/conversation/<id>`, nested `/g/<scope>/c/<id>`, arbitrary prefixes and mixed safe tokens distinct from negative `/g/<id>`, `/share/<id>`, query-only identity, unsafe tokens and URL-stable anonymous cases. The route parser is a shared semantic-segment identity rule, not an endpoint list or content detector.
- The existing-conversation fixture uses realistic outer empty slots with nested hydrated message sections. An initial ten-slot sequence may jump directly to a 62-slot sequence whose old ten slots are an exact suffix; consecutive prefixes, one merged multi-page prefix, a new tail, and prefix-plus-tail extension preserve the authoritative host order. Hydrating an older empty slot inserts its body at that position rather than the snapshot tail. A mounted subwindow cannot shrink the retained topology, and a conflict cannot reorder it. Virtualized removal does not shrink the pool. Multi-message Reader/export remain aligned, while current-message actions remain usable from mounted DOM and a generating message stays absent from the pool until completion.
- URL-stable anonymous discovery is current page-local behavior. Tests prove page-session isolation, virtualized unmount/remount preservation, late attachment, and exclusion from persistent bookmark/cross-page navigation contracts.
- Page Monitor and Host Monitor coverage proves initialization, delayed official action-row hydration, generation end, root replacement and relevant content mutation all reach one short page-level reconciliation. Each coalesced capture reads one deduplicated outer-slot sequence excluding nested repeated markers and `client-created-root`; an aggressive mutation burst produces one final topology read. User-message body hydration from empty to non-empty is a content signal and updates the same assistant identity without waiting for an unrelated history load. Streaming content is not compiled; empty slots are not cloned or converted; an unchanged complete pair removed and structurally remounted under the same stable assistant ID is not compiled again; an assistant-only capture recompiles when its user prompt remounts; changed eligible DOM still updates the same identity. Extension-owned and unrelated mutations are ignored. Deep Research iframe hydration continues through its verified Adapter anchor.
- Runtime composition coverage proves History navigation, `pageshow`, document `resume` and visible-page wake switch or refresh the correct tab-local conversation pool. A→B fences stale compilation, B→A restores A, and no consumer refresh, polling loop, bridge or retry ladder creates another acquisition path.
- Surface and consumer-boundary tests prove accumulated-content consumers receive one Frame, while Toolbar and current-message actions consume the typed PageIndex message seam without a second observer, route watcher or accumulated store. DOM remounts do not change semantic tokens; an assistant-only virtualized remount rebinds without duplicating a toolbar; Directory visibility/items/geometry remain unchanged in this phase; pending local content does not rewrite React-owned nodes; and current-message DOM access cannot become a second multi-message discovery path. Governance also requires the retired Discovery Coordinator, Conversation Index, standalone Materialization implementation, and source-only V2 integration harness/tests to remain absent.
- Same-page navigation tests enter through the shared Directory/Bookmark/Reader navigation seam and cover exact stable IDs, outer-slot deduplication, initial latest-window navigation, target-above/target-below direction, batch-load overshoot and step reduction, dynamic scroll-root geometry, configurable 1000–5000px stride values in 400px increments, bounded stalls/deadlines, user cancellation, projection changes, and exact-anchor stabilization. These tests must prove that navigation may cause ordinary page hydration only after an explicit user action and never adds a content observer, network acquisition path, placeholder count, or second pool. A separate real-button fast-top test proves immediate native top, delayed prepend re-top, 20-second default deadline, quiet completion, second-click cancellation, wheel/keyboard cancellation, mouse/pointer movement and touchstart tolerance, and lifecycle cleanup.
- Installed Chrome MV3 and Firefox MV2 tests remain separate acceptance evidence; unit/integration green is not a substitute for real host verification.

### 3.0.1 Semantic content and rendered-surface contract

Content fidelity and page interaction are tested as separate layers:

- Host Adapter tests lock DOM normalization, one-clone/one-conversion capture, basic execution budgets, and same-ID latest-DOM replacement. The compiler corpus covers paragraph, list, table, code, quote, link, image, formula and local malformed-formula fallback without pre-scanning whole message trees.
- Semantic Module tests lock immutable AI-MarkDone-owned nodes, parser isolation, UTF-16 half-open spans, complete cache identity, Reader structure projection, duplicate-quote disambiguation, and rejection of unproven offsets instead of estimated mapping.
- Content Surface Adapter tests use wrapper/remount variants to prove native `Range` and host selectors remain driver-local while direct message identity and TextQuote evidence remain stable and platform-neutral.
- Selection and annotation trigger tests prove an explicit action re-reads the current Range and owning mounted message, then compiles that one DOM snapshot. A stale detached Range is rejected, but Repository membership, prior content tokens and unrelated surface revisions are not prerequisites.
- Consumer tests prove Reader structure, ordinary/structured page selection, formula click/assets, toolbar copy, bookmark, PNG, and Save Messages either consume the shared result or reject degraded source; same-page navigation reads the Conversation Surface and fences on projection identity rather than URL text or body parsing.
- Static governance tests reject DOM/browser/platform dependencies in the Semantic Module, parser AST types in public contracts, DOM handles in surface evidence, and duplicate source/surface joins.
- Installed Chrome MV3 and Firefox MV2 acceptance remains a separate host-level gate for clipboard permissions, event ordering, virtualization, and real ChatGPT markup.

测试按目的和 runtime boundary 组织：

```
tests/
  unit/
    contracts/         # protocol/schema/error codes
    core/              # pure settings, Markdown, export, bookmark logic
    services/          # use-case and formatter behavior
    drivers/           # adapter/browser/DOM ports
    runtimes/          # content/background/extension-page wiring
    ui/                # Surface owners, controllers, trigger paths
    style/             # token, appearance, and scope contracts
    governance/        # dependency, Surface, token, style, visual-harness, manifest gates
  integration/         # multi-module jsdom/runtime collaboration
  parity/              # platform/copy golden parity
  fixtures/            # JSON/HTML/Markdown inputs and goldens
mocks/components/      # real-component visual fixtures
scripts/               # browser visual, bundle, performance, and renderer harnesses
```

目录表达测试目的，不表达临时重构阶段。移动测试时必须保持现有 suite 入口稳定，并同步更新 Vitest include/exclude 与文档中的可执行命令。

---

## 4. “每个逻辑函数单测”的可执行定义（避免空泛）

不现实也不必要对所有私有方法逐一写测试；建议采用可执行口径：

- **必须覆盖**：所有导出的纯函数、关键策略函数、schema/contract 校验函数
- **强烈建议覆盖**：大型类/模块的“公开方法闭环”（例如 `show()/toggle()/refresh()`）
- **不要求逐个覆盖**：纯 UI 模板拼接的细碎私有方法（除非曾经出过 bug）

可衡量标准：

- 新增或修改导出 contract、schema、纯规则或共享 runtime 必须新增/更新对应 unit/integration coverage
- 对高风险热点（`BookmarksPanel`、`ReaderPanel`、`ChatGPTPromptAutocompleteController`、协议与存储写入路径）优先补齐用例

---

## 5. 当前已执行边界与人工验收范围

- contract、runtime、adapter、settings、Reader/Bookmarks/Prompt flow 都有可定位的 unit/integration 入口；release/bundle/manifest 仍由独立 governance 与 build gate 负责。
- UI coverage manifest、token graph、auto-discovered style audit、Family-token registry、architecture-closure tests 和 real-component visual harness 都是当前可执行合同，不依赖阶段性 artifact 路径。
- mock 必须从 Git-tracked clean checkout 可发现；coverage gate 同时验证 production owner、trigger test 和 direct/family evidence，Panel Studio 一类重绘页不能进入覆盖分母。
- Chromium visual harness 负责可重复的 theme/locale/motion/viewport/overflow/console evidence；它不代替 Chrome MV3 与 Firefox MV2 installed-extension manual regression，也不把整页像素完全相等作为唯一正确性证明。
- 结构化 geometry、ARIA、focus、cleanup、hydration replacement 和真实入口行为继续由 Vitest/trigger tests 负责；人工回归负责宿主页面、浏览器引擎与真实交互手感。

---

## 6. 治理文档关系

- 当前必须运行的命令和按变更类型选 gate：`docs/testing/CURRENT_TEST_GATES.md`
- 完整双浏览器人工回归：`docs/testing/E2E_REGRESSION_GUIDE.md`
- UI 语义 catalog 与响应式合同：`docs/design.md`
- UI 收敛阶段历史与 Phase 7 closeout evidence：`docs/refactor/UI_SYSTEM_REFACTOR_PLAN.md`
- 本文只定义长期测试架构与扩展原则，不记录一次运行的通过数字。

---

## 7. Entry Bundle Release Gates

针对浏览器扩展 entry（尤其 `content.js` / `background.js`）及其受控 feature module graph，构建门禁必须覆盖“运行时加载格式”而不只看 TypeScript/单测是否通过。

要求：

- manifest 直接执行的 classic entry bundle 不得包含 top-level `import`，并必须能作为 classic script 解析
- `background.js` 不得包含运行时 chunk 加载；`content.js` 只允许用 `browser.runtime.getURL()` 生成固定 `content-features.js` URL。真实图片动作进入 lazy feature 后，host client 才允许用同一固定 asset contract 解析 `export-renderer.html`；不得出现 bundler 自动生成的 host-relative `./assets/*` chunk、任意脚本文本执行或 host page URL
- `reader.js`、`content-features.js` 与 `content-feature-chunks/*.js` 必须作为 ES modules 解析；feature facade 必须保留约定的 callable exports，preload/chunk URL 必须以 `import.meta.url` 解析到 extension origin
- `export-renderer.js` 与 `export-renderer-chunks/*.js` 必须作为 ES modules 解析，`png-encoder-worker.js` 必须可独立执行；只有 `export-renderer.html` 对 host 暴露，renderer chunks/worker 由 extension page 内部解析
- Chrome 与 Firefox manifest 必须从共享 asset contract 暴露 facade/chunk/renderer host resources；门禁同时作用于 Chrome MV3 与 Firefox MV2 产物

原因：

- content script 运行时一旦被 entry 格式问题打断，会导致工具栏注入、右下角页面控制区、Reader 等上层 UI 全部“看起来一起失效”
- 这类问题可能通过单元测试和常规 build，但会在真实页面里以 `Unexpected token 'export'` 之类运行时错误暴露

执行口径：

- 保持 `scripts/verify-extension-entry-format.sh` 作为 release gate，并执行 facade export 校验
- 每次引入新的 markdown/runtime enhancement、懒加载库或 content-side UI enhancement 时，必须重新验证 classic startup entry 独立可执行、启动期没有 feature module 请求、真实 UI trigger 能加载对应 module 且没有 host-origin chunk 请求

---

## 8. Image Export Verification Blueprint

图片导出测试必须按五层拆开，避免只在 jsdom 中 mock 掉 Canvas/iframe/clipboard 后宣称链路完成：

1. **语义层**：`ReaderItem[] -> ChatTurn[] -> ExportDocumentV1` 的顺序、去重、空选择、标题/label 与 Markdown canonical 语义。
2. **规划层**：倍率阶梯、硬预算、最少 part 数、文件名、消息/block band 边界、超宽 code/table/formula/image policy。
3. **编码层**：已知 RGBA 的真实 PNG decode、CRC/IDAT/IEND、单一 zlib stream、取消、backpressure 与 band 连续性。
4. **运行时层**：built-renderer browser harness 验证真实 Chromium/Firefox 引擎中的 iframe + MessageChannel + worker、PNG decode 与 capability 产物；installed-extension/真实入口 gate 另行验证 extension-origin lazy façade、FIFO/cache/reconnect、WAR 和 Clipboard/Download。两者不得互相替代。
5. **产品层**：Toolbar Copy PNG、Save Messages 多选、公式 hover、Clipboard/Download fallback、Chromium/Firefox visual golden 与 12k/30k/60k benchmark。

Release gate 不允许用单一 unit suite 替代真实 renderer harness，也不允许用最后一张 mock canvas 证明“没有总高度 Canvas”。固定阈值、fixture、命令与双端验收见 `docs/testing/IMAGE_EXPORT_GATES.md`。
