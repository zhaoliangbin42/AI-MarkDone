# ADR-0003-ui-service-driver-layering

## Status

Accepted

## Context

项目同时处理页面 DOM、浏览器 API、跨 runtime 协议和复杂 UI。若 UI、用例编排、driver 适配混杂，平台变更和重构成本会不断上升。

## Decision

采用 UI / Service / Driver 的逻辑分层，并通过 `docs/architecture/DEPENDENCY_RULES.md` 把依赖方向收敛为可验证约束。

## Consequences

- 平台差异更容易被收敛到 driver 层
- service 更适合承载跨站共享逻辑
- 迁移期间需要持续修正文档与代码的旧路径描述
