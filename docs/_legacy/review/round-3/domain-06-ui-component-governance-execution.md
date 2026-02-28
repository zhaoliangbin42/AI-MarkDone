# Domain 06 执行记录：UI 组件与交互状态治理

## Step 1（已完成）：关键超大文件体积守卫落地

### 背景
- 书签主面板文件体量长期偏大（7k+），审查与回归成本高。
- 在拆分前，先固化“不可继续膨胀”的门禁，防止技术债继续扩大。

### 修改
- 新增：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/tests/unit/architecture/file-size-guard.test.ts`
- 约束：
  - `SimpleBookmarkPanel.ts <= 7800 lines`
  - `re-render.ts <= 1200 lines`
  - `BookmarkSaveModal.ts <= 1100 lines`
- 接入核心门禁：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/package.json` 的 `test:core`

### 验证
- `npm run test -- tests/unit/architecture/file-size-guard.test.ts` ✅
- `npm run test:core` ✅（22 files / 84 tests）
- `npm run build:chrome` ✅

## Step 2（已完成）：面板状态流最小回归补齐

### 背景
- UI 治理不应只停留在“体积守卫”，还需要最小行为回归来防止筛选/选择流退化。

### 修改
- 新增测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/tests/bookmarks/SimpleBookmarkPanelStateFlow.test.ts`
- 覆盖：
  - 平台筛选四平台路径
  - 选择聚合去重（folder + bookmark overlap）
- 门禁接入：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/package.json` `test:core`

### 验证
- `npm run test -- tests/bookmarks/SimpleBookmarkPanelStateFlow.test.ts` ✅
- `npm run test:core` ✅（27 files / 94 tests）
