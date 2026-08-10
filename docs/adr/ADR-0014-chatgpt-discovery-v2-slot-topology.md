# ADR-0014 ChatGPT Discovery V2: Slot Topology and One-shot Hydration Capture

## Status

Superseded as a standalone production module by ADR-0017. Its
`RenderedContentCompilerV2`, stable-capture and surface-fencing ideas are now
used behind the shared Host Monitor; `ConversationDiscoveryModuleV2` and
`ChatGPTVirtualConversationHostAdapter` are not a second production repository
or observer. Installed Chrome MV3 and Firefox MV2 acceptance remains separate.

## Context

ChatGPT keeps persistent conversation-shaped slots while only a subset of turns
is hydrated as message content. Treating that mounted window as complete
history caused old turns to disappear, positions to drift and consumers to use
different body sources. This ADR explored a DOM-first module; ADR-0017 later
combined its validated compiler with the passive Graph baseline.

## Decision

For ChatGPT, use one page-scoped `ConversationDiscoveryModuleV2` with two evidence inputs and one public port:

- `ChatGPTVirtualConversationHostAdapter` observes one public-DOM mutation stream and emits only slot topology, typed identity/lifecycle, mount/unmount, and anchor facts. It never creates canonical Markdown, position, network requests, or credentials. A shared host `data-turn-id` is preferred; when the current page exposes no shared turn ID on the hydrated role nodes, the adapter derives a typed round ID from the paired user/assistant message IDs after topology decoding. The per-role `conversation-turn-N` test ID, text, DOM ordinal, and layout are never used as identity.
- `decodeSlotTopologyV2` derives the complete ordered round list from the unique top-level sibling marker cohort. It fails closed for ambiguous cohorts, duplicate keys, or an unprovable role phase. Shells are directory facts; DOM indexes, text, CSS classes, heights, and intersection state are not identity.
- `RenderedContentCompilerV2` clones a stable user/assistant surface, removes UI chrome, reads formula/code source through injected parser capabilities, compiles semantic HTML, and rejects empty, unsupported, over-budget, or semantically mismatched output. It publishes no partial Markdown.
- The Discovery Module normalizes `order + byId` state, fences document epoch/host revision/batch identity, seals the first verified turn digest, preserves it across unmount/remount, and exposes only `ready` or `unavailable` for a single turn. Identity conflicts and branch suffix replacement fail closed.
- Topology, content, and materialization revisions/tokens are independent. Topology changes update position; content sealing updates turn availability; remounts update anchors only. A local `refresh()` flushes already observed compile work but never acquires, scrolls, polls, or waits for future content.
- The standalone Discovery Module was not promoted. ADR-0017 reuses
  `RenderedContentCompilerV2` inside `ChatGPTConversationHostMonitor`, which
  consumes the existing PageIndex observer and submits only stable contiguous
  host tails to `ConversationContentRepository`. Slot/topology code remains
  navigation/materialization or experimental evidence, not another content
  source.
- Local selection evidence is a typed V2 ref + turn token + surface token + TextQuote/atom evidence. The V2 `SurfaceProjection` resolves it against the sealed Markdown; it never treats `Range.toString()` or formula glyph text as Markdown/TeX. Formula clicks use the same V2 turn read.
- Bookmark save requires user body, assistant canonical Markdown, assistant message ID, topology position, and the current turn revision from one read. Existing bookmark storage/data shapes are unchanged.
- Locate is bounded and event-driven: one coarse slot `scrollIntoView`, then an Observer-driven precise anchor alignment. User input, route changes, AbortSignal, or timeout cancel it. No ratio search, pixel probing, hidden scroll, synthetic scroll loop, network request, cookie/storage/token/auth-header access, POST/SSE construction, or React internals are permitted.

## Consequences

- The production directory and content consumers follow one immutable
  baseline-prefix/host-tail snapshot; a refresh cannot replace it or reopen the
  baseline gate.
- Virtualization can remove and recreate DOM surfaces without deleting sealed content or recompiling identical content.
- Page wrapper/class changes are isolated to the ChatGPT Host Adapter and fixtures; semantic compiler, consumers, bookmark model, and navigation contracts remain unchanged.
- Sparse materialization is explicit and does not reduce content. Full Reader
  and full export accept complete source, hybrid or host-born projections and
  pause when the projection is stale.
- The V2 slot-only path is not an active consumer source. The passive bridge
  provides one baseline and the shared Host Monitor provides subsequent stable
  turns to the same Repository; no extension-issued conversation request is
  allowed.

## Verification

Focused tests cover topology ambiguity and prepend, observer races, one-shot hydration, unmount/remount sealing, compiler formula/code/table/noise validation, epoch/batch/identity fencing, two-stage locate, Reader/Bookmark convergence, V2 selection/formula projection, no-fetch behavior, and sparse export gating. Repository gates and installed dual-browser acceptance are recorded in `docs/testing/CURRENT_TEST_GATES.md`.
