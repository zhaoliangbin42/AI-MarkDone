# ChatGPT Performance Gates

This document is the execution contract for the 2026 ChatGPT content-runtime performance program. It turns performance work into staged, reproducible gates while preserving toolbar reliability and user-facing behavior.

## Active architecture override — 2026-08-11

Current ChatGPT ownership follows ADR-0018. Historical phase records below are
evidence for their dated builds; their references to an independent toolbar
reconciler, source-only content, repeated refresh, or consumer-owned discovery
are not current architecture. The benchmark now uses a canonical conversation
route, complete typed user/assistant identities and one synthetic website-owned
same-origin GET carrying a structurally valid Graph. The production Page Bridge
observes that response passively; the extension never initiates it and never
observes POST. Toolbars mount only after the resulting canonical pool joins the
shared PageIndex → Conversation Surface lifecycle. Production may also
establish the same pool from one stable DOM batch when no Graph is available,
including an ID-less page. The former toolbar-owned ChatGPT scanner/recovery
timer, Discovery Coordinator, Conversation Index, and standalone
Materialization are deleted; benchmark recovery must therefore be caused by
one PageIndex surface fact and one Surface reconciliation.
The fixture must never weaken production content, route or identity validation
to preserve an old benchmark.

## Measurement protocol

- Build first with `npm run build`.
- Run `npm run perf:chatgpt` three times on the same machine without interacting with the benchmark browser window.
- Use the median of the three runs for timing, long-task, and heap comparisons.
- The fixture contains 200 user/assistant rounds, 200 frame-paced streaming text mutations, and replacement of every tenth official action row.
- The first assistant round also contains one direct-selection inline-formula atom. The benchmark dispatches the configured selection-event count against the same Range, verifies one selected block, a clean collapse and the configured canonical-copy contract, and records a dedicated selection phase.
- The benchmark uses the built Chrome extension in real Chromium. It does not access a live ChatGPT account or external network content; Playwright intercepts the fixture page's one website-owned conversation GET and returns the synthetic Graph locally.
- Because a verified snapshot normally permits idle Reader/export prewarm, the fixture enables the supported `saveData` policy. This keeps the explicit feature-trigger measurement meaningful without changing production lazy-loading behavior.
- Each phase reports a mutation breakdown by DOM mutation type and attribute name so self-authored extension writes can be distinguished from host streaming changes.
- Before reading `usedJsHeapBytes`, the benchmark explicitly requests a renderer garbage collection through the Chromium DevTools Protocol. This makes heap medians comparable instead of depending on incidental browser GC timing.
- Startup/steady-state metrics and heap are captured before any heavy feature is triggered. The benchmark records all `content-features.js` / `content-feature-chunks/*` network requests through CDP, then clicks the real lower-right Bookmarks button and measures until `#aimd-bookmarks-panel-host` mounts.
- Reliability invariants are absolute on every run; timing and heap budgets use the three-run median because browser scheduling has normal variance.

The benchmark must always satisfy all of these invariants:

- 200 of 200 message toolbars appear.
- every official action row contains exactly one AI-MarkDone toolbar.
- all replaced official action rows recover through PageIndex/Surface within 500 ms, without a toolbar-owned observer, route watcher, scan timer, or stale-recovery timer.
- no content feature module is requested before the explicit Bookmarks trigger in the synthetic benchmark, which has no verified ChatGPT snapshot; in a live ChatGPT page, Reader/export chunks may be prewarmed once during an eligible idle window after a snapshot exists. After any trigger, every feature URL remains on the extension origin rather than the host page origin.
- no phase may increase an already accepted bundle or runtime median captured under the same measurement protocol by more than 10% without an explicit documented reason.
- the direct-selection phase must produce no long task and no more than one `data-aimd-page-atomic-state` set plus one clear, regardless of repeated unchanged `selectionchange` events.
- `npm run test:core` and `npm run build` remain green at every phase boundary.

## Phase 0 baseline

Captured on 2026-07-11 on Apple Silicon (`darwin-arm64`) from the unoptimized 4.7.0 content runtime. Values below are the median of three runs.

| Metric | Baseline |
|:--|--:|
| `content.js` raw | 3,357,760 bytes |
| `content.js` gzip | 768,989 bytes |
| toolbar ready | 691.6 ms |
| cold long-task total | 492 ms |
| cold maximum long task | 219 ms |
| cold mutation records | 5,378 |
| idle mutation records / 2 s | 16 |
| streaming long-task total | 737 ms |
| streaming maximum long task | 194 ms |
| streaming mutation records | 1,032 |
| official-row recovery | 171 ms |
| Shadow Roots | 201 |
| shadow descendants | 9,603 |
| used JS heap | 13,689,482 bytes (legacy pre-GC sample; informational only) |

The initial repository baseline also requires `npm run test:core` to pass all 1,195 tests and `npm run build` to produce valid Chrome MV3 and Firefox MV2 entry files.

## Phase gates

