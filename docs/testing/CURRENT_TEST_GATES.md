# Current Test Gates

This document defines the **current executable test and verification gates** for day-to-day development. Use this file for what we must run now, not for future-state testing architecture.

For long-term testing direction, see `docs/testing/TESTING_BLUEPRINT.md`.
For full manual regression, see `docs/testing/E2E_REGRESSION_GUIDE.md`.
For ChatGPT runtime performance work and historical bundle measurements, see `docs/testing/PERFORMANCE_GATES.md`.
For message PNG and formula asset export, see `docs/testing/IMAGE_EXPORT_GATES.md`.

---

## 1. Document Roles

- `CURRENT_TEST_GATES.md`
  - current required verification for active development
- `TESTING_BLUEPRINT.md`
  - long-lived testing architecture and extension rules
- `E2E_REGRESSION_GUIDE.md`
  - full manual regression checklist for release or major refactor
- `IMAGE_EXPORT_GATES.md`
  - executable image-export correctness, visual, budget, performance, bundle, and three-browser contract

### ChatGPT DOM content pool current override (2026-08-26)

The active gate follows [ADR-0024](../adr/ADR-0024-chatgpt-dom-authoritative-content-pool.md)
and [ADR-0030](../adr/ADR-0030-chatgpt-get-seed-dom-completion.md). Chrome and
Firefox first use the bounded 5.3 document-start bridge seed when available;
the normal DOM-only path remains `partial`, while a validated source seed is
`get`. The explicit `?message=` path only proves official navigation skeleton
detection; it must not start a whole-history slot sweep or force page scrolling.
Tests must prove the official action row is the readiness trigger, DOM is the
only assistant body authority, and one PageIndex observer plus one page-level
debounce drives the pool. Startup-existing and arbitrarily delayed action rows,
generation end, assistant-only first messages, append/update/idempotency,
virtualized unmount retention, SPA A→B→A pool restoration, and coalesced
`pageshow`/`resume`/visible recovery are mandatory. Formula click/copy and
PNG/SVG/MathML actions must work directly from mounted formula DOM even when
the containing message has not entered the Repository. Static/runtime gates
must reject active conversation network requests, credential access, polling,
retry ladders, per-message timers, second observers, second pools, and a
Settings discovery retry action. The 5.3 bridge must remain bounded to
website-owned same-origin JSON GET observation. A single-target Directory,
Stepper, Reader or bookmark navigation may use bounded materialization, but
page entry must not iterate persistent slots or call `scrollIntoView()` for
every message. Directory and same-page/cross-page bookmark restore must enter
the same navigation coordinator and target executor. Failure preserves a
partial or get pool; message bookmarks without a unique assistant ID never
fall back to a stored position, even with a complete snapshot.

---

## 2. Minimum Automated Gates

### Code Changes

Default minimum gate:

- `npm run build`

This is the repository-wide required proof for repo-tracked code changes unless the user explicitly waives it.

`docs/FEATURES.md` 定义的是能力真相与 release-level acceptance；本文件定义的是当前实际要运行的命令门禁。若两者表述有差异，以本文件作为日常 gate 选择权威。

### Contract, Runtime, Or Boundary Changes

If the change affects protocol, storage, adapter contracts, runtime boundaries, or release/build gates, run:

- `npm run test:smoke`
- `npm run test:acceptance`
- `npm run build`

### Broad Behavior Changes Or Risky Refactors

If the change touches multiple modules, user-visible flows, or high-risk paths, run:

- `npm run test:core`
- `npm run build`

Use targeted tests in addition when the failure mode is local and well defined.

For performance refactors, use the current correctness and runtime checks described in `PERFORMANCE_GATES.md`. Its dated bundle limits are historical measurements, not active build gates.

### Reader annotation persistence and manager

For ChatGPT Reader annotation persistence, storage, anchoring, or manager changes, run the focused annotation contract/repository/client/anchor/Reader-manager tests, then:

- `npm run test:core`
- `npm run test:smoke`
- `npm run test:acceptance`
- `npm run build`
- `npm run perf:chatgpt`
- `git diff --check`

The focused gate must cover per-conversation bundle isolation, malformed-bundle skipping, CRUD and revision conflicts, exact ChatGPT host checks, refresh/reopen hydration, duplicate-text and ambiguous-anchor handling, current/all manager projections, 50/50 source excerpts, bulk selection/deletion, and exact cross-conversation tab navigation. Persistence-preference coverage must prove that durable annotations stay visible and durably editable/deletable while the preference is off, the global durable collection remains queryable, and only newly created annotations remain runtime-only. Manual release acceptance still covers installed Chrome MV3 and Firefox MV2 flows, refresh/restart persistence when enabled, saved-record visibility plus runtime-only creation when disabled, detached Reader sharing, branch/source loss, and the required light/dark, locale, narrow-width, zoom, reduced-motion, and keyboard states.

If the change affects lazy content feature loading, also run `tests/unit/governance/content-feature-boundary.test.ts`, `tests/unit/runtimes/content/lazyContentFeatures.test.ts`, the affected real trigger-path tests, `npm run build`, and `npm run perf:chatgpt`. The benchmark must prove no feature module request before a real trigger, a successful BookmarksPanel mount after the lower-right button click, and zero host-origin feature chunk requests. Build verification must execute `content-features.js` and retain all callable facade exports.

