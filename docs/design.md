# AI-MarkDone Design Reference

This document is the single source of truth for AI-MarkDone product UI design, style-system rules, and visual governance. It replaces the previous split style and token references.

Runtime token values live in `src/style/reference-tokens.ts`, `src/style/system-tokens.ts`, and `src/style/public-tokens.ts`; `src/style/tokens.ts` composes those layers for callers. This document defines what those values mean, how they may be used, and how future UI work should be judged.

## 1. Product Feel

AI-MarkDone is a browser-extension work surface for reading, bookmarking, exporting, and navigating LLM conversations. The interface should feel quiet, precise, and dependable inside third-party pages.

The product should avoid decorative weight. It should make long-form reading and repeated operational actions feel stable, clear, and low-interruption.

## 2. Design Principles

### 2.1 Stability Before Decoration

- Third-party pages remain the host environment; AI-MarkDone UI must not visually fight the host page.
- Shadow DOM surfaces must render reliably before richer styling is added.
- Motion, color, and elevation are functional signals, not decoration.

### 2.2 Tokens Before Values

- Shipped UI must use `--aimd-*` tokens for color, spacing, radius, shadow, typography, z-index, and motion.
- Component CSS must not hardcode product colors, spacing scale values, radii, shadows, or z-index values.
- Raw values are allowed only in token source files, geometry math, external adapter boundaries, and test fixtures that assert token output.

### 2.3 One Visual Language

- Reader panel, bookmarks panel, settings, toolbar, dialogs, popovers, and hover portals share the same design language.
- Shared chrome primitives should own repeated panel, dialog, popover, button, input, row, and icon-button behavior.
- A caller should choose a semantic variant or surface profile, not pass low-level style flags.

### 2.4 Minimal Palette

- The system uses one brand accent, one neutral scale, and a small set of semantic state colors.
- A multi-color treatment is only allowed when it represents a specific product state. The current approved exception is the ChatGPT directory bookmark marker, exposed through `--aimd-bookmark-marker-gradient` plus the semantic `--aimd-shadow-bookmark-marker*` rings.
- New accent families require a product reason and design review.
- Avoid multi-accent decoration, one-off gradients, and page-themed palettes.

### 2.5 Shadow DOM First

- Page UI is isolated in Shadow DOM.
- Style injection must work in Chrome-like and Firefox-like extension environments.
- Every shared style path must have a root-scoped fallback when constructable stylesheets are unavailable or partially implemented.

### 2.6 Mock-First Validation

- New or materially changed UI modules need a mock-first visual surface before runtime integration when practical.
- Mock pages should use the real components, real token injection, and real Shadow DOM.
- Validate light/dark themes, dense and empty states, long text, overflow, focus, hover, keyboard paths, and two independent instances.

## 3. UI Surface Architecture

A Surface is a user-visible work area with one entry, one lifecycle owner, one DOM scope, and one responsive contract. A Surface family owns repeated product semantics. Shared chrome owns presentation and interaction mechanics, but never feature data, settings persistence, platform selectors, or host geometry.

The named Surface profiles are:

| Profile | Intended use | Lifecycle expectation |
|:--|:--|:--|
| `panel` | Persistent Reader or Bookmarks workspace | Own header/body/footer, one scroll owner, resize/fullscreen rules, focus entry, and deterministic teardown |
| `modal` | Focused decision or blocking task | Own backdrop, focus containment and return, Escape policy, scroll lock, and close motion |
| `anchored` | Contextual popover, preview, suggestion list, or hover action | Own anchor measurement, flip/clamp, visual-viewport collision, outside-click/Escape policy, and anchor-loss fallback |
| `inline` | Compact controls integrated into a host layout | Preserve host geometry and interaction; no global focus trap or page scroll ownership |

Extension documents such as the unsupported-page popup are documented exceptions. They use the same public visual tokens but own their document lifecycle instead of a Surface session.

### 3.1 Complete Surface Catalog

The catalog is normative for visual and interaction ownership. Appearance means theme plus approved global overrides. Locale means both initial translation and live locale refresh where the runtime supports it. The evidence column names the tracked real-module fixture; “family coverage” means the fixture opens the production child Surface through its owning family rather than redrawing it. `tests/support/uiSurfaceCoverage.ts` is the executable mirror of that distinction.

