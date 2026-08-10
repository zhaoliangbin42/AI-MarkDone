# ADR-0013 Evidence Ledger and Stable Turn Capture

## Status

Superseded as the production lifecycle by ADR-0017.
`ConversationEvidenceLedger` remains a provider-neutral reducer/compatibility
test seam; `ConversationContentRepository` now owns the only production
baseline gate, cache, projection and direct-read lifecycle. Installed
Chrome/Firefox acceptance remains a separate release gate.

## Context

The materialized DOM is a viewport and virtualization window, not the conversation's durable content set. A refresh, remount, delayed body, branch regeneration, or late bridge capture can therefore make a DOM-shaped candidate lose already observed turns or publish Markdown that has not reached a stable semantic state. Formula and local-selection features had the same failure mode when they treated rendered descendants as a second content source.

The content-discovery system needs one provider-neutral session that accepts a
Source Graph history baseline and stable host-tail evidence without asking
every consumer to understand lifecycle races or host markup. A virtualized DOM
window is never complete-history evidence, but a compiler-verified contiguous
host turn can be canonical whole-turn content with normalized provenance.

## Decision

The current decision is implemented by the page-scoped
`ConversationContentRepository` Session behind the existing Content Port V1:

- Evidence is fenced by conversation epoch, projection identity, typed turn identity and host surface revision. `turnId`, `assistantMessageId`, and `userMessageId` are the only join keys; text, ordinal, DOM index and CSS selectors are never identity.
- One passive source batch owns the complete existing-history prefix. Host observation may establish a typed `host-born` first turn after `empty-proven`, or append only from the exact sealed tail; it never manufactures missing history or global position.
- `ChatGPTConversationHostMonitor` admits only typed, non-streaming turns with a verified completion anchor and stable quiet window. `RenderedContentCompilerV2` validates semantic HTML and authoritative formula/code carriers before `host-rendered/normalized` content reaches the Session.
- The Repository publishes proof `{ basis, order, bodies, tail, gaps }`. Full whole-turn consumers require non-stale readable evidence; exact source selection/annotation separately requires source-span proof.
- `ConversationTurnReadPortV1.readTurn()` is the narrow direct-read seam. A sealed message is readable while the global source projection still has gaps, returning only `ready` or `unavailable` with a typed reason. Acquisition may remain pending internally, but no unsealed message is exposed to consumers.
- `RenderedContentCompilerV2` is provider-neutral. It compiles cloned stable rendered surfaces and delegates formula/code capabilities through injected adapters. Provider selectors and DOM observation remain in adapters; consumers never reconstruct Markdown themselves.
- Baseline admission, host observation, materialization, and surface projection have independent revisions and caches. Virtualized unmounts remove anchors only; they never delete sealed content. A document epoch reset releases all page-local body evidence; no conversation body is persisted or carried across refresh.
- Real triggers bind route/document identity, update materialization or dirty a typed assistant. They never issue a conversation request or reopen a closed baseline gate. There is no content polling, synthetic discovery scrolling, React-internals access, credential/header extraction, or consumer-side DOM fallback.

The public runtime continues to expose `ConversationContentSourceV1` and
`ConversationMaterializationPortV1`; baseline/host capture state and conflict
records remain hidden. Existing Reader/Copy/Bookmark/Export consumers continue
to use `readerContentSource`; the toolbar uses Materialization plus `readTurn()`.
The retained Ledger reducer is not instantiated as another production owner.

## Consequences

- Content correctness is established once at the source/capture boundary and reused by Reader, copy, bookmark, export, word count, formula, and selection surfaces.
- A partially discovered conversation can still provide a verified single-message action without falsely claiming full conversation completeness.
- Branch switches and late/duplicate observations are deterministic. A latest host suffix regeneration creates a new projection; a change reaching the baseline prefix preserves last-good content as stale.
- Host markup changes are isolated to `ConversationHostAdapterV1` and its fixtures. The compiler, Ledger, Content Port, and consumers do not change with individual ChatGPT wrapper elements.
- The old strict-prefix partial merge, DOM-candidate replacement/append rules, and `ready`-closes-recovery rule in ADR-0009/0010 are superseded by the proof and sealed-record rules here.

## Verification

Focused coverage includes the Ledger, stable capture, compiler corpus, repository virtualization/epoch scenarios, ChatGPT source/host adapters, Reader direct reads, Surface Projection, formula click paths, and discovery lifecycle. The repository gates and installed dual-browser acceptance are recorded separately in `docs/testing/CURRENT_TEST_GATES.md`.
