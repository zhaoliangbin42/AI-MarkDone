# Domain 01 执行记录：平台适配与消息边界

## Step 1（已完成）：消息 contract 常量化与三端一致性

### 背景
- Chrome background、content、Firefox background 存在重复字面量，后续改协议易漂移。

### 修改
- 新增共享常量：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/shared/runtime-messages.ts`
    - `RUNTIME_ACTION_OPEN_BOOKMARK_PANEL`
    - `RUNTIME_TYPE_PING`
    - `RuntimeStatus`
- 收敛 guard 使用：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/background/message-guards.ts`
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/message-guards.ts`
- 收敛消息响应类型：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/index.ts`
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/background/service-worker.ts`
- Firefox 背景脚本对齐常量：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/background/background-firefox.js`

### 新增回归测试
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/tests/unit/background/firefox-message-contract.test.ts`
  - 校验 Firefox 背景脚本中的 action/type 常量与共享 contract 一致。

### 验证
- `npm run test -- tests/unit/background-message-guards.test.ts tests/unit/content-message-guards.test.ts tests/unit/background/firefox-message-contract.test.ts` ✅
- `npm run build` ✅（Chrome + Firefox）

## Step 2（已完成）：修复 Chrome `import outside module` 回归

### 现象
- Chrome 扩展运行时报错：
  - `Uncaught SyntaxError: Cannot use import statement outside a module`
- 产物中出现：
  - `dist-chrome/background.js` 顶层 `import ... from './assets/runtime-messages-*.js'`
  - `dist-chrome/content.js` 顶层 `import ... from './assets/runtime-messages-*.js'`

### 根因
- `background` 与 `content` 两个入口共享 `src/shared/runtime-messages.ts`，Rollup 生成了共享 chunk。
- 在扩展运行时场景中，该入口被按普通脚本路径执行，顶层 `import` 触发语法错误。

### 修复
- 移除跨入口共享常量依赖，改为入口本地常量，消除 shared chunk：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/background/service-worker.ts`
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/background/message-guards.ts`
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/index.ts`
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/message-guards.ts`

### 验证
- `npm run build:chrome` ✅，产物不再包含顶层 `import`
- `npm run build:firefox` ✅
- `npm run test -- tests/unit/background-message-guards.test.ts tests/unit/content-message-guards.test.ts` ✅
