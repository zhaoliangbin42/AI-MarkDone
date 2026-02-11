# Filesystem Reliability Test Charter (Bookmark Storage)

## Scope
- Bookmark persistence lifecycle on `browser.storage.local`.
- Folder tree lifecycle (`create/rename/move/delete`) and index consistency (`folderPaths`).
- Import/export/repair/cleanup behavior under normal and extreme conditions.

## External Baselines (for review standards)
- Chrome Extensions Storage API: quotas, async semantics, lifecycle constraints.  
  [Chrome extensions storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- Firefox WebExtensions storage compatibility.  
  [MDN storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)
- Web app storage eviction and persistence model (browser-level reliability boundaries).  
  [MDN Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- Google engineering test-size strategy for stable CI layering.  
  [Google Testing Blog: Small, Medium, Large](https://testing.googleblog.com/2010/12/test-sizes.html)
- Apple File System Programming Guide (error handling, atomic update mindset, naming/path safety).  
  [Apple File System Programming Guide](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/)

## Layered Test Matrix

### L1: Deterministic Unit (Small)
- Key schema:
  - `bookmark:<urlWithoutProtocol>:<position>` stability and URL normalization consistency.
- Path safety:
  - traversal rejection (`..`), forbidden chars, max depth, max name length.
- Folder/index invariants:
  - create/rename/move/delete must keep `folderPaths` exact and duplicate-free.
- Repair behavior:
  - partial corruption repaired; unrecoverable entries removed.
- Quota projections:
  - `canSave/canImport` warning/critical thresholds validated on boundary values.

### L2: In-Memory Lifecycle Integration (Medium)
- Import + nested folders:
  - all ancestors materialized before children.
  - hidden-bookmark prevention (tree count equals storage count).
- Move subtree:
  - source removed, target created, descendant bookmark `folderPath` rewritten.
- Delete-all + re-import:
  - no stale keys, no false duplicate detection.
- Migration:
  - one-time migration idempotent; rollback-safe if interrupted.

### L3: Stress & Failure Injection (Large)
- Concurrency:
  - mixed `save/remove/move/bulkSave` with high overlap; verify final state determinism.
- Partial failure:
  - inject `set/remove` failures to validate compensation or explicit non-atomic documentation.
- Capacity:
  - import near quota (95%/98%/100%); verify UX warning vs hard stop behavior.
- Recovery after restart:
  - simulate stale index / missing folder records and assert self-heal.

## Required Invariants (Must Hold)
1. Every bookmark must reference a visible/known folder path after refresh.
2. `folderPaths` must match actual `folder:*` records exactly.
3. Rename/move operations must be prefix-consistent for all descendants.
4. Delete-all must remove visible and previously hidden bookmarks.
5. Re-import of same dataset after delete-all must not produce duplicates.

## Execution Checklist (Per Run)
- Run targeted tests:
  - `tests/bookmarks/ImportFolderVisibility.regression.test.ts`
  - `tests/bookmarks/ImportWorkflowClosedLoop.test.ts`
  - `tests/bookmarks/MissingFolderRecovery.test.ts`
  - `tests/bookmarks/StorageLifecycleReliability.test.ts`
- Run static gate:
  - `npm run type-check`
- Record:
  - risk level, dependency change, impacted modules, manual reproduction notes.

## Current Known Risk Register
- Bulk mutation now uses a shared write queue for ordering, but multi-step folder relocation (`set/set/remove/index`) is still not a true ACID transaction and can partially apply under hard interruption.
- Runtime storage quota differences across Chrome/Firefox may alter practical thresholds.
- Existing legacy bookmark tests outside this matrix still contain historical debt and should be reconciled incrementally.

## Atomicity Boundary (Explicit)
- Guaranteed now:
  - write ordering across `save/bulkSave/bulkRemove/bulkMove/repairBookmarks` and folder write ops is serialized via `StorageQueue`.
- Not guaranteed:
  - cross-call rollback for multi-step folder relocation (`folder updates`, `bookmark updates`, `old key removals`, `index update`) if process crashes mid-operation.
- Mitigation:
  - startup/refresh reconciliation (`ensureFolderRecordsForBookmarks`) and import fallback to `Import` for failed folder-path materialization.

## Storage Boundary Rationale (Local vs Sync)
- Bookmark/folder datasets are intentionally persisted in `storage.local`:
  - payload size can be large (conversation snippets, bulk imports),
  - high write frequency during import/move/delete operations,
  - sync quotas/rate limits are unsuitable for this workload.
- `storage.sync` is reserved for compact user settings (`app_settings`) only.
