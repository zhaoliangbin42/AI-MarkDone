# Site Adapter Contract (Authoritative)

目的：定义站点适配器（Site Adapter）的契约边界与语义要求，使“跨站差异”严格收敛在 driver 层，避免扩散到业务逻辑与 UI。

适用范围：

- Content adapters：`src/drivers/content/adapters/*`（实现 `SiteAdapter`）
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

契约源定义：`src/drivers/content/adapters/base.ts`

### 2.1 `matches(url: string): boolean`

- 必须只基于 URL 判断，不依赖 DOM 是否已加载
- 对同一 URL 必须是纯函数（无副作用）

### 2.2 消息发现与注入（Message discovery & injection）

- `extractUserPrompt(assistantMessageElement: HTMLElement): string | null`
- `getMessageSelector()`
- `getMessageContentSelector()`
- `getActionBarSelector()`
- `getToolbarAnchorElement?(assistantMessageElement: HTMLElement): HTMLElement | null`
- `getTurnRootElement?(assistantMessageElement: HTMLElement): HTMLElement | null`
- `injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean`
- `isStreamingMessage(messageElement: HTMLElement): boolean`
- `getMessageId(messageElement: HTMLElement): string | null`
- `getObserverContainer(): HTMLElement | null`

要求：

- `getMessageSelector()` 必须只命中 **assistant 消息**（不包含 user prompt），且尽量稳定（避免易变 class hash）。
- `getMessageContentSelector()` 必须命中“正文根节点”（Copy/Reader 会优先解析该节点；找不到时会回退到 messageElement）。
- `getActionBarSelector()` 作为“完成态锚点”的辅助（streaming guard / pending 状态）；若平台没有明确 action bar，应返回一个尽量可靠的完成态锚点选择器。
- `getToolbarAnchorElement?()` 只用于“身份与位置锚点”：必须返回对同一逻辑消息稳定且唯一的元素；不得产生副作用；拿不到应返回 `null`（调用方回退到 messageElement 的去重标记）。
- `getTurnRootElement?()` 用于“turn 分组”的结构性锚点：应返回包裹本段 assistant segment 的稳定容器（优先使用站点已有的 turn wrapper）；不得产生副作用；拿不到应返回 `null`（调用方回退到平台无关的 best-effort turn grouping）。
- `injectToolbar()` 必须是幂等安全的：允许重复调用但不会导致错误位置注入；必须具备 fallback（action bar → content after → append）。
- `isStreamingMessage()` 必须是 best-effort：误判为 streaming 只会禁用按钮，不得影响注入与扫描。
- `getMessageId()` 用于去重注入：必须尽量稳定；拿不到可返回 `null`（调用方会走 dataset 标记兜底）。
- `getObserverContainer()` 用于缩小扫描范围：应尽量返回一个稳定容器；拿不到可返回 `null`（调用方会回退到 `document`）。

### 2.3 DOM 规范化与噪声过滤（Copy/Reader 解析前处理）

- `normalizeDOM(root: HTMLElement): void`
- `isNoiseNode(node: Node, context: NoiseContext): boolean`
- `getArtifactPlaceholder(node: HTMLElement): string | null`

要求：

- `normalizeDOM()` 仅允许对传入节点做原地变换；调用方只会在 clone 上调用（不得污染页面真实 DOM）。
- 噪声判断必须只基于结构/位置/属性，不基于文本内容（避免语言/i18n 漂移）。
- placeholder 文本必须可被用户理解且可回归（尽量稳定）；返回 `null` 表示直接删除噪声节点。

### 2.4 可选扩展（Optional platform extras）

- `shouldEnhanceUnrenderedMath(): boolean`
- `isDeepResearchMessage?(messageElement: HTMLElement): boolean`
- `getDeepResearchContent?(): HTMLElement | null`

要求：

- `shouldEnhanceUnrenderedMath()` 用于控制 Copy pipeline 的“未渲染 inline math 修复”步骤（默认 false）。
- Deep Research 方法必须是纯读取：只负责探测与返回面板正文根节点，不得触发点击/滚动等副作用。

---

## 3. ThemeDetector 契约

ThemeDetector 源定义：`src/drivers/content/adapters/base.ts`

- `detect()` 返回 `dark|light|null`：返回 `null` 表示使用系统偏好作为最终 fallback
- `getObserveTargets()` 必须尽量小范围（html/body + 少量 attributes），避免观察成本过高
- `hasExplicitTheme()` 用于区分“站点自带主题”与“仅跟随系统”

---

## 4. 与重构蓝图的关系

当 adapter 契约发生变更时，必须同步更新：

- `docs/architecture/BLUEPRINT.md`
- `docs/refactor/REFACTOR_CHECKLIST.md`（对应阶段的验收与回归项）
