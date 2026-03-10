# Bookmarks Panel Figma UI Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Bookmarks panel UI to match the approved Figma light-theme design while preserving the current information architecture and all existing interaction chains.

**Architecture:** This refactor is strictly UI-layer only. All work must stay inside `src/ui/**` and, only if necessary for stable visual reuse, `src/style/**`. No changes are allowed in `src/services/**`, `src/drivers/**`, `src/contracts/**`, `src/core/**`, or `src/runtimes/**`. The Bookmarks panel becomes the first concrete sample of a shared "panel design baseline" that later panels can adopt without changing their behavior.

**Tech Stack:** TypeScript, Shadow DOM UI components, project token system in `src/style/**`, existing dialog host utilities, existing controller/service/runtime contracts.

---

## Non-Negotiable Constraints

- The Figma-selected Bookmarks panel is the only visual truth for this phase.
- Information architecture stays unchanged:
  - keep `Bookmarks / Settings / Sponsor`
  - keep the current controller/service/runtime wiring
  - keep the current feature set and interaction chain
- This phase targets the light theme only.
- Dark theme must remain functional but is not part of pixel-accurate parity in this phase.
- Prefer changing style and presentation behavior over changing structure.
- Low-frequency actions may be visually de-emphasized or grouped, but must remain reachable.
- No new cross-layer dependencies.

## Approved Design Decisions

- Use the "middle route": define a reusable panel visual baseline, then land it first in the Bookmarks panel.
- Preserve the current information architecture.
- Preserve current functionality and interaction chain.
- Reduce visible clutter in the Bookmarks toolbar:
  - high-frequency actions stay directly visible
  - low-frequency actions may be visually reduced or moved into secondary presentation within the UI layer
- Status handling should become more system-like:
  - left side shows panel state
  - right side shows counts / summary

## Reference Inputs

- Figma-selected Bookmarks panel screenshot: approved visual truth
- External interaction references:
  - Linear settings-page shell language
  - Raycast dense list / search interaction model
  - Ariakit dialog interaction constraints

## Expected Files To Modify

**Primary UI files**
- Modify: `src/ui/content/bookmarks/BookmarksPanel.ts`
- Modify: `src/ui/content/bookmarks/ui/BookmarksPanelShell.ts`
- Modify: `src/ui/content/bookmarks/ui/tabs/BookmarksTabView.ts`
- Modify: `src/ui/content/bookmarks/ui/components/PlatformDropdown.ts`
- Modify: `src/ui/content/components/Tabs.ts`
- Modify: `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`

**Possible shared UI/style support**
- Modify if needed: `src/style/tokens.ts`

**Must not modify**
- Do not modify: `src/services/**`
- Do not modify: `src/drivers/**`
- Do not modify: `src/contracts/**`
- Do not modify: `src/core/**`
- Do not modify: `src/runtimes/**`

## Task 1: Freeze The UI-Only Boundary In Writing

**Files:**
- Modify: `docs/plans/2026-03-08-bookmarks-panel-figma-ui-refactor.md`

**Step 1: Record the refactor boundary**

Write the final boundary section in this plan:
- UI-only
- light theme only
- no IA change
- no behavior-chain change

**Step 2: Re-read the boundary against source-of-truth docs**

Check:
- `docs/architecture/BLUEPRINT.md`
- `docs/architecture/DEPENDENCY_RULES.md`
- `docs/FEATURES.md`
- `docs/style/STYLE_ARCHITECTURE.md`

Expected: every planned file change stays in UI/style only.

**Step 3: Commit the plan-only checkpoint**

```bash
git add docs/plans/2026-03-08-bookmarks-panel-figma-ui-refactor.md
git commit -m "docs: add bookmarks panel figma ui refactor plan"
```

## Task 2: Define The Shared Panel Visual Baseline

**Files:**
- Modify: `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`
- Modify if needed: `src/style/tokens.ts`

**Step 1: Inventory all panel primitives already in use**

Read and list current panel primitives from:
- `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`
- `src/ui/content/reader/ReaderPanel.ts`
- `src/ui/content/source/SourcePanel.ts`
- `src/ui/content/sending/SendModal.ts`
- `src/ui/content/export/saveMessagesDialogCss.ts`

