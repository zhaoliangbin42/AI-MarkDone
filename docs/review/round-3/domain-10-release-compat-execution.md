# Domain 10 执行记录：跨浏览器兼容与发布工程

## Step 1（已完成）：支持平台链接一致性防回归

### 背景
- 背景脚本中维护 `SUPPORTED_HOSTS`，popup 页面也维护“支持平台链接”；两者容易长期漂移。

### 修改
- 新增测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/tests/unit/release/supported-hosts-consistency.test.ts`
- 覆盖点：
  - Chrome / Firefox 两个 background 脚本的 `SUPPORTED_HOSTS` 必须一致。
  - popup 的平台链接必须被 background allowlist 覆盖。
  - popup 必须包含四个主平台（ChatGPT/Gemini/Claude/DeepSeek）。

### 验证
- `npm run test -- tests/unit/release/supported-hosts-consistency.test.ts` ✅
- `npm run build:chrome` ✅

## Step 2（已完成）：manifest 资源一致性门禁补齐

### 背景
- 现有门禁覆盖了 host/matches 与 popup 链接一致性，但对 `web_accessible_resources` 与 icon 路径的跨浏览器一致性尚未自动校验。
- 风险：Chrome/Firefox manifest 在资源暴露或图标路径上静默漂移，导致发布后兼容问题。

### 修改
- 新增测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/background/__tests__/manifest-resource-consistency.test.ts`
- 覆盖点：
  - Chrome MV3 `web_accessible_resources[0].resources` 与 Firefox MV2 `web_accessible_resources` 必须一致。
  - Chrome MV3 `web_accessible_resources[0].matches` 必须与 `host_permissions` 一致。
  - Chrome `action.default_icon` 与 Firefox `browser_action.default_icon` 必须一致，且与 `icons` 保持一致。

### 验证
- `npm run test -- tests/unit/release/manifest-compatibility.test.ts tests/unit/release/supported-hosts-consistency.test.ts src/background/__tests__/manifest-resource-consistency.test.ts` ✅
- `npm run build:chrome` ✅
- `npm run build:firefox` ✅

## Step 3（已完成）：MV2/MV3 结构互斥门禁补齐

### 背景
- 仅校验 host/resources 还不够，manifest 结构字段误混（`service_worker` vs `background.scripts`，`action` vs `browser_action`）会直接导致发布失败。

### 修改
- 扩展测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/tests/unit/release/manifest-compatibility.test.ts`
- 新增覆盖：
  - Chrome manifest 必须是 MV3，使用 `background.service_worker` 与 `action`，且不得出现 `background.scripts` / `browser_action`。
  - Firefox manifest 必须是 MV2，使用 `background.scripts` 与 `browser_action`，且不得出现 `background.service_worker` / `action` / `host_permissions`。

### 验证
- `npm run test -- tests/unit/release/manifest-compatibility.test.ts tests/unit/release/supported-hosts-consistency.test.ts src/background/__tests__/manifest-resource-consistency.test.ts` ✅
- `npm run build:chrome` ✅
- `npm run build:firefox` ✅
