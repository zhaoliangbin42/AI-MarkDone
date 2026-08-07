# ADR-0014 ChatGPT Discovery V2: Slot Topology and One-shot Hydration Capture

## Status

Superseded for the production ChatGPT runtime. The V2 slot/compiler module and
its focused tests remain isolated historical/experimental code; the active
composition root is the passive Graph-backed V1 content/materialization pair
recorded in ADR-0015. Installed Chrome MV3 and Firefox MV2 acceptance remains a
separate gate.

## Context

ChatGPT keeps a complete conversation-shaped virtualized slot topology in the public page while only a subset of turns is currently hydrated as message content. Treating the mounted DOM window as the conversation caused old turns to disappear, made directory positions drift, and allowed Reader, Bookmark, local selection, and formula copy to use different body sources. The earlier Source Graph, bridge, backend conversation GET, and DOM-candidate chain are not the implementation basis for this V2.

## Decision

For ChatGPT, use one page-scoped `ConversationDiscoveryModuleV2` with two evidence inputs and one public port:

- `ChatGPTVirtualConversationHostAdapter` observes one public-DOM mutation stream and emits only slot topology, typed identity/lifecycle, mount/unmount, and anchor facts. It never creates canonical Markdown, position, network requests, or credentials. A shared host `data-turn-id` is preferred; when the current page exposes no shared turn ID on the hydrated role nodes, the adapter derives a typed round ID from the paired user/assistant message IDs after topology decoding. The per-role `conversation-turn-N` test ID, text, DOM ordinal, and layout are never used as identity.
- `decodeSlotTopologyV2` derives the complete ordered round list from the unique top-level sibling marker cohort. It fails closed for ambiguous cohorts, duplicate keys, or an unprovable role phase. Shells are directory facts; DOM indexes, text, CSS classes, heights, and intersection state are not identity.
- `RenderedContentCompilerV2` clones a stable user/assistant surface, removes UI chrome, reads formula/code source through injected parser capabilities, compiles semantic HTML, and rejects empty, unsupported, over-budget, or semantically mismatched output. It publishes no partial Markdown.
- The Discovery Module normalizes `order + byId` state, fences document epoch/host revision/batch identity, seals the first verified turn digest, preserves it across unmount/remount, and exposes only `ready` or `unavailable` for a single turn. Identity conflicts and branch suffix replacement fail closed.
- Topology, content, and materialization revisions/tokens are independent. Topology changes update position; content sealing updates turn availability; remounts update anchors only. A local `refresh()` flushes already observed compile work but never acquires, scrolls, polls, or waits for future content.
- This decision was not promoted to the production consumer seam. The active
  runtime uses the passive Graph-backed `ConversationContentSourceV1` for
  identity, prompt, Markdown, order, Reader, word count, copy, Bookmark
  Preparation, formula, selection, and export; `ConversationMaterializationPortV1`
  supplies only current DOM anchors. The V2 module is retained only for
  isolated topology/compiler experiments until it is either removed or
  explicitly re-adopted by a later ADR.
- Local selection evidence is a typed V2 ref + turn token + surface token + TextQuote/atom evidence. The V2 `SurfaceProjection` resolves it against the sealed Markdown; it never treats `Range.toString()` or formula glyph text as Markdown/TeX. Formula clicks use the same V2 turn read.
- Bookmark save requires user body, assistant canonical Markdown, assistant message ID, topology position, and the current turn revision from one read. Existing bookmark storage/data shapes are unchanged.
- Locate is bounded and event-driven: one coarse slot `scrollIntoView`, then an Observer-driven precise anchor alignment. User input, route changes, AbortSignal, or timeout cancel it. No ratio search, pixel probing, hidden scroll, synthetic scroll loop, network request, cookie/storage/token/auth-header access, POST/SSE construction, or React internals are permitted.

## Consequences

- The production directory and content consumers follow one graph snapshot;
  a refresh cannot replace verified graph content with a partial DOM window.
- Virtualization can remove and recreate DOM surfaces without deleting sealed content or recompiling identical content.
- Page wrapper/class changes are isolated to the ChatGPT Host Adapter and fixtures; semantic compiler, consumers, bookmark model, and navigation contracts remain unchanged.
- Sparse content is explicit. Full export requires every topology entry to be ready and conflict-free; selected export can operate on ready entries only.
- The V2 slot-only path is not an active consumer source. The passive bridge
  observes only the website-owned conversation GET, and the graph-backed
  repository is the active ChatGPT content seam; no extension-issued
  `/backend-api/conversation/*` request is allowed.

## Verification

Focused tests cover topology ambiguity and prepend, observer races, one-shot hydration, unmount/remount sealing, compiler formula/code/table/noise validation, epoch/batch/identity fencing, two-stage locate, Reader/Bookmark convergence, V2 selection/formula projection, no-fetch behavior, and sparse export gating. Repository gates and installed dual-browser acceptance are recorded in `docs/testing/CURRENT_TEST_GATES.md`.
