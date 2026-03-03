# AI-MarkDone Documentation Hub (Authoritative)

本目录是 AI-MarkDone 的权威文档库（source of truth），用于指导架构、模块边界、重构计划与长期维护。后续任何结构性变更（架构/协议/存储/适配器契约/重构拆分）必须以这里的权威文档为准并同步更新。

本文档不覆盖“如何写代码”的通用规范（见 `.agent/rules/*`），只覆盖项目级的架构事实、契约与演进计划。

---

## 1. 权威文档清单（必须维护）

### 1.1 架构（Architecture）

- `docs/architecture/BLUEPRINT.md`：目标架构蓝图（to-be），含分层、依赖规则、契约与演进策略
- `docs/architecture/DEPENDENCY_RULES.md`：依赖方向与“禁止耦合”规则（可转为 lint/CI 门禁）
- `docs/architecture/BROWSER_COMPATIBILITY.md`：Chrome MV3 / Firefox MV2 兼容性与构建产物边界

### 1.2 重构计划（Refactor）

- `docs/refactor/REFACTOR_CHECKLIST.md`：以功能模块为边界的分阶段重构 checklist（checkbox 实时更新）

### 1.2.1 Rewrite（Greenfield）

- `docs/rewrite/PROGRAM.md`：推倒重来总纲（archive → rebuild → delete）
- `docs/rewrite/FEATURE_PARITY.md`：功能对齐清单（重写交付顺序与验收粒度）

### 1.3 契约（Contracts）

- `docs/antigravity/platform/ADAPTER_CONTRACT.md`：站点适配器契约（Site Adapter Contract）
- `docs/antigravity/platform/CAPABILITY_MATRIX.md`：平台能力矩阵（平台/功能支持状态）

### 1.3.1 功能（Frozen Features）

- `docs/FEATURES.md`：冻结能力/冻结决策/验收口径（Copy + Reader）

### 1.4 治理（Governance）

- `docs/governance/DOCS_GOVERNANCE.md`：文档库治理（权威层级、迁移/废弃规则、命名与更新流程）

### 1.4.1 过程记录（Process / Evidence）

- `docs/DEVLOG.md`：开发证据日志（append-only；记录命令与观察到的结果）

### 1.5 样式（Style）

- `docs/style/STYLE_SYSTEM.md`：样式系统（Tokens + Shadow DOM + Theme）

### 1.5 测试（Testing）

- `docs/testing/E2E_REGRESSION_GUIDE.md`：E2E 回归执行清单（发布/大重构必跑）
- `docs/testing/TESTING_BLUEPRINT.md`：测试体系蓝图（分层结构、契约门禁与迁移策略）

---

## 2. 现存旧文档的处理策略（迁移中）

为保持文档库精简，本仓库仅保留“面向未来的权威文档 + 必要 runbooks”。历史审查产物如需追溯，优先通过 issue/PR 讨论记录或外部归档系统保存，避免在 `docs/` 内长期堆积造成漂移与误导。

---

## 3. 快速入口（建议阅读顺序）

1. `docs/architecture/BLUEPRINT.md`
2. `docs/FEATURES.md`
3. `docs/rewrite/PROGRAM.md`
4. `docs/rewrite/FEATURE_PARITY.md`
5. `docs/refactor/REFACTOR_CHECKLIST.md`
