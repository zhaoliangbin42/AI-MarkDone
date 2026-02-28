# Site Adapter Contract (Authoritative)

目的：定义站点适配器（Site Adapter）的契约边界与语义要求，使“跨站差异”严格收敛在 driver 层，避免扩散到业务逻辑与 UI。

适用范围：

- Content adapters：`src/content/adapters/*`（实现 `SiteAdapter`）
- 依赖 adapters 的模块：content observers / datasource / parsers（仅通过契约交互）

---

## 1. Adapter 的职责边界

Adapter 只负责：

- URL 匹配与平台识别
- DOM 选择器与节点提取
- 流式状态探测（平台特化）
- 平台噪声节点识别（结构性噪声，不基于文本）
- DOM 结构规范化（normalizeDOM），用于解析管线前处理
- 主题探测与主题变化观察目标（ThemeDetector）

Adapter 不负责：

- 存储读写策略
- 导出/书签/Reader 的业务编排
- UI 组件渲染与交互状态机

---

## 2. 关键方法语义（`SiteAdapter`）

契约源定义：`src/content/adapters/base.ts`

### 2.1 `matches(url: string): boolean`

- 必须只基于 URL 判断，不依赖 DOM 是否已加载
- 对同一 URL 必须是纯函数（无副作用）

### 2.2 DOM 选择器方法

- `getMessageSelector()`
- `getMessageContentSelector()`
- `getActionBarSelector()`
- `getCopyButtonSelector()`
- `getInputSelector()`
- `getSendButtonSelector()`

要求：

- 返回选择器必须“尽量稳定”（避免依赖易变 class hash）
- 必须有合理 fallback 策略（在 adapter 内部处理）

### 2.3 内容提取方法

- `extractMessageHTML(element: HTMLElement): string`
- `extractUserPrompt(responseElement: HTMLElement): string | null`
- `getUserPrompts(): string[]`

要求：

- 输出必须是可被 parser/render 处理的稳定 HTML（避免把平台 UI 控件当正文）
- 对失败场景必须返回可控 fallback（例如 `null` 或 placeholder），避免抛出破坏主流程

### 2.4 噪声过滤（Noise Filtering）

- `isNoiseNode(node: Node, context?): boolean`
- `getArtifactPlaceholder(node: HTMLElement): string | undefined`

要求：

- 噪声判断必须只基于结构/位置/属性，不基于文本内容（避免语言/i18n 漂移）
- placeholder 文本必须可被用户理解且可回归（尽量稳定）

### 2.5 `normalizeDOM(element: HTMLElement): void`

要求：

- 允许对传入节点做原地变换
- 调用方应在 clone 上调用（避免污染页面真实 DOM）
- normalize 的目标是把平台特化 HTML 规范化为 parser 可处理的结构，不应引入新副作用

---

## 3. ThemeDetector 契约

ThemeDetector 源定义：`src/content/adapters/base.ts`

- `detect()` 返回 `dark|light|null`：返回 `null` 表示使用系统偏好作为最终 fallback
- `getObserveTargets()` 必须尽量小范围（html/body + 少量 attributes），避免观察成本过高
- `hasExplicitTheme()` 用于区分“站点自带主题”与“仅跟随系统”

---

## 4. 与重构蓝图的关系

当 adapter 契约发生变更时，必须同步更新：

- `docs/architecture/BLUEPRINT.md`
- `docs/refactor/REFACTOR_CHECKLIST.md`（对应阶段的验收与回归项）

