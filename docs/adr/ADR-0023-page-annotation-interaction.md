# ADR-0023 — ChatGPT 页面注释交互与 Reader 组合语义

## Context

ChatGPT 页面注释已经复用 Reader 的注释记录、锚点和持久化边界，但页面入口的瞬时选区工具条、Prompt 联想和管理器是独立 UI。工具条必须贴近鼠标释放位置，同时在视口边缘翻转和 clamp，避免遮挡鼠标或溢出视口。页面管理器也重复承担 Reader 已有的批量复制/删除语义。

页面需要两种明确的 Prompt 组合方式：普通“插入到输入框”只插入注释内容；用户在 Prompt 联想列表中按右方向键时，才把当前 Prompt 与注释组合后插入。两者都必须复用 Reader 已有的 `buildCommentsExport` 语义，不新增第二套模板或编号规则。

## Decision

- `ChatGPTPageSelectionCoordinator` 仍是页面唯一的轻量选区 owner。页面注释只消费其 frame；拖选期间不做语义水合，明确动作才解析 canonical Markdown。
- 工具条在 `pointerup`/`pointercancel` 或稳定的非拖选选区变化后显示；存在鼠标释放锚点时始终定位在鼠标旁，并按视口边界向左/上翻转和 clamp；键盘或程序化选区没有鼠标锚点时才使用选区几何作为 fallback。进入、取消、保存、删除和失效选区都清理同一组 toolbar/selection transient state。
- 页面普通插入调用 Reader 的 `buildCommentsExport`，但传入空 `userPrompt`；因此保留 Reader 的模板、排序、编号和换行语义，同时不自动带当前 Reader Prompt。
- Prompt autocomplete 保持现有反斜杠触发、上下方向键选择、Enter/Tab 普通插入。按右方向键时，若存在候选 Prompt 和当前会话注释，则把该 Prompt 作为 `userPrompt` 交给同一个 Reader export builder，再替换当前 trigger token；没有注释或没有可用组合结果时不拦截右方向键。
- 页面注释管理器保留“当前会话 / 全部注释”、搜索、定位编辑和单条删除；保留当前会话的“插入到输入框”。批量复制、批量删除和“复制并删除”继续由 Reader 专属 surface 提供，不在页面入口重复实现；“全部”视图不提供跨会话插入，并明确提示用户切换回当前会话。
- 组合 provider 由页面注释 controller 持有记录与 Reader export settings，Prompt controller 只依赖一个窄的 `(userPrompt) => string` provider。不得改动 adapter、Content Port、Runtime protocol、存储 schema、Reader 消费链路或内容发现链路。

## Consequences

- 页面和 Reader 的注释文本结构保持一致，新增行为只改变入口和快捷键，不产生格式漂移。
- 普通注释插入不会把用户未选择的 Prompt 隐式带入；右方向键成为显式的“Prompt + 注释”动作。
- 页面工具条的持续 DOM/事件成本不增加：继续复用一个 selection rAF、一次明确动作水合和既有 overlay；不新增 observer、polling 或定时器。
- 右方向键组合结果以替换当前 trigger token 的一次 composer 写入完成；无注释时保持宿主原生右方向键行为。

## Status

Accepted — 2026-08. Implementation is limited to page annotation UI/controller, the existing Prompt autocomplete controller seam, and their focused tests. No platform or discovery contract changes.
