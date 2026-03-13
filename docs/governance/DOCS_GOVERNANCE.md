# Docs Governance

本文件定义 `docs/` 的治理规则，目标是把文档库变成“可执行的权威规范”，并服务于长期重构、跨人协作与可审计性。

仓库规范层级固定为：

1. `AGENTS.md`：仓库入口与最低约束
2. `.codex/rules/*`：跨任务规则
3. `.codex/guides/*`：工程活动指南
4. `docs/*`：长期稳定的系统事实、契约与治理

---

## 1. 文档分级（Authority Tiers）

### Tier A：权威规范（必须维护）

满足以下条件之一即属于 Tier A：

- 定义系统边界/契约/依赖规则（架构蓝图、协议、适配器契约、存储契约）
- 被治理规则或 CI 门禁引用

Tier A 文档位置应集中在：

- `docs/architecture/*`
- `docs/adr/*`
- `docs/governance/*`
- `docs/antigravity/platform/*`（契约与矩阵）
- `docs/FEATURES.md`（冻结能力与验收口径）
- `docs/testing/CURRENT_TEST_GATES.md`（当前测试与验证门禁）

### Tier B：操作手册（Runbook / SOP）

用于描述可重复执行流程，例如 E2E 回归、发布流程、调试指南。内容应与 Tier A 契约一致。

### Transition Docs：过渡执行文档

用于跟踪 rewrite/refactor 期间的执行顺序、阶段状态和迁移验收。它们服务于过渡期，不替代长期架构权威。

包含：

- `docs/refactor/*`
- `docs/rewrite/*`

### Tier C：历史记录（Legacy / Review Artifacts）

历史审查产物、一次性调试记录、临时结论等。保留价值在“可追溯”，不作为未来改动依据。

---

## 2. 变更规则（Update Rules）

当发生以下变更时，必须同步更新 Tier A：

- 新增/修改站点适配器方法语义或返回语义（更新 `ADAPTER_CONTRACT.md`）
- 新增平台或平台能力支持状态变化（更新 `CAPABILITY_MATRIX.md`）
- 关键功能能力边界/验收口径变化（更新 `docs/FEATURES.md`）
- 跨模块依赖方向发生变化（更新 `DEPENDENCY_RULES.md` + `BLUEPRINT.md`）
- 当前落地边界发生变化（更新 `CURRENT_STATE.md`）
- runtime message shape / error code / version 变化（更新 `RUNTIME_PROTOCOL.md`）
- 引入新的消息协议类型、存储 schema、迁移逻辑（更新 `BLUEPRINT.md` + checklist）
- 重构拆分/移动文件（更新 checklist 的“完成状态”和“新路径”）
- 关键架构决策变化（新增或更新 `docs/adr/*`）
- 稳定的排查/验证流程形成共识（新增或更新 `docs/runbooks/*`）

---

## 3. 命名与结构（Information Architecture）

- 以“稳定路径 + 单一职责”为主：同一契约只存在一个权威位置
- 文档标题以“系统名 + 主题”命名，避免含糊
- 允许包含必要的工程术语（MV3, SW, content script, ports 等），但须保持一致用词
- `docs/*` 不承担日常编码行为规范；这类内容应放在 `.codex/*`
- `docs/antigravity/*` 目前视为历史命名空间下的活跃契约路径；在整体迁移前不得做局部改名

### 3.1 文档职责分工

- `CURRENT_STATE.md`：当前落地事实（as-is）
- `BLUEPRINT.md`：目标架构（to-be）
- `RUNTIME_PROTOCOL.md`：content/background 协议边界
- `CURRENT_TEST_GATES.md`：当前必须执行的测试与验证门禁
- `docs/adr/*`：高影响决策与理由
- `docs/runbooks/*`：重复出现的排查与验证步骤
- `docs/refactor/*` / `docs/rewrite/*`：过渡执行与迁移跟踪，不是长期架构权威

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

旧的规范目录一旦被新路径取代，就不得继续作为活跃权威来源。

### 4.3 ADR 触发条件

出现以下任一情况时，应新增或更新 ADR：

- 改变运行时边界或分层约束
- 改变浏览器支持策略
- 改变长期保留的契约位置或治理方式
- 选择一个未来难以回退的工程方向

---

## 5. 与代码/测试的耦合边界

原则：**权威文档可以被测试引用，但测试不应该强绑历史文档路径。**

迁移过程中，如果测试依赖了历史文档路径，应在 checklist 中安排“更新测试门禁”任务，保证未来文档结构可演进。
