# ADR-0010 ChatGPT Discovery Convergence for Delayed Content

## Status

Accepted — branch implementation; not included in a release until installed-browser acceptance is rerun. The candidate merge and ready-close-recovery portions are superseded by ADR-0013.

## Context

The V1 content port already has one repository and one reconcile path, but two lifecycle gaps remain. ChatGPT can mount an assistant node and fill its text later, especially during long reasoning and Deep Research. A passive graph can also contain the current user turn before its assistant content exists. Treating either window as a complete snapshot makes Reader, Directory, and word count look empty or stale after refresh.

## Decision

- Keep one `ChatGPTPageIndex` observer. It observes structure, typed identity, lifecycle attributes, and narrowly scoped host changes that can signal remount/generation; it never turns character data or rendered descendants into canonical content. Navigation and materialization subscribers receive host facts, while source content is revalidated through the Source Adapter.
- The bridge marks a graph `complete` when every published user/assistant turn is complete and an empty assistant shell is not the active tail of the continued branch. Only an incomplete final turn marks the source `partial`; if no completed turn remains, the bridge returns unavailable rather than an empty ready snapshot.
- Provider positions are not semantic identity. After omitting unfinished rounds, the bridge renumbers the surviving rounds from one before crossing the Content Port, while `turnId`/message IDs remain unchanged. This keeps partial snapshots valid even when the first visible completed round originally had provider position 2 or later.
- Active same-origin acquisition is a convergence hint, not a generation timer. The adapter performs it on a new document, a route/pageshow signal, a newly observed typed lifecycle identity, an explicit `generation-complete` signal, or explicit refresh. Host observations never become body evidence. Retryable acquisition failures retain already sealed source evidence and retry only when a later real signal arrives; no permanent polling or generation-body/SSE parsing is introduced.
- The source graph remains authoritative for branch, history, global order, identity, and Markdown. A source-backed sealed turn can be read immediately through `ConversationTurnReadPortV1` even when the global proof is gapped. `ConversationSnapshotV1.proof` is the only completeness input: `ready` does not close recovery and does not imply complete order or bodies.
- There is no timer-based bootstrap recovery. The document-start bridge keeps the latest passive graph replayable; if it is unavailable, the next real lifecycle signal re-enters the same reconcile path. A long generation leaves its newest turn unavailable without erasing the last verified snapshot. Once the source graph becomes verifiably complete, the same repository publishes the new immutable snapshot and all consumers observe it.

## Consequences

- Hard refreshes that race DOM hydration converge from passive Source Graph replay or a later real lifecycle signal; no locale-specific stop label is required.
- Hard refreshes that finish their first graph fetch before the content runtime attaches still recover through the document-start bridge's latest replay or the next real lifecycle signal; there is no timer-based content recovery.
- Deep Research and other long-running answers no longer need to finish inside the initial acquisition timeout. Incomplete graph tails cannot become a false `ready + complete` snapshot.
- The content discovery owner remains singular. Host observation is an extension of PageIndex, not a second consumer-side observer or body parser, and the public Content Port V1 is unchanged.
- The new behavior must be verified with delayed-body, partial-graph, generation-complete re-acquisition, Chrome/Firefox transport, and long-answer mutation-burst tests before release acceptance.

## Verification

Focused regression coverage lives in:

- `tests/unit/drivers/content/chatgpt/ChatGPTPageIndex.test.ts`
- `tests/unit/drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter.test.ts`
- `tests/unit/drivers/content/chatgpt/chatgptConversationBridge.test.ts`
- `tests/integration/content/chatgpt-content-discovery.lifecycle.test.ts`
