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

当前 ChatGPT 内容生命周期见 [ADR-0018-chatgpt-identity-proven-single-content-pool.md](ADR-0018-chatgpt-identity-proven-single-content-pool.md)、[ADR-0021-monotonic-passive-graph-upgrades.md](ADR-0021-monotonic-passive-graph-upgrades.md) 与 [ADR-0022-page-lifecycle-wake-reconciliation.md](ADR-0022-page-lifecycle-wake-reconciliation.md)：Runtime page identity 让无 ID 的稳定 DOM 消息也能进入唯一内容池；后到 canonical token 只提升 identity；可信 Graph 使用单调 identity/order containment 汇合，允许完整 envelope 和后续更大 revision 增长；`resume` 与 `pageshow` 通过一次有界唤醒汇合恢复冻结后页面。`ChatGPTConversationSurface` 是内容池与 PageIndex 的唯一生产 join，统一驱动 Directory、Toolbar、Stepper 和导航；Reader、复制、公式、字数与导出读取同一 Content Port。无 ID 时书签不可用且不发请求，既有书签数据与协议不变。旧 Discovery Coordinator、Conversation Index 与独立 Materialization 已删除。页面注释入口的选区、Prompt 组合和管理器边界见 [ADR-0023-page-annotation-interaction.md](ADR-0023-page-annotation-interaction.md)。ADR-0005/0007/0009、ADR-0013 至 ADR-0017 的 ChatGPT discovery/projection 语义均为历史记录；ADR-0011 只继续约束通用 Semantic Content 与 source/surface proof。

[ADR-0019-completion-evidence-tiers-and-bounded-resweeps.md](ADR-0019-completion-evidence-tiers-and-bounded-resweeps.md) 窄化 ADR-0018 的「正文永不改写」：`bounded-quiet` 证据入池的 weak-sealed 正文可被同 identity 的更强完成证据（strong DOM 观察或重叠 Graph）原位升级；同等证据永不改写。同时增加有界 deferred re-sweep 让安静页面上的失败候选不再永久缺失。

[ADR-0020-payload-declared-graph-identity-and-gate-rearm.md](ADR-0020-payload-declared-graph-identity-and-gate-rearm.md) 扩展主动链：桥接受 payload 声明当前 canonical ID 的同源 JSON GET（URL 不必携带 ID，声明其它会话的 payload 计数为 rejected）；`reopenBaselineGate()` 对尚未建立 baseline 的 gate 做一次有界 re-peek，对已建立 baseline 的 gate 只武装一次单调 upgrade peek，消费者 `refresh()` 契约不变，扩展仍零请求。

## Required Sections

- Context
- Decision
- Consequences
- Status

模板见 `docs/adr/ADR_TEMPLATE.md`。
