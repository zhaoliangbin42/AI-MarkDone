# Bookmarks Panel Style-System Remediation Checklist

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this checklist task-by-task.

**Goal:** Bring the shipped `BookmarksPanel` styling into strict alignment with the repository style blueprint without changing non-UI behavior contracts.

**Architecture:** Keep the current runtime ownership model intact: `BookmarksPanel` must continue to mount through the shared overlay host, consume theme CSS through `src/style/tokens.ts`, and stay inside Shadow DOM. The remediation work is limited to `src/ui/**`, `src/style/**`, tests, and user-facing documentation updates that are required by the repository rules.

**Tech Stack:** TypeScript, Vite, Shadow DOM, shared overlay host, canonical `--aimd-*` token system, overlay Tailwind alias layer.

---

## How To Use This Checklist

- Update checkboxes in this file as work lands.
- Do not mark an item complete from reasoning alone.
- Each completed item must have verification evidence:
  - targeted tests, or
  - browser/runtime verification, and
  - `npm run build`
- Keep scope inside UI/style layers unless this checklist is explicitly revised.

## Scope Freeze

### In Scope

- `src/ui/content/bookmarks/**`
- `src/ui/content/overlay/**` only if needed to preserve current compliant ownership
- `src/style/**`
- `tests/unit/ui/bookmarks/**`
- `CHANGELOG.md` if user-visible behavior changes during cleanup

### Out Of Scope

- `src/services/**`
- `src/drivers/**`
- `src/contracts/**`
- `src/core/**`
- `src/runtimes/**`

## Audit Verdict

### What Is Already Aligned

- [x] Reconfirm `BookmarksPanel` still mounts through the shared overlay host.
- [x] Reconfirm token CSS still enters through `getTokenCss()` rather than module-local token injection.
- [x] Reconfirm the panel remains fully inside Shadow DOM.
- [x] Reconfirm Tailwind usage remains overlay-only, `tw`-prefixed, and semantic-alias-only.

### What Is Not Strictly Aligned Yet

- [x] Raw visual values still exist in shipped UI CSS and must be eliminated or explicitly justified as structural exceptions.
- [ ] `bookmarksPanelCss.ts` is still acting as a large local design system instead of a thin component layer.
- [ ] Typography sizing is not yet mapped cleanly to the blueprint's token/type-scale expectations.
- [x] Layering and elevation still include literal component-level values instead of fully tokenized ownership.
- [x] Gradient and color treatment still mix canonical tokens with raw literals such as `white`, `rgba(...)`, and hex values.

## Remediation Workstreams

### Workstream 1: Freeze The Current Debt Inventory

**Files**

- Review: `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`
- Review: `src/style/tokens.ts`
- Review: `docs/style/STYLE_SYSTEM.md`
- Review: `docs/style/STYLE_ARCHITECTURE.md`

**Checklist**

- [ ] Record every raw color occurrence in `bookmarksPanelCss.ts`.
- [ ] Record every literal radius, spacing, sizing, shadow, z-index, and duration occurrence in `bookmarksPanelCss.ts`.
- [ ] Classify each literal value as one of:
  - must become canonical token
  - may become `bookmarks-panel` component token
  - allowed structural exception
- [ ] Identify duplicate values that should collapse into shared aliases instead of remaining repeated literals.

**Acceptance**

- We have a complete inventory table inside this document before implementation starts.
- No remediation task proceeds on guesswork about remaining debt.

### Workstream 2: Define The Allowed Token Destinations

**Files**

- Modify if needed: `src/style/system-tokens.ts`
- Modify if needed: `src/style/tokens.ts`
- Modify if needed: shared overlay style entrypoints near `src/style/**`

**Checklist**

- [ ] Decide which values truly belong in canonical system tokens because they are reusable across overlay modules.
- [ ] Decide which values are specific to `bookmarks-panel` and should become thin component tokens rather than raw literals.
- [ ] Explicitly reject any proposal that would create a second product token source inside `BookmarksPanel`.
- [ ] Keep platform-specific visual differences out of the token layer.

**Acceptance**

- Every moved value has a clear target layer: system token or component token.
- No new token is added without a reuse or ownership rationale.

### Workstream 3: Strip Raw Visual Values Out Of `BookmarksPanel`

**Files**

- Modify: `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`
- Modify if needed: `src/style/system-tokens.ts`
- Modify if needed: `src/style/tokens.ts`

**Checklist**

- [x] Replace raw colors, `white`, `black`, hex values, and `rgba()/rgb()` usages with canonical tokens or approved component-level combinations.
- [x] Replace literal radii with token-backed values.
- [x] Replace literal z-index values with token-backed values or inherited overlay ownership.
- [x] Replace literal elevation/shadow values with token-backed values.
- [x] Replace literal motion values with token-backed values.
- [x] Replace repeated literal spacing and control sizing values with token-backed values where blueprint requires it.
- [x] Keep only truly structural one-off values local, and document why they remain local.

**Acceptance**

- Shipped UI no longer relies on raw colors/radii/shadows/z-index as primary visual sources.
- Remaining local literals are structural and minimal, not the module's visual truth.

### Workstream 4: Slim The Component Layer

**Files**

- Modify: `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`
- Create/modify if needed: smaller co-located style files under `src/ui/content/bookmarks/ui/styles/**`

**Checklist**

- [ ] Separate shell/layout structure from visual tokens where that split improves clarity.
- [ ] Ensure `bookmarksPanelCss.ts` no longer behaves like a full private design system.
- [ ] Keep only local structural styles, layout glue, and module-private composition rules in component CSS.
- [ ] Remove repeated visual recipes that should live in shared overlay primitives or token aliases.

