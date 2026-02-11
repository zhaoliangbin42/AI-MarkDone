# Domain 07 执行记录：安全基线与日志治理

## Step 1（已完成）：console.error 第一批收敛

### 背景
- 历史代码中存在多处 `console.error` 直出，导致日志策略不统一，且难以按环境控级。

### 修改
- `src/utils/dom-utils.ts`
  - `copyToClipboard` / fallback / `safeQuerySelector` 的错误输出改为 `logger.error`。
- `src/content/utils/EventBus.ts`
  - 监听器异常改为 `logger.error`。
- `src/bookmarks/state/FolderState.ts`
  - load/save 失败改为 `logger.error`。
- `src/bookmarks/managers/FolderOperationsManager.ts`
  - event listener 异常改为 `logger.error`。
- `src/parser/core/ErrorBoundary.ts`
  - 错误边界输出改为 `logger.error`。
- `src/parser/core/types.ts`
  - 默认 `onError` 改为 `logger.error`。
- `src/parser/core/Parser.ts`
  - 默认 `onError` 与 abort 输出改为 `logger.error`。

### 验证
- `npm run test -- tests/unit/content-message-guards.test.ts tests/unit/background-message-guards.test.ts tests/unit/settings-migration.test.ts` ✅
- `npm run test -- tests/integration/parser/chatgpt-codeblock-rendering.test.ts src/renderer/core/__tests__/MarkdownRenderer.test.ts src/renderer/core/__tests__/MarkdownRenderer.mixed-content.test.ts` ✅
- `npm run build:chrome` ✅


## Step 2（已完成）：日志治理覆盖核对

### 结论
- 已完成第一批高频工具层与 parser 核心层 `console.error` 收敛。
- 后续仍有 parser adapter 层历史 `console.error/console.warn`，将纳入下一批渐进治理（避免一次性大改风险）。

### 验证
- `npm run test -- tests/integration/parser/chatgpt-codeblock-rendering.test.ts src/renderer/core/__tests__/MarkdownRenderer.test.ts src/renderer/core/__tests__/MarkdownRenderer.mixed-content.test.ts` ✅
- `npm run build:chrome` ✅

## Step 3（已完成）：parser 规则层/适配层 raw console 第二批收敛

### 背景
- parser 的规则层与平台 adapter 层仍存在若干 `console.warn`，与统一日志门禁不一致。
- 风险：日志级别难统一控管，后续回归易把 raw console 再次引入核心链路。

### 修改
- 新增日志守卫测试（先红后绿）：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/utils/__tests__/no-raw-console-usage.test.ts`
  - 覆盖文件：
    - `src/content/utils/TooltipManager.ts`
    - `src/content/utils/NavigationButtonsController.ts`
    - `src/parser/rules/block/MathBlockRule.ts`
    - `src/parser/rules/inline/MathInlineRule.ts`
    - `src/parser/adapters/ChatGPTAdapter.ts`
    - `src/parser/adapters/ClaudeAdapter.ts`
    - `src/parser/adapters/GeminiAdapter.ts`
- 替换为统一 logger：
  - `console.warn(...)` -> `logger.warn(...)`
  - 涉及上述 7 个文件。

### 验证
- `npm run test -- src/utils/__tests__/no-raw-console-usage.test.ts tests/integration/parser/chatgpt-codeblock-rendering.test.ts src/renderer/core/__tests__/MarkdownRenderer.test.ts src/renderer/core/__tests__/MarkdownRenderer.mixed-content.test.ts` ✅
- `npm run build:chrome` ✅

## Step 4（已完成）：innerHTML sink 全量盘点建档

### 背景
- 日志治理后，下一阶段风险集中在 DOM 注入面（`innerHTML` / `insertAdjacentHTML`）。
- 需要先建立全局基线，避免无序替换与遗漏。

### 产出
- 新增清单文件：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/docs/review/round-3/domain-07-innerhtml-sink-inventory.md`
- 覆盖内容：
  - 总命中数（68）
  - 高/中/低风险分层
  - 下一批替换策略（先高风险，再中风险模板，再白名单收口）