If the change affects message PNG, formula assets, the export renderer protocol/lifecycle, renderer build resources, PNG worker, ZIP compression, or image-export settings delivery, apply the complete gate in `IMAGE_EXPORT_GATES.md`. At minimum, run the focused semantic document/profile/planner/protocol/client/encoder/host/delivery tests, the real Toolbar Copy PNG and Save Messages triggers, formula hover tests, `npm run test:core`, `npm run test:smoke`, `npm run test:acceptance`, and `npm run build`. The closeout must prove budget-safe multi-selection produces one long PNG, message effective ratio never drops below 1x, only hard overflow produces the minimum-part ZIP, no final full-height canvas exists, startup loads no renderer capability, and artifact chunks decode exactly.

For PNG progress changes, the Save Messages trigger must preserve both the detailed image-rendering bar and the total-export bar. Renderer phases must reach the UI without being renamed as delivery work, alternating rasterize/encode updates must never move progress backward, and finalization must arrive before the terminal artifact completes. Toolbar Copy PNG remains a single compact progress bar that uses the same phase projection.

For large structural refactors, the minimum acceptable closing gate is:

- affected feature family tests
- `npm run test:acceptance`
- `npm run build`

For ChatGPT content discovery, directory, or bookmark-position changes, targeted verification must prove every entrypoint agrees on the same Content Port V1 semantic snapshot and atomic Conversation Surface, including obtained count/order, typed identity, pending/mounted/unmounted state, and page→canonical promotion:

- directory rail click
- Reader locate / jump-to-message
- toolbar bookmark save/highlight
- bookmarks panel Go and cross-page pending navigation
- Save Messages export source, when the change touches Reader content source, conversation snapshot fallback, or export turn conversion

If those entrypoints intentionally share a ChatGPT-only helper, include one targeted test for each caller instead of only testing the helper in isolation. For ChatGPT bookmark-position or directory-navigation work, the focused set should cover `tests/unit/ui/content/chatgptDirectory.navigation.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts`, `tests/unit/ui/bookmarks/bookmarksPanelController.test.ts`, and `tests/unit/runtimes/content/entry.test.ts`. If the work changes the lower-right ChatGPT message stepper, its Settings visibility toggle, or arrow-key navigation, also cover `tests/unit/ui/content/controllers/ChatGPTMessageStepperController.test.ts`, `tests/unit/services/settings/settingsService.test.ts`, and `tests/unit/ui/bookmarks/settingsTabView.test.ts`. Configurable navigation must additionally cover the 1000–5000px range with 400px steps and the real Settings write path. If the work changes the directory rail settings surface, also cover `tests/unit/services/settings/settingsService.test.ts` and `tests/unit/ui/bookmarks/settingsTabView.test.ts`; if it changes official ChatGPT navigation hiding, also cover `tests/unit/ui/content/controllers/ChatGPTOfficialNavigationVisibilityController.test.ts`.

The message-navigation gate covers the stepper's
`chatgpt-refresh-message-navigation` trigger, empty `message` URL construction,
full-page reload, official navigation skeleton, and the shared directory/
bookmark navigation entrypoints in
`tests/unit/drivers/content/chatgpt/ChatGPTOfficialNavigation.test.ts`,
`tests/unit/ui/content/chatgptDirectory.navigation.test.ts`,
`tests/unit/ui/bookmarks/bookmarksPanelController.test.ts`, and
`tests/unit/runtimes/content/entry.test.ts`.

For ChatGPT content-discovery or conversation-root replacement changes, the real trigger path must prove: the 5.3 document-start bridge observes only website-owned same-origin JSON GETs; no extension conversation GET/POST, credential access, POST/SSE observation or second source is introduced; source turns enter `get`; no pool compile occurs before an official action row or while stop/generation state is active; one compile occurs after readiness; first and assistant-only messages enter the pool; same ID same Markdown causes no publication; same ID DOM Markdown replaces a GET body once; new messages retain old loaded turns; the outer host-slot sequence accepts only contiguous prefix/tail/both extension; an initial ten-slot suffix remains ordered after a direct jump to 62 slots; a historical empty slot hydrates in place; empty-slot-only growth causes no compile or token churn; mounted subwindows cannot shrink retained topology; reordered/unrelated sequences and conflicting assistant-slot bindings preserve the last authority; mutable `conversation-turn-N` rebasing is ignored; virtualized unmount never deletes content; page→canonical promotion preserves token; SPA A→B→A restores separate pools; wake signals coalesce to one rescan; and dispose/full reload clears runtime memory. One Conversation Surface continues to drive Directory and Stepper, and provides Toolbar host facts. An official row plus non-streaming mounted DOM must mount Toolbar before Repository publication; current-message Copy/Reader/Export/word count and connected same-message selection/annotation must remain usable from that DOM when pool evidence is absent or stale. Cross-message Reader/export and bookmarks continue to use the same GET/DOM-corrected pool, with bookmarks requiring canonical identity and pool-proven position. Formula actions consume mounted formula DOM directly. Static/runtime coverage must prove zero extension conversation GET/POST, no active conversation request, no credential access, no polling/retry ladder/per-message timers, no second observer/repository/join, and no Settings Retry.

