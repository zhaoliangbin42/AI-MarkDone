# Domain 12 Execution Log：视觉一致性专项

## 2026-02-07

### Step 0 初始化
- 新建计划与 checklist。
- 本轮先做“自动扫描 + 问题分组 + 修复优先级”三件事。

### Step 1 自动扫描（待执行）
- [x] 硬编码颜色扫描
- [x] 内联 style 扫描
- [x] markdown/code 样式分布扫描
- [x] fallback 使用密度扫描

#### Step 1 结果摘要
- 硬编码色值总命中约 320；其中 `src/utils/design-tokens.ts` 273 条（基线 token 定义，属预期），业务样式主要集中在 `src/content/features/save-messages-dialog.css.ts`（38 条 fallback）。
- 内联动态样式命中 0（`style.color/background/border/boxShadow` 模式），说明核心问题主要在 CSS token fallback，而非大量 JS 内联染色。
- Markdown/代码相关样式命中约 299，主定义集中在 `src/renderer/styles/StyleManager.ts` 与 `src/content/utils/ReaderPanelStyles.ts`，存在双层样式体系并存风险。
- fallback `var(--x, #xxxxxx)` 主要集中在 `save-messages-dialog.css.ts`，另有少量零散硬编码：`re-render.ts`、`tooltip-helper.ts`、`math-click.ts`、`deep-research-handler.ts`。

### Step 2 问题分组（待执行）
- [x] P0: 影响可读性/识别性的高风险问题
- [x] P1: 样式不一致但不阻断使用
- [x] P2: 清理类一致性优化

#### Step 2 分级结果
- P0
  - 代码块视觉层级在特定背景下不够突出（容器背景接近时边界不明显），影响“块级代码”可读性。
- P1
  - `save-messages-dialog.css.ts` 使用大量 fallback 色值，语义上依赖 token，但跨主题一致性高度依赖 fallback 命中顺序。
  - Reader/Renderer 样式定义分散，存在同一元素在不同层重复定义的长期漂移风险。
- P2
  - 零散的硬编码白色/蓝色（如 tooltip/mask/toast）可统一收敛到语义 token，减少维护成本。

### Step 3 修复批次（待执行）
- [x] 批次 1：代码块可读性与层级
- [x] 批次 2：按钮/输入/弹窗交互一致性
- [x] 批次 3：token 漂移收敛 + fallback 清理

#### 批次 1 实施内容（已完成）
- 根因修复 1（数据层）：
  - 文件：`src/content/parsers/code-extractor.ts`
  - 变更：新增公共缩进归一逻辑，提取 `<pre><code>` 后在 fenced code 生成前去除共同前导缩进（保留相对缩进）。
  - 结果：解决“代码首行左侧额外空格”来源于 HTML pretty-format 缩进污染的问题。
- 根因修复 2（样式层）：
  - 文件：`src/renderer/styles/StyleManager.ts`
  - 变更：新增代码块语义 token（`--codeInline-bg` / `--codeInline-border` / `--codeBlock-bg` / `--codeBlock-border` / `--codeBlock-shadow`），并让 `code` / `pre` 使用该组 token。
  - 结果：块级代码与正文容器层级差异增强，明暗主题下可读性更稳定。

#### 批次 1 验证记录
- `npm run test -- tests/unit/parser/CodeExtractor.test.ts` ✅
- `npm run test -- src/renderer/styles/__tests__/StyleManager.test.ts` ✅
- `npm run test -- tests/integration/parser/chatgpt-codeblock-rendering.test.ts src/renderer/core/__tests__/MarkdownRenderer.test.ts` ✅
- `npm run type-check` ✅

#### 批次 2 实施内容（已完成）
- 文件：`src/content/features/save-messages-dialog.css.ts`
- 变更：
  - 新增 scoped 语义别名变量（`--aimd-dialog-*`）用于弹窗/按钮/输入交互统一。
  - 将历史 `var(--x, #xxxxxx)` 形式替换为语义 token 引用，消除 dialog 内部十六进制硬编码色值。
- 结果：弹窗内主次按钮、hover、disabled、分段按钮、标题/次文本在主题切换下行为一致。

#### 批次 3 实施内容（已完成）
- 文件：
  - `src/content/features/re-render.ts`
  - `src/content/utils/tooltip-helper.ts`
  - `src/content/features/math-click.ts`
  - `src/content/features/deep-research-handler.ts`
- 变更：
  - 清理零散硬编码色值，统一改为语义 token（`--aimd-interactive-primary`、`--aimd-text-on-primary`、`--aimd-error` 等）。
  - Reader 跳转高亮、tooltip 文本色、复制反馈色、deep-research toast 统一 token 路径。