## Step 5（已完成）：高风险 sink 前置护栏测试（save-messages）

### 背景
- 高风险 sink 一次性重构成本较高，先通过护栏测试锁定关键安全前提，防止后续回退。

### 修改
- 新增测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/save-messages-sanitization.guard.test.ts`
- 护栏项：
  - `MarkdownRenderer.render(msg.assistant, { sanitize: true })` 不得回退。
  - 导出模板中的 `metadata.title` 与 `msg.user` 必须走 `escapeHtml(...)`。

### 验证
- `npm run test -- src/content/features/__tests__/save-messages-sanitization.guard.test.ts src/background/__tests__/manifest-resource-consistency.test.ts src/utils/__tests__/no-raw-console-usage.test.ts` ✅

## Step 6（已完成）：高风险 sink 第一批替换（innerHTML -> 安全节点赋值）

### 背景
- `MessageSender`、`save-messages`、`math-extractor` 存在高风险 `innerHTML` 赋值点。
- 本步以“等价行为 + 最小替换”为原则收敛风险面。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/MessageSender.ts`
  - `silentSync` 改为 `applyPlainTextToContenteditable()` + `replaceChildren(...)`，移除 `input.innerHTML = ...`
  - `clearInput` 回退清空改为 `replaceChildren()`，移除 `input.innerHTML = ''`
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/save-messages.ts`
  - `printContainer.innerHTML = html` 改为 `DOMParser + importNode + replaceChildren`
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/parsers/math-extractor.ts`
  - `block.innerHTML = result` 改为 `DOMParser + importNode + replaceChildren`
  - `extract()` 中 `tempDiv.innerHTML = html` 改为 `DOMParser` 容器解析
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/parsers/code-extractor.ts`
  - `tempDiv.innerHTML = html` 改为 `DOMParser` 容器解析
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/parsers/table-parser.ts`
  - `tempDiv.innerHTML = html` 改为 `DOMParser` 容器解析
- 新增护栏测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts src/content/features/__tests__/save-messages-sanitization.guard.test.ts tests/integration/parser/parser-integration.test.ts tests/integration/parser/GeminiIntegration.test.ts tests/integration/parser/chatgpt-codeblock-rendering.test.ts` ✅
- `npm run build:chrome` ✅
- `npm run test:core` ✅

## Step 7（已完成）：Tooltip 模板点去 innerHTML（中风险小批次）

### 背景
- `TooltipManager` 使用模板字符串 + `innerHTML`，虽然文本有 escape，但仍属于可避免的模板注入点。
- 该组件交互影响面小，适合作为中风险 sink 的第一批无感迁移。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/utils/TooltipManager.ts`
  - 将 `this.tooltip.innerHTML = ...` 替换为 `createElement + textContent + replaceChildren`
  - 删除不再需要的 `escapeHtml` helper
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 新增 guard：`TooltipManager` 不允许回退到 `this.tooltip.innerHTML =`

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 8（已完成）：Modal 模板点去 innerHTML（中风险小批次）

### 背景
- `src/content/components/modal.ts` 的 header/footer 使用模板字符串 `innerHTML`。
- 变量来源虽受控（title + i18n 文案），但属于可无损替换的模板注入点。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/components/modal.ts`
  - header/footer 改为 `createElement + textContent + append`
  - 行为保持不变（关闭按钮、复制按钮文案/ID 不变）
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 新增 guard：禁止 `header.innerHTML` / `footer.innerHTML` 回退

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 9（已完成）：SaveMessagesDialog 第一批模板点去 innerHTML

### 背景
- `SaveMessagesDialog` 是高频交互组件，存在多处模板字符串。
- 本批先改“低风险且无行为差异”的 header/selector label，分步降低回归风险。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/SaveMessagesDialog.ts`
  - `header.innerHTML` -> `h2` 节点拼装
  - `selectorSection.innerHTML` -> `label` 节点拼装
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 新增 guard：禁止 `SaveMessagesDialog` 回退到上述两处 `innerHTML`

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 10（已完成）：SaveMessagesDialog 第二批模板点去 innerHTML（format section）

