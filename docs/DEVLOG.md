# DEVLOG (Append-only)

Purpose: evidence log for major changes (commands run + observed results). Keep entries short and factual.

---

## 2026-08-10 — ChatGPT route identity and anonymous-page boundary audit

- Audited the executable route rule in `src/drivers/content/chatgpt/chatgptRoute.ts`.
  The current Conversation Document parser accepts `/c/<id>`,
  `/conversation/<id>`, and nested paths such as `/g/<scope>/c/<id>` on the
  exact ChatGPT page hosts when the captured ID is at least eight hexadecimal or
  hyphen characters. It does not accept `/g/<id>`, `/share/<id>`, query-only
  conversation IDs, `chat.com`, or a URL-stable anonymous page. `/c/WEB:*` is
  temporary birth evidence rather than a canonical document identity.
- Confirmed that current anonymous stable-URL discovery is not implemented:
  without a canonical route identity, the Content Repository remains
  unavailable. The SSOT now records page-session identity, same-URL reset,
  virtualized-window limits and persistent-navigation isolation as the required
  future design seams rather than silently claiming support.

Verification:
- `npm run test:chatgpt-discovery`: passed (27 files / 333 tests).
- The route matrix and anonymous stable-URL cases remain documentation/test
  scope for the next implementation; no runtime code was changed in this
  audit.

---

## 2026-08-10 — ChatGPT directory active geometry uses the full turn group

- Reproduced the installed-Chrome mismatch on `RIS尺寸扩展规律分析`: the
  viewport reference line was inside assistant message 23, while the right
  directory rail marked position 22. The materialized toolbar/action-row
  anchor for message 23 was thousands of pixels below the reading line; the
  complete user+assistant group still contained it.
- Added a regression through the production `ConversationMaterializationPortV1`
  composition. `ChatGPTDirectoryController` now uses `ChatGPTConversationIndex`
  full `groupEls` for active-position geometry and keeps the materialization
  `anchorElement` only as a fallback for missing full groups. Navigation and
  toolbar mounting continue to use the materialization anchor as before.
- Reloaded the current Chrome page with the built extension: the same viewport
  now reports active position 23 of 23, matching the visible assistant message
  identity. No conversation request was introduced.

Verification:
- Focused directory controller tests passed (50/50), including the new
  toolbar-anchor regression; `npm run test:chatgpt-discovery` passed (29 files /
  345 tests); `npm run test:core` passed (284 files / 1,978 tests).
- `npm run type-check`, dual-browser `npm run build`, passive ChatGPT boundary,
  entry-format checks, bundle budgets and `git diff --check` passed.

---

## 2026-08-10 — ChatGPT sealed host-rendered local Markdown selection

- Reproduced the real shortcut failure with a sealed `host-rendered` assistant
  turn: the selection controller resolved the typed target, but
  `SurfaceProjection` rejected every non-source-backed body before semantic
  projection, so ordinary text and formulas both reported that selected Markdown
  could not be copied.
- Kept DOM ownership narrow: Range, typed target, revision tokens, TextQuote and
  formula atoms remain surface evidence. The copied payload now comes only from
  the matching sealed Repository Markdown. Source-backed and compiler-verified
  `host-rendered` turns are eligible; reconstructed, stale, ambiguous,
  cross-message, streaming and unproven selections still fail open.
- Updated the performance fixture to exercise the actual configured shortcut and
  browser clipboard against matching rendered/Graph content. Verified-snapshot
  idle prewarm remains permitted only for extension-origin feature modules, and
  export-renderer loading still requires an image action.

Verification:
- The regression was observed failing before the production gate changed.
  Focused Surface Projection/controller/adapter coverage passed after the fix.
- Discovery passed 29 files / 344 tests; core passed 284 / 1,977; smoke passed
  7 / 54; acceptance passed 31 / 325; type-check, dual-browser build, passive
  boundary, bundle budgets and `git diff --check` passed.
- `npm run perf:chatgpt` passed with 200/200 toolbars, zero duplicates, zero idle
  mutations, 200 streaming mutations, two selection-state writes, zero selection
  long tasks and canonical formula Markdown on the clipboard.
- Installed Chrome current-build acceptance passed for ordinary text and a
  complete inline formula on an existing conversation. The original shortcut
  setting was restored after verification; no new conversation request was
  introduced. Installed Firefox MV2 remains pending.

---

## 2026-08-10 — ChatGPT first-turn host action-row rollback

