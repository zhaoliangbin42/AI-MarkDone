# ADR-0004-docs-and-code-dual-contracts

## Status

Accepted

## Context

仅靠代码无法为新成员和 Codex 提供足够稳定的系统解释；仅靠文档又容易与实现漂移。协议、架构边界和测试门禁需要同时存在于代码和文档中。

## Decision

对高价值契约采用“代码定义 + 文档解释”的双层方式：代码提供精确 shape，文档提供边界、语义和更新规则。

## Consequences

- 协议、依赖方向、测试门禁更容易形成长期 source of truth
- 文档更新变成工程工作的一部分
- 需要最小文档门禁防止解释层失效