- 结果：运行时动态注入样式中的颜色来源一致，降低跨主题与跨平台漂移风险。

#### 批次 2/3 验证记录
- `npm run test -- src/content/features/__tests__/save-messages-dialog.styles.test.ts` ✅
- `npm run test -- tests/unit/styles/no-hardcoded-colors-content.test.ts` ✅
- `npm run test -- tests/integration/parser/chatgpt-codeblock-rendering.test.ts tests/unit/parser/CodeExtractor.test.ts src/renderer/styles/__tests__/StyleManager.test.ts src/content/features/__tests__/save-messages-dialog.styles.test.ts tests/unit/styles/no-hardcoded-colors-content.test.ts` ✅
- `npm run type-check` ✅

### Step 4 验证与回归（待执行）
- [x] 主题切换回归
- [ ] 四平台截图对比
- [x] 长内容渲染稳定性

#### Step 4 自动验证增量（已完成）
- 样式契约补强（主按钮基线 + focus-visible + reduced-motion + markdown层级）
  - 文件：
    - `src/content/features/__tests__/visual-consistency.contract.test.ts`
    - `src/renderer/styles/__tests__/StyleManager.test.ts`
- 交互样式收敛
  - `src/content/features/save-messages-dialog.css.ts`：新增 `--aimd-dialog-button-height` 与焦点可见样式
  - `src/content/utils/FloatingInputStyles.ts`：textarea 与按钮 `focus-visible`
  - `src/styles/toolbar.css.ts`：toolbar 按钮 `focus-visible`
  - `src/components/Button.ts`：从 `:focus` 改为 `:focus-visible`
- 代码块背景主题化
  - `src/utils/design-tokens.ts`：新增 light/dark `--aimd-code-block-bg`
  - `src/renderer/styles/StyleManager.ts`：`--codeBlock-bg` 改为主题 token 驱动

#### Step 4 验证记录
- `npm run test -- src/content/features/__tests__/visual-consistency.contract.test.ts` ✅
- `npm run test -- src/renderer/styles/__tests__/StyleManager.test.ts src/content/features/__tests__/visual-consistency.contract.test.ts` ✅
- `npm run test -- tests/integration/parser/chatgpt-codeblock-rendering.test.ts tests/unit/parser/CodeExtractor.test.ts src/content/features/__tests__/save-messages-dialog.styles.test.ts tests/unit/styles/no-hardcoded-colors-content.test.ts` ✅
- `npm run type-check` ✅

#### 当前剩余人工项
- 跨平台一致性（D1-D5）
- 对比度主观验收（E1）
- 键盘全链路反馈（E4）

### Step 5 Token 规范体检（新增，已完成）
- 扫描结论：
  - `getAimdSemanticTokens` 的 dark/light token 名称集合对称（无缺口）。
  - 发现并修复一处确定性误重复：dark 分支 `--aimd-feedback-info-bg` 重复定义。
- 代码修复：
  - `src/utils/design-tokens.ts`（移除重复行）
- 新增规范测试：
  - `tests/unit/styles/design-token-hygiene.test.ts`
  - 覆盖：light/dark token 对称性、dark 分支 exact 重复赋值防回退。
- 验证：
  - `npm run test -- tests/unit/styles/design-token-hygiene.test.ts src/content/features/__tests__/visual-consistency.contract.test.ts src/renderer/styles/__tests__/StyleManager.test.ts` ✅
  - `npm run type-check` ✅

### Step 6 对比度基线自动化（新增，已完成）
- 新增测试：
  - `tests/unit/styles/design-token-contrast.test.ts`
  - 覆盖 dark/light 关键组合：主文本/背景、次文本/背景、主按钮文本/背景、代码块文本/背景。
- 发现并修复问题：
  - light 模式 `--aimd-button-primary-text` / `--aimd-button-primary-bg` 对比度不足（3.68 < 4.5）。
  - 修复：`src/utils/design-tokens.ts` 将 light 主按钮底色从 `#3B82F6` 调整为 `#2563EB`，hover 调整为 `#1D4ED8`。
- 验证：
  - `npm run test -- tests/unit/styles/design-token-contrast.test.ts tests/unit/styles/design-token-hygiene.test.ts src/content/features/__tests__/visual-consistency.contract.test.ts src/renderer/styles/__tests__/StyleManager.test.ts` ✅
  - `npm run test -- tests/integration/parser/chatgpt-codeblock-rendering.test.ts tests/unit/parser/CodeExtractor.test.ts src/content/features/__tests__/save-messages-dialog.styles.test.ts tests/unit/styles/no-hardcoded-colors-content.test.ts` ✅
  - `npm run type-check` ✅

