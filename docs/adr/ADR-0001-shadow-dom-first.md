# ADR-0001-shadow-dom-first

## Status

Accepted

## Context

AI-MarkDone 需要在多个 AI 站点中注入 UI。宿主页面会频繁改动样式、字体和层级，如果扩展 UI 直接暴露在宿主样式环境中，回归风险和选择器冲突都会明显上升。

## Decision

页面内扩展 UI 默认以 Shadow DOM 为第一选择。例外场景必须在样式或架构文档中显式记录。

## Consequences

- UI 样式隔离更稳定
- 组件可以围绕 `--aimd-*` token 建立统一样式入口
- 需要额外维护 token 注入和 popup container 等 Shadow DOM 细节
