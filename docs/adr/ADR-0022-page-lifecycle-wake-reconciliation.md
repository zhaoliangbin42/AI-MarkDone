# ADR-0022: page lifecycle wake reconciliation

## Status

Accepted

## Context

ChatGPT content discovery is passive and page-scoped. The existing Runtime
reconciles `pageshow`, route signals, PageIndex facts, and bridge capture
signals, while the Repository owns the single monotonic content pool. Browser
Page Lifecycle behavior adds a distinct boundary: a hidden page may be frozen
without being reloaded, and a frozen page may resume without producing a new
`pageshow`. A discarded page instead reloads when activated.

The extension must recover an available bridge snapshot after a long background
period without adding polling, a heartbeat, an active conversation request, or
a second content-discovery path. `resume` and `pageshow` can arrive as one
lifecycle burst, so handling both independently would create duplicate host
invalidations, passive peeks, and Surface refreshes.

## Decision

- `ChatGPTConversationContentRuntime` remains the only lifecycle owner. It
  listens to the document `resume` signal in addition to the existing window
  `pageshow` signal.
- Both signals enter one fixed 50 ms coalescer. A burst performs exactly one
  wake reconciliation: notify the Host Monitor, arm the Repository's existing
  bounded upgrade seam, synchronize the current epoch, and refresh the existing
  Surface.
- The coalescer is a private Runtime timer. It is cleared by `dispose()` and
  introduces no public contract, transport field, diagnostics field, observer,
  polling loop, or network request.
- A discarded page is recovered by its normal document reload: the existing
  `document_start` bridge and initial Runtime synchronization rebuild the page
  session. `document.wasDiscarded` is not made a public dependency because it
  does not provide content evidence or improve the existing initial recovery.
- The page bridge, Adapter, Repository merge semantics, Content Port, Surface,
  consumers, background worker lifecycle, permissions, and storage remain
  unchanged.

## Consequences

Positive:

- A page that remains loaded while frozen can re-peek passive bridge memory on
  `resume` and continue the Repository's monotonic Graph upgrade path.
- BFCache and browser-specific `resume`/`pageshow` ordering cannot duplicate a
  single lifecycle recovery action.
- Long-idle pages pay no recurring cost; the only new work is one short-lived
  timer per lifecycle burst.

Trade-offs:

- A discarded page cannot retain JavaScript memory; recovery depends on the
  normal page reload and newly available website evidence.
- The 50 ms window intentionally merges very-close lifecycle signals and does
  not attempt to distinguish them as separate user actions.

## Compatibility and scope

This is a content-runtime lifecycle hardening change for Chrome MV3 and
Firefox MV2. It does not change the existing object/JSON bridge transport,
content snapshot schema, or consumer refresh boundary. The platform behavior is
based on the [Chrome Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
and the [Chrome content-script lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).

## Related decisions

- [ADR-0021](ADR-0021-monotonic-passive-graph-upgrades.md) defines the
  monotonic Repository merge and bounded upgrade semantics.
- [ADR-0018](ADR-0018-chatgpt-identity-proven-single-content-pool.md) defines
  the single page-scoped content pool and lifecycle ownership.
