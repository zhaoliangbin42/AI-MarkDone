# Current Test Gates

This document defines the **current executable test and verification gates** for day-to-day development. Use this file for what we must run now, not for future-state testing architecture.

For long-term testing direction, see `docs/testing/TESTING_BLUEPRINT.md`.
For full manual regression, see `docs/testing/E2E_REGRESSION_GUIDE.md`.
For ChatGPT runtime and bundle performance work, see `docs/testing/PERFORMANCE_GATES.md`.
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

### ChatGPT content and directory current override (2026-08-10)

The active gate follows
[ADR-0018](../adr/ADR-0018-chatgpt-identity-proven-single-content-pool.md).
The document-start bridge observes only eligible website-owned same-origin
`GET` responses and admits at most one identity- and structure-verified Graph
per canonical epoch; `peek()` never performs network I/O. A stable typed DOM
batch may establish the same Repository under a Runtime page identity before a
canonical ID exists, and the first later overlapping Graph may add only a
reliable historical prefix. `ChatGPTConversationSurface` is the single atomic
join between Repository order/content and PageIndex anchors; Directory, Toolbar
and Stepper subscribe only to it. A virtualized assistant-only DOM surface may
restore toolbar/navigation/active-range for an assistant already in the pool
but cannot append semantic content. Tests reject POST observation, fixed
endpoint assumptions, extension conversation requests, synthetic discovery
scrolling, second observers, second repositories/joins, and polling route
discovery. Without canonical identity, all local content consumers work while
bookmark actions are unavailable and send no persistence request.

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

For performance refactors, also run the phase-specific gates in `PERFORMANCE_GATES.md`. A phase may not advance when its correctness, reliability, bundle, or runtime threshold is red.

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

If those entrypoints intentionally share a ChatGPT-only helper, include one targeted test for each caller instead of only testing the helper in isolation. For ChatGPT bookmark-position or directory-navigation work, the focused set should cover `tests/unit/ui/content/chatgptDirectory.navigation.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts`, `tests/unit/ui/bookmarks/bookmarksPanelController.test.ts`, and `tests/unit/runtimes/content/entry.test.ts`. If the work changes the lower-right ChatGPT message stepper, its Settings visibility toggle, or arrow-key navigation, also cover `tests/unit/ui/content/controllers/ChatGPTMessageStepperController.test.ts`, `tests/unit/services/settings/settingsService.test.ts`, and `tests/unit/ui/bookmarks/settingsTabView.test.ts`. If the work changes the directory rail settings surface, also cover `tests/unit/services/settings/settingsService.test.ts` and `tests/unit/ui/bookmarks/settingsTabView.test.ts`; if it changes official ChatGPT navigation hiding, also cover `tests/unit/ui/content/controllers/ChatGPTOfficialNavigationVisibilityController.test.ts`.

