# UI Style Architecture

目的：为 AI-MarkDone 建立可持续、可审计、可收束的 UI 样式架构。后续所有 UI 样式改动，必须从本文档开始阅读，并按本文定义的层级与治理规则执行。

---

## 1. 权威链路

样式任务的固定阅读顺序：

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/style/STYLE_ARCHITECTURE.md`
4. `docs/style/STYLE_SYSTEM.md`
5. 按需继续：`docs/testing/TESTING_BLUEPRINT.md`

权威分工：

- 本文档：收敛 AI-MarkDone 的唯一样式架构
- `STYLE_SYSTEM.md`：定义 token、主题、Shadow DOM 隔离与样式边界
- 历史视觉参考：仅作为参考，不作为新模块方案的硬约束

约束：

- `AGENTS.md` 只负责指路，不承载样式细则
- `docs/README.md` 只列本文档与视觉参考，不重复规则
- `.codex/*` 只能引用本文档及配套文档，不得另起一套样式体系

补充：

- `docs/style/ARIAKIT_EXAMPLES_STYLE_REFERENCE.md` 仅保留为历史参考，不再驱动新模块方案

## 1.1 What This Means In Practice

对日常开发来说，样式体系可以简化理解成：

- 要做页面内 UI：必须进 Shadow DOM
- 要写视觉值：优先 theme preset 或 `--aimd-*` token
- 要写 overlay rich UI：允许用 Tailwind，但 Tailwind 只能通过语义 alias 消费 `--aimd-*`
- 要写 toolbar / inline UI：保持轻量实现，不引入 Tailwind
- 要写组件 CSS：只写结构和少量局部样式，不依赖第三方类名前缀去重画整套皮肤
- 要处理主题：通过 `themeMode` / `themePreset`，不要在组件里直接读宿主页面主题细节

---

## 2. 分层模型

样式系统采用五层概念，不同 UI 实现共享同一套边界规则：

1. Reference Layer
2. System Layer
3. Component Layer
4. Tailwind Alias Layer
5. Governance Layer

### 2.1 Reference Layer

职责：承载具体值，不承载 UI 语义。

包含：

- primitive colors
- primitive shape / radius
- primitive spacing / size
- primitive elevation / shadow
- primitive motion
- primitive typography base

禁止：

- UI 组件直接消费
- 在组件样式中出现 `--aimd-ref-*`

### 2.2 System Layer

职责：承载产品级 UI 语义，是默认唯一可消费层。

覆盖范围：

- color
- surface / elevation
- border
- text
- accent / focus
- state
- overlay
- motion
- shape
- spacing / size
- typography typescale

规则：

- 遗留组件默认只依赖 `--aimd-sys-*`
- 主题驱动组件默认依赖主题对象和 component token
- 新的视觉需求优先判断是否应进入 theme preset 或 system layer
- light / dark 切换只允许改变视觉源的值，不得改组件结构

### 2.3 Component Layer

职责：承载组件私有语义映射，而不是第二套全局设计系统。

允许的组件域：

- dialog
- toolbar
- button
- popover
- menu
- tabs
- reader
- bookmarks-panel

规则：

- 常规 UI 原语优先复用项目统一基础组件，不要为单个模块再造一套视觉规则
- 组件 token 默认映射到主题层组件 token 或 system token
- 组件 token 允许覆盖，但必须有明确组件语义
- 禁止组件 token 直接绑定 primitive value
- 禁止组件 token 反向成为新的全局语义层

### 2.4 Tailwind Alias Layer

职责：为 overlay UI 提供可维护的 authoring API，但不拥有独立视觉真源。

允许：

- 只暴露语义 alias，如 `surface / text / border / interactive / state / elevation / space / radius / motion / z`
- 通过 alias 间接消费 `--aimd-*`
- 只服务于 overlay-style singleton UI

禁止：

- 直接定义产品级颜色、阴影、圆角、间距值
- 组件域 alias 成为第一层语义
- toolbar / inline UI 使用 Tailwind alias
- 通过切换 utility/class 代替 token 主题切换

### 2.5 Governance Layer

职责：约束 token 的新增、迁移、废弃、删除、例外和文档同步。

治理规则统一写在本文档中，不再拆分多个内部样式治理文件。

---

## 3. 依赖禁令

为避免样式系统发散，以下规则是硬约束：

- 组件 CSS / TS 模板只能使用 system token 或 component token
- reference token 只能在 system token 构建层被使用
- 任何新样式不得写裸颜色、裸阴影、裸圆角、裸时长
- `hover / active / pressed / selected / focus / disabled / error / warning / success` 必须先进入 system layer
- typography 必须使用完整 typescale，不得长期停留在 `xs/sm/base/lg` 简化层
- `markdown-body`、dialog、toolbar、panel、popover 属于正式组件语义，必须纳入 component layer
- 站点平台差异不得进入 token layer
- 非 UI 层若消费 token，只能消费稳定导出层，不得反向决定 token 架构
- Tailwind alias 只能映射 canonical `--aimd-*`，不得拥有独立产品值
- Tailwind 仅允许用于 overlay-style singleton UI，且必须带 `tw` 前缀并禁用 Preflight

---

## 4. 代码组织

样式代码结构固定为：

- `src/style/reference-tokens.ts`
- `src/style/system-tokens.ts`
- `src/style/tokens.ts`
- `src/style/pageTokens.ts`
- `src/style/shadow.ts`

职责划分：

- `reference-tokens.ts`：生成 `--aimd-ref-*` primitive tokens
- `system-tokens.ts`：生成 `--aimd-sys-*` 和稳定兼容导出
- `tokens.ts`：组合 reference + system，作为唯一总入口
- `pageTokens.ts`：向非 Shadow DOM 页面节点暴露总入口输出
- `shadow.ts`：只负责样式注入

组件样式规则：

- 组件样式继续与组件共置
- 组件只允许保留最小布局样式，不允许依赖第三方组件库类名前缀做皮肤重绘
- 组件文件允许定义薄的 component alias token
- 组件文件不得再定义“伪全局 system token”
- Tailwind alias 配置必须保持在 foundation / style 入口附近，不得分散到单个组件文件各自定义

---

## 5. 主题与运行时

主题同步原则：

- Theme detection 仍由 driver 层提供
- UI 通过 `themeMode + themePreset` 消费主题
- 遗留 UI 通过 `data-aimd-theme` 或 `getTokenCss(theme)` 消费 token
- dark mode 只换主题值，不改单元结构

Shadow DOM 原则：

- 页面内 UI 必须在 Shadow DOM 中渲染
- 样式注入必须显式指向对应的 `shadowRoot`
- 每个 `ShadowRoot` 都必须维护独立的运行时样式上下文，不能复用默认全局 cache
- 每个 `ShadowRoot` 都必须拥有稳定且唯一的样式命名域，避免 document 级别去重导致后续 root 跳过样式注入
- 修复/自愈逻辑必须使用运行态组件类名做健康判定，不能假设某个固定前缀永远存在
- 遗留 UI 样式注入统一经由 `src/style/tokens.ts` 总入口
- 页面 DOM 例外场景统一经由 `src/style/pageTokens.ts`

Overlay host 原则：

- overlay-style singleton UI 必须优先接入共享 overlay host，而不是继续各自复制 `mountShadowDialogHost + token 注入 + modal root + keyboard scope` 组合
- 共享 overlay host 需要提供稳定 slot：
  - backdrop root
  - surface root
  - modal root
- overlay host 的目标是统一运行时 ownership，不是把所有 overlay 模块压成同一份 DOM 模板
- toolbar 不接入 overlay host；toolbar 继续走轻量 token-only 路线

Browser compatibility contract：

- 对支持 constructed stylesheet 的环境，允许共享 stylesheet 复用
- 对不支持的环境（包括 Firefox fallback 路径），必须退回每个 `ShadowRoot` 独立 `<style>` 注入
- 该差异必须对组件透明；组件不能依赖某一种注入实现
- 验收必须覆盖：
  - 多 root 并存无漏注入
  - fallback 路径样式完整
  - 关闭/重开 overlay 后样式与交互稳定

## 5.1 Mock-First Workflow

从 `MessageToolbar` 之后，所有新 UI 模块都必须遵守：

- 先在 `mocks/components/<module>/index.html` 完成真实组件挂载型 mock，而不是手写静态原型
- mock 必须复用真实组件、真实 token 注入链路、真实 Shadow DOM 挂载方式
- 至少验证 `light / dark`
- 至少验证两个独立实例同时挂载时，每个 `ShadowRoot` 都有运行时样式节点
- overlay 模块必须在浏览器中实际打开、交互并验收视觉效果
- toolbar 模块必须验证多实例同时存在时的密度、对齐和样式稳定性
- 浏览器验收必须留存截图或快照证据，并确认目标来自 live `shadowRoot`
- mock 页面视觉效果未达到批准基线前，不允许把该模块实现迁入 `src/ui/**`
- 获得显式批准后，才能合并进 `src/ui/**`
- mock 与生产实现必须共享同一套组件选型和主题 preset 结论
- 若使用导出的 HTML 快照做验收，必须确认快照包含运行时样式节点；只有自定义 host style 的快照不能作为通过依据
- 若快照来自浏览器导出的 declarative shadow DOM（`<template shadowrootmode="open">`），必须先重新挂载真实组件并生成 live `shadowRoot`，再做样式验收
- 真实组件重扫前必须先清理所有没有 live `shadowRoot` 的旧 toolbar host，防止历史模板中的样式哈希污染新的运行时样式注入判断

---

## 6. Reference / System 命名边界

### 6.1 Reference token 规则

reference token 只承载具体值，不承载 UI 语义。

允许：

- `--aimd-ref-color-neutral-0`
- `--aimd-ref-color-brand-600`
- `--aimd-ref-radius-200`
- `--aimd-ref-space-300`
- `--aimd-ref-type-size-200`

不允许：

- `--aimd-ref-color-surface-base`
- `--aimd-ref-color-text-primary`
- `--aimd-ref-color-accent`
- `--aimd-ref-size-panel-width`

原因：

- 这些名称已经在表达“用途”而不是“值层”
- 一旦 reference 层带语义，system layer 就会失去存在意义

### 6.2 System token 规则

system token 只承载产品级语义，是 UI 默认唯一消费层。

必须覆盖：

- color
- surface / elevation
- border
- text
- accent / focus
- state
- overlay
- motion
- shape
- spacing / size
- typography typescale

允许保留稳定兼容导出，例如：

- `--aimd-bg-primary`
- `--aimd-text-primary`
- `--aimd-border-default`

但这些兼容名本质上仍属于 system layer，不是第四套系统。

### 6.3 Tailwind alias 规则

Tailwind alias 只解决 overlay authoring 的语义映射，不承载产品级真值。

必须遵守：

- alias 只能映射到 canonical `--aimd-*`
- alias 只能表达语义角色，不能表达组件品类
- alias 命名优先描述 UI role，而不是 DOM 结构
- alias 使用范围仅限 overlay-style singleton UI
- Tailwind 必须使用 `tw` 前缀并关闭 Preflight

禁止：

- alias 直接绑定裸值
- alias 命名为 `panel-*`、`toolbar-*`、`dialog-*` 这类组件第一层语义
- 把 Tailwind theme 当作新的 source of truth

### 6.4 Component token 规则

component token 只解决组件私有语义和 system token 到组件结构的落点映射。

允许域：

- dialog
- toolbar
- button
- popover
- menu
- tabs
- reader
- bookmarks-panel

禁止：

- `--aimd-tb-hover`
- `--aimd-dlg-outline`
- `--aimd-gmail-hover`

原因：

- 这类命名缺少层级和组件边界，容易在项目中再次扩散成伪全局语义

### 6.5 Toolbar 组件补充契约

`MessageToolbar` 是单一跨平台组件，不允许再定义 `actionbar / content` 这类 placement variant。

固定规则：

- 所有平台统一插入消息底部右侧
- 视觉上与宿主官方工具栏保持同一行语气，但不依赖宿主 action area 形成组件分叉
- 工具栏是轻量悬浮条，不是厚重面板
- icon 保持为主视觉，`stats / note / status` 常驻但权重低于 icon actions
- menu 属于 toolbar 的次级浮层，仍然从 toolbar component layer 派生

token 约束：

- toolbar 需要的跨组件语义先进入 system layer，例如 quiet surface、hover / pressed layer、focus ring、compact size、floating shadow、status border
- toolbar 私有落点再进入 component layer，命名统一使用 `--aimd-toolbar-*`
- 禁止继续出现 `--aimd-tb-*` 或任何未标明组件域的 toolbar 局部伪系统 token

---

## 7. 生命周期治理

### 7.1 新增

新增 token 前必须回答：

1. 它是 primitive value 还是 semantic role？
2. 是否已有现有 system token 可复用？
3. 是否真的是组件专用，而不是遗漏的 system role？

决策规则：

- primitive value -> reference layer
- product-level role -> system layer
- component-local role -> component layer

### 7.2 迁移

固定顺序：

1. 先补 reference / system token
2. 再建立 component token 映射
3. 再迁移组件实现
4. 最后删除旧 token 与硬编码

禁止：

- 边改组件边临时发明语义
- 先写组件值，事后补 token

### 7.3 废弃与删除

token 废弃必须记录：

- 原 token
- 替代 token
- 受影响组件
- 清理条件

只有在以下条件同时满足时，旧 token 才允许删除：

- 所有调用点已迁移
- 相关文档已同步
- 构建验证通过

### 7.4 例外

允许极少数例外，但必须同时满足：

- 无法表达为现有 system token
- 无法合理落入现有 component token 域
- 有明确业务约束
- 在本文档追加例外记录

例外记录模板：

```md
## Exception: <name>
- Reason:
- Scope:
- Owner:
- Exit condition:
```

未登记的例外视为违规。

---

## 8. 历史参考文档边界

- `docs/style/ARIAKIT_EXAMPLES_STYLE_REFERENCE.md` 仅保留为历史审美参考，不再作为新模块方案输入
- 新模块的活跃约束以 `STYLE_SYSTEM.md`、本文档、相关 testing docs 和 ADR 为准
- 任何与 Ariakit 历史参考冲突的实现，应优先服从当前 canonical tokens、Tailwind alias 边界和 mock-first 流程

---

## 9. 执行顺序

后续样式重构的固定顺序：

1. 建立文档与治理体系
2. 建立 reference / system / component 代码骨架
3. 补齐 system token
4. 逐组件迁移样式
5. 清理旧 token 与硬编码

禁止跳步：

- 禁止边改组件边临时发明新语义
- 禁止先改组件视觉、后补 token 语义
- 禁止从当前颜色值反推 token 角色