- Reproduced the installed-Chrome failure from a blank ChatGPT page with a bounded local DOM sampler: the completed assistant action row and AI-MarkDone toolbar appeared together, then 118 ms later both disappeared; the host stop control returned and remained active for the 45-second observation window. The assistant node stayed mounted while only the user-turn copy action remained.
- Confirmed the consumer was mutating ChatGPT's React-owned action row from pending Materialization before the matching assistant existed in the authoritative Content snapshot. The first-turn real trigger test was changed first and failed on that premature toolbar host.
- Kept pending typed anchors available to Materialization/navigation, but gated toolbar DOM ownership on exact `readTurn()` availability plus a non-streaming assistant. The toolbar now mounts once after stable host content commit with numeric statistics; no observer, polling, Bridge replay or network request was added.

Verification:
- Focused lifecycle, official-anchor and Materialization tests passed (3 files / 26 tests); `npm run test:chatgpt-discovery` passed (29 / 341), `npm run test:core` passed (284 / 1,973), smoke passed (7 / 54), acceptance passed (31 / 322), and type-check passed.
- Chrome MV3 and Firefox MV2 builds, entry format, passive-discovery boundary, bundle budgets and `git diff --check` passed. The performance fixture now supplies one locally fulfilled website-owned Graph GET and reached 200/200 sealed-content toolbars before stopping at the pre-existing Atomic Selection assertion (`selected=1`, `cleared=0`, empty copy, two writes, zero long tasks); the performance gate remains red.
- Fixed-build installed-Chrome acceptance requires reloading the unpacked extension; browser automation policy does not allow controlling `chrome://extensions`.

---

## 2026-08-10 — ChatGPT baseline-and-host-tail lifecycle

- Reproduced both reported toolbar failures and replaced the split Graph-only / toolbar-observer lifecycle with one page-scoped Content Session: one passively observed Graph baseline per conversation epoch, followed only by stable typed DOM-tail commits through the shared PageIndex observer.
- Added DOM-proven `host-born` first-turn binding across `/` → `/c/WEB:*` → canonical identity; sealed host turns carry `host-rendered/normalized/rendered-content-v2` provenance. Baseline and host records are immutable per projection; host suffix regeneration creates a new projection and a baseline-prefix conflict becomes `stale`.
- Routed ChatGPT toolbar mounting through shared Materialization and exact `readTurn()` identity. The ChatGPT production toolbar no longer owns a MutationObserver, route watcher, scan scheduler or recovery timer; pending anchors mount immediately and content commit updates numeric statistics by assistant ID.
- Removed consumer-visible coordinator semantics from `ConversationContentSourceV1`. Consumer `refresh()` only awaits or returns already observed Session work; driver-local epoch entry and real Bridge-capture notification are the only baseline lifecycle inputs.
- Replaced the active SSOT with ADR-0017 semantics across architecture, runtime protocol, dependency rules, feature registry and test gates. ADR-0005/0007/0009–0016 are explicitly historical/superseded where their lifecycle semantics differ.

Verification:
- `npm run test:chatgpt-discovery`: passed (29 files / 341 tests).
- `npm run test:core`: passed (284 files / 1,973 tests).
- `npm run test:smoke`: passed (7 files / 54 tests).
- `npm run test:acceptance`: passed (31 files / 322 tests).
- `npm run type-check` and `npm run build`: passed. Chrome MV3 and Firefox MV2 entry-format, passive ChatGPT boundary and bundle-size checks passed.
- `npm run perf:chatgpt`: the corrected canonical typed fixture reached 200/200 toolbars, then stopped at the existing Atomic Selection assertion (`selected=1`, `cleared=0`, empty copied payload, two writes, zero long tasks). The performance gate remains red.
- Installed Chrome still ran the previous unpacked instance and reproduced one first-reply toolbar with `—` statistics. Automatic extension reload was blocked by Chrome internal-page policy, so current-build Chrome acceptance and installed Firefox MV2 acceptance remain pending and are not inferred from automated evidence.

---

## 2026-08-07 — ChatGPT consumer wiring audit and bookmark projection closure

- Audited the production path from passive Graph Adapter → `ConversationContentRepository` → `ConversationContentSourceV1` → `ChatGPTConversationIndex`/materialization/navigation and its Directory, Reader, word-count, copy, bookmark, formula, selection and export consumers.
- Closed the remaining ChatGPT bookmark-state bypass: Reader footer actions, message toolbars and Directory highlights now use the same read-only canonical bookmark resolver. If the source snapshot or persisted message-record projection is unavailable, ChatGPT fails closed instead of trusting a position-only cache.
- Kept bookmark persistence unchanged: no `Bookmark` field, storage key, old record, import/export shape, or save/remove protocol was modified.

