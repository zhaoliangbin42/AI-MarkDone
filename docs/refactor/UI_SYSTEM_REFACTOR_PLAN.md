# AI-MarkDone UI System Refactor Closeout

Status: **Phase 7 engineering closeout complete; installed-browser matrix partially complete.** Phases 1–6, the Phase 7 SSOT rewrite, and every automated gate are complete in the current worktree. A live installed-Chrome smoke check passed without changing the open draft. The exact current-build reload and the Firefox MV2 installed-extension matrix were not run in the available browser harness, so this record does not mislabel the cross-browser manual gate as complete.

Authority:

- `docs/design.md` owns long-lived visual, Surface, token, appearance, and responsive contracts.
- `docs/architecture/CURRENT_STATE.md` owns the current implementation inventory.
- `docs/architecture/BLUEPRINT.md` owns dependency direction and module boundaries.
- `docs/testing/CURRENT_TEST_GATES.md` owns executable verification requirements.
- This file records delivery history, Phase 7 cleanup, and closeout evidence only.

## 1. Objective And Preserved Boundaries

The program converged every user-visible AI-MarkDone Surface on a small set of appearance, lifecycle, chrome, responsive, and governance Modules while preserving the product's visual identity and behavior.

Preserved boundaries:

- Existing typography, palette, radius character, Shadow DOM-first policy, lazy heavy-feature loading, and Chrome MV3 / Firefox MV2 parity remain the product contract.
- No UI framework, global observer, settings field, RPC, public protocol, or second token source was introduced.
- Hidden PNG/formula renderer output is outside UI chrome ownership.
- `SiteAdapter`, runtime protocol, settings schema, and `SendPort` remain compatible.
- Unrelated image-export work and untracked `videos/` remain outside this program.
- No commit is created by this program unless separately requested.

## 2. Delivered System Facts

- Token generation is split across `reference-tokens.ts`, `system-tokens.ts`, and `public-tokens.ts`, with `tokens.ts` as the composition entry. Components consume Public/Family tokens, not Reference/System tokens.
- `AppearanceSnapshot` is the immutable theme/global-override value. `AppearanceScope` applies it to page, ShadowRoot, and documented light-DOM portal scopes, skips identical fingerprints, shares identical constructed stylesheets where available, and retains a style-tag fallback.
- `SurfaceRuntime` defines `panel`, `modal`, `anchored`, and `inline` profiles. `SurfaceSession` composes appearance/locale binding, focus, Escape, outside dismiss, positioner, motion, reduced motion, close completion, and teardown. `OverlaySession` adapts modal/panel flows to the shared overlay host.
- `tests/support/uiSurfaceCoverage.ts` mirrors the semantic catalog with production owner/entry, profile, scope, responsive contract, Chrome/Firefox targets, real trigger tests, and direct/family real-component fixture evidence.
- `npm run test:ui:visual` discovers direct fixtures from that manifest, mounts real Modules with production token/Shadow DOM paths, and stores non-Git evidence under `output/ui-visual/`.
- The visual harness also checks component-owned geometry that generic overflow audits cannot see: switch-thumb centering, Bookmarks filter clipping, and bookmark metadata collision.
- Prompt is split across workflow, geometry, and rendering Modules; Reader across workflow, view model, rendering, host adapter, and contracts; Bookmarks across shell orchestration, tab/Cloud Backup workflows, and family responsive styles.
- The production-dead Send modal, generic Tabs component, no-op Markdown enhancer/theme compatibility shims, empty Bookmarks overlay subclass, and redrawn Panel Studio fixture are absent. Markdown display CSS has one service-layer owner.
- Heavy Reader, Bookmarks, save/export, Copy PNG, and formula-asset capabilities remain behind the existing extension-origin lazy feature boundary.

## 3. Delivery Record

### Phase 1 — SSOT Definition (implemented)

- Established shared UI vocabulary in `CONTEXT.md`.
- Added the complete Surface catalog, token ownership, appearance scope, lifecycle, responsive, and fixture contracts to `docs/design.md`.
- Aligned current architecture, blueprint, feature semantics, testing authority, and the documentation index.

### Phase 2 — Executable Governance And Real Fixtures (implemented)

- Added the test-only Surface coverage manifest and clean-checkout fixture checks.
- Replaced historical style allowlists with shipped-style discovery.
- Added token graph, style-value, Surface coverage, and visual-harness governance.
- Added the Playwright/Vite real-component visual command; exploration pages do not satisfy product evidence.

### Phase 3 — Token Correctness And Appearance Baseline (implemented)

- Replaced missing/legacy token references with canonical semantic, Family, or private owners.
- Separated Reference, System, Public, Family, and private ownership.
- Removed empty style injection and kept Reader width/body type in Reader state.
- Current governance reports no temporary token migration list; static popup/export values use exact owner-and-reason exceptions.

### Phase 4 — Appearance And Surface Runtime (implemented)

- Introduced immutable appearance snapshots and page/ShadowRoot/light-DOM scopes.
- Suppressed unchanged appearance broadcasts and shared identical ShadowRoot token sheets with a fallback.
- Unified common Surface focus, dismissal, positioning, motion, reduced-motion, close, and teardown mechanics.
- Kept host selectors and geometry in adapters or family geometry owners.

### Phase 5 — Surface Convergence And Visual Micro-Polish (implemented)

