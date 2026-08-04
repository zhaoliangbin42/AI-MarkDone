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

- **Conversation proof**: the root completeness proof for a canonical snapshot. `observed-graph` means the host's complete current-branch graph was passively observed; `birth-epoch` means the extension witnessed an empty new-conversation epoch and every published successor from streaming through official completion.
- **Conversation state**: the single immutable `idle / collecting / ready / blocked` value for one route epoch. It owns the monotonic revision, conversation identity, canonical snapshot, and any fail-closed reason.
- **Canonical conversation snapshot**: one proof-backed, contiguous stable-completion prefix. It alone owns round content, absolute order, branch identity, and typed message identities; it may come from `observed-graph` or a witnessed `birth-epoch`.
- **Conversation reducer**: the pure SSOT transition function that reduces route, graph, and typed DOM-turn facts into Conversation state. Consumers never merge or recover semantic content themselves.
- **Conversation Engine**: the current-route coordinator and state store. It exposes `getState`, `subscribe`, and one epoch-scoped `ensureReady` flush; it does not own retries, polling, or consumer-specific caches.
- **Conversation Index**: the unique navigation projection that combines the Engine snapshot with optional currently materialized page anchors. Directory, stepper, locate, and bookmark navigation consume its ordered rounds plus anchors.
- **Reader content source**: the sole projection from a published conversation snapshot to `ReaderItem[]`. Passive queries call `readCurrentReaderContent`; real user commands call `collectFreshReaderContent`, whose one no-argument confirmation policy is owned by the source rather than its callers.
- **Reader content source status**: the additive `ready / unavailable / target-unresolved` result state for the ChatGPT content adapter. It preserves the existing empty-result UI behavior without allowing a missing target or missing snapshot to masquerade as ready content.
- **Reader content projection cache**: an ephemeral immutable-snapshot-scoped cache of normalized ChatGPT content. Snapshot identity owns normalized正文; `Source revision` only rejects stale asynchronous work. The cache returns caller-owned `ReaderItem` views so toolbar metadata decoration cannot mutate the cached projection.
- **Source revision**: the ephemeral `routeEpoch + revision + conversationId` identity used to reject stale asynchronous UI work. It is not persisted in bookmark, export, annotation, or Reader schemas.
- **Conversation Reader binding**: the source-only subscription that keeps the in-page Reader aligned with published revisions. It never discovers DOM turns or calls `ensureReady`, and it closes the Reader when canonical content is withdrawn.
- **Materialization**: the host-controlled act of mounting a conversation round into the current ChatGPT DOM window. Materialization may add or remove anchors, but it never changes the Canonical conversation snapshot's round count or order.
- **Round identity**: typed `userMessageId`, `assistantMessageId`, and graph round/node aliases used to join semantic rounds to materialized anchors. Prompt text and DOM-local position are presentation data, never identity.
- **Conversation Content Port V1**: the frozen semantic `read / subscribe / refresh / isCurrent` boundary that publishes one immutable, typed conversation snapshot to every ChatGPT content consumer. It never exposes DOM, selectors, provider payloads, transport, or route epochs.
- **Conversation Materialization Port V1**: the content-runtime-only projection of the current DOM window into typed message targets. Virtualization and remounts may change materialization anchors without changing semantic content or its token.
- **Reconcile**: the single coalesced coordinator entry point for bootstrap, route, `pageshow`, PageIndex, passive bridge, and explicit refresh signals. It owns one epoch, one in-flight acquisition, and stale-result rejection.
- **Content token**: the immutable semantic snapshot token. It changes only when document identity, typed order/identity, or Markdown changes; state transitions and DOM remounts do not manufacture a new token.

## ChatGPT Atomic Selection Copy

- **Atomic Markdown shortcut**: `chatgptBehavior.atomicMarkdownCopyShortcut` is the only ChatGPT direct-selection Markdown copy control. It is `none`, `mod-c` (`Ctrl/Cmd+C`), or `mod-shift-c` (`Ctrl/Cmd+Shift+C`); fresh installs default to `mod-shift-c`, while legacy `atomicMarkdownCopy` values migrate to `mod-c` or `none`.
- **Keyboard-only exit**: ChatGPT direct selection no longer creates a copy button or inverse action. The controller keeps only selection highlighting and a short-lived canonical snapshot; invalid, editable, streaming, cross-message, or DevTools-consumed shortcuts fail open to the host.

## Reader Annotations (v1 shipped)

- **Annotation document**: one verified ChatGPT conversation identified by `{ platform: 'chatgpt', conversationId }`. Its title and last URL are display/navigation hints, never identity.
- **Annotation target**: the selected source inside a canonical assistant message. `assistantMessageId` is the required semantic identity; round/user IDs and position are supporting or presentation data.
- **Re-anchoring**: restoring a saved selection after Reader content or DOM structure changes. v1 accepts only a validated exact match through DOM/atomic selectors, TextPosition, or TextQuote; an ambiguous match becomes `unanchored`.
- **Pending annotation navigation intent**: a short-lived background-owned request bound to a newly created ChatGPT tab. After the tab exposes a verified conversation identity, it opens Reader at the target assistant message and focuses the annotation. It is navigation state, not annotation data or conversation identity.
- **Annotation persistence preference**: `reader.persistAnnotations`, an explicit opt-in setting shared by Reader Settings and the annotation manager. It controls whether newly created ChatGPT annotations enter the profile-local per-conversation bundle. Existing durable annotations are always read, displayed, edited, and deleted normally; disabling the preference only keeps future annotations in the current page runtime.
- **Annotation excerpt**: the manager’s source preview keeps up to 50 Unicode characters at each end and replaces omitted middle content with one ellipsis.
- **Bulk annotation edit**: a simple manager selection mode with select-all for visible rows and one confirmed batch deletion; it is not a separate notes workspace or export surface.
