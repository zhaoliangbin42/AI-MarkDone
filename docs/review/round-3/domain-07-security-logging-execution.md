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
