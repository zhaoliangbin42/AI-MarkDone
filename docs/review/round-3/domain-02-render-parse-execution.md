# Domain 02 执行记录：渲染与解析链路

## Step 1（已完成）：Claude MathML 分数转换缺陷修复（TDD）

### 背景
- 审查发现 `ClaudeAdapter` 的 `mathMLToLatex()` 在 `mfrac` 分支存在拼接错误。
- 现象：`<mfrac><mi>a</mi><mi>b</mi></mfrac>` 被转换为 `\\frac{a}b}`，缺失分母左大括号。

### 红灯测试
- 新增：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/parser/adapters/__tests__/ClaudeAdapter.test.ts`
- 用例：`converts MathML mfrac into valid LaTeX fraction`
- 失败结果（修复前）：
  - Expected: `\\frac{a}{b}`
  - Received: `\\frac{a}b}`

### 修复
- 文件：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/parser/adapters/ClaudeAdapter.ts`
- 修改：
  - `mfrac` 分支模板字符串由
    - ``\\frac{${num}}${den}}``
  - 改为
    - ``\\frac{${num}}{${den}}``

### 验证
- `npm run test -- src/parser/adapters/__tests__/ClaudeAdapter.test.ts src/utils/__tests__/no-raw-console-usage.test.ts tests/integration/parser/chatgpt-codeblock-rendering.test.ts` ✅
- `npm run build:chrome` ✅

## Step 2（已完成）：parser 集成测试噪音收敛（JSDOM CSS parse）

### 背景
- `GeminiIntegration` / `parser-integration` 在读取真实大 HTML mock 时，会输出大量 JSDOM CSS parse stderr 噪音。
- 虽不影响结果，但会掩盖真实失败信号、降低回归定位效率。

### 修改
- 为集成测试引入 `VirtualConsole` 并过滤 `jsdomError`：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/tests/integration/parser/GeminiIntegration.test.ts`
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/tests/integration/parser/parser-integration.test.ts`
- 仅调整测试运行噪音，不改变业务断言与解析逻辑。

### 验证
- `npm run test -- tests/integration/parser/GeminiIntegration.test.ts tests/integration/parser/parser-integration.test.ts` ✅
- `npm run build:chrome` ✅