### 背景
- `SaveMessagesDialog` 的 `formatSection.innerHTML` 仍包含较大模板字符串（含 SVG）。
- 该区域可改为纯节点构建，进一步降低模板注入风险并提升可维护性。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/SaveMessagesDialog.ts`
  - `formatSection.innerHTML` 改为 `createElement` 构建
  - 新增：
    - `createFormatButton(...)`
    - `createMarkdownFormatIcon()`
    - `createPdfFormatIcon()`
  - 关闭按钮 icon 也改为 `createCloseIcon()`（替代 `closeBtn.innerHTML`）
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 增加 guard：禁止 `formatSection.innerHTML` 与 `closeBtn.innerHTML` 回退

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 11（已完成）：DialogHost 模板替换（Alert/Confirm/Prompt）

### 背景
- `DialogHost` 承载全局确认/输入对话框，模板文案是动态输入，风险高于纯 icon 场景。
- 之前三个入口都通过 `dialog.innerHTML` 拼接。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/components/DialogHost.ts`
  - `renderAlertDialog` / `renderConfirmDialog` / `renderPromptDialog` 改为纯 DOM 节点构建
  - 新增 helper：
    - `createDialogHeader`
    - `createDialogBody`
    - `createDialogButton`
  - 删除不再需要的 `escapeHtml` / `escapeAttr` 路径
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 新增 guard：禁止 `DialogHost` 回退到 `dialog.innerHTML`

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 12（已完成）：BookmarkSaveModal 空态模板点去 innerHTML

### 背景
- `BookmarkSaveModal.renderFolderTree()` 的空态分支仍使用模板字符串 `treeBody.innerHTML = ...`。
- 该分支可无感替换，适合作为书签模块模板治理的安全切入点。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/bookmarks/components/BookmarkSaveModal.ts`
  - 空态 UI 改为 `createElement + replaceChildren`
  - 保留图标受控注入（`Icons.folder`）与文案逻辑不变
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 新增 guard：禁止 `BookmarkSaveModal` 回退到 `treeBody.innerHTML = \``

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 13（已完成）：SimpleBookmarkPanel 标题模板点去 innerHTML

### 背景
- `SimpleBookmarkPanel.refreshContent()` 中标题区域仍有 `header.innerHTML` 拼接。
- 该点可无感替换，且位于高频刷新路径，适合先行收敛。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/bookmarks/components/SimpleBookmarkPanel.ts`
  - 标题改为 `replaceChildren(iconSpan, textNode)` 方式
  - 图标仍使用受控 `Icons.bookmark`
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 新增 guard：禁止回退到 `header.innerHTML = \`${Icons.bookmark}`

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 14（已完成）：Toolbar/FloatingInput 图标注入点去 innerHTML

### 背景
- `toolbar` 与 `FloatingInput` 的按钮图标仍通过 `innerHTML` 注入静态 SVG。
- 虽然来源可控，但属于可低风险替换点，且在高频 UI 路径，适合继续收敛。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/components/toolbar.ts`
  - `createIconButton` 从 `button.innerHTML = icon` 改为 `setButtonIcon(...)`。
  - 复制成功态图标切换从 `btn.innerHTML = Icons.check` 改为 `setButtonIcon(btn, Icons.check)`。
  - 新增 `setButtonIcon(...)`（`DOMParser + replaceChildren`）。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/components/FloatingInput.ts`
  - 折叠按钮与发送按钮图标注入改为 `setButtonIcon(...)`。
  - 新增 `setButtonIcon(...)`（`DOMParser + replaceChildren`）。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 新增 guard：禁止上述文件回退到对应 `innerHTML` 图标注入写法。

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 15（已完成）：ReaderPanel（re-render）图标/箭头注入点去 innerHTML（低风险批次）

### 背景
- `src/content/features/re-render.ts` 仍有多处按钮图标与箭头文本通过 `innerHTML` 注入。
- 这些点位主要是静态 icon/text，可低风险替换并保持行为一致。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/re-render.ts`
  - 翻页箭头按钮：`innerHTML` -> `textContent`。
  - trigger/jump/waiting/fullscreen/copy 成功态 icon 注入改为 `setButtonIcon(...)`。
  - 新增 `setButtonIcon(...)`（`DOMParser + replaceChildren`）。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 新增 guard：禁止上述 `re-render` 点位回退为 `innerHTML`。

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run build:chrome` ✅