| Phase | Change boundary | Required threshold before advancing |
|:--|:--|:--|
| 1 | Production minification and build hardening | `content.js` raw <= 1,900,000 bytes; gzip <= 500,000 bytes; entry-format checks green for Chrome and Firefox; runtime medians do not regress >10%. |
| 2 | Linear bookmark/path work, CSS-only official navigation hiding, lifecycle cleanup | idle mutation records <= 2 per 2 s; 3,000-bookmark focused perf test remains green; streaming and toolbar reliability do not regress >10%. |
| 3 | Shared ChatGPT page index | cold long-task total <= 400 ms; cold maximum <= 185 ms; one authoritative ordered message/turn snapshot per DOM revision; all content-discovery callers remain behaviorally aligned. |
| 4 | Event-driven toolbar reconciler | 200/200 toolbars; zero duplicates; official-row recovery <= 500 ms on every run; toolbar-ready median <= 750 ms; streaming long-task total <= 500 ms. |
| 5 | Shared page-awareness, formula scan, and cache invalidation | streaming long-task total <= 400 ms; streaming maximum <= 150 ms; streaming mutation records <= 650; no stale route or message cache after navigation. |
| 6 | Shared per-toolbar resources | shadow descendants <= 9,400; post-GC used JS heap <= 12,500,000 bytes; toolbar visual and action parity green. |
| 7 | Host/feature bundle separation | ChatGPT startup `content.js` raw <= 1,300,000 bytes and gzip <= 350,000 bytes; facade <= 150,000 / 50,000 bytes; complete shared feature graph <= 1,720,000 / 465,000 bytes; zero pre-trigger feature requests; real Bookmarks trigger <= 500 ms with no host-origin chunks; Chrome/Firefox/Safari build parity green. |
| 8 | Final soak and closeout | cold long-task total <= 325 ms; cold maximum <= 150 ms; streaming long-task total <= 375 ms; streaming maximum <= 140 ms; all reliability invariants pass for three runs plus manual long-thread/route/theme/settings regression. |

If a phase misses a threshold, work stays in that phase. The implementation may be revised or the threshold may be changed only with new evidence recorded in this document; a red gate must not be silently waived.

## Accepted phase results

### Phase 1 — 2026-07-11

- `content.js`: 1,847,654 raw bytes and 485,855 gzip bytes, down 45.0% and 36.8% from Phase 0.
- Three-run runtime medians: toolbar ready 619.2 ms; cold long-task total 541 ms; cold maximum 238 ms; streaming long-task total 754 ms; streaming maximum 193 ms; official-row recovery 160.9 ms; used JS heap 9,990,185 bytes. The heap value predates forced-GC sampling and is retained only as historical context.
- Cold long-task total remained within the allowed 10% variance (+9.96%); streaming total was +2.3%; toolbar reliability remained 200/200 with zero duplicates.
- Chrome, Firefox, and Safari builds passed classic-entry parsing, Chromium-compatible encoding, entry-format, and per-runtime bundle budgets.
- Build investigation found that UTF-8 minifier output could preserve the Unicode noncharacter `U+FFFF`, which Chromium rejects when loading a manifest content script. All production builds now use ASCII-safe escaped output, and the entry gate rejects UTF-8 decoding failures and Unicode noncharacters.

### Phase 2 — 2026-07-11

- Replaced repeated bookmark identity scans, folder-descendant checks, and background bulk-remove scope checks with indexed or normalized scope-matcher paths. Focused regression tests cover 1,500 selected bookmarks, 1,000 folder checkbox states, and 500 removal scopes; the existing 3,000-bookmark stress gate remains green.
- Official navigation hiding now installs one exact, fail-open CSS rule and performs no geometry reads, `hidden` writes, timers, or `MutationObserver` refresh work. The directory and its dedicated `hideOfficialNavigation` setting must both be enabled before the rule is installed.
- `ScanScheduler.dispose()` now cancels queued idle or timeout work and prevents disposed schedulers from executing deferred scans.
- The original heap sampling varied from roughly 9 MB to 16 MB across identical runs because it depended on incidental browser garbage collection. The benchmark now forces GC immediately before reading heap usage; three consecutive post-GC samples were 7,603,423, 7,606,159, and 7,607,211 bytes.
- Final three-run runtime medians: toolbar ready 625.5 ms; cold long-task total 482 ms; cold maximum 217 ms; idle mutation records 0 per 2 seconds; streaming long-task total 740 ms; streaming maximum 196 ms; official-row recovery 171.3 ms; post-GC used JS heap 7,606,159 bytes.
- Toolbar reliability remained 200/200 with zero duplicates on every run. `content.js` remained within its accepted budget at 1,846,951 raw bytes and 485,648 gzip bytes.
- The phase boundary passed all 1,201 core tests plus Chrome and Firefox production builds, entry-format checks, and bundle budgets.

### Phase 3 — 2026-07-11

