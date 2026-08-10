# ADR-0009 ChatGPT Conversation Content Port V1

## Status

Superseded as a lifecycle design by ADR-0017. The public V1 content and
materialization contracts remain active, but this ADR's active GET,
source-only body and generic `reconcile()` scheduling rules must not be used as
current implementation guidance.

## Context

ChatGPT content discovery currently has several producers and consumers that can observe different moments of the page lifecycle. A route change, a late content-script attach, a virtualized DOM remount, and a passive network observation can therefore produce different partial views of one conversation. Consumers then have to guess whether an empty or incomplete view is temporary, which is why new conversations, appended turns, and hard refreshes are not consistently available.

The durable fix is a small semantic port with one coordinator. Host selectors, page-bridge transport, endpoint details, DOM anchors, and provider payloads must remain adapter concerns. Readers, Directory, Copy, Save Messages, Bookmarks, and annotations need one immutable, typed snapshot instead of their own discovery fallbacks.

## Decision

Introduce two content-runtime contracts:

- `ConversationContentSourceV1` publishes an immutable `ConversationSnapshotV1` for one verified document, with explicit `idle`, `syncing`, `ready`, `stale`, and `unavailable` states.
- `ConversationMaterializationPortV1` maps the current DOM window to typed conversation targets and locates a target without changing the semantic snapshot.

ADR-0017 is the current realization of these contracts. One page-scoped
`ConversationContentRepository` admits one passively observed Graph baseline
per conversation epoch and then accepts only stable, typed, contiguous host
tail turns from the shared Page Monitor. The extension performs no conversation
GET/POST. `refresh()` only awaits or returns work already observed by the
Session; it cannot start baseline admission or reopen the gate.

The Graph owns the complete existing-history prefix. A typed DOM turn can
create a `host-born` first projection only after a full scan proved the page was
empty, or extend a source/host tail through an exact predecessor identity. It
cannot fill a historical gap or overwrite the baseline prefix. Proof includes
`basis: source | hybrid | host-born`; sealed projections are immutable and
regeneration creates a new `projectionId`. Consumers never receive provider
payloads or selectors through the semantic port; DOM handles remain confined
to the content-runtime Materialization Port.

## Consequences

- New conversations, appended turns, hard refresh, BFCache restore, and virtualized remounts share one baseline-and-host-tail lifecycle.
- Content consumers have a stable future-facing seam. V1 may add optional fields; breaking changes require V2.
- `ReaderItem[]` remains a downstream display projection and detached Reader compatibility format; no existing annotation, bookmark, or session persistence schema changes in this refactor.
- The old Engine/Reducer compatibility path has been removed from production. Non-ChatGPT platforms may retain their existing legacy DOM Reader path until a separate platform refactor.
- No persistent conversation cache, new browser permission, background protocol, or permanent polling is introduced.
- Installed-browser host behavior remains an explicit release-acceptance gate, not an assumption derived from automated fixtures.

## Verification

Current evidence is recorded in `docs/testing/CHATGPT_CONTENT_DISCOVERY_GATES.md`.
Installed Chrome/Firefox acceptance and the performance gate remain separate
from contract, Repository, Host Monitor, materialization and consumer tests.
