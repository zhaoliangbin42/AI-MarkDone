# Changelog

All notable changes to AI-MarkDone will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- ChatGPT: Reader now opens on the message that launched it instead of falling back to the last message when DOM and payload message ids differ.
- ChatGPT: Conversation snapshots now refresh on conversation route changes and conversation payload fetches, improving full-history recovery after in-app navigation.
- ChatGPT: Save Messages export now uses the same payload-backed conversation source as Reader, so exported content no longer depends on the currently hydrated DOM range.

## [4.1.2] - 2026-04-22

### Added
- ChatGPT: Added a right-side conversation directory with live previews and direct jump actions for users who prefer staying on the native page.
- Reader: Restored full-thread discovery on ChatGPT by redesigning the content discovery engine for the new incremental-loading page model.

### Changed
- ChatGPT: Removed the old message folding feature after the platform switched to incremental loading and inactive-node unloading, making the old fold-bar path both less necessary and less stable.

### Fixed
- Reader: Dynamic Annotations now support deleting existing annotations.
- Bookmarks: Restored bookmark item renaming through the shared prompt dialog and existing save path.
- Reader and Sending: Fixed prompt insertion inside the Reader send box.
- Bookmarks: Partially improved jump-to-original positioning on ChatGPT, though incremental loading can still require a second click for a fully accurate jump.

## [4.1.1] - 2026-04-20

### Fixed
- Sending: Fixed Reader annotation insertion from the send popover so choosing an annotation prompt no longer closes the popover before the compiled text is inserted.

## [4.1.0] - 2026-04-19

### Added
- Reader: Added atomic closed-unit selection handling for inline math, display math, inline code, code blocks, tables, and images so these units can be copied as source without changing normal text-selection behavior.
- Reader: Added page-lifetime inline annotations with selection-linked highlights, right-gutter anchors, editable annotation popovers, and source-based annotation export.
- Settings: Added a Reader settings section for reusable annotation-export prompts and a persistent annotations copy template, while keeping the Reader export popover focused on previewing and copying the final result.
- Reader and Sending: Added prompt-picker driven annotation export actions so Reader copy now starts by choosing a prompt and Send popovers can insert compiled annotation text at the local textarea caret.
- Bookmarks: Added dedicated `Changelog`, `About`, and `FAQ` information tabs, with sponsor/support content now folded into a more editorial About page.
- Settings: Added built-in English starter prompts, a structured default annotation template, and restore-default actions for both Reader prompt presets and the annotations copy template.

### Changed
- Reader and toolbar source access now rely on the Reader markdown copy and atomic source-selection flow, replacing the retired standalone source panel entry points.
- Reader source copy now keeps formulas, code blocks, tables, images, and other closed Markdown units tied to their original source boundaries, so copying inside Reader preserves structure instead of flattening rendered content.
- Bookmarks: Rewrote the About page copy around the author's real workflow pain points, added a direct feedback email entry, and expanded the support section with a Xiaohongshu contact card.
- Bookmarks: Clarified the About and FAQ copy around formula-copy workflows, including the click-to-copy formula shortcut and the older pain point of having to copy a whole block just to extract one formula.

### Fixed
- Reader: Fixed keyboard copy inside the reader so `Ctrl/Cmd+C` now exports markdown source for selected reader content instead of the rendered visible text.
- Reader: Strengthened atomic closed-unit selection feedback with clearer square-edged highlights that stay visually noticeable without shifting Reader layout or markdown spacing.
- Reader: Refined annotation selection controls so only assistant markdown body selections trigger floating actions, top-edge selections no longer cover the first line, and floating copy/annotation buttons keep an opaque hover surface above content.
- Sending: Fixed the Reader send popover so prompt insertion stays available even before any annotations are added, allowing the same entry point to work as a lightweight prompt launcher.
- UI: Fixed outside-dismiss behavior so dragging a text selection from inside popovers, modals, or overlay panels and releasing on the backdrop no longer closes the active surface accidentally.
- Settings: Reworked Reader annotation-export prompts into an ordered prompt library without built-in/default prompt state, including drag reordering and placeholder-menu based template editing.

## [4.0.0] - 2026-04-02

### Added
- ChatGPT and DeepSeek: Added an adapter-driven header bookmark icon entry backed by a shared runtime orchestrator.
- ChatGPT: Added a toolbar collapse action so foldable assistant messages can collapse their current turn group directly from the official message toolbar.

