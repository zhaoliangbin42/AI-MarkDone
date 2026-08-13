# ADR-0019: completion-evidence tiers, weak-sealed body upgrades, and bounded deferred re-sweeps

## Status

Accepted

## Context

ADR-0018 makes an obtained assistant identity authoritative and idempotent:
existing bodies are never overwritten by a later DOM copy. That rule protects
the pool from host rewrites, but it has two real-world failure modes:

1. A turn can be admitted through the bounded-quiet compatibility path
   (2-second quiet confirmation) while the host is still generating, for
   example during a long thinking/tool pause or when the locale-independent
   stop control is absent. Because the body can never change afterwards, a
   partially generated Markdown body is permanently sealed into the pool and
   every consumer (word count, Reader, copy, formula, export) is wrong for
   that turn until a full page reload.
2. Deferred or compiler-rejected candidates are retried only when a new host
   observation batch arrives. When the host DOM goes quiet for good after one
   failed capture, the turn stays missing from the pool indefinitely.

## Decision

Completion evidence becomes a first-class input on host observations, and two
bounded recovery mechanisms are added without reopening the pool to arbitrary
rewrites:

- `ConversationHostTurnObservationV1` carries
  `completionEvidence: 'strong' | 'bounded-quiet'`. The Host Monitor declares
  `strong` only when an official completion anchor, an observed generation
  end, or a later typed round proves completion; the bounded-quiet path
  declares `bounded-quiet`. Producers that predate this field are treated as
  `strong` at the Repository seam, preserving their historical
  never-rewrite behavior.
- A turn admitted with `bounded-quiet` evidence is **weak-sealed**. A later
  observation for the same typed identity may replace its body only when the
  newer evidence is stronger:
  - a `strong` host observation (same or different body), or
  - an overlapping turn from an accepted Graph baseline (source-backed
    authority) during the verified historical-prefix merge.
  Equal `bounded-quiet` evidence never rewrites a sealed body. Replacement
  preserves identity, order, and ordinal; it only changes the body, its
  digest, and provenance, and it unseals the turn. Upgrades publish one new
  content token like any other admission.
- `ConversationContentRepository.reevaluateDeferredHost()` re-runs the
  pending-host flush on demand and returns the remaining deferred count.
- The Host Monitor adds a **bounded deferred re-sweep**: after a stable
  capture settles with leftover dirty/deferred work and no pending quiet
  timer, it schedules up to three re-captures with backoff (1.2s / 3s / 8s).
  A re-sweep only re-runs the standard capture under the same ordering and
  completion rules; it never guesses order. Any new host observation batch
  resets the sweep budget, so a page that keeps mutating stays on the normal
  signal-driven path and a permanently quiet page stops retrying after the
  budget expires.
- The discovery diagnostics snapshot exposes the live weak-sealed count
  (`weakSealedCount`), the deferred count, compiler rejection reasons, and
  the Host Monitor's weak-completion admission count.

## Consequences

- 正向收益
  - A premature bounded-quiet admission self-heals when a strong completion
    signal or the Graph arrives; consumers converge to the complete body
    without a reload.
  - Compiler rejections and deferred candidates are retried on a bounded
    timer, so a quiet host page can no longer leave a finished message
    permanently missing.
  - The pool's core invariants are preserved: only stronger evidence may
    replace a body, order is never guessed, and content tokens still change
    only on real semantic changes.
- 明确代价
  - An upgrade changes the content token, so token-guarded asynchronous UI
    work (selection proofs, in-flight copy/export) can be invalidated once;
    this is the same cost as any other admission.
  - Re-sweeps re-run compiles for dirty candidates, bounded by the attempt
    budget; compiles only run for dirty identities after a quiet window.
  - The "existing bodies never change" wording in ADR-0018, CURRENT_STATE.md,
    CONTEXT.md, and CURRENT_TEST_GATES.md is narrowed: bodies are immutable
    except for weak-sealed turns upgraded by strictly stronger evidence.
- 后续需要同步维护的文档或代码区域
  - `docs/architecture/CURRENT_STATE.md` (ChatGPT discovery boundary)
  - `docs/testing/CURRENT_TEST_GATES.md` (existing-bodies rule)
  - `CONTEXT.md` (weak-sealed / completion evidence terms)
  - `src/services/content/ConversationContentRepository.ts`
  - `src/drivers/content/chatgpt/ChatGPTConversationHostMonitor.ts`
