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

当前 ChatGPT 内容消费来源见 [ADR-0015-chatgpt-passive-graph-directory.md](ADR-0015-chatgpt-passive-graph-directory.md)：官网自有 conversation GET 只被动进入 Graph 主链，随后由同一个 V1 content/materialization seam 服务目录、Reader、书签、复制、公式、字数与导出。消费性能收敛见 [ADR-0016-chatgpt-snapshot-first-consumption.md](ADR-0016-chatgpt-snapshot-first-consumption.md)。V2 Slot Topology/Compiler 仅保留为隔离实验和测试，不能成为生产消费者的旁路。ADR-0014 的 V2 production-root 决策已被本次收敛明确 supersede。

## Required Sections

- Context
- Decision
- Consequences
- Status

模板见 `docs/adr/ADR_TEMPLATE.md`。