Focused verification:
- `tests/unit/ui/bookmarks/bookmarksPanelController.test.ts` and `tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts`: passed (48 tests).
- `npm run test:chatgpt-discovery`: passed (28 files / 330 tests).
- `npm run test:core -- --pool=forks --maxWorkers=1`: passed (282 files / 1,956 tests); the default parallel run had one navigation timeout, and the same navigation file passed independently (16/16).
- `npm run test:smoke`: passed (7 files / 54 tests).
- `npm run test:acceptance`: passed (31 files / 315 tests).
- `npm run type-check`, `npm run build`, and `git diff --check`: passed. Chrome MV3 and Firefox MV2 build/boundary/bundle checks passed.
- `npm run perf:chatgpt`: remains blocked by the existing Atomic Selection benchmark assertion (`selected=1`, `cleared=0`, empty copy, two state writes, zero long tasks); this is recorded as a red performance gate, not a functional consumer pass.
- Installed Chrome MV3 and Firefox MV2 acceptance remains a distinct manual gate and is not claimed by these automated results.

---

## 2026-08-07 — ChatGPT directory restored to passive Graph main path

- Bound the ChatGPT directory to the existing passive graph adapter → `ConversationContentRepository` → `ChatGPTConversationIndex` path. Off-screen labels now come from graph user prompts; DOM supplies only current anchors/materialization.
- Restored the document-start page bridge as a transparent observer of website-owned conversation `GET` responses. Removed active conversation acquisition and made missed capture require a page refresh.
- Removed the remaining ChatGPT directory ratio/pixel seeker. User-initiated navigation now resolves a persistent host slot and waits for exact typed identity; it fails closed when that proof is unavailable.
- Added ADR-0015 and updated current architecture/test-gate notes. The V2 Slot Topology path remains compatibility/materialization code, not the directory content SSOT.

Verification:
- `npm run test:chatgpt-discovery`: passed (28 files / 331 tests).
- Focused directory/navigation tests: passed (14 tests); the obsolete pixel-probing tests were removed.
- `npm run type-check`: passed.
- `npm run build`: passed for Chrome MV3 and Firefox MV2, including entry-format, passive ChatGPT boundary, and bundle-size checks.
- Installed-browser acceptance is pending until the local extension is reloaded in Chrome; current live inspection still showed the previous extension instance, with no bridge or directory rail.

## 2026-08-07 — ChatGPT Source-Graph-only discovery and consumer convergence

- Removed ChatGPT DOM body/position candidates from the production acquisition path. Host observation remains an identity/lifecycle/materialization signal only; Reader target resolution no longer duplicates ChatGPT selectors.
- Changed bridge completeness so a continued branch with an internal empty assistant shell can publish later complete turns, while an incomplete final tail remains unavailable. Replaced timer-based bootstrap recovery with real route, pageshow, generation, host, and explicit-refresh signals.
- Added one-source bookmark preparation and canonical formula resolution. ChatGPT bookmark fields now come from one sealed turn read; formula click-copy fails closed unless the rendered formula matches LaTeX in that sealed Markdown.
- Removed the Reader selection `Range.toString()` Markdown fallback; unresolved semantic selection no longer produces misleading Markdown or formula text.

Verification so far:
- `npm run test:chatgpt-discovery`: 23 files / 318 tests passed.
- `npm run type-check`: passed.
- Focused bridge/coordinator/Reader/formula tests: passed (46 + 57 tests across the focused runs).
- `git diff --check`: passed before the final documentation edits.
- Full repository gates and installed Chrome MV3 / Firefox MV2 acceptance remain to be recorded after the final build.

## 2026-08-07 — Final source-boundary verification

- Removed the remaining DOM body read from `ChatGPTDomTurnFactSource`; its fallback now emits only typed IDs, anchors, and streaming/mounted lifecycle facts, and the ChatGPT content runtime no longer exposes that seam.
- `npm run test:chatgpt-discovery`: 23 files / 317 tests passed.
- `npm run test:core`: 274 files / 1,926 tests passed.
- `npm run test:smoke`: 7 files / 53 tests passed.
- `npm run test:acceptance`: 31 files / 321 tests passed.
- `npm run type-check`, `npm run build`, and `git diff --check` passed. Chrome MV3 and Firefox MV2 entry-format, ChatGPT-boundary, and bundle-size checks passed.
- `npm run perf:chatgpt` remains blocked by the pre-existing Atomic Selection fixture assertion (`selected=1`, `cleared=0`, empty copy, two state writes, zero long tasks); the fixture sends a bare copy event while the default production shortcut is `mod-shift-c`, and was not changed to touch the user's real clipboard.
- Installed Chrome MV3 / Firefox MV2 browser acceptance remains pending; no cookies, storage, tokens, authorization headers, POST/SSE generation payloads, or synthetic scrolling were used.

---

## 2026-08-06 — Evidence Ledger and Stable Turn Capture (branch)

