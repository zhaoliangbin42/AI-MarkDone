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

The host already exposes one practical completion seam for ordinary assistant
messages: the official copy action row. The rendered assistant DOM is also the
only source required by the existing Markdown parser Adapter.

## Decision

- Rendered ChatGPT DOM is the only production content authority. The passive
  Graph bridge, Graph Adapter, baseline lifecycle and Graph diagnostics leave
  the production chain.
- `ChatGPTPageIndex` remains the only page observer. Runtime initialization,
  relevant DOM mutations and page wake events schedule one short page-level
  reconciliation; there is no polling or bounded retry ladder.
- An ordinary assistant message is eligible when it has a direct non-empty
  `data-message-id`, non-empty rendered content, its official copy action row,
  and no active generation state. Deep Research retains its existing verified
  report anchor.
- Each eligible message is cloned and converted through the existing Markdown
  Adapter once per changed DOM digest. The official action row is completion
  and placement evidence, never body content.
- The Repository owns one in-memory pool per conversation key in the current
  tab. SPA navigation switches the active pool without deleting other pools;
  a full page reload naturally resets all pools. Pools retain only immutable
  identity, text, Markdown, order and digest data, never DOM handles.
- The same assistant identity is idempotent when content is equal and is
  replaced by the latest eligible DOM body when content changes. Virtualized
  DOM removal never removes obtained content.
- Public Content Source, Surface and consumer contracts remain unchanged.
  `historyStatus` is always `partial`; the extension does not claim content
  that ChatGPT has not rendered.
- Formula click and formula asset actions read authoritative TeX directly from
  the parser Adapter and do not require Repository membership.

## Consequences

- Reader, copy, export and toolbar availability follow content the user has
  actually loaded and no longer depend on a private response shape.
- Slow loading has no fixed failure window: the official action row or a later
  page wake schedules the same reconciliation whenever the message becomes
  ready.
- The runtime removes bridge injection, response cloning/parsing, Graph gates,
  weak/strong completion tiers, deferred queues and retry sweeps.
- Directory completeness is intentionally outside this decision. It can only
  display the partial content pool accumulated in the current tab.
- ADR-0018 through ADR-0022 remain historical records; their Graph admission,
  Graph upgrade and bounded-resweep production rules are superseded here.
