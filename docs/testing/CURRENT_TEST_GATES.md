# Current Test Gates

This document defines the **current executable test and verification gates** for day-to-day development. Use this file for what we must run now, not for future-state testing architecture.

For long-term testing direction, see `docs/testing/TESTING_BLUEPRINT.md`.
For full manual regression, see `docs/testing/E2E_REGRESSION_GUIDE.md`.

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

### Broad Behavior Changes Or Risky Refactors

If the change touches multiple modules, user-visible flows, or high-risk paths, run:

- `npm run test:core`
- `npm run build`

Use targeted tests in addition when the failure mode is local and well defined.

For large structural refactors, the minimum acceptable closing gate is:

- affected feature family tests
- `npm run test:acceptance`
- `npm run build`

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

- `header icon -> bookmarks panel toggle -> panel open`
- `toolbar action -> reader popover open`
- `settings trigger -> modal/dialog open`

If the bug affects shared behavior or a critical path, also run `npm run test:smoke` or `npm run test:core` as appropriate.

---

## 3. Manual Gates

Manual regression is required when:

- preparing a release
- adding or expanding platform support
- changing UI injection, toolbar behavior, reader behavior, bookmarks flows, or browser compatibility boundaries
- changing style-system rules, Tailwind alias boundaries, or overlay/toolbar UI architecture

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
  - `npm run test:smoke` + `npm run test:core` + `npm run test:acceptance` + `npm run build` + relevant manual regression

### Acceptance / Release Governance

Use `npm run test:acceptance` when the change affects:

- supported hosts / platform coverage declarations
- manifest/build artifact consistency
- release-level compatibility statements in `docs/**`

Current acceptance gate includes:

- `tests/unit/governance/manifest-resource-consistency.test.ts`
- `tests/unit/governance/supported-hosts-consistency.test.ts`
- `tests/unit/governance/i18n-keys.test.ts`
- `tests/unit/ui/i18n/i18n.test.ts`
- `tests/unit/ui/content/controllers/ChatGPTFoldingController.test.ts`
- `tests/unit/runtimes/content/entry.test.ts`

---

## 5. Done Criteria

Verification is complete only when:

- the selected automated gates actually ran
- the results are stated explicitly
- any required manual regression is called out
- remaining edge cases and recommended follow-up tests are made explicit
