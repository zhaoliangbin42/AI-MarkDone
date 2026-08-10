# ADR-0010 ChatGPT Discovery Convergence for Delayed Content

## Status

Superseded by ADR-0017. The single PageIndex and signal-driven/no-polling
principles remain; active acquisition, repeated source reconciliation and the
prohibition on stable host bodies do not.

## Context

The V1 content port already has one repository and one reconcile path, but two lifecycle gaps remain. ChatGPT can mount an assistant node and fill its text later, especially during long reasoning and Deep Research. A passive graph can also contain the current user turn before its assistant content exists. Treating either window as a complete snapshot makes Reader, Directory, and word count look empty or stale after refresh.

## Decision

- Keep one `ChatGPTPageIndex` observer. It observes structure, typed identity, lifecycle attributes and assistant-scoped content changes. Per-character mutations only dirty an assistant identity; `ChatGPTConversationHostMonitor` waits for a 400 ms quiet/completion boundary before one rendered compile.
- The bridge marks a graph `complete` when every published user/assistant turn is complete and an empty assistant shell is not the active tail of the continued branch. Only an incomplete final turn marks the source `partial`; if no completed turn remains, the bridge returns unavailable rather than an empty ready snapshot.
- Provider positions are not semantic identity. After omitting unfinished rounds, the bridge renumbers the surviving rounds from one before crossing the Content Port, while `turnId`/message IDs remain unchanged. This keeps partial snapshots valid even when the first visible completed round originally had provider position 2 or later.
- The extension never performs same-origin conversation acquisition. A canonical conversation epoch consumes at most one matching Graph already captured by the document-start bridge. A real future bridge capture may satisfy an open gate; no route, host, generation or refresh signal can issue a request or reopen a closed gate.
- The source Graph remains authoritative for the complete existing-history baseline prefix. A compiler-verified stable host turn may close the unique streaming tail or append a contiguous successor, carrying `host-rendered/normalized` provenance. It cannot fill unknown history or modify the baseline prefix.
- A blank page is proven only by a full typed-DOM scan with zero messages. Facts born under `/c/WEB:*` survive canonical identity binding and may establish a `host-born` first projection. There is no domain/path empty inference or timer-based source replay.

## Consequences

- Hard refreshes recover full history only from the passive Graph baseline; if document-start capture was missed, reload is the explicit recovery.
- Long-running answers do not cause repeated Graph reads. Their stable completed DOM tail commits once after semantic validation.
- The content owner remains singular. Host observation extends PageIndex through one Host Monitor, not a consumer-side observer or second repository; the public Content Port V1 is unchanged.
- Verification covers first-turn identity binding, partial-baseline closure, closed-gate no-op, Chrome/Firefox transport parity and 1,000-mutation compile bounds.

## Verification

Focused regression coverage lives in:

- `tests/unit/drivers/content/chatgpt/ChatGPTPageIndex.test.ts`
- `tests/unit/drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter.test.ts`
- `tests/unit/drivers/content/chatgpt/chatgptConversationBridge.test.ts`
- `tests/integration/content/chatgpt-content-discovery.lifecycle.test.ts`