Expected output: one normalized list of panel primitives:
- overlay
- panel container
- header
- nav item
- toolbar control
- list row
- icon button
- footer status bar

**Step 2: Define the Figma-light baseline values**

Convert the approved visual truth into explicit UI rules:
- panel background
- border weight
- corner radius
- shadow strength
- header height
- sidebar width
- nav selected style
- search height
- control density
- row height
- footer height

Expected: no hardcoded random values added without naming rationale.

**Step 3: Add only the minimum tokens/aliases needed**

If current tokens are insufficient, add only stable visual aliases needed for reuse.

Do not:
- add platform-specific tokens
- add service-driven state tokens
- add panel-specific values into non-UI layers

**Step 4: Keep dark theme untouched beyond compatibility**

If token additions affect dark theme resolution, map them conservatively without pursuing parity.

**Step 5: Commit**

```bash
git add src/style/tokens.ts src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts
git commit -m "feat: define light panel baseline for figma ui refactor"
```

## Task 3: Rebuild The Bookmarks Panel Shell To Match Figma

**Files:**
- Modify: `src/ui/content/bookmarks/BookmarksPanel.ts`
- Modify: `src/ui/content/bookmarks/ui/BookmarksPanelShell.ts`
- Modify: `src/ui/content/components/Tabs.ts`
- Modify: `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`

**Step 1: Preserve shell responsibilities**

Before any DOM changes, confirm these responsibilities remain unchanged:
- `BookmarksPanel` mounts/unmounts the dialog host
- shell owns title / close / tabs layout
- tabs still drive the three existing content panes

**Step 2: Refactor shell markup to Figma layout**

Implement the visual shell:
- lighter title bar
- fixed product-style title treatment
- narrower left navigation rail
- cleaner content split
- footer pinned as a lightweight status bar

Do not change:
- tab ids
- tab content ownership
- close behavior
- keyboard scope behavior

**Step 3: Refactor tab button presentation**

In `Tabs.ts`, keep the tab contract intact while changing presentation to a panel-nav style:
- lighter inactive rows
- soft blue selected state
- smaller visual weight
- same click and keyboard behavior

**Step 4: Render footer like the approved design**

Keep the same data sources, but restyle and normalize presentation:
- left = status
- right = count / summary

**Step 5: Commit**

```bash
git add src/ui/content/bookmarks/BookmarksPanel.ts src/ui/content/bookmarks/ui/BookmarksPanelShell.ts src/ui/content/components/Tabs.ts src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts
git commit -m "feat: restyle bookmarks panel shell to figma baseline"
```

## Task 4: Rebuild The Bookmarks Toolbar Without Changing Behavior

**Files:**
- Modify: `src/ui/content/bookmarks/ui/tabs/BookmarksTabView.ts`
- Modify: `src/ui/content/bookmarks/ui/components/PlatformDropdown.ts`
- Modify: `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`

**Step 1: Split actions into primary vs secondary visual priority**

Classify current toolbar actions:
- high-frequency direct actions remain visible
- low-frequency actions remain reachable but visually de-emphasized

This is a presentation-only change.

**Step 2: Match the Figma toolbar silhouette**

Update the toolbar layout to align with the approved visual truth:
- long light search field
- compact platform filter
- lighter inline action icons
- less pill grouping

**Step 3: Keep action wiring untouched**

Do not change any controller callsites or event semantics:
- search input still calls `setQuery`
- platform still calls `setPlatform`
- sort buttons still toggle the same sort modes
- import/export/repair/refresh keep the same controller behavior

**Step 4: Commit**

```bash
git add src/ui/content/bookmarks/ui/tabs/BookmarksTabView.ts src/ui/content/bookmarks/ui/components/PlatformDropdown.ts src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts
git commit -m "feat: restyle bookmarks toolbar to figma light design"
```

## Task 5: Rebuild The Tree/List Presentation

**Files:**
- Modify: `src/ui/content/bookmarks/ui/tabs/BookmarksTabView.ts`
- Modify: `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`

**Step 1: Preserve data semantics**

Confirm the following stay unchanged:
- folder expansion logic
- selection logic
- preview logic
- row action wiring
- batch-selection behavior

**Step 2: Reduce visual density to the approved style**

Apply the Figma-like list treatment:
- lighter rows
- tighter spacing
- calmer subtitles
- more restrained hover
- softer selected state
- less visually heavy action affordances