- Added one adapter-owned `ChatGPTPageIndex` snapshot per relevant DOM revision. Toolbar, directory, message-stepper, send-position restore, and navigation callers now reuse the same ordered DOM round refs and mapped `ConversationTurnRef[]` instead of repeating full-page and per-turn selector scans.
- Host child, text, and identity-attribute changes invalidate the snapshot. AI-MarkDone toolbar insertion and `data-aimd-*` bookkeeping do not self-invalidate it; replacing the conversation root rebinds the index automatically. Disabling the content runtime disconnects and clears the adapter-owned index.
- A 200-round regression test proves that all subsequent unchanged callers add zero `querySelectorAll` calls after the first discovery. Existing adapter-fold, navigation, directory, stepper, toolbar, Reader, and entry behavior tests remain aligned.
- Stable `data-aimd-msg-position` values are now written only when they change. The benchmark mutation breakdown confirmed that this removed 800 redundant streaming attribute writes: streaming mutation records fell from 1,000 to the 200 host text updates themselves.
- Final three-run runtime medians: toolbar ready 469.3 ms; cold long-task total 134 ms; cold maximum 81 ms; idle mutation records 0 per 2 seconds; streaming long-task total 0 ms; streaming maximum 0 ms; streaming mutation records 200; official-row recovery 167.4 ms; post-GC used JS heap 7,696,433 bytes.
- Toolbar reliability remained 200/200 with zero duplicates on every run. The final cache-lifecycle build remained within its accepted budget at 1,848,873 raw bytes and 486,241 gzip bytes.
- The phase boundary passed all 1,209 core tests plus Chrome and Firefox production builds, entry-format checks, and bundle budgets.

### Phase 4 — 2026-07-11

- Kept the existing `dirtyMessages` / incremental snapshot / `anchor_pending -> stale -> injected` lifecycle as the single toolbar reconciler instead of introducing a parallel abstraction. Mutation classification now maps content changes to the owning message, ignores unrelated text, and reserves full scans for initialization, routes, message-structure changes, or unresolvable action-row changes.
- Removed the post-scan global pending-state pass. Each scheduled reconcile now updates only its full or incremental snapshot once and runs Reader-tail synchronization once.
- The ChatGPT adapter exposes the stable parent of the current `main` as the shared observer container. Directory and toolbar mutation paths now survive a direct conversation-root replacement without caller-specific parent promotion; real user-trigger-path tests verify the new directory round appears and the replacement root receives exactly one toolbar.
- Unexpected removal of an individual toolbar host now targets its existing record for reconstruction. Intentional removals are tracked separately so disabling or deleting a record cannot trigger a self-recovery loop. Existing delayed-anchor and bounded stale-injection recovery remain intact.
- Final three-run runtime medians: toolbar ready 488.4 ms; cold long-task total 135 ms; cold maximum 81 ms; idle mutation records 0 per 2 seconds; streaming long-task total 0 ms; streaming maximum 0 ms; streaming mutation records 200; official-row recovery 166.1 ms; post-GC used JS heap 7,599,347 bytes.
- Toolbar reliability remained 200/200 with zero duplicates on every run; every run recovered all 20 replaced official action rows well under 500 ms. `content.js` remained within budget at 1,849,255 raw bytes and 486,402 gzip bytes.
- The phase boundary passed all 1,213 core tests plus Chrome and Firefox production builds, entry-format checks, and bundle budgets.

### Phase 5 — 2026-07-11

- Consolidated the three content-runtime `RouteWatcher` consumers onto one shared poll timer and one `popstate` / `hashchange` listener pair. The hub remains alive until the final consumer stops and preserves the same transition for every active subscriber.
- Replaced one formula `MutationObserver` per enabled message with one document-level observer filtered to enabled containers. Formula discovery now uses one combined selector pass, repeated enable calls are idempotent, detached containers release listeners, and in-page message reparenting remains active.
- Unrelated settings updates no longer disable and rescan every formula container when the formula interaction gate is unchanged.
- Current-message Reader promises remain shared between Copy Markdown and Copy PNG, but mutations invalidate only the owning message. Message-set or ordering changes clear the full cache before a full reconcile, preventing stale content without discarding unrelated cached items.
- Final three-run runtime medians: toolbar ready 459.8 ms; cold long-task total 133 ms; cold maximum 81 ms; idle mutation records 0 per 2 seconds; streaming long-task total 0 ms; streaming maximum 0 ms; streaming mutation records 200; official-row recovery 165.0 ms; post-GC used JS heap 7,579,789 bytes.
- Toolbar reliability remained 200/200 with zero duplicates on every run; every run recovered all 20 replaced official action rows in no more than 165.5 ms. `content.js` remained within budget at 1,850,553 raw bytes and 486,924 gzip bytes.
- The phase boundary passed all 1,223 core tests plus Chrome and Firefox production builds, entry-format checks, and bundle budgets.

### Phase 6 — 2026-07-11

