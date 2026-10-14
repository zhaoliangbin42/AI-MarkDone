# Shared ChatGPT message navigation — 2026-10-14

## Scope and decisions

Upgrade bookmarks, Directory, Stepper and both Readers on the current feature
branch. Preserve existing content extraction, settings, bookmark records/keys,
indexes and backup formats. Do not merge main or publish this checkpoint.

The single runtime interface remains `ConversationNavigationPortV1.navigate`.
The coordinator resolves identity and owns cancellation/deadline. The ChatGPT
driver materializes one target through an exact mounted anchor, a calibrated
host slot or bounded seek; the existing UI helper validates final alignment.
No consumer may bypass this port when it is missing.

A unique assistant ID wins over an obsolete ordinal or provisional turn/user
label. Known contradictory identities, duplicate IDs and changed documents fail
closed. Source wait, materialization and alignment share an absolute deadline
of at most 15 seconds. Pointer, keyboard, wheel, touch, replacement navigation
and document/projection changes cancel old work. Success requires a current
identity, connected exact anchor and proven landing.

Cross-conversation bookmarks and Library marks derive `?messageId=<id>` at
click time through a pure contract shared by background and content UI. It
allows official HTTPS conversation URLs only, rejects synthetic IDs and clears
old message/search positioning parameters and hash. Unrelated query parameters
remain. ID-less old bookmarks open the conversation without guessing a position.

Pending restoration waits for both route and source document, binds that
document and owns one deadline/controller. Every terminal outcome consumes the
matching intent; stale receipts cannot consume a replacement. Later source
updates cannot retry an expired intent or steal scrolling. User takeover while
waiting also consumes it. Disposal aborts its own attempt, never unrelated work.

Reader items carry their current optional `meta.documentKey` so replacing items
or promoting a page identity to a canonical conversation cannot leave locate
actions bound to an obsolete closure. Older items may use their captured URL
or original document as a compatibility fallback; the current source is never
used to relabel an old item.

Detached Reader locate is bound by background to the session's recorded source
URL or trusted page-scoped snapshot identity, overriding caller document keys.
Page-scoped home/temporary conversations retain same-runtime locate support.
This adds runtime/session metadata only, with no bookmark/backup migration.
The source returns `{ located: boolean }`
inside a successful RPC; transport success alone does not mean location success.
Its 20-second RPC budget covers the source's 15-second navigation budget. Neither
outcome closes the detached tab. In-page Reader closes only after success;
failure preserves unsaved comment text, its DOM node and selection.

ReaderBinding compares item document identity, so a page→canonical promotion
updates items even when message text and IDs are unchanged. URL query cleanup
alone does not replace the body. A failure link must match that same document;
when the router URL leads the item, a matching captured URL is used or the link
is omitted rather than opening the wrong conversation.

Recoverable failure uses shared persistent feedback with a native explicit
new-tab message link and Close control. It never refreshes the current page.
Cancelled/stale requests are quiet, and identity conflicts offer no guessed
link. The existing user-click Refresh message navigation control is unchanged.

## Host research and compatibility boundary

Live Chrome research verified user and assistant message IDs in `messageId`
links; the host consumes the query after positioning. The assistant landing can
be partially clipped, so the extension still verifies same-page alignment.
The loaded host bundle maps message IDs to turn keys and calls its virtual
list's `scrollToKey` through React-held references. No public, supported same-page
API was found; production does not access React/Fiber, webpack or private list
state. No conversation request, credential access or second observer/pool is added.

The legacy empty `?message=` URL did not mount the former official rail in the
observed host. This investigation does not claim an official Directory click
was inspected or that undocumented URL behavior is guaranteed in future hosts.
Same-page bounded positioning plus explicit new-tab fallback remains the safe
compatibility chain.

Research evidence: `message-id-navigation-research-2026-10-14/findings.json`
under the task visualization directory. This is host-link research, separate
from acceptance of the newly built extension.

## Verification

Tests first reproduced the old empty-query bookmark navigation, missing-port
current-page assignment, early Reader close, missing fallback action, total
deadline/cancellation gaps and route-before-source restoration. Focused tests
then exercise the common seam through real UI trigger paths.

Shared feedback browser replay covers English light desktop/320px and Chinese
dark 320px with reduced motion, overflow/console checks, keyboard close/focus
return and actual link activation opening a new tab. Evidence:
`navigation-upgrade-2026-10-14/toast/report.json` in the task visualization
directory. `toast/reader-keyboard.json` additionally records focus, Tab and
Shift+Tab with a real Reader component still mounted. These are Headless
Chromium fixtures, not an installed-extension run.

The default parallel `release:verify` attempt stopped in acceptance: the existing
large-formula copy case returned host text. That path has an unchanged 64ms
processing budget; the single-worker acceptance rerun passed. This checkpoint
records the final single-worker gates separately and does not claim the default
parallel release command passed. No formula-copy production code was changed.

Final gates on the frozen source:

| Gate | Result |
| --- | --- |
| `npm run test:smoke` | 8 files / 63 checks passed |
| `npm run test:acceptance -- --maxWorkers=1` | 34 files / 495 checks passed |
| `npm run test:core -- --maxWorkers=1` | 332 files / 2886 checks passed |
| `npm run build` | Chrome MV3 and Firefox MV2 passed, including entry-format and single-pool boundary checks |
| `git diff --check` | Passed |

Built manifests retain the current 6.2.0 version; this checkpoint does not bump
or publish a version. Final logs and the earlier parallel attempt are preserved
under `navigation-upgrade-2026-10-14/automated/` in the task visualization
directory. Production was frozen before the final core/acceptance/build runs.

Installed Chrome requires an extension reload before acceptance of these
changes can be claimed; native Firefox acceptance is outside this task's
requested scope. No main merge, push, tag or release is part of this checkpoint.
