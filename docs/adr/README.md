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

当前 ChatGPT 内容生命周期见 [ADR-0018-chatgpt-identity-proven-single-content-pool.md](ADR-0018-chatgpt-identity-proven-single-content-pool.md)：Runtime page identity 让无 ID 的稳定 DOM 消息也能进入唯一内容池；后到 canonical token 只提升 identity 并打开一次被动 Graph gate，可信 Graph 最多补可靠历史前缀。`ChatGPTConversationSurface` 是内容池与 PageIndex 的唯一生产 join，统一驱动 Directory、Toolbar、Stepper 和导航；Reader、复制、公式、字数与导出读取同一 Content Port。无 ID 时书签不可用且不发请求，既有书签数据与协议不变。旧 Discovery Coordinator、Conversation Index 与独立 Materialization 已删除。ADR-0005/0007/0009、ADR-0013 至 ADR-0017 的 ChatGPT discovery/projection 语义均为历史记录；ADR-0011 只继续约束通用 Semantic Content 与 source/surface proof。

## Required Sections

- Context
- Decision
- Consequences
- Status

模板见 `docs/adr/ADR_TEMPLATE.md`。