- Replaced DOM-window candidate merging with a provider-neutral `ConversationEvidenceLedger` keyed by document epoch, branch, and typed turn identity. Source order/history and stable host observations are independent evidence; first validated content is sealed, duplicates are idempotent, and divergent evidence is an explicit conflict.
- Added `ConversationTurnReadPortV1`, proof-driven `{ order, bodies, tail, gaps }`, stable capture, and a generic rendered-content compiler with injected formula/code parser capabilities. A sealed message is readable while global discovery is still gapped; full export remains proof-gated.
- Kept page bodies in memory only, separated source/host/materialization/surface revisions, and removed strict-prefix merge assumptions from the active architecture. Virtualized unmounts now affect anchors only.

Verification:
- `npm run test:chatgpt-discovery`: 23 files / 315 tests passed.
- `npm run test:core`: 274 files / 1,923 tests passed.
- `npm run test:smoke`: 7 files / 53 tests passed.
- `npm run test:acceptance`: 31 files / 319 tests passed.
- `npm run type-check` passed.
- `npm run build` passed for Chrome MV3 and Firefox MV2, including entry-format, ChatGPT boundary, and bundle-size gates; the sandboxed run hit the known `tsx` local-IPC `EPERM`, and the approved rerun passed.
- `git diff --check` passed.
- `npm run perf:chatgpt` remains blocked at the pre-existing Atomic Selection assertion (`selected=1`, `cleared=0`, `copied=`) with zero long tasks. This is not reported as a green performance gate.
- Live Chrome inspection of the supplied conversations confirmed semantic `math` accessibility nodes and the currently installed legacy bundle's toolbar, but that installed bundle still gave no clipboard/result feedback for Markdown or formula clicks. The new branch build was not loaded into the installed browser; Firefox MV2 installed acceptance remains pending.

---

## 2026-08-06 — Semantic content and surface projection convergence (branch)

- Confirmed three independent failures behind the current ChatGPT regressions: non-empty typed-DOM Markdown could overwrite cleaner graph Markdown; current formulas carry TeX on an ancestor `data-math-source` wrapper while the main content composition root did not inject the ChatGPT parser Adapter into the formula controller; and direct page selection reconstructed Markdown from rendered DOM instead of joining the selection to canonical source. The supplied live conversation exposed 687 semantic formula wrappers; clicking a visible formula in the currently installed old bundle produced the extension warning `No LaTeX source found for clicked element`, directly reproducing the formula failure.
- Added provider-neutral `SemanticContentModuleV1` with an AI-MarkDone-owned immutable document, UTF-16 half-open source spans, explicit diagnostics, bounded complete-contract caching, and canonical Markdown/plain-text/Reader-structure projections. Parser ASTs, DOM, browser globals, platform IDs, clipboard, and renderer details stay behind the Interface.
- Added a driver-owned `ContentSurfaceAdapter` and one service-owned `SurfaceProjection` seam. Production selection copy now joins typed target, content/materialization revisions, re-captured surface evidence, and TextQuote to one source-backed Markdown span; stale, ambiguous, reconstructed, and unproven mappings fail open without reviving DOM reconstruction.
- Added per-turn provenance and snapshot source quality. Source-backed graph Markdown is normalized at the Source Adapter edge and cannot be overwritten by reconstructed DOM; Reader may display degraded content, while copy, bookmark, Copy PNG, and Save Messages reject reconstructed canonical exits.
- Routed Reader structure through the Semantic Content Module, restored current ChatGPT formula click/asset extraction through the injected parser Adapter, and kept HTML/KaTeX/highlight/sanitize rendering separate.

Verification:
- `npm run test:chatgpt-discovery`: 23 files / 304 tests passed.
- `npm run test:core`: 264 files / 1,836 tests passed.
- `npm run test:smoke`: 7 files / 51 tests passed.
- `npm run test:acceptance`: 31 files / 309 tests passed.
- `npm run type-check` passed.
- `npm run build` passed for Chrome and Firefox, including entry-format, ChatGPT boundary, and bundle-size gates; the first sandboxed run hit the known `tsx` local-IPC `EPERM` and the approved unsandboxed rerun passed.
- Installed Chrome MV3 and Firefox MV2 acceptance of the new bundle remains pending. Browser policy prevented opening `chrome://extensions` to reload the local build, so the live session is root-cause evidence for the installed old bundle, not a success claim for this branch.

## 2026-08-06 — ChatGPT missed-capture bootstrap recovery (branch)

- Reproduced the supplied ChatGPT conversation in Chrome: the page bridge already held five verified partial graph rounds with provider positions `2…6`, while the live content source remained `unavailable`; Directory therefore showed its placeholder and Reader opened as `0/0`. The decisive failure was that the bridge filtered an unfinished head but passed the remaining non-contiguous positions into a V1 contract that requires ordinals to start at one, so the repository rejected the candidate as invalid. A missed initial capture race could then leave the invalid state with no later signal.
- Added a coordinator-owned finite recovery window of `150ms`, `500ms`, and `1.5s` for retryable same-document `unavailable` state. It reuses the existing reconcile path, stops on ready/stale/document change or after three attempts, and does not add a permanent poller or a second observer.
- Normalized surviving bridge rounds to contiguous local ordinals before publication; typed node/message IDs remain the only identity. Added a regression fixture matching the real omitted-head graph shape.
- Added a regression test for the missed-capture lifecycle and documented the bounded window in ADR-0010, the architecture blueprint/current state, and the testing gates.

