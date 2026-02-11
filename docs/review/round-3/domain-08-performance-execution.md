# Domain 08 执行记录：性能与稳定性

## Step 1（已完成）：性能脚本可执行性修复

### 背景
- 现有性能脚本 `tests/perf/math-click-perf.js` 依赖 `linkedom`，但项目依赖未包含该包，脚本无法执行。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/tests/perf/math-click-perf.js`
  - 将 HTML 解析从 `linkedom.parseHTML` 改为项目已安装的 `jsdom`（`JSDOM`）。

### 验证
- `node tests/perf/math-click-perf.js` ✅
- 本机结果（本次）：
  - `Extracted 1000 sources in 13.57ms`
  - `Target: <500ms for 1,000-message pages`（满足）

## Step 2（已完成）：自动项健康度核对

### 验证
- `npm run test:core` ✅
- `npm run build:chrome` ✅
- `npm run build:firefox` ✅

### 结论
- Domain 08 已具备“可执行的性能脚本 + 基本自动门禁”基础。
- 剩余是 checklist 中的人工体验与大体量场景压测记录（A/B/C/E 手工项）。