The message-navigation extension of this gate additionally covers the empty
`message` query, official navigation count, no automatic slot sweep, shared
navigation execution, GET-to-DOM correction, and position-only bookmark
fallback being rejected until complete.

For Semantic Content, surface selection, or source-quality changes, run `tests/unit/services/semantic-content/SemanticContent.test.ts`, `tests/unit/services/semantic-content/SurfaceProjection.test.ts`, `tests/unit/drivers/content/adapters/ContentSurfaceAdapter.test.ts`, `tests/unit/services/reader/conversationContentReaderProjection.test.ts`, `tests/unit/services/reader/readerMarkdownCopy.test.ts`, `tests/unit/governance/semanticContentArchitecture.test.ts`, and the affected real consumer trigger tests, then `npm run test:chatgpt-discovery`, `npm run test:core`, `npm run test:smoke`, `npm run test:acceptance`, and `npm run build`. Coverage must prove immutable project-owned nodes, UTF-16 half-open source spans, complete provenance/coverage cache isolation, context-based duplicate disambiguation, rejection of unproven decoded offsets, wrapper-insensitive TextQuote evidence, content/materialization invalidation in `SurfaceProjection`, surface-token/Range invalidation at the interaction trigger, and one canonical projection shared by ordinary and structured selections. Governance must reject DOM/browser/platform imports in the Semantic Module, DOM handles in surface evidence, parser-library AST leakage, and any second source/surface join.

For ChatGPT message-toolbar injection or official action-row hydration changes, focused verification must enter through `ConversationSurface` in `tests/unit/ui/content/messageToolbarOrchestrator.official-anchor.test.ts` and the real first-turn lifecycle test. It must cover delayed/replaced action rows, removal of an extension-owned host, pending content that leaves official controls untouched, one obtained toolbar identity, and numeric word count. Do not test the retired ChatGPT private scanner or recovery timer. Changes to the shared non-ChatGPT DOM scheduler additionally require `tests/unit/ui/content/messageToolbarOrchestrator.scheduler.test.ts`, then `npm run build`.
Optional website timestamp reads and subscriptions must fail open: absent or failing metadata hides only the time row and must not interrupt toolbar injection or replacement.

For Copy hover-surface changes, `tests/unit/ui/content/messageToolbar.tooltip.test.ts` preserves the PNG-only sequence: the PNG action opens above after 100ms, the main Copy tooltip appears below after 150ms without rebuilding or moving that action, the overlap-tolerant bridge survives the trigger-to-action pointer transition, and the PNG tooltip appears above its own button. With Prompt+Reply enabled, Copy uses one portal with PNG above and the paired-conversation action below; move the main tooltip to the side. `messageToolbarOrchestrator.official-anchor.test.ts` must enter through the actual Copy trigger, complete browser-like `pointerdown` then `click` on the lower action exactly once, preserve pairing/clipboard guards, and prove no standalone secondary toolbar button. Cover independent switches, parent Copy visibility, focus retention, dismissal and the shared Settings preview.

For ChatGPT Input Enhancement or formula-assistant changes, focused verification must include the unified setting normalizer/effective-state resolver, pure `markdownAuthoring`, `markdownMath`, LaTeX snippets, native composer range edits, `ChatGPTComposerEditingController`, Prompt autocomplete formula ownership, the real content-runtime settings sync path, and manifest consistency. Migration coverage must prove new installs enable every item, all four legacy Markdown/Enter combinations map correctly, old fields are not written back, and the Settings master preserves child preferences. UI tests must enter through Settings → Input & Prompts, prove the effective `available && enabled` state and child controls, verify ordinary Enter is handled before host form capture when newline is enabled, and preserve IME, Prompt autocomplete, modifier shortcuts, theme, and locale behavior.