### Step 7 i18n/可访问性文案审查（新增，进行中）
- 扫描范围：
  - `src/content/components/*PanelButton.ts`
  - `src/content/components/toolbar.ts`
  - `src/content/features/re-render.ts`
  - `src/bookmarks/components/SimpleBookmarkPanel.ts`
- 发现并修复：
  - `re-render.ts` 书签按钮 title 存在硬编码 `'Bookmark'`，已改为 `i18n.t('btnBookmark')`。
- 新增防回退测试：
  - `tests/unit/i18n/no-hardcoded-accessibility-labels.test.ts`
  - 断言关键英文可访问性文案（View/Remove Bookmark、Confirm/Cancel rename）不再硬编码存在。
- 本步验证：
  - `npm run test -- tests/unit/i18n/no-hardcoded-accessibility-labels.test.ts` ✅
  - `npm run test:core` ✅
  - `npm run type-check` ⚠️ 阻塞（非本轮改动）：
    - `src/content/features/chatgpt-folding.ts` 引用缺失模块 `../components/ChatGPTFoldBar`
    - 同文件存在 `AppSettings` 类型字段不匹配（`performance`/`chatgptFoldingMode` 等）
- 本步新增修复（继续推进）：
  - `src/bookmarks/components/SimpleBookmarkPanel.ts`
    - 文件夹/书签 checkbox 的 `aria-label` 从英文模板改为 i18n：
      - `selectFolderAndChildren`
      - `selectBookmarkItem`
    - 排序按钮 direction title 从英文硬编码改为 i18n：
      - `sortByTimeAscTitle`
      - `sortByTimeDescTitle`
      - `sortAlphaAscTitle`
      - `sortAlphaDescTitle`
  - `public/_locales/en/messages.json` 与 `public/_locales/zh_CN/messages.json`
    - 新增上述 6 个词条
  - `tests/unit/i18n/no-hardcoded-accessibility-labels.test.ts`
    - 增加对排序 title 英文硬编码回流的防回退断言
- 追加验证：
  - `npm run test -- tests/unit/i18n/no-hardcoded-accessibility-labels.test.ts tests/unit/styles/design-token-hygiene.test.ts tests/unit/styles/design-token-contrast.test.ts src/content/features/__tests__/visual-consistency.contract.test.ts` ✅
  - `npm run test:core` ✅

### Step 8 平台筛选器完整性与图标一致性修复（新增，已完成）
- 背景：
  - 书签管理面板平台筛选仅显示 ChatGPT/Gemini，缺少 Claude/Deepseek。
  - “全部平台”使用了独立裸图标结构，导致图标尺寸/行高与其余选项不一致。
- 修复内容：
  - `src/bookmarks/components/SimpleBookmarkPanel.ts`
    - 平台下拉补齐：
      - `Claude`
      - `Deepseek`
    - “全部平台”图标从网格改为漏斗 `filter` 图标。
    - 所有平台选项统一使用 `.platform-option-icon` 容器，移除 `all` 分支的特殊 DOM 拼接逻辑。
    - 平台选择按钮内图标统一 `.platform-option-icon` 尺寸（16x16），消除高度偏高。
    - 新增 `data-selected="claude"` 与 `data-selected="deepseek"` 的按钮样式分支（沿用中性背景）。
  - `src/assets/icons.ts`
    - 新增 `Icons.filter`（funnel icon）。
- 验证：
  - `npm run test:core` ✅（62/62）

### Step 9 Toolbar 控件统一与样式覆盖清理（新增，已完成）
- 背景：
  - 工具栏控件高度不一致（搜索框/平台筛选/排序/图标按钮）。
  - 右侧图标按钮缺少统一外框，且 `.toolbar-icon-btn` 存在重复定义，后定义会覆盖前定义。
- 修复内容：
  - `src/bookmarks/components/SimpleBookmarkPanel.ts`
    - 新增统一高度变量：`--aimd-toolbar-control-height: 40px`
    - 统一搜索框、平台筛选、排序组、图标操作组高度。
    - 右侧新建/导入/导出改为 `icon-action-group` 分段外框样式（统一边框+分隔线）。
    - 删除重复的 `.toolbar-icon-btn` 定义，避免静默样式覆盖。
- 验证：
  - `npm run build:chrome` ✅