**Step 3: Keep low-frequency actions discoverable**

Row actions may stay hover/focus-revealed, but must remain keyboard-reachable and visible on focus.

**Step 4: Keep batch bar behavior but restyle it**

Preserve the current batch-selection workflow while making the bar visually consistent with the new system.

**Step 5: Commit**

```bash
git add src/ui/content/bookmarks/ui/tabs/BookmarksTabView.ts src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts
git commit -m "feat: restyle bookmarks tree rows and batch bar"
```

## Task 6: Define The Missing States From The Static Truth

**Files:**
- Modify: `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`
- Modify if needed: `docs/DEVLOG.md`

**Step 1: Implement the inferred state system**

Add UI-only state styling for:
- hover
- active
- selected
- focus-visible
- disabled
- empty
- loading
- toolbar secondary actions
- dropdown open

All states must be visually derived from the approved Figma frame, not a second design language.

**Step 2: Validate states against external references**

Use the chosen references only to correct interaction quality:
- Linear for shell calmness
- Raycast for dense list behavior
- Ariakit for dialog behavior and focus integrity

**Step 3: Log any intentional deviations**

If any state cannot be inferred exactly from the static truth, record the rationale in `docs/DEVLOG.md`.

**Step 4: Commit**

```bash
git add src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts docs/DEVLOG.md
git commit -m "feat: add inferred interaction states for bookmarks panel"
```

## Task 7: Verify That Behavior Has Not Drifted

**Files:**
- No production behavior files outside UI should change

**Step 1: Run type check**

Run: `npm run type-check`
Expected: PASS

**Step 2: Run core regression gate**

Run: `npm run test:core`
Expected: PASS

**Step 3: Run full build**

Run: `npm run build`
Expected: PASS for Chrome and Firefox

**Step 4: Manual Bookmarks panel checks**

Verify:
- panel opens/closes normally
- `Bookmarks / Settings / Sponsor` tabs still switch correctly
- search still filters
- platform filter still works
- sort controls still work
- folder expand/collapse still works
- row preview still opens Reader
- Go / Copy / Delete row actions still work
- batch bar still appears when selection exists
- import/export/repair/refresh still fire
- footer status still updates

**Step 5: Confirm boundary integrity**

Run:

```bash
git diff --name-only
```

Expected: only UI/style/docs plan files changed.

**Step 6: Commit**

```bash
git add src/ui/content/bookmarks/ src/ui/content/components/Tabs.ts src/style/tokens.ts docs/DEVLOG.md
git commit -m "feat: refactor bookmarks panel ui to figma light style"
```

## Task 8: Prepare The Cross-Panel Migration Baseline

**Files:**
- Modify: `docs/plans/2026-03-08-bookmarks-panel-figma-ui-refactor.md`

**Step 1: Capture reusable panel primitives**

After Bookmarks is stable, record the reusable visual primitives for:
- ReaderPanel
- SourcePanel
- SendModal
- SaveMessagesDialog

**Step 2: Record what is shared vs panel-specific**

Shared:
- shell
- header
- close button treatment
- status footer
- action button styling
- overlay / motion / focus model

Panel-specific:
- left navigation
- tree rows
- search toolbar
- content-body layouts

**Step 3: Define next migration order**

Recommended order:
1. `ReaderPanel`
2. `SourcePanel`
3. `SaveMessagesDialog`
4. `SendModal`

Reason:
- closest shell reuse first
- smaller UI surfaces second
- compositional dialogs last

---

## Implementation Notes

- The highest-risk file is `src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts`; keep changes deliberate and grouped.
- Prefer presentation refactors over controller refactors.
- If a desired visual change requires service/controller/runtime changes, stop and revise the plan instead of crossing the boundary.
- Avoid broad token churn; add only what is needed to support repeatable panel styling.
- If a low-frequency action needs visual reduction, do it through hierarchy and grouping, not feature removal.

## Done Criteria

- Bookmarks panel visually matches the approved Figma light design at a high-confidence level.
- Information architecture remains unchanged.
- Existing interaction chain remains unchanged.
- Only UI/style files changed.
- Type check, core tests, and build all pass.
- The resulting panel style can be reused for later panel migrations.
