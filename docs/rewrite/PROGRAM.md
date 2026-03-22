# Rewrite Program (Transition Execution Document)

本文件是**过渡执行文档**，用于描述 rewrite 阶段的总体执行方式、迁移顺序和阶段性质量门禁。它不是长期架构权威，也不替代当前系统事实。

长期稳定规则请以以下文档为准：

- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/BLUEPRINT.md`
- `docs/architecture/DEPENDENCY_RULES.md`
- `docs/architecture/RUNTIME_PROTOCOL.md`
- `docs/FEATURES.md`
- `docs/testing/CURRENT_TEST_GATES.md`

本项目接下来采用 **推倒重来（greenfield rewrite）** 的方式重建代码库与架构：旧实现整体进入 `archive/`，新实现按目标架构从标准路径重新创建。重写过程以“功能闭环 + 验收门禁”驱动，每完成功能并通过验收后，删除 `archive/` 中对应的旧代码，直到完全替换。

关键词：**方向正确 > 最小破坏**、**可审计（MV3）**、**可恢复**、**契约优先**、**样式统一**、**测试先行**。

---

## 1. 核心目标

- 功能对齐（Feature parity）：对用户可见能力保持一致（允许内部实现完全不同）
- 架构对齐（Architecture correctness）：UI/Service/Driver 分层 + runtime 边界（content/background/extension pages）
- MV3 哲学：最小权限、副作用集中、协议可审计、service worker 可恢复
- 可持续交付：每个功能在重写后都有独立测试与回归门禁

---

## 2. Rewrite 的工作方式（Archive → Rebuild → Delete）

### 2.1 归档

把旧代码整体移入：

- `archive/src/**`
- `archive/tests/**`
- `archive/docs/**`（如需保留某些旧说明）

说明：

- `archive/` 用于旧代码归档（可追溯，但不作为未来规范/实现依据）
- 归档后，新 `src/` 将按目标架构从零创建
- 当 rewrite 闭环完成后，`archive/` 应从仓库中删除；后续历史追溯以 git history 为准

### 2.2 重建

每个功能以闭环交付：

1) 定义契约（protocol/ports/数据模型）  
2) 实现 driver（站点适配 + 基础设施）  
3) 实现 service（用例编排）  
4) 实现 UI（渲染与交互）  
5) 写测试（unit/integration/release gates）  
6) 验收：构建通过 + 回归清单通过  

### 2.3 删除

当某功能闭环完成并验收通过：

- 从 `archive/` 中删除旧实现对应的文件/模块
- 更新 capability matrix 与 checklist 状态

说明：

- 当前仓库已完成 `archive/` 目录清理；本文件中的 `archive` 描述保留为历史迁移过程说明。

---

## 3. 质量门禁（非谈判项）

- 架构门禁：不允许新增跨层反向依赖（Driver 不依赖 Service/UI；契约单点权威）
- 安全门禁：消息边界与敏感副作用必须可审计（协议版本化、requestId、错误码）
- 可恢复门禁：Background 不能依赖常驻内存；关键状态必须持久化可恢复
- 样式门禁：所有 UI 使用 `--aimd-*` tokens；不允许硬编码颜色/尺寸；不使用 `!important`

---

## 4. 范围控制（避免搬运旧债）

重写不“照抄旧实现”，只保留：

- 用户可见行为与能力范围
- 必要的兼容性决策（Chrome MV3 / Firefox MV2）
- 已验证的算法/规则（例如 parser/render 的规则语义）

禁止搬运：

- 单文件超大上帝类
- UI 直接写存储、随处发消息的松散边界
- 工具层反向依赖业务层的结构

---

## 5. 参考入口

- 目标架构蓝图：`docs/architecture/BLUEPRINT.md`
- 依赖规则：`docs/architecture/DEPENDENCY_RULES.md`
- 重写 checklist：`docs/refactor/REFACTOR_CHECKLIST.md`
- 测试蓝图：`docs/testing/TESTING_BLUEPRINT.md`
- 样式系统：`docs/style/STYLE_SYSTEM.md`
