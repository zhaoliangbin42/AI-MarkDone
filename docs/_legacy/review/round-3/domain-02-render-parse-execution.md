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

## Step 3（已完成）：MathML 转换一致性回归测试补齐

### 背景
- `mfrac` 缺陷修复后，需要避免 ChatGPT/Claude adapter 在后续演进中再次产生公式转换漂移。

### 修改
- 新增测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/parser/adapters/__tests__/MathMLConversionParity.test.ts`
- 覆盖点：
  - `mfrac`、`msub`、`msup` 在 ChatGPT/Claude 两个 adapter 的转换结果保持一致。

### 验证
- `npm run test -- src/parser/adapters/__tests__/MathMLConversionParity.test.ts src/parser/adapters/__tests__/ClaudeAdapter.test.ts tests/integration/parser/chatgpt-codeblock-rendering.test.ts` ✅

## Step 4（已完成）：Extractor 异常输入韧性测试补齐

### 背景
- 解析链路仍缺少“坏 HTML/不完整标签”场景回归。
- 风险：DOM 结构轻微漂移时，code/table/math extractor 容易静默退化或抛错。

### 修改
- 新增测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/parsers/__tests__/ExtractorResilience.test.ts`
- 覆盖点：
  - `CodeExtractor`：坏 HTML 下仍可提取并恢复 fenced code block。
  - `TableParser`：不完整 table 结构下仍可输出 Markdown 表格。
  - `MathExtractor`：混合 rendered/raw/error 数学内容可正常抽取与恢复。
- 同步纳入核心门禁：
  - `package.json` 的 `test:core` 新增该测试文件。

### 验证
- `npm run test -- src/content/parsers/__tests__/ExtractorResilience.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅

## Step 5（已完成）：Extractor 大输入韧性回归补齐

### 背景
- Domain 2 仍缺“混合大输入（code/table/math）”下稳定性回归。
- 风险：多提取器串联时，长内容可能触发性能退化或异常中断。

### 修改
- 扩展测试：
  - `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/parsers/__tests__/ExtractorResilience.test.ts`
- 新增覆盖：
  - 构造高体量混合 HTML（重复 code/table/math chunk）
  - 验证 `CodeExtractor -> TableParser -> MathExtractor` 串联处理不抛错且结果保留关键结构

### 验证
- `npm run test -- src/content/parsers/__tests__/ExtractorResilience.test.ts` ✅
- `npm run test:core` ✅

## Step 6（已完成）：解析链异常输入韧性补测（控制字符/畸形 KaTeX）

### 背景
- 现有韧性测试覆盖了大输入与常见 malformed HTML，但对“控制字符污染”和“畸形 KaTeX 片段”覆盖不足。

### 修改
- `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/parsers/__tests__/ExtractorResilience.test.ts`
  - 新增：控制字符 + 非法 Unicode 标记输入下，Code/Table/Math 全链路不抛错。
  - 新增：MathExtractor 处理畸形 KaTeX 片段（annotation 未闭合/katex-error）不抛错。

### 验证
- `npm run test -- src/content/parsers/__tests__/ExtractorResilience.test.ts` ✅
- `npm run test:core` ✅
- `npm run build:chrome` ✅
