# UI Style Architecture

目的：为 AI-MarkDone 建立可持续、可审计、可收束的 UI 样式架构。后续所有 UI 样式改动，必须从本文档开始阅读，并按本文定义的层级与治理规则执行。

---

## 1. 权威链路

样式任务的固定阅读顺序：

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/style/STYLE_ARCHITECTURE.md`
4. 按需继续：`docs/style/ARIAKIT_EXAMPLES_STYLE_REFERENCE.md`

权威分工：

- Google / Material：分层方法论、治理方式、生命周期约束
- Ariakit：视觉关系、组件原型、主题观感基线
- 本文档：把上述两者收敛为 AI-MarkDone 的唯一样式架构

约束：

- `AGENTS.md` 只负责指路，不承载样式细则
- `docs/README.md` 只列本文档与视觉参考，不重复规则
- `.agent/*` 只能引用本文档及配套文档，不得另起一套样式体系

补充：

- `docs/style/ARIAKIT_EXAMPLES_STYLE_REFERENCE.md` 负责视觉基线与组件原型
- Ariakit 官方 `Styling` / `Composition` 指南负责回答安全可依赖的状态属性、选择器边界与组合约束
- 当 examples 无法回答“哪些状态可安全依赖”时，必须以 Ariakit 官方指南为准，并同步固化到本地权威文档

---

## 2. 分层模型

样式系统采用四层概念，但只有三层 token：

1. Reference Layer
2. System Layer
3. Component Layer
4. Governance Layer

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

- 组件默认只依赖 `--aimd-sys-*`
- 新的视觉需求优先判断是否应进入 system layer
- light / dark 切换只允许改变 system / reference 值，不得改组件结构

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

- 组件 token 默认映射到 system token
- 组件 token 允许覆盖，但必须有明确组件语义
- 禁止组件 token 直接绑定 primitive value
- 禁止组件 token 反向成为新的全局语义层

### 2.4 Governance Layer

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
- 组件文件允许定义薄的 component alias token
- 组件文件不得再定义“伪全局 system token”

---

## 5. 主题与运行时

主题同步原则：

- Theme detection 仍由 driver 层提供
- UI 通过 `data-aimd-theme` 或 `getTokenCss(theme)` 消费 token
- token 是主题变化的唯一承载面
- dark mode 只换 token 值，不改单元结构

Shadow DOM 原则：

- 页面内 UI 必须在 Shadow DOM 中渲染
- 样式注入统一经由 `src/style/tokens.ts` 总入口
- 页面 DOM 例外场景统一经由 `src/style/pageTokens.ts`

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

### 6.3 Component token 规则

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

### 6.4 Toolbar 组件补充契约

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

## 8. Ariakit 集成约束

后续若使用 Ariakit primitives 或参考其状态模型，实现时必须遵守：

- 视觉基线来自 examples，而不是逐字复制示例源码
- 状态样式只允许依赖公开状态属性和自有 `className` / `data-*`
- 不得依赖 Ariakit 未公开承诺的 `role` 或内部 DOM 结构选择器

当前已纳入本地规范的 Ariakit 公开状态面包括：

- `[aria-checked]`
- `[aria-disabled]`
- `[aria-expanded]`
- `[aria-invalid]`
- `[data-active]`
- `[data-active-item]`
- `[data-open]`
- `[data-enter]`
- `[data-leave]`
- `[data-focus-visible]`
- `[data-user-value]`
- `[data-autocomplete-value]`

后续 dialog / popover / menu / tooltip 的布局约束，还应结合 Ariakit 官方公开 CSS variables 与 composition 规则，而不是只看 examples 静态结构。

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
