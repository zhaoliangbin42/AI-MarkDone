# AI-MarkDone 开发规范

> 适用对象: AI Agent (Claude/Gemini/GPT) 及人类开发者  
> 版本: 4.2.0

---

## 项目概述

| 属性 | 值 |
|:-----|:---|
| 项目名称 | AI-MarkDone |
| 类型 | 浏览器扩展 (Chrome MV3 / Firefox MV2) |
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
| 注释规范 | [commenting.md](.agent/rules/commenting.md) | 只保留 Why/约束/契约 |

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
├── background/       # Background Script (Chrome: service-worker.ts, Firefox: background-firefox.js)
├── content/          # Content Script 主入口
│   ├── adapters/     # 平台适配器 (ChatGPT/Gemini/Claude/Deepseek)
│   ├── components/   # 页面内 UI 组件（Shadow DOM）
│   ├── observers/    # 页面变化监听（MutationObserver 等）
│   ├── injectors/    # 注入与挂载逻辑
│   ├── features/     # 功能模块
│   └── parsers/      # Markdown 解析器
├── bookmarks/        # 书签功能模块
├── settings/         # 设置管理（schema/迁移/缓存）
├── parser/           # Parser v3（规则引擎）
├── renderer/         # Markdown 渲染器
├── styles/           # 样式与 Token
├── shared/           # 共享契约（协议/类型）
└── utils/            # 全局工具函数（browser/i18n/logger/tokens 等）
```

---

## 文档规范

工程文档遵循以下原则：

1. **内容平权**: 所有内容同等权重，慎用 `[!IMPORTANT]`、`[!WARNING]` 等人为强调标记
2. **逻辑驱动**: 文档仅包含与业务逻辑相关的技术内容，不引入主观权重判断
3. **简洁清晰**: 使用表格、列表等结构化形式，避免冗余描述
4. **可执行性**: 每条规则必须可验证、可执行，不使用模糊表述

---

## 权威文档库（Docs）

`docs/` 目录正在重建为面向未来的权威文档库。任何架构/协议/存储/适配器契约/重构拆分相关的变更，必须以权威文档为准并同步更新。

| 文档 | 用途 |
|:----|:----|
| [docs/README.md](docs/README.md) | 权威文档入口（source of truth） |
| [AS_IS.md](docs/architecture/AS_IS.md) | 当前系统分析（能力/边界/依赖/问题清单） |
| [BLUEPRINT.md](docs/architecture/BLUEPRINT.md) | 目标架构蓝图（MV3 哲学、契约、演进策略） |
| [DEPENDENCY_RULES.md](docs/architecture/DEPENDENCY_RULES.md) | 依赖方向规则（可转为 CI 门禁） |
| [BROWSER_COMPATIBILITY.md](docs/architecture/BROWSER_COMPATIBILITY.md) | Chrome MV3 / Firefox MV2 兼容性边界 |
| [ADAPTER_CONTRACT.md](docs/antigravity/platform/ADAPTER_CONTRACT.md) | 站点适配器契约（跨站差异收敛点） |
| [CAPABILITY_MATRIX.md](docs/antigravity/platform/CAPABILITY_MATRIX.md) | 平台功能支持矩阵 |
| [REFACTOR_CHECKLIST.md](docs/refactor/REFACTOR_CHECKLIST.md) | 分阶段重构 checklist（checkbox 实时更新） |
| [DOCS_GOVERNANCE.md](docs/governance/DOCS_GOVERNANCE.md) | 文档库治理（权威层级/迁移/废弃规则） |
| [STYLE_SYSTEM.md](docs/style/STYLE_SYSTEM.md) | 样式系统（Tokens + Shadow DOM + Theme） |
| [TESTING_BLUEPRINT.md](docs/testing/TESTING_BLUEPRINT.md) | 测试体系蓝图（分层结构与契约门禁） |

历史文档已统一归档到 `docs/_legacy/**`（例如 `docs/_legacy/review/**`、`docs/_legacy/debug/**`）；重构期间不要把它们当作未来规范依据。


---

## 提交前检查

- [ ] `npm run build` 成功 (同时构建 Chrome 和 Firefox)
- [ ] 接口变更已更新相关文档
- [ ] `CHANGELOG.md` 已更新（见 [changelog.md](.agent/rules/changelog.md)），必须使用英文

## Codex 默认验证（强制）

- Codex 每次执行（产生代码变更）后，默认必须执行 `npm run build` 进行编译验证
- 例外：仅讨论/解释、不修改代码；或用户明确要求跳过编译
