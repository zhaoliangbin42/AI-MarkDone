# Domain 05 执行记录：设置系统与配置生命周期

## Step 1（已完成）：兼容型 schema 收敛

### 背景
- 发现 `src/content/features/chatgpt-folding.ts` 读取旧版 `performance` 设置时依赖类型绕过。
- 风险：后续改动容易再次触发编译错误，且类型信息不可审计。

### 修改
- `src/settings/SettingsManager.ts`
  - 在 `AppSettings` 中新增可选 `performance` 兼容字段：
    - `chatgptFoldingMode?: 'off' | 'all' | 'keep_last_n'`
    - `chatgptDefaultExpandedCount?: number`
  - `DEFAULT_SETTINGS` 显式声明 `performance: undefined`
  - `mergeWithDefaults()` 保留 `stored.performance`（仅兼容旧数据，不强制新写入）
- `src/content/features/chatgpt-folding.ts`
  - 移除 `unknown` 强转读取逻辑，改为类型安全访问：
    - `settings.performance?.chatgptFoldingMode`
    - `settings.performance?.chatgptDefaultExpandedCount`

### 验证
- `npm run test -- tests/unit/settings-migration.test.ts` ✅
- `npm run build:chrome` ✅

## Step 2（已完成）：配置写入路径审查

### 背景
- 目标是识别是否存在绕过 `SettingsManager` 的配置读写，导致设置双源漂移。

### 审查结论
- `app_settings` 仍由 `SettingsManager` 统一管理（`storage.sync`）。
- 语言项存在兼容写入：`SettingsManager.set('language', ...)` + `storage.local.userLocale`（旧路径兼容）。
- 当前策略可运行，但后续应评估移除 legacy `userLocale` 回退窗口（待迁移计划）。

### 验证
- `npm run test -- tests/unit/settings-migration.test.ts tests/unit/i18n/no-hardcoded-accessibility-labels.test.ts` ✅
- `npm run build:chrome` ✅

## Step 3（已完成）：语言设置单源收敛 + 兼容迁移

### 背景
- 语言设置存在双写路径：`app_settings.language`（sync）与 `userLocale`（local）。
- 风险：双源漂移导致跨设备行为不一致。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/bookmarks/components/SimpleBookmarkPanel.ts`
  - 语言切换仅写入 `SettingsManager.set('language', ...)`，移除 `storage.local.userLocale` 写入。
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/utils/i18n.ts`
  - 初始化优先读取 canonical 设置。
  - 当 canonical 仍为 `auto` 且检测到 legacy `userLocale` 时，执行一次性迁移：
    - 写入 `app_settings.language`
    - 删除 `userLocale`

### 验证
- `npm run test -- tests/unit/settings-migration.test.ts tests/unit/i18n/no-hardcoded-accessibility-labels.test.ts` ✅
- `npm run build` ✅（Chrome + Firefox）
