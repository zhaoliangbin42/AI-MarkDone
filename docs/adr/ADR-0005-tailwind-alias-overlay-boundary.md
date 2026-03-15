# ADR-0005-tailwind-alias-overlay-boundary

## Status

Accepted

## Context

AI-MarkDone 的页面内 UI 同时存在两类明显不同的 surface：

- 高频重复注入的 message toolbar
- 低频单例富交互的 overlay，例如 panel、dialog、popover

如果对两类 surface 强行使用同一套重型 UI authoring/runtime，toolbar 会承受不必要的运行时与样式分发成本；如果完全放任各模块自由选型，又会把 token、主题、视觉语义和测试流程拆散成多套体系。

项目已经以 `--aimd-*` 为 UI 视觉入口，并以 Shadow DOM 作为页面内 UI 的默认隔离策略。下一阶段需要在不放弃统一设计系统的前提下，为 overlay UI 引入更高效的 authoring 方式，同时为未来的 mock-first 视觉流程建立清晰边界。

## Decision

采用“分渲染密度，不分设计系统”的折中架构：

- `--aimd-*` 继续作为唯一 canonical design token source
- Tailwind 只允许用于 overlay-style singleton UI 的 authoring 层
- Tailwind 只能通过语义 alias 映射消费 `--aimd-*`，不拥有独立产品值
- Tailwind 必须使用 `tw` 前缀并禁用 Preflight
- Toolbar、inline message UI、其他高频重复注入 surface 禁止使用 Tailwind
- 所有新 UI 模块在迁入插件前，必须先通过 `mocks/components/<module>/index.html` 的 mock-first 浏览器视觉验收
- Ariakit 退出活跃规范链，保留为历史参考文档

## Consequences

- 正向收益
  - overlay UI 可以获得更高效的 authoring 体验，而不把重型样式运行时扩散到 toolbar
  - 主题、token、视觉语义仍维持单一真源
  - mock-first 浏览器验收成为正式门禁，UI 视觉调优可以先在隔离环境完成
- 明确代价
  - UI 团队需要维护“toolbar 轻量实现”与“overlay Tailwind authoring”两种实现心智
  - 必须额外维护 Tailwind alias 边界与浏览器视觉验收流程
  - 后续需要引入并维护 `OverlayHost`、`ShadowStyleRegistry` 等基础能力
- 后续需要同步维护的文档或代码区域
  - `docs/style/STYLE_SYSTEM.md`
  - `docs/style/STYLE_ARCHITECTURE.md`
  - `docs/testing/TESTING_BLUEPRINT.md`
  - `docs/testing/CURRENT_TEST_GATES.md`
  - `.codex/rules/style-guide.md`