List tests must cover independent ordered/unordered capability gates plus Lezer-confirmed list levels; Enter at item end, body start, and body middle; middle insertion/splitting with following continuous sibling renumbering; empty-item exit; first-marker exit; non-first marker-to-equal-width continuation; second-Backspace direct join; delimiters, spacing, tabs, indentation, digit-width transitions, nested subtrees, blockquotes, continuations, discontinuities, loose-list siblings, and whole-line deletion. Negative coverage must include indented/nested/fenced code, invalid markers, selected ranges, disabled list types, IME, modifiers, failed native edits, and ordinary host fallback. Formula tests must prove suggestions-only never renders, preview-only never loads the catalog, both-off schedules no formula work, `$...$` and `$$...$$` remain distinct, `\` never opens outside math, no `@` trigger exists, stale results cannot replace newer state, and snippet tab stops restore selection. UI work must use the real tokenized mocks at `mocks/components/bookmarks-workspace/` and `mocks/components/formula-composer-assistant/`, checking light/dark, English/Chinese, open/closed/disabled/pending, two-instance isolation, reduced motion, narrow viewport clamp, and console errors. Run focused Vitest, `npm run test:core`, `npm run test:smoke`, `npm run test:acceptance`, `npm run build`, and `git diff --check` before completion.

Input Enhancement lifecycle coverage must replace the entire observed hydration shell through the real body mutation boundary, then prove the new composer keeps its effective Enter/list behavior without restoring the removed configuration button. The shared composer mount remains in use by the annotation chip: its fixture must reflect the live ChatGPT leading-action structure and prove the chip is a sibling rather than a descendant of the official plus-button container. Page-width coverage must prove the shared ChatGPT thread-width limiter expands the composer together with the conversation and returns cleanly to 100%.

For complete Library transfer and Google Drive backup changes, focused verification must include `tests/unit/contracts/protocol.test.ts`, `tests/unit/governance/manifest-generation.test.ts`, `tests/unit/core/cloudBackup/library.test.ts`, `tests/unit/core/cloudBackup/snapshot.test.ts`, `tests/unit/core/cloudBackup/restorePlan.test.ts`, `tests/unit/runtimes/background/bookmarks-handler.test.ts`, `tests/unit/runtimes/background/cloudBackup-handler.test.ts`, `tests/unit/drivers/background/googleDriveProvider.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts`, and Google Drive lifecycle UI coverage in `tests/unit/ui/bookmarks/bookmarksPanel.test.ts`, then `npm run test:smoke`, `npm run test:acceptance`, and `npm run build`. Transfer coverage must prove 4.0 local round-trip, old arrays/2.0/3.0 files, old cloud snapshots with bookmark-only scope, new cloud round-trip, malformed bundle refusal, empty-folder restoration, local-wins conflicts, incomplete-index refusal, occupied-key protection for old formats, preview-hash binding, complete Drive pagination, duplicate-folder and duplicate-ID refusal, and read-back verification of emergency snapshots before replacement. UI changes must prove Settings exposes Data Management with Google Drive Backup (Experimental) and Local Backup cards without exposing unfinished providers or sync wording. OAuth changes must cover manifest `oauth2` SSOT for Google Chrome `getAuthToken`, WebAuth-compatible browser fallback, Firefox/WebAuth fallback, sanitized diagnostics, invalid OAuth request mapping, exact `identity.getRedirectURL()` usage, access-token expiry caching, Firefox allizom-to-loopback redirect handling, connected account display/clear behavior, and connect-before-OAuth confirmation.

For Save Messages source changes, verification must prove the dialog enters through the fresh `readerContentSource`, does not call legacy adapter-based export collection, and does not choose its own ChatGPT body source. ChatGPT source changes must also prove Reader / Save Messages / toolbar copy item counts stay aligned with the shared DOM-derived `ReaderItem[]` source for all messages already in the tab-local pool, even when their assistant DOM is no longer mounted. Keep at least one real `SaveMessagesDialog` trigger-path test plus service-level coverage for `ReaderItem[]` to `ChatTurn[]` conversion. If the source change touches formulas, also prove the Markdown branch applies `formula.markdownCopyFormulaFormat` only at clipboard or Markdown-file exits, while PDF/PNG rendering and Reader canonical content stay untouched.

For ChatGPT direct semantic-selection changes, focused verification must cover ordinary paragraph text plus every supported structured unit. The primary path must capture one same-message, non-streaming Range as typed target + content/materialization/surface tokens + TextQuote, resolve exactly one canonical Markdown span from either source-backed or sealed `host-rendered` content, preserve Markdown wrappers when a whole semantic node is selected, and share one canonical Markdown snapshot across the configured keyboard exits. Repeated quotes need context disambiguation; stale content/materialization tokens, remounted surface roots, changed Range endpoints, reconstructed source, decoded offsets without a proven source map, cross-message selection, streaming content, and unsupported input must fail open. The strict rendered-unit DOM converter remains a bounded compatibility path only for legacy composition roots without canonical content/materialization ports: its existing partial/full, nested-unit, KaTeX, ordered-list, noise-removal, parser-budget, and clone-cleanup tests stay required, but a production semantic rejection must never revive it or publish back into content source/persistence. Formula coverage must prove a sealed host-rendered turn can recover canonical formula Markdown through injected surface atoms and the real shortcut path, while visual glyph text is never promoted to authoritative TeX. The real shortcut path must cover document `selectionchange` → evidence/snapshot → configured `keydown`, `mod-c` finalization, `mod-shift-c` direct clipboard, host handlers before and after the extension phase, runtime settings delivery, repeated init/dispose, editable-target guards, and invalidation when tokens or Range change. `none` leaves host copy untouched; successful exits write only canonical `text/plain` and never load the Reader/export renderer graph. Run the Semantic Content focused gate above plus `tests/unit/core/latex/extractLatexSource.test.ts`, `tests/unit/drivers/math-click.test.ts`, `tests/unit/services/copy/atomicSelectionMarkdown.test.ts`, `tests/unit/ui/content/controllers/ChatGPTAtomicSelectionController.test.ts`, `tests/unit/ui/content/FormulaAssetHoverController.test.ts`, `tests/unit/runtimes/content/entry.test.ts`, and affected settings/performance governance tests, then the repository-wide gates required for a broad behavior change.

The legacy direct-selection compact-fragment compatibility gate applies only to composition roots without canonical content/materialization ports. It must prove that only Range-intersecting content is cloned, formatting ancestors are re-closed, ordered-list numbering is retained, and large KaTeX visual trees are replaced with authoritative TeX atoms before entering the shared DOM normalization, noise removal, rendered-whitespace normalization, parser, and cleaner path. Include a host-like copy-event case where visual formula text is written first and a formula larger than the former 5000-node ancestor budget still finishes as canonical Markdown-only `text/plain`. Parser aborts must escape local error boundaries and be rejected before cleaner output; inline and display formula delimiters must remain balanced across mixed selections. This gate does not describe the production ChatGPT path, which must use `SurfaceProjection` over sealed Repository content.

If the change affects Detached Reader, `readerSession:*` protocol, Reader extension page entry, or cross-tab session routing, focused coverage must include `tests/unit/contracts/protocol.test.ts`, `tests/unit/runtimes/background/readerSession-handler.test.ts`, `tests/unit/runtimes/content/entry.test.ts`, `tests/unit/runtimes/reader/entry.test.ts`, `tests/unit/services/reader/readerSessionSnapshot.test.ts`, `tests/unit/ui/content/controllers/ChatGPTMessageStepperController.test.ts`, and `tests/unit/ui/reader/readerPanel.presentation.test.ts`, then `npm run test:smoke` and `npm run build`. The tests must prove `sessionId + sourceTabId + readerTabId` isolation, reader/source tab close cleanup, session-storage-only snapshots, source-unavailable errors, first-use notice acknowledgement only after successful session creation, Split View remaining available when Previous/Next buttons are hidden, detached bookmark parity through the shared bookmark save dialog and bookmarks protocol, detached SendPopover parity through the full SendPort draft/write/submit contract, and detached locate activating the source ChatGPT tab without closing the detached Reader tab. If the change affects KaTeX rendering in Reader, also prove the detached page has local KaTeX stylesheet/font coverage without relying on ChatGPT page-global styles.

If the change affects a shared surface with 2+ entrypoints, verification must also prove that production callers route through the surface-owned profile contract instead of directly shaping low-level chrome flags.

If the change affects shared overlay / modal motion, verification must also prove:

- surfaces enter `opening/open/closing` in the expected order
- close paths do not immediately unmount the surface before exit motion completes
- ESC / outside-click dismiss still fire once
- focus restore still happens after the close pipeline completes
- reduced-motion fallback does not reintroduce geometry or lifecycle regressions

Do not assume `npm run test:acceptance` covers this contract by itself. Shared motion changes require:

- affected shared motion unit suite
- affected surface-owner tests
- manual browser verification of open/close feel on the touched surface families

### UI System Gate

The delivered UI system has executable appearance, token, Surface, coverage, style-value, architecture-closure, and visual-harness contracts. Any change to UI lifecycle, chrome, token ownership, responsive behavior, or a cataloged Surface must run the affected feature/trigger tests plus the relevant focused suites:

- appearance and injection: `tests/unit/style/appearance.test.ts`, `appearanceOverrides.test.ts`, `appearanceScope.test.ts`, `pageTokens.test.ts`, and `tokens.test.ts`
- Surface lifecycle: `tests/unit/ui/components/surfaceRuntime.test.ts` and the affected owner/real-trigger tests
- catalog and style governance: `tests/unit/governance/uiSurfaceCoverage.test.ts`, `uiTokenGraph.test.ts`, `uiStyleBoundaries.test.ts`, and `uiVisualHarnessContract.test.ts`
- closure after shared-boundary or long-chain changes: `tests/unit/governance/uiLegacySurfaceClosure.test.ts`, `uiReaderArchitecture.test.ts`, and `uiReaderStyleClosure.test.ts`

The governance contract currently enforces:

- auto-discovery of shipped style-bearing source rather than a historical file allowlist
- one coverage entry per user-visible Surface with production owner/entry, profile, DOM scope, responsive contract, Chrome/Firefox targets, real trigger test, and tracked direct or family real-component fixture
- token closure for undefined references, duplicate non-isolated owners, cycles, unconsumed Public aliases, unreachable foundation tokens, direct component consumption of Reference/System tokens, and registered Family-token ownership
- raw color, spacing, radius, shadow, z-index, motion, and non-print `!important` checks across discovered shipped UI; only exact popup and static export/render-output signatures with an owner and reason are exceptions
- absence of the production-dead Send modal, generic Tabs, Markdown compatibility shims, empty Bookmarks overlay subclass, and redrawn Panel Studio fixture
- real-component geometry checks for switch-thumb centering plus Bookmarks filter clipping and bookmark type/title/date collisions

`npm run test:ui:visual` is executable. The default run is a small Chromium smoke matrix over registered direct real-component fixtures. Use `npm run test:ui:visual -- --full` for the full registered matrix, or `npm run test:ui:visual -- --mock=<fixture-name>` for one direct fixture. The harness mounts real Modules with production token/Shadow DOM paths, applies variants through the visual bridge, stores evidence under the untracked `output/ui-visual/` directory, and fails on page/console errors, horizontal overflow, or fixed Surface viewport escape. Before capturing the matrix, Chromium also performs a production-host pointer hit test: an empty full-screen Shadow host must pass page clicks through, while its real surface must remain clickable.

On a clean checkout, install the Playwright Chromium binary once with `npx playwright install chromium`; `npm install` installs the Playwright package but not that browser binary.

The full UI visual matrix is:

- widths: 320, 390, 768, 1024, and 1440 CSS pixels
- heights: 568 and 900 CSS pixels where the Surface can be height-constrained
- zoom: 100% and 200%
- appearance: light and dark
- locale: English, Chinese, and representative long labels
- motion: default and reduced motion
- state: default, hover, active, focus-visible, disabled, pending, error, empty, and two simultaneous instances

Automated and manual evidence must reject horizontal overflow, clipped controls, overlapping metadata, unreachable actions, double scrolling, viewport escape, console errors, stale hosts after destroy, and duplicate hosts after hydration replacement. The Chromium visual harness does not replace the Chrome MV3 / Firefox MV2 installed-extension manual matrix.

For a broad UI-system or multi-family refactor, the closing gate is:

- focused suites above and affected real trigger-path tests
- `npm run test:core`
- `npm run test:smoke`
- `npm run test:acceptance`
- `npm run test:ui:visual -- --full`
- `npm run build`
- Chrome MV3 and Firefox MV2 manual checks from `E2E_REGRESSION_GUIDE.md`
- `git diff --check`

### Bug Fixes

For testable bugs:

- add a failing reproducer test first
- run the relevant targeted test until it fails for the expected reason
- fix the implementation
- rerun the targeted test
- finish with `npm run build`

For overlay, modal, popover, panel, or shared-primitive regressions, targeted verification must include at least one real trigger-path test in addition to direct surface tests.
When outside-dismiss, transient popovers, or nested overlays are involved, that trigger-path test must exercise the browser-like event sequence (`pointerdown` before `click`) instead of relying only on `.click()`.

Examples:

- `lower-right AI-MarkDone entry -> bookmarks panel toggle -> panel open`
- `toolbar action -> reader popover open`
- `settings trigger -> modal/dialog open`

If the bug affects shared behavior or a critical path, also run `npm run test:smoke` or `npm run test:core` as appropriate.

---

## 3. Manual Gates

Manual regression is required when:

- preparing a release
- adding or expanding platform support
- changing UI injection, toolbar behavior, reader behavior, bookmarks flows, or browser compatibility boundaries
- changing image-export rendering, clipboard/download fallback, visual output, long-image budgets, formula assets, or renderer lifecycle
- changing style-system rules, external style-library boundaries, or overlay/toolbar UI architecture

Use:

- `docs/testing/E2E_REGRESSION_GUIDE.md`

For new UI modules or major UI refactors, manual regression now also includes the mock-first visual gate:

- build a real mounted mock in `mocks/components/<module>/index.html`
- open it in a browser and validate light/dark, key interaction states, dual-instance rendering, and live `shadowRoot` style nodes
- keep screenshot or snapshot evidence before merging the implementation into `src/ui/**`
- if the change introduces or modifies an overlay host/runtime boundary, also validate:
  - backdrop / surface / modal layering
  - repeated open/close stability
  - modal stacking and ESC routing
  - open/close motion state transitions and delayed unmount behavior
  - both Chromium-style shared stylesheet and Firefox-style fallback paths

---

## 4. Recommended Gate Selection

- Docs-only changes
  - no automated test gate required unless a test/document contract changes
  - architecture or testing SSOT changes require the focused docs-governance test, `npm run test:acceptance`, and `git diff --check`
- UI workflow or style-system policy changes
  - update the relevant docs and call out the new mock-first/browser validation expectation explicitly
- Localized implementation change
  - targeted tests + `npm run build`
- Shared contract or boundary change
  - `npm run test:smoke` + `npm run build`
- Shared overlay / modal motion change
  - affected motion unit suite + affected surface-owner tests + `npm run build`
  - add `npm run test:acceptance` when the change also updates governance/docs about the active gate
- High-risk or cross-module change
  - `npm run test:core` + `npm run build`
- Image-export architecture or output change
  - the full focused/visual/performance/browser matrix in `docs/testing/IMAGE_EXPORT_GATES.md`
  - `npm run test:core` + `npm run test:smoke` + `npm run test:acceptance` + `npm run build`
- Release preparation
  - `npm run release:verify` + Chrome/Firefox release packages + checksums + relevant manual regression
  - add `npm run test:core` for broad behavior changes, risky refactors, or release-candidate hardening runs where the full fixture set is available

### Acceptance / Release Governance

Use `npm run test:acceptance` when the change affects:

- supported hosts / platform coverage declarations
- manifest/build artifact consistency
- release-level compatibility statements in `docs/**`

Current acceptance gate includes:

- `tests/unit/governance/manifest-resource-consistency.test.ts`
- `tests/unit/governance/manifest-generation.test.ts`
- `tests/unit/governance/release-scripts.test.ts`
- `tests/unit/governance/supported-hosts-consistency.test.ts`
- `tests/unit/governance/i18n-keys.test.ts`
- `tests/unit/governance/uiSurfaceCoverage.test.ts`
- `tests/unit/governance/uiTokenGraph.test.ts`
- `tests/unit/governance/uiStyleBoundaries.test.ts`
- `tests/unit/governance/uiVisualHarnessContract.test.ts`
- `tests/unit/governance/uiLegacySurfaceClosure.test.ts`
- `tests/unit/governance/uiReaderArchitecture.test.ts`
- `tests/unit/governance/uiReaderStyleClosure.test.ts`
- `tests/unit/ui/i18n/i18n.test.ts`
- `tests/unit/drivers/shared/browserApi.test.ts`
- `tests/unit/services/content/ConversationContentRepository.scenario.test.ts`
- `tests/unit/drivers/content/chatgpt/ChatGPTConversationSurface.test.ts`
- `tests/unit/drivers/content/chatgpt/ChatGPTConversationSurface.test.ts`
- `tests/unit/ui/content/chatgptDirectory.navigation.test.ts`
- `tests/unit/ui/content/messageToolbarOrchestrator.official-anchor.test.ts`
- `tests/unit/ui/content/controllers/ChatGPTDirectoryController.test.ts`
- `tests/unit/ui/reader/readerPanel.bookmarkAction.test.ts`
- `tests/unit/runtimes/content/entry.test.ts`

---

## 5. Done Criteria

Verification is complete only when:

- the selected automated gates actually ran
- the results are stated explicitly
- any required manual regression is called out
- remaining edge cases and recommended follow-up tests are made explicit

For ChatGPT discovery, the selected gate must prove that a completed mounted
assistant enters the tab-local pool only after its official action row exists.
An unfinished assistant is omitted. A delayed row may arrive at any later time
and wake the single debounced scan; there is no retry deadline. Existing pool
content remains consumable after DOM virtualization and SPA navigation.

# Current ChatGPT discovery gate (DOM-authoritative tab-local pools)

The active production contract is ADR-0024:

- `ChatGPTPageIndex` is the only Page Monitor; no second observer is allowed.
- `ChatGPTConversationHostMonitor` requires assistant ID, non-empty body,
  connected official action row and non-generating state, then clones and
  compiles the body once through the existing Markdown Adapter.
- One page-level debounce coalesces initialization, relevant mutation,
  `pageshow`, `resume` and visible wakes. There are no per-message timers,
  polling or retry ladders.
- Typed user-message character/child-list hydration is a relevant content
  mutation and reuses that same coalesced capture; it does not add an observer
  or change the public snapshot contract.
- `ConversationContentRepository` maintains one in-memory pool per conversation
  key. Equal bodies are idempotent, changed bodies replace in place, DOM removal
  does not delete, and SPA A→B→A restores each pool.
- Ordinary entry reports `historyStatus=partial`; an accepted 5.3 source seed
  reports `get`; the current runtime does not manufacture `complete` through
  an empty `?message=` page-entry sweep, and new topology downgrades an
  existing proven state to `get` or `partial`.
- Formula click/copy and PNG/SVG/MathML actions parse mounted formula DOM
  directly and do not wait for Repository admission.
- Cross-message Reader/export and bookmarks keep the Content Port; Directory
  and Stepper keep the atomic Conversation Surface. Toolbar uses Surface host
  facts but current-message actions read the corresponding mounted DOM.
- The production path has no active conversation request, Settings retry,
  React-private-state access or synthetic scroll. Chrome/Firefox use only the
  bounded 5.3 document-start GET seed bridge; Safari remains DOM-only.
- Chrome MV3 and Firefox MV2 manifests contain the bridge resource without any
  added permission. Extension conversation GET/POST remains zero.

The focused command is `npm run test:chatgpt-discovery`. It must be followed by
the repository test ladder, `npm run type-check`, `npm run perf:chatgpt`,
`npm run build`, and `git diff --check`. Installed Chrome MV3 and Firefox MV2
acceptance is recorded separately and is never inferred from Vitest/build
output. The runtime must remain free of cookies, storage-token/auth-header
reads, extension conversation GET/POST, generation response parsing, React
internals, permanent polling and synthetic discovery scroll.

### Library / highlights UI refactor (2026-09-12)

- Production-trigger coverage: `libraryWorkflow.test.ts` enters through BookmarksPanel; selection swatches enter through `ChatGPTPageAnnotationController.test.ts`; `messageToolbar.capsule.test.ts` covers expand/click/collapse and operation state.
- Storage coverage: `highlights-handler.test.ts` verifies isolated namespace, repeat creation, recolor, revisions, missing deletion, quota and corrupt-bundle preservation. The passive bridge test checks capture-only timestamp reads and invalidation without extra fetches.
- Local browser fixtures run actual highlight/annotation handlers against the explicitly disposable `AIMD_VISUAL_HIGHLIGHTS_DISPOSABLE:` localStorage prefix. Reader and library fixtures share it for cross-entry creation, reload, recolor and removal; production has no fixture imports.
- Static CSS remains covered by the style inventory after moving Reader/picker styles to `.css?inline`. Export tests assert scoped token values without relying on declaration order.

- Cross-browser highlight workflow: `npx tsx scripts/harness-highlights.ts` runs native text selection, storage restore, library recolor, original URL and synchronized removal in Chromium/Firefox, light/dark, against disposable fixture data. `npm run test:ui:visual -- --browser=firefox` selects Firefox; `--full --mock=<path>` runs 41 responsive variants. Browser name is recorded with the evidence.
- The performance fixture leaves its initial `lang` unset and waits for the existing locale initialization before sampling unchanged toolbar identities. Locale initialization remains inside cold-start collection. This avoids mistaking the initial language refresh for host-message rebinding; stability assertions and performance budgets are unchanged.
- For the two redesigned primary views, run the bookmarks-workspace fixture with `--workspace-view=library` and `--workspace-view=settings` separately, together with `--full` and each browser. The fixture clicks and verifies the actual module button; without this override, its legacy responsive variants also cover secondary information pages. The requested view is recorded in the summary. Manual preview uses `index.html?view=library` or `?view=settings`.

### Workspace materials and conversation management (2026-09-13)

- `libraryWorkflow.test.ts` covers same-title conversations with distinct identities, cross-page selection, scope changes, cancellation, partial batch writes, and failed writes followed by failed reads. The September 14 organization change replaces the conversation navigation window with folder navigation (see below). Successful records leave the selection; failed records remain retryable. Read retries must not repeat writes or claim an unsuccessful batch was saved.
- `npx tsx scripts/harness-highlights.ts` creates two same-title conversations through Reader selection and verifies independent recolor, batch recolor, delete cancellation and synchronized deletion in Chromium/Firefox, light/dark. The current harness additionally covers the folder and custom-title workflow below.
- `npx tsx scripts/harness-workspace-components.ts` opens all eight Settings categories, the annotation template editor, bookmark action menu and folder picker through their visible triggers in Chromium/Firefox, light/dark. It checks readable navigation, primary-button contrast, menu containment and the absence of a second search-field border. Menu measurements wait for the disclosure's positioning event. These checks supplement the 41-variant matrices for each primary view and browser.
- Actual rendered components are the visual acceptance source; a matching prototype alone is insufficient. Check hidden controls, selected/hover/focus/disabled states, nested dialogs, and the completed sidebar transition. Installed-extension ChatGPT acceptance remains separate from disposable browser fixtures.

### Shared mark folders and direct Settings entry (2026-09-14)

- `markLibrary-handler.test.ts` covers read-only opening of old data, stable folder/conversation identities, shared custom titles and folder assignments, revision conflicts, sibling-name validation, cycles, four-level depth, occupied-folder deletion, malformed catalogs and protocol validation. Original bookmark and mark stores must remain unchanged by organization operations.
- `libraryWorkflow.test.ts` enters through BookmarksPanel and covers 500 folders with at most 40 mounted rows, 500 conversation groups with 20 per page, 3000 records with at most 20 mounted bodies, shared annotation/highlight names and folders, retryable edits, lost acknowledgments, and conversation/item batch scopes. Root-folder renames must preserve their null parent; folder moves must expand the new ancestor path and retain the visible selection. Group moves must not rewrite source records. A retained empty conversation remains manageable after its last record is removed.
- `readMarkDocumentTitle.test.ts` covers passive current-conversation title capture and rejection of mismatched or generic source titles. `lazyContentFeatures.test.ts` verifies that the real lazy panel proxy forwards an explicit Settings destination; entry, shell and stepper tests cover the visible trigger, duplicate-icon removal, and selection restoration.
- `harness-highlights.ts` exercises native selection → reload → rename conversation → create/move to folder → reopen → batch recolor/delete across both browsers and themes. Its narrow-window assertions include each folder action's bounds, not only overall panel overflow.
- `harness-workspace-components.ts` also checks always-visible information links, clearing/restoring the selected Settings category, and hovering/clicking the right-bottom brand/Settings trigger. It must not stop at calling the panel method directly.
- Full Library and Settings visual matrices remain required for both browsers. Bundle size is no longer a build gate; the old budget script is available only for historical comparison. Keep lazy feature loading and extension-origin chunk checks in the build and performance gates. Run performance gates without other concurrent build/browser matrix workloads to avoid contention in timing measurements.
- The ChatGPT performance fixture must reproduce the official action row's Flex layout. Its `flex` class alone has no effect without the website stylesheet; omitting the rule incorrectly left-aligns a right-aligned capsule and makes its actions unreachable. Keep real toggle/Copy clicks in the gate, with no forced clicks or skipped hit testing.

### Library recovery and typography regression (2026-09-21)

- Exercise FAQ / Changelog / About → a Settings **category**, then assert the Settings body and heading are visible and the information page is hidden. Clicking only the top-level Settings module does not cover this path.
- Fail the folder service for both annotations and highlights while their source services succeed. Existing items must stay readable; folder navigation, conversation naming and moves remain unavailable until a read retry succeeds; no fallback writes or empty-catalog replacement are allowed.
- Group a normal ChatGPT URL and a project URL with parameters under the same conversation identity. Keep the existing large-list, two-level pagination, folder-depth and batch scope regressions.
- The component browser harness clicks message capsule controls at desktop and 375px widths, checks every action fits the expanded drawer when space is available, verifies Escape collapse, and checks a closed Directory preview cannot intercept clicks. Its standalone progress demonstration must have its own layout space.
- During installed unpacked-extension acceptance, reload the extension **and** refresh its ChatGPT page after a build. A newer lazy UI module with an older resident background may support highlight/annotation requests but ignore the new organization request. Verify the read-only source and folder responses separately; fixture mocks and a successful build cannot prove installation parity.
