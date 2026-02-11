# Domain 12 Findings：视觉一致性专项（首轮）

## 总览

- 已完成自动扫描与分级。
- 当前主要矛盾不是“完全没 token”，而是“token + fallback + 局部硬编码并存”，导致一致性依赖运行时路径。

## P0（优先立即修复）

### P0-1 代码块层级可辨识性不足
- 现象：在部分主题/背景下，`pre` 与外层容器对比不够，代码块边界弱。
- 影响范围：阅读模式 Markdown 渲染（长代码回答场景）。
- 建议：统一 `pre/code` 对比策略（背景差异 + 边框 + 轻阴影），并加入主题对照验收项。

## P1（本轮应修复）

### P1-1 Save Messages Dialog fallback 密度过高
- 文件：`src/content/features/save-messages-dialog.css.ts`
- 现象：大量 `var(--x, #xxxxxx)`，同一语义在多处重复。
- 风险：主题 token 缺失或命名变更时，界面会静默退回到旧视觉语义。
- 建议：建立局部语义别名层（如 `--aimd-dialog-*`），减少直接业务层 fallback。

### P1-2 样式职责分散
- 文件：`src/renderer/styles/StyleManager.ts`、`src/content/utils/ReaderPanelStyles.ts`
- 现象：markdown 与容器样式分层正确，但存在重复定义趋势。
- 风险：后续改动时出现“改一处漏一处”。
- 建议：固定职责边界（Renderer 管 markdown 元素，Reader 管容器与布局）。

## P2（收尾优化）

### P2-1 零散硬编码色值
- 文件：
  - `src/content/features/re-render.ts`
  - `src/content/utils/tooltip-helper.ts`
  - `src/content/features/math-click.ts`
  - `src/content/features/deep-research-handler.ts`
- 建议：逐步迁移至语义 token，清理 `#FFFFFF` / `#2563EB` 等常量色。

## 下一批次执行顺序

1. 批次 1（P0）：代码块层级与可读性统一。
2. 批次 2（P1）：Dialog token 收敛、fallback 降噪。
3. 批次 3（P2）：零散硬编码统一迁移。
