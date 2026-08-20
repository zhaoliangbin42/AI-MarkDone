# ADR-0021: monotonic passive Graph upgrades

## Status

Accepted

## Context

The page bridge may observe more than one valid website-owned Graph for the
same conversation epoch. A later response can contain a larger hydration
window or a complete active branch after an earlier response exposed only a
small valid window. The bridge already keeps the latest validated evidence in
memory and exposes a monotonic `captureSequence` through the existing source
candidate.

The previous Repository contract treated the first accepted Graph as a
terminal baseline. In a DOM-first pool it also admitted only the verified
prefix before the first host turn. Both rules could leave the single semantic
pool smaller than the Graph already held in bridge memory, while the upper
consumer chain correctly consumed the smaller pool.

## Decision

- `ConversationContentRepository` remains the only semantic content pool. No
  second Graph cache, consumer fallback, discovery coordinator, observer,
  polling loop, or active conversation request is introduced.
- The first and every later source candidate use one monotonic Graph-merge
  rule. Before accepting a candidate, every currently maintained turn must be
  present in the candidate with the same typed identity and relative order.
  A candidate that omits, reorders, or replaces an obtained turn is rejected
  as a whole and cannot mutate the pool.
- An accepted candidate publishes its complete Graph order. Candidate-only
  turns are added at their proven positions; existing strong bodies remain
  unchanged; only weak-sealed bodies may be upgraded by stronger Graph
  evidence. Ordinals remain dense and are regenerated from the merged order.
- A closed baseline gate means that speculative baseline acquisition is
  finished, not that the content pool is immutable. A real Graph capture may
  trigger one bounded upgrade comparison. `pageshow` and the explicit Settings
  retry may arm one passive-memory upgrade peek without reopening the baseline
  admission state. Consumer `refresh()` remains local-only and cannot trigger
  a peek.
- `sourceRevision`, `captureId`, and `branchKey` remain existing candidate
  metadata. Revision ordering can suppress duplicate work, but revision alone
  is not completeness proof; typed identity and order containment are the
  admission proof.
- `historyStatus` and all public V1 types remain unchanged. `complete` means
  the latest accepted Graph revision proves the active branch represented by
  that revision; a later larger revision is still allowed to extend it.

## Consequences

Positive:

- A DOM-first pool can absorb the full Graph envelope, including turns after
  the mounted host window.
- A later larger Graph converges the same pool without replacing strong host
  content or changing any consumer API.
- Repeated and out-of-order signals are safe because only a monotonic identity
  and order extension can change the pool.
- The privacy boundary remains unchanged: the extension still observes only
  page-owned successful GET responses and reads bridge memory for recovery.

Trade-offs:

- A Graph that does not yet contain every maintained host turn is rejected as
  a whole rather than partially merged; a later capture must provide the
  proven envelope.
- The Repository performs an additional bounded linear identity/order check
  for accepted capture signals.
- Branch replacement that removes an obtained suffix remains fail-closed and
  is outside this decision.

## Compatibility and scope

The page bridge, provider Adapter, Runtime wiring, Content Port, Surface,
Reader, Directory, Copy, Formula, Word Count, Export, bookmark chain, browser
transport, permissions, and storage schema are unchanged. The implementation
is confined to the Repository plus its tests and authoritative documentation.

## Related decisions

- Narrows the terminal-gate and prefix-only clauses in
  [ADR-0018](ADR-0018-chatgpt-identity-proven-single-content-pool.md).
- Narrows the accepted-Graph permanence clause in
  [ADR-0020](ADR-0020-payload-declared-graph-identity-and-gate-rearm.md).
- Preserves the weak-sealed upgrade rule in
  [ADR-0019](ADR-0019-completion-evidence-tiers-and-bounded-resweeps.md).
