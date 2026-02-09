# AI-MarkDone E2E Regression Guide

## 1. Purpose
This guide is the long-term, repeatable end-to-end (E2E) checklist for each release or major refactor.

## 2. Scope
- Platforms: ChatGPT, Gemini, Claude, DeepSeek
- Browsers: Chrome (MV3), Firefox (MV2)
- Critical domains:
  - bookmarks (import/move/delete/export/storage lifecycle)
  - reader rendering (markdown/code/math/table)
  - message boundaries and UI safety
  - i18n/localization consistency
  - build/release artifact integrity

## 3. Preconditions
1. Build artifacts:
   - `npm run type-check`
   - `npm run test:smoke`
   - `npm run test:core`
   - `npm run build`
2. Load extension:
   - Chrome: `dist-chrome/`
   - Firefox: `dist-firefox/`
3. Test fixtures available:
   - `tests/bookmarks-200.json`
   - `tests/bookmarks-3000.json`
   - `tests/bookmarks-10mb.json`
   - `tests/bookmarks-invalid.json`

## 4. Test Data Prompts (for LLM output generation)
Use these prompts to generate deterministic stress conversations for reader/render testing.

### 4.1 Mixed Markdown/Code/Math/Table
```text
请生成一篇约 3000-5000 字的技术报告，主题是“构建一个多平台浏览器扩展的架构设计”。
要求：
1) 包含 8 个二级标题、每节 2-4 段；
2) 包含 3 段代码块（TypeScript、Python、SQL）；
3) 包含 2 个 Markdown 表格；
4) 包含 10 个行内公式（如 $O(n \log n)$）；
5) 包含 4 个块级公式（使用 $$...$$）；
6) 包含有序列表和无序列表；
7) 文末给出“风险清单”和“回归测试建议”。
输出必须是规范 Markdown。
```

### 4.2 Math-heavy
```text
请输出 80 条数学表达式，其中：
- 50 条行内公式（每条都不同）
- 30 条块级公式（含分式、积分、矩阵、求和、极限、偏导）
请用规范 Markdown 输出，并确保公式可被 KaTeX 渲染。
```

### 4.3 Table-heavy
```text
请输出 20 个 Markdown 表格。
每个表格 6 列、10 行数据。
内容主题覆盖：性能指标、错误码、功能矩阵、浏览器兼容性、存储统计。
```

### 4.4 Code-heavy
```text
请输出 30 段代码块，语言混合：
TypeScript, JavaScript, Python, Bash, SQL, JSON, YAML, HTML, CSS
每段 20-60 行，包含注释和字符串。
```

### 4.5 Security boundary text
```text
请输出一段“安全测试样本文本”，包含：
1) 普通 Markdown；
2) 看起来像 XSS 的字符串（仅文本展示，不要真正执行）；
3) 超长 URL；
4) 大量特殊字符；
5) 混合中英文与 emoji；
6) 可疑 javascript: 链接样例（仅文本）。
```

## 5. Execution Checklist

### 5.1 Smoke
- [ ] Toolbar appears on all supported sites
- [ ] Bookmark panel opens/closes repeatedly without error
- [ ] Reader opens and navigation works
- [ ] No raw i18n key shown (`btnDelete`, `btnCancel`, etc.)

### 5.2 i18n Consistency
- [ ] Switch to English: all core labels/dialogs are English
- [ ] Switch to Chinese: all core labels/dialogs are Chinese
- [ ] Verify delete dialog button labels
- [ ] Verify move modal button labels
- [ ] Verify context-only confirm dialog text

### 5.3 Bookmark Import/Export Lifecycle
- [ ] Import `bookmarks-200.json` and verify counts/folders
- [ ] Delete all imported bookmarks/folders then re-import same file (no hidden residue)
- [ ] Import `bookmarks-3000.json` (completes without UI deadlock)
- [ ] Import `bookmarks-10mb.json` (capacity guard behavior correct)
- [ ] Import `bookmarks-invalid.json` (graceful fail, no data pollution)
- [ ] Export current state and re-import; verify structure/data

### 5.4 Bookmark Move/Delete Reliability
- [ ] Single item move
- [ ] Batch move (50 / 200 / 1000)
- [ ] Cross-folder subtree move
- [ ] Single delete / batch delete / folder delete
- [ ] Verify no flicker storm and no count mismatch

### 5.5 Reader Rendering
- [ ] Mixed markdown content renders fully
- [ ] Code blocks render with syntax block structure (especially long code blocks)
- [ ] Inline/block math render correctly
- [ ] Tables render correctly
- [ ] Markdown copy content is complete and ordered

### 5.6 Performance Observation
- [ ] 3000 import operation remains responsive
- [ ] 1000 batch move remains responsive
- [ ] 1000 batch delete remains responsive
- [ ] No prolonged frozen UI observed

### 5.7 Cross-Browser
- [ ] Full flow on Chrome
- [ ] Full flow on Firefox
- [ ] Compare behavior parity (feature + text + resource)

### 5.8 Build Artifact Integrity
- [ ] `dist-chrome/manifest.json` equals `manifest.chrome.json`
- [ ] `dist-firefox/manifest.json` equals `manifest.firefox.json`
- [ ] KaTeX CSS + fonts present in both targets
- [ ] locales/icons/popup/background files present as expected

## 6. Expected Result Criteria
A run is considered pass only if all below are true:
1. No silent data loss (bookmark count and folder mapping stable after lifecycle operations).
2. No hidden residual records after delete-all + re-import.
3. Reader does not lose code blocks or break fenced rendering under long content.
4. No raw i18n keys visible in user UI.
5. Core automated gates and build gates are green.

## 7. Defect Logging Template
For each failure, record:
1. Test ID
2. Browser + Platform + Extension build ID
3. Preconditions
4. Exact steps
5. Actual result
6. Expected result
7. Reproducibility (always/intermittent)
8. Artifacts (screenshot/video/console)
9. Suspected module

## 8. Recommended Run Cadence
- Every feature merge affecting bookmarks/reader/settings: run Sections 5.1~5.6.
- Before release tag: run full Sections 5.1~5.8 on both browsers.
