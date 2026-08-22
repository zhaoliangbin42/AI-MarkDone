# ADR-0026: ChatGPT persistent host-slot ordering

## Status

Accepted

## Context

ADR-0024 established rendered DOM as the only production body authority, and
ADR-0025 separated current-message DOM-local actions from the accumulated
Repository. The remaining mounted-assistant overlap algorithm still cannot
place a newly hydrated, disconnected historical window without first seeing an
overlap. That is unnecessary because ChatGPT already keeps a stable outer slot
list for the active display branch while virtualizing the message bodies inside
those slots.

Live inspection of an aggressively scrolled long conversation established the
following host facts:

- the outer `data-turn-id-container` sequence grew as
  `10 -> 20 -> 30 -> 40 -> 50 -> 60 -> 62`;
- all six pagination transitions were exactly
  `new sequence = historical prefix + previous sequence`;
- all six `before` cursors equalled the previous sequence's first slot ID;
- no accepted slot was deleted, reordered or rebound, and the initial ten
  slots remained an exact suffix of the final 62 even when intermediate
  mutation events were ignored;
- six sampled initially empty slots later hydrated under the same outer
  `data-turn-id`, in their original positions; and
- raw responses included internal messages that never became page slots, so
  response order is not the displayed-conversation order authority.

The outer slot ID is therefore a stable position identity for the current
active display branch. It is not a numeric ordinal and does not reveal history
that ChatGPT has not loaded.

## Decision

### Host topology

- The driver collects only the largest same-parent sequence of outer
  `data-turn-id-container` elements. It excludes the `client-created-root`
  sentinel, blank IDs, duplicate IDs and repeated markers on hydrated inner
  wrappers.
- The complete observed outer-slot sequence is the sole ordering authority.
  `hostSlotId` identifies a position; direct assistant `data-message-id`
  identifies a body. Neither may substitute for the other, and neither is
  sorted lexically or decoded as an ordinal.
- A mounted assistant round is bound only to the collected outer slot that
  actually contains it.

### Repository merge and projection

- Each conversation pool retains an internal ordered slot skeleton plus the
  accepted assistant-body-to-slot bindings. Empty slots remain private
  Repository state and are not exposed through the V1 contract.
- If the old slot sequence is a contiguous segment of the new sequence, the
  Repository adopts the new sequence. This admits a historical prefix, a new
  tail, or both in one observation.
- If the new sequence is a contiguous segment of the old sequence, it is only
  a currently mounted subwindow and cannot shrink the retained skeleton.
- Conflicting or unrelated sequences do not rewrite established order. The
  Repository does not use UUID shape, timestamps, mutable
  `conversation-turn-N`, scroll direction, predecessor inference or LCS to
  guess a position.
- A body is written at its `hostSlotId`. Conflicting assistant-to-slot or
  slot-to-assistant bindings are rejected without changing the published
  snapshot.
- Public V1 snapshots scan the slot skeleton and project only slots whose
  assistant bodies have been obtained. Their ordinals are regenerated densely
  as `1...N`; stable identity and relative order remain authoritative even if
  inserting older bodies shifts those derived ordinals.
- Empty-slot growth alone does not publish a snapshot or change
  `contentToken`. Equal body digests are idempotent, changed eligible DOM
  replaces the same body, and virtualized removal deletes neither slots nor
  accepted content.
- Pools remain tab-local and per-conversation. A full page reload or Runtime
  disposal clears their in-memory topology and bodies.

### Lifecycle and scope

- `ChatGPTPageIndex` remains the only observer. Each existing coalesced Host
  Monitor capture reads the full outer slot sequence once, then compiles only
  eligible mounted bodies and submits their slot bindings.
- No observer, polling, per-message timer, network request, Graph discovery,
  React private-state access or production scrolling is introduced.
- DOM remains the only body authority. History not yet loaded by ChatGPT has no
  fabricated slot or count, and `historyStatus` remains `partial`.
- Public schemas and all Content Port, Surface, Directory, Reader, Copy,
  Export, Bookmark, Annotation and formula interfaces remain unchanged.

## Consequences

- Historical content hydrated after aggressive scrolling fills its original
  host position instead of being appended to the tail.
- The Repository can preserve known empty positions without forcing existing
  consumers to understand partial slots.
- A host sequence conflict fails closed for global order while DOM-local
  actions remain available for the mounted message.
- This ADR supersedes ADR-0025 only for mounted-assistant overlap ordering and
  predecessor inference. ADR-0025's stable assistant identity and DOM-local
  current-message action decisions remain in force.
