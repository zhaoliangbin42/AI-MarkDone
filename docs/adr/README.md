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

当前 ChatGPT 内容生命周期见 [ADR-0017-chatgpt-baseline-and-host-tail-lifecycle.md](ADR-0017-chatgpt-baseline-and-host-tail-lifecycle.md)：官网自有 conversation GET 只被动建立一次完整历史基线，随后由共享 Page Monitor 将稳定的新 DOM 消息追加到同一份可消费缓存；同一个 V1 content/materialization seam 服务目录、Reader、书签、复制、公式、字数与导出。ADR-0015 的被动网络边界继续有效，ADR-0016 的 snapshot-first 消费继续有效，但其重复 refresh、partial/stale content 与分支替换语义由 ADR-0017 取代。ADR-0014 的稳定 compiler 能力已被吸收，第二 observer/第二生产仓库仍被 supersede。

## Required Sections

- Context
- Decision
- Consequences
- Status

模板见 `docs/adr/ADR_TEMPLATE.md`。