### Changed
- Platform adapters now own page-header icon anchors and injection rules, keeping runtime lifecycle logic platform-agnostic.
- ChatGPT: Removed the experimental folding power mode and restored the folding runtime to a pure hidden-only path.
- ChatGPT: Moved the toolbar collapse action to the far right of the official toolbar action row, keeping the word-count stats at the end of the surface.
- Unified the runtime style pipeline around shared reference tokens, semantic tokens, and stable UI exports.
- Overlay panels and modal surfaces now share a documented title typography contract, with Reader, bookmarks, save dialogs, and sending surfaces aligned to the same tokenized chrome/control system.
- Reader, source, bookmarks, export dialogs, and modal/popover controls now share one canonical panel chrome token contract for header/footer/button sizing.
- Reader, bookmarks, toolbar, folding, and save dialogs now inherit the default UI font instead of shipping separate sans-serif stacks.
- UI text surfaces now use a shared ChatGPT-aligned sans token inside Shadow DOM, while source/code views keep a dedicated mono token.
- Reader and bookmark panels now use rebuilt mock-aligned shells, with the reader footer showing the current page and long pagination sets wrapping inside a capped scroll area.
- Source panels now use the rebuilt mock-aligned shell and shared overlay host pipeline while keeping raw markdown copy behavior intact.
- Reader pagination now uses shared iconography and legacy-aligned preview cards for a cleaner, more consistent control bar.
- Reader pagination now renders long-range gaps as a dedicated three-dot separator instead of a plain text ellipsis, keeping long conversation navigation cleaner.
- Reader, bookmarks, export dialogs, folding controls, and math-copy feedback now share a single blue-on-white tooltip system instead of mixing browser titles and ad hoc popovers.
- Interactive markdown styling now uses one shared tokenized theme layer across reader and bookmark detail surfaces.
- Markdown rendering now runs through one shared unified pipeline for reader, bookmarks, mocks, and PDF export, with GFM, KaTeX math, syntax highlighting, and sanitization handled in one pass.
- Reader send popovers now use the rebuilt mock-aligned surface and sync drafts through the shared composer bridge when the platform composer is available.
- Shared confirm, prompt, alert, and custom modals now use a rebuilt mock-aligned dialog shell with dedicated shared styling instead of relying on bookmark-panel-local modal CSS.
- Bookmarks: Refined the Sponsor tab into a calmer editorial card layout and realigned its copy with the simpler v3 support wording for GitHub stars and donation channels.
- Bookmarks: Rebuilt the family around a shared shell/view/overlay stack so the panel shell, settings tab, sponsor tab, tree viewport, and save dialog now share one ownership model instead of mixing shell-local and dialog-local implementations.
- Bookmarks: Consolidated settings dropdowns and steppers around family-scoped primitives so panel dismiss logic no longer depends on child-specific selectors.

### Fixed
- Reader: Fixed cross-entry reader drift by moving toolbar-reader and bookmark-preview entrypoints onto named surface-owned profiles, keeping footer chrome and action rails more consistent.
- Bookmarks: Fixed the save dialog title field so IME composition no longer collapses while typing, keeping focus local to the bookmark save panel instead of rebuilding the active input on each keystroke.
- Bookmarks: Added a local input-event boundary to the management panel so internal search, settings, and tree interactions are less likely to leak to host-page or third-party page handlers.
- Bookmarks: Unified panel and save-dialog modal handling around the same shared overlay session so rename, move, folder-pick, and nested root-folder flows no longer drift between separate interaction stacks.
- Modal Motion: Shared dialogs and overlay panels now open and close through two shared motion families (`panel-window` and `modal-dialog`), including exit animations that complete before the surface unmounts.
- UI: Fixed hover and active contrast drift across shared panel chrome, bookmark dialogs, bookmarks management, send surfaces, and the message toolbar so light and dark themes keep clearer interaction feedback.
- UI: Deepened dark-mode surfaces, borders, and hover layers across bookmarks, the reader pager, sending surfaces, folding controls, and the toolbar so controls separate more clearly from the background.
- Toolbar: Fixed shared tooltips for icon-only toolbar buttons so hover/focus on nested SVG nodes shows the expected tooltip again.
- Gemini and DeepSeek: Restored the top-level header bookmark entry on current layouts by adding adapter fallbacks for the latest header structure.
- Runtime: Fixed the content script entry so markdown enhancement experiments no longer emit module-split imports that break toolbar injection at runtime.
- Markdown: Removed the experimental Mermaid runtime path so content-script stability and bundle size no longer depend on a heavy diagram renderer.
- Markdown: Fixed renderer drift between reader, mock panels, and PDF export by removing the mixed `marked`/`MathJax`/post-highlight paths.
- ChatGPT: Reworked conversation folding so collapsed groups hide the full user/assistant turn sections, removing leaked action rows, thought blocks, source chips, and the old expanded-state left guide.
- ChatGPT: Fixed fold bars and the right-side fold dock so both now follow light/dark theme surfaces instead of staying pinned to a white UI.
- Gemini: Fixed the message toolbar position so it stays aligned with the official action row on the latest layout.
- Claude: Fixed the message toolbar and header bookmark icon injection after the latest layout update.
- ChatGPT: Fixed the toolbar width jumping wider while a response is still streaming.
- Sending: Fixed the send popover so typing now stays local to the popover draft until close or send, avoiding host-composer focus conflicts while editing.
- Math: Restored inline formula hover feedback by resolving the shared interactive highlight token the same way as the legacy v3 path.
- Reader: Fixed the header title truncation, restored larger hover previews, and added a footer shortcut back to the current conversation turn.
- Reader: Fixed rebuilt panel positioning so zoomed or short viewports keep the reader surface inside the visible window.
- Bookmarks: Fixed folder-path and folder-name prompts still using hardcoded placeholders instead of localized UI strings.
- Bookmarks: Fixed the panel empty state so existing folders no longer fall back to the misleading `No folders yet` message.
- Bookmarks: Removed the repair and refresh toolbar icons from the panel surface without changing the underlying maintenance actions.
- Bookmarks: Fixed folder selection, counts, expansion, and empty-folder checkbox behavior in the rebuilt bookmarks tree.
- Bookmarks: Fixed restored folder scopes so tree expansion is driven by explicit state, allowing selected branches to collapse normally instead of being forced open on every render.
- Runtime: Fixed disabled platform settings so page-level toolbar and header injection stop, while the extension action can still open the bookmarks panel.
- ChatGPT: Folding group discovery now consumes adapter-owned conversation groups instead of expanding UI-owned host selector logic, keeping the shipping path aligned with the documented adapter boundary.
- Bookmarks: Restored bookmark row reader previews, added platform icons, added a move action, and updated hover/date layout to match the latest panel design.
- Bookmarks: Fixed rebuilt row actions, outside-click dismiss behavior, and backdrop handling so the panel controls behave consistently with the new shell.
- Bookmarks: Restored shared tooltips in the rebuilt panel and unified input focus/placeholder behavior across bookmark, modal, and send surfaces.
- Source: Rebuilt the raw source panel with the mock-aligned header/body layout while preserving copy, close, outside-click, and escape handling.

