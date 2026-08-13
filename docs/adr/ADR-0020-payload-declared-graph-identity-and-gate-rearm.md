# ADR-0020: payload-declared Graph identity and bounded baseline-gate re-arm

## Status

Accepted

## Context

Two real-world account patterns broke the proactive discovery chain:

1. The page bridge only accepted a Graph when the request URL carried the
   current canonical conversation id. A conversation GET that fires before
   the SPA rewrites the URL, or an account-specific endpoint shape that never
   puts the id in path/query, was silently dropped even though the payload
   itself declares the conversation id.
2. Once a baseline peek failed, the per-epoch gate kept `baselineAttempted`
   true. Only a new capture signal could retry; a BFCache restore (whose page
   bridge memory survives) or a user who enabled the extension after a missed
   capture had no bounded way to re-read passive bridge memory.

## Decision

- The page bridge keeps the URL-carried fast path and adds a payload-declared
  path: while the page is on a canonical conversation, a same-origin GET
  response with JSON content type is parsed under the existing bounds (8 MB
  byte cap, 4-level / 256-object traversal) and a Graph-shaped payload is
  remembered only when it declares the current canonical conversation id.
  Graph-shaped payloads declaring another conversation are counted as
  rejected and never remembered. On a page without a canonical id nothing is
  parsed. POST, SSE, cross-origin responses, request bodies, headers, and
  credentials remain unobserved.
- `ConversationContentRepository.reopenBaselineGate()` re-arms one bounded
  peek, but only when the gate is OPEN (no accepted Graph). An accepted Graph
  stays authoritative for its epoch; the per-epoch invariant is now "at most
  one ACCEPTED Graph", while failed peeks may be retried through bounded
  lifecycle/user triggers.
- The Runtime re-arms on `pageshow` (BFCache restore keeps bridge memory) and
  exposes `retryBaselineDiscovery()` for an explicit user action. The
  consumer-facing `refresh()` contract is unchanged: it never re-arms the
  gate and never issues a request.
- The Settings diagnostics row gains a "Retry discovery" action that calls
  the re-arm and refreshes the diagnostics summary.
- Re-peeks always read passive bridge memory only. The extension still
  issues zero conversation requests.

## Consequences

- 正向收益
  - Late-bound conversation GETs (pre-URL-rewrite, account-specific endpoint
    shapes) now contribute the Graph baseline instead of being dropped.
  - A missed capture recovers through pageshow or an explicit user action
    without weakening the accepted-Graph invariant.
  - The diagnostics row becomes actionable: users can see the chain state and
    trigger the one safe recovery step.
- 明确代价
  - On canonical pages the bridge now parses bounded same-origin JSON GETs
    beyond conversation endpoints; memory is transient, traversal is bounded,
    and the byte cap protects the main thread.
  - One additional user-facing control and its localization surface.
  - ADR-0018's wording "refresh does not reopen the gate" is narrowed to:
    consumer refresh never re-arms; driver-side pageshow and the explicit
    user action may re-arm only an open gate.
- 后续需要同步维护的文档或代码区域
  - `docs/architecture/CURRENT_STATE.md` (bridge eligibility + gate wording)
  - `docs/architecture/DEPENDENCY_RULES.md` (refresh/gate wording)
  - `docs/testing/CURRENT_TEST_GATES.md` (missed-baseline paragraph)
  - `docs/testing/CHATGPT_CONTENT_DISCOVERY_GATES.md` (new scenarios)
  - `CONTEXT.md` (lifecycle signal wording)
  - `public/page-bridges/chatgpt-conversation-bridge.js`
  - `src/services/content/ConversationContentRepository.ts`
  - `src/runtimes/content/ChatGPTConversationContentRuntime.ts`
