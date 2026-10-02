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

These observations established outer slots as useful position evidence. Later
modern-host inspection found temporary outer markers and rebased search keys,
so an outer marker alone cannot define semantic identity. It does not reveal
history that ChatGPT has not loaded.

## Decision

### Host topology

- The driver collects the largest same-parent sequence of outer
  `data-turn-id-container` elements and the current outer `data-turn-key`
  sequence. It excludes the `client-created-root`
  sentinel, blank IDs, duplicate IDs and repeated markers on hydrated inner
  wrappers.
- Exact assistant message ID defines a body; compatible user ID validates its
  pair, scoped to the current conversation pool. Containing host slots supply
  ordering evidence, never lexical or numeric order. When neither outer marker
  is stable, a unique exact contained assistant ID proves a logical slot, named
  by its unique contained user ID when paired. User-only provisional owners,
  empty temporary `fallback-turn-*` markers and ambiguous
  message IDs are omitted; raw markers remain available for DOM lookup.
- A mounted assistant round is bound only to the collected outer slot that
  actually contains it. Window-local `fallback-turn-*` search keys remain
  display selectors; semantic turn IDs use stable explicit/user/assistant
  identity and cannot collide when a window is renumbered.

### Repository merge and projection

- Each conversation pool retains an internal ordered slot skeleton plus the
  accepted assistant-body-to-slot bindings. Empty slots remain private
  Repository state and are not exposed through the V1 contract.
- The 2026-10-01 pragmatic refinement preserves retained order and inserts a
  newly observed range before its next shared stable anchor, or after the last
  shared anchor at the tail. It accepts prefixes, tails, rolling overlaps and
  interior insertion without requiring a unique global interleaving. When an
  unseen range admits several placements, retained content keeps its order and
  the current window's next neighbour determines insertion. This is a deliberate
  compatibility compromise. Accepted source identity order can connect otherwise
  disjoint windows; mounted subwindows retain obtained content.
- When shared/source anchors are absent, the existing Host Monitor can supply
  one batch placement hint from the current conversation scroll root. Within
  one viewport of the latest end, the run follows retained content; farther
  from that end, it precedes it. Normal and `column-reverse` roots use their
  existing coordinate conventions. This coarse placement admits eligible bodies
  rather than waiting indefinitely for total-order proof. A later exact mounted
  sequence can correct tentative order or inconsistent historical topology.
  Without a usable hint or anchors, order remains deferred.
- Exact message/pair conflicts, simultaneously competing owners and invalid
  public V1 projections are refused without changing state. UUID shape,
  timestamps, mutable `conversation-turn-N` and arrival order are never message
  identity; the viewport hint is only placement, never full-history proof.
  A refusal is an explicit admission result, not capture success.
- A body is written at its `hostSlotId`. Conflicting assistant-to-slot or
  slot-to-assistant bindings are rejected without changing the published
  snapshot. Proposed V1 projection validation happens before private pool
  mutation, so unpublishable duplicate turn/user IDs cannot be acknowledged.
- A changed owner marker may alias the existing canonical slot only when the
  exact assistant and compatible user pair prove continuity. Keep the existing
  semantic turn ID/key; a late Prompt enriches the same body. Stage aliases,
  normalized topology and bodies together. Exact topology identity is retained
  independently of body readiness, so an uncompiled placeholder can later prove
  its marker alias without fabricating a body. Competing live positions and
  different users/assistants reject atomically. Historical topology conflicts
  remain deferred without placement evidence; an available batch hint may repair
  them while preserving exact message ownership. Aliases contain plain data in
  the existing conversation pool.
- Public V1 snapshots scan the slot skeleton and project only slots whose
  assistant bodies have been obtained. Their ordinals are regenerated densely
  as `1...N`; stable identity remains authoritative, while insertion or correction
  of provisional order can shift those derived ordinals.
- Empty-slot growth alone does not publish a snapshot or change
  `contentToken`. Equal body digests are idempotent, changed eligible DOM
  replaces the same body, and virtualized removal deletes neither slots nor
  accepted content.
- Pools remain tab-local and per-conversation. A full page reload or Runtime
  disposal clears their in-memory topology and bodies.

### Lifecycle and scope

- `ChatGPTPageIndex` remains the only observer. Existing structure/identity observations record topology immediately before
  the body debounce can skip a transient overlap window. Content-only changes
  retain coalesced capture. Each body capture still reads one current slot
  sequence and compiles only eligible mounted bodies. Capture bookkeeping
  follows Repository acknowledgment, including idempotent admission. A batch
  placement hint is sampled before asynchronous compilation; it adds no listener,
  observer, polling, timer or automatic scroll.
- No observer, polling, per-message timer, network request, Graph discovery,
  React private-state access or production scrolling is introduced.
- Eligible DOM remains the body-correction authority over the existing GET seed.
  Native assistant-only search units can supply a completed body under one exact
  assistant ID; a missing Prompt is nullable and may hydrate later. History not
  yet loaded by ChatGPT has no fabricated slot or count; `partial/get` does not
  claim complete history or an exact order for a provisionally placed run.
- Public schemas and all Content Port, Surface, Directory, Reader, Copy,
  Export, Bookmark, Annotation and formula interfaces remain unchanged.

## Consequences

- Historical content hydrated after aggressive scrolling enters the same pool
  through exact anchors or coarse batch placement; later mounted evidence can
  refine its position without losing the obtained body.
- The Repository can preserve known empty positions without forcing existing
  consumers to understand partial slots.
- Incomplete global-order evidence no longer blocks valid body admission when
  batch placement is available. Exact identity and live ownership conflicts
  still fail closed; DOM-local actions remain available for the mounted message.
- This ADR supersedes ADR-0025 only for mounted-assistant overlap ordering and
  predecessor inference. ADR-0025's stable assistant identity and DOM-local
  current-message action decisions remain in force.
