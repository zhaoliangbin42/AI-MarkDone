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
