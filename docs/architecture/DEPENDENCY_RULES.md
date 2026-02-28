# Dependency Rules (Target)

本文件定义目标依赖规则，用于把“分层”落成可执行约束（最终可转为 lint/CI 门禁）。

---

## 1. 逻辑层依赖方向（UI / Service / Driver）

- UI → Service → Driver（只允许单向依赖）
- Driver 禁止反向依赖 Service/UI（避免基础设施层被业务污染）
- Service 禁止依赖 DOM/Browser API（通过 Driver ports 访问）

---

## 2. 域边界（按功能模块）

目标域边界（示例）：

- `bookmarks/**` 不应依赖 `content/**` 的具体实现（尤其 UI 实现类）
- `utils/**` 不应依赖 `content/**`（必要时抽象到 shared/contracts）
- `shared/**` 只能包含协议/类型/稳定契约，不包含 runtime 特化实现

---

## 3. Runtime 协议位置约束

所有 runtime message 的常量、类型、schema（请求/响应）必须位于“单点契约模块”，并在 content/background 两端引用同一份定义。

当前（as-is）：

- `src/shared/runtime-messages.ts`（过薄，且协议常量存在重复定义）

目标（to-be，目录名待重构阶段确认）：

- `src/shared/contracts/*`（或同等职责目录）：版本化协议、schema、错误码、类型定义

禁止：

- 在 content/background 各自重复定义协议常量
- 使用未版本化的“任意对象”跨 runtime 传递

---

## 4. 存储写入与副作用集中（MV3 优先）

目标：敏感副作用集中在 Background（可审计、可恢复、最小权限）。

允许：

- Content/UI 通过协议发起 intent
- Background 执行存储写入/网络请求/跨 tab 广播并返回结果

例外（如确需 Content 直接写入）必须在 blueprint 与 checklist 中显式记录并给出原因。