| Surface / user entry | Owner / DOM scope / profile | Appearance | Locale | Focus, dismissal, motion | Overflow and responsive contract | Visual evidence owner |
|:--|:--|:--|:--|:--|:--|:--|
| Per-message toolbar; appears in the official message action row | Message Toolbar family; ShadowRoot; `inline` | Shared snapshot; toolbar family tokens | Live refresh required | Roving/normal button focus; host removal destroys; compact feedback only | Must not move or wrap the host action row; controls retain stable hit targets during hydration and viewport resize | `mocks/components/host-integrated-controls` |
| Toolbar hover action and task progress; opened from a toolbar action | Message Toolbar family; page portal/ShadowRoot; `anchored` | Same snapshot as owning toolbar | Live refresh required | Hover/focus bridge; hover action closes on the established outside-pointer/resize/scroll boundary; task progress owns cancellation | Flip/clamp to visual viewport; progress content must not resize the toolbar | `mocks/components/host-integrated-controls` (family coverage) |
| Lower-right page-control cluster; fixed ChatGPT page entry | Page Controls family; documented light-DOM host; `inline` | Page appearance scope | Live refresh required | Button focus; no focus trap; each transient child owns dismissal | No wrapping; at `<=560px` use compact icon-only controls with tooltip and `aria-label`; never obscure the composer | `mocks/components/host-integrated-controls` (family coverage) |
| ChatGPT directory rail and prompt preview; page navigation entry | Directory family; rail ShadowRoot plus contextual preview; `inline` + `anchored` | Shared snapshot | Live refresh required | Rail buttons remain keyboard reachable; preview closes on anchor loss/Escape/outside click | Close preview first, then compact the rail; if usable conversation width still cannot be preserved, hide the rail for that viewport without changing the saved setting | `mocks/components/host-integrated-controls` (family coverage) |
| Input Enhancement control center and syntax guide; plus-adjacent composer button | Composer family; button ShadowRoot, page portal, shared modal host; `anchored` + `modal` | Shared snapshot | Live refresh required | Popover restores focus to trigger; Escape/outside click close; guide uses modal focus lifecycle; reduced motion | Portal avoids composer clipping; clamp to visual viewport and collapse to one readable column on narrow screens | `mocks/components/input-enhancement` |
| Formula composer assistant; active formula caret | Composer family; ShadowRoot portal; `anchored` | Shared snapshot | Live refresh required | Keyboard selection precedes composer Enter handling; Escape closes without changing source | Follow caret when measurable, otherwise anchor to composer; preview/suggestion areas own internal max height | `mocks/components/formula-composer-assistant` |
| Prompt autocomplete suggestion list; `\` token in a supported composer | Prompt family; page portal; `anchored` | Shared snapshot | Live refresh required | Arrow/Enter/Tab/Escape contract; selection returns focus/caret; anchor loss closes | Caret anchored with composer fallback; no viewport overflow or overlap with the input’s critical controls | `mocks/components/prompt-family` |
| Prompt manager; page controls, Settings, Reader, or detached Reader entry | Prompt family; draggable ShadowRoot portal; `anchored` | Shared snapshot | Live refresh required | Dialog-like initial focus and Escape; outside-click policy is explicit; drag and item reorder remain isolated | Clamp after drag and viewport changes; body is the only scroll owner; footer remains reachable at short heights | `mocks/components/prompt-family` (family coverage) |
| Formula asset hover actions and formula settings; formula hover/settings entry | Formula Asset family; page portal/ShadowRoot; `anchored` | Shared snapshot | Live refresh required | Hover actions use the established outside-pointer/resize/scroll bridge; settings owns its dialog Escape policy; action-pending states | Clamp to viewport; settings owns internal scrolling; never cover the source formula when an alternate side is available | `mocks/components/formula-asset-actions` |
| In-page Reader; per-message toolbar, bookmark preview, or workflow entry | Reader family; overlay ShadowRoot; `panel` | Shared snapshot plus Reader-scoped content state | Live refresh required | Focus entry/return, Escape policy, resize lifecycle, deterministic scroll-lock cleanup | Header/footer remain stable and body owns scroll; at `<=900px` auxiliary rails overlay or hide, at `<=560px` use one column; sticky content stays inside viewport | `mocks/components/reader-panel` and `mocks/components/reader-comments` |
| Detached Reader extension page; lower-right Split View entry | Reader family; extension page plus Reader ShadowRoot; `panel` | Session snapshot plus Reader-scoped content state | Live refresh required | Same Reader focus/navigation contract; page close owns teardown | Full viewport by default; use the same short-height and narrow-width rules as in-page Reader | `mocks/components/reader-panel` (family coverage) |
| Reader settings, comments, comment list/export, template editor, Prompt picker, and Send popover; Reader header/body actions | Reader family; modal or ShadowRoot portal; `modal` / `anchored` | Same snapshot as Reader | Live refresh required | Named modal/anchored lifecycle; focus returns to originating Reader control; close never mutates content implicitly | One internal body scroll owner; header/footer/actions remain reachable at `320px` width and `568px` height | `mocks/components/reader-comments` plus Reader panel transient states |
| Bookmarks workspace, tree, preview, and primary tabs; extension action or page-control entry | Bookmarks family; overlay ShadowRoot; `panel` | Shared snapshot | Live refresh required | Focus entry/return, Escape policy, stable selection and inline editing focus | Workspace owns scrolling; `980/720/560px` profiles progressively reduce columns and chrome. Phone toolbars wrap from the leading edge, bookmark metadata stacks without collision, and selected/focused rows expose actions in their own row instead of overlaying content | `mocks/components/bookmarks-workspace` |
| Settings, data management, Cloud Backup, formula settings, and information tabs; Bookmarks tab entry | Bookmarks/Settings family; panel body plus local anchored surfaces | Shared snapshot; settings values do not style controls directly | Live refresh required | Form focus order, pending/disabled/error states; local popovers return focus | Labels/help text keep intrinsic height; panel body scrolls; at narrow widths rows stack and destructive actions remain separated | `mocks/components/bookmarks-workspace` (family coverage) |
| Bookmark Save dialog; toolbar/page bookmark action | Save family; shared overlay ShadowRoot; `modal` | Shared snapshot | Live refresh required | Initial field focus, Escape/cancel, pending lock, focus return | Dialog body scrolls when needed; actions remain visible at narrow width/short height | `mocks/components/workflow-dialogs` |
| Save Messages dialog; toolbar action | Export/Save family; shared overlay ShadowRoot; `modal` | Shared snapshot | Live refresh required | Selection keyboard flow, Escape/cancel, pending/progress/error, focus return | Selection body owns scroll; footer remains visible; long titles truncate without hiding selection state | `mocks/components/workflow-dialogs` |
| Send popover; Reader or detached Reader send action | Sending family; anchored ShadowRoot | Shared snapshot | Live refresh required | Draft focus, pending send blocks duplicates, focus returns | Text area and body share one declared scroll strategy; actions remain reachable under virtual keyboard/short viewport | `mocks/components/workflow-dialogs` |
| Shared notices, confirm/prompt dialogs, changelog notice, and import review; workflow-owned trigger | Overlay family; shared ShadowRoot; `modal` | Shared snapshot | Live refresh required | Modal focus containment/return, Escape policy, backdrop, scroll lock, reduced motion | Centered with viewport gutters; body becomes the sole scroll owner; no dialog may exceed the visual viewport | `mocks/components/overlay-host` |
| Tooltip and toast feedback; control hover/focus or operation result | Feedback family; page feedback layer or owning ShadowRoot preview | Shared snapshot | Live refresh required | Tooltip follows hover/focus and is non-interactive unless declared; toast never captures focus | Clamp to viewport; tooltip must not be clipped by host controls; toast must not block page interaction | `mocks/components/host-integrated-controls` (family coverage) |
| Unsupported-page popup; extension toolbar icon on an unsupported page | Popup document; extension document exception | Minimal public-token fallback | Locale at document load | Normal document focus; no overlay lifecycle | Remains usable at `320px`; content wraps without horizontal overflow | `mocks/components/unsupported-popup` |

Hidden export-renderer and formula-renderer documents are rendering infrastructure, not product Surfaces. Their visual output contracts belong to export testing and must not be changed as part of UI chrome convergence.

### 3.2 Catalog Governance

- Every new user-visible Surface must enter this catalog in the same change that introduces it.
- One Surface has one lifecycle owner. Feature controllers may supply data and callbacks, but must not independently recreate theme, locale, focus, dismissal, motion, or viewport logic.
- A real user-facing trigger test is required for every modal, popover, overlay, panel, and shared primitive regression path.
- Visual evidence must instantiate the real Module, real token injection, and real Shadow DOM. Concept labs may explore alternatives but cannot satisfy a Surface’s required evidence.
- The executable coverage manifest in `tests/support/uiSurfaceCoverage.ts` must mirror this catalog and remains test-only; this document is the semantic authority.

## 4. Color Tokens

The color system should be small enough to remember and broad enough to cover all shipped UI.

| Family | Token Intent | Rules |
|:--|:--|:--|
| Neutral canvas | Host-adjacent background and page overlay base | Use for full surfaces and panel bodies. Do not replace with tinted backgrounds. |
| Neutral surface | Cards, rows, controls, elevated surface body | Use subtle contrast between nested surfaces; avoid card-inside-card compositions. |
| Text | Primary, secondary, muted, inverse | Text color must come from semantic text tokens only. |
| Border | Subtle, default, strong | Borders express structure. Do not use color accents as borders unless the component is selected or in an error state. |
| Accent | Brand accent, hover, pressed, soft, on-accent | Use for primary actions, active navigation, focus highlights, and selected states. |
| State | Success, warning, danger, info if needed | State colors must map to user feedback or destructive/exceptional actions. |
| Bookmark marker | Rainbow saved-state marker | Only for compact ChatGPT directory markers that need to distinguish saved messages from active/hover states. Do not reuse as decoration. |
| Focus | Focus ring and focus shadow | Focus indicators must remain visible in light and dark themes. |
| Overlay | Scrim/backdrop and portal shadows | Must remain readable over third-party pages. |

Rules:

- Use one brand accent as the dominant non-neutral color.
- Prefer neutral structure plus accent state over colored containers.
- State colors must not become decorative accents.
- Do not introduce page-specific or host-specific color tokens.
- Do not use `--aimd-ref-*` tokens directly in component CSS.
- User-facing theme color is a constrained appearance setting: `appearance.accentColor` can only be selected from the approved swatch list, and `null` means the default brand blue.

### 4.1 Current Color Values

The tables below document the current runtime values. Source files remain executable truth, but any value change should update this section in the same change.

Core palette:

| Intent | Token | Light | Dark |
|:--|:--|:--|:--|
| Canvas / surface | `--aimd-ref-color-neutral-0` | `#FFFFFF` | `#1E1E1E` |
| Subtle surface | `--aimd-ref-color-neutral-50` | `#F6F7F9` | `#2D2D2D` |
| Tertiary text | `--aimd-text-tertiary` | Derived from secondary text at 72% | Derived from secondary text at 72% |
| Secondary text | `--aimd-ref-color-neutral-700` | `#374151` | `#D1D5DB` |
| Primary text | `--aimd-ref-color-neutral-900` | `#111827` | `#F3F4F6` |
| White / on-accent | `--aimd-ref-color-neutral-white` | `#ffffff` | `#ffffff` |
| Brand accent | `--aimd-ref-color-brand-600` | `#2563eb` | `#2563eb` |
| Brand hover | `--aimd-ref-color-brand-700` | `#1d4ed8` | `#1d4ed8` |