Verification:
- `npm run test:chatgpt-discovery`: 234 tests passed.
- `npm run test:core`: 1,806 tests passed.
- `npm run test:smoke`: 47 tests passed.
- `npm run test:acceptance`: 239 tests passed.
- `npm run type-check` (pass)
- `npm run build` (Chrome/Firefox build, boundary verification, and bundle-size gates passed; sandbox-only tsx IPC failure required the approved escalated rerun).
- `git diff --check` (pass)

---

## 2026-08-05 — ChatGPT delayed-content convergence (branch)

- Kept the single `ChatGPTPageIndex` observer and added assistant-scoped text/child-list mutation signals so delayed hydration and long streamed answers re-enter the existing coalesced reconcile path without locale-specific stop labels or a second observer.
- Made bridge graph coverage explicit: empty assistant tails are omitted and marked `partial`; an all-pending graph remains unavailable instead of publishing an empty complete snapshot.
- Made active acquisition event-driven: new document, typed assistant identity, and generation-complete may acquire; stable text updates merge passive/DOM evidence without a GET per mutation, while retryable failures use bounded signal-driven backoff.
- Added regression coverage for delayed refresh hydration, partial graph tails, generation-complete reacquisition, and assistant-scoped PageIndex text signals.

Verification:
- `npm run test:chatgpt-discovery`: 231 tests passed.
- `npm run test:core`: 1,803 tests passed.
- `npm run test:smoke`: 47 tests passed.
- `npm run test:acceptance`: 238 tests passed.
- `npm run type-check` (pass)
- `npm run build` (Chrome/Firefox build, boundary verification, and bundle-size gates passed).
- `git diff --check` (pass)

## 2026-08-05 — ChatGPT discovery convergence and cleanup

- Made partial snapshots monotonic in `ConversationContentRepository`: only prefix-preserving growth is accepted; virtualization shrink or divergent identity retains last-good as stale, while a complete graph replaces atomically.
- Enabled the bounded same-origin graph acquisition in the ChatGPT composition root. Passive graph remains first; missing or ambiguous evidence performs one three-second GET, retries once only for timeout/5xx with typed DOM evidence, and otherwise falls back to verified partial content without reading credentials or generation payloads.
- Bound resource completion to the generation request's start route and previous assistant identity. Blank-route completion can wait in bridge memory until the next existing reconcile sees the canonical route and new assistant; cross-route and old-assistant matches fail closed without polling or another observer.
- Removed the DOM-fact source's unused subscription lifecycle, the coordinator's duplicate refresh facade, the mutation-subscription wrapper, and the Repository-only synthetic harness. Expanded the focused discovery command to bridge, adapter, Repository, route, PageIndex, Index, materialization, Reader, Directory, export, entry, and lifecycle coverage.
- Verification: discovery 16 files / 226 tests, core 260 files / 1,798 tests, smoke 6 files / 47 tests, acceptance 24 files / 237 tests, type-check, Chrome/Firefox boundary checks, dual-browser build, and bundle budgets passed. `perf:chatgpt` remains open at the pre-existing Atomic Selection assertion with zero long tasks; installed Chrome/Firefox acceptance remains pending.

## 2026-08-04 — ChatGPT content port and directory closeout

- Removed the production Engine/Reducer discovery path; ChatGPT semantic consumers now use the V1 content repository, while `ChatGPTConversationIndex` remains the typed navigation projection.
- Mounted the Directory rail and preview in the same `document.body` page-level portal as the working lower-right controls, kept the host independent from semantic acquisition, and reattached it after body replacement.
- Made page-scoped discovery resumable after a platform runtime disable/re-enable so the repository and ConversationIndex DOM signals are not left permanently stopped.
- Kept historical ADR/DEVLOG references intact; updated active SSOT and current test gates to use Content Port V1 terminology.
- Verification: discovery 9 files / 62 tests, core 260 files / 1,772 tests, smoke 6 files / 47 tests, acceptance 24 files / 228 tests, discovery harness 20/20, UI visual 41/41, type-check and Chrome/Firefox build/boundary/bundle gates passed. `perf:chatgpt` remains open at the pre-existing atomic-selection assertion; installed-browser acceptance and same-origin probe remain open.

## 2026-05-20 — Reader Sticky temporary excerpts

