# DEVLOG (Append-only)

Purpose: evidence log for major changes (commands run + observed results). Keep entries short and factual.

---

## 2026-05-04 — Reader annotation prompt position setting

- Added a `reader.commentExport.promptPosition` setting so copied Reader annotations can keep the selected user prompt above the annotations by default or append it below them.
- Kept Reader annotation storage, Reader body rendering, and platform collection unchanged; only the annotation export compilation/settings path owns the order.
- Synced the Reader feature contract, current-state SSOT, changelog, and English/Chinese Settings labels.

Verification:
- `npm run test -- tests/unit/services/reader/commentExport.test.ts tests/unit/services/settings/settingsService.test.ts tests/unit/ui/bookmarks/settingsTabView.test.ts tests/integration/reader/reader-panel.comment.test.ts tests/unit/ui/sending/sendPopover.test.ts tests/unit/ui/reader/readerPanel.bookmarkAction.test.ts` (pass; 59 tests)
- `npm run test -- tests/unit/governance/i18n-keys.test.ts tests/unit/ui/i18n/i18n.test.ts` (pass; 5 tests)
- `npm run build` (pass; Chrome MV3 + Firefox MV2 + entry verification)

## 2026-05-01 — Formula PNG/SVG hover actions + isolated MathJax renderer

- Added formula hover actions for copying or saving a single formula as PNG/SVG while preserving direct click-to-copy LaTeX source.
- Moved MathJax formula asset rendering into an on-demand extension iframe renderer so MathJax is not bundled into `content.js`.
- Added content-side SVG asset caching, in-flight request reuse, renderer timeout handling, and pending-action guarding.
- Updated target manifests/builds so Chrome, Firefox, and Safari ship `formula-renderer.html` and `formula-renderer.js` as web-accessible renderer assets.

Verification:
- `npm run type-check` (pass)
- Target formula/render/toolbar/manifest test set (pass; 41 tests)
- `npm run test:smoke` (pass; 15 tests)
- `npm run build` (pass; Chrome MV3 + Firefox MV2 + entry verification)
- `npm run build:safari:webext` (pass; Safari WebExtension + entry verification)
- `rg "MathJax|@mathjax|MathJaxNewcmFont" dist-*/content.js` (no matches)

## 2026-04-28 — Reader advanced width setting + ChatGPT directory step controls

- Added a collapsed Advanced Settings section for low-frequency tuning and moved Reader content width into `reader.contentMaxWidthPx` with a 1000px default.
- Reader content width now affects only the inner Reader body and remains clamped to the panel width.
- Added ChatGPT previous/next message step controls as a body-level surface that shares the directory controller and navigation helper.

Verification:
- `npm run test -- tests/unit/services/settings/settingsService.test.ts tests/unit/ui/bookmarks/settingsTabView.test.ts tests/unit/ui/reader/readerPanel.presentation.test.ts tests/unit/ui/content/controllers/ChatGPTDirectoryController.test.ts` (pass)
- `npm run test -- tests/unit/ui/content/controllers/ChatGPTDirectoryController.test.ts` (pass after moving step controls out of the rail footer)
- `npm run build` (pass; Chrome MV3 + Firefox MV2 + entry verification)

## 2026-04-27 — v4.2.1 ChatGPT directory positioning recovery

- Reworked ChatGPT directory positioning around a shared user-round position model from adapter/content-discovery output.
- Directory clicks use the round jump anchor; scroll highlighting uses the visible user/assistant round range; rail follow stays local to the directory and yields during user interaction.
- Updated release-facing version metadata, README latest notes, release notes, changelog, in-app changelog, and architecture SSOT for v4.2.1.

Verification:
- `npm test -- tests/unit/ui/content/chatgptDirectory.navigation.test.ts tests/unit/ui/content/controllers/ChatGPTDirectoryController.test.ts tests/unit/ui/reader/readerPanel.bookmarkAction.test.ts tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts tests/unit/ui/bookmarks/bookmarksPanelController.test.ts tests/unit/runtimes/content/entry.test.ts` (pass)
- `npm test -- tests/unit/governance/bookmarks-content-docs.test.ts tests/unit/governance/manifest-generation.test.ts tests/unit/governance/manifest-resource-consistency.test.ts tests/unit/ui/content/chatgptDirectory.navigation.test.ts tests/unit/ui/content/controllers/ChatGPTDirectoryController.test.ts` (pass)
- `npm run build` (pass; Chrome MV3 + Firefox MV2 + entry verification)

## 2026-03-03 — P0 Message Sending (ChatGPT-only) + UI hook + regression gates

- Added message sending vertical domain (core/content driver/service) with ChatGPT adapter hooks.
- Wired ReaderPanel to support a Send action via `sending: { adapter }` (no background/storage writes).
- Fixed ChatGPT send button selection to avoid triggering Voice/Dictate state.
- Adjusted streaming word-count display to avoid duplicate `Streaming…` text.

Verification:
- `npm run type-check` (pass)
- `npm run test:core` (pass)
- `npm run build` (pass; Chrome MV3 + Firefox MV2)

## 2026-03-04 — i18n closure: settings-driven locale switch + catalog loader hardening

- Hardened UI i18n catalog loading (fetch + XHR fallback) and ensured `auto` resolves to an effective locale with catalogs loaded on first run.
- Replaced remaining user-visible UI literals (toolbar/reader/source/send + statuses) with `t()` keys and added missing locale strings.
- Added unit tests covering fetch/XHR catalog load paths, `auto` locale resolution, and substitution behavior.

