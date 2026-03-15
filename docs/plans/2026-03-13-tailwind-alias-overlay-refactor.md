# Tailwind Alias Overlay Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish the overlay-only Tailwind alias architecture, mock-first browser validation flow, and the runtime foundations needed to migrate UI modules without changing non-UI layers.

**Architecture:** Keep `--aimd-*` as the only canonical token source. Add a thin Tailwind semantic alias layer for overlay-style singleton UI only, introduce shared UI runtime foundations such as `ShadowStyleRegistry` and `OverlayHost`, and migrate modules through a mock-first browser-validated workflow before merging them into the extension runtime.

**Tech Stack:** TypeScript, Vite, Shadow DOM, existing `src/style/**` token system, browser extension content runtime, Tailwind authoring for overlay UI only, Playwright/manual browser validation for mock pages.

---

### Task 1: Lock the canonical style foundations

**Files:**
- Modify: `src/style/tokens.ts`
- Modify: `src/style/shadow.ts`
- Review: `docs/style/STYLE_SYSTEM.md`
- Review: `docs/style/STYLE_ARCHITECTURE.md`

**Step 1: Add a shadow style registry design**

Define a single runtime strategy for style distribution:

- Chromium path: prefer shared constructable stylesheet or equivalent registry-backed reuse
- Firefox path: safe fallback to per-root `<style>` injection
- Keep the API UI-layer-only and opaque to components

**Step 2: Freeze the theme update contract**

Ensure the design only requires token value changes on theme switch:

- no Tailwind class rewrites for theme changes
- no site-specific theme logic leaking into components
- all future overlay styling must still resolve through `--aimd-*`

**Step 3: Verify no non-UI layers need changes**

Before implementation, confirm the plan stays inside:

- `src/ui/**`
- `src/style/**`

Do not expand into `src/drivers/**`, `src/services/**`, `src/contracts/**`, `src/core/**`, or `src/runtimes/**`.

**Step 4: Validation**

Run:

```bash
npm run build
```

Expected:

- build remains green after foundation-only UI/style refactor work

---

### Task 2: Introduce the Tailwind alias mapping for overlay UI

**Files:**
- Create/modify: overlay Tailwind config entry near the UI/style foundation
- Modify: the overlay style entry that will consume Tailwind aliases
- Review: `docs/adr/ADR-0005-tailwind-alias-overlay-boundary.md`

**Step 1: Define the semantic alias vocabulary**

Create only semantic aliases that map back to `--aimd-*`, covering:

- surface
- text
- border
- interactive
- state
- elevation
- space
- radius
- motion
- z

Do not introduce component-first aliases such as `panel-*`, `dialog-*`, or `toolbar-*`.

**Step 2: Apply Tailwind hard constraints**

Configure Tailwind for overlay-only use:

- `prefix(tw)`
- Preflight disabled
- no standalone product values
- aliases resolve through canonical tokens only

**Step 3: Validate the alias layer in isolation**

Create a minimal overlay mock that proves:

- utilities resolve from `--aimd-*`
- light/dark theme switching updates visuals without utility changes
- Tailwind output stays scoped to the overlay mock path

**Step 4: Validation**

Run:

```bash
npm run build
```

Expected:

- Tailwind alias output integrates without changing runtime bundle assumptions

---

### Task 3: Build the mock-first harness for overlay modules

**Files:**
- Create: `mocks/components/overlay-host/index.html`
- Create: `mocks/components/<module>/index.html` for the first migrated module
- Review: `docs/testing/TESTING_BLUEPRINT.md`
- Review: `docs/testing/CURRENT_TEST_GATES.md`

**Step 1: Create a real mounted mock harness**

Each mock must:

- mount real UI code, not static lookalikes
- use real token injection
- use real Shadow DOM
- support at least two simultaneous instances when the module type requires it

**Step 2: Add visual validation hooks**

The mock page must make it easy to inspect:

- light/dark
- hover/focus/active/open/disabled
- overflow and scroll
- layering
- live `shadowRoot` style nodes

**Step 3: Run browser visual review before extension integration**

