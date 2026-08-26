# ADR-0030: ChatGPT GET seed and DOM correction

## Status

Accepted for implementation

## Context

The current DOM-only lifecycle is reliable for mounted messages but cannot
provide the conversation history that ChatGPT keeps outside the virtualization
window. AI-MarkDone previously had a 5.3.0 source-discovery path: a
document-start page bridge observed ChatGPT's own same-origin conversation GET,
kept the validated `mapping/current_node` graph in bridge memory, and exposed a
bounded `peek/readBaseline` seam to the content runtime.

That source path and the current DOM materialization path must converge without
creating two consumer-facing content pools. GET content is useful immediately,
but DOM remains the final authority for body corrections and persistent slot
order.

## Decision

- Restore the 5.3.0 bridge/bootstrap and `ChatGPTConversationDiscoveryAdapter`
  acquisition path for Chrome MV3 and Firefox MV2 only. The extension observes
  the website-owned GET and never issues a conversation GET/POST itself.
- Keep one `ConversationContentRepository` and one `ConversationSurface`.
  GET candidates enter the same pool with source-backed provenance and
  `historyStatus=get`; an admitted body remains usable by Directory, Reader and
  Export.
- The bridge snapshot `rounds` payload is the canonical `ConversationTurnV1`
  shape (`key`, `ordinal`, `identity`, `userText`, `assistantMarkdown`, and
  optional provenance). The adapter validates this contract and does not
  maintain a legacy round DTO or field aliases.
- Add `get` to the history-status contract. `coverage=complete` still means
  every published turn has a complete body; `historyStatus=get` means the
  source seed is usable but whole-history DOM proof is not complete.
- DOM observations for an existing assistant identity always replace GET body
  text and provenance. DOM `data-turn-id-container` order is the final order
  authority. GET mapping order is provisional until it is reconciled with DOM
  slot identity.
- The empty `?message=` query only asks ChatGPT to expose its official
  navigation skeleton. The current runtime does not run a whole-history DOM
  sweep on entry and therefore does not manufacture `historyStatus=complete`.
  Position-only navigation remains forbidden without an independently proven
  complete snapshot; identity navigation may use a `get` snapshot.
- Directory clicks, same-page bookmarks, stepper navigation and post-route
  bookmark restoration share one `ConversationNavigationCoordinator` and one
  platform target-materialization executor. A cross-conversation bookmark may
  reload with `?message=` before the same coordinator resumes the target.
- GET failure, empty payload, invalid identity, or an unproven merge does not
  create an empty snapshot. The existing DOM `partial` behavior remains the
  fallback.
- Current-message Copy, word count, Copy PNG, formula actions, toolbar
  lifecycle, the lower-right `?message=` trigger, and bookmark reload behavior
  remain unchanged.

## Consequences

- A conversation can populate Directory, Reader and Export before its full DOM
  history is materialized, while the UI continues to share one snapshot.
- Bridge timing, host payload changes and missing captures still degrade to the
  existing DOM path; they cannot produce a second source or overwrite a DOM
  body.
- Chrome and Firefox manifests regain a document-start bootstrap and bridge
  resource. Safari remains on its existing DOM-only boundary.
- Diagnostics and snapshots expose `get` internally; no new user-facing status
  copy is introduced.