## Step 16（已完成）：ReaderPanel 消息体模板（body.innerHTML）替换为节点拼装

### 背景
- `renderMessage()` 的消息体使用整段 `body.innerHTML` 组装（含 prompt/model icon/markdown html）。
- 该点位属于中风险模板拼装入口，改为节点拼装可进一步压缩注入面。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/re-render.ts`
  - `body.innerHTML = ...` 替换为 `createElement + replaceChildren`。
  - `user-content` 改为 `textContent`。
  - 新增 `parseSvgIcon(...)` 用于受控 SVG 导入。
  - 新增 `applyHtmlFragment(...)` 用于将 markdown 渲染结果导入容器。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 新增 guard：禁止 `re-render` 回退到 `body.innerHTML = \``。

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run test:core` ✅

## Step 17（已完成）：ReaderPanel Header 模板（header.innerHTML）替换为节点构建

### 背景
- `createHeader()` 使用整段 `header.innerHTML` 拼装按钮区与关闭按钮。
- 该点位在面板初始化路径，适合继续做模板去 `innerHTML` 收敛。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/re-render.ts`
  - `createHeader()` 改为 `createElement + append`。
  - 新增 `createHeaderButton(...)` 统一创建 header 按钮。
  - 保留原有 id/title/event 绑定行为。
  - 修复 `parseSvgIcon(...)` 返回类型为 `Element`（通过 TS 构建）。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 新增 guard：禁止 `re-render` 回退到 `header.innerHTML = \``。

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run build:chrome` ✅

## Step 18（已完成）：同类图标注入风险全仓排查与补修

### 背景
- 你反馈图标空白后，确认根因是 `DOMParser('image/svg+xml')` 与现有 icon 字符串组合不稳定。
- 需要排查并修复全仓同类实现，避免局部修好后在其他模块复发。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/bookmarks/components/SimpleBookmarkPanel.ts`
  - `setIconOnlyContent(...)` 改为 `template.innerHTML + cloneNode`。
  - 其余残留 `icon.innerHTML = Icons.xxx` 点位改为复用 `setIconOnlyContent(...)`。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/bookmarks/components/BookmarkSaveModal.ts`
  - 空态图标注入改为 `setIconOnlyContent(...)`，新增 helper。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/utils/material-icons.ts`
  - `createMaterialIcon(...)` 改为 `template.innerHTML + firstElementChild`，并增加 fallback svg。

### 验证
- 全仓检索：`parseFromString(... image/svg+xml)` 已清零（src 内无命中）✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 19（已完成）：增加 SVG 解析方式防回退门禁

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/utils/__tests__/no-raw-console-usage.test.ts`
  - 新增断言：源码文件禁止 `parseFromString(... image/svg+xml)`。

### 验证
- `npm run test -- src/utils/__tests__/no-raw-console-usage.test.ts` ✅
- `npm run test:core` ✅

## Step 20（已完成）：组件层（Button/Input/Checkbox）模板注入收敛

### 背景
- 基础组件层仍存在 `innerHTML` 注入 icon/content 的路径，虽然多为受控常量，但影响面广。
- 该层收敛后可减少未来功能代码重复引入同类风险。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/components/Input.ts`
  - 左右 icon 注入改为 `setIconContent(...)`（template + cloneNode）。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/components/Checkbox.ts`
  - checkmark 注入改为 `setCheckmarkContent(...)`，去除直接 `innerHTML`。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/components/Button.ts`
  - 按钮内容渲染改为 `applyContent(...)` 节点拼装。
  - 移除旧字符串模板死代码并修复编译告警。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/innerhtml-high-risk-guard.test.ts`
  - 新增组件层防回退断言。

### 验证
- `npm run test -- src/content/features/__tests__/innerhtml-high-risk-guard.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅
