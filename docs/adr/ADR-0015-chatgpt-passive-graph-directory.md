# ADR-0015: ChatGPT directory uses the unified content source

## Status

Superseded by ADR-0018. The passive Graph remains optional once-per-canonical-
epoch evidence for hidden history, while stable typed DOM may establish or
append to the one pool even before a canonical ID exists. Directory now
consumes the atomic Conversation Surface rather than a standalone index.

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

For ChatGPT, the directory's canonical source is the same baseline-and-tail
Content Port used by every whole-turn consumer:

```text
website-owned conversation GET
  -> document_start MAIN-world bridge
  -> once-only validated history baseline --------+
stable typed DOM successor -> rendered compiler --+
                                                   -> ConversationContentRepository
  -> ChatGPTConversationIndex
  -> ChatGPTDirectoryController
```

The bridge may only observe the website's own same-origin conversation `GET`
through a transparent `window.fetch` wrapper. It may clone and parse the
already-returned response for an in-memory evidence snapshot, but it must not
issue a conversation request, read cookies/storage/tokens/authorization
headers, inspect generation payloads, or create POST/SSE/WebSocket traffic.

The Source Adapter validates conversation identity, parent-chain termination,
node identity, current branch and complete assistant content before admitting
the one Graph baseline. The Host Monitor may subsequently append only a typed,
stable, compiler-verified successor to the sealed tail. DOM-local ordinals
never become directory order; new host turns receive their Repository ordinal
only after predecessor validation.

Directory navigation uses a two-stage, user-initiated operation: resolve the
canonical typed target to the persistent host slot, then wait for the exact
message identity to hydrate. If the slot topology cannot be proven, navigation
fails closed. Ratio, pixel probing, binary search, synthetic scrolling, and
DOM text/ordinal fallbacks are not allowed.

The existing V1 content/materialization seams remain the single ChatGPT
consumer seam. `RenderedContentCompilerV2` is used only behind the shared Host
Monitor; the standalone V2 discovery module remains outside the production
composition. Neither topology nor Materialization is a second source of
complete history.

## Consequences

- Off-screen directory entries display graph user prompts immediately after a
  passive graph capture, even when their DOM shells are empty.
- A missed first response requires a page refresh; no active network recovery
  is added.
- A partial, invalid, branch-conflicted, or unavailable graph cannot produce
  guessed directory labels.
- Refresh, scrolling, and directory clicks do not add conversation requests.
- Reader, word count, whole-message copy, Bookmark Preparation and Save
  Messages export all read the same V1 source/hybrid/host-born snapshot. Exact
  local selection and annotation still require source-span proof. The
  materialization adapter maps currently mounted typed surfaces and may expose
  a pending toolbar anchor before content sealing.
