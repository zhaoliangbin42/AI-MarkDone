# Changelog

All notable changes to AI-MarkDone will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Dialog System**: Unified `DialogManager` and `DialogHost` for accessible, Shadow DOM-based alerts, confirms, and prompts.
- **Bookmark Import**: Duplicate detection and merge dialog for imports.
- **Storage Warning**: Storage quota warning system (95%/98% threshold alerts).

### Changed
- **Architecture**: Redesigned Z-Index architecture to use a rational hierarchy (1-10000) instead of `z-max`, fixing layering issues.
- **Performance**: Significantly improved bookmark batch import speed (10-50x).
- **Performance**: Significantly improved bookmark batch delete speed (25-75x).
- **UI**: Changed import dialog interface to English.

### Fixed
- **Bookmarks**: Fixed duplicate handling logic during bookmark import.
- **Bookmarks**: Fixed detailed count display in import success message.
- **Storage**: Corrected storage limit constant (5MB → 10MB).

## [2.2.0] - 2026-01-08

### Added
- **StreamingDetector**: Cross-platform streaming completion detection (`src/content/adapters/streaming-detector.ts`)
- **FloatingInput Size Memory**: Window size persists within session
- **Reader Panel Navigation Fix**: Arrow states update correctly after new messages

### Changed
- **GEMINI.md 3.0**: Streamlined following Claude Code best practices
- **Documentation Architecture**: Established "Documentation as Contract" system

### Fixed
- Trigger button state sync issue
- Last message content not refreshing on re-entry

## [2.1.0] - 2026-01-04

### Added
- Reader Mode for focused reading
- Bookmark management system

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

## Roadmap

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
