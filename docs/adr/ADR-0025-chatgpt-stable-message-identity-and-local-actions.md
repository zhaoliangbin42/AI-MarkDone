# ADR-0025: ChatGPT stable message identity and DOM-local actions

## Status

Accepted

## Context

ADR-0024 made rendered ChatGPT DOM the only production body authority, but the
remaining projection still makes current-message UI wait for Repository
admission. That dependency is unnecessary: mounting a toolbar, copying one
rendered message, opening that message in Reader, exporting it, or acting on a
selection only needs the currently mounted message DOM. The Repository is
needed for accumulated multi-message state, not as permission to use a live
message.

Live inspection of a long ChatGPT conversation also separates identity from
order:

- the direct assistant `data-message-id` and the enclosing `data-turn-id`
  remain stable when older history is loaded and mounted windows change;
- `data-testid="conversation-turn-N"` is renumbered when earlier history is
  inserted (for example, the same stable message moved from 26 to 36);
- the UUID-like message and turn IDs do not encode a numeric position, and no
  stable host-provided ordinal was present on the rendered message nodes.

Therefore no single official attribute can truthfully mean both "this message"
and "this message is permanently number N".

## Decision

### Current-message path

- `ChatGPTPageIndex` remains the only page observer and the only owner of
  mounted message/action-row facts.
- The official action row authorizes toolbar placement for the corresponding
  mounted assistant message. Toolbar mounting does not wait for Repository
  membership, a content token, or global order.
- Current-message content actions resolve one DOM-local message snapshot keyed
  by the direct assistant `data-message-id`. The same snapshot may feed
  whole-message copy, current-message Reader/export and Repository ingestion,
  but those consumers do not gate one another. Persistent bookmark submission
  remains the deliberate exception: it still needs canonical conversation
  identity and a pool-proven position.
- Selection copy and annotation resolve the owning mounted message and current
  Range when the user invokes the action. They do not require a previously
  captured Repository turn. Formula actions continue to read formula DOM and
  parser metadata directly.

### Pool identity and order

> Superseded in part by ADR-0026: the production Repository now orders bodies
> through the persistent outer host-slot sequence instead of mounted-assistant
> overlap. The stable assistant identity and DOM-local action decisions in this
> ADR remain active.

- `assistantMessageId` from direct `data-message-id` is the stable pool key.
  `data-turn-id` is retained only as grouping identity when available. Neither
  value is sorted lexically or interpreted as an ordinal.
- Each PageIndex snapshot contributes the mounted assistant IDs in document
  order. The Repository merges that ordered ID sequence with the accumulated
  sequence by stable-ID overlap.
- A prefix, middle run or tail is inserted only where existing overlap anchors
  establish a non-conflicting position. Existing relative order never changes,
  and ordinals are regenerated densely as `1...N` after a successful merge.
- `conversation-turn-N` may be logged in diagnostics as a current-host hint,
  but it is never persisted, exposed as canonical position, or used by itself
  to reorder the pool.
- Content from a completely disconnected mounted window may be retained by ID,
  but it is not published into the ordered snapshot until a later PageIndex
  observation overlaps an already ordered ID. The system does not invent an
  absolute relationship that the DOM has not demonstrated.
- Same-ID equal content is a no-op; changed eligible DOM replaces that ID's
  body. Virtualized removal never deletes accepted content. A page reload
  clears all tab-local pools.
- After a complete user/assistant pair has compiled successfully, a later pure
  structural remount of the same stable assistant ID only refreshes mounted
  order and host surfaces; it does not clone or compile the same body again.
  Content/identity mutations, generation completion, page-lifecycle wakes and
  assistant-only captures that may regain their user prompt still compile.

### Scope

- Reader and multi-message export consume the ordered pool. Directory and
  Stepper may continue to display the partial pool but receive no new
  completeness or navigation work in this phase.
- Public content schemas, browser permissions, storage, formula contracts and
  non-ChatGPT adapters remain unchanged.
- No second observer, polling, Graph bridge, network discovery or private React
  state is introduced.

## Consequences

- A rendered completed message gets its plugin toolbar even if semantic
  compilation or cross-window ordering is still pending.
- Current-message and selection actions remain available during slow loading,
  virtualization and partial-history states because they use the live DOM the
  user is acting on.
- The content pool has strict stable identity and monotonic proven order without
  pretending that ChatGPT's mutable test index is permanent.
- An entirely disconnected history window can be temporarily absent from
  ordered multi-message Reader/export output. This is an explicit information
  boundary, not a retry timeout; a later overlapping DOM observation connects
  it without refetching.
- This ADR refines ADR-0024. It supersedes the remaining rules that make
  current-message Toolbar, Copy, Reader, Export, Selection or Annotation
  availability depend on Repository admission or an `obtained` Conversation
  Surface state. Bookmark persistence keeps its canonical identity/position
  requirement.
