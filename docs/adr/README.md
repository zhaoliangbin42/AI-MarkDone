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

当前 ChatGPT 内容生命周期见 [ADR-0024-chatgpt-dom-authoritative-content-pool.md](ADR-0024-chatgpt-dom-authoritative-content-pool.md)：官方完成工具栏触发一次轻量 DOM 读取，渲染 DOM 是唯一正文权威，Repository 在当前标签页内按 conversation key 保存多个纯内存内容池，公式直接读取 DOM 上的 authoritative TeX。Graph bridge、baseline gate、弱/强完成等级和多轮重扫退出生产。`ChatGPTConversationSurface` 仍是内容池与 PageIndex 的唯一生产 join，现有 Reader、复制、导出、Toolbar 与 Directory 消费接口不变；Directory 只展示已加载的 partial 内容，不承诺完整历史。页面注释入口的选区、Prompt 组合和管理器边界见 [ADR-0023-page-annotation-interaction.md](ADR-0023-page-annotation-interaction.md)。ADR-0005/0007/0009、ADR-0013 至 ADR-0022 的 ChatGPT discovery/projection 语义均为历史记录；ADR-0011 只继续约束通用 Semantic Content 与 source/surface proof。

[ADR-0019-completion-evidence-tiers-and-bounded-resweeps.md](ADR-0019-completion-evidence-tiers-and-bounded-resweeps.md) 窄化 ADR-0018 的「正文永不改写」：`bounded-quiet` 证据入池的 weak-sealed 正文可被同 identity 的更强完成证据（strong DOM 观察或重叠 Graph）原位升级；同等证据永不改写。同时增加有界 deferred re-sweep 让安静页面上的失败候选不再永久缺失。

[ADR-0020-payload-declared-graph-identity-and-gate-rearm.md](ADR-0020-payload-declared-graph-identity-and-gate-rearm.md) 扩展主动链：桥接受 payload 声明当前 canonical ID 的同源 JSON GET（URL 不必携带 ID，声明其它会话的 payload 计数为 rejected）；`reopenBaselineGate()` 对尚未建立 baseline 的 gate 做一次有界 re-peek，对已建立 baseline 的 gate 只武装一次单调 upgrade peek，消费者 `refresh()` 契约不变，扩展仍零请求。

## Required Sections

- Context
- Decision
- Consequences
- Status

模板见 `docs/adr/ADR_TEMPLATE.md`。
