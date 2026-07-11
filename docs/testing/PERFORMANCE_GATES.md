# ChatGPT Performance Gates

This document is the execution contract for the 2026 ChatGPT content-runtime performance program. It turns performance work into staged, reproducible gates while preserving toolbar reliability and user-facing behavior.

## Measurement protocol

- Build first with `npm run build`.
- Run `npm run perf:chatgpt` three times on the same machine without interacting with the benchmark browser window.
- Use the median of the three runs for timing, long-task, and heap comparisons.
- The fixture contains 200 user/assistant rounds, 200 frame-paced streaming text mutations, and replacement of every tenth official action row.
- The benchmark uses the built Chrome extension in real Chromium. It does not access a live ChatGPT account or network content.
- Before reading `usedJsHeapBytes`, the benchmark explicitly requests a renderer garbage collection through the Chromium DevTools Protocol. This makes heap medians comparable instead of depending on incidental browser GC timing.
- Reliability invariants are absolute on every run; timing and heap budgets use the three-run median because browser scheduling has normal variance.

The benchmark must always satisfy all of these invariants:

- 200 of 200 message toolbars appear.
- every official action row contains exactly one AI-MarkDone toolbar.
- all replaced official action rows recover within 500 ms.
- no phase may increase an already accepted bundle or runtime median captured under the same measurement protocol by more than 10% without an explicit documented reason.
- `npm run test:core` and `npm run build` remain green at every phase boundary.

## Phase 0 baseline

Captured on 2026-07-11 on Apple Silicon (`darwin-arm64`) from the unoptimized 4.7.0 content runtime. Values below are the median of three runs.

| Metric | Baseline |
|:--|--:|
| `content.js` raw | 3,357,760 bytes |
| `content.js` gzip | 768,989 bytes |
| toolbar ready | 691.6 ms |
| cold long-task total | 492 ms |
| cold maximum long task | 219 ms |
| cold mutation records | 5,378 |
| idle mutation records / 2 s | 16 |
| streaming long-task total | 737 ms |
| streaming maximum long task | 194 ms |
| streaming mutation records | 1,032 |
| official-row recovery | 171 ms |
| Shadow Roots | 201 |
| shadow descendants | 9,603 |
| used JS heap | 13,689,482 bytes (legacy pre-GC sample; informational only) |

The initial repository baseline also requires `npm run test:core` to pass all 1,195 tests and `npm run build` to produce valid Chrome MV3 and Firefox MV2 entry files.

## Phase gates

| Phase | Change boundary | Required threshold before advancing |
|:--|:--|:--|
| 1 | Production minification and build hardening | `content.js` raw <= 1,900,000 bytes; gzip <= 500,000 bytes; entry-format checks green for Chrome and Firefox; runtime medians do not regress >10%. |
| 2 | Linear bookmark/path work, CSS-only official navigation hiding, lifecycle cleanup | idle mutation records <= 2 per 2 s; 3,000-bookmark focused perf test remains green; streaming and toolbar reliability do not regress >10%. |
| 3 | Shared ChatGPT page index | cold long-task total <= 400 ms; cold maximum <= 185 ms; one authoritative ordered message/turn snapshot per DOM revision; all content-discovery callers remain behaviorally aligned. |
| 4 | Event-driven toolbar reconciler | 200/200 toolbars; zero duplicates; official-row recovery <= 500 ms on every run; toolbar-ready median <= 750 ms; streaming long-task total <= 500 ms. |
| 5 | Shared page-awareness, formula scan, and cache invalidation | streaming long-task total <= 400 ms; streaming maximum <= 150 ms; streaming mutation records <= 650; no stale route or message cache after navigation. |
| 6 | Shared per-toolbar resources | shadow descendants <= 9,400; post-GC used JS heap <= 12,500,000 bytes; toolbar visual and action parity green. |
| 7 | Host/feature bundle separation | ChatGPT startup `content.js` raw <= 1,300,000 bytes; gzip <= 350,000 bytes; feature panels load only from explicit user triggers; Chrome/Firefox/Safari build parity green. |
| 8 | Final soak and closeout | cold long-task total <= 325 ms; cold maximum <= 150 ms; streaming long-task total <= 375 ms; streaming maximum <= 140 ms; all reliability invariants pass for three runs plus manual long-thread/route/theme/settings regression. |

If a phase misses a threshold, work stays in that phase. The implementation may be revised or the threshold may be changed only with new evidence recorded in this document; a red gate must not be silently waived.

## Accepted phase results

### Phase 1 — 2026-07-11

- `content.js`: 1,847,654 raw bytes and 485,855 gzip bytes, down 45.0% and 36.8% from Phase 0.
- Three-run runtime medians: toolbar ready 619.2 ms; cold long-task total 541 ms; cold maximum 238 ms; streaming long-task total 754 ms; streaming maximum 193 ms; official-row recovery 160.9 ms; used JS heap 9,990,185 bytes. The heap value predates forced-GC sampling and is retained only as historical context.
- Cold long-task total remained within the allowed 10% variance (+9.96%); streaming total was +2.3%; toolbar reliability remained 200/200 with zero duplicates.
- Chrome, Firefox, and Safari builds passed classic-entry parsing, Chromium-compatible encoding, entry-format, and per-runtime bundle budgets.
- Build investigation found that UTF-8 minifier output could preserve the Unicode noncharacter `U+FFFF`, which Chromium rejects when loading a manifest content script. All production builds now use ASCII-safe escaped output, and the entry gate rejects UTF-8 decoding failures and Unicode noncharacters.

### Phase 2 — 2026-07-11

- Replaced repeated bookmark identity scans, folder-descendant checks, and background bulk-remove scope checks with indexed or normalized scope-matcher paths. Focused regression tests cover 1,500 selected bookmarks, 1,000 folder checkbox states, and 500 removal scopes; the existing 3,000-bookmark stress gate remains green.
- Official navigation hiding now installs one exact, fail-open CSS rule and performs no geometry reads, `hidden` writes, timers, or `MutationObserver` refresh work. The directory and its dedicated `hideOfficialNavigation` setting must both be enabled before the rule is installed.
- `ScanScheduler.dispose()` now cancels queued idle or timeout work and prevents disposed schedulers from executing deferred scans.
- The original heap sampling varied from roughly 9 MB to 16 MB across identical runs because it depended on incidental browser garbage collection. The benchmark now forces GC immediately before reading heap usage; three consecutive post-GC samples were 7,603,423, 7,606,159, and 7,607,211 bytes.
- Final three-run runtime medians: toolbar ready 625.5 ms; cold long-task total 482 ms; cold maximum 217 ms; idle mutation records 0 per 2 seconds; streaming long-task total 740 ms; streaming maximum 196 ms; official-row recovery 171.3 ms; post-GC used JS heap 7,606,159 bytes.
- Toolbar reliability remained 200/200 with zero duplicates on every run. `content.js` remained within its accepted budget at 1,846,951 raw bytes and 485,648 gzip bytes.
- The phase boundary passed all 1,201 core tests plus Chrome and Firefox production builds, entry-format checks, and bundle budgets.

## Scope protections

- Do not use viewport-lazy toolbars; users must retain immediate actions on every hydrated official action row.
- Do not reintroduce conversation DOM virtualization as part of this program.
- Toolbar placement remains anchored to ChatGPT's official `copy-turn-action-button` row. There is no content-body fallback.
- Official navigation hiding must fail open when the exact official selector no longer matches.
- Bundle splitting must not use runtime syntax that violates extension entry-format gates.
