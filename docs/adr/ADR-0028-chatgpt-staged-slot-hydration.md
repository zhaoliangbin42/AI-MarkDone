# ADR-0028: ChatGPT staged host-slot hydration

## Status

Accepted

## Context

ChatGPT can create the outer `data-turn-id-container` topology before it
hydrates every message body. A fast virtualized scroll can therefore expose a
complete ordered slot sequence while only the slots near the viewport contain
user or assistant content. A user prompt can also be mounted first with an
empty body and receive its text in a later DOM mutation.

The existing DOM-authoritative pipeline already retains the observed outer
slot sequence privately and writes completed assistant bodies by
`hostSlotId`. Its public V1 snapshot intentionally contains only complete,
dense `ConversationTurnV1` values. The missing rule is that topology evidence
and body evidence must be admitted and reconciled independently; otherwise a
late body can remain empty until an unrelated history load causes another full
capture.

## Decision

### Two evidence layers

- The private Repository pool is an ordered host-slot ledger. A slot can be
  known before its message body is mounted; an observed subwindow never
  shrinks the retained sequence.
- A `ConversationTurnV1` remains a semantic, consumable value. It is published
  only after the existing assistant identity, rendered body, completion action
  row and non-generating checks succeed. Unknown raw slots are not fabricated
  into turns or directory counts.
- A raw host slot is not automatically a conversation round: ChatGPT may keep
  separate user and assistant containers. Only a typed mounted round can bind
  a body to an assistant slot. Native search-unit messages may supply only an
  assistant; one exact assistant ID and the existing readiness guards suffice,
  and the absent Prompt is not fabricated.

### Monotonic staged merge

- Existing PageIndex structure/identity events first submit observed stable
  topology, including empty containers; body compilation remains coalesced.
  A transient overlap can therefore connect the next virtual window even
  before that overlap window has completed body compilation.
- Each eligible body is then committed to its exact `hostSlotId` and stable
  `assistantMessageId`. Capture order never determines public order.
- The containing owner's unique exact assistant ID can establish a logical slot
  before its outer marker stabilizes. Identity facts are retained independently
  of body readiness. The same assistant with a compatible user
  pair proves a later marker alias under ADR-0026; temporary empty markers do not
  enter topology, and Prompt hydration preserves the obtained semantic identity.
- A later non-empty user prompt or changed eligible assistant body updates the
  same binding in place. An empty or stale observation cannot erase a complete
  body. Equal content is idempotent.
- Virtualized removal removes only current DOM materialization; it never
  removes the private slot ledger or accepted semantic body.
- The shared-anchor insertion and conflict rules in ADR-0026 remain the topology
  admission rules. A batch viewport hint can place a disjoint run before or
  after retained content when full overlap is missing. This provisional order
  keeps eligible bodies available and may be corrected by later exact mounted
  order; it is not complete-history proof. Repository receipts confirm admitted IDs; refused IDs stay
  dirty for the next real host/lifecycle signal rather than being skipped as
  captured. UUIDs, mutable test ids and arrival order never define identity.
  Exact pair/live-owner and V1 conflicts still reject atomically.

### DOM wake boundary

- User-message character and child-list mutations inside a typed user message
  are content evidence and wake the existing page-level coalesced capture.
- The official assistant action row remains the completion/readiness guard for
  public assistant admission; it is not the source of the body and is not the
  only signal for user-prompt hydration.
- No second observer, per-message timer, polling, network request, bridge,
  private React state or synthetic scroll is introduced. The placement hint reads
  the existing scroll root once per batch before asynchronous compilation; no
  new input listener or lifecycle is required.

### Compatibility

- `ConversationContentCandidateV1`, `ConversationContentSourceV1`,
  `ConversationSnapshotV1`, runtime protocol, storage schema and consumer
  interfaces do not change.
- Public snapshots continue to use dense ordinals for obtained semantic
  turns. Exact mounted order may correct coarse retained placement; empty
  topology alone does not churn `contentToken`. `partial/get` remains truthful
  and cannot become `complete` merely because a disjoint run was placed.
- This decision does not claim hidden history that ChatGPT has not exposed as
  a host slot. It only prevents known topology and late mounted bodies from
  being compressed or lost.

## Consequences

- Fast scrolling and partial hydration become an eventual, in-place merge:
  slots are retained first and bodies appear when the DOM actually provides
  them.
- A delayed user prompt is recoverable from its own DOM mutation instead of
  waiting for an unrelated history event or lifecycle wake.
- Existing Directory, Reader, export, bookmark and navigation contracts keep
  consuming complete semantic turns and are not forced to interpret raw empty
  containers.
- The retained topology is O(N) plain data and each capture remains one linear
  slot read plus the existing eligible-body compilation work.
