# Changelog

All notable changes to AI-MarkDone will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Claude: Fixed the header bookmark button not appearing after a site layout update.
- Claude: Fixed header bookmark icon hover alignment.
- **ChatGPT Reader Pagination**: Fixed thinking-only articles being counted as separate pages in Reader mode
- **ChatGPT Word Count**: Fixed word count getting stuck in loading state for code-only responses (now shows `0 Words / 0 Chars`).

### Improved
- **Internationalization (i18n)**: Comprehensive localization coverage for English and Simplified Chinese
  - Settings Panel
  - Save Messages Dialog
  - Save Messages Export
  - Batch Delete Dialog
  - Sidebar Tabs
  - Module Prefixes
- **Formula Rendering**: Improved stability by loading KaTeX styles from bundled local assets (no external CDN dependency).

## [2.9.0] - 2026-02-03

### Added
- **Firefox Browser Support**: Full Firefox compatibility with separated architecture
  - Chrome: MV3 with `service-worker.ts` using `chrome.*` API
  - Firefox: MV2 with `background-firefox.js` using `browser.*` API
  - Content Script: 100% shared code (43,384 lines)
  - Dual-manifest system: `manifest.chrome.json` (MV3) and `manifest.firefox.json` (MV2)
  - Dual-build system: `npm run build:chrome` and `npm run build:firefox`

- **Toolbar Toggle Settings**: Allow users to show/hide individual toolbar buttons
  - Settings schema upgraded from v1 to v2 with automatic migration
  - Added toggles for View Source, Save Messages, Word Count buttons
  - Added platform-specific enable/disable toggles (ChatGPT, Gemini, Claude, Deepseek)
- **Reader Actions**: Added Bookmark, Copy, and View Source buttons to the Reader panel header for quick access.
- **Bookmark Sort Direction Toggle**: Click same sort button twice to toggle ascending/descending order
  - Time sort: Newest first ↔ Oldest first
  - Alphabetical sort: A→Z ↔ Z→A
  - Icons change dynamically to show arrow direction
  - Settings migrated from 2-state to 4-state model with backward compatibility
  
### Changed
- **Reader Visuals**: Updated pagination dots to show bookmarked status with a square indicator.
- **Button Styling**: Enhanced bookmark button with gradient background for clearer active state.
- **Reader Fullscreen**: Fullscreen button icon now toggles between maximize/minimize to reflect current state

### Fixed
- **Reader View Source**: Fixed "View Source" button in Reader panel not displaying modal (missing CSS styles replaced with reusable Modal component)
- **Modal z-index**: Fixed Modal being hidden behind Reader panel by updating z-index from `--aimd-z-modal` (1050) to `--aimd-z-dialog` (9500)
- **Modal ESC Key**: Fixed ESC key closing both Modal and Reader panel simultaneously by using capture phase event listener
- **FloatingInput Sync**: Fixed bidirectional sync with native input - now syncs empty state as well (closing with empty content clears native input)
- **Bookmark Highlight**: Fixed toolbar highlight not showing after page refresh due to async createUI race condition
- **Settings Path**: Fixed `saveContextOnly` setting path from `storage.*` to `behavior.*`
- **Design Tokens**: Standardized CSS token usage in Reader panel styles to comply with design system.
- **Reader Pagination**: Fixed bookmark status indicator offset in pagination dots.
- **Markdown Paragraphs**: Fixed excessive blank lines between paragraphs when copying Markdown (3+ newlines compressed to 2)


### Technical Details
- Separated architecture: Background scripts are browser-specific, Content Script is shared
- Added `ready` Promise and `pendingBookmarkState` pattern to handle async toolbar creation
- Settings migration test suite with 7 test cases

## [2.8.0] - 2026-01-22

### Added
- **Claude Support**: Full support for `claude.ai`, including:
  - **Toolbar Injection**: Toolbar now appears on Claude messages with Markdown handling.
  - **Reader Mode**: Dedicated reader view for focused reading of Claude conversations.
  - **Bookmarks**: Save and manage bookmarks directly from Claude chat history.
  - **Message Extraction**: Accurate parsing of Claude's message structure and artifacts.
