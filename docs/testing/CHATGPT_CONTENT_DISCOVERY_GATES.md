# ChatGPT Content Discovery Gates

This file is the tracked acceptance record for the ChatGPT content-discovery V1 refactor. It records facts and gate results only; it must not contain conversation text, cookies, authorization values, tokens, or raw request headers.

## Phase 0 — real probe

| Field | Result |
|---|---|
| Probe date | 2026-08-05 |
| Browser | Controlled Chrome, logged-in ordinary conversation |
| Route | ordinary `chatgpt.com/c/<conversation-id>` conversation |
| Passive DOM evidence | the ordinary conversation route loaded; no conversation text was read or recorded |
| Existing bridge marker | not present because the controlled tab did not load the local unpacked extension |
| Same-origin conversation GET | **NOT PASSED / INDETERMINATE**: the controller's isolated evaluation surface disables page `fetch` and DOM injection, so it could not execute the MAIN-world probe; this is not endpoint success or failure evidence |
| Token/header safety | no token, cookie, authorization header, or response body was recorded |
| Gate conclusion | the bounded active path is enabled in the release candidate and covered automatically, but installed Chrome/Firefox acceptance remains open and the release gate is not fully green; no token-based fallback is permitted |

The probe must be repeated on an ordinary conversation, a project conversation, a hard refresh, and the old `chat.openai.com` redirect. A successful result records only status code, schema field names, turn count, and elapsed time. Enterprise/Business/Edu and Firefox require separate real accounts; an ordinary account result must not be presented as those environments.

## Fixture policy

Tracked fixtures live in `tests/testdata/chatgpt/discovery/`. They are synthetic or manually redacted graph/route traces containing only schema shape, identity placeholders, turn counts, and state transitions. Raw page captures and all user content remain outside Git and under `output/chatgpt-discovery/` (which is ignored).

## Phase gates

| Phase | Required evidence | Status |
|---|---|---|
| 0 | Real probe and workspace snapshot | Installed-extension probe pending; controller attempt indeterminate |
| 1 | V1 contracts, SSOT updates, and deterministic failure/contract tests | Automated pass; real probe remains open |
| 2 | Repository scenario suite and build | Automated pass; real probe remains open |
| 3 | ChatGPT adapter, bridge boundary verifier, Chrome/Firefox transport parity | Automated pass; installed-browser gate remains open |
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

The final closeout must run the focused discovery suite, `npm run test:core`, `npm run test:smoke`, `npm run test:acceptance`, `npm run perf:chatgpt`, `npm run type-check`, `npm run build`, and `git diff --check`. Both Chrome MV3 and Firefox MV2 installed-extension gates must be recorded before the test gates are called fully green.

## Automated evidence recorded 2026-08-04 and 2026-08-05

- `npm run test:chatgpt-discovery`: 16 files / 226 tests passed on 2026-08-05.
- `npm run test:core`: 260 files / 1,798 tests passed on 2026-08-05.
- `npm run test:smoke`: 6 files / 47 tests passed.
- `npm run test:acceptance`: 24 files / 237 tests passed on 2026-08-05.
- `npm run type-check`, `git diff --check`, Chrome/Firefox boundary and entry-format verifiers passed.
- Reader projection and Save Messages full-export coverage guard focused suite: 4 files / 50 tests passed.
- `npm run release:verify` passed for 5.1.1 on 2026-08-05: 47 smoke tests, 237 acceptance tests, and the Chrome MV3 / Firefox MV2 production builds all passed. Both content bundles are 759.94 kB raw / 199.81 kB gzip; both content-feature graphs are 1,698.53 kB raw / 451.39 kB gzip and remain within budget.
- `npm run perf:chatgpt` launched successfully outside the sandbox but the existing runtime benchmark stopped at its atomic-selection assertion (`selected=1`, `cleared=0`, empty copied Markdown/types, two attribute writes, zero long tasks). The performance gate remains open; no performance pass is claimed.
- The 2026-08-05 performance rerun reproduced the same atomic-selection assertion with zero long tasks; this content-discovery closeout does not claim the performance gate green.
- The focused regressions now cover a pending reconcile arriving during passive-capture wait, V1 content-token validation through the real Reader action path, DOM-only recovery before the host action row mounts, direct assistant-node content recovery when the legacy index or turn wrapper is temporarily unavailable, and V1-backed Directory rail mounting before semantic acquisition completes.
- The Directory mount regression now verifies the rail and preview use the same `document.body` page-level portal as the working lower-right controls, with reattachment after body replacement.
- The runtime lifecycle regression now verifies a disabled page-scoped repository can resume and that ConversationIndex DOM signals are rebound after platform re-enable.
- The convergence regressions verify partial-to-complete active promotion, monotonic partial growth, virtualized-window regression, stale export rejection, request-start generation identity, delayed blank-route completion binding, old-assistant rejection, active route identity validation, and nested project routes.
- The synthetic Repository-only discovery harness and its command were removed because they duplicated unit coverage without crossing bridge, adapter, PageIndex, consumer, or installed-extension boundaries.
- The 2026-08-05 controlled Chrome probe reached an ordinary conversation URL, but that browser context did not load the local unpacked extension and its isolated evaluation surface rejected `fetch`/DOM injection. No endpoint status, live extension action, or installed-browser pass is claimed from that attempt.