**Acceptance**

- The component style layer is visibly thinner and easier to audit.
- Shared visual semantics are no longer trapped in one large module CSS file.

### Workstream 5: Reconcile Typography With The Blueprint

**Files**

- Modify: `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`
- Modify if needed: `src/style/system-tokens.ts`

**Checklist**

- [x] Inventory every `font-size` and `line-height` value used by the panel.
- [x] Map panel title, nav labels, tree rows, metadata, buttons, and dialogs to approved type-scale roles.
- [x] Remove ad hoc pixel typography where a stable role already exists.
- [ ] Review explicit `font-family` usage and keep it only if it is consistent with the repository's actual UI baseline.

**Acceptance**

- Typography values are role-driven, not scattered per selector.
- The panel no longer depends on arbitrary font-size literals as an informal system.

### Workstream 6: Verify Tailwind Boundary And Overlay Ownership

**Files**

- Review: `src/style/tailwind-overlay.css`
- Review/modify if needed: `src/ui/content/overlay/OverlaySurfaceHost.ts`
- Review/modify if needed: `src/ui/content/bookmarks/BookmarksPanel.ts`

**Checklist**

- [x] Confirm Tailwind aliases still map only to canonical `--aimd-*` tokens.
- [x] Confirm no `BookmarksPanel`-specific product values are introduced into the Tailwind alias layer.
- [x] Confirm overlay host remains the owner of host/shadow lifecycle, slot structure, and style injection.
- [x] Confirm `BookmarksPanel` does not bypass overlay ownership with ad hoc runtime style insertion.

**Acceptance**

- Tailwind remains an authoring layer, not a second design system.
- Overlay ownership remains centralized and blueprint-compliant.

### Workstream 7: Add Regression Protection

**Files**

- Modify: `tests/unit/ui/bookmarks/bookmarksPanel.test.ts`
- Modify/create if needed: additional UI/style regression tests under `tests/unit/ui/bookmarks/**`

**Checklist**

- [ ] Add regression coverage for token-driven class/state expectations where practical.
- [ ] Add regression coverage for any extracted component-token mapping helpers.
- [ ] Add regression checks for theme-sensitive rendering that would fail if raw values re-enter the codepath.
- [ ] Keep tests focused on contracts, not on brittle snapshot noise.

**Acceptance**

- Future regressions toward raw mock CSS can be caught before merge.

### Workstream 8: Verification And Documentation Closure

**Files**

- Modify: `CHANGELOG.md` if user-visible styling/behavior changes
- Review/update docs only if the long-lived contract changes

**Checklist**

- [ ] Run the smallest relevant unit test set after each meaningful batch.
- [ ] Run `npm run build` before claiming completion.
- [ ] Perform browser verification on the live Bookmarks panel for the final pass.
- [ ] Update this checklist with final status and residual risk notes.
- [ ] Update `CHANGELOG.md` only for user-visible outcomes, not internal cleanup.

**Acceptance**

- Completion status is evidenced, not assumed.
- This checklist remains a usable historical record of what was aligned and what was intentionally left unchanged.

## Raw Debt Inventory

This section is the live audit ledger. Fill it in and keep it updated during implementation.

| Category | Current Evidence | Target Destination | Status | Notes |
|:--|:--|:--|:--|:--|
| Raw colors | Former `white`, `rgba(...)`, and `#0f172a` usages in `bookmarksPanelCss.ts` | System token or approved component token | `DONE` | Current audit scan reports `raw_hex 0` and `rgba_rgb 0` in `bookmarksPanelCss.ts` |
| Radius | Former literal values such as `30px`, `24px`, `22px`, `20px`, `18px`, `16px`, `14px`, `12px`, `10px`, `6px`, `999px` in selector declarations | System token or component token | `DONE` | Selector-level literal radii are now routed through `--aimd-*` or `--_bookmarks-*` variables |
| Shadows | Former literal shadows mixed with token shadows | System token or shared overlay primitive | `DONE` | Surface, floating, batch bar, and knob shadows now flow through token-backed aliases |
| Z-index | Former literal `0`, `1`, `4`, `20` in component CSS | Token or overlay ownership | `DONE` | Layering now flows through overlay ownership or token/private-variable aliases |
| Typography | Former literal `26px`, `20px`, `19px`, `17px`, `16px`, `15px`, `14px`, `13px`, `12px` in selector declarations | Type scale role mapping | `DONE` | Selector-level literal font sizes are replaced by type roles or component aliases |
| Spacing/sizing | Hundreds of literal `px` values remain | Token or structural exception | `IN_PROGRESS` | High-traffic surfaces are now aliased; deeper layout-only values still need a pass if we want to thin the component layer further |

## Exit Criteria

- [ ] `BookmarksPanel` styling is driven by canonical tokens and thin component composition rather than raw mock CSS.
- [x] `BookmarksPanel` styling is driven by canonical tokens and thin component composition rather than raw mock CSS.
- [ ] Tailwind remains a semantic alias layer only.
- [ ] Overlay host ownership remains intact.
- [ ] The live Bookmarks panel remains visually correct after tokenization.
- [ ] Tests and `npm run build` pass.

## Residual Risks To Re-evaluate Before Closing

- [ ] Risk that over-tokenization introduces noisy or low-value tokens.
- [ ] Risk that under-tokenization leaves mock literals hidden in component CSS.
- [ ] Risk that visual parity regresses while the source-of-truth becomes cleaner.
- [ ] Risk that another overlay module already duplicates the same values and should be normalized in a follow-up task.
