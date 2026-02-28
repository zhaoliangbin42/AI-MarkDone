# Architecture (As-Is) — System Analysis

本文是对当前 AI-MarkDone 的系统级分析（不改变功能、以事实为主），用于重构前建立共同认知：能力边界、依赖关系、热点与结构性问题。

数据来源：代码扫描（依赖统计/大文件热点/运行时入口）、现有文档（兼容性/能力矩阵/审查框架）。

---

## 1. Runtime 组件边界（扩展真实架构）

扩展在运行时由多个组件构成（这不是“目录分层”，而是浏览器平台强制的运行时边界）：

- Content Script：`src/content/index.ts`
- Background：
  - Chrome MV3 Service Worker：`src/background/service-worker.ts`
  - Firefox MV2 background script：`src/background/background-firefox.js`
- Popup（extension page）：`src/popup/popup.html`
- Manifests：`manifest.chrome.json`, `manifest.firefox.json`
- Build 输入：Vite 仅编译 `content/index.ts` 与 `background/service-worker.ts`（Firefox background 通过 postbuild 复制）

---

## 2. 能力版图（当前系统“做什么”）

主要能力域（按目录与职责聚类）：

- 跨站点适配：`src/content/adapters/*`
- 页面监听与注入：`src/content/observers/*`, `src/content/injectors/*`, `src/content/datasource/*`
- 页面侧功能编排：`src/content/features/*`
- 书签子系统（存储/迁移/文件夹树/导入导出/面板）：`src/bookmarks/*`
- 解析（parser v3）：`src/parser/*` + 内容提取器 `src/content/parsers/*`
- 渲染（renderer）：`src/renderer/*`
- 设置（Settings）：`src/settings/SettingsManager.ts`
- 基础设施（browser abstraction / logger / tokens / i18n / Theme）：`src/utils/*`
- 共享契约（runtime messages）：`src/shared/runtime-messages.ts`（目前非常薄）

平台支持状态见：`docs/antigravity/platform/CAPABILITY_MATRIX.md`

---

## 3. 依赖关系（跨模块 import 统计）

以 `src/*` 顶层目录为 bucket，统计本地 import 的跨 bucket 依赖（只统计 `.ts/.tsx/.js`）：

- `content -> utils:67, assets:12, bookmarks:9, renderer:7, settings:5, styles:4, components:3`
- `bookmarks -> utils:21, settings:4, assets:3, components:2, content:2`
- `utils -> content:2`（基础设施反向依赖业务域）
- `parser -> utils:9`, `renderer -> utils:9`

补充：扫描结果未发现循环依赖（SCC cycles = 0）。

---

## 4. 热点与风险（Hotspots）

### 4.1 大文件热点（LOC Top）

按文件行数（LOC）排序的关键热点：

- `src/bookmarks/components/SimpleBookmarkPanel.ts`：7903 行
- `src/utils/design-tokens.ts`：1331 行
- `src/content/features/re-render.ts`：1093 行（ReaderPanel）
- `src/content/index.ts`：1078 行（Content 入口/编排）
- `src/bookmarks/components/BookmarkSaveModal.ts`：988 行

项目存在文件大小治理门禁：`tests/unit/architecture/file-size-guard.test.ts`。当前 `SimpleBookmarkPanel.ts` 已超过 cap（7903 > 7800），说明重构已进入“治理机制失效”的阶段。

### 4.2 结构性耦合（Boundary Violations）

1) **bookmarks 依赖 content（反向耦合）**

- `src/bookmarks/components/SimpleBookmarkPanel.ts` 直接依赖 `src/content/features/re-render.ts`（ReaderPanel 实现）
- `src/bookmarks/datasource/BookmarkDataSource.ts` 依赖 `src/content/types/ReaderTypes.ts`（数据类型）

影响：书签子系统无法独立演进，重构 ReaderPanel 会波及书签；也扩大审计面（依赖链过长）。

2) **utils 依赖 content（基础设施层污染）**

- `src/utils/ThemeManager.ts` 依赖 `src/content/adapters/registry.ts`

影响：ThemeManager 变成“content 特化工具”，限制其在其他 runtime（options/popup）的复用与测试隔离。

3) **消息协议重复定义（契约不统一）**

`openBookmarkPanel` / `ping` 常量与类型分散在：

- `src/shared/runtime-messages.ts`
- `src/background/service-worker.ts`
- `src/content/message-guards.ts`
- `src/background/message-guards.ts`
- `src/background/background-firefox.js`

