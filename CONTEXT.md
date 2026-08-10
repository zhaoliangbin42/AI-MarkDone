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

- **Canonical conversation cache**: the one immutable Content Port V1 value that owns conversation identity, typed turn identities, canonical assistant Markdown, order and per-body provenance. Consumers never merge Graph and DOM evidence themselves; a turn in the cache is available for consumption.
- **Canonical route identity (current)**: `chatgptRoute` extracts a conversation identity only from a supported `/c/<id>` or `/conversation/<id>` path segment on `chatgpt.com` or `chat.openai.com`; a nested `/g/<scope>/c/<id>` path works because it contains the same `/c/<id>` segment. `/g/<id>`, `/share/<id>`, query-only `conversationId`, and a URL-stable anonymous page are not current Conversation Document identities. Route identity binds a document epoch; it never proves that a page is empty.
- **Anonymous page session (planned)**: an in-memory, document-scoped identity for a ChatGPT page that has no canonical conversation ID. It is not a persisted conversation identity and cannot by itself authorize bookmark persistence or cross-page navigation. The current production runtime does not yet publish this mode; its DOM-seed lifecycle remains a planned follow-up.
- **Conversation Content Port V1**: the stable `read / subscribe / refresh / isCurrent` Interface implemented by `ConversationContentRepository`. It publishes only `idle / syncing / ready / unavailable`; `refresh()` flushes local work and never reopens baseline admission or performs a request.
- **Content Source Adapter**: the platform driver that passively consumes the website-owned Graph once per conversation epoch, normalizes provider Markdown, and submits the initial cache. It never performs an extension-issued conversation request.
- **Host Monitor**: the single ChatGPT PageIndex-backed DOM input. After a 400 ms quiet window it compiles only newly observed, typed, completed turns and appends them to the cache. DOM is an incremental input, not a second consumer-facing content store.
- **Source provenance**: `{ authority, fidelity, producer }` attached to canonical Markdown. `source`, `hybrid`, and compiler-verified `host-born` turns are all consumable; provenance describes origin, not a consumer block.
- **Coverage**: the maintained cache publishes only dense `complete` snapshots. Streaming, debounce and compilation are internal timing details; an unfinished turn is simply not in the cache yet.
- **Semantic Content Module**: the provider-neutral `compile / resolve / project` Interface that turns canonical Markdown into an immutable AI-MarkDone document, UTF-16 half-open source spans, plain text, Reader units/outline, and canonical Markdown projections. DOM and parser-library ASTs do not cross this Interface.
- **Content Surface Adapter**: the driver Interface that captures a same-message, non-streaming native selection and emits typed identity, revision tokens, W3C-style TextQuote evidence, and parser-backed source atoms such as authoritative formula TeX. Range, Element, and host selectors remain inside the driver.
- **Surface Projection**: the only service seam that joins surface evidence to canonical source. It validates content and materialization revisions; the interaction controller re-captures the current surface token before reuse. Stale, ambiguous, reconstructed, or unproven mappings fail open.
- **Reader content source**: the sole projection from a published conversation snapshot to `ReaderItem[]`. Passive queries call `readCurrentReaderContent`; real user commands call `collectFreshReaderContent`, whose one no-argument confirmation policy is owned by the source rather than its callers.
- **Reader content source status**: the additive `ready / unavailable / target-unresolved` state plus coverage and source quality. ChatGPT copy/bookmark/export read the maintained cache and reject only missing targets or unsupported surface proof.
- **Source revision**: the ephemeral conversation/content-token identity used to reject stale asynchronous UI work. It is not persisted in bookmark, export, annotation, or Reader schemas.
- **Conversation Reader binding**: the cache subscription that keeps the in-page Reader aligned with published revisions. It never discovers DOM turns or starts a second acquisition path.
- **Materialization**: the host-controlled act of mounting a typed conversation turn into the current DOM window. It may add or remove anchors but never changes canonical content or order.
- **Conversation Materialization Port V1**: the content-runtime-only Interface for typed targets, connected anchors, a materialization token, and bounded locate. It does not expose body text.
- **Conversation Index**: the unique navigation projection that combines canonical order with optional materialized anchors. Directory, stepper, locate, and bookmark navigation use it without depending on body parsing.
- **Round identity**: typed `userMessageId`, `assistantMessageId`, and graph round/node aliases. Prompt text and DOM-local position are presentation data, never identity.
- **Lifecycle signal**: a route, `pageshow`, PageIndex, generation or passive-bridge event that wakes the owning Session. Signals may bind an epoch or flush local work; they never become a second discovery path or a polling loop.
- **Content token**: the immutable canonical snapshot token. It changes when document identity, typed order/identity, Markdown, or provenance changes; state transitions and DOM remounts do not manufacture it.
- **Materialization token**: the current typed-target-to-DOM projection revision. Host virtualization/remounting may change it without changing the content token.
- **Surface token**: the identity of the concrete rendered content root used to capture interaction evidence. Replacing that root invalidates an old selection even if content and materialization tokens are unchanged.

## ChatGPT Atomic Selection Copy

- **Atomic Markdown shortcut**: `chatgptBehavior.atomicMarkdownCopyShortcut` is the only ChatGPT direct-selection Markdown copy control. It is `none`, `mod-c` (`Ctrl/Cmd+C`), or `mod-shift-c` (`Ctrl/Cmd+Shift+C`); fresh installs default to `mod-shift-c`, while legacy `atomicMarkdownCopy` values migrate to `mod-c` or `none`.
- **Keyboard-only exit**: ChatGPT direct selection no longer creates a copy button or inverse action. Ordinary, structured, and formula selections use Surface Projection to recover canonical source Markdown. The old strict atomic DOM converter remains only for legacy composition roots that have no canonical content/materialization ports; it is never revived after a production semantic projection rejects evidence. Invalid, editable, streaming, cross-message, ambiguous, stale, reconstructed, or DevTools-consumed configured shortcuts fail closed without publishing visual text; the host remains untouched when the shortcut is disabled or no canonical ports exist.

## Reader Annotations (v1 shipped)

- **Annotation document**: one verified ChatGPT conversation identified by `{ platform: 'chatgpt', conversationId }`. Its title and last URL are display/navigation hints, never identity.
- **Annotation target**: the selected source inside a canonical assistant message. `assistantMessageId` is the required semantic identity; round/user IDs and position are supporting or presentation data.
- **Re-anchoring**: restoring a saved selection after Reader content or DOM structure changes. v1 accepts only a validated exact match through DOM/atomic selectors, TextPosition, or TextQuote; an ambiguous match becomes `unanchored`.
- **Pending annotation navigation intent**: a short-lived background-owned request bound to a newly created ChatGPT tab. After the tab exposes a verified conversation identity, it opens Reader at the target assistant message and focuses the annotation. It is navigation state, not annotation data or conversation identity.
- **Annotation persistence preference**: `reader.persistAnnotations`, an explicit opt-in setting shared by Reader Settings and the annotation manager. It controls whether newly created ChatGPT annotations enter the profile-local per-conversation bundle. Existing durable annotations are always read, displayed, edited, and deleted normally; disabling the preference only keeps future annotations in the current page runtime.
- **Annotation excerpt**: the manager’s source preview keeps up to 50 Unicode characters at each end and replaces omitted middle content with one ellipsis.
- **Bulk annotation edit**: a simple manager selection mode with select-all for visible rows and one confirmed batch deletion; it is not a separate notes workspace or export surface.