For ChatGPT content-discovery or conversation-root replacement changes, the real trigger path must prove typed facts observed before a canonical ID publish one stable `host/complete` turn through the shared toolbar entrypoint. Word count, Directory, Stepper, Reader, copy, formula and export must work immediately; bookmark remains disabled and makes no save/remove call. A later formal ID must promote the same projection without changing bodies, projection ID or content token, then restore the unchanged bookmark chain. A canonical conversation without a Graph must accept a stable DOM batch immediately; an existing Graph-backed conversation must preserve hidden history and append later stable turns. A DOM-first pool followed by a Graph must prepend only a typed-overlap-verified historical prefix, preserve existing Markdown/digests, and change the token once; no-overlap, order/identity conflict, late capture, or baseline failure must leave the ready pool unchanged. Coverage must prove generic semantic-segment routes, arbitrary eligible GET paths/query locations, bounded Graph traversal, `source/hybrid/host` diagnostic basis, dense `complete` entries, duplicate identity idempotency, page→canonical promotion, same-URL clear-plus-generation reset, History event ordering, A→B epoch fencing, BFCache/root replacement, and virtualized remount without content-token churn. The single PageIndex observer must carry generation start/end and same-owner identity replacement across split persistent-slot hydration, turn per-character updates into dirty assistant IDs, compile zero times before the initial 400 ms quiet boundary and at most once after a strong completion signal or the bounded 2-second compatibility confirmation. A unique mounted pool tail must outrank generation evidence; candidates before it, beyond unresolved rounds, or from a replaced root are deferred/fenced. One Conversation Surface must atomically drive Directory visibility/items/geometry and Toolbar/Stepper state. Content admission cannot require an official action row, but toolbar injection still requires exact `readTurn()`, a connected official action anchor and non-streaming state; it mounts once with numeric word count while preserving official action/send state. Reader, formula, whole-message copy, export and uniquely proven local Markdown selection consume the same pool; bookmark consumes it only with canonical identity. Static/runtime coverage must prove zero extension conversation GET/POST, no POST observation, request bodies, credentials, cloned SSE, fixed endpoint cascades, consumer retry polling, content RouteWatcher, discovery Coordinator, second observer/repository/join, consumer `setSnapshot`, UI acquisition, duplicate Reader source or independent toolbar DOM discovery.

For Semantic Content, surface selection, or source-quality changes, run `tests/unit/services/semantic-content/SemanticContent.test.ts`, `tests/unit/services/semantic-content/SurfaceProjection.test.ts`, `tests/unit/drivers/content/adapters/ContentSurfaceAdapter.test.ts`, `tests/unit/services/reader/conversationContentReaderProjection.test.ts`, `tests/unit/services/reader/readerMarkdownCopy.test.ts`, `tests/unit/governance/semanticContentArchitecture.test.ts`, and the affected real consumer trigger tests, then `npm run test:chatgpt-discovery`, `npm run test:core`, `npm run test:smoke`, `npm run test:acceptance`, and `npm run build`. Coverage must prove immutable project-owned nodes, UTF-16 half-open source spans, complete provenance/coverage cache isolation, context-based duplicate disambiguation, rejection of unproven decoded offsets, wrapper-insensitive TextQuote evidence, content/materialization invalidation in `SurfaceProjection`, surface-token/Range invalidation at the interaction trigger, and one canonical projection shared by ordinary and structured selections. Governance must reject DOM/browser/platform imports in the Semantic Module, DOM handles in surface evidence, parser-library AST leakage, and any second source/surface join.

For ChatGPT message-toolbar injection or official action-row hydration changes, focused verification must enter through `ConversationSurface` in `tests/unit/ui/content/messageToolbarOrchestrator.official-anchor.test.ts` and the real first-turn lifecycle test. It must cover delayed/replaced action rows, removal of an extension-owned host, pending content that leaves official controls untouched, one obtained toolbar identity, and numeric word count. Do not test the retired ChatGPT private scanner or recovery timer. Changes to the shared non-ChatGPT DOM scheduler additionally require `tests/unit/ui/content/messageToolbarOrchestrator.scheduler.test.ts`, then `npm run build`.

For Copy hover-surface changes, `tests/unit/ui/content/messageToolbar.tooltip.test.ts` must enter through the real Copy hover trigger and preserve the original Main sequence: the PNG action opens above after 100ms, the main Copy tooltip appears below after 150ms without rebuilding or moving that action, the overlap-tolerant bridge survives the trigger-to-action pointer transition, and the PNG tooltip appears above its own button. The trigger path must also complete a browser-like `pointerdown` then `click` on Copy PNG exactly once.

For ChatGPT Input Enhancement or formula-assistant changes, focused verification must include the unified setting normalizer/effective-state resolver, pure `markdownAuthoring`, `markdownMath`, LaTeX snippets, native composer range edits, `ChatGPTComposerEditingController`, Prompt autocomplete formula ownership, the real content-runtime settings sync path, manifest consistency, and real button-to-popover-to-guide triggers. Migration coverage must prove new installs enable every item, all four legacy Markdown/Enter combinations map correctly, old fields are not written back, and both master switches preserve child values. UI tests must prove Settings only controls `available`; the composer button opens rather than toggles; runtime/list masters disable the correct descendants; async saves use one full snapshot and roll back atomically; Escape/outside click/focus/ARIA/theme/locale behavior remains correct; and hydration replacement leaves one button.

