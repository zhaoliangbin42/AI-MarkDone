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