- Message toolbars no longer mount the Copy PNG task-progress subtree or its CSS during normal page load. The first real secondary task creates the panel on demand; progress updates, cancellation, completion feedback, tokens, and action behavior remain covered through the user-facing hover trigger.
- `TooltipDelegate` no longer allocates a `MutationObserver` when `upgradeTitles` is disabled. Message toolbars and hover portals already provide `data-tooltip` directly, so their previous per-shadow observers had no useful work.
- Shadow descendants fell from 9,603 to 7,603 for 200 messages, a reduction of 2,000 nodes (20.8%) without lazy-loading or removing any toolbar action.
- Final three-run runtime medians: toolbar ready 456.1 ms; cold long-task total 82 ms; cold maximum 82 ms; idle mutation records 0 per 2 seconds; streaming long-task total 0 ms; streaming maximum 0 ms; streaming mutation records 200; official-row recovery 154.6 ms; post-GC used JS heap 7,495,205 bytes.
- Toolbar reliability remained 200/200 with zero duplicates on every run. `content.js` remained within budget at 1,850,809 raw bytes and 486,982 gzip bytes.
- The phase boundary passed all 1,225 core tests plus Chrome and Firefox production builds, entry-format checks, and bundle budgets.

### Phase 7 — 2026-07-11

- Replaced static startup imports of `ReaderPanel`, `BookmarksPanel`, Save/Bookmark dialogs, and Copy PNG with typed lazy ports. `content.js` now imports one fixed extension URL through `browser.runtime.getURL()` only after a real user action; the ES module facade then loads each heavy feature independently.
- Built `reader.js` and `content-features.js` in one Rollup graph so the detached Reader and content features share renderer code. The functional Chrome/Firefox feature graph is 1,609,873 raw bytes and 434,059 summed gzip bytes; Safari is 1,602,581 / 432,243 bytes. The facade itself is only 3,481 raw bytes / 1,349 gzip bytes.
- The initial 1,350,000 / 375,000 graph proposal was based on an invalid build whose entry exports had been tree-shaken. The real trigger gate caught `createBookmarksPanel is not a function`; the build now preserves entry signatures and executes the emitted facade to verify all five callable exports. The corrected 1,650,000 / 450,000 budget leaves only 2.4% raw and 3.7% gzip headroom over the functional graph.
- Feature-specific imports initially exposed another invalid path: Vite preload links resolved against `https://chatgpt.com`. All three module builds now use a relative base, which resolves preload dependencies against `import.meta.url`; the benchmark rejects any future HTTP(S) feature request. A Bookmarks trigger loads nine unique extension-origin module URLs and no host-origin URLs.
- `content.js` is 612,061 raw bytes and 158,968 gzip bytes, down 66.9% and 67.4% from Phase 6. Three-run medians: toolbar ready 430.5 ms; cold long-task total 51 ms; cold maximum 51 ms; idle mutations 0; streaming long-task total / maximum 0 ms; streaming mutations 200; official-row recovery 165.7 ms; post-GC heap 4,413,608 bytes; first Bookmarks mount 90.6 ms.
- Toolbar reliability remained 200/200 with zero duplicates on all three runs; no feature module loaded before the explicit trigger. Post-GC startup heap fell 41.1% from Phase 6 while shadow descendants remained 7,603.
- The phase boundary passed all 1,234 core tests and the complete Chrome, Firefox, and Safari WebExtension builds, including classic/module parsing, facade export execution, manifest resource consistency, extension-origin trigger checks, and per-entry plus aggregate bundle budgets.

### Phase 8 — 2026-07-11

- Final three-run soak on the accepted Phase 7 build retained the 200/200 toolbar and zero-duplicate invariants. Medians were 51 ms cold long-task total, 51 ms cold maximum, 0 ms streaming long-task total / maximum, 200 streaming host mutations, and 165.7 ms official-row recovery; all final thresholds remained green.
- A headed Chromium session loaded the production Chrome extension against a 200-round synthetic ChatGPT page. An in-page route transition from `/c/aimd-soak-a` to `/c/aimd-soak-b` retained 200 toolbars and zero invalid action rows.
- The real Settings → Buttons & Entrypoints control disabled the message toolbar to 0 hosts and restored it to exactly 200 with zero duplicates. This exercised storage/protocol propagation and the full runtime disable/re-enable lifecycle rather than calling the orchestrator directly.
- Switching the host document from light to dark and back propagated `data-aimd-theme` to the page, all sampled message toolbars, and the lower-right stepper while retaining 200/200 reliability. Bookmarks opened, closed, and reopened through the real lower-right trigger after the route change; Reader also mounted through a real per-message trigger. The browser console reported zero errors and warnings.
- Final automated closeout passed 1,234/1,234 core tests, 36/36 smoke tests, 120/120 acceptance tests, TypeScript checking, and complete Chrome/Firefox/Safari WebExtension builds with every entry-format, facade-export, resource, and bundle-size gate green.
- The automated browser fixture deliberately avoids a live ChatGPT account and network content. Safari parity here means source/manifest/build/module verification; signed Safari wrapper and real Safari hardware remain release-stage checks under the existing Safari runbook, not performance-program blockers.

### Multi-segment ownership correction — 2026-07-12

