# ADR-0024: ChatGPT DOM-authoritative content pool

## Status

Accepted

## Context

ChatGPT no longer guarantees that one website response contains the complete
conversation. The passive Graph bridge therefore adds parsing, baseline gates,
upgrade probes and retry state without guaranteeing that Reader, copy or export
can use every message that is already rendered on the page. Those local
features only need trustworthy content for messages the user has actually
loaded.

The host exposes two useful DOM seams: the official copy action row for an
individual completed assistant body, and the `?message=` conversation route
trigger, which makes ChatGPT publish its full navigation/slot skeleton after a
reload. The rendered assistant DOM is still the only body source required by
the existing Markdown parser Adapter.

## Decision

- Rendered ChatGPT DOM is the only production content authority. The passive
  Graph bridge, Graph Adapter, baseline lifecycle and Graph diagnostics leave
  the production chain.
- `ChatGPTPageIndex` remains the only page observer. Normal page lifecycle and
  DOM mutations use the existing short page-level reconciliation. An explicit
  `?message=` reload may start one bounded full-history materialization sweep,
  but that sweep reuses PageIndex, Host Monitor and Surface signals; it does
  not create another observer, polling loop, or per-message timer.
- An ordinary assistant message is eligible when it has a direct non-empty
  `data-message-id`, non-empty rendered content, its official copy action row,
  and no active generation state. Deep Research retains its existing verified
  report anchor.
- Each eligible message is cloned and converted through the existing Markdown
  Adapter once per changed DOM digest. The official action row is completion
  and placement evidence, never body content. A full-history sweep is entered
  only after the host's official navigation skeleton is present and walks the
  persistent outer slots to materialize missing bodies.
- The Repository owns one in-memory pool per conversation key in the current
  tab. SPA navigation switches the active pool without deleting other pools;
  a full page reload naturally resets all pools. Pools retain only immutable
  identity, text, Markdown, order and digest data, never DOM handles.
- The same assistant identity is idempotent when content is equal and is
  replaced by the latest eligible DOM body when content changes. Virtualized
  DOM removal never removes obtained content.
- Public Content Source, Surface and consumer contracts remain unchanged.
  `historyStatus` is `partial` until the official navigation expected count
  and every assistant body have been observed, then becomes `complete`.
  Full-discovery and ordinary DOM-fallback observations share the same pool;
  a later DOM body for an existing assistant identity always wins.
- Formula click and formula asset actions read authoritative TeX directly from
  the parser Adapter and do not require Repository membership.

## Consequences

- Reader, copy, export and toolbar availability follow content the user has
  actually loaded and no longer depend on a private response shape.
- Slow loading has no fixed failure window for ordinary DOM capture. An
  explicit full-history sweep is bounded and cancellable; failure preserves a
  usable partial pool and can be retried by the same `?message=` action.
- The runtime removes bridge injection, response cloning/parsing, Graph gates,
  weak/strong completion tiers, deferred queues and retry sweeps.
- Directory, Reader and Save Messages continue to consume the one pool. They
  display partial content honestly before the explicit full-history action and
  can consume the complete ordered pool after the sweep succeeds. Current
  message copy, word count and formula actions remain mounted-DOM consumers.
- ADR-0018 through ADR-0022 remain historical records; their Graph admission,
  Graph upgrade and bounded-resweep production rules are superseded here.
