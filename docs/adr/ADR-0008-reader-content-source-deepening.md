# ADR-0008 Reader Content Source Deepening

## Status

Accepted — implementation follows the committed baseline `148c1eaa`.

## Context

`readerContentSource` is the shared semantic seam for ChatGPT Reader, word count, copy, PNG, bookmarks, and Save Messages. Its external interface is intentionally small, but the implementation currently mixes two different identities:

- immutable snapshot identity, which determines normalized正文;
- source revision identity, which determines whether asynchronous work is still current.

The implementation also computes the Reader start index in both the ChatGPT item builder and the source projection. That repetition makes the seam look more stateful than it is and creates another place where start-target behavior could diverge.

The current worktree contains unrelated Reader annotation, copy, settings, and navigation changes. This decision is limited to the committed ChatGPT content-source baseline and must not absorb those changes.

## Decision

Keep `readerContentSource` as the sole `ReaderItem[]` projection seam and keep its existing public entry points:

- passive `readCurrentReaderContent()`;
- fresh `collectFreshReaderContent()`;
- `collectFreshCurrentReaderItem()` and `readerItemsToChatTurns()` compatibility helpers.

Deepen the implementation with these rules:

1. Fresh content captures the typed start identity before the single `ensureReady()` confirmation. If the identity is unavailable before confirmation, it may be resolved once after confirmation. No position guess, DOM body fallback, retry loop, observer, or timer is added.
2. `resolveChatGPTReaderStartIndex()` is the only semantic start-index rule. The normalized-content builder does not own a second start-index calculation; the compatibility builder may continue exposing its legacy field for existing callers and tests.
3. Normalized ChatGPT content is cached by immutable `ChatGPTConversationSnapshot` identity. `routeEpoch + revision + conversationId` remains a freshness token returned to callers and used for stale asynchronous commit checks; it is not a second content-cache identity.
4. Page URL and caller metadata are applied to caller-owned views. The cache never returns the mutable `ReaderItem` objects that toolbar bookmark decoration can modify.
5. `ready / unavailable / target-unresolved` remains additive status information. Empty Reader and export surfaces retain their existing behavior; unavailable content must never be presented as ready content to stale-result validation.
6. The legacy generic DOM path remains temporarily for compatibility because its public generic entry points and tests still exist. It is not allowed to participate in the ChatGPT path. Its removal or isolation into a second adapter is a separate scope decision.

## Consequences

- The source interface remains stable while the implementation has one content identity and one start-index rule.
- Normalized Markdown work is still reused for passive word count, Reader binding, and repeated user actions without crossing a snapshot.
- Revision changes still invalidate asynchronous UI work, but they do not force a second interpretation of normalized content.
- The typed-identity, one-confirmation, fail-closed, and caller-owned-view safeguards remain mandatory.
- The generic DOM compatibility path is explicit technical debt rather than an implicit ChatGPT fallback.

## Verification

The refactor must preserve:

- remounted target identity before/after fresh confirmation;
- unresolved target fail-closed behavior;
- cache reuse within one immutable snapshot and invalidation for a new snapshot;
- updated page metadata without mutating cached content;
- Reader and export empty-surface behavior;
- `npm run test:core`, `npm run test:smoke`, `npm run test:acceptance`, `npm run type-check`, `npm run build`, and `git diff --check`.
