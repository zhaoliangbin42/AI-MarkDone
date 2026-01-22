# AI-MarkDone 开发规范

> 适用对象: AI Agent (Claude/Gemini/GPT) 及人类开发者  
> 版本: 4.1.0

---

## 项目概述

| 属性 | 值 |
|:-----|:---|
| 项目名称 | AI-MarkDone |
| 类型 | Chrome 浏览器扩展 (Manifest V3) |
| 目标平台 | ChatGPT, Gemini, Claude, Deepseek |
| 技术栈 | TypeScript, Vite, Shadow DOM |
| 核心功能 | 公式复制、Markdown 复制、实时预览、字数统计、书签管理 |

---

## 规则文件

开发前必须阅读对应规则文件。

| 规则 | 文件 | 说明 |
|:----|:----|:----|
| 红线规则 | [critical-rules.md](.agent/rules/critical-rules.md) | 绝对禁止违反 |
| CHANGELOG | [changelog.md](.agent/rules/changelog.md) | 变更日志格式 |
| 样式规范 | [style-guide.md](.agent/rules/style-guide.md) | CSS/Token 规则 |
| 日志规范 | [logging.md](.agent/rules/logging.md) | 日志格式与级别 |

---

## 工作流

输入斜杠命令触发对应工作流。

| 命令 | 工作流 | 用途 |
|:-----|:-------|:-----|
| `/develop` | [development.md](.agent/workflows/development.md) | 新功能开发 |
| `/bugfix` | [bug-fix.md](.agent/workflows/bug-fix.md) | Bug 修复 |
| `/changelog-maintenance` | [changelog-maintenance.md](.agent/workflows/changelog-maintenance.md) | Changelog 维护 SOP |
| `/review` | [code-review.md](.agent/workflows/code-review.md) | 代码审查 |
| `/style` | [style-modification.md](.agent/workflows/style-modification.md) | 样式修改 |
| `/release` | [release-preparation.md](.agent/workflows/release-preparation.md) | 发版准备 |
| `/adapt` | [platform-adaptation.md](.agent/workflows/platform-adaptation.md) | 新平台适配 |

---

## Artifacts 与 Skills

### Artifacts (Antigravity 内置)

| Artifact | 用途 | 生成时机 |
|:---------|:-----|:---------|
| `task.md` | 任务分解与进度跟踪 | Planning Mode 自动 |
| `implementation_plan.md` | 技术实现计划 | Planning Mode，需用户 Review |
| `walkthrough.md` | 完成后的变更总结 | Verification 后自动 |

### Skills (能力补充)

仅用于 Artifacts 未覆盖的能力：

| Skill | 用途 | 激活时机 |
|:------|:-----|:---------|
| `brainstorming` | 对话技巧（需求探索） | 需求不清晰时 |
| `systematic-debugging` | Bug 调试方法论 | `/bugfix` 强制 |
| `test-driven-development` | TDD 纪律 | 写代码前 |
| `verification-before-completion` | 完成前验证 | 声称完成前 |
| `requesting-code-review` | 发起代码审查 | `/review` |
| `receiving-code-review` | 响应审查反馈 | 收到反馈时 |

---

## Think Keywords

| 关键词 | 思考预算 | 适用场景 |
|:-------|:---------|:---------|
| `think` | ~4k tokens | 简单代码分析 |
| `think deeply` | ~10k tokens | 代码审查、Bug 分析 |
| `ultrathink` | ~32k tokens | 架构决策、复杂重构 |

---

## 架构概览

```
src/
├── content/          # Content Script 主入口
│   ├── adapters/     # 平台适配器 (ChatGPT/Gemini/Claude/Deepseek)
│   ├── features/     # 功能模块
│   └── parsers/      # Markdown 解析器
├── bookmarks/        # 书签功能模块
├── renderer/         # Markdown 渲染器
├── styles/           # 样式与 Token
└── utils/            # 全局工具函数 + ThemeManager
```

---

## 文档规范

工程文档遵循以下原则：

1. **内容平权**: 所有内容同等权重，慎用 `[!IMPORTANT]`、`[!WARNING]` 等人为强调标记
2. **逻辑驱动**: 文档仅包含与业务逻辑相关的技术内容，不引入主观权重判断
3. **简洁清晰**: 使用表格、列表等结构化形式，避免冗余描述
4. **可执行性**: 每条规则必须可验证、可执行，不使用模糊表述

---

## 参考文档

| 文档 | 用途 |
|:----|:----|
| [CAPABILITY_MATRIX.md](docs/antigravity/platform/CAPABILITY_MATRIX.md) | 平台功能支持矩阵 |
| [platform-adaptation.md](.agent/workflows/platform-adaptation.md) | Platform Integration Manual |
| [ALGORITHM_NOTES.md](docs/ALGORITHM_NOTES.md) | 算法复盘笔记（仅用户明确要求时编写） |

---

## 提交前检查

- [ ] `npm run build` 成功
- [ ] 接口变更已更新 `PLATFORM_ADAPTATION_GUIDE.md`
- [ ] `CHANGELOG.md` 已更新（见 [changelog.md](.agent/rules/changelog.md)），必须使用英文