List tests must cover independent ordered/unordered capability gates plus Lezer-confirmed list levels; Enter at item end, body start, and body middle; middle insertion/splitting with following continuous sibling renumbering; empty-item exit; first-marker exit; non-first marker-to-equal-width continuation; second-Backspace direct join; delimiters, spacing, tabs, indentation, digit-width transitions, nested subtrees, blockquotes, continuations, discontinuities, loose-list siblings, and whole-line deletion. Negative coverage must include indented/nested/fenced code, invalid markers, selected ranges, disabled list types, IME, modifiers, failed native edits, and ordinary host fallback. Formula tests must prove suggestions-only never renders, preview-only never loads the catalog, both-off schedules no formula work, `$...$` and `$$...$$` remain distinct, `\` never opens outside math, no `@` trigger exists, stale results cannot replace newer state, and snippet tab stops restore selection. UI work must use the real tokenized mocks at `mocks/components/input-enhancement/` and `mocks/components/formula-composer-assistant/`, checking light/dark, English/Chinese, open/closed/disabled/pending, two-instance isolation, reduced motion, narrow viewport clamp, and console errors. Run focused Vitest, `npm run test:core`, `npm run test:smoke`, `npm run test:acceptance`, `npm run build`, and `git diff --check` before completion.

Input Enhancement lifecycle coverage must replace the entire observed hydration shell through the real body mutation boundary, then prove that the new composer keeps its effective Enter/list behavior and restores exactly one availability-gated button. The mount fixture must reflect the live ChatGPT leading-action structure, prove the AI-MarkDone host is a sibling rather than a descendant of the official plus-button container, verify official hover handlers do not receive the Input Enhancement pointer event, and verify the shared tooltip replaces native `title`. Page-width coverage must prove the shared ChatGPT thread-width limiter expands the composer together with the conversation and returns cleanly to 100%.

For Google Drive backup changes, focused verification must include `tests/unit/contracts/protocol.test.ts`, `tests/unit/governance/manifest-generation.test.ts`, `tests/unit/core/cloudBackup/snapshot.test.ts`, `tests/unit/core/cloudBackup/restorePlan.test.ts`, `tests/unit/runtimes/background/cloudBackup-handler.test.ts`, `tests/unit/drivers/background/googleDriveProvider.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts`, and Google Drive lifecycle UI coverage in `tests/unit/ui/bookmarks/bookmarksPanel.test.ts`, then `npm run test:smoke`, `npm run test:acceptance`, and `npm run build`. UI changes must prove Settings exposes Data Management with Google Drive Backup (Experimental) and Local Backup cards without exposing unfinished providers or sync wording. OAuth changes must cover manifest `oauth2` SSOT for Google Chrome `getAuthToken`, WebAuth-compatible browser fallback, Firefox/WebAuth fallback, sanitized diagnostics, invalid OAuth request mapping, exact `identity.getRedirectURL()` usage, access-token expiry caching, Firefox allizom-to-loopback redirect handling, connected account display/clear behavior, and connect-before-OAuth confirmation.

For Save Messages source changes, verification must prove the dialog enters through the fresh `readerContentSource`, does not call legacy adapter-based export collection, and does not choose its own ChatGPT body source. ChatGPT source changes must also prove Reader / Save Messages / toolbar copy item counts stay aligned with the complete verified graph rounds through the shared fresh `ReaderItem[]` source, even when assistant DOM is not currently mounted. Keep at least one real `SaveMessagesDialog` trigger-path test plus service-level coverage for `ReaderItem[]` to `ChatTurn[]` conversion. If the source change touches formulas, also prove the Markdown branch applies `formula.markdownCopyFormulaFormat` only at clipboard or Markdown-file exits, while PDF/PNG rendering and Reader canonical content stay untouched.

For ChatGPT direct semantic-selection changes, focused verification must cover ordinary paragraph text plus every supported structured unit. The primary path must capture one same-message, non-streaming Range as typed target + content/materialization/surface tokens + TextQuote, resolve exactly one canonical Markdown span from either source-backed or sealed `host-rendered` content, preserve Markdown wrappers when a whole semantic node is selected, and share one canonical Markdown snapshot across the configured keyboard exits. Repeated quotes need context disambiguation; stale content/materialization tokens, remounted surface roots, changed Range endpoints, reconstructed source, decoded offsets without a proven source map, cross-message selection, streaming content, and unsupported input must fail open. The strict rendered-unit DOM converter remains a bounded compatibility path only for legacy composition roots without canonical content/materialization ports: its existing partial/full, nested-unit, KaTeX, ordered-list, noise-removal, parser-budget, and clone-cleanup tests stay required, but a production semantic rejection must never revive it or publish back into content source/persistence. Formula coverage must prove a sealed host-rendered turn can recover canonical formula Markdown through injected surface atoms and the real shortcut path, while visual glyph text is never promoted to authoritative TeX. The real shortcut path must cover document `selectionchange` → evidence/snapshot → configured `keydown`, `mod-c` finalization, `mod-shift-c` direct clipboard, host handlers before and after the extension phase, runtime settings delivery, repeated init/dispose, editable-target guards, and invalidation when tokens or Range change. `none` leaves host copy untouched; successful exits write only canonical `text/plain` and never load the Reader/export renderer graph. Run the Semantic Content focused gate above plus `tests/unit/core/latex/extractLatexSource.test.ts`, `tests/unit/drivers/math-click.test.ts`, `tests/unit/services/copy/atomicSelectionMarkdown.test.ts`, `tests/unit/ui/content/controllers/ChatGPTAtomicSelectionController.test.ts`, `tests/unit/ui/content/FormulaAssetHoverController.test.ts`, `tests/unit/runtimes/content/entry.test.ts`, and affected settings/performance governance tests, then the repository-wide gates required for a broad behavior change.

The legacy direct-selection compact-fragment compatibility gate applies only to composition roots without canonical content/materialization ports. It must prove that only Range-intersecting content is cloned, formatting ancestors are re-closed, ordered-list numbering is retained, and large KaTeX visual trees are replaced with authoritative TeX atoms before entering the shared DOM normalization, noise removal, rendered-whitespace normalization, parser, and cleaner path. Include a host-like copy-event case where visual formula text is written first and a formula larger than the former 5000-node ancestor budget still finishes as canonical Markdown-only `text/plain`. Parser aborts must escape local error boundaries and be rejected before cleaner output; inline and display formula delimiters must remain balanced across mixed selections. This gate does not describe the production ChatGPT path, which must use `SurfaceProjection` over sealed Repository content.

If the change affects ChatGPT snapshot bridge transport, focused coverage must prove Chrome/Chromium object request/response detail, Firefox JSON-string request/response detail, and JSON-string Graph capture on both browsers. It must also prove POST and SSE are not observed. Reader, Bookmark, Copy, and Save Messages tests should continue to exercise the shared snapshot source without adding browser-specific branches at those upper layers.

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

For a missed ChatGPT baseline capture, the selected gate must prove a stable DOM
batch can establish a host-ready pool and every obtained message remains
consumable. A late runtime may consume the Bridge's latest in-memory Graph or
wait for one real future capture while its gate remains open; only a reliable
overlap may add history before the first host turn. Runtime/PageIndex/popstate/
refresh signals may bind identity or flush observed local work, but cannot
initiate an active read. Under ADR-0020, `pageshow` and the Settings "Retry
discovery" action may re-arm one bounded peek only while the gate is open; a
gate that already accepted a Graph never reopens. Bridge capture additionally
accepts a payload-declared current conversation id on a same-origin JSON GET
whose URL did not carry it, while graph-shaped payloads declaring another
conversation are counted as rejected and never remembered. An unfinished
assistant is omitted until the matching stable DOM turn enters the pool.

# Current ChatGPT discovery gate (identity-proven single pool)

The active production contract is the single-pool lifecycle in ADR-0018:

- `ChatGPTConversationDiscoveryAdapter` and the page bridge admit at most one identity- and structure-verified passive Graph per conversation epoch with Chrome/Firefox transport parity and zero extension network requests or POST observation. Since ADR-0020 the bridge also accepts a payload-declared current conversation id when the same-origin GET URL did not carry it; declared-other-id payloads are counted as rejected and never remembered.
- The route contract reads a safe token after semantic `c` or `conversation` at any path depth. `/c/<id>`, `/conversation/<id>` and `/g/.../c/<id>` share the same rule; `/g/<id>`, `/share/<id>` and query-only identity are not canonical Conversation Documents. URL-stable pages instead use a Runtime page identity for local content.
- `ChatGPTConversationContentRuntime` owns page/canonical identity, History/navigation signal ordering and epoch fencing; the production content chain contains no Coordinator or polling RouteWatcher.
- `ChatGPTPageIndex` is the only Page Monitor; `ChatGPTConversationHostMonitor` carries split-hydration identity and generation facts, applies pool-tail order, quiet/completion, compiler-budget and surface-revision fences, and atomically admits a stable DOM batch without requiring the toolbar action row.
- Virtualized windows may expose an assistant root without its user root. PageIndex/Conversation Surface must retain that assistant-only surface by `assistantMessageId` for an already-cached turn; toolbar mounting and active-range geometry must recover without a Bridge replay, content append, content-token change, duplicate toolbar, or DOM-local history inference. When the user root remounts, the same semantic turn must rebind idempotently.
- `ConversationContentRepository` is the only production content session. Graph or DOM may establish the pool, including DOM under a page identity before canonical ID; promotion preserves projection/content tokens. A later Graph can only prepend a verified historical prefix. Existing bodies never change except the ADR-0019 weak-sealed upgrade — strictly stronger completion evidence for the same typed identity may replace a `bounded-quiet`-sealed body in place, equal evidence never rewrites — baseline failure never demotes host-ready content, and diagnostic basis is `source/hybrid/host`. Rejected or deferred candidates are retried through a bounded deferred re-sweep that never guesses order.
- `RenderedContentCompilerV2` is the production normalized host-body compiler, not a second repository. Slot/topology modules remain navigation/materialization evidence only.
- Reader, word count, formula, whole copy and export consume the Content Port; Directory, Toolbar and Stepper consume the atomic Conversation Surface. Directory geometry prefers the complete user/assistant group and accepts an assistant-only current range only when it joins an already-cached assistant. Precise local selection and annotation require independent source-span proof. Bookmark Preparation additionally requires canonical ID/URL and otherwise sends no persistence request.
- The real toolbar trigger must prove no-ID first-message mounting and numeric word count, disabled bookmark with zero request, promotion-time bookmark recovery, later-message identity updates, no duplicate toolbar after remount, and no ChatGPT-local observer/route lifecycle.
- URL-stable id-less discovery is in scope. Tests must cover page-session isolation, clear-plus-generation same-URL reset, virtualized preservation, local consumer availability, and exclusion from bookmark persistence/cross-page navigation.

The focused command is `npm run test:chatgpt-discovery`. It must be followed by
the repository test ladder, `npm run type-check`, `npm run perf:chatgpt`,
`npm run build`, and `git diff --check`. Installed Chrome MV3 and Firefox MV2
acceptance is recorded separately and is never inferred from Vitest/build
output. The runtime must remain free of cookies, storage-token/auth-header
reads, extension conversation GET/POST, generation response parsing, React
internals, permanent polling and synthetic discovery scroll.