影响：协议扩展时容易出现改动不一致，降低可审计性与可靠性。

4) **解析管线关键代码位置与命名错位**

- `src/content/parsers/markdown-parser.ts` 生产逻辑依赖 `src/parser-example.ts` 的 `createMarkdownParser()`

影响：关键路径代码隐含在“example”命名下，增加维护成本与重构风险。

5) **存储抽象分散（多套并存）**

- Settings：`src/settings/SettingsManager.ts`（sync + cache）
- Bookmarks：`src/bookmarks/storage/*`（local + queue + migration）
- Renderer：`src/renderer/platform/*`（storage adapter：sync→local fallback）

影响：一致性策略分裂、迁移/恢复难统一、审计面扩大（写入路径多）。

---

## 4.3 关键对象与入口（Key Symbols / Entry Points）

本节用于把“扫描结果”落到可定位的对象与函数，便于后续 checklist 按符号拆分与回归。

### Runtime/入口

- Content 主控制器：`src/content/index.ts` 内 `class ContentScript`（核心：`start()`、`applyTheme()`，以及文件顶部的 `runtime.onMessage` 监听）
- Background（Chrome）：`src/background/service-worker.ts`（核心：`SUPPORTED_HOSTS`、`updateActionState()`、`runtime.onMessage`、`action.onClicked`）
- Background（Firefox）：`src/background/background-firefox.js`（同等职责）

### Driver/适配器与观察

- 适配器基类：`src/content/adapters/base.ts`（`SiteAdapter`, `ThemeDetector`）
- 适配器选择：`src/content/adapters/registry.ts`（`adapterRegistry.getAdapter()`）
- 页面变化监听：`src/content/observers/mutation-observer.ts`, `src/content/observers/selector-message-observer.ts`
- 主题管理（当前耦合点）：`src/utils/ThemeManager.ts`（依赖 content adapter）

### Service/解析与渲染

- Parser v3 入口：`src/parser/core/Parser.ts`
- Content 侧 MarkdownParser：`src/content/parsers/markdown-parser.ts`（依赖 `createMarkdownParser()`）
- Parser 创建函数（命名错位）：`src/parser-example.ts`（`createMarkdownParser()`）
- Renderer 核心：`src/renderer/core/MarkdownRenderer`（目录 `src/renderer/core/*`）

### UI/面板与对话框

- Reader 面板：`src/content/features/re-render.ts`（`export class ReaderPanel`；核心：`showWithData()`/`show()`/刷新与渲染链路）
- 书签面板：`src/bookmarks/components/SimpleBookmarkPanel.ts`（`export class SimpleBookmarkPanel`；大量内部方法，属于拆分首要对象）
- 收藏弹窗：`src/bookmarks/components/BookmarkSaveModal.ts`
- 工具栏：`src/content/components/toolbar.ts`

### Storage/设置

- 设置管理：`src/settings/SettingsManager.ts`（`SettingsManager.getInstance().get/set`、迁移逻辑）
- 书签存储：`src/bookmarks/storage/SimpleBookmarkStorage.ts`（`save/remove/getAll/...`）
- 文件夹存储：`src/bookmarks/storage/FolderStorage.ts`
- 写入队列：`src/bookmarks/storage/StorageQueue.ts`

---

## 5. MV3 哲学符合度（As-Is 评估）

符合/已考虑：

- Chrome MV3 Service Worker 环境兼容：Vite 禁用 modulepreload polyfill（避免 SW 触碰 `document`）
- 明确 host_permissions 与受支持站点 gating（background 控制 action/popup）
- 存在 sender 校验与 message guards（消息边界具备基础安全校验）
- Chrome/Firefox 背景脚本分离（降低条件分支复杂度，符合现有兼容性文档决策）

不足/待补齐：

- Background 更像“图标/入口控制器”，尚未形成统一的“副作用能力中心”（写存储/网络/跨 tab 调度仍分散）
- 消息协议未版本化、未形成 requestId/错误码/幂等等可审计字段
- 关键子系统（书签/ReaderPanel）内聚过高，拆分成本持续上升

---

## 6. 重构前的共识基线（不变约束）

后续“彻底重构”应遵守：

- 功能不变（用户可见行为一致）
- 优先 MV3 哲学：最小权限、副作用集中、可恢复、可审计
- 依赖规则可执行（最终能转为 lint/CI gate）

具体目标与分阶段计划见：

- `docs/architecture/BLUEPRINT.md`
- `docs/refactor/REFACTOR_CHECKLIST.md`
