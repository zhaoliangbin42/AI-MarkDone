# AI-MarkDone Design Reference

This document is the single source of truth for AI-MarkDone product UI design, style-system rules, and visual governance. It replaces the previous split style and token references.

Runtime token values live in `src/style/reference-tokens.ts`, `src/style/system-tokens.ts`, and `src/style/tokens.ts`. This document defines what those values mean, how they may be used, and how future UI work should be judged.

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
- A multi-color treatment is only allowed when it represents a specific product state. The current approved exception is the ChatGPT directory bookmark marker, exposed through `--aimd-bookmark-marker-gradient` / `--aimd-bookmark-marker-glow`.
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

## 3. Surface Map

| Surface | Role | Density | Styling Owner | Required Checks |
|:--|:--|:--|:--|:--|
| Reader panel | Long-form reading, prompt/source rendering, export entry points | Comfortable reading density | Reader surface profile + shared chrome primitives | Markdown hierarchy, source blocks, prompt wrapping, scroll, panel width |
| Bookmarks panel | Saved items, folders, metadata, actions | Operational density | Bookmarks surface profile + shared rows/buttons | Empty state, long titles, folder actions, selection, list virtualization risk |
| Settings panel | Product configuration and advanced preferences | Form density | Shared form primitives | Label/help alignment, defaults, disabled states, validation copy |
| Message toolbar | High-frequency inline actions in ChatGPT conversation flow | Compact | Toolbar component tokens and native CSS modules | Hydration, re-scan, icon alignment, hit target, host-page interference |
| ChatGPT directory | Conversation navigation and step controls | Compact navigation density | Directory surface profile | Current step, disabled navigation, long labels, host mutations |
| Modal/dialog | Focused decision or blocking action | Compact, centered | Shared dialog primitive | Focus trap, escape, inert/backdrop behavior, z-index, reduced motion |
| Popover/hover portal | Contextual actions or previews | Compact | Shared popover primitive or documented local boundary | Anchor position, viewport collision, hover delay, dismissal |
| Save messages dialog | Selection and confirmation flow | Task density | Dialog primitive + save-flow body | Multi-select state, error state, keyboard flow, restore scroll |

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
| Muted text | `--aimd-ref-color-neutral-500` | `#6B7280` | `#9CA3AF` |
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
| Quiet neutral | `--aimd-ref-color-neutral-alpha-06` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.06)` |
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
| Warning text | `--aimd-sys-color-warning-text` | `#b45309` | `#fbbf24` |
| Danger | `--aimd-sys-color-danger` | `#ef4444` | `#ef4444` |
| Success border | `--aimd-ref-color-green-alpha-35` | `rgba(16,185,129,0.35)` | `rgba(16,185,129,0.35)` |
| Error border | `--aimd-ref-color-red-alpha-35` | `rgba(239,68,68,0.35)` | `rgba(239,68,68,0.35)` |

Overlay and shadow color values:

| Intent | Token | Light | Dark |
|:--|:--|:--|:--|
| Overlay | `--aimd-ref-color-black-alpha-35` | `rgba(0,0,0,0.35)` | `rgba(0,0,0,0.55)` |
| Heavy overlay | `--aimd-sys-color-overlay-heavy` | `rgba(148, 163, 184, 0.34)` | `rgba(0,0,0,0.60)` |
| Floating shadow | `--aimd-ref-shadow-300` | `0 10px 24px rgba(0,0,0,0.18)` | `0 10px 24px rgba(0,0,0,0.45)` |
| Panel shadow | `--aimd-ref-shadow-500` | `0 18px 50px rgba(0,0,0,0.25)` | `0 18px 50px rgba(0,0,0,0.55)` |

The target palette keeps the core neutral, brand, warning, danger, success/error border, focus, list-selection, and overlay values. Platform-scoped color tokens are not part of the active system.

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
- User-facing theme color is also an appearance setting: `appearance.accentColor` is selected through visual swatches only, never typed text, and maps to `UserThemeOverrides.accentColor`.

### 5.1 Current Typography Values