- Added a Reader-local Sticky workspace for temporary Markdown excerpts in the `conversation-reader` profile.
- Kept the implementation inside `ReaderPanel` and `readerPanelTemplate`: selection actions now offer `Stick`, blocks reuse the sanitized Reader Markdown renderer, the footer owns the left-panel toggle, and the workspace is in-memory only.
- Switched Sticky block reordering from button-hosted native drag/drop to pointer-driven dragging, so holding the drag icon gives stable reorder behavior inside the Reader Shadow DOM.
- Expanded Sticky width resizing so the rail can grow up to 2/3 of the Reader body width while retaining the existing minimum usable width and narrow-screen drawer behavior.
- Preserved the current Reader data contracts: Sticky excerpts do not enter storage, bookmarks, export, sending, comments, or `bookmark-preview`; closing and reopening Reader keeps excerpts for the current page lifecycle, while page refresh/content runtime reinitialization clears them; narrow screens use a drawer instead of a three-column layout.
- Verification:
  - `npm run test -- tests/integration/reader/reader-panel.test.ts tests/integration/reader/reader-panel.comment.test.ts tests/integration/reader/reader-panel.sticky.test.ts tests/unit/ui/reader/readerPanel.navigation.test.ts tests/unit/ui/reader/readerPanel.presentation.test.ts tests/unit/ui/reader/readerPanel.footerActions.test.ts tests/unit/services/reader/atomicSelection.test.ts tests/unit/services/reader/atomicExport.test.ts tests/unit/services/renderer/renderMarkdown.test.ts tests/unit/governance/i18n-keys.test.ts` (pass; 88 tests)
  - `npm run test:smoke` (pass; 20 tests)
  - `npm run build` (pass; Chrome MV3 + Firefox MV2 + entry verification)
  - `npm run build:chrome` (pass; Chrome MV3 + entry verification)
  - `release/AI-MarkDone-v4.4.1-chrome.zip` regenerated from `dist-chrome/`; SHA-256 `24b6524eceab82388af465f38957879d72a156b991bc743cf4992113f8a1d245`

## 2026-05-20 — ChatGPT toolbar lifecycle reconcile

- Changed ChatGPT official action-row hydration from a routine full-rescan trigger into a local message lifecycle reconcile.
- Added targeted stale-state recovery for ChatGPT toolbar messages that reach `anchor_pending` or `stale`, so a transient `injectToolbar` failure or missed action-row hydration signal can recover without refreshing the page.
- Kept the existing MutationObserver and ScanScheduler; no full-page polling, no new observer, no adapter contract change, and no content fallback injection.
- Verification:
  - `npm run test -- tests/unit/ui/content/messageToolbarOrchestrator.official-anchor.test.ts` (pass; 11 tests)
  - `npm run test -- tests/unit/ui/content/messageToolbarOrchestrator.scheduler.test.ts` (pass; 2 tests)
  - `npm run test -- tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts tests/unit/ui/content/messageToolbarOrchestrator.copy-png.test.ts` (pass; 19 tests)
  - `npm run test:smoke` (pass; 20 tests)
  - `npm run build` (pass; Chrome MV3 + Firefox MV2 + entry verification)

## 2026-05-19 — Reader pager compact window

- Limited Reader footer pagination to at most 10 page dots for long conversations.
- Middle pages now render as `3 + ellipsis + 4 + ellipsis + 3`; start/end ranges merge overlapping windows instead of expanding to seven leading or trailing dots, keeping adjacent page access near the active page.
- Verification:
  - `npm run test -- tests/unit/ui/reader/readerPanel.navigation.test.ts` (pass; 18 tests)
  - `npm run test -- tests/unit/ui/reader/readerPanel.navigation.test.ts tests/unit/ui/reader/readerPanel.footerActions.test.ts tests/unit/ui/reader/readerPanel.presentation.test.ts` (pass; 40 tests)
  - `npm run test:smoke` (pass; 20 tests)
  - `npm run build` (pass; Chrome MV3 + Firefox MV2 + entry verification)

## 2026-05-19 — ChatGPT open Reader tail page sync

- Let an already-open ChatGPT Reader append newly generated conversation pages when the official page adds a new round after sending from inside Reader.
- Kept the source boundary narrow: DOM round refs only mark new round positions as Reader tail pending, while appended Reader pages still come from a refreshed `ChatGPTConversationEngine` snapshot after the matching assistant content is non-empty.
- Verification:
  - `npm run test -- tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts tests/unit/ui/content/messageToolbarOrchestrator.scheduler.test.ts tests/unit/ui/content/messageToolbarOrchestrator.official-anchor.test.ts tests/unit/ui/reader/readerPanel.navigation.test.ts` (pass; 39 tests)
  - `npm run test:smoke` (pass; 20 tests)
  - `npm run build` (pass; Chrome MV3 + Firefox MV2 + entry verification)

## 2026-05-19 — Feedback layer and formula renderer recovery

