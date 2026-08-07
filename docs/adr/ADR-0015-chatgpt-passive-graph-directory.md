# ADR-0015: ChatGPT directory uses the passive graph source

## Context

ChatGPT renders a virtualized conversation: the page can retain a complete
conversation response while only a small DOM window contains hydrated message
surfaces. The Slot Topology implementation is useful for materialization, but
it cannot provide real user prompts for shell entries. The directory therefore
must not use DOM labels, local DOM ordinals, or a pixel-based seeker as its
content source.

The earlier repository and bridge already had a working boundary for observing
the conversation graph that ChatGPT itself requests. The current runtime had
drifted away from that boundary and consequently rendered `Message N` for
off-screen entries.

## Decision

For ChatGPT, the directory's canonical source is the passive graph path:

```text
website-owned conversation GET
  -> document_start MAIN-world bridge
  -> validated mapping/current_node parser
  -> ConversationContentRepository
  -> ChatGPTConversationIndex
  -> ChatGPTDirectoryController
```

The bridge may only observe the website's own same-origin conversation `GET`
through a transparent `window.fetch` wrapper. It may clone and parse the
already-returned response for an in-memory evidence snapshot, but it must not
issue a conversation request, read cookies/storage/tokens/authorization
headers, inspect generation payloads, or create POST/SSE/WebSocket traffic.

The adapter validates conversation identity, parent-chain termination, node
identity, current branch, displayable user/assistant messages, and complete
assistant content before publishing a graph candidate. It re-numbers only the
validated graph projection for the existing V1 display position. DOM facts are
limited to materialization and anchor lookup.

Directory navigation uses a two-stage, user-initiated operation: resolve the
canonical typed target to the persistent host slot, then wait for the exact
message identity to hydrate. If the slot topology cannot be proven, navigation
fails closed. Ratio, pixel probing, binary search, synthetic scrolling, and
DOM text/ordinal fallbacks are not allowed.

The existing V1 content/materialization seams remain public and are now the
single ChatGPT consumer seam. The V2 slot/compiler module is not injected into
the production runtime; it remains isolated for focused topology/compiler
tests only. It is not a second source of content, identity, order, or
materialization.

## Consequences

- Off-screen directory entries display graph user prompts immediately after a
  passive graph capture, even when their DOM shells are empty.
- A missed first response requires a page refresh; no active network recovery
  is added.
- A partial, invalid, branch-conflicted, or unavailable graph cannot produce
  guessed directory labels.
- Refresh, scrolling, and directory clicks do not add conversation requests.
- Reader, word count, whole-message copy, Bookmark Preparation, local
  selection, formula copy, and Save Messages export all read the same V1
  graph-backed snapshot. The materialization adapter is used only to map a
  currently mounted element to that snapshot's typed identity.

## Status

Accepted — ChatGPT directory implementation active; installed-browser
acceptance remains a required release check.
