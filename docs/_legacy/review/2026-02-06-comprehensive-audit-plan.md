# AI-MarkDone Comprehensive Audit Plan (2026-02-06)

## 0. Scope and Method

This audit follows a layered checklist across 12 quality dimensions:
1) product focus
2) least privilege
3) privacy/data governance
4) secure code execution
5) message/boundary security
6) MV3 architecture/perf
7) content-script isolation
8) resilience/error handling
9) testing system
10) accessibility/usability
11) cross-browser compatibility
12) release/supply-chain readiness

Evidence-first rule: every finding must have file-level proof.

## 1. Functional Domain Decomposition

### D1. Platform Adaptation Layer
- Files: `src/content/adapters/*`, `src/content/observers/*`, `src/content/injectors/*`, `src/background/*`
- Responsibility: platform detection, DOM selector adaptation, lifecycle handling.

### D2. Reader & Rendering Engine
- Files: `src/content/features/re-render.ts`, `src/renderer/**`, `src/content/parsers/**`
- Responsibility: markdown rendering, sanitizer flow, reader UX, cache/resilience.

### D3. Bookmark Domain
- Files: `src/bookmarks/**`, key UI: `src/bookmarks/components/SimpleBookmarkPanel.ts`
- Responsibility: bookmark CRUD, folder tree, import/export/merge, panel interactions.

### D4. Message Authoring & Send Bridge
- Files: `src/content/components/FloatingInput.ts`, `src/content/features/MessageSender.ts`
- Responsibility: sync between extension UI and native chat input, send-state handling.

### D5. Export / Save / Deep Research Cleanup
- Files: `src/content/features/save-messages.ts`, `src/content/features/SaveMessagesDialog.ts`, `src/content/features/deep-research-handler.ts`
- Responsibility: export as markdown/pdf, content cleanup, print path.

### D6. Formula / Code / Parsing Utilities
- Files: `src/content/features/math-click.ts`, `src/content/parsers/{math,latex,code,table,markdown}-extractor.ts`
- Responsibility: formula extraction/copy, content normalization.

### D7. Shared Infrastructure
- Files: `src/settings/SettingsManager.ts`, `src/utils/{browser,logger,i18n,design-tokens,ThemeManager}.ts`, `src/components/**`
- Responsibility: storage abstraction, settings schema, logging, tokens/theme, base UI components.

## 2. First-Pass Findings (Priority Ordered)

###[P1] Runtime message handlers accept unvalidated payloads and sender context
- Evidence:
  - `src/background/service-worker.ts` `chrome.runtime.onMessage.addListener((message: any, _sender: any...`
  - `src/background/background-firefox.js` `browser.runtime.onMessage.addListener((message, sender...`
  - `src/content/index.ts` `browser.runtime.onMessage.addListener((request: any...`
- Risk:
  - weak boundary checks and allowlist discipline make future message expansion fragile.
- Recommendation:
  - enforce discriminated union schema for message types.
  - validate sender tab/url/extension id where applicable.
  - reject unknown actions centrally and log structured reason.

###[P1] Monolithic UI module increases defect density and review blind spots
- Evidence:
  - `src/bookmarks/components/SimpleBookmarkPanel.ts` ~7563 LOC.
- Risk:
  - one-file coupling of view state, storage, events, modals, migrations, and business rules.
  - high regression risk and low test granularity.
- Recommendation:
  - split into `state`, `view`, `action handlers`, `dialog factories`, `storage orchestrator`.
  - enforce bounded module size and domain-level unit tests.

###[P1] Test suite is currently red at scale (quality gate ineffective)
- Evidence:
  - `npm test -- --run` summary: 24 failed files, 50 failed tests, 211 passed.
- High-signal failures:
  - browser abstraction mismatch: `tests/unit/utils/browser.test.ts`
  - build-artifact expectations invalid: `tests/unit/utils/browser-fix.test.ts`
  - bookmark contract mismatch: `tests/integration/bookmarks/SimpleBookmarkStorage.integration.test.ts`
  - parser/mock fixture missing files: `tests/integration/parser/parser-integration.test.ts`
