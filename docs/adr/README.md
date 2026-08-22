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

当前 ChatGPT 内容生命周期见 [ADR-0024-chatgpt-dom-authoritative-content-pool.md](ADR-0024-chatgpt-dom-authoritative-content-pool.md)、[ADR-0025-chatgpt-stable-message-identity-and-local-actions.md](ADR-0025-chatgpt-stable-message-identity-and-local-actions.md)、[ADR-0026-chatgpt-persistent-host-slot-order.md](ADR-0026-chatgpt-persistent-host-slot-order.md)、[ADR-0027-chatgpt-bounded-monotonic-navigation.md](ADR-0027-chatgpt-bounded-monotonic-navigation.md)、[ADR-0028-chatgpt-staged-slot-hydration.md](ADR-0028-chatgpt-staged-slot-hydration.md) 与 [ADR-0029-chatgpt-explicit-fast-top-and-configurable-seek.md](ADR-0029-chatgpt-explicit-fast-top-and-configurable-seek.md)：渲染 DOM 是唯一正文权威，直接 `data-message-id` 是稳定正文身份，最外层 `data-turn-id-container` 序列是当前 active display branch 的位置权威。Repository 内部保留已知空槽并按槽位投影已获得正文；公共 V1 仍只发布稠密 turns，未知历史不伪造数量。槽位拓扑与正文证据分阶段合并，后续 hydrate 的用户正文或 assistant 正文只能原位填充，不能按到达顺序追加。会动态重编号的 `conversation-turn-N` 不是持久序号。官方完成工具栏直接触发对应消息的插件工具栏和 DOM-local 动作，不等待 Repository admission；Repository 只负责 Reader、跨消息导出以及未来 Directory 所需的累积内容与严格已证明顺序。公式继续直接读取 DOM 上的 authoritative TeX。Graph bridge、baseline gate、弱/强完成等级和多轮重扫退出生产。Directory 展示已加载的 partial 内容，但对已进入内容池的目标，Directory、Stepper、Reader locate、Bookmark Go 与 pending navigation 通过有界单调寻迹完成精确 identity 跳转。显式的一键到顶是独立的用户动作：只对 adapter-owned scroll root 做瞬时 native top 操作，并在 20 秒默认期限内处理异步历史回跳，不改变 discovery 或消费者语义。页面注释入口的选区、Prompt 组合和管理器边界见 [ADR-0023-page-annotation-interaction.md](ADR-0023-page-annotation-interaction.md)。ADR-0005/0007/0009、ADR-0013 至 ADR-0022 的 ChatGPT discovery/projection 语义均为历史记录；ADR-0011 只继续约束通用 Semantic Content。

[ADR-0019-completion-evidence-tiers-and-bounded-resweeps.md](ADR-0019-completion-evidence-tiers-and-bounded-resweeps.md) 窄化 ADR-0018 的「正文永不改写」：`bounded-quiet` 证据入池的 weak-sealed 正文可被同 identity 的更强完成证据（strong DOM 观察或重叠 Graph）原位升级；同等证据永不改写。同时增加有界 deferred re-sweep 让安静页面上的失败候选不再永久缺失。

[ADR-0020-payload-declared-graph-identity-and-gate-rearm.md](ADR-0020-payload-declared-graph-identity-and-gate-rearm.md) 扩展主动链：桥接受 payload 声明当前 canonical ID 的同源 JSON GET（URL 不必携带 ID，声明其它会话的 payload 计数为 rejected）；`reopenBaselineGate()` 对尚未建立 baseline 的 gate 做一次有界 re-peek，对已建立 baseline 的 gate 只武装一次单调 upgrade peek，消费者 `refresh()` 契约不变，扩展仍零请求。

## Required Sections

- Context
- Decision
- Consequences
- Status

模板见 `docs/adr/ADR_TEMPLATE.md`。
