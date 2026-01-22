---
description: 发版准备工作流 - 从扫描到发布的完整SOP
---

# 发版准备工作流

> **触发命令**: `/release`
> **使用 Artifact**: `task.md` (跟踪发版步骤)
> **激活 Skill**: `verification-before-completion` (Build 验证)

## 🚨 Critical Rules (红线规则)

> [!CAUTION]
> 发版前必须遵守的规则。

| 规则 | 原因 |
|:-----|:-----|
| **必须扫描 debug 代码** | console.log/TODO/FIXME 不应进入发布版 |
| **必须同步版本号** | package.json 和 manifest.json 必须一致 |
| **必须 build 成功** | 编译失败不可发版 |
| **必须更新 CHANGELOG** | 记录版本变更内容 |
| **禁止 git checkout 回滚** | 用户明确禁止 |

---

## Phase 1: 预发布扫描 (Pre-flight Scan)

### 1.1 Debug 代码扫描

```bash
// turbo
echo "=== 扫描 console.log ==="
grep -rn "console\.log" src/ --include="*.ts" | head -20

// turbo
echo "=== 扫描 TODO ==="
grep -rn "TODO" src/ --include="*.ts" | head -10

// turbo
echo "=== 扫描 FIXME ==="
grep -rn "FIXME" src/ --include="*.ts" | head -10

// turbo
echo "=== 扫描 debugger ==="
grep -rn "debugger" src/ --include="*.ts"
```

### 1.2 版本号检查

```bash
// turbo
echo "=== package.json 版本 ==="
grep '"version"' package.json

// turbo
echo "=== manifest.json 版本 ==="
grep '"version"' manifest.json
```

---

## Phase 2: 用户确认 (Manual Stop)

> [!IMPORTANT]
> **必须停止**，使用 `notify_user` 请求用户确认。

```
请用户确认以下信息：

1. **目标版本号**: (例如 2.3.0)
2. **Commit Message**: (例如 "Release v2.3.0: Add Reader Panel improvements")
3. **Logger 级别**: 是否切换为 WARN? (生产环境建议 WARN)
4. **扫描结果处理**: 上面扫描到的 console.log/TODO 是否需要先处理?
```

---

## Phase 3: 版本更新 (Updates)

### 3.1 更新 package.json

```typescript
// 修改 version 字段为用户指定版本
{
  "version": "X.Y.Z"
}
```

### 3.2 更新 manifest.json

```typescript
// 修改 version 字段，必须与 package.json 一致
{
  "version": "X.Y.Z"
}
```

### 3.3 更新 Logger 级别 (如需要)

```typescript
// src/utils/logger.ts
// 将 DEFAULT_LEVEL 改为 WARN
const DEFAULT_LEVEL = LogLevel.WARN;
```

### 3.4 更新 CHANGELOG.md
1. **替换标题**: 将 `## [Unreleased]` 直接替换为 `## [X.Y.Z] - YYYY-MM-DD`。
2. **检查内容**: 确保所有新功能和修复都已包含在内。
3. **保留格式**: 保持 Keep a Changelog 格式。

---

## Phase 4: 构建验证 (Build)

```bash
// turbo
npm run build
```

> [!WARNING]
> Build 失败时**禁止继续**。必须先修复问题。

---

## Phase 5: Git 提交与合并 (Commit & Merge)

### 5.1 提交预发布工作
在当前开发分支提交版本号、日志等更新：
```bash
git add .
git commit -m "chore: prepare release v{VERSION}"
```

### 5.2 合并到 main 分支
切换至 `main` 并使用 `--no-ff` 进行合并，以保留清晰的发布节点：
```bash
// 切换到 main
git checkout main

// 合并开发分支 (推荐包含核心特性文案)
git merge {current_branch} --no-ff -m "release: v{VERSION} 🚀 {SUMMARY_OF_FEATURES}"
```

### 5.3 打标签 (Tagging)
合并完成后立即在 `main` 分支打上版本标签：
```bash
git tag v{VERSION}
```

---

## Phase 6: 发布产物与推送 (Publishing)

### 6.1 生成发布包
将构建好的 `dist/` 目录打包，用于预览版分发或商店上传：
```bash
zip -r deployment.zip dist/
```

### 6.2 推送至远程仓库
```bash
git push origin main --tags
```

### 6.3 GitHub Release SOP
1. **Push**: 确保代码和标签已推送到远程。
2. **Draft**: 在 GitHub 项目页点击 **Releases** -> **Draft a new release**。
3. **Choose Tag**: 选择刚打好的 `v{VERSION}`。
4. **Content**: 
   - **Title**: `AI-MarkDone v{VERSION}: {CORE_THEME}`
   - **Description**: 粘贴 `CHANGELOG.md` 中对应版本的内容。
5. **Assets**: 拖入 `deployment.zip`。
6. **Publish**: 点击发布。

---

## Phase 7: Chrome Web Store (Final Scan)
1. 使用 `deployment.zip` 上传到 Chrome Developer Dashboard。
2. 提交审核。

---

## ✅ 发版检查清单

- [ ] **Phase 1**: Debug 代码已扫描并处理
- [ ] **Phase 2**: 用户已确认版本号和 commit message
- [ ] **Phase 3**: package.json 版本已更新
- [ ] **Phase 3**: manifest.json 版本已更新 (与 package.json 一致)
- [ ] **Phase 3**: Logger 级别已调整 (如需要)
- [ ] **Phase 3**: CHANGELOG.md 已更新
- [ ] **Phase 4**: `npm run build` 成功
- [ ] **Phase 5**: Git commit 已创建
- [ ] **Phase 6**: 用户已通知后续步骤