# ADR-0002-dual-browser-target

## Status

Accepted

## Context

项目需要同时支持 Chrome MV3 和 Firefox MV2。两者的 manifest 和 background runtime 模型不同，但用户可见能力和大部分实现路径应尽可能一致。

## Decision

保留双浏览器目标，运行时差异集中在 manifest 和少量 runtime compatibility 层，核心 handler、contracts 与绝大多数 content-side 逻辑尽量共享。

## Consequences

- 需要长期维护双目标构建验证
- shared contracts 和 build gates 变得更重要
- 发布和文档必须始终关注双浏览器一致性
