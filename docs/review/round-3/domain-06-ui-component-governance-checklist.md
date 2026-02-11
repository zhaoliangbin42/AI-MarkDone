# Domain 06 Checklist：UI 组件与交互状态治理

## A. 组件复杂度治理（自动）

- [x] 关键超大文件行数基线已固化（guard）
- [ ] 超大组件（如书签主面板）拆分计划已落地到子模块
- [ ] 新增 UI 逻辑默认落入子模块，不再追加到超大文件

## B. 交互状态一致性（自动 + 手工）

- [x] 基础组件（Button/Input/Checkbox）无直接 icon `innerHTML` 注入
- [x] 核心面板（书签/阅读器）状态切换路径有最小回归用例
- [ ] 手工确认组件状态（disabled/loading/checked/indeterminate）视觉一致

## C. 回归与门禁（自动）

- [x] `test:core` 包含组件治理守卫（文件体积）
- [ ] 关键组件拆分后补充对应单测