- Live diagnosis found that multiple assistant segments in one ChatGPT logical turn shared one official action row but created competing toolbar records, repeatedly replacing the host and invalidating hover anchors. Full and incremental reconciliation now canonicalize every segment to the turn's `primaryMessageEl`.
- The production benchmark now includes a three-segment reply and samples exact toolbar host identity for one second. The final 200-round run retained 200/200 toolbars, zero invalid action rows, zero idle mutations, zero streaming long tasks, 391.6 ms toolbar readiness, and 154.1 ms recovery.
- ChatGPT full reconciliation now consumes the logical-turn snapshot directly instead of running a second message discovery pass. Formula discovery keeps one candidate-selector source, lazy surfaces share one retryable instance loader, and the unused dynamic-module contract plus production no-op feature implementations were removed.
- The correction passed all 1,240 core tests plus Chrome and Firefox production builds and bundle budgets. `content.js` is 610,319 raw bytes / 158,686 gzip bytes; the current worktree production-source change is a net deletion of 130 lines.

### Stable observer-root correction — 2026-07-13

- Moved ChatGPT's stable `main`-parent observer contract into the adapter and removed the toolbar caller's duplicate parent promotion. Directory and lower-right stepper now subscribe to the existing page index's single structural-change source; their two controller-owned `MutationObserver`s and duplicated turn selectors were deleted. A completed initial directory refresh followed by full `main` replacement grows from two to three rounds through the real mutation path.
- Navigation subscribers are notified only for round add/remove or root replacement. Streamed content still invalidates the shared snapshot but does not refresh navigation UI, and one failing subscriber cannot block the other.
- Three final 200-round runs retained 200/200 toolbars and zero duplicates. Medians were 249.3 ms toolbar readiness, 152.9 ms replacement recovery, 53 ms cold long-task total/maximum, zero idle mutations, zero streaming long tasks, and exactly 200 streaming host mutations.
- The correction passed all 1,245 core tests plus Chrome and Firefox production builds, entry-format checks, and bundle budgets. `content.js` is 609,087 raw bytes / 158,413 gzip bytes; the current worktree production-source change is a net deletion of 165 lines.

### Direct page atomic selection — 2026-07-14

- Added a selection-exit-only ChatGPT path that recognizes fully covered rendered atoms within one completed assistant message. It uses one document `selectionchange` listener, one final window bubbling `copy` listener, animation-frame coalescing, and no page observer, overlay, selection rewrite, or idle scan.
- Three final 200-event runs selected and then cleared exactly one inline-code atom. Every run produced exactly two `data-aimd-page-atomic-state` writes, zero selection-phase long tasks, and no residual selected state. Median selection-phase duration was 192.4 ms including four animation frames and the fixed 50 ms observation tail.
- Existing runtime invariants stayed green on every run: 200/200 toolbars, zero duplicates, zero idle mutations, exactly 200 streaming host mutations, and zero streaming long tasks. Median toolbar readiness was 289.4 ms and median replacement recovery was 163.4 ms.
- `content.js` is 712,681 raw bytes / 190,556 gzip bytes and remains inside the Phase 7 startup budget. The complete Chrome and Firefox builds, entry-format checks, and bundle-size gates passed.
- The boundary passed 1,395/1,395 core tests, 36/36 smoke tests, and 122/122 acceptance tests. Unit and real-trigger-path coverage includes full versus partial atoms, mixed text, nested atoms, host-preempted clipboard ownership, reversible versus visual-only formula source, cross-message and streaming fallback, budget fallback, state cleanup, and runtime disposal.

### Formula clipboard ownership correction — 2026-07-15

- Live ChatGPT diagnosis proved that the extension generated and wrote reversible TeX successfully, but the host's document-level React formula copy handler rewrote visual glyph text later in the same event. The strict clipboard exit moved from document bubbling to the final window bubbling target; selection recognition, cleanup, budgets, listener count, and fail-open behavior did not change.
- The real-order regression enters through a selected KaTeX formula, lets a later host document handler overwrite the clipboard, and proves the window exit restores canonical Markdown without stopping propagation. A complete inline-code atom remains unchanged and still copies its Markdown source.
- Three final 200-event runs retained exactly two `data-aimd-page-atomic-state` writes, zero selection long tasks, zero idle mutations, 200/200 toolbars, and zero duplicates. Median selection duration was 171.2 ms, toolbar readiness 250.3 ms, and replacement recovery 152.4 ms.
- The current worktree build passed 1,412/1,412 core tests, 36/36 smoke tests, 122/122 acceptance tests, TypeScript checking, Chrome/Firefox production builds, entry-format checks, and bundle gates. `content.js` is 734,353 raw bytes / 194,704 gzip bytes.

### Atomic selection inverse-action simplification — 2026-07-29

- Removed the direct-selection formatted/Word renderer, rich clipboard writer, formula-format setting, and lazy facade export. A valid canonical snapshot now mounts one short-lived shared action: native copy when the shortcut owns Markdown, or Markdown copy when the shortcut remains native.
- Three consecutive 200-round runs retained 200/200 toolbars, zero duplicate action rows, zero idle mutations, exactly 200 streaming host mutations, and zero selection/idle/streaming/recovery long tasks on every run. Median selection duration was 100.2 ms with exactly two atomic-state writes and 11 total selection-phase mutation records, including the portal mount/position/close lifecycle.
- Runtime medians were 270.3 ms toolbar readiness, 172.3 ms replacement recovery, 118.8 ms first Bookmarks feature load, 4,984,924-byte post-GC heap, 1,793.0 ms cold duration, and 58 ms cold long-task total/maximum. No content feature loaded before the explicit Bookmarks trigger and no export renderer request occurred.
- The production build passed Chrome MV3 and Firefox MV2 entry, passive-content boundary, and bundle gates. `content.js` is 753,491 raw / 197,948 gzip bytes; the shared content-feature graph is 1,703,470 / 453,470 bytes and remains below its 1,720,000 / 465,000 limit. Verification also passed 1,769 core tests, 47 smoke tests, 233 acceptance tests, the 1,769-test UI runner, and the 9-case visual smoke matrix.

