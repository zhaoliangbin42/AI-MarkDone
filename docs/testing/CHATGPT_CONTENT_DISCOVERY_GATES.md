# ChatGPT Content Discovery Gates

This file is the tracked acceptance record for the active ChatGPT
baseline-and-host-tail lifecycle. It records facts and gate results only; it
must not contain conversation text, cookies, authorization values, tokens, raw
request headers, or raw Graph payloads.

## Active contract

The production lifecycle is defined by
[ADR-0017](../adr/ADR-0017-chatgpt-baseline-and-host-tail-lifecycle.md):

- one website-owned, passively observed Graph baseline per conversation epoch;
- one shared `ChatGPTPageIndex` observer for structure, identity, lifecycle,
  materialization and dirty assistant signals;
- stable typed DOM successors compiled once and appended to the same immutable
  `ConversationContentRepository` projection;
- zero extension conversation GET/POST requests, no credential reads, no
  generation-response body parsing, no replay polling;
- one Content Port and one Materialization Port for all consumers;
- installed Chrome MV3 and Firefox MV2 acceptance recorded separately from
  automated tests and builds.

## Required scenarios

| Scenario | Required evidence |
|---|---|
| Blank-page first turn | `/` → temporary `/c/WEB:*` → canonical `/c/:id`; DOM-proven empty state; pending typed anchor does not mutate the official action row; one `host-born/complete` turn; toolbar then mounts with numeric word count; stop state remains completed; zero Bridge acquisition |
| Existing conversation | One complete/streaming-tail passive Graph baseline; second/third/fourth turns appended only from stable DOM; Reader/copy/bookmark/export/word-count counts agree |
| Streaming pressure | 1,000 assistant mutations; zero compile before completion/quiet; at most one compile after stability; zero Bridge replay |
| Closed baseline gate | Later same-conversation Graph captures and consumer `refresh()` do not change `contentToken` or trigger acquisition |
| Identity and page epochs | A→B→A, hard refresh, hash change, BFCache, root replacement and `/c/WEB:*` binding are fenced correctly |
| Virtualization | Unmount/remount preserves sealed content, ordinal and `contentToken`; exactly one toolbar remounts |
| Regeneration | Latest host suffix creates a new `projectionId` and atomic suffix replacement; baseline-prefix conflict becomes `stale` |
| Complex content | Formula/code/table use authoritative semantic carriers; unsupported embed, Deep Research host body and budget overflow fail closed per turn |
| Browser parity | Chrome object and Firefox JSON bridge transports produce the same baseline admission and Content Port states |

## Invariants

- domain and route select/bind the ChatGPT adapter and conversation identity;
  they never prove that the page is empty;
- turn identity is typed and unique; DOM ordinal is never global history proof;
- the baseline prefix and every sealed host record are immutable within a
  projection;
- semantic-body digests ignore provenance-only differences, so the same typed
  Graph/host turn is idempotent while divergent bodies remain conflicts;
- only a contiguous host successor may extend the tail; historical gaps are
  never inferred from a virtualized DOM window;
- one legal append publishes one atomic snapshot and one new `contentToken`;
- sealed `host-rendered/normalized` whole turns may feed Reader, whole-message
  copy, bookmark, word count, export and uniquely proven local Markdown
  selection; the projected local span is canonical within AI-MarkDone's sealed
  body but cannot claim exact provider provenance for persistent annotations;
- pending Materialization is read-only for toolbar injection: the official
  action row may be mutated only after the assistant turn is authoritative,
  non-streaming and still connected;
- `stale` preserves last-good evidence but pauses full Reader and full export;
- after the stable window there is no discovery timer, rescan, acquisition or
  network activity until a real typed host/route/page event occurs.

## Automated commands

The closeout must run:

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

`npm run test:chatgpt-discovery` must include Repository, retained Ledger
reducer, bridge/adapter transport, PageIndex, Host Monitor, materialization,
ConversationIndex, coordinator, Reader/export/bookmark and real toolbar trigger
coverage. Performance success requires its assertions to pass; launch success
or zero long tasks alone is not a green gate.

## Current implementation evidence — 2026-08-10

- Focused first-turn regression was observed failing before production edits.
- `npm run test:chatgpt-discovery`: passed, 29 files / 344 tests.
- `npm run test:core`: passed, 284 files / 1,977 tests.
- `npm run test:smoke`: passed, 7 files / 54 tests.
- `npm run test:acceptance`: passed, 31 files / 325 tests.
- `npm run type-check`: passed.
- `npm run build`: passed for Chrome MV3 and Firefox MV2, including entry
  format, passive ChatGPT boundary and bundle-size checks.
- `npm run perf:chatgpt`: passed with 200/200 sealed-content toolbars, zero
  duplicates, zero idle mutations, 200 streaming mutations, exactly two atomic
  selection-state writes, zero selection long tasks and canonical formula
  Markdown copied through the configured shortcut. The benchmark initiated no
  extension conversation request and loaded no export renderer before an image
  action.
- Installed Chrome MV3 current-build acceptance passed on an existing
  conversation for an ordinary paragraph fragment and a complete inline formula;
  both clipboard writes came from the sealed Repository Markdown, and numeric
  toolbar statistics remained present. No new message was sent because the host
  displayed its own conversation-history rate-limit notice. A fresh blank-page
  first-turn matrix remains a separate release sign-off gate.
- Installed Firefox MV2 acceptance: pending.

## Historical acceptance note — 2026-08-05

The previous controlled Chrome context reached an ordinary conversation but did
not load the local unpacked extension, and its isolated evaluation surface
rejected page fetch/DOM injection. That attempt was indeterminate: it proved
neither endpoint behavior nor installed-extension behavior. No token, cookie,
authorization header, request body or conversation text was recorded. The
previous active-acquisition and source-only conclusions are superseded by
ADR-0017 and must not be used as current acceptance evidence.