Verification:
- `npm run type-check` (pass)
- `npm run test:core` (pass)
- `npm run build` (pass; Chrome MV3 + Firefox MV2)

## 2026-03-04 — Bookmarks save-dialog infra: UI-state persistence + draft/folder-picker models (no UI wiring)

- Added bookmarks UI-state RPC for `lastSelectedFolderPath` (`bookmarks:uiState:get/set`) with background write authority.
- Hardened UI-state consistency on folder relocate/delete (updates `lastSelectedFolderPath` to new path or parent/null).
- Added pure “save dialog” draft + folder picker models (mode: `create|edit|folder-select`) and pure bookmark title validation.
- Added unit tests for handler roundtrips, client request shapes, and model correctness/perf.

Verification:
- `npm run type-check` (pass)
- `npm run test:core` (pass)
- `npm run build` (pass; Chrome MV3 + Firefox MV2)

## 2026-03-03 — Docs minimization + governance test scripts update

- Removed outdated docs and legacy review artifacts from `docs/` to keep a small authoritative set.
- Replaced deleted legacy-governance test scripts with current governance gates (dependency boundaries + manifest consistency).

Verification:
- `npm run test:smoke` (pass)
- `npm run type-check` (pass)
- `npm run test:core` (pass)

## 2026-03-04 — Data-freeze hardening: assistant segment SSoT + turn grouping hook + legacy position mapping stability

- Added canonical assistant segment enumeration SSoT for legacy `position` semantics: `listAssistantSegmentElements(adapter)`.
- Refactored bookmark `getAssistantPosition()` and `legacyAssistantPosition` navigation mapping to use the same segment SSoT (prevents “mapped-but-wrong” drift).
- Added optional adapter hook `getTurnRootElement()` to keep turn grouping platform-specific (future adapters can implement without changing services/UI).
- Updated turn collector to build from segment SSoT while keeping nested de-dup for turn grouping only (does not change persisted `position` meaning).
- Added/updated unit tests for segment enumeration, position indexing, and Thinking fixture navigation consistency.

Verification:
- `npm run type-check` (pass)
- `npm run test:core` (pass)
- `npm run build` (pass; Chrome MV3 + Firefox MV2)

## 2026-03-04 — Bookmarks save dialog (UI): title + folder picker + folder creation prompt

- Added `BookmarkSaveDialog` (Material/Gmail-style) for bookmark creation: title input + folder tree picker.
- Persisted last-selected folder via existing background UI-state RPC (best-effort) and used it for default selection.
- Added inline folder creation prompt (no native `window.prompt`) and refreshes folder list on success.
- Wired toolbar “Bookmark” action to open the dialog when saving a new bookmark (remove flow unchanged).
- Added UI unit test for save dialog close result.

Verification:
- `npm run type-check` (pass)
- `npm run test:core` (pass)
- `npm run build` (pass; Chrome MV3 + Firefox MV2)

## 2026-03-11 — Content runtime rollback: remove Mermaid enhancement, keep fenced-code highlighting

- Investigated a full content-runtime regression where toolbar/header injection stopped after `Unexpected token 'export'`.
- Traced the breakage to markdown enhancement experiments that introduced module-split imports into `content.js`; this was incompatible with extension content-script entry constraints.
- Added a stricter entry-format gate to reject runtime dynamic-import syntax in browser entry bundles.
- Removed Mermaid runtime enhancement entirely and reverted Mermaid fenced blocks to regular code-block rendering.
- Kept Markdown theme improvements and fenced-code highlighting in the Reader path without reintroducing content entry chunk splitting.

Verification:
- `npm run test:core` (pass)
- `npm run build` (pass; Chrome MV3 + Firefox MV2)

## 2026-03-21 — Overlay chrome unification + ChatGPT folding polish + bookmarks interaction hardening

- Unified overlay chrome/title contracts across panel and modal families, then aligned Reader/Source/Save dialogs/Bookmarks/Sending surfaces onto the shared tokenized control system.
- Refined ChatGPT folding UX: full-turn folding boundary, flattened fold bar/dock styling, and a ChatGPT-only toolbar collapse action placed before the word-count stats.
- Hardened bookmarks interactions on host pages by adding local/shared input-event boundaries for the bookmarks panel, shared modal host, and bookmark-save dialog flows.
- Fixed bookmarks batch delete so checked folders are removed together with descendant folders and saved items; updated runtime protocol docs for the expanded `bookmarks:bulkRemove` semantics.
- Hid the ChatGPT “folding count” setting unless folding mode is `keep_last_n`, and refreshed sponsor/settings surface details plus platform icons in bookmarks settings.

Verification:
- `npm test -- tests/unit/ui/components/modalHost.test.ts tests/unit/ui/bookmarks/save/bookmarkSaveDialog.test.ts tests/unit/ui/bookmarks/bookmarksPanel.test.ts tests/unit/ui/bookmarks/bookmarksPanel.overlay.test.ts tests/unit/ui/sending/sendPopover.test.ts` (pass)
- `npm test -- tests/unit/ui/bookmarks/bookmarksPanelController.test.ts tests/unit/runtimes/background/bookmarks-handler.test.ts tests/unit/ui/bookmarks/bookmarksPanel.test.ts` (pass)
- `npm test -- tests/unit/ui/bookmarks/bookmarksPanel.test.ts -t "activates the real settings and sponsor panels"` (pass)
- `npm run build` (pass; Chrome MV3 + Firefox MV2)