### ChatGPT content-consumer control convergence — 2026-07-30

- Three consecutive 200-round runs retained 200/200 toolbars, zero duplicate action rows, zero idle mutations, exactly 200 streaming host mutations, zero selection/idle/streaming/recovery long tasks, and zero export-renderer requests on every run.
- Current medians are 342.8 ms toolbar readiness, 153.7 ms replacement recovery, 103.0 ms first feature load, 5,745,575-byte post-GC heap, 1,867.0 ms cold duration, 138 ms cold long-task total/maximum, and 103.2 ms selection duration. The converged build's `content.js` is 746,851 raw / 196,557 gzip bytes.
- Against the accepted 2026-07-29 median, recovery, feature load, selection, cold duration, and bundle size remain within or improve the 10% boundary, but toolbar readiness (+26.8%), post-GC heap (+15.3%), and cold long-task total (+137.9%) do not. The synthetic benchmark never publishes a canonical conversation snapshot or opens Reader, Save Messages, Copy, PNG, or bookmark flows, so the new Reader projection/binding and transaction-invalidating paths remain dormant; no additional content observer or network request was introduced. This does not establish the source of the regression, so the historical 10% median gate remains open rather than being waived.
- Product verification passed 1,748/1,748 core tests, 47/47 smoke tests, 204/204 acceptance tests, TypeScript checking, Chrome MV3 and Firefox MV2 builds, passive-content boundary checks, and bundle budgets. Current-build installed acceptance remains manual because browser automation cannot reload the unpacked extension through `chrome://extensions`; the protected open ChatGPT page was not refreshed.

### UI system closeout — 2026-07-15

Confirmed structural facts:

- Content and detached Reader runtimes normalize theme plus global overrides into an immutable `AppearanceSnapshot`; unchanged fingerprints do not rebroadcast appearance. `AppearanceScope` owns page, ShadowRoot, and documented light-DOM portal token application, with shared constructed stylesheets and a style-tag fallback.
- `SurfaceRuntime` provides named panel/modal/anchored/inline profiles and one session contract for focus, dismissal, positioning, motion, reduced motion, close completion, and teardown. Heavy Reader, Bookmarks, save/export, Copy PNG, and formula-asset capabilities remain behind the existing extension-origin lazy feature boundary.
- The test-only Surface manifest records production owner/entry, profile, scope, responsive contract, Chrome/Firefox targets, real trigger tests, and direct or family real-component fixture evidence. The Playwright/Vite visual harness discovers direct fixtures from that manifest and writes evidence outside Git.
- Prompt, Reader, and Bookmarks have explicit workflow/rendering/geometry or host-responsibility seams. Production-dead Send modal, generic Tabs, Markdown compatibility shims, empty Bookmarks overlay subclass, and redrawn Panel Studio fixture are absent.

Closeout evidence from the current worktree:

| Evidence | Command / scope | Result |
|:--|:--|:--|
| Focused UI architecture and governance | Appearance, Surface Runtime, token/style, Surface coverage, visual-harness, legacy/Reader closure suites | Passed: 21 files and 108 tests, including documentation, token, coverage, harness, and legacy/Reader closure. |
| Product test gates | `npm run test:core`, `npm run test:smoke`, `npm run test:acceptance` | Passed: 1,560 core, 45 smoke, and 188 acceptance tests. |
| Full real-component visual matrix | `npm run test:ui:visual -- --full` | Passed: 451/451 cases and 0 failures; `output/ui-visual/full-2026-07-15T13-16-03-888Z`. |
| Dual-browser build and bundle | `npm run build` | Passed Chrome MV3 and Firefox MV2. `content.js` is 723,421 raw / 190,520 gzip bytes; the complete content feature graph is 1,571,400 / 425,360 bytes. |
| ChatGPT runtime median | three consecutive `npm run perf:chatgpt` runs under the measurement protocol above | Passed: 239.8 ms toolbar readiness, 152.1 ms recovery, 77 ms feature load, 4,986,554-byte heap, 1,752.7 ms cold duration, and 61 ms cold long-task total/max. Every run retained 200/200 toolbars, 0 duplicates, 0 idle mutations, and 0 streaming long tasks. |
| Installed-extension UI matrix | Chrome MV3 and Firefox MV2 using `E2E_REGRESSION_GUIDE.md` | Partial, not passed. Existing installed Chrome smoke covered the real Input Enhancement/guide triggers, unique host, ARIA, clean close, draft preservation, and extension console errors. The exact current-build reload, extension-page inspection, and Firefox MV2 manual matrix were unavailable or deliberately skipped to protect the open user tab. |
| Repository hygiene | `git diff --check` | Passed after the final SSOT update; temporary-index clean-checkout audit used a separate index and did not stage the working tree. |