Approved user theme swatches:

| Swatch | Stored value | Rule |
|:--|:--|:--|
| Default blue | `null` / `#2563eb` preview | Product default; reset state stores `null`. |
| Emerald | `#059669` | Optional user accent. |
| Violet | `#7c3aed` | Optional user accent. |
| Rose | `#e11d48` | Optional user accent. |
| Amber | `#d97706` | Optional user accent. |

Alpha and interaction palette:

| Intent | Token | Light | Dark |
|:--|:--|:--|:--|
| Quiet interaction layer | `--aimd-sys-color-interactive-hover-layer` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.16)` |
| Subtle border | `--aimd-ref-color-neutral-alpha-08` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` |
| Default border / hover | `--aimd-ref-color-neutral-alpha-12` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.12)` |
| Strong border / hover | `--aimd-ref-color-neutral-alpha-16` | `rgba(0,0,0,0.16)` | `rgba(255,255,255,0.16)` |
| Pressed neutral | `--aimd-ref-color-neutral-alpha-18` | `rgba(0,0,0,0.18)` | `rgba(255,255,255,0.18)` |
| Brand soft | `--aimd-ref-color-brand-alpha-12` | `rgba(37, 99, 235, 0.12)` | `rgba(37, 99, 235, 0.18)` |
| Brand flash | `--aimd-ref-color-brand-alpha-28` | `rgba(37, 99, 235, 0.28)` | `rgba(37, 99, 235, 0.36)` |
| Focus / info border | `--aimd-ref-color-brand-alpha-35` | `rgba(37,99,235,0.35)` | `rgba(37,99,235,0.35)` |

State palette:

| Intent | Token | Light | Dark |
|:--|:--|:--|:--|
| Warning | `--aimd-sys-color-warning` | `#f59e0b` | `#fbbf24` |
| Danger | `--aimd-sys-color-danger` | `#ef4444` | `#ef4444` |
| Success border | `--aimd-ref-color-green-alpha-35` | `rgba(16,185,129,0.35)` | `rgba(16,185,129,0.35)` |
| Error border | `--aimd-ref-color-red-alpha-35` | `rgba(239,68,68,0.35)` | `rgba(239,68,68,0.35)` |

