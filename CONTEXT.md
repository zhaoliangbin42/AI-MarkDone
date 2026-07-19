# AI-MarkDone Product Context

This file defines the short, shared vocabulary used in product discussion, implementation, and documentation. Detailed behavior remains authoritative in `docs/FEATURES.md` and `docs/architecture/CURRENT_STATE.md`.

## UI System

- **Surface**: one user-visible AI-MarkDone work area with a defined entry, owner, DOM scope, lifecycle, and responsive behavior. A Surface may be a panel, modal, anchored popover, inline host control, or extension document.
- **Surface family**: related Surfaces that share density, chrome, interaction, and responsive behavior, such as Reader, Bookmarks, Composer, or host-integrated controls.
- **Chrome**: repeated interface structure around content, including headers, footers, rows, controls, dividers, focus treatment, and feedback states. Chrome does not own feature data or platform selectors.
- **Transient UI**: short-lived contextual UI such as a popover, tooltip, toast, suggestion list, or hover action. It must have an explicit anchor, dismissal contract, focus behavior, and viewport fallback.
- **Surface profile**: a named presentation contract (`panel`, `modal`, `anchored`, or `inline`) that supplies shared chrome and lifecycle behavior without exposing low-level style flags.
- **Responsive contract**: the declared width, height, collision, scroll-owner, and narrow-viewport behavior for a Surface. It is owned by the Surface family rather than assembled from unrelated media queries.
- **Appearance snapshot**: one immutable theme-and-global-appearance value distributed to UI roots. Reader content width and Reader body font size are Reader state, not global appearance.
- **Appearance scope**: the token-injection target for an appearance snapshot: a page root, ShadowRoot, or documented light-DOM portal.
- **Surface session**: the lifecycle owner for mounting, appearance and locale updates, focus, dismissal, positioning, motion, close, and destruction of one Surface.

The complete Surface catalog, token ownership rules, and responsive contracts are authoritative in `docs/design.md`. The implementation history and current Phase 7 closeout record live in `docs/refactor/UI_SYSTEM_REFACTOR_PLAN.md`.

## ChatGPT Input Enhancement

- **Input Enhancement**: the complete optional authoring layer attached to the official ChatGPT composer. It does not replace the composer or render rich text inside it.
- **Availability switch**: `chatgptBehavior.inputEnhancement.available`, shown in bookmark Settings. Turning it off hides the composer button and pauses every enhancement while preserving detailed preferences.
- **Runtime master switch**: `chatgptBehavior.inputEnhancement.enabled`, shown in the composer popover. It controls whether the button is highlighted and whether any child capability runs.
- **Enter-newline**: intercepts ordinary Enter outside lists. Cmd/Ctrl + Enter remains the send shortcut; Shift + Enter remains host-owned.
- **List enhancement**: the parent capability for CommonMark-aware list authoring. Ordered and unordered lists are independently selectable beneath it, while each list type keeps its own complete behavior set.
- **Bold shortcut**: Cmd/Ctrl + B inserts or removes visible `**` markers; it is not rich-text rendering.
- **Formula suggestions**: formula-local LaTeX snippet completion for `\\` tokens inside `$...$` or `$$...$$`.
- **Formula preview**: lightweight anchored rendering for inline and display formulas. It never rewrites or renders inside the source composer.

Both master switches preserve child values when disabled. Effective capability state is always derived from availability, runtime master, and the corresponding child switch.

## ChatGPT Content Discovery

- **Canonical conversation snapshot**: one verified, complete current-branch projection reconstructed from the ChatGPT conversation graph. It alone owns round content, absolute order, branch identity, and typed message identities.
- **Conversation Engine**: the semantic SSOT that owns and publishes the Canonical conversation snapshot. Reader, copy, export, and bookmark-body flows consume it through `readerContentSource`.
- **Conversation Index**: the unique navigation projection that combines the Engine snapshot with optional currently materialized page anchors. Directory, stepper, locate, and bookmark navigation consume its ordered rounds plus anchors.
- **Materialization**: the host-controlled act of mounting a conversation round into the current ChatGPT DOM window. Materialization may add or remove anchors, but it never changes the Canonical conversation snapshot's round count or order.
- **Round identity**: typed `userMessageId`, `assistantMessageId`, and graph round/node aliases used to join semantic rounds to materialized anchors. Prompt text and DOM-local position are presentation data, never identity.
