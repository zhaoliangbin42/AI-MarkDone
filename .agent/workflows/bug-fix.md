---
description: Bug 修复工作流 - 从复现到验证的完整SOP
---

# Bug 修复工作流

> 触发命令: `/bugfix`

---

## 🚨 Critical Rules (红线规则)

| 规则 | 原因 |
|:-----|:-----|
| **必须先复现** | 不能复现的 Bug 不能盲目修复 |
| **只修必要代码** | 不趁机重构其他代码 |
| **保持接口兼容** | 修复不应改变公共接口语义 |
| **添加防护代码** | 修复后增加边界检查和日志 |
| **禁止 `sed` 替换** | 使用精确的代码编辑工具 |

---

## Phase 1: 理解问题

> **使用 Artifact**: `implementation_plan.md` (记录问题描述)

### 1.1 收集信息

使用 `notify_user` 请求用户提供：
1. 问题描述: 期望行为 vs 实际行为
2. 复现步骤: 具体操作步骤
3. 相关日志: 控制台输出或截图

---

## Phase 2: 定位问题

> **激活 Skill**: `systematic-debugging` (强制)

**必须按照 systematic-debugging 的四阶段流程执行**：
1. Root Cause Investigation (根因调查)
2. Pattern Analysis (模式分析)
3. Hypothesis and Testing (假设验证)
4. Implementation (实施修复)

### 2.1 日志追踪

```bash
// turbo
grep -rn "\[ModuleName\]" src/ --include="*.ts"
```

---

## Phase 3: 修复问题

> **使用 Artifact**: `task.md` (跟踪修复步骤)

### 3.1 修复原则

| 原则 | 说明 |
|:-----|:-----|
| **最小侵入** | 只修改导致 Bug 的代码 |
| **添加日志** | 在关键路径添加调试日志 |
| **边界检查** | 添加空值检查和类型验证 |
| **优雅降级** | 确保失败时不会崩溃 |

### 3.2 修复模板

```typescript
// ❌ 修复前
const result = riskyOperation();
doSomething(result.value);

// ✅ 修复后：添加防护
const result = riskyOperation();
if (!result || result.value === undefined) {
    logger.warn('[ModuleName] Unexpected result:', result);
    return fallbackValue;
}
doSomething(result.value);
```

> **🛑 用户调试点**
> 
> 修复代码完成后暂停，请用户：
> 1. 按原复现步骤验证问题已解决
> 2. 确认没有引入新问题
> 3. 回复"继续"进入验证阶段

---

## Phase 4: 验证修复

> **激活 Skill**: `verification-before-completion`

### 4.1 编译检查

```bash
// turbo
npm run build
```

---

## Phase 5: 总结

> **使用 Artifact**: `walkthrough.md`

### 5.1 更新 CHANGELOG

```markdown
## [Unreleased]

### Fixed
- **[模块名]**: 修复了 [问题描述]
```

---

## ✅ 完成检查清单

- [ ] Phase 1: 问题已完整理解，可以复现
- [ ] Phase 2: 根本原因已确认 (使用 systematic-debugging)
- [ ] Phase 3: 修复完成，用户已调试确认
- [ ] Phase 4: `npm run build` 成功
- [ ] Phase 5: CHANGELOG 已更新

**结束条件**: 用户确认问题已解决，无新问题引入