## [3.0.0] - 2026-02-18

### Added
- **ChatGPT Conversation Folding**: Added fold bars for ChatGPT conversations with per-thread collapse/expand controls.
- **ChatGPT Quick Dock**: Added a fixed right-side quick control for "Collapse all" and "Expand all".
- **ChatGPT Settings Section**: Added a dedicated ChatGPT settings group with folding mode, default expanded count, and dock visibility toggle.

### Fixed
- Gemini: Fixed Deep Research embedded reader button not extracting content correctly (now uses the same pipeline as the toolbar reader button).

## [2.9.5] - 2026-02-06

### Added
- **ChatGPT Conversation Folding**: Added fold bars for ChatGPT conversations with per-thread collapse/expand controls.
- **ChatGPT Quick Dock**: Added a fixed right-side quick control for "Collapse all" and "Expand all".
- **ChatGPT Settings Section**: Added a dedicated ChatGPT settings group with folding mode, default expanded count, and dock visibility toggle.

### Changed
- **ChatGPT Dock UI**: Refined the right-side dock to a slimmer vertical layout with compact `-` / `+` controls to reduce reading intrusion.
- **ChatGPT Visual Guide**: Updated expanded-message left guide color to a neutral gray style for better consistency.

### Fixed
- Claude: Fixed the header bookmark button not appearing after a site layout update.
- Claude: Fixed header bookmark icon hover alignment.
- ChatGPT: Fixed toolbar appearing outside the message bubble while responses are streaming (now shown after the official action bar is ready).
- ChatGPT: Fixed toolbar being anchored to code-block "Copy" buttons in some messages, causing it to appear near the page edge.
- Bookmarks: Fixed broken empty-state styling in the bookmark panel when no folders exist.
- **ChatGPT Quick Dock**: Fixed the dock disappearing after page re-renders and ensured the full half-area is clickable/highlighted on hover.
- **ChatGPT Reader Pagination**: Fixed thinking-only articles being counted as separate pages in Reader mode
- **ChatGPT Word Count**: Fixed word count getting stuck in loading state for code-only responses (now shows `0 Words / 0 Chars`).
- **Reader Mode Copy**: Copy button now shows feedback after copying markdown.
- **Bookmark Panel**: Fixed remaining hardcoded dialog/button labels so localization is consistently applied.
- **Bookmark Panel**: Fixed several hardcoded dialog/button labels to fully respect localization settings.

