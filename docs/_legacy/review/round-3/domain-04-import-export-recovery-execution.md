# Domain 04 执行记录：导入导出与备份恢复

## Step 1（已完成）：路径盘点与边界定义

### 审查范围
- 书签面板导入导出：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/bookmarks/components/SimpleBookmarkPanel.ts`
- 导出消息（Markdown/PDF）：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/save-messages.ts`

### 结论
- 书签导入导出链路已有较完整测试与容量上限（20MB / 10000 条）保护。
- 非书签导出（消息导出）当前缺少专项“异常输入 + 文件名 + 回退”测试清单，需要单独固化。

## Step 2（已完成）：专项 checklist 固化

- 新增文档：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/docs/review/round-3/domain-04-import-export-recovery-checklist.md`
- 用于后续 round 的固定执行，不再依赖记忆。

## Step 3（已完成）：消息导出自动化回归补齐（Markdown）

### 背景
- Domain 04 在“消息导出”链路缺少自动化测试，主要依赖手工验证。
- 关键风险点：
  - 空选择时是否错误触发下载
  - 文件名清洗是否稳定（非法字符）

### 修改
- 新增测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/save-messages-export.test.ts`
- 覆盖项：
  - 无选中消息时不触发 `URL.createObjectURL` 与下载
  - 导出文件名按当前规则清洗（非法字符 + 空白替换）
- 纳入核心门禁：
  - `package.json` 的 `test:core` 增加该测试文件

### 验证
- `npm run test -- src/content/features/__tests__/save-messages-export.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 4（已完成）：PDF 导出链路自动化回归补齐

### 背景
- PDF 导出是 Domain 04 的高风险路径（打印触发 + DOM 容器生命周期）。
- 之前主要依赖手测，缺少“空选择/打印触发/afterprint 清理”自动化防回归。

### 修改
- 新增测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/save-messages-pdf.test.ts`
- 覆盖项：
  - 空选择时不触发 `window.print` 且不创建导出容器
  - 有选择时创建 `#aimd-pdf-export-container`，触发打印，并在 `afterprint` 后清理容器
- 纳入核心门禁：
  - `package.json` 的 `test:core` 增加该测试文件

### 验证
- `npm run test -- src/content/features/__tests__/save-messages-pdf.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 5（已完成）：导出极端场景回归补齐（长文件名 + PDF 渲染失败回退）

### 背景
- 仍缺两个高价值边界：
  - Markdown 导出超长标题文件名截断
  - PDF 导出时 MarkdownRenderer 失败后的回退行为

### 修改
- 扩展测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/save-messages-export.test.ts`
    - 新增：超长标题文件名截断到规则上限（不含扩展名）
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/save-messages-pdf.test.ts`
    - 新增：`MarkdownRenderer.render` 抛错时回退到原始 assistant 文本，导出链路不中断

### 验证
- `npm run test -- src/content/features/__tests__/save-messages-export.test.ts src/content/features/__tests__/save-messages-pdf.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 6（已完成）：PDF 导出恢复能力加固（afterprint 丢失/print 异常）

### 背景
- 旧实现依赖 `afterprint` 清理容器；若浏览器环境未触发该事件，可能残留导出容器。
- `window.print()` 抛错时，旧实现也可能未及时清理。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/save-messages.ts`
  - 增加 `afterprint` 超时清理兜底（30s）。
  - 增加 `window.print()` 异常捕获并立即 cleanup。
  - cleanup 逻辑幂等化（防重复清理）。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/__tests__/save-messages-pdf.test.ts`
  - 新增：`afterprint` 不触发时超时清理用例。
  - 新增：`window.print` 抛错时容器清理用例。

### 验证
- `npm run test -- src/content/features/__tests__/save-messages-pdf.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 7（已完成）：书签导出闭环自动化（全量字段 + 仅选中导出）

### 背景
- Domain 04 在“书签导出”上仍缺少自动化证据，尤其是：
  - 全量导出字段完整性
  - 批量导出是否只包含勾选集
  - 导出后再导入闭环一致性

### 修改
- 新增测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/tests/bookmarks/BatchExportSelection.test.ts`
    - 覆盖：`handleBatchExport` 仅导出当前选中（含文件夹递归选择），且去重有效
- 门禁纳入：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/package.json`
  - `test:core` 新增：
    - `tests/bookmarks/BatchExportSelection.test.ts`
    - `tests/bookmarks/ExportImportRoundtrip.test.ts`
    - `tests/bookmarks/SimpleBookmarkPanelStateFlow.test.ts`

### 验证
- `npm run test -- tests/bookmarks/BatchExportSelection.test.ts` ✅
- `npm run test:core` ✅（27 files / 94 tests）
- `npm run build:chrome` ✅
- `npm run build:firefox` ✅

## Step 8（已完成）：书签面板状态路径补回归（平台筛选 + 选择聚合）

### 背景
- Domain 06/04 交叉风险点：面板状态流变化容易引发“筛选遗漏平台”与“批量操作范围异常”。

### 修改
- 新增测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/tests/bookmarks/SimpleBookmarkPanelStateFlow.test.ts`
- 覆盖项：
  - 平台筛选覆盖四平台（ChatGPT/Gemini/Claude/Deepseek）
  - 选择聚合（folder + item 重叠）去重正确

### 验证
- `npm run test -- tests/bookmarks/SimpleBookmarkPanelStateFlow.test.ts` ✅
- `npm run test:core` ✅（27 files / 94 tests）

## Step 9（已完成）：>20MB 导入拦截无脏写入回归

### 背景
- Domain 04 剩余关键风险之一：超大导入文件必须在进入导入主链路前被拒绝，且不能触发任何写入。

### 修改
- 新增测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/tests/bookmarks/ImportFileSizeGuard.test.ts`
- 覆盖：
  - 文件大小超过 `MAX_IMPORT_FILE_BYTES`（20MB）时，`handleImport` 直接报错通知
  - 不触发 `importBookmarks` / `refresh`
  - 不读取文件正文（`file.text` 不被调用）
- 门禁接入：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/package.json` `test:core`

### 验证
- `npm run test -- tests/bookmarks/ImportFileSizeGuard.test.ts` ✅
- `npm run test:core` ✅（28 files / 95 tests）
- `npm run build:chrome` ✅
- `npm run build:firefox` ✅