- Recommendation:
  - define CI gating tiers: smoke(required), full(optional/nightly) until baseline repaired.
  - restore deterministic fixtures and contract tests per domain.

###[P2] Style redline violations: multiple `!important` outside print-only exception
- Evidence:
  - `src/content/features/save-messages.ts`
  - `src/content/utils/ReaderPanelStyles.ts`
  - `src/bookmarks/components/SimpleBookmarkPanel.ts`
- Risk:
  - difficult style override strategy, brittle across host-site CSS changes.
- Recommendation:
  - replace with stronger scope selectors + tokenized specificity strategy.

###[P2] Extensive `innerHTML` usage expands XSS footgun surface
- Evidence:
  - repeated `innerHTML` assignments across `src/content/features/re-render.ts`, `src/components/DialogHost.ts`, `src/bookmarks/components/SimpleBookmarkPanel.ts`, etc.
- Context:
  - some usages are icon/svg template insertion (low risk), others include dynamic templates and should be tightened.
- Recommendation:
  - classify all writes: static-template-only vs dynamic-content.
  - enforce safe builder utilities (`textContent`, DOM APIs, explicit sanitizer boundaries).

###[P2] Build warns about ineffective dynamic imports and oversized coupling
- Evidence:
  - `npm run build` emitted multiple warnings where modules are both dynamic and static imported.
  - output bundle: `dist-chrome/content.js` ~1.56MB.
- Risk:
  - expected lazy-load behavior is not realized, reducing performance headroom.
- Recommendation:
  - remove mixed import patterns per target module and establish true async boundaries.

## 3. Domain-by-Domain Audit Backlog

### Phase A (Security + Boundary)
- D1 + D7 first
- verify permission-to-feature map, message validation, CSP/sanitization boundaries.

### Phase B (Core UX Reliability)
- D2 + D4 + D5
- reader/send/export correctness, timeout and fallback behavior, cleanup guarantees.

### Phase C (Data Integrity)
- D3 + storage queue/migration consistency
- bookmark key schema, migration idempotency, import/merge conflict behavior.

### Phase D (Parser Correctness)
- D6
- noise filtering, platform-specific parser fitness, fixture coverage.

### Phase E (Compatibility + Release)
- MV3/MV2 diff check, localization completeness, release policy compliance.

## 4. Baseline Verification Executed

- Build:
  - `npm run build` ✅ passed (with chunking/import warnings)
- Test:
  - `npm test -- --run` ❌ failed (24 files / 50 tests)

## 5. Immediate Improvement Targets (Sprint-ready)

1. Message contract hardening (`background` + `content` listeners).
2. Stabilize test baseline (browser abstraction + bookmark API contract + parser fixtures).
3. Split `SimpleBookmarkPanel` into smaller modules with test seams.
4. Remove non-exception `!important` usages.
5. Define safe HTML insertion guideline and enforce by lint/search checks.

---

## 6. Round-2 Deep Audit (D1 + D7)

### 6.1 Findings (Priority Ordered)

###[P1] Message boundary contract is weak (type + sender validation missing)
- Evidence:
  - `src/background/service-worker.ts:92-100`
  - `src/content/index.ts:31-35`
- Detail:
  - both listeners accept `any` payloads and don't enforce schema or sender checks.
  - current actions are small, but boundary hardening is absent for future expansion.
- Improvement:
  - define shared message union (`type`, payload schema).
  - reject unknown actions with explicit error object.
  - validate sender context where available (tab/url/extension origin).

###[P1] Production log level is forced to DEBUG in content script
- Evidence:
  - `src/content/index.ts:69-70`
- Detail:
  - constructor sets `logger.setLevel(LogLevel.DEBUG)` unconditionally.
  - this can leak noisy diagnostics and impact perf/privacy in production pages.
- Improvement:
  - default to INFO/WARN in production builds; gate DEBUG with dev flag.