### Improved
- **Toolbar Injection Stability**: More robust streaming completion detection and safer activation timing to reduce misplacement during SPA re-renders.
- **Resource Cleanup**: Improved cleanup on navigation to avoid accumulating toolbar listeners and injected DOM nodes across long sessions.
- **Reader Pagination**: Pagination controls now wrap gracefully for long conversations, keeping navigation arrows aligned with the page indicators.
- **Internationalization (i18n)**: Comprehensive localization coverage for English and Simplified Chinese
  - Settings Panel
  - Save Messages Dialog
  - Save Messages Export
  - Batch Delete Dialog
  - Sidebar Tabs
  - Module Prefixes
- **Formula Rendering**: Improved stability by loading KaTeX styles from bundled local assets (no external CDN dependency).
- **Bookmark Reliability**: Improved i18n fallback behavior to avoid raw placeholder keys in initialization race conditions.
- **Build Repeatability**: Removed mixed dynamic/static import patterns to keep packaging deterministic across browser targets.
- **Logging Hygiene**: Reduced high-frequency content-path logging and replaced snippet logs with metadata-only diagnostics.
- **Bookmark Reliability**: Improved i18n fallback behavior to avoid raw placeholder keys in edge initialization races.
- **Build Repeatability**: Eliminated mixed dynamic/static import warnings for a more deterministic packaging pipeline.
- **Logging Hygiene**: Reduced high-frequency content-path logs and removed snippet-style parser logging to better protect conversation privacy.

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
- Wire the rebuilt bookmarks settings panel to live runtime behavior for platform enablement, Reader code rendering, and click-to-copy updates.
- Show real bookmark storage usage in settings with a live progress bar driven by background quota data.
- Refactor injected UI styles to use shared tokens and remove inline overrides in
  bookmark dialogs.
- Localize the rebuilt bookmarks, send, save, and source surfaces so language changes apply immediately without page reloads.

### Fixed
- Dark mode rendering for duplicate bookmarks dialog and export confirm button.
- Remove remaining hardcoded English strings from the rebuilt bookmarks panel and send popover, including import review copy and settings labels.
- Restore native send-popover composer wiring for DeepSeek, Gemini, and Claude by completing their site-adapter send contracts without changing the shared sending infrastructure.
- Close the send popover automatically when clicking outside the surface, while keeping in-popover interactions intact.
- Restore native title tooltips on message toolbar and header icon controls, while keeping preview-style tooltips only where they are actually needed.
- Re-align Claude message toolbar injection to the trailing slot of the official action row and restore DeepSeek's top icon placement next to the title on current layouts.
- Restore copy feedback in the source panel and unify Reader/Source copy confirmation with the shared ephemeral tooltip interaction.
- Tighten responsive footer behavior in the Reader so narrow widths compress the pager first instead of reflowing the surrounding controls.
- Refine the mobile bookmarks tab rail into an even three-column strip so top tabs stay readable and do not overflow on narrow screens.

---

[2.0.0]: https://github.com/zhaoliangbin42/AI-MarkDone/releases/tag/v2.0.0
[0.5.0]: https://github.com/zhaoliangbin42/AI-MarkDone/releases/tag/v0.5.0
- Bookmarks/Modal: Added shared input-event isolation for rename, confirm, and save dialogs so host-page handlers are less likely to intercept modal interactions.
- Bookmarks: Batch delete now removes checked folders themselves, along with their descendant folders and saved items.
- Bookmarks: Fixed the ChatGPT folding settings dropdown so clicking its trigger again closes it inside the shadow-hosted panel, and corrected the expanded-count stepper arrows to use the proper up/down affordances.
- Bookmarks: Brightened dark-mode platform toggles and added clearer spacing between platform icons and labels in settings so the platform section reads more cleanly against the dark panel surface.
- Bookmarks: Fixed the Sponsor GitHub star CTA to render as a real external link with the expected target and rel attributes instead of relying on a button-only click action.
- Reader: Fixed external-open affordances so the header action now hides when no conversation target exists, and rendered markdown links open with explicit safe external-link attributes.
- UI Contracts: Promoted transient-root outside-click handling into a shared UI contract and introduced a reusable overlay session wrapper, then moved Save Messages and shared modal flows onto the same overlay slot model.
- Modal Stability: Mounted shared modals into explicit overlay modal roots and switched them onto the shared keyboard-scope stack so nested dialogs close and restore focus more reliably.
- Sending/Toolbar: Moved Send Modal back onto the shared overlay-host route and renamed toolbar pseudo tokens to the formal `--aimd-toolbar-*` component contract without changing placement behavior.
- UI: Rebalanced panel typography so settings groups, sponsor sections, bookmark folders, reader content, toolbar stats, send status, and folding controls follow a clearer shared size hierarchy.
## Unreleased

### Changed
- Reader annotation export now uses a multiline template with explicit `【选中文字】` and `【用户注释】` placeholders instead of separate prompt-1/2/3 fields, while keeping a separate user prompt header for LLM-ready output.
