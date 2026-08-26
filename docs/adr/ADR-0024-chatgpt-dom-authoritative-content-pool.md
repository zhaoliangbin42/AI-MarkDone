# ADR-0024: ChatGPT DOM-authoritative content pool

## Status

Accepted

## Context

ChatGPT no longer guarantees that the mounted DOM contains the complete
conversation. The 5.3-compatible source bridge can provide a useful initial
`mapping/current_node` seed, while the DOM remains the final body and slot-order
authority for completion and correction.

The host exposes two useful DOM seams: the official copy action row for an
individual completed assistant body, and the `?message=` conversation route
trigger, which makes ChatGPT publish its full navigation/slot skeleton after a
reload. The rendered assistant DOM is still the only body source required by
the existing Markdown parser Adapter.

## Decision

- Rendered ChatGPT DOM is the final production content authority. The bounded
  5.3-compatible bridge/source path is an initial seed only; it observes the
  website-owned same-origin GET and never issues a conversation request.
- `ChatGPTPageIndex` remains the only page observer. Normal page lifecycle,
  DOM mutations and the explicit `?message=` navigation skeleton use the
  existing short page-level reconciliation; page entry never starts a whole
  history materialization sweep or a per-slot scroll loop.
- An ordinary assistant message is eligible when it has a direct non-empty
  `data-message-id`, non-empty rendered content, its official copy action row,
  and no active generation state. Deep Research retains its existing verified
  report anchor.
- Each eligible message is cloned and converted through the existing Markdown
  Adapter once per changed DOM digest. The official action row is completion
  and placement evidence, never body content. Missing off-screen bodies remain
  source-backed `get` content until a user explicitly navigates to a target.
- The Repository owns one in-memory pool per conversation key in the current
  tab. SPA navigation switches the active pool without deleting other pools;
  a full page reload naturally resets all pools. Pools retain only immutable
  identity, text, Markdown, order and digest data, never DOM handles.
- The same assistant identity is idempotent when content is equal and is
  replaced by the latest eligible DOM body when content changes. Virtualized
  DOM removal never removes obtained content.
- Public Content Source, Surface and consumer contracts remain unchanged.
  `historyStatus` is `partial` for DOM-only content, `get` after an accepted
  source seed. The current runtime does not force a whole-page DOM sweep to
  manufacture `complete`; GET and ordinary DOM-fallback observations share the
  same pool, and a later DOM body for an existing assistant identity always
  wins.
- Formula click and formula asset actions read authoritative TeX directly from
  the parser Adapter and do not require Repository membership.

## Consequences

- Reader, copy, export and toolbar availability follow content the user has
  actually loaded and no longer depend on a private response shape.
- Slow loading has no fixed failure window for ordinary DOM capture. A
  single-target navigation is bounded and cancellable; failure preserves a
  usable partial/get pool and can be retried by the same navigation action.
- The runtime retains only the bounded source bridge needed for the initial
  `get` seed; it does not restore Graph UI, Settings Retry, active conversation
  requests, or a second consumer path.
- Directory, Reader and Save Messages continue to consume the one pool. They
  display partial/get content honestly while single-target navigation brings a
  requested message into the DOM. Current-message copy, word count and formula
  actions remain mounted-DOM consumers.
- ADR-0018 through ADR-0022 remain historical records; their Graph admission,
  Graph upgrade and bounded-resweep production rules are superseded here.