###[P1] Storage key assumptions and API contract drift already reflected in failing tests
- Evidence:
  - `src/bookmarks/storage/SimpleBookmarkStorage.ts:17-19` (`url.replace` hard assumption)
  - test failures: bookmark storage integration contract mismatches.
- Detail:
  - path indicates insufficient runtime input guards before key generation.
- Improvement:
  - add strict runtime guards for `url`, `position` and platform enum before persisting.
  - expose backward-compatible wrapper methods or align tests/contracts decisively.

###[P2] Inconsistent settings storage domains (sync vs local) for user language
- Evidence:
  - settings schema includes `language`: `src/settings/SettingsManager.ts:41`
  - settings persisted to sync: `src/settings/SettingsManager.ts:266`
  - i18n reads separate local key `userLocale`: `src/utils/i18n.ts:37-38`
- Detail:
  - two sources of truth can diverge; cross-device sync behavior becomes inconsistent.
- Improvement:
  - unify language source in `SettingsManager` and migrate `userLocale` into `app_settings.language`.

###[P2] Utility layer bypasses project logger standard
- Evidence:
  - `src/utils/dom-utils.ts:101`, `src/utils/dom-utils.ts:114`, `src/utils/dom-utils.ts:141` use `console.error`.
- Detail:
  - violates consistent logging/observability strategy and complicates filtering.
- Improvement:
  - replace with `logger.error` + stable module prefix.

###[P2] Browser abstraction reliability gaps (validated by failing unit tests)
- Evidence:
  - implementation: `src/utils/browser.ts:83-95`, `src/utils/browser.ts:111-115`
  - test failures indicate divergence in byte calc/log behaviors.
- Detail:
  - compatibility helper and expected contracts are currently out of sync.
- Improvement:
  - re-baseline browser abstraction tests and enforce a single compatibility contract document.

###[P3] Adapter host matching uses substring includes; should be explicit hostname parse
- Evidence:
  - `src/content/adapters/chatgpt.ts:10-12`.
- Detail:
  - `url.includes(...)` is usually fine with extension match scope, but hostname-based parsing is more robust.
- Improvement:
  - use `new URL(url).hostname` and strict allowlist suffix checks.

### 6.2 Strengths Noted

- Adapter abstraction is explicit and extensible (`src/content/adapters/base.ts`).
- Storage writes are serialized via queue (`src/bookmarks/storage/StorageQueue.ts`), reducing race conditions.
- Settings layer has migration framework and listener model (`src/settings/SettingsManager.ts`).

### 6.3 D1 + D7 Action Backlog

1. Introduce `message-contract.ts` with strict unions + runtime guards in both background/content listeners.
2. Add `LOG_LEVEL` build flag and remove unconditional DEBUG in content bootstrap.
3. Unify language source (`app_settings.language`) and add one-time migration from `userLocale`.
4. Replace `console.error` in utilities with project logger.
5. Harden `SimpleBookmarkStorage` input validation and align tests to final API contract.
6. Refactor adapter URL matching to hostname parsing for all platforms.


---

## 7. Round-3 Deep Audit (D2 + D3)

### 7.1 Findings (Priority Ordered)

###[P1] XSS risk: notification modal interpolates unescaped dynamic message into `innerHTML`
- Evidence:
  - sink: `src/bookmarks/components/SimpleBookmarkPanel.ts:3229-3239`
  - dynamic input source examples:
    - `src/bookmarks/components/SimpleBookmarkPanel.ts:3935-3939` (`errorMessage` from caught error)
    - `src/bookmarks/components/SimpleBookmarkPanel.ts:3901-3905` (quota/import messages)
- Detail:
  - `options.message` is inserted directly; upstream values can include user/import-derived strings.
- Improvement:
  - render message via `textContent` (or escaped template helper) and keep icon/title HTML isolated.