- Unified hover labels around the shared tooltip primitive and routed short operation results through a top-center toast layer.
- Kept tooltip and toast colors tied to the active theme token chain through `--aimd-tooltip-*` and `--aimd-toast-*`.
- Recovered formula SVG/PNG/MathML rendering for MathJax inputs that need the NewCM double-struck data, while keeping MathJax out of `content.js` and avoiding runtime dynamic font loading from the host page.
- Verification:
  - `npm run test -- tests/unit/runtimes/formula-renderer/entry.test.ts tests/unit/services/math/formulaAssetActions.test.ts tests/unit/services/math/formulaAssetRenderer.test.ts tests/unit/drivers/math-click.test.ts` (pass; 16 tests)
  - `npm run test -- tests/unit/ui/infra/tooltipDelegate.test.ts tests/unit/ui/infra/toast.test.ts tests/unit/ui/content/messageToolbar.tooltip.test.ts tests/unit/ui/components/ToolbarHoverActionPortal.test.ts tests/unit/ui/content/MessageToolbar.test.ts tests/unit/ui/bookmarks/bookmarksPanel.test.ts tests/integration/reader/reader-panel.test.ts` (pass; 78 tests)
  - `npm run test:smoke` (pass; 20 tests)
  - `npm run build` (pass; Chrome MV3 + Firefox MV2 + entry verification)
  - `rg "MathJax|@mathjax|MathJaxNewcmFont" dist-chrome/content.js dist-firefox/content.js` (no matches)

## 2026-05-15 — v4.4.1 release copy preparation

- Bumped package, lockfile, and source manifest versions to `4.4.1`.
- Updated release-facing changelog copy, README latest notes, release notes, and in-panel English/Chinese changelog entries for the user-approved v4.4.1 bullets.
- Kept Mermaid out of the release scope; Reader diagram fences remain normal code blocks per the current SSOT.
- Verification:
  - Release-copy parser/governance/i18n test subset (pass; 28 tests)
  - `npm run release:verify` (pass; smoke 19 tests, acceptance 72 tests, Chrome/Firefox/Safari WebExtension builds + entry verification)

## 2026-05-05 — v4.3.0 release preparation

- Bumped package and generated manifest versions to `4.3.0`.
- Updated release-facing changelog copy, README platform direction, release notes, platform capability SSOT, and in-panel Chinese/English changelog entries for the user-approved v4.3.0 bullets.
- Synced Settings release copy and platform SSOT with the Toolbar & Page Actions grouping and the v4.5.0 platform retirement notice: Gemini, Claude, and DeepSeek support will be retired, and ChatGPT will be the only supported platform.
- Removed the fixed Firefox MV2 `browser_specific_settings.gecko.id` after AMO rejected the v4.3.0 zip with a duplicate add-on ID; AMO can assign/bind the ID for MV2 while the manifest keeps Gecko minimum-version and data-collection metadata.
- Generated fresh Chrome, Firefox, Safari WebExtension, and Safari Xcode wrapper zip artifacts under `release/`, with `AI-MarkDone-v4.3.0-SHA256SUMS.txt`.
- Safari DMG remains blocked until a signed exported `AI-MarkDone.app` is provided via `SAFARI_APP_PATH`.
- Verification:
  - `npm run release:verify` (pass; smoke 15 tests, acceptance 64 tests, Chrome/Firefox/Safari WebExtension builds + entry verification)
  - `npm run package:safari:xcode` (pass; generated `safari-build/AI-MarkDone`)
  - Release zip manifest spot-check (pass; Chrome MV3 `4.3.0`, Firefox MV2 `4.3.0`, Safari WebExtension MV2 `4.3.0`)

## 2026-05-04 — ChatGPT message toolbar anchor hydration

- Made message-toolbar injection respond to official action-row hydration after the assistant message node already exists.
- Kept toolbar placement strict: official action row only, no content fallback, no polling, and no adapter selector changes.
- Verification:
  - `npm run test -- tests/unit/ui/content/messageToolbarOrchestrator.official-anchor.test.ts tests/unit/ui/content/messageToolbarOrchestrator.scheduler.test.ts` (pass; 8 tests)
  - `npm run test -- tests/unit/drivers/chatgpt-adapter-injection.test.ts tests/unit/ui/content/controllers/ChatGPTDirectoryController.test.ts` (pass; 23 tests)
  - `npm run build` (pass; Chrome MV3 + Firefox MV2 + entry verification)

## 2026-05-04 — Formula interaction settings

