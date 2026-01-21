---
description: 红线规则 - 绝对禁止违反的开发规则
---

# 🚨 Critical Rules (红线规则)

> [!CAUTION]
> 以下规则**绝对禁止**违反。违反任何一条将导致代码质量问题或用户数据损失。

## 禁止列表

| 规则 | 原因 |
|:-----|:-----|
| **禁止 `sed` 批量替换** | 不可控，易破坏代码结构 |
| **禁止 `git checkout` 回滚** | 用户明确禁止此操作 |
| **禁止添加 `!important`** | 破坏 CSS 层叠机制（例外：`@media print` 规则） |
| **禁止假设文件/函数存在** | 必须先 `grep` 搜索确认后再修改 |
| **禁止硬编码颜色/尺寸** | 必须使用 `--aimd-*` Design Token |
| **禁止未 build 就报告完成** | 必须 `npm run build` 验证成功 |

## 强制要求

| 规则 | 说明 |
|:-----|:-----|
| 修改前先搜索 | 使用 `grep` 确认目标代码位置 |
| 修改后验证 | 执行 `npm run build` 确保编译通过 |
| 接口变更更新文档 | 更新 `docs/antigravity/platform/ADAPTER_CONTRACT.md` |
