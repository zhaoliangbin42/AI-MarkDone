# Dependency Rules

本文件定义当前仓库应遵守的依赖方向与边界，用于把“分层”变成可执行约束，并为后续 lint/CI 门禁提供依据。

---

## 1. Runtime Boundary Rules

### Content runtime

- 入口位于 `src/runtimes/content/*`
- 允许依赖：
  - `src/ui/*`
  - `src/services/*`
  - `src/drivers/content/*`
  - `src/drivers/shared/*`
  - `src/contracts/*`
  - `src/core/*`
  - `src/style/*`
- 禁止直接依赖 background-only storage implementation

### Background runtime

- 入口位于 `src/runtimes/background/*`
- 允许依赖：
  - `src/services/*`
  - `src/drivers/background/*`
  - `src/drivers/shared/*`
  - `src/contracts/*`
  - `src/core/*`
- 禁止依赖 `src/ui/*`

---

## 2. Logical Layer Rules

- UI → Service → Driver 是默认依赖方向
- Driver 禁止反向依赖 Service 或 UI
- `src/core/*` 应尽量保持纯逻辑，可被 service、driver、runtime 复用

### Service categories

当前仓库中的 `src/services/*` 统一分为两类：

- `pure/domain service`
  - 纯逻辑、数据转换、规则编排
  - 不允许依赖 DOM API、browser globals、host selector、UI shell/component
- `content-facing feature service`
  - 允许处理 DOM clone、parser node、HTML fragment、content fragment
  - 仍不允许依赖 host selector、runtime wiring、adapter registry、UI shell/component

当前典型归类：

- `pure/domain service`
  - `src/services/settings/*`
  - `src/services/bookmarks/*`
- `content-facing feature service`
  - `src/services/copy/*`
  - `src/services/reader/*`
  - `src/services/markdown-parser/*`
  - `src/services/export/*`
  - `src/services/sending/*`

---

## 3. Contract Placement Rules

所有 content ↔ background 的协议常量、类型、错误码、request/response shape 必须收敛在单点契约模块：

- `src/contracts/protocol.ts`

平台契约与存储契约分别位于：

- `src/contracts/platform.ts`
- `src/contracts/storage.ts`

禁止：

- 在 content 与 background 两侧重复定义协议常量
- 通过未版本化的“任意对象”跨 runtime 传递
- 让 UI 或 feature 代码私自定义新的 runtime message shape

---

## 4. Browser And Host Abstraction Rules

- Browser API 抽象优先经过 `src/drivers/shared/browser.ts`
- 站点选择器、主题探测、message root 识别只能位于 `src/drivers/content/adapters/sites/*`
- UI 层不得持有平台专有选择器
- Service 层不得按 platform id 分支选择 DOM 行为
- `content-facing feature service` 可消费 adapter 暴露的抽象结果，但不得自行持有平台 selector 或注册 adapter

---

## 5. Side-Effect Ownership

目标：敏感副作用尽量集中在 background，可审计、可恢复、权限最小化。

允许：

- Content/UI 通过协议发起 intent
- Background 执行存储写入、恢复、广播并返回结果

例外：

- 如果某项副作用必须在 content 侧执行，必须在 `BLUEPRINT.md` 与 `REFACTOR_CHECKLIST.md` 中明确记录原因与边界

---

## 6. Change Rule

当依赖方向或边界发生变化时，必须同步更新：

- `docs/architecture/CURRENT_STATE.md`
- 本文档
- `docs/architecture/BLUEPRINT.md`
