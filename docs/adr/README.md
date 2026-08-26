# Architecture Decision Records

本目录保存高影响、难逆转、值得追溯的工程决策。

## When To Write An ADR

新增或更新 ADR 的典型场景：

- 调整运行时边界或依赖方向
- 调整浏览器支持策略
- 选择长期保留的协议、契约或治理方式
- 引入未来回退成本高的工程方向

## What Not To Record

- 普通重构
- 局部实现细节
- 可以直接从代码与测试看出的低风险变化

## Naming

文件名格式：

- `ADR-0001-short-kebab-title.md`

编号递增，标题保持简短。

当前 ChatGPT 内容生命周期见 [ADR-0024-chatgpt-dom-authoritative-content-pool.md](ADR-0024-chatgpt-dom-authoritative-content-pool.md)、[ADR-0025-chatgpt-stable-message-identity-and-local-actions.md](ADR-0025-chatgpt-stable-message-identity-and-local-actions.md)、[ADR-0026-chatgpt-persistent-host-slot-order.md](ADR-0026-chatgpt-persistent-host-slot-order.md)、[ADR-0027-chatgpt-bounded-monotonic-navigation.md](ADR-0027-chatgpt-bounded-monotonic-navigation.md)、[ADR-0028-chatgpt-staged-slot-hydration.md](ADR-0028-chatgpt-staged-slot-hydration.md) 与 [ADR-0030-chatgpt-get-seed-dom-completion.md](ADR-0030-chatgpt-get-seed-dom-completion.md)：5.3 的 bridge/source 只负责初始 `get` seed，渲染 DOM 是最终正文与 slot 顺序权威。Repository 内部保留 source order 与 DOM slot 骨架的同一池投影；公共 V1 只发布稠密 turns，不伪造未知历史。`get` snapshot 可供 Directory、Reader、Export 使用；当前 runtime 不通过页面进入时的全量 DOM sweep 制造 `complete`。`conversation-turn-N` 不是持久序号；公式、当前消息动作与工具栏继续保持 DOM-local。页面注释入口的选区、Prompt 组合和管理器边界见 [ADR-0023-page-annotation-interaction.md](ADR-0023-page-annotation-interaction.md)。

2026-08-26 的当前补充规则：Chrome/Firefox 普通进入先复用 5.3 document-start bridge/source seed；成功时同一 Repository 发布可用的 `historyStatus=get`，没有 source 时保持 DOM `partial`。空 `?message=` 只用于让 ChatGPT 创建官方导航骨架，不再启动逐 slot 全量 DOM 滚动。Directory、同页书签、Stepper 与跨页 bookmark restore 均通过同一个 `ConversationNavigationCoordinator` 和 target materialization executor；跨页书签仅在必要时保存 pending target 并刷新页面。已有 assistant identity 的 DOM 正文始终覆盖 GET 正文，DOM 外层 slot 顺序最终覆盖 provisional source order。旧 `ChatGPTTopScrollController`、`autoTopTimeoutMs` 与全量逐 slot discovery controller 已删除。

[ADR-0019-completion-evidence-tiers-and-bounded-resweeps.md](ADR-0019-completion-evidence-tiers-and-bounded-resweeps.md) 窄化 ADR-0018 的「正文永不改写」：`bounded-quiet` 证据入池的 weak-sealed 正文可被同 identity 的更强完成证据（strong DOM 观察或重叠 Graph）原位升级；同等证据永不改写。同时增加有界 deferred re-sweep 让安静页面上的失败候选不再永久缺失。

[ADR-0020-payload-declared-graph-identity-and-gate-rearm.md](ADR-0020-payload-declared-graph-identity-and-gate-rearm.md) 扩展主动链：桥接受 payload 声明当前 canonical ID 的同源 JSON GET（URL 不必携带 ID，声明其它会话的 payload 计数为 rejected）；`reopenBaselineGate()` 对尚未建立 baseline 的 gate 做一次有界 re-peek，对已建立 baseline 的 gate 只武装一次单调 upgrade peek，消费者 `refresh()` 契约不变，扩展仍零请求。

## Required Sections

- Context
- Decision
- Consequences
- Status

模板见 `docs/adr/ADR_TEMPLATE.md`。