- Composer and transient UI: Input Enhancement, formula assistant, Prompt, toolbar hover/progress.
- Save, Send, and dialogs: Bookmark Save, Save Messages, Send, Cloud Backup, notices, and import review.
- Reader: in-page and detached Reader plus settings, comments, templates, Prompt picker, and Send.
- Bookmarks and Settings: workspace, tree, tabs, form rows, data management, Cloud Backup, and information tabs.
- Host-integrated UI and popup: toolbar, task progress, Directory, page controls, tooltip/toast, and unsupported-page popup.

The visual adjustment remained deliberately small: clearer hierarchy, spacing, density, alignment, focus feedback, and responsive behavior without changing workflows or product identity.

### Phase 6 — Long-Chain Deepening And Legacy Removal (implemented)

- Separated Prompt workflow, geometry, rendering, and orchestration responsibilities.
- Separated Reader workflow, view model, rendering, host boundary, and public contracts.
- Separated Bookmarks tab/Cloud Backup workflows and family responsive styles from shell orchestration.
- Removed the verified production-dead UI paths and compatibility shims listed in Section 2.
- Preserved heavy-feature lazy loading and the existing global-observer boundary.

### Phase 7 — Closeout (engineering work complete; manual matrix partial)

Delivered closeout:

- Rewrote current-state, feature, design, blueprint, testing, and index SSOT to describe the delivered system.
- Added concise English user-facing changelog entries for visual consistency and responsive fixes.
- Rechecked authoritative paths and removed pre-delivery wording and stale fixture references.
- Ran the focused governance, product, visual, build, performance, live-Chrome, and repository-hygiene gates recorded below.

The table records a result for every gate. A partial manual row is intentionally not treated as a pass.

## 4. Closeout Evidence

Confirmed structural evidence:

- The Surface manifest, token/style inventory, Family-token registry, real visual harness, shared appearance/runtime Modules, responsibility-split Modules, and legacy-closure tests exist in the current worktree.
- Every catalog entry names Chrome and Firefox targets plus a tracked direct or explicitly family-covered real-component fixture.
- The visual runner has a default smoke mode, a full manifest-driven matrix, a single-fixture selector, and checks for page/console errors, horizontal overflow, and fixed-Surface viewport escape.

Execution record from the current closeout worktree:

| Evidence | Command / scope | Current closeout result |
|:--|:--|:--|
| Documentation governance | focused docs-governance Vitest | Passed as part of the final 21-file / 108-test governance and architecture rerun. |
| UI architecture/governance | appearance, Surface Runtime, coverage, token/style, visual-harness, legacy/Reader closure suites | Passed in the final core and acceptance runs, including documentation, token graph, Surface coverage, visual-harness contract, responsive Bookmarks geometry, and legacy/Reader closure. |
| Full product suite | `npm run test:core` | Passed: 243 files, 1,574 tests. |
| Fast contract suite | `npm run test:smoke` | Passed: 6 files, 45 tests. |
| Acceptance suite | `npm run test:acceptance` | Passed: 18 files, 191 tests. |
| Real-component visual matrix | `npm run test:ui:visual -- --full` | Passed: 451/451 cases, 0 failures; evidence `output/ui-visual/full-2026-07-16T04-58-29-439Z`. |
| Chrome MV3 + Firefox MV2 build/bundle | `npm run build` | Passed both targets and bundle gates. Per target, `content.js`: 724.82 kB raw / 190.94 kB gzip; complete content feature graph: 1,572.62 kB / 425.63 kB. |
| ChatGPT runtime performance | three consecutive `npm run perf:chatgpt` runs; report medians and invariants | Passed. Medians: toolbar ready 239.8 ms, recovery 152.1 ms, feature load 77 ms, heap 4,986,554 bytes, cold duration 1,752.7 ms, cold long-task total/max 61 ms. Every run retained 200/200 toolbars, 0 duplicates, 0 idle mutations, 200 streaming mutations with 0 streaming long tasks, 12 feature requests, and 0 export-renderer requests. |
| Installed-extension UI matrix | Chrome MV3 + Firefox MV2 using `docs/testing/E2E_REGRESSION_GUIDE.md` | Partial, not passed: an existing installed Chrome session showed one Input Enhancement button, correct collapsed/expanded ARIA, all 8 controls, the real guide modal trigger, clean close, preserved empty draft, and 0 extension console errors. The harness could not inspect extension-page URLs, the exact current-build reload was deliberately skipped to protect the open tab, and no controllable Firefox instance was available. |
| Diff hygiene | `git diff --check` | Passed after final SSOT updates. A temporary-index clean-checkout audit also covers tracked and newly added files without changing the real index. |

## 5. Definition Of Complete

The program is complete only when:

- every cataloged Surface retains one owner, declared DOM scope/profile, responsive contract, real trigger evidence, and direct or family real-component visual evidence;
- all shipped CSS variables close through the token graph with documented ownership and no temporary migration entries;
- unrelated settings updates produce no appearance broadcast, and one meaningful appearance update applies at most once per scope;
- anchored/modal/panel Surfaces clean up focus, listeners, scroll locks, hosts, and motion state deterministically;
- the full visual matrix rejects overflow, clipped/unreachable actions, viewport escape, stale/duplicate hosts, and console errors;
- current Chrome MV3 and Firefox MV2 builds and ChatGPT performance invariants are recorded from this worktree;
- the installed-extension row explicitly distinguishes the completed Chrome smoke check from the still-unexecuted current-build and Firefox manual matrix;
- authoritative docs describe the delivered implementation and no closeout row hides an unexecuted check behind a pass.