###[P1] Storage atomicity inconsistency in bookmark domain (queue vs direct writes)
- Evidence:
  - queued writes in bookmark storage: `src/bookmarks/storage/SimpleBookmarkStorage.ts` (uses `StorageQueue`)
  - direct writes in folder storage without queue:
    - `src/bookmarks/storage/FolderStorage.ts:121`
    - `src/bookmarks/storage/FolderStorage.ts:270-276`
    - `src/bookmarks/storage/FolderStorage.ts:332`
- Detail:
  - concurrent folder operations can interleave with bookmark writes, weakening consistency guarantees.
- Improvement:
  - route folder mutations through shared queue/transaction coordinator.
  - define operation-level lock ordering for folder/bookmark combined updates.

###[P2] Reader/content synchronization path has heavy debug logging in hot storage-change flow
- Evidence:
  - `src/content/index.ts:198-245` logs every changed key and toolbar update at info level.
- Detail:
  - on active pages, this can create high-volume logs and unnecessary overhead.
- Improvement:
  - downgrade to debug and aggregate metrics into one structured log.

###[P2] Data contract is too permissive for platform identity
- Evidence:
  - `src/bookmarks/storage/types.ts:28` allows `'... | string'` for `platform`.
- Detail:
  - weak typing reduces validation value and can introduce inconsistent UI/filter behavior.
- Improvement:
  - constrain to known enum + explicit `Unknown`/`Custom` strategy with migration.

###[P2] Build-time lazy loading expectations are undermined by mixed imports in D2/D3 core modules
- Evidence:
  - build warns for mixed dynamic/static imports involving `MarkdownRenderer`, `SimpleBookmarkStorage`, `BookmarkSaveModal`, `SimpleBookmarkPanel`.
- Detail:
  - current import graph keeps large modules in main content bundle.
- Improvement:
  - isolate true lazy boundaries (dialogs/panel/detail views) and remove static back-references.

###[P3] Large monolithic UI files in bookmark domain reduce testability
- Evidence:
  - `src/bookmarks/components/SimpleBookmarkPanel.ts` (~7563 LOC)
  - `src/bookmarks/components/BookmarkSaveModal.ts` (~969 LOC)
- Detail:
  - stateful UI orchestration and domain actions are tightly coupled.
- Improvement:
  - split by concern: state store, renderers, command handlers, modal factories.

### 7.2 Strengths Noted

- PDF export path escapes key metadata fields and sanitizes rendered markdown:
  - `src/content/features/save-messages.ts:366-400`.
- Renderer includes sanitizer and resilience layers:
  - `src/renderer/core/MarkdownRenderer.ts`, `src/renderer/sanitizer/DOMPurifySanitizer.ts`.
- Bookmark writes have queue support in core storage path:
  - `src/bookmarks/storage/StorageQueue.ts` + `SimpleBookmarkStorage` integration.

### 7.3 D2 + D3 Action Backlog

1. Patch `showNotification` templating to eliminate unescaped message HTML sink.
2. Introduce unified storage mutation coordinator for folder + bookmark operations.
3. Reduce content-script hot-path info logging; keep prod logs concise.
4. Tighten bookmark platform type/validation and provide migration path.
5. Rework import graph to realize lazy loading targets and shrink content bundle.
6. Extract bookmark panel into composable submodules with focused tests.


---

## 8. Round-4 Deep Audit (D4 + D5 + D6 + Remaining Dimensions)

### 8.1 Findings (Priority Ordered)

###[P1] Parser performance logging always enabled in production path
- Evidence:
  - `src/content/parsers/markdown-parser.ts:11-13` (`enablePerformanceLogging: true`)
- Impact:
  - unnecessary runtime overhead and noisy logs on user pages.
- Improvement:
  - gate with dev flag or logger level.

###[P1] Parser pipeline repeatedly uses `innerHTML` on cloned DOM fragments; needs explicit trust boundary documentation and tests
- Evidence:
  - `src/content/parsers/code-extractor.ts:19`
  - `src/content/parsers/table-parser.ts:18`
  - `src/content/parsers/math-extractor.ts:23,302`
