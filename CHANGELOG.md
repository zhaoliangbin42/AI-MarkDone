# Changelog

All notable changes to AI-MarkDone will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2025-12-08

### 🎉 Initial Release

#### Added
- **Math Formula Extraction**
  - Extract LaTeX from KaTeX `<annotation>` tags
  - Click-to-copy individual formulas with live highlighting
  - Support for streaming messages (formulas detected in real-time)
  - Inline: `$...$`, Block: `$$\n...\n$$`
  - Handles consecutive formulas like `$a$、$b$`

- **Table Conversion**
  - HTML tables → GitHub Flavored Markdown
  - Extract formulas from table cells (placeholder mechanism)
  - Handles ChatGPT's table wrapper classes

- **Code Block Formatting**
  - Auto-detect programming languages
  - Triple-backtick fences with language tags
  - Preserves syntax highlighting

- **Toolbar UI**
  - Shadow DOM for style isolation
  - Icon-only buttons with tooltips
  - Copy Markdown, View Source, Preview buttons
  - Real-time word/character count on right side

- **Word & Character Count**
  - CJK support: 1 character = 1 word + 2 chars
  - Latin: 1 word = word.length chars
  - Excludes code blocks and math formulas

- **Re-render Panel**
  - Preview Markdown with marked.js + KaTeX
  - Fullscreen toggle
  - GitHub-style CSS
  - Iframe isolation

- **Platform Support**
  - ChatGPT (chat.openai.com, chatgpt.com)
  - Gemini (gemini.google.com) - basic support

#### Technical
- Manifest V3 Chrome extension
- TypeScript 5.6 strict mode
- Vite 5.4 build system
- Adapter pattern for multi-platform
- MutationObserver for streaming detection
- Interval polling for toolbar injection (15s timeout)

#### Performance
- Debounced MutationObserver (200ms)
- WeakSet/WeakMap for memory efficiency
- Shadow DOM prevents CSS conflicts
- Lazy toolbar injection

---

## [Unreleased]

### Planned for v0.6
- Keyboard shortcuts (Cmd+C override)
- Export entire conversation
- Settings panel (theme, format options)
- Support for Claude

### Planned for v1.0
- Firefox support
- Edge support
- Batch export
- Custom templates

---

## [2.0.0] - 2025-12-20

### Changed
- Refactor injected UI styles to use shared tokens and remove inline overrides in
  bookmark dialogs.

### Fixed
- Dark mode rendering for duplicate bookmarks dialog and export confirm button.

---

[2.0.0]: https://github.com/zhaoliangbin42/AI-MarkDone/releases/tag/v2.0.0
[0.5.0]: https://github.com/zhaoliangbin42/AI-MarkDone/releases/tag/v0.5.0