- **Deepseek Support**: Full support for `chat.deepseek.com` (Deepseek-V3), including:
  - **Fluid Input**: Synchronized floating input box for seamless typing.
  - **Code Block Formatting**: Normalization of Deepseek's code blocks for standard rendering.
  - **Reliable Sending**: Robust "Anti-Fragile" send button detection logic.
- **Export Conversations**: New Export button in toolbar to download conversations as Markdown files.
- **Header Bookmark Button**: Quick-access bookmark panel button added to page header for Claude and Deepseek platforms.

### Fixed
- **Theme System**: Fixed theme detection regression to ensure toolbar colors match the platform theme (Dark/Light).
- **ChatGPT Formula Extraction**: Fixed inline formulas that failed to render correctly, restoring underscores that were incorrectly converted to italics.
- **Block Math Formatting**: Normalized block math output to remove extra blank lines between `$$` delimiters.
- **Reader Formula Rendering**: Fixed long block formulas not rendering in Reader mode due to chunk splitting during Markdown processing.
- **Floating Input**: Fixed newline characters lost when syncing between floating input and native platform input.
- **Floating Input**: Fixed Shift+Enter triggering host page send action instead of creating newline in Reader's floating input.
- **Reader Panel**: Fixed last page content not reloading when navigating back from other pages.
- **PDF Export**: Fixed cross-platform typography inconsistencies (paragraph margins, heading spacing) between ChatGPT and Gemini.
- **PDF Export**: Fixed Chinese font rendering in print context by adding explicit font stack.
- **Export Dialog**: Fixed tooltip animation appearing from wrong direction.
- **Popup Icon**: Fixed incorrect Deepseek icon.

### Changed
- **Export Icon**: Updated toolbar export button icon from download to file-box for better clarity.
- **Export Title**: Truncated long conversation titles to 100 characters (prevents overflow from verbose Gemini titles).
- **Export Timing**: Replaced setTimeout with requestAnimationFrame for more reliable print timing.

## [2.5.0] - 2026-01-10

### Added
- **Settings System**: Comprehensive settings panel with behavior and storage controls.
  - **Behavior Settings**: Toggle code block rendering in Reader Mode and math formula click-to-copy.
  - **Storage Settings**: Context-only save mode (500 chars: 250 front + 250 back) with confirmation dialog.
  - **Data & Storage Management**: Visual storage usage progress bar with detailed stats and uninstallation data-loss warning.
  - **One-Click Export**: Quick access button in settings to export all bookmarks as a backup.
  - **Persistence**: Settings sync across devices via `chrome.storage.sync`.
  - **UI**: Modern card-style interface with iOS-inspired toggle switches.
- **Sponsor Section**: New donation options for "Buy Me a Coffee" and WeChat.
- **Dialog System**: Unified `DialogManager` and `DialogHost` for accessible, Shadow DOM-based alerts, confirms, and prompts.
- **Bookmark Import**: Duplicate detection and merge dialog for imports.
- **Storage Warning**: Storage quota warning system (95%/98% threshold alerts).

### Changed
- **UI**: Settings panel layout and style now strictly align with Sponsor page design language (shared spacing, tokens, behavior).
- **UI**: Renamed bookmark panel header to "AI-MarkDone".
- **Architecture**: Redesigned Z-Index architecture to use a rational hierarchy (1-10000) instead of `z-max`, fixing layering issues.
- **Performance**: Significantly improved bookmark batch import speed (10-50x).
- **Performance**: Significantly improved bookmark batch delete speed (25-75x).
- **UI**: Changed import dialog interface to English.

### Fixed
- **Scrollbar**: Fixed settings panel scrolling behavior to match Sponsor tab (scrollbar on container edge).
- **Reader UI**: Hidden redundant bubble button within the Reader view.
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