Overlay and shadow color values:

| Intent | Token | Light | Dark |
|:--|:--|:--|:--|
| Overlay | `--aimd-ref-color-black-alpha-35` | `rgba(0,0,0,0.35)` | `rgba(0,0,0,0.55)` |
| Floating shadow | `--aimd-ref-shadow-sm` | `0 4px 12px rgba(0,0,0,0.12)` | `0 6px 16px rgba(0,0,0,0.52)` |
| Panel shadow | `--aimd-ref-shadow-500` | `0 18px 50px rgba(0,0,0,0.25)` | `0 18px 50px rgba(0,0,0,0.55)` |

The current palette keeps the core neutral, brand, warning, danger, success/error border, focus, and overlay values. Platform-scoped color tokens are not part of the active system.

## 5. Typography Tokens

Typography supports scan-friendly extension UI and comfortable reading.

| Role | Usage | Rules |
|:--|:--|:--|
| UI label small | Icon buttons, chips, compact metadata | Short labels only; avoid wrapping inside fixed controls. |
| UI label medium | Buttons, tabs, segmented controls | Must align vertically with icon size and control height. |
| Body | Settings, dialogs, bookmarks metadata | Use for interface text and help copy. |
| Reading body | Reader panel conversation content | Preserve readability with stable measure and line height. |
| Title | Panel titles, dialog titles, section headings | Use restrained scale; avoid hero-sized type inside extension panels. |
| Mono | Code, markdown source, technical identifiers | Use only when the content itself is code or machine-readable. |

Rules:

- Use the inherited system font through tokens such as `--aimd-font-family-sans`.
- Do not declare component-local sans-serif stacks.
- Do not scale font size with viewport width.
- Letter spacing should remain `0` unless a component token explicitly defines otherwise.
- Long text must wrap or truncate by component contract, not by accidental overflow.
- User-facing global font size is an appearance setting, not a component prop: `appearance.fontSizePx` is limited to `12px`-`20px`, defaults to `16px`, changes by `1px` stepper controls only, and maps to `UserThemeOverrides.baseFontScale`.
- Reader-facing body font size is a Reader setting, not a global appearance override: `reader.bodyFontSizePx` is limited to the same readable range, defaults to `16px`, changes by `1px` stepper controls inside Reader, and maps only to Reader markdown content.
- Reader markdown typography follows a semantic scale from the Reader body size. Headings, code, lists, quotes, tables, math, comments, and prompt/source blocks derive from Reader body size through relative units and Reader tokens; they are not independently user-configurable levels.
- Reader shell chrome keeps using the global UI type tokens so changing Reader body size does not resize icon buttons, modal labels, Settings rows, or page controls.
- User-facing theme color is also an appearance setting: `appearance.accentColor` is selected through visual swatches only, never typed text, and maps to `UserThemeOverrides.accentColor`.

### 5.1 Reader Typography Contract

Reader is the product's long-form reading surface. It may expose one user-facing body-size control for comfort, but it must preserve a coherent hierarchy rather than exposing many unrelated type controls. This follows the same principle used by mature platform/design-system typography guidance: a readable body size anchors semantic text roles, and the rest of the scale moves with it.

Rules:

- Reader body size is stored as `reader.bodyFontSizePx` and emitted as a Reader-scoped custom property.
- Markdown headings continue to use proportional `em` sizing from the Reader body size.
- Inline code and code blocks use the mono family with proportional sizing from Reader body size.
- KaTeX formulas derive from the Reader body scale, but their assets have two scopes: selector/layout CSS stays inside the Reader Shadow DOM, while KaTeX `@font-face` rules are registered at the document layer so detached Reader pages do not depend on ChatGPT host-page fonts.
- Reader settings changes apply live to any open Reader surface after settings persistence succeeds.
- Reader content width remains a separate measure control; it does not imply font scaling.

### 5.2 Current Typography Values

| Intent | Token | Value |
|:--|:--|:--|
| Small label | `--aimd-ref-type-size-075` | `12px` |
| Medium label | `--aimd-ref-type-size-100` | `13px` |
| Body | `--aimd-ref-type-size-200` | `16px` |
| Title medium | `--aimd-ref-type-size-300` | `16px` |
| Title large | `--aimd-sys-type-title-large-size` | `18px` |
| Label line height | `--aimd-ref-type-line-100` | `1.25` |
| Body line height | `--aimd-ref-type-line-200` | `1.5` |
| Reading line height | `--aimd-ref-type-line-300` | `1.65` |
| Medium weight | `--aimd-ref-type-weight-500` | `500` |
| Semibold weight | `--aimd-ref-type-weight-600` | `600` |

## 6. Spacing, Shape, Elevation, Motion

### 6.1 Spacing

- Use semantic spacing tokens for gaps, padding, and component rhythm.
- Repeated UI should align to the shared spacing scale.
- One-off pixel values are allowed only for geometry, icon view boxes, hairline borders, and measured host-page offsets.

### 6.2 Shape

- Use shared radius tokens for panels, buttons, inputs, rows, cards, popovers, and dialogs.
- Large rounded shapes are reserved for clear product intent; ordinary extension UI should stay compact and restrained.
- Avoid nested rounded containers when a row, divider, or section rhythm is enough.

### 6.3 Elevation

- Elevation expresses layering: inline, panel, popover, dialog, overlay.
- Use shadow tokens; do not handcraft shadow stacks inside components.
- Z-index values must come from tokens or a documented layer contract.

### 6.4 Motion

- Motion should explain state changes, anchoring, or dismissal.
- Use motion tokens for duration and easing.
- Respect `prefers-reduced-motion`.
- Avoid motion on high-frequency toolbar actions unless it improves feedback without distracting from host content.

### 6.5 Current Layout Values

Spacing:

| Token | Value |
|:--|:--|
| `--aimd-ref-space-100` | `4px` |
| `--aimd-ref-space-200` | `8px` |
| `--aimd-ref-space-300` | `12px` |
| `--aimd-ref-space-400` | `16px` |
| `--aimd-sys-space-5` | `20px` |
| `--aimd-sys-space-6` | `24px` |

Shape:

| Token | Value |
|:--|:--|
| `--aimd-sys-shape-corner-xs` | `4px` |
| `--aimd-ref-radius-150` | `6px` |
| `--aimd-ref-radius-200` | `8px` |
| `--aimd-sys-shape-corner-xl` | `14px` |
| `--aimd-sys-shape-corner-2xl` | `18px` |
| `--aimd-ref-radius-full` | `999px` |

Core sizes and layers:

| Intent | Token | Value |
|:--|:--|:--|
| Small icon | `--aimd-ref-size-160` | `16px` |
| Toolbar icon control | `--aimd-ref-size-300` | `30px` |
| Panel icon control | `--aimd-ref-size-320` | `32px` |
| Action control | `--aimd-ref-size-360` | `36px` |
| Panel header | `--aimd-ref-size-720` | `72px` |
| Compact panel header | `--aimd-ref-size-640` | `64px` |
| Panel max width | `--aimd-ref-size-900` | `900px` |
| Wide panel max width | `--aimd-panel-wide-max-width` | `1180px` |
| Panel height | `--aimd-ref-size-fluid-viewport-82` | `82vh` |
| Base layer | `--aimd-ref-z-base` | `1` |
| Panel layer | `--aimd-ref-z-panel` | `9000` |
| Tooltip layer | `--aimd-ref-z-tooltip` | `10000` |
| Feedback layer | `--aimd-tooltip-z` / `--aimd-toast-z` | `var(--aimd-z-tooltip)` |

Motion:

