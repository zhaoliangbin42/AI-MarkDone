# ADR-0016: ChatGPT consumers read the published snapshot first

> Supersession note: ADR-0017 keeps snapshot-first consumption, redefines
> `refresh()` as a local flush that cannot replay a closed baseline, and pauses
> full Reader/export when a historical-prefix conflict makes the projection
> stale.

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

Save Messages exports complete readable source, hybrid or host-born snapshots;
historical-prefix `stale` pauses full Reader and full export. Bookmark
preparation, word count, copy and formula actions use the same snapshot/turn
read seam. Explicit Reader Refresh only awaits or returns work already observed
by the Session; it cannot start baseline admission. No consumer or lifecycle
signal can issue a request or reopen a closed baseline gate.

Reader and export feature chunks may be prewarmed once during a bounded idle
window after a verified ChatGPT snapshot exists and the page is visible. The
prewarm is single-flight, cancellable on teardown, skipped for `saveData`, and
uses extension-origin modules only. It creates no UI and performs no host
content read or network request.

## Consequences

- Already recognized content appears without waiting for an 800 ms bridge peek.
- Streaming tails remain pending until stable host capture publishes them,
  while sealed older turns remain consumable.
- Complete hybrid and host-born projections export through the same path;
  stale or reconstructed canonical output fails closed.
- Snapshot changes invalidate the projection cache by object identity; URL
  changes only create a new metadata projection.
- The discovery contract, V1 ports, bookmark storage shape, navigation
  protocol and non-ChatGPT paths remain unchanged.

## Status

Accepted — implemented in the ChatGPT consumer path; installed Chrome and
Firefox acceptance remains a separate release check.
