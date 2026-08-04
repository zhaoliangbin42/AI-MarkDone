# ChatGPT Content Discovery Gates

This file is the tracked acceptance record for the ChatGPT content-discovery V1 refactor. It records facts and gate results only; it must not contain conversation text, cookies, authorization values, tokens, or raw request headers.

## Phase 0 — real probe

| Field | Result |
|---|---|
| Probe date | 2026-08-04 |
| Browser | Chrome, existing logged-in tab |
| Route | ordinary `chatgpt.com/c/<conversation-id>` conversation |
| Passive DOM evidence | 6 typed assistant and 6 typed user message nodes were visible in the inspected window |
| Existing bridge marker | not present in the inspected page at probe time |
| Same-origin conversation GET | **NOT PASSED / INDETERMINATE**: a bounded CDP evaluation did not return a status within the tool deadline; this is not evidence that the endpoint is available or unavailable |
| Token/header safety | no token, cookie, authorization header, or response body was recorded |
| Gate conclusion | active acquisition is not enabled until a real logged-in Chrome probe returns a status and schema result within the three-second product boundary; no token-based fallback is permitted |

The probe must be repeated on an ordinary conversation, a project conversation, a hard refresh, and the old `chat.openai.com` redirect. A successful result records only status code, schema field names, turn count, and elapsed time. Enterprise/Business/Edu and Firefox require separate real accounts; an ordinary account result must not be presented as those environments.

## Fixture policy

Tracked fixtures live in `tests/testdata/chatgpt/discovery/`. They are synthetic or manually redacted graph/route traces containing only schema shape, identity placeholders, turn counts, and state transitions. Raw page captures and all user content remain outside Git and under `output/chatgpt-discovery/` (which is ignored).

## Phase gates

| Phase | Required evidence | Status |
|---|---|---|
| 0 | Real probe and workspace snapshot | Blocked at active-read gate; passive-only path verified |
| 1 | V1 contracts, SSOT updates, and deterministic failure/contract tests | Automated pass; real probe remains open |
| 2 | Repository scenario suite and build | Automated pass; real probe remains open |
| 3 | ChatGPT adapter, bridge boundary verifier, Chrome/Firefox transport parity | Automated pass; active/installed browser gates remain open |
| 4 | Materialization and consumer migration | Automated pass; installed browser gates remain open |
| 5 | Installed-extension acceptance, performance, SSOT closeout | Pending |

## Invariants

- document identity is the verified route conversation ID;
- turn identity is typed and unique; ordinal is display-only;
- one semantic snapshot produces one content token and no duplicate notification;
- a transient same-document failure keeps last-good content as `stale`;
- an unverified branch is never merged into the previous branch;
- unavailable is explicit and cannot masquerade as an empty ready conversation;
- after two idle seconds there is no discovery timer, rescan, or acquisition activity.

## Commands

The final closeout must run the focused discovery suite, `npm run test:core`, `npm run test:smoke`, `npm run test:acceptance`, `npm run harness:chatgpt-discovery -- --repeat=20`, `npm run perf:chatgpt`, `npm run type-check`, `npm run build`, and `git diff --check`. Both Chrome MV3 and Firefox MV2 installed-extension gates must be recorded before the test gates are called fully green.

## Automated evidence recorded 2026-08-04

- `npm run test:chatgpt-discovery`: 9 files / 62 tests passed.
- `npm run test:core`: 260 files / 1,772 tests passed.
- `npm run test:smoke`: 6 files / 47 tests passed.
- `npm run test:acceptance`: 24 files / 228 tests passed.
- `npm run harness:chatgpt-discovery -- --repeat=20`: 20/20 passed, no ordering/duplicate/empty-snapshot failures.
- `npm run type-check`, `git diff --check`, Chrome/Firefox boundary and entry-format verifiers passed.
- Reader projection and Save Messages full-export coverage guard focused suite: 4 files / 50 tests passed.
- `npm run build` passed in a controlled run outside the sandbox: Chrome MV3 and Firefox MV2 graphs, renderer, entry format, discovery boundary, and bundle-size verification all passed. The earlier in-sandbox attempt was blocked only by the `tsx` launcher `listen EPERM`.
- `npm run perf:chatgpt` launched successfully outside the sandbox but the existing runtime benchmark stopped at its atomic-selection assertion (`selected=1`, `cleared=0`, empty copied Markdown/types, two attribute writes, zero long tasks). The performance gate remains open; no performance pass is claimed.
- A final rerun on 2026-08-04 reproduced the same atomic-selection assertion; this directory/content-port closeout does not claim the performance gate green.
- The focused regressions now cover a pending reconcile arriving during passive-capture wait, V1 content-token validation through the real Reader action path, DOM-only recovery before the host action row mounts, direct assistant-node content recovery when the legacy index or turn wrapper is temporarily unavailable, and V1-backed Directory rail mounting before semantic acquisition completes.
- The Directory mount regression now verifies the rail and preview use the same `document.body` page-level portal as the working lower-right controls, with reattachment after body replacement.
- The runtime lifecycle regression now verifies a disabled page-scoped repository can resume and that ConversationIndex DOM signals are rebound after platform re-enable.
- The requested live Chrome tab remained on the exact ordinary conversation URL. The tab list and selected-tab handoff were confirmed, but the page's large DOM snapshot/visible-DOM reads exceeded the browser-control deadline; no live click or message send is claimed from that attempt. The initial bounded page inspection had shown injected message actions but no visible directory rail, consistent with the source-unavailable/late-materialization path under investigation.