The automated counts, bundle sizes, and performance medians above were produced from this closeout worktree. The manual row stays explicitly partial rather than inferring Firefox or current-build installed behavior from automated evidence.

### ChatGPT content-discovery convergence — 2026-08-05

- Functional closeout passed the 16-file / 226-test discovery gate, 1,798 core tests, 47 smoke tests, 237 acceptance tests, TypeScript checking, Chrome MV3 and Firefox MV2 builds, entry/boundary checks, and bundle budgets. Both `content.js` bundles are 759.94 kB raw / 199.81 kB gzip; both content-feature graphs are 1,695.71 kB raw / 451.12 kB gzip.
- `npm run perf:chatgpt` still stops at the pre-existing Atomic Selection assertion (`selected=1`, `cleared=0`, empty copied payload, two writes, zero long tasks). This run does not establish a new content-discovery performance regression, but the performance gate remains open until that assertion and the installed-browser matrix pass.

### Snapshot-first consumer path — 2026-08-07

- Ordinary ChatGPT Reader, Save Messages, Bookmark Preparation, word count and copy paths now read the last published V1 snapshot. They no longer wait for a bridge peek or call `ConversationContentSourceV1.refresh()` on every click.
- `readerContentSource` caches immutable base `ReaderItem[]` projections by snapshot identity and normalized page URL. Consumer calls receive shallow mutable views; the cache never stores DOM or detached nodes. ChatGPT Markdown is normalized at the discovery adapter boundary only.
- Complete source, hybrid and host snapshots remain consumable. A conflicting late Graph is ignored and cannot demote or pause a host-ready pool; an empty snapshot remains unavailable. Explicit Reader Refresh only awaits or returns Session work already observed and cannot start baseline admission.
- Reader/export chunks have a bounded, single-flight idle prewarm after a verified ChatGPT snapshot exists and the page is visible. `saveData` skips prewarm, teardown cancels it, and all module URLs remain extension-origin. The synthetic benchmark has a passive Graph snapshot; its current prewarm and explicit-trigger assertions are recorded in the latest section below.

### Identity-proven single-pool lifecycle — 2026-08-10

- The 200-round fixture now uses a valid canonical conversation ID, typed user,
  assistant and turn identities, and one page-owned conversation GET whose
  synthetic Graph is passively captured by the production bridge. This is
  required by the same Content + PageIndex + Materialization contract as
  production; pending toolbar injection and the retired independent observer
  are not benchmark fallbacks.
- The fixture now keeps its rendered formula and passive Graph Markdown
  semantically consistent, grants the test origin clipboard permission, and
  enters Atomic Selection through the configured trusted keyboard shortcut plus
  the browser clipboard instead of dispatching a bare `copy` event.
- The current run passed with 200/200 sealed-content toolbars, zero duplicate
  action rows, zero idle mutations, 200 streaming mutations, exactly two
  `data-aimd-page-atomic-state` writes, zero selection long tasks and canonical
  `$\\frac{x}{y}$` clipboard output. The sole conversation request was initiated
  by the synthetic website page and fulfilled locally; extension-initiated
  conversation requests remained zero.
- Verified-snapshot idle prewarm is allowed, but every feature URL must remain
  extension-origin and no export renderer may load before an image action. Both
  assertions passed. The built content bundle measured 825,215 raw bytes and
  217,119 gzip bytes, and `npm run perf:chatgpt` is green for this worktree.

### Consumer-path rendering and selection governance — 2026-08-15

This gate freezes discovery and measures the work added above the existing
Bridge → PageIndex → HostMonitor → Repository → ConversationSurface chain. The
fixture is intentionally rendered rather than plain text: each run contains
headings, emphasis, lists, tables, fenced code, a fixed-size image, SVG, and a
deep KaTeX inline formula in the same assistant message. Page Annotation is
enabled by default in the enabled run; an extension-off Chromium control uses
the same fixture and the same browser pacing.

- Each action path changes a real Range endpoint once per animation frame,
  waits for that frame, then completes with real `pointerup`. Page Copy,
  keyboard Copy, and Comment are measured as explicit actions. Because the
  selection toolbar is transient and Copy may consume it, the benchmark may
  perform a fresh real selection before Comment; it must not dispatch many
  unchanged selection events in one task or use a synthetic bare `copy` event.
- Every drag frame may perform at most one `locateSelection()` and must perform
  zero `materializeSelection()`, `Range.toString()`, formula `querySelectorAll('*')`
  scans, canonical Markdown projection, or `SemanticContent.compile()`. Explicit
  Copy/Comment may perform at most one evidence capture and one projection per
  selection revision; a second action on that revision reuses the resolver cache.
- Three runs use the median. Enabled minus control selection-frame p95 must be
  ≤4 ms, and no individual selection frame may add >8 ms. No run may produce a
  ≥50 ms long task during drag/selection. Heap, bundle, and accepted runtime
  medians remain within the existing 10% boundary.
