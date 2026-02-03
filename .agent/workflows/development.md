---
description: 新功能开发工作流 - 从需求到验证的完整SOP
---

# 新功能开发工作流

> 触发命令: `/develop`

---

## 🚨 Critical Rules (红线规则)

> [!CAUTION]
> 以下规则必须严格遵守，违反将导致代码质量问题。

| 规则 | 原因 |
|:-----|:-----|
| **禁止 `sed` 批量替换** | 不可控，易破坏代码 |
| **禁止 `git checkout` 回滚** | 用户明确禁止 |
| **禁止添加 `!important`** | 破坏 CSS 层叠机制 |
| **禁止硬编码颜色/尺寸** | 必须使用 `--aimd-*` Token |
| **禁止未搜索就修改** | 必须 `grep` 确认所有调用点 |
| **禁止假设文件存在** | 必须先搜索确认 |

---

## Phase 1: 需求分析

> **使用 Artifact**: `implementation_plan.md`
> **激活 Skill**: `brainstorming` (必须)

### 1.1 Brainstorming (必须)

新功能开发**必须**先激活 `brainstorming` skill 探索需求：

| 触发条件 | 说明 |
|:---------|:-----|
| 新增功能 | Adding functionality |
| 行为修改 | Modifying behavior |
| 组件创建 | Creating components |

**对话技巧：**
- 一次只问一个问题
- 提供多选项供选择 (A/B/C)
- 分段呈现设计 (200-300字/段)

### 1.2 生成实现计划

Antigravity 将自动生成 `implementation_plan.md`，等待用户 Review。

产出: `~/.gemini/.../implementation_plan.md` (需用户确认)

---

## Phase 2: 架构评估

```bash
// turbo
# 搜索相关代码
grep -rn "相关关键词" src/ --include="*.ts"

// turbo
# 检查平台适配器
grep -rn "相关选择器" src/content/adapters/
```

---

## Phase 3: 执行开发

> **使用 Artifact**: `task.md` (任务跟踪)
> **激活 Skill**: `test-driven-development` (按需)

### 3.1 开发原则

| 原则 | 说明 |
|:-----|:-----|
| **最小变更** | 只修改必要的代码 |
| **搜索优先** | 修改前确认所有调用点 |
| **TDD** | 写代码前先写测试 (如适用) |

### 3.2 代码规范

```typescript
// ✅ 日志规范 (必须包含模块名)
logger.debug('[ModuleName] 操作描述', { key: value });

// ✅ 防御性编程
const element = document.querySelector(selector);
if (!element) {
    logger.warn('[ModuleName] Element not found:', selector);
    return;
}
```

> **🛑 用户调试点**
> 
> 核心功能实现后暂停，请用户：
> 1. 手动测试基本功能
> 2. 确认无问题后回复"继续"

---

## Phase 4: 验证

> **激活 Skill**: `verification-before-completion`

### 4.1 编译验证

```bash
// turbo
# 同时构建 Chrome 和 Firefox
npm run build
```

### 4.2 自我审查

```
请 think deeply 审查刚才的代码变更：
1. 完整性: 是否有遗漏的边界情况？
2. 健壮性: 是否正确处理了所有错误？
3. 一致性: 是否遵循项目现有模式？
```

---

## Phase 5: 总结

> **使用 Artifact**: `walkthrough.md`

Antigravity 将自动生成变更总结。

---

## Phase 6: 代码审查 (可选)

> **激活 Skill**: `requesting-code-review`

如需代码审查，使用此 skill 发起。

---

## Phase 7: 文档更新

### 7.1 文档更新矩阵

| 条件 | 需更新的文档 |
|:-----|:-------------|
| 新增/修改 Background 功能 | `docs/BROWSER_COMPATIBILITY.md` + 两个 background 文件 |
| 新增平台功能 | `CAPABILITY_MATRIX.md` |

### 7.2 更新 CHANGELOG

```markdown
## [Unreleased]

### Added
- **[功能名]**: 功能描述
```

---

## ✅ 完成检查清单

- [ ] Phase 1: 实现计划已获用户确认
- [ ] Phase 3: 代码修改完成，用户已调试确认
- [ ] Phase 4: `npm run build` 成功 (Chrome + Firefox)
- [ ] Phase 5: walkthrough 已生成
- [ ] Phase 7: CHANGELOG 已更新
- [ ] Background 变更已同步到两个浏览器

**结束条件**: walkthrough 已生成，用户已确认功能正常