- Added a dedicated `formula` settings category for Markdown click-copy and the four formula PNG/SVG copy/save hover actions.
- Kept formula source extraction, MathJax rendering, PNG rasterization, clipboard, and download services unchanged; Settings only gates click interception and hover action visibility.
- Preserved legacy `behavior.enableClickToCopy` as a migration/compatibility input for `formula.clickCopyMarkdown`.
- Kept the shared toolbar hover portal inside viewport bounds for left/right edge inline formulas and flipped it below the anchor when there is not enough top space.
- Verification:
  - `npm run test -- tests/unit/services/settings/settingsService.test.ts tests/unit/core/settings/migrations.test.ts tests/unit/drivers/math-click.test.ts tests/unit/ui/content/FormulaAssetHoverController.test.ts tests/unit/ui/bookmarks/settingsTabView.test.ts tests/unit/runtimes/content/entry.test.ts` (pass; 49 tests)
  - `npm run test -- tests/unit/ui/components/ToolbarHoverActionPortal.test.ts tests/unit/ui/content/MessageToolbar.test.ts tests/unit/ui/content/FormulaAssetHoverController.test.ts` (pass; 18 tests)
  - `npm run type-check` (pass)
  - `npm run test:smoke` (pass; 15 tests)
  - `npm run build` (pass; Chrome MV3 + Firefox MV2 + entry verification)

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

## 2026-08-07 — ChatGPT consumer convergence on passive Graph source

- Re-established the production ChatGPT composition root as the passive Graph-backed V1 seam: the document-start bridge observes the website's own conversation GET, the source adapter validates the mapping/current-node graph, and `ConversationContentRepository` publishes one canonical source.
- Routed Directory, Reader, word count, whole-message copy, Bookmark Preparation, local selection, formula click and export through that same source instance. The materialization adapter remains anchor-only, so virtualized DOM changes cannot replace prompt, Markdown, identity or canonical position.
- Kept `ConversationDiscoveryModuleV2`, `ChatGPTVirtualConversationHostAdapter` and the V2 compiler isolated for focused tests/experiments; they are not injected into the production runtime. Updated ADR-0014 as superseded for production and recorded the active boundary in ADR-0015.
- Added a read-only canonical bookmark resolver for ChatGPT consumers: persisted assistant `messageId` is matched before position, legacy URL variants are compared without rewriting the stored URL, and identity/position conflicts fail closed instead of highlighting another turn. Bookmark types, storage keys, save/remove payloads, old records, and import/export remain unchanged.

Verification in this implementation pass:

- `npm run test:chatgpt-discovery`: 28 files / 337 tests passed.
- `npm run test:core`: 279 files / 1,947 tests passed.
- `npm run test:smoke`: 7 files / 53 tests passed.
- `npm run test:acceptance`: 31 files / 321 tests passed.
- `npm run type-check`: passed.
- `npm run build`: passed for Chrome MV3 and Firefox MV2, including entry-format, discovery-boundary, and bundle-size checks.
- `git diff --check`: passed.
- `npm run perf:chatgpt` was not claimed: the sandbox hit the `tsx` IPC boundary, and the escalation was correctly rejected because the benchmark performs clipboard permission/write/read side effects. No unsafe workaround was used.
- Installed Chrome MV3 / Firefox MV2 real-browser acceptance remains a separate manual gate and was not claimed from automation.

## 2026-08-10 — ChatGPT content discovery simplified to one append-only cache

- Replaced the remaining source/host lifecycle split with one
  `ConversationContentRepository` cache: a conversation epoch consumes one
  passive website-owned Graph baseline, then stable new DOM turns append to
  that cache through the single `ChatGPTPageIndex` / Host Monitor path.
- Removed consumer-visible `partial` and content-level `stale` semantics.
  Cached messages are available to Reader, Directory, toolbar word counts,
  copy, bookmarks and export; `source/hybrid/host-born` remains diagnostic
  provenance only. Duplicate assistant identities are idempotent, and a
  compiler rejection retains only that message's dirty work for retry.
- Corrected first-turn binding so a canonical existing conversation cannot be
  inferred from a pre-route DOM window, while `/` → temporary `WEB` → canonical
  birth facts remain supported. Removed the unused Ledger, V2 discovery,
  virtual-host, DOM-fact-source and stable-capture production modules and
  their dedicated tests.
- Rewrote the active architecture, runtime, dependency, feature and testing
  SSOT documents to describe the maintained cache rather than suffix
  replacement or consumer recovery states.

Verification:

- `npm run test:chatgpt-discovery`: 27 files / 333 tests passed.
- `npm run test:core`: 280 files / 1,957 tests passed.
- `npm run test:smoke`: 7 files / 54 tests passed.
- `npm run test:acceptance`: 30 files / 317 tests passed.
- `npm run type-check`, `npm run perf:chatgpt`, `npm run build` and
  `git diff --check` passed. Chrome MV3 and Firefox MV2 entry-format,
  passive-boundary and bundle-size checks passed.
- Installed-browser acceptance remains a separate manual gate; it was not
  inferred from these automated results.
