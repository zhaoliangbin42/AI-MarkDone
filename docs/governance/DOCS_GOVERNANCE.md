# Docs Governance

本文件定义 `docs/` 的治理规则，目标是把文档库变成“可执行的权威规范”，并服务于长期重构、跨人协作与可审计性。

---

## 1. 文档分级（Authority Tiers）

### Tier A：权威规范（必须维护）

满足以下条件之一即属于 Tier A：

- 定义系统边界/契约/依赖规则（架构蓝图、协议、适配器契约、存储契约）
- 定义重构阶段与验收门禁（checklist）
- 被治理规则或 CI 门禁引用

Tier A 文档位置应集中在：

- `docs/architecture/*`
- `docs/refactor/*`
- `docs/governance/*`
- `docs/antigravity/platform/*`（契约与矩阵）
- `docs/feature-matrix/*`（功能矩阵与验收口径）

### Tier B：操作手册（Runbook / SOP）

用于描述可重复执行流程，例如 E2E 回归、发布流程、调试指南。内容应与 Tier A 契约一致。

### Tier C：历史记录（Legacy / Review Artifacts）

历史审查产物、一次性调试记录、临时结论等。保留价值在“可追溯”，不作为未来改动依据。

---

## 2. 变更规则（Update Rules）

当发生以下变更时，必须同步更新 Tier A：

- 新增/修改站点适配器方法语义或返回语义（更新 `ADAPTER_CONTRACT.md`）
- 新增平台或平台能力支持状态变化（更新 `CAPABILITY_MATRIX.md`）
- 关键功能能力边界/验收口径变化（更新对应 feature matrix，例如 `docs/feature-matrix/COPY.md` / `docs/feature-matrix/READER.md`）
- 跨模块依赖方向发生变化（更新 `DEPENDENCY_RULES.md` + `BLUEPRINT.md`）
- 引入新的消息协议类型、存储 schema、迁移逻辑（更新 `BLUEPRINT.md` + checklist）
- 重构拆分/移动文件（更新 checklist 的“完成状态”和“新路径”）

---

## 3. 命名与结构（Information Architecture）

- 以“稳定路径 + 单一职责”为主：同一契约只存在一个权威位置
- 文档标题以“系统名 + 主题”命名，避免含糊
- 允许包含必要的工程术语（MV3, SW, content script, ports 等），但须保持一致用词

---

## 4. 迁移与废弃（Migration / Deprecation）

### 4.1 迁移流程

1. 先在 Tier A 文档中补齐“标准表述”（契约、边界、规则）
2. 再从旧文档抽取信息，合并到 Tier A（避免重复、避免多处规范）
3. 在旧文档顶部添加“已迁移到某处”的提示（仅在仍需保留旧文档时使用）

### 4.2 删除策略

当旧文档满足以下条件可删除：

- 其信息已在 Tier A/Tier B 中有等价表达
- 或其内容与当前系统不一致且易误导
- 且没有测试/工具链依赖该路径

---

## 5. 与代码/测试的耦合边界

原则：**权威文档可以被测试引用，但测试不应该强绑历史文档路径。**

迁移过程中，如果测试依赖了历史文档路径，应在 checklist 中安排“更新测试门禁”任务，保证未来文档结构可演进。