| Intent | Token | Value |
|:--|:--|:--|
| Small label | `--aimd-ref-type-size-075` | `12px` |
| Medium label | `--aimd-ref-type-size-100` | `13px` |
| Body | `--aimd-ref-type-size-200` | `16px` |
| Title medium | `--aimd-ref-type-size-300` | `16px` |
| Title large | `--aimd-sys-type-title-large-size` | `18px` |
| Hero title | `--aimd-sys-type-title-hero-size` | `26px` |
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
| `--aimd-ref-radius-250` | `10px` |
| `--aimd-ref-radius-300` | `12px` |
| `--aimd-ref-radius-400` | `16px` |
| `--aimd-ref-radius-full` | `999px` |

Core sizes and layers:

| Intent | Token | Value |
|:--|:--|:--|
| Small icon | `--aimd-ref-size-160` | `16px` |
| Medium icon | `--aimd-ref-size-260` | `26px` |
| Toolbar icon control | `--aimd-ref-size-300` | `30px` |
| Panel icon control | `--aimd-ref-size-320` | `32px` |
| Action control | `--aimd-ref-size-360` | `36px` |
| Panel header | `--aimd-ref-size-720` | `72px` |
| Compact panel header | `--aimd-ref-size-640` | `64px` |
| Source max height | `--aimd-ref-size-220` | `220px` |
| Panel max width | `--aimd-ref-size-900` | `900px` |
| Panel width | `--aimd-ref-size-fluid-viewport-92` | `92vw` |
| Panel height | `--aimd-ref-size-fluid-viewport-82` | `82vh` |
| Panel top offset | `--aimd-ref-size-fluid-viewport-10` | `10vh` |
| Base layer | `--aimd-ref-z-base` | `1` |
| Panel layer | `--aimd-ref-z-panel` | `9000` |
| Tooltip layer | `--aimd-ref-z-tooltip` | `10000` |

Motion:

| Intent | Token | Value |
|:--|:--|:--|
| Fast duration | `--aimd-ref-motion-duration-fast` | `150ms` |
| Enter/base duration | `--aimd-ref-motion-duration-enter` | `200ms` |
| Slow duration | `--aimd-sys-motion-duration-slow` | `300ms` |
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
- Error copy should be close to the control and use semantic danger tokens.

### 7.4 Panels

- Panels own their header, body, footer, scroll, and resize behavior through surface profiles.
- Panel callers should not pass low-level chrome flags unless the profile does not yet exist and the exception is documented.
- Reader and bookmarks panels should converge on shared shell structure while preserving their different density needs.

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

## 8. Shadow DOM And Style Injection

The style system must work when inserted into third-party pages and browser-extension environments.

Rules:

- Use Shadow DOM for page UI surfaces.
- Use root-scoped `<style data-aimd-style-id>` fallback whenever constructable stylesheet support is missing or unreliable.
- Do not assume `adoptedStyleSheets` is a normal mutable array.
- Validate shared stylesheet paths in Chrome-like and Firefox-like environments.
- Do not branch by browser name when feature detection is enough.
- Do not inject global page CSS for product UI unless an adapter contract explicitly requires it.
- Theme switching uses `data-aimd-theme` and token variables, not host-page selectors.
- Style modules must be idempotent across repeated hydration, teardown, and re-scan.

Required tests for style-injection changes:

- constructable stylesheet path
- root-scoped fallback path
- repeated `ensureStyle` calls on the same ShadowRoot
- two independent ShadowRoots
- theme token propagation
- host page CSS collision check when practical

## 9. Pure CSS Contract

AI-MarkDone shipped UI uses custom CSS plus `--aimd-*` tokens. External style frameworks, generated utility themes, and framework-prefixed utility classes are not part of the active runtime styling system.

Rules:

- Component CSS must be authored as owned, scoped CSS.
- Framework utility classes must not appear in `src/ui/**` or `src/popup/**`.
- Overlay, dialog, popover, toolbar, and inline host-page surfaces all receive the same token CSS through the shared injection path.
- Any future external style-library proposal must first update this document and add governance tests proving that it cannot become a second token source.

### 9.1 User Theme Override Contract

Future user customization enters only through token generation, not through component-specific settings parsing.

The supported override shape is `UserThemeOverrides`:

| Field | Purpose | Mapping |
|:--|:--|:--|
| `accentColor` | User theme color | Maps to accent, accent hover, accent soft, flash, focus, info border, and selected-state tokens. |
| `density` | Compact or comfortable UI density | Maps to shared spacing, control size, and panel header tokens. |
| `baseFontScale` | UI font scaling | Maps `appearance.fontSizePx / 16` to type-size system tokens, clamped to the public `12px`-`20px` setting range. |
| `cornerScale` | Roundedness strength | Maps to shared radius system tokens. |
| `readerContentWidthPx` | Reader measure | Emits a clamped custom property for reader surfaces. |

Components may consume only the resulting public `--aimd-*` tokens or their local private geometry variables.

## 10. CSS Variables Contract

### 10.1 Token Layers

| Layer | Purpose | Examples |
|:--|:--|:--|
| Reference tokens | Raw neutral, accent, state, and primitive scales | Source-owned only; not used directly by components |
| System tokens | Semantic product decisions | Canvas, surface, text, border, focus, motion |
| Component tokens | Surface-specific or component-specific contract | Toolbar, panel chrome, reader content |
| Private component variables | Local implementation details | `--_reader-*`, `--_dialog-*` |

Rules:

- Component CSS uses system or component tokens.
- Private variables may be used for local composition but must not become public contracts.
- New public tokens require naming review, usage documentation, and at least one real component consumer.
- Remove dead tokens when removing the final consumer.

### 10.2 Naming

- Public tokens use the `--aimd-*` prefix.
- Private component variables use a local private prefix such as `--_reader-*`.
- Token names describe intent, not color values or current implementation.
- Do not create platform-specific token names such as `--aimd-chatgpt-*` unless the token is truly platform scoped.

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

## 12. Migration Rules

The style system should evolve in stable, reviewable steps.

1. Document the contract in `docs/design.md`.
2. Add or update a static/mock surface when the change affects visual output.
3. Update tokens or shared primitives.
4. Migrate product surfaces in small batches.
5. Verify style injection, browser parity, and build gates.
6. Remove dead tokens, duplicate CSS, and obsolete documentation.

For this project, style-system migrations should prefer documentation and mock coverage before broad runtime refactors. This keeps the stable extension behavior intact while making the design language more consistent.

## 13. Current Runtime Alignment Notes

As of May 13, 2026, the active runtime style system is aligned to this document. The shipped UI is governed by custom CSS plus `--aimd-*` tokens; Tailwind, prefixed utility aliases, and external runtime style frameworks are not part of the product styling chain.

The Chrome production chain has been verified against the unpacked `dist-chrome` build after extension reload. The ChatGPT toolbar, bookmarks panel, settings surface, tree/list controls, and changelog info modal rendered through the tokenized Shadow DOM path without AI-MarkDone style-injection warnings.

| Area | Current Signal | Migration Direction |
|:--|:--|:--|
| `src/popup/popup.html` | The unsupported-page popup is a static extension document and cannot rely on Shadow DOM runtime injection. | Keep only the minimal public-token fallback subset; do not copy reference/system token tables. This is the lone documented raw color fallback in shipped UI. |
| `src/ui/content/components/ModalHost.ts` + `modalHostCss.ts` | Alert, confirm, prompt, custom info modal, changelog notice, import review, and destructive confirmation flows share one dialog shell. | New modal-like UI must enter through this host or a documented shared primitive, not local dialog chrome. |
| `src/ui/content/bookmarks/*` | Bookmarks remains the densest style surface, but it now consumes public tokens and keeps private `--_bookmarks-*` variables for local geometry, layering, and focus composition. | Reusable visual meaning belongs in shared tokens or primitives; private variables must not become color/font/shadow systems. |
| Static visual coverage | Mock-first workflow exists and should stay aligned with real tokens/components. | Keep design-system and page-system mocks current whenever shared tokens or primitives change. |

These notes are not permission to destabilize working UI. They define the current baseline and the boundaries for future cleanup once new customization work starts.

## 14. Review Rubric

Every major style-system documentation or implementation iteration should be reviewed on a 100-point scale.

| Dimension | Question |
|:--|:--|
| Normative quality | Does the document give clear rules that future contributors can follow without guessing? |
| Maintainability | Are ownership boundaries, token layers, and migration paths easy to keep current? |
| Correctness | Does the guidance match the current architecture, browser constraints, and Shadow DOM behavior? |
| Reasonableness | Does the plan improve consistency without overengineering or destabilizing the product? |

The iteration may stop only when the average score is above 90 and verification does not reveal broken references or stale authority documents.
