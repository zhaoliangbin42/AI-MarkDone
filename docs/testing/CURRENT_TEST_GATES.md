# Current Test Gates

This document defines the **current executable test and verification gates** for day-to-day development. Use this file for what we must run now, not for future-state testing architecture.

For long-term testing direction, see `docs/testing/TESTING_BLUEPRINT.md`.
For full manual regression, see `docs/testing/E2E_REGRESSION_GUIDE.md`.
For ChatGPT runtime and bundle performance work, see `docs/testing/PERFORMANCE_GATES.md`.

---

## 1. Document Roles

- `CURRENT_TEST_GATES.md`
  - current required verification for active development
- `TESTING_BLUEPRINT.md`
  - target testing architecture and future structure
- `E2E_REGRESSION_GUIDE.md`
  - full manual regression checklist for release or major refactor

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

If the change adds or changes Safari WebExtension packaging, also run:

- `npm run build:safari:webext`

### Broad Behavior Changes Or Risky Refactors

If the change touches multiple modules, user-visible flows, or high-risk paths, run:

- `npm run test:core`
- `npm run build`

Use targeted tests in addition when the failure mode is local and well defined.

For performance refactors, also run the phase-specific gates in `PERFORMANCE_GATES.md`. A phase may not advance when its correctness, reliability, bundle, or runtime threshold is red.

For large structural refactors, the minimum acceptable closing gate is:

- affected feature family tests
- `npm run test:acceptance`
- `npm run build`

For ChatGPT-only payload/store-first, directory-rail, or ChatGPT bookmark-position changes, targeted verification must also prove these entrypoints still agree on the same conversation position model:

- directory rail click
- Reader locate / jump-to-message
- toolbar bookmark save/highlight
- bookmarks panel Go and cross-page pending navigation
- Save Messages export source, when the change touches Reader content source, conversation snapshot fallback, or export turn conversion

If those entrypoints intentionally share a ChatGPT-only helper, include one targeted test for each caller instead of only testing the helper in isolation. For ChatGPT bookmark-position or directory-navigation work, the focused set should cover `tests/unit/ui/content/chatgptDirectory.navigation.test.ts`, `tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts`, `tests/unit/ui/bookmarks/bookmarksPanelController.test.ts`, and `tests/unit/runtimes/content/entry.test.ts`. If the work changes the lower-right ChatGPT message stepper, its Settings visibility toggle, or arrow-key navigation, also cover `tests/unit/ui/content/controllers/ChatGPTMessageStepperController.test.ts`, `tests/unit/services/settings/settingsService.test.ts`, and `tests/unit/ui/bookmarks/settingsTabView.test.ts`. If the work changes the directory rail settings surface, also cover `tests/unit/services/settings/settingsService.test.ts` and `tests/unit/ui/bookmarks/settingsTabView.test.ts`; if it changes official ChatGPT navigation hiding, also cover `tests/unit/ui/content/controllers/ChatGPTOfficialNavigationVisibilityController.test.ts`.

For message-toolbar injection or official action-row hydration changes, focused verification must include `tests/unit/ui/content/messageToolbarOrchestrator.official-anchor.test.ts` and `tests/unit/ui/content/messageToolbarOrchestrator.scheduler.test.ts`, then `npm run build`.

For Google Drive backup changes, focused verification must include `tests/unit/contracts/protocol.test.ts`, `tests/unit/governance/manifest-generation.test.ts`, `tests/unit/core/cloudBackup/snapshot.test.ts`, `tests/unit/core/cloudBackup/restorePlan.test.ts`, `tests/unit/runtimes/background/cloudBackup-handler.test.ts`, `tests/unit/drivers/background/googleDriveProvider.test.ts`, `tests/unit/ui/bookmarks/settingsTabView.test.ts`, and Google Drive lifecycle UI coverage in `tests/unit/ui/bookmarks/bookmarksPanel.test.ts`, then `npm run test:smoke`, `npm run test:acceptance`, and `npm run build`. UI changes must prove Settings exposes Data Management with Google Drive Backup (Experimental) and Local Backup cards without exposing unfinished providers or sync wording. OAuth changes must cover manifest `oauth2` SSOT for Google Chrome `getAuthToken`, WebAuth-compatible browser fallback, Firefox/WebAuth fallback, sanitized diagnostics, invalid OAuth request mapping, exact `identity.getRedirectURL()` usage, access-token expiry caching, Firefox allizom-to-loopback redirect handling, connected account display/clear behavior, connect-before-OAuth confirmation, and Safari remaining hidden until a verified auth path exists.

For Save Messages source changes, verification must prove the dialog enters through the fresh `readerContentSource`, does not call legacy adapter-based export collection, and does not choose its own ChatGPT body source. ChatGPT source changes must also prove Reader / Save Messages / toolbar copy item counts stay aligned through the shared fresh `ReaderItem[]` source, including discovered rounds whose assistant DOM content is not currently copyable. Keep at least one real `SaveMessagesDialog` trigger-path test plus service-level coverage for `ReaderItem[]` to `ChatTurn[]` conversion. If the source change touches formulas, also prove the Markdown branch applies `formula.markdownCopyFormulaFormat` only at clipboard or Markdown-file exits, while PDF/PNG rendering and Reader canonical content stay untouched.

For ChatGPT content-discovery changes, browser evidence is part of the gate, not an optional manual check. Before editing shared collectors, verify the proposed source order on representative conversations, route changes, and refreshes. The accepted source order is backend conversation payload first, then structurally scoped turn data (`data-turn-id-container`, `data-testid^="conversation-turn-"`, `data-turn`, or role-backed turns inside the conversation root), then lower-quality store/visible-DOM fallbacks. Lower-quality fallbacks must not replace a fuller snapshot for the same conversation, and assistant-only DOM counts must not create extra user rounds. Focused unit coverage should include `tests/unit/drivers/content/chatgpt/ChatGPTConversationEngine.test.ts`, `tests/unit/drivers/content/chatgpt/chatgptConversationBridge.test.ts`, `tests/unit/drivers/content/chatgpt-adapter-fold-groups.test.ts`, and `tests/unit/drivers/content/conversation/collectConversationMessageRefs.test.ts`.

If the change affects ChatGPT snapshot bridge transport, focused coverage must prove both Chrome/Chromium object `CustomEvent.detail` and Firefox JSON string `CustomEvent.detail` paths. Reader, Bookmark, Copy, and Save Messages tests should continue to exercise the shared snapshot source without adding browser-specific branches at those upper layers.

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
- Release preparation
  - `npm run release:verify` + `npm run package:safari:xcode` + Safari DMG packaging from a signed `.app` + App Store Connect readiness check + relevant manual regression
  - add `npm run test:core` for broad behavior changes, risky refactors, or release-candidate hardening runs where the full fixture set is available

### Acceptance / Release Governance

Use `npm run test:acceptance` when the change affects:

- supported hosts / platform coverage declarations
- manifest/build artifact consistency
- release-level compatibility statements in `docs/**`

Current acceptance gate includes:

- `tests/unit/governance/manifest-resource-consistency.test.ts`
- `tests/unit/governance/manifest-generation.test.ts`
- `tests/unit/governance/supported-hosts-consistency.test.ts`
- `tests/unit/governance/i18n-keys.test.ts`
- `tests/unit/ui/i18n/i18n.test.ts`
- `tests/unit/drivers/shared/browserApi.test.ts`
- `tests/unit/drivers/content/chatgpt/ChatGPTConversationEngine.test.ts`
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
