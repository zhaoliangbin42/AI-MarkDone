# Design System (Authoritative Entry)

本文件是设计系统的权威入口，定义 UI 组件层在样式与 token 使用上的总原则。

具体 token 列表与用法参考：

- `docs/antigravity/style/TOKEN_REFERENCE.md`

---

## 1. 原则

- 所有 UI 样式必须使用 `--aimd-*` 语义 token
- 禁止硬编码颜色/尺寸（由红线规则约束）
- Shadow DOM UI 必须自带样式注入，避免依赖页面全局 CSS

