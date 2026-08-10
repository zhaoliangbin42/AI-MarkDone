# ChatGPT Content Discovery Gates

This file is the tracked acceptance contract for the active ChatGPT content
discovery lifecycle. It records architecture facts and gate results only; it
must not contain conversation text, cookies, authorization values, tokens, raw
request headers, or raw Graph payloads.

## Active contract

The production lifecycle is defined by
[ADR-0017](../adr/ADR-0017-chatgpt-baseline-and-host-tail-lifecycle.md):

- one website-owned, passively observed complete Graph baseline per
  conversation epoch;
- one shared `ChatGPTPageIndex` observer for typed identity, lifecycle,
  materialization and dirty-assistant signals;
- one `ConversationContentRepository` cache. A message in the cache is
  available to every consumer; streaming and compilation are internal timing
  only;
- stable new DOM turns are compiled once and appended to that cache. Existing
  assistant identities are authoritative and duplicate DOM observations are
  idempotent;
- zero extension conversation GET/POST requests, no credential reads, no
  generation-response body parsing, and no replay polling;
- the existing Content Port and Materialization Port remain the only consumer
  seams. Non-ChatGPT platforms keep their current discovery paths.

## Required scenarios

| Scenario | Required evidence |
|---|---|
| Blank-page first turn | Full typed-DOM scan proves empty; `/` → temporary `/c/WEB:*` → canonical `/c/:id` binds the birth facts; one `host-born/complete` turn reaches the cache; the toolbar mounts with a numeric word count; the official action row and completed send state remain intact; zero extension acquisition |
| Existing conversation | One complete passive Graph baseline; second/third/fourth turns append from stable DOM only; Reader, copy, bookmark, export and word-count counts agree |
| Direct navigation to an existing conversation | DOM facts visible before route delivery cannot bypass the baseline; the canonical conversation waits for its one passive baseline |
| Anonymous stable URL | Not currently supported or green; a page without `/c/<id>` or `/conversation/<id>` remains unavailable. A future page-session gate must seed observed DOM without treating URL shape or one empty virtualized window as identity |
| Streaming pressure | 1,000 assistant mutations cause zero compile before the completion/quiet boundary and at most one compile after stability; no Bridge replay |
| Closed baseline gate | Later same-conversation Graph captures and consumer `refresh()` do not read the Bridge again, change the cache token, or rebuild the cache |
| Identity and page epochs | A→B→A, hard refresh, hash change, BFCache, root replacement and temporary `WEB` binding keep cache boundaries correct |
| Virtualization | Unmount/remount preserves cached content, ordinal and token; a toolbar remounts once; a missing DOM predecessor may use the maintained cache tail |
| Single-message retry | A compiler rejection or temporary DOM shell keeps only that assistant ID dirty; the next real host signal retries it without affecting cached messages |
| Complex content | Formula/code/table use their validated semantic carriers; an unsupported embed or budget overflow affects only that turn and never invalidates the cache |
| Browser parity | Chrome object and Firefox JSON bridge transports produce the same baseline admission and Content Port behavior |

## Invariants

- Domain and route select the ChatGPT adapter and bind conversation identity;
  they never prove that a page is empty.
- The current route identity rule recognizes `/c/<id>`,
  `/conversation/<id>`, and nested paths containing `/c/<id>` on the exact
  ChatGPT page hosts. It does not recognize `/g/<id>`, `/share/<id>`,
  query-only conversation IDs, or URL-stable anonymous pages. `/c/WEB:*` is a
  temporary birth signal, not a canonical document identity.
- Empty state is a typed-DOM fact. A canonical existing conversation always
  waits for its baseline, even if a local DOM window is already mounted.
- The cache publishes only `complete` snapshots. `partial` is not a content
  state exposed to consumers; `syncing` and `unavailable` describe whether a
  usable cache has been established.
- `source`, `hybrid` and `host-born` are diagnostic basis values only. They do
  not gate a message that is already in the cache.
- A new assistant identity appends after the maintained cache tail. The same
  identity is ignored after its first accepted body; the repository does not
  rebuild history or perform suffix replacement.
- If DOM order cannot yet be confirmed, only that new observation is deferred.
  Existing cached messages remain consumable and the session does not become
  stale.
- One legal append publishes one atomic snapshot and one new `contentToken`.
- Cached `host-rendered/normalized` whole turns may feed Reader, whole-message
  copy, bookmark, word count and export. Precise local selection still needs
  its own SurfaceProjection evidence; `stale-content` and `stale-surface` are
  operation-level invalidation results, not cache states.
- Pending Materialization is read-only for toolbar injection. The official
  action row is touched only after exact `readTurn()` availability and a
  non-streaming assistant, so the host page keeps ownership of its own action
  state.
- After the stable window there is no discovery timer, rescan, acquisition or
  network activity until a real typed host, route, page or Bridge signal occurs.
- “Complete” describes the maintained cache entry, not unseen history. A
  future DOM-only page-session mode may guarantee only messages observed in the
  current page runtime; complete historical recovery still requires the
  website-owned Graph baseline.

## Automated commands

The closeout runs:

```text
npm run test:chatgpt-discovery
npm run test:core
npm run test:smoke
npm run test:acceptance
npm run perf:chatgpt
npm run type-check
npm run build
git diff --check
```

`npm run test:chatgpt-discovery` includes the Repository, retained compiler,
bridge/adapter transport, PageIndex, Host Monitor, materialization,
ConversationIndex, coordinator, Reader/export/bookmark and real toolbar
trigger coverage. Performance success requires its assertions to pass;
browser launch or zero long tasks alone is not a green gate.

## Current implementation evidence — 2026-08-10

- `npm run test:chatgpt-discovery`: passed, 27 files / 333 tests.
- `npm run test:core`: passed, 280 files / 1,957 tests.
- `npm run test:smoke`: passed, 7 files / 54 tests.
- `npm run test:acceptance`: passed, 30 files / 317 tests.
- `npm run type-check`: passed.
- `npm run perf:chatgpt`: passed with 200/200 toolbars, zero duplicate action
  rows, 200 streaming mutations and zero idle-phase mutations.
- `npm run build`: passed for Chrome MV3 and Firefox MV2, including entry
  format, passive ChatGPT boundary and bundle-size checks.
- Anonymous URL-stable DOM-only discovery is not covered by the current green
  evidence and must not be reported as supported until a page-session identity,
  same-URL reset, virtualized remount, late-attach and real-browser matrix are
  implemented and tested.
- Installed-browser Chrome MV3 and Firefox MV2 acceptance remain a separate
  manual gate and must be recorded independently from Vitest, performance and
  build output.

## Historical acceptance note — 2026-08-05

The previous controlled Chrome context reached an ordinary conversation but did
not load the local unpacked extension, and its isolated evaluation surface
rejected page fetch/DOM injection. That attempt was indeterminate: it proved
neither endpoint behavior nor installed-extension behavior. No token, cookie,
authorization header, request body or conversation text was recorded. The
previous active-acquisition and source-only conclusions are superseded by
ADR-0017 and must not be used as current acceptance evidence.
