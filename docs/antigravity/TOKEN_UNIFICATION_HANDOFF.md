# Token 系统统一化重构任务指引

> **用途**: 冷启动新 Agent 解决 Design Token 架构问题
> **创建时间**: 2026-01-04
> **项目路径**: `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone`

---

## 一、问题概述

项目存在 **两套 Design Token 定义系统**，导致 Shadow DOM 组件无法访问部分 tokens，产生样式失效问题。

### 1.1 当前症状
- Delete 对话框按钮不显示红色背景
- Move To 对话框描述文字不可见
- 部分组件使用的 `--aimd-*` tokens 未生效

### 1.2 根本原因
| 系统 | 位置 | 加载方式 | Shadow DOM 兼容 |
|------|------|---------|----------------|
| CSS 文件 | `src/styles/tokens/*.css` | 外部 CSS | ❌ 无法穿透 |
| TS 模块 | `src/utils/design-tokens.ts` | JS 注入到 `:host` | ✅ 兼容 |

两套系统定义了相同命名的 tokens，但**内容不同步**，导致 Shadow DOM 组件找不到 CSS 文件中定义的 tokens。

---

## 二、目标

### 2.1 主目标
**建立单一真相源 (Single Source of Truth)**：统一使用 `design-tokens.ts`，废弃 `styles/tokens/*.css`

### 2.2 具体目标
1. 将 `components.css` 中独有的 tokens 迁移到 `design-tokens.ts`
2. 确保所有 Shadow DOM 组件使用的 tokens 都能正确解析
3. 清理废弃的 CSS token 文件
4. 更新项目文档

---

## 三、核心文件

### 3.1 必读文件（理解架构）

| 文件 | 路径 | 说明 |
|------|------|------|
| **design-tokens.ts** | `src/utils/design-tokens.ts` | TS Token 定义，当前唯一有效的 Token 源 |
| **components.css** | `src/styles/tokens/components.css` | 待废弃的 CSS Token 文件 |
| **index.css** | `src/styles/tokens/index.css` | CSS Token 入口，导入 3 层 CSS |

### 3.2 需要修改的文件

| 文件 | 说明 |
|------|------|
| `src/utils/design-tokens.ts` | 在 `getAimdSemanticTokens()` 中补充缺失 tokens |
| `manifest.json` | 移除 `web_accessible_resources` 中的 token CSS |
| `src/styles/tokens/` | 废弃或删除整个目录 |

### 3.3 参考文件（使用 tokens 的组件）

| 文件 | 说明 |
|------|------|
| `src/bookmarks/components/SimpleBookmarkPanel.ts` | 主要书签面板，使用大量 tokens |
| `src/bookmarks/components/BookmarkSaveModal.ts` | 保存/移动对话框 |

---

## 四、缺失的 Tokens 清单

以下 tokens 在 `components.css` 中定义，但 `design-tokens.ts` 中**缺失**：

| Token 名称 | 使用位置 | 建议值 (暗色) | 建议值 (亮色) |
|-----------|---------|--------------|--------------|
| `--aimd-button-icon-active` | SimpleBookmarkPanel.ts:4497,4653 | `rgba(255,255,255,0.15)` | `rgba(0,0,0,0.08)` |
| `--aimd-modal-tree-bg` | BookmarkSaveModal.ts:95 | `#27272A` | `#F9FAFB` |
| `--aimd-modal-tree-item-hover` | BookmarkSaveModal.ts:98 | (同 `--aimd-interactive-hover`) | |
| `--aimd-modal-tree-item-icon` | BookmarkSaveModal.ts:103 | (同 `--aimd-text-secondary`) | |
| `--aimd-modal-tree-item-text` | BookmarkSaveModal.ts:104 | (同 `--aimd-text-primary`) | |
| `--aimd-modal-shadow` | SimpleBookmarkPanel.ts:5416,5843 | (同 `--aimd-shadow-2xl`) | |

---

## 五、执行步骤

### Phase 1: 补充缺失 Tokens (快速止血)

1. 打开 `src/utils/design-tokens.ts`
2. 找到 `getAimdSemanticTokens(isDark: boolean)` 方法
3. 在暗色模式部分（约 line 1000+）添加缺失的 tokens
4. 在亮色模式部分（约 line 1200+）添加对应的亮色值
5. 运行 `npm run build` 验证

### Phase 2: 废弃 CSS Token 文件

1. 修改 `manifest.json`，从 `web_accessible_resources` 移除:
   ```diff
   - "styles/*.css",
   - "styles/tokens/*.css"
   ```
2. 在 `src/styles/tokens/` 目录添加 `DEPRECATED.md` 说明

### Phase 3: 代码清理

1. 搜索所有使用 `components.css` 独有 token 的代码
2. 确认这些 tokens 现在可以从 `design-tokens.ts` 获取
3. 运行完整测试

### Phase 4: 文档更新

1. 更新 `docs/` 中的 Token 相关文档
2. 说明新的 Token 使用方式

---

## 六、验证方法

```bash
# 1. 构建项目
npm run build

# 2. 检查是否有 CSS 变量未定义警告
# 在浏览器 DevTools 中检查 Shadow DOM 元素的 computed styles

# 3. 视觉验证
# - Delete 对话框按钮应为红色
# - Move To 对话框应显示 "Moving X bookmarks" 文字
```

---

## 七、项目规范参考

请遵循项目的 AI 开发规范：
- **规范文件**: `docs/development-rules.md`
- **样式修改工作流**: `.agent/workflows/style-modification.md`

### 关键规则
1. 禁止使用 `!important`
2. 禁止使用硬编码颜色值（必须使用 `--aimd-*` tokens）
3. 修改后必须运行 `npm run build` 验证
4. 不使用 `sed` 或批量替换

---

## 八、联系上下文

### 已完成的修复
- Delete 按钮已临时改用 `--aimd-interactive-danger` 替代 `--aimd-button-danger-bg`
- Move To 文字颜色已改用 `--aimd-text-primary`
- showMergeDialog 已重构为 Shadow DOM 模式

### 待解决
- 根本性的 Token 统一化（本任务）
- 内联样式迁移（style.cssText → CSS 类）

---

## 九、预期成果

1. **单一 Token 源**: 所有 tokens 统一在 `design-tokens.ts` 定义
2. **Shadow DOM 完全兼容**: 所有组件的 tokens 都能正确解析
3. **可维护性提升**: 无需在两处同步 token 定义
4. **文档完善**: 清晰的 Token 使用指南
