# ADR-0016: ChatGPT consumers read the published snapshot first

## Context

The passive Graph path already validates the ChatGPT conversation and publishes
an immutable V1 snapshot. Ordinary Reader, export and bookmark clicks were
still calling the source `refresh()` path, causing a second passive peek,
repository reconcile and repeated Markdown projection before showing a surface.
This made already available content feel slow and made a transient discovery
failure block otherwise usable content.

## Decision

ChatGPT discovery remains strict and signal-driven. Consumer actions read the
current published snapshot through `readerContentSource` and never start
discovery themselves. `collectFreshReaderContent` remains only as a compatible
name for the same no-side-effect read in the ChatGPT path.

`readerContentSource` caches immutable base projections by
`ConversationSnapshotV1` identity and normalized page URL. It returns shallow
consumer views and never retains DOM, Shadow DOM, or detached elements. The
source adapter is the only ChatGPT Markdown normalization boundary.

Save Messages exports the currently recognized items from a partial or stale
last-good snapshot; an empty snapshot is unavailable. Bookmark preparation,
word count, copy and formula actions use the same snapshot/turn-read seam.
Only the explicit Reader Refresh action, lifecycle signals, or discovery
signals call the real source refresh/reconcile path.

Reader and export feature chunks may be prewarmed once during a bounded idle
window after a verified ChatGPT snapshot exists and the page is visible. The
prewarm is single-flight, cancellable on teardown, skipped for `saveData`, and
uses extension-origin modules only. It creates no UI and performs no host
content read or network request.

## Consequences

- Already recognized content appears without waiting for an 800 ms bridge peek.
- Streaming tails remain unavailable until discovery publishes them, while
  sealed older turns remain consumable.
- Partial export is honest and responsive: it contains only recognized turns.
- Snapshot changes invalidate the projection cache by object identity; URL
  changes only create a new metadata projection.
- The discovery contract, V1 ports, bookmark storage shape, navigation
  protocol and non-ChatGPT paths remain unchanged.

## Status

Accepted — implemented in the ChatGPT consumer path; installed Chrome and
Firefox acceptance remains a separate release check.
