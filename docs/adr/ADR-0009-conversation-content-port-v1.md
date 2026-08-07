# ADR-0009 ChatGPT Conversation Content Port V1

## Status

Accepted — implementation active; installed-browser release acceptance open. This decision supersedes the passive-only acquisition constraint in ADR-0007. The candidate-merge and strict-prefix portions are superseded by ADR-0013.

## Context

ChatGPT content discovery currently has several producers and consumers that can observe different moments of the page lifecycle. A route change, a late content-script attach, a virtualized DOM remount, and a passive network observation can therefore produce different partial views of one conversation. Consumers then have to guess whether an empty or incomplete view is temporary, which is why new conversations, appended turns, and hard refreshes are not consistently available.

The durable fix is a small semantic port with one coordinator. Host selectors, page-bridge transport, endpoint details, DOM anchors, and provider payloads must remain adapter concerns. Readers, Directory, Copy, Save Messages, Bookmarks, and annotations need one immutable, typed snapshot instead of their own discovery fallbacks.

## Decision

Introduce two content-runtime contracts:

- `ConversationContentSourceV1` publishes an immutable `ConversationSnapshotV1` for one verified document, with explicit `idle`, `syncing`, `ready`, `stale`, and `unavailable` states.
- `ConversationMaterializationPortV1` maps the current DOM window to typed conversation targets and locates a target without changing the semantic snapshot.

ChatGPT uses one `ConversationContentRepository` and one `reconcile()` path. Bootstrap, route, `pageshow`, the shared typed PageIndex observer, passive bridge signals, and explicit refresh only schedule that path. An epoch has at most one acquisition; a new route aborts the previous epoch and late results are discarded.

The adapter first consumes a validated passive graph. If the graph is missing, it performs one same-origin `GET` for the current conversation with a three-second timeout when a real route, lifecycle, generation, host, or explicit refresh signal permits acquisition. It must not read cookies, authorization headers, tokens, generation POST/SSE payloads, or use an endpoint list/fallback transport. A failed read never falls back to DOM body or position evidence; the public result is unavailable unless a complete source graph is later verified. Installed Chrome and Firefox must still verify this path before the release gate is called fully green.

The graph/source adapter owns canonical branch, order, history, and body. Host observations are lifecycle/materialization facts only; they never enter the Ledger as content, position, or Markdown. The first validated semantic digest is sealed, duplicate evidence is idempotent, and divergent evidence is an explicit conflict. `ConversationSnapshotV1.proof` distinguishes order, body, tail, and gap completeness; `ready` means a complete source snapshot exists for the published turns, not that an unfinished tail was guessed. `ConversationTurnReadPortV1` reads an already sealed turn while a newer tail remains unavailable. A document change clears all page-local evidence and publishes `unavailable` until the new source identity is verified. Consumers never receive DOM nodes, selectors, route epochs, proofs, transport, or provider payloads through the semantic port.

## Consequences

- New conversations, appended turns, hard refresh, BFCache restore, and virtualized remounts share one reconciliation lifecycle.
- Content consumers have a stable future-facing seam. V1 may add optional fields; breaking changes require V2.
- `ReaderItem[]` remains a downstream display projection and detached Reader compatibility format; no existing annotation, bookmark, or session persistence schema changes in this refactor.
- The old Engine/Reducer compatibility path has been removed from production. Non-ChatGPT platforms may retain their existing legacy DOM Reader path until a separate platform refactor.
- No persistent conversation cache, new browser permission, background protocol, or permanent polling is introduced.
- Real-browser endpoint behavior remains an explicit release-acceptance gate, not an assumption derived from community clients or stale documentation.

## Verification

Phase evidence is recorded in `docs/testing/CHATGPT_CONTENT_DISCOVERY_GATES.md` and the tracked, redacted fixtures under `tests/testdata/chatgpt/discovery/`. The contract, repository, adapter, materialization, and consumer-boundary automated gates are implemented; the installed Chrome/Firefox active-read flows and open performance gate must still be recorded before release acceptance is complete.