- Impact:
  - currently mostly on cloned content, but boundary assumptions are implicit; regressions could introduce sinks.
- Improvement:
  - document sanitization/escape contract per stage and add security tests around malicious inputs.

###[P2] Accessibility gaps in some icon-only actions without explicit ARIA labels
- Evidence:
  - `src/content/components/FloatingInput.ts:202-243` (collapse/send icon buttons use title but no explicit `aria-label` set in code).
  - `src/content/features/SaveMessagesDialog.ts:139-141` (close button icon inserted but no explicit label).
- Impact:
  - weaker screen-reader semantics in dialog/input flows.
- Improvement:
  - enforce aria-label on all icon-only controls.

###[P2] Save dialog and export paths rely heavily on imperative HTML injection patterns
- Evidence:
  - `src/content/features/SaveMessagesDialog.ts` multiple `innerHTML` template assignments.
  - `src/content/features/save-messages.ts:406` final `printContainer.innerHTML = html`.
- Impact:
  - maintainability and safety review complexity increase.
- Improvement:
  - split static template fragments from dynamic text nodes and encode dynamic fields by construction.

###[P2] CI automation missing for required quality gates
- Evidence:
  - no workflow files in `.github/workflows/`.
  - local checks exist (`npm run build`, `npm test`) but not enforced server-side.
- Impact:
  - red tests and regressions can merge unnoticed.
- Improvement:
  - add mandatory CI for build + targeted test tiers + lint/static checks.

###[P2] Security policy references missing documentation path
- Evidence:
  - `SECURITY.md` mentions `docs/security/permissions.md`, file not present.
- Impact:
  - security/process documentation contract is broken.
- Improvement:
  - add missing doc or update policy reference.

###[P3] Capability matrix appears stale vs implemented features
- Evidence:
  - `docs/antigravity/platform/CAPABILITY_MATRIX.md` marks several features as planned (`🔲`) that are implemented in code/release notes.
- Impact:
  - operational docs drift, review and product communication confusion.
- Improvement:
  - sync capability matrix with current release reality.

### 8.2 Strengths Noted

- Message sending bridge has layered fallback strategy and explicit synchronization flow:
  - `src/content/features/MessageSender.ts`.
- Markdown rendering path includes sanitizer + resilience controls:
  - `src/renderer/core/MarkdownRenderer.ts`, `src/renderer/sanitizer/DOMPurifySanitizer.ts`.
- Cross-browser build split is explicit and understandable:
  - `manifest.chrome.json` + `manifest.firefox.json`, plus separate background scripts.

---

## 9. Final Consolidated Assessment

### 9.1 Scorecard (12 Dimensions)

| Dimension | Status | Notes |
|:--|:--|:--|
| Product focus | Partially Meets | Strong core value, but module coupling reduces clarity. |
| Least privilege | Meets | Permissions are relatively constrained to needed hosts/storage/clipboard. |
| Privacy/data governance | Partially Meets | Good policy baseline, but settings/locale storage split creates governance inconsistency. |
| Secure code execution | Partially Meets | Sanitizer exists, but several HTML injection sinks remain high-risk patterns. |
| Message/boundary security | Partially Meets | Runtime message contracts are weakly typed and weakly validated. |
| MV3 architecture/performance | Partially Meets | Works, but mixed import graph weakens lazy-loading and bundle size goals. |
| Content-script isolation | Meets | Shadow DOM use is solid; still needs stricter sink discipline. |
| Resilience/error handling | Partially Meets | Many try/catch guards exist, yet test baseline indicates contract drift. |
| Testing system | Does Not Meet | test suite is red at scale (24 failed files / 50 failed tests). |
| Accessibility/usability | Partially Meets | Many ARIA patterns present; gaps on some icon-only controls remain. |
| Cross-browser compatibility | Partially Meets | practical support exists, but compatibility docs/contract drift and failing tests reduce confidence. |
| Release/supply-chain readiness | Does Not Meet | No CI workflows enforcing required quality gates. |