For every new or migrated UI module:

- open the mock page in a browser
- capture screenshots/snapshots
- iterate visually until approved
- only then start merging into `src/ui/**`

**Step 4: Validation**

Record visual evidence and note:

- exact mock path used
- states reviewed
- whether the inspected root was live `shadowRoot`

---

### Task 4: Introduce the OverlayHost runtime boundary

**Files:**
- Create/modify: `src/ui/content/overlay/*`
- Modify: existing overlay-style module entry points such as bookmarks, reader, send, or source UI
- Review: `src/runtimes/content/entry.ts`

**Step 1: Define a single overlay runtime boundary**

Add an overlay host abstraction that:

- owns the singleton overlay `ShadowRoot`
- centralizes overlay-level style injection
- keeps module state local to UI
- exposes mounting points for panel/popover/dialog-style modules

**Step 2: Keep module behavior unchanged**

Refactor presentation structure only:

- preserve controller/service/runtime contracts
- keep current feature behavior stable
- avoid rewiring adapters or protocol boundaries

**Step 3: Validate with a mock-first module**

Choose the first overlay module and migrate it using the full workflow:

1. mock
2. browser iteration
3. overlay host integration
4. runtime verification

**Step 4: Validation**

Run:

```bash
npm run build
```

And perform browser verification on both extension runtime and mock page.

---

### Task 5: Keep MessageToolbar lightweight and Tailwind-free

**Files:**
- Modify: `src/ui/content/MessageToolbar.ts`
- Modify: `src/ui/content/controllers/MessageToolbarOrchestrator.ts`
- Review: `docs/adr/ADR-0005-tailwind-alias-overlay-boundary.md`

**Step 1: Preserve the toolbar boundary**

Do not migrate toolbar styling to Tailwind.

Instead:

- move it toward shared style distribution
- reduce repeated style text where possible
- preserve lightweight per-message rendering

**Step 2: Keep toolbar responsibilities narrow**

Toolbar should remain:

- intent dispatch
- lightweight status
- minimal secondary menu

Do not move rich forms or long-lived state into toolbar instances.

**Step 3: Validate high-density rendering**

Use the toolbar mock page to verify:

- many-instance rendering
- spacing and density
- theme updates
- style-node correctness
- no regressions in action behavior

**Step 4: Validation**

Run:

```bash
npm run build
```

And verify multi-message runtime injection behavior manually.

---

### Task 6: Migrate overlay modules one by one

**Files:**
- Modify: `src/ui/content/bookmarks/**`
- Modify: `src/ui/content/reader/**`
- Modify: `src/ui/content/sending/**`
- Modify: `src/ui/content/source/**`

**Step 1: Choose migration order**

Use this fixed order unless a blocker is discovered:

1. Bookmarks panel
2. Reader panel
3. Send popover/modal
4. Source panel and remaining overlay-style dialogs

**Step 2: Use the same workflow for every module**

For each module:

1. build or update mock page
2. do browser visual review
3. iterate until approved
4. merge into overlay runtime
5. run runtime verification
6. rerun build

**Step 3: Preserve UI-only scope**

If any desired visual change requires service/controller/runtime changes:

- stop
- document the blocker
- revise the plan rather than crossing layers

---

### Task 7: Final verification and regression closure

**Files:**
- Review: `docs/testing/CURRENT_TEST_GATES.md`
- Review: `docs/testing/E2E_REGRESSION_GUIDE.md`

**Step 1: Run automated verification**

Run:

```bash
npm run test:smoke
npm run build
```

If the refactor becomes broad or high risk, also run:

```bash
npm run test:core
```

**Step 2: Run required browser regression**

Verify:

- mock pages for migrated modules
- extension runtime overlay behavior
- toolbar injection under high message counts
- theme switching
- layering/focus/scroll behavior
- Chrome MV3 and Firefox MV2 compatibility expectations

**Step 3: Close with explicit evidence**

Document:

- commands run
- mock pages reviewed
- screenshots/snapshots captured
- remaining edge cases and follow-up work