- The run must preserve the fail-open contract for collapsed, cross-message,
  streaming/pending, stale-token and disconnected-root selections. Native
  `mod-c`, `mod-shift-c`, `none`, and `text/plain` clipboard behavior remain
  unchanged. Discovery snapshots, projection/content tokens, historyStatus,
  identities/order, host compile counts, repository ingestion, and Bridge
  requests are compared before and after the complete drag→pointerup→action
  sequence and must be unchanged.
- Reader selection frames may update only transient visual state; persistent
  anchor resolver calls stay at zero during drag and marker node identity stays
  stable. Toolbar reconcile is O(N) with zero second stats/bookmark pass for an
  unchanged frame. Directory/Stepper share one geometry pass per frame, and
  formula/composer lifecycle tests prove zero formula observer/per-node listener
  and zero duplicate composer observer.

The executable contract is `scripts/benchmark-chatgpt-runtime.ts` and its
governance test. A failed consumer gate keeps page annotations enabled only in
the development build; it must not be released as a default-on production
change until the gate is green on rebuilt Chrome and Firefox artifacts.

Observed on the rebuilt Chrome artifact on 2026-08-15: three runs retained
200/200 toolbars and zero duplicates; selection-frame p95 delta was 0.5 ms,
maximum delta 0.5 ms, with no selection long task. Drag/pointerup emitted four
lightweight locate passes (three drag frames plus the final pointerup), zero
materialization/projection/evidence work, and the explicit actions emitted one
materialization, one projection, one formula evidence pass, and three range
stringifications. The steady post-GC heap median was 9.20 MB and the content
bundle was 913.79 kB raw / 237.88 kB gzip. Those heap/bundle values are recorded
for this worktree but are not declared comparable to the older 2026-07-30
10%-gate baseline because the current dirty tree includes the newly default-on
Page Annotation feature; the historical 10% gate therefore remains open for a
separate baseline refresh rather than being silently waived.

### Consumer derivation locality follow-up — 2026-08-18

The follow-up keeps the same discovery freeze. It adds no Content Port,
PageIndex, Host Monitor, Repository, Bridge, or DOM admission work. The
consumer-only changes are:

- page selection caches visual atomic candidates by Range common ancestor, so a
  plain paragraph does not query every formula/code/table/image descendant;
- the shared composer binding observer ignores mutations outside the current
  composer scope while still waking for input replacement and hydration-shell
  removal;
- delegated formula handling checks enabled-container ownership before asking a
  parser Adapter to classify the global event path;
- Reader content rendering no longer performs a second persistent annotation
  anchor pass, page annotation roots are cached per mounted message, and stable
  ChatGPT toolbar bookmark/word-count derivations are skipped until their
  canonical turn, pending state, bookmark context, or word-count setting
  changes.

Focused regression coverage and `npm run test:core` remain green. On the same
complex rendered Chromium fixture, the three-run median retained 200/200
toolbars, zero duplicate action rows, four lightweight locate passes, zero
drag/pointerup materialization/projection/evidence work, and a 0.5 ms selection
p95 delta versus control. The post-GC heap was 9.26 MB and the content bundle
was 918.14 kB raw / 239.14 kB gzip. Cold fixture long tasks were 165 ms total
and 93 ms maximum in this run; neither occurred during selection. Installed
live ChatGPT and Firefox acceptance remain separate release gates.

### Consumer simplification replay — 2026-08-20

After the page-annotation consumer simplification, the rebuilt Chrome artifact
passed the same 200-round × 3-run benchmark. It retained 200/200 toolbars with
zero duplicate action rows. The real drag path emitted four lightweight locate
passes, one explicit materialization, one Markdown projection, one formula
evidence scan, and three action-time range stringifications; no drag frame ran
full-tree formula queries. Selection p95 delta versus the extension-off control
was 0.6 ms, maximum delta 0.6 ms, and selection produced no long task. The
steady heap reading was 9.26 MB; cold fixture work had 171 ms of long tasks in
total with a 94 ms maximum, while idle, streaming, recovery, and selection had
no long tasks. The built content bundle measured 921.13 kB raw / 239.83 kB
gzip. This is replay evidence for the current dirty worktree, not a replacement
for the separately required installed Chrome and Firefox acceptance checks.

## Scope protections

- Do not use viewport-lazy toolbars; users must retain immediate actions on every hydrated official action row.
- Do not reintroduce conversation DOM virtualization as part of this program.
- Toolbar placement remains anchored to ChatGPT's official `copy-turn-action-button` row. There is no content-body fallback.
- Official navigation hiding must fail open when the exact official selector no longer matches.
- Direct atomic selection must remain one document selection listener plus one
  window keyboard/copy owner, with no MutationObserver, per-message listener,
  selection rewrite, selection-action portal or idle DOM writes. It must not
  create a second observer/controller or load the content-feature renderer graph.
  Unsupported and over-budget selections must fail open to native copy.
- Bundle splitting may use only the documented `browser.runtime.getURL()` feature facade exception in classic `content.js`; all emitted ES modules must pass module parsing, callable-export, manifest-resource, extension-origin, and bundle-budget gates.