### 9.2 Overall Verdict

- Current state: **Not release-grade for strict quality bar** due to P1 issues + red test baseline.
- Architecture potential: **High** (clear domain intent, sanitizer and storage queue patterns exist).
- Main blocker: **Consistency gap** between intended standards and enforced runtime/test/release controls.

---

## 10. Prioritized Remediation Roadmap

### Phase 0 (Immediate, block release)

1. Fix XSS sink in bookmark notification modal (`options.message` escaping or text nodes).
2. Introduce strict message contracts for background/content messaging.
3. Disable forced DEBUG and gate performance logging by environment.
4. Stabilize test baseline to green for required suites.

### Phase 1 (1 sprint)

1. Unify storage mutation coordination for folder/bookmark operations.
2. Normalize logging to project logger, remove console usage in utilities.
3. Unify language setting source of truth (`SettingsManager` + migration).
4. Add CI workflows (`build`, core tests, static redline checks).

### Phase 2 (2-3 sprints)

1. Split monolithic bookmark panel into modular components/services.
2. Refactor import graph to realize true lazy-load boundaries.
3. Introduce a security regression suite for HTML injection/sanitization boundaries.
4. Align docs (`CAPABILITY_MATRIX`, security references) with code reality.

---

## 11. Verification Snapshot

- `npm run build` on 2026-02-06: ✅ success, with chunking/mixed import warnings.
- `npm test -- --run` on 2026-02-06: ❌ failed (24 test files failed, 50 tests failed).

---

## 12. Import Visibility Root Cause Record

### Symptom
- Importing large bookmark JSON could show fewer visible bookmarks than actual persisted records.
- After delete-all, re-import could report duplicate entries that were previously hidden.

### Root Cause
1. Missing ancestor folder records in import pipeline caused valid bookmarks to point to non-materialized tree nodes.
2. Folder creation errors during import were logged but not surfaced, so failed paths silently produced hidden entries.

### Implemented Fixes
- Ancestor path materialization before bookmark write.
- Missing-folder auto-recovery from bookmark dataset on panel load/refresh.
- Explicit import fallback policy:
  - failed folder paths are collected,
  - affected bookmarks are remapped to `Import`,
  - warning notification reports failure count and remapped bookmark count.

### Validation Evidence
- `tests/bookmarks/ImportFolderVisibility.regression.test.ts`
- `tests/bookmarks/ImportWorkflowClosedLoop.test.ts`
- `tests/bookmarks/MissingFolderRecovery.test.ts`
- `tests/bookmarks/FolderStorageSafety.test.ts`

---

## 13. Filesystem Upgrade Verification (Convergence Round)

### Code Upgrades
- Unified write serialization:
  - `SimpleBookmarkStorage`: `save/bulkSave/bulkRemove/bulkMoveToFolder/repairBookmarks`
  - `FolderStorage`: `create/rename/delete/move/bulkDelete`
- Duplicate identity hardened to normalized key:
  - `urlWithoutProtocol + position` for import merge dedupe.
- Import resilience:
  - failed folder creation now triggers explicit warning + fallback remap to `Import`.
- Refresh stability:
  - storage change burst coalescing + mutation cooldown in bookmark panel.

### Test Evidence (Passing)
- `tests/bookmarks/ImportFolderVisibility.regression.test.ts`
- `tests/bookmarks/ImportWorkflowClosedLoop.test.ts`
- `tests/bookmarks/MissingFolderRecovery.test.ts`
- `tests/bookmarks/StorageLifecycleReliability.test.ts`
- `tests/bookmarks/FolderStorageSafety.test.ts`
- `tests/bookmarks/ExportImportRoundtrip.test.ts`
- `tests/bookmarks/ImportMerge.test.ts`
- `tests/bookmarks/SearchFilterVisibility.test.ts`
- `npm run type-check`

### Remaining Manual Checks (UI)
- Header count text vs storage count after import under real extension runtime.
