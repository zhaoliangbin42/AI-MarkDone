# ADR-0013 Evidence Ledger and Stable Turn Capture

## Status

Accepted — implementation active; installed Chrome/Firefox acceptance remains a separate release gate.

## Context

The materialized DOM is a viewport and virtualization window, not the conversation's durable content set. A refresh, remount, delayed body, branch regeneration, or late bridge capture can therefore make a DOM-shaped candidate lose already observed turns or publish Markdown that has not reached a stable semantic state. Formula and local-selection features had the same failure mode when they treated rendered descendants as a second content source.

The content-discovery system needs one provider-neutral reducer that accepts the Source Graph and host lifecycle/materialization facts without asking every consumer to understand lifecycle races or host markup. Host markup is never a second canonical body source.

## Decision

Introduce a page-scoped deep Module, `ConversationEvidenceLedger`, behind the existing Content Port V1:

- Evidence is fenced by `documentEpoch`, document identity, source revision, branch, and typed turn identity. `turnId`, `assistantMessageId`, and `userMessageId` are the only join keys; text, ordinal, DOM index, and CSS selectors are never identity.
- A source batch owns branch, history, global order, identity, and canonical Markdown. Host observation contributes only typed identity and local lifecycle/materialization facts; it never manufactures complete history, body, position, or a source candidate.
- `StableTurnCapture` accepts only a Source Graph turn that has passed identity, branch, order, completion, and canonical Markdown validation. The first valid semantic digest for an identity is sealed. The same digest is idempotent; a different digest is an explicit evidence conflict and never silently replaces sealed content.
- The ledger publishes a proof `{ order, bodies, tail, gaps }`. `ready` means that at least one sealed turn is readable; it does not mean the entire conversation has converged. Full export waits for complete order, bodies, and a stable tail.
- `ConversationTurnReadPortV1.readTurn()` is the narrow direct-read seam. A sealed message is readable while the global source projection still has gaps, returning only `ready` or `unavailable` with a typed reason. Acquisition may remain pending internally, but no unsealed message is exposed to consumers.
- `RenderedContentCompiler` is provider-neutral. It compiles the already canonical source Markdown into the shared semantic tree and delegates formula/code capabilities through injected adapters. Provider selectors and DOM observation remain in adapters; consumers never reconstruct canonical Markdown from host DOM.
- Source acquisition, host observation, materialization, and surface projection have independent revisions and caches. Virtualized unmounts remove anchors only; they never delete sealed content. A document epoch reset releases all page-local body evidence; no conversation body is persisted or carried across refresh.
- Real triggers are route/document changes, branch changes, generation completion, pageshow, stable new identities, and explicit refresh. There is no content polling, synthetic scrolling, React-internals access, credential/header extraction, or consumer-side DOM fallback.

The public runtime continues to expose `ConversationContentSourceV1` and `ConversationMaterializationPortV1`; the Ledger, capture state, source graph, and conflict records remain hidden implementation details. Existing Reader/Copy/Bookmark/Export consumers continue to use `readerContentSource`; single-message toolbar, formula, and local-surface actions may use `readTurn()`.

## Consequences

- Content correctness is established once at the source/capture boundary and reused by Reader, copy, bookmark, export, word count, formula, and selection surfaces.
- A partially discovered conversation can still provide a verified single-message action without falsely claiming full conversation completeness.
- Branch switches and late/duplicate observations are deterministic and cannot append a regenerated suffix or downgrade sealed content.
- Host markup changes are isolated to `ConversationHostAdapterV1` and its fixtures. The compiler, Ledger, Content Port, and consumers do not change with individual ChatGPT wrapper elements.
- The old strict-prefix partial merge, DOM-candidate replacement/append rules, and `ready`-closes-recovery rule in ADR-0009/0010 are superseded by the proof and sealed-record rules here.

## Verification

Focused coverage includes the Ledger, stable capture, compiler corpus, repository virtualization/epoch scenarios, ChatGPT source/host adapters, Reader direct reads, Surface Projection, formula click paths, and discovery lifecycle. The repository gates and installed dual-browser acceptance are recorded separately in `docs/testing/CURRENT_TEST_GATES.md`.