| Intent | Token | Value |
|:--|:--|:--|
| Fast duration | `--aimd-ref-motion-duration-fast` | `150ms` |
| Enter/base duration | `--aimd-ref-motion-duration-enter` | `200ms` |
| Standard easing | `--aimd-ref-motion-easing-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Emphasis easing | `--aimd-sys-motion-easing-emphasis` | `cubic-bezier(0.16, 1, 0.3, 1)` |

## 7. Component Rules

### 7.1 Buttons

- Icon-only actions use shared icon-button primitives with accessible labels.
- Text buttons use shared action-button primitives.
- Primary, secondary, ghost, danger, and selected states must be semantic variants.
- Button hit targets must be stable; hover or loading states must not resize the button.

### 7.2 Icons

- Product icons come from `src/assets/icons.ts`.
- Icon exports use camelCase names ending in `Icon`.
- Icons should render with `currentColor` unless a semantic multi-color icon is explicitly approved.
- Do not duplicate inline SVG strings in components.
- Do not load icon assets from external CDNs or base64 data URLs.

### 7.3 Inputs, Toggles, Selects, Segmented Controls

- Form controls use shared form tokens for size, border, focus, and disabled state.
- Labels and help text belong to the form row contract.
- Form rows must preserve label and help-text intrinsic height in constrained panels; panel or dialog bodies own scrolling instead of compressing row content.
- Error copy should be close to the control and use semantic danger tokens.

### 7.4 Panels

- Panels own their header, body, footer, scroll, and resize behavior through surface profiles.
- Panel callers should not pass low-level chrome flags unless the profile does not yet exist and the exception is documented.
- Reader and bookmarks panels use the shared panel lifecycle/chrome contracts while preserving family-owned density and workflow differences.

### 7.5 Rows and Cards

- Rows are preferred for dense operational lists.
- Cards are reserved for repeated standalone items, modal content groups, or genuinely framed tools.
- Do not place UI cards inside other cards.

### 7.6 Reader Content

- Reader content must preserve raw user/model text semantics.
- Display formatting may live in display-only helpers but must not mutate stored data.
- Markdown, code, quote, and source blocks use reader content tokens rather than ad hoc styles.
- Diagram fences such as Mermaid remain source code blocks. The design system does not define a diagram renderer, fullscreen diagram viewer, or diagram-specific hover chrome.

### 7.7 Toolbar

- Toolbar styling is governed by `--aimd-toolbar-*` component tokens.
- Toolbar modules should stay light because they hydrate inside host conversation UI.
- Avoid external style frameworks in toolbar code paths.

### 7.8 Overlay, Dialog, Popover

- Overlay singleton owns global overlay layering, scrim, and dialog surfaces.
- Anchored popovers may keep a local boundary only when their positioning and dismissal contract is documented.
- Any overlay-like component must validate focus, escape, outside click, scroll lock, and Shadow DOM style injection.

### 7.9 Tooltip And Toast Feedback

- Tooltip explains controls and compact UI affordances. It must not be used for operation results.
- Toast reports short, non-blocking operation feedback such as copied, saved, failed, or rendering state.
- Tooltip and toast styling comes only from feedback tokens: `--aimd-tooltip-*` and `--aimd-toast-*`.
- Standard label tooltips render at the page feedback layer to avoid being clipped by Shadow DOM hosts or host-page controls; preview tooltips may stay inside their owning ShadowRoot.
- Toasts render at the top center of the viewport, replace the previous toast, default to 3 seconds, and must not block page interaction.

### 7.10 Shared Chrome Ownership

- Shared chrome is organized by semantic family: panel shell, dialog shell, anchored shell, button/icon button, field/form row, feedback, and toolbar controls.
- A shared chrome Module owns visual structure, state selectors, accessibility mechanics, and public/family tokens. It does not own feature data, persistence, copy, navigation, export, or platform DOM discovery.
- Surface families select named profiles. Boolean style flags and caller-provided low-level dimensions must not grow into a second styling Interface.
- A family may keep private geometry and density composition when it has a distinct workflow. Reusable meaning is promoted to shared chrome only after a second real consumer exists.

### 7.11 Surface Runtime Ownership

`src/ui/content/components/SurfaceRuntime.ts` is the shared lifecycle seam for user-visible page UI. A `SurfaceSession` owns appearance and locale propagation, focus entry and return, Escape/outside-click policy, positioning, reduced-motion handling, close completion, and cleanup. Feature controllers retain content, commands, mounting decisions, and adapter-owned anchor geometry.

Rules:

- Do not introduce another global observer to coordinate UI lifecycle.
- Host geometry and platform selectors remain in Drivers/Adapters; the Surface runtime consumes normalized anchors and viewport inputs.
- Modal and panel sessions reuse the current overlay host rather than creating a competing global overlay stack.
- Full-viewport Shadow hosts are pointer-transparent infrastructure. Only an owned backdrop or interactive Surface may opt back into pointer events; an empty, closing, or accidentally retained host must never intercept the host page.
- Anchored Surfaces use `SurfaceSession` directly or a family owner that composes it. The toolbar hover action is the documented exception: its action row uses `transform` as anchor geometry, so it preserves the established motion-free outside-pointer/resize/scroll lifecycle instead of allowing session opening motion to overwrite that geometry.
- CSS and JavaScript close timing must derive from one named motion profile. Reduced motion must not leave stale hosts or delayed focus restoration.
- A close request that cannot start its motion lifecycle must synchronously unmount the owning session and release its scroll lock. Reopening during close must cancel and reuse that session rather than create a duplicate host.

## 8. Shadow DOM And Style Injection

The style system must work when inserted into third-party pages and browser-extension environments.

Rules:

- Use Shadow DOM for page UI surfaces.
- Use root-scoped `<style data-aimd-style-id>` fallback whenever constructable stylesheet support is missing or unreliable.
- Do not assume `adoptedStyleSheets` is a normal mutable array.
- Validate shared stylesheet paths in Chrome-like and Firefox-like environments.
- Do not branch by browser name when feature detection is enough.
- Do not inject global page CSS for product UI unless an adapter contract explicitly requires it.
- The ChatGPT lower-right page-control cluster is a documented light-DOM exception: it owns one uniquely identified fixed host under `document.body`, uses only uniquely prefixed AI-MarkDone selectors and `--aimd-*` token CSS, and must not modify ChatGPT-owned header or conversation DOM.
- Theme switching uses `data-aimd-theme` and token variables, not host-page selectors.
- Style modules must be idempotent across repeated hydration, teardown, and re-scan.

Required tests for style-injection changes:

- constructable stylesheet path
- root-scoped fallback path
- repeated `ensureStyle` calls on the same ShadowRoot
- two independent ShadowRoots
- theme token propagation
- host page CSS collision check when practical

### 8.1 Appearance Scope Contract

Appearance is distributed as one immutable snapshot containing the current theme and approved global overrides. A Surface must not independently read product settings to decide its colors, type scale, radius, or density.

The supported injection scopes are:

| Scope | Use | Contract |
|:--|:--|:--|
| Page | Extension pages and the smallest adapter-approved host-page token layer | One page-level token sheet per snapshot; never use page selectors to style Shadow DOM UI |
| ShadowRoot | Normal product Surfaces | Reuse the same generated sheet for identical snapshots when supported; retain the idempotent `<style>` fallback |
| Light-DOM portal | Documented host integration and page feedback layers | Use a uniquely identified AI-MarkDone host and prefixed selectors; consume the same public token output as ShadowRoot Surfaces |

An `AppearanceSnapshot` change is meaningful only when its normalized values differ. Unrelated settings updates must not regenerate or rebroadcast token CSS. Reader content width and Reader body font size remain Reader-owned state and must not invalidate other appearance scopes.

### 8.2 Responsive And Overflow Contract

Responsive behavior is part of the Surface profile, not a collection of caller-specific media queries. Every Surface family must declare:

- viewport gutter and maximum width/height;
- the single element that owns scrolling;
- anchored flip/clamp behavior and anchor-loss fallback where relevant;
- narrow-width and short-height degradation order;
- behavior at 200% browser zoom and with the visual viewport reduced by an on-screen keyboard.

Global requirements:

- `320px` and `390px` widths, `568px` and `900px` heights, and 200% zoom are minimum validation points.
- Header and footer controls remain reachable. The Surface body becomes the sole scroll owner before content is clipped or controls are compressed.
- A page and its Surface must not create competing vertical scroll owners. Nested scroll areas require a content-specific reason such as a code block or list viewport.
- Anchored Surfaces first flip, then clamp, then use the family’s compact fallback. They never render beyond the visual viewport.
- Inline host controls preserve the host layout. Responsive degradation hides secondary extension chrome before modifying or obscuring host-owned controls.
- Breakpoints are owned by a Surface family and documented in the catalog. A component may use local container/geometry conditions inside that family contract but may not introduce an unrelated product breakpoint.

## 9. Pure CSS Contract

AI-MarkDone shipped UI uses custom CSS plus `--aimd-*` tokens. External style frameworks, generated utility themes, and framework-prefixed utility classes are not part of the active runtime styling system.

Rules:

- Component CSS must be authored as owned, scoped CSS.
- Framework utility classes must not appear in `src/ui/**` or `src/popup/**`.
- Overlay, dialog, popover, toolbar, and inline host-page surfaces all receive the same token CSS through the shared injection path.
- Any future external style-library proposal must first update this document and add governance tests proving that it cannot become a second token source.

### 9.1 User Theme Override Contract

User customization enters only through token generation, not through component-specific settings parsing.

The global override shape is `UserThemeOverrides`:

| Field | Purpose | Mapping |
|:--|:--|:--|
| `accentColor` | User theme color | Maps to accent, accent hover, accent soft, flash, focus, info border, and selected-state tokens. |
| `baseFontScale` | UI font scaling | Maps `appearance.fontSizePx / 16` to type-size system tokens, clamped to the public `12px`-`20px` setting range. |

Components may consume only the resulting public `--aimd-*` tokens or their local private geometry variables.

Reader measure and Reader body type size are emitted by the Reader family from Reader state. They are not fields of the global appearance override and must not trigger appearance refreshes in unrelated Surfaces. `density` and `cornerScale` are not supported product customization fields and are not part of `UserThemeOverrides`.

## 10. CSS Variables Contract

### 10.1 Token Layers

| Layer | Owner and purpose | Naming / consumers |
|:--|:--|:--|
| Reference tokens | Style foundation owns raw neutral, accent, state, spacing, shape, size, and motion scales | `--aimd-ref-*`; consumed only while defining System tokens |
| System tokens | Style foundation owns semantic product decisions such as canvas, surface, text, border, focus, layer, and motion | `--aimd-sys-*`; consumed by the Public layer, never by component CSS |
| Public tokens | Style foundation owns the stable component-facing aliases | `--aimd-*` from `src/style/public-tokens.ts`; map System tokens or compose other Public aliases without cycles |
| Family/component tokens | One Surface family or shared chrome Module owns a reusable contract such as toolbar, panel chrome, Reader content, tooltip, or toast | `--aimd-<family>-*`; declared in one family source and consumed only by that family and its explicit children |
| Private component variables | One implementation owns local composition, runtime geometry, measured offsets, and intermediate values | `--_<owner>-*`; scoped to the owning stylesheet/host and never consumed as a cross-file public contract |

Rules:

- Component CSS uses public or family tokens; internal System tokens remain implementation details of the style foundation.
- Private variables may be used for local composition but must not become public contracts.
- New public tokens require naming review, usage documentation, and at least one real component consumer.
- A family token is promoted to shared chrome only when a second real Surface shares the same semantic intent; visual similarity alone is insufficient.
- Runtime geometry such as measured anchor offsets, dynamic max heights, dot sizes, and host gaps is private unless multiple implementations intentionally share one family contract.
- Remove a token only after a complete reference graph proves that it has no direct consumer, alias consumer, generated CSS consumer, test fixture contract, or documented external use.
- The token graph must reject undefined references, duplicate definitions at the same layer, cycles, and direct component consumption of reference tokens.

### 10.2 Naming

- Public tokens use the `--aimd-*` prefix.
- Private component variables use a local private prefix such as `--_reader-*`.
- Token names describe intent, not color values or current implementation.
- Do not create platform-specific token names such as `--aimd-chatgpt-*` unless the token is truly platform scoped.
- A private variable must not use the public prefix merely because JavaScript assigns its runtime value.

## 11. Do And Do Not

Do:

- Use `--aimd-*` tokens in shipped UI.
- Add or update mock-first visual coverage for material UI changes.
- Keep color usage neutral-first and accent-sparing.
- Reuse shared primitives for buttons, rows, panels, dialogs, and popovers.
- Verify Shadow DOM injection and fallback paths when style ownership changes.
- Update this document when a style contract changes.

Do not:

- Hardcode colors, spacing, radius, shadows, z-index, or motion values in component CSS.
- Use `!important` outside explicit print-only rules.
- Add global page CSS for extension UI without a documented adapter reason.
- Add decorative color families or gradients without product need.
- Use external style frameworks or utility classes in shipped UI paths by default.
- Keep old style references after moving a contract into this document.

## 12. Style-System Change Workflow

The style system should evolve in stable, reviewable steps.

1. Document the contract in `docs/design.md`.
2. Add or update a static/mock surface when the change affects visual output.
3. Update tokens or shared primitives.
4. Update product Surfaces in small, independently verifiable batches.
5. Verify style injection, browser parity, and build gates.
6. Remove dead tokens, duplicate CSS, and obsolete documentation.

Style-system changes update documentation and real-module mock coverage before broad runtime edits. This keeps extension behavior stable while the design language evolves.

The delivered convergence history and Phase 7 closeout evidence live in `docs/refactor/UI_SYSTEM_REFACTOR_PLAN.md`. That record cannot redefine the long-lived contracts in this document.

## 13. Current Runtime Alignment Notes

As of July 16, 2026, the runtime is aligned to the appearance, lifecycle, coverage, and ownership contracts above. Final numeric and manual closeout evidence remains recorded separately in `docs/refactor/UI_SYSTEM_REFACTOR_PLAN.md` and must not be inferred from these structural facts.

| Area | Delivered runtime contract |
|:--|:--|
| Token foundation | `reference-tokens.ts`, `system-tokens.ts`, and `public-tokens.ts` are distinct executable layers composed by `tokens.ts`. Auto-discovered shipped style sources feed closure checks for undefined references, duplicate non-isolated owners, cycles, unconsumed Public aliases, unreachable foundation tokens, and registered Family-token ownership. Components cannot consume Reference/System tokens directly. |
| Appearance distribution | Immutable `AppearanceSnapshot` values carry theme plus normalized global overrides. `AppearanceScope` applies them to page, ShadowRoot, and light-DOM portal scopes, skips identical fingerprints, shares identical constructed stylesheets where supported, and retains a stable style-tag fallback. Reader width and Reader body type remain Reader state. |
| Surface lifecycle | `SurfaceSession` supplies the `panel`, `modal`, `anchored`, and `inline` profiles and composes focus, Escape, outside-dismiss, positioner, motion, reduced-motion, close, and destroy behavior. `OverlaySession` is the modal/panel adapter over the same runtime; Composer, Prompt, Send, Reader contextual, and toolbar transient owners consume the anchored contract. |
| Workflow ownership | Prompt is split across `PromptWorkflow`, `PromptGeometryAdapter`, and `PromptSurfaceRenderer`; Reader is split across `ReaderWorkflow`, `ReaderViewModel`, `ReaderRendering`, and `ReaderHostAdapter`; Bookmarks delegates tab and Cloud Backup flows to workflow modules and keeps family responsive CSS separate from shell orchestration. |
| Legacy closure | The production-dead Send modal, generic Tabs component, no-op Markdown enhancer/theme compatibility shims, empty Bookmarks overlay subclass, and redrawn Panel Studio fixture are absent. Markdown display CSS has one service-layer owner. |
| Responsive and visual coverage | The semantic catalog is mirrored by `tests/support/uiSurfaceCoverage.ts`. Every entry names a production owner, real trigger-path test, browser targets, responsive contract, and tracked real-module fixture, either directly or through an explicitly named family fixture. `npm run test:ui:visual` executes the registered real-component fixtures and keeps evidence outside Git. |
| Static document exception | `src/popup/popup.html` is an extension document, so it owns a minimal Public-token fallback rather than ShadowRoot runtime injection. Static popup and export/render-output values are governed by exact owner-and-reason exceptions, not directory-wide exclusions. |

These contracts are the baseline for new UI work. Changes must extend the existing owners and executable governance rather than reintroducing parallel lifecycle, token, or visual-fixture systems.

## 14. Review Rubric

Every major style-system documentation or implementation iteration should be reviewed on a 100-point scale.

| Dimension | Question |
|:--|:--|
| Normative quality | Does the document give clear rules that future contributors can follow without guessing? |
| Maintainability | Are ownership boundaries, token layers, and migration paths easy to keep current? |
| Correctness | Does the guidance match the current architecture, browser constraints, and Shadow DOM behavior? |
| Reasonableness | Does the plan improve consistency without overengineering or destabilizing the product? |

The iteration may stop only when the average score is above 90 and verification does not reveal broken references or stale authority documents.
