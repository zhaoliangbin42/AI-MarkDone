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

At this initial checkpoint, installed Chrome still required an extension reload;
the follow-up below supersedes that navigation-acceptance gap. Native Firefox
acceptance is outside this task's requested scope. No main merge, push, tag or
release is part of either checkpoint.

## Installed Chrome follow-up (2026-10-14)

The user reloaded the unpacked extension. A dedicated Chrome tab loaded scripts
whose debugger SHA256 matched the built `9fead384` files (`content.js` and
`content-features.js`), so these observations are installed-extension evidence,
not component-fixture claims. Existing bookmarks were used; no user record,
setting or conversation message was created, edited or deleted.

| Real trigger | Observed result |
| --- | --- |
| Library → existing message bookmark → Open conversation | One user-initiated document navigation carried the saved assistant `messageId`. ChatGPT removed the query after loading; the exact saved ID appeared once in the destination DOM. |
| Long conversation → early Directory target → host Scroll to bottom → early target again | Obtained entries remained in the pool while the chosen assistant was absent from DOM. Activating its Directory entry hydrated the exact ID and landed it at about 154 CSS px, with no failure toast or document navigation. |
| Message toolbar → Reader → earlier item → Locate | Reader content matched the native assistant; location succeeded and the Reader closed after completion, with no document navigation. |
| Latest-message Reader → historical item absent from DOM → Locate | The actual document overflow lock was `hidden` while the target was absent. Navigation hydrated the exact historical ID, landed it at about 154 CSS px, then closed Reader and restored overflow. No document navigation occurred. |

One initial locator-driven mouse click during rail hover expansion focused an
adjacent button; that attempt is excluded from target-navigation acceptance.
Subsequent observations recorded the activated button and used a fresh native
AX target or keyboard Enter. They prove navigation for the actual selected ID,
not an assumed mouse coordinate.

Evidence is under `chrome-navigation-acceptance-2026-10-14/` in the task
visualization directory: `navigation-baseline.json`, `reader-unmounted.json`,
`directory-unmounted.jpg` and `reader-unmounted.jpg`. These artifacts contain
the before/after mounted state, exact IDs, geometry and top-level navigation
events. They do not claim every conversation/branch or native Firefox passed.

### Parallel gate investigation and fixes

The original formula failure was reproducible through a real configured
keyboard copy, an intervening host clipboard write and the final extension copy
listener. Charging 65ms to the original formula-descendant scan deterministically
reproduced host visual text instead of TeX. Closed math now skips generated
candidate descendants and proves full non-collapsed coverage by endpoints;
TeX extraction, serializer and the 64ms / 5000-node bounds remain unchanged.
The functional compaction fixture uses a fixed clock; independent regressions
still enforce actual extraction timeout and reject an empty collapsed caret.

The default parallel gate also exposed delayed annotation-window initial focus
stealing the fallback link's focus. A controlled real Reader trigger regression
reproduced it, separate from the formula diagnosis. Shared initial focus now
defers to a newer transient root, including focus within Shadow DOM; it still
performs normal initial focus in its own surface. IME composition focus and
unsaved text retention are covered without adding an observer or listener.

### Final follow-up verification

| Gate | Result |
| --- | --- |
| Focused formula, Reader and keyboard suites | 7 files / 105 checks passed |
| `npm run release:verify` with its default parallel acceptance | Passed: smoke 8 / 63, acceptance 34 / 497, then both browser builds and entry/boundary checks |
| `npm run test:core -- --maxWorkers=1` | 333 files / 2894 checks passed |
| `git diff --check` | Passed |

Production and tests stayed frozen throughout these final gates. The prior
formula failure, controlled reproductions, the intermediate empty-formula red
case and the later focus failure remain in their original logs; none is
relabeled as a passing run. Final logs are saved in the task visualization
directory under `chrome-navigation-acceptance-2026-10-14/automated/`.

The user reloaded the final build. A fresh Chrome diagnostic tab's loaded
`content.js` SHA256 matched the final built file:
`0f9fb109b0e195123a80ca2ac025a948962abff304bba948a3f5c5e384862bd2`.
The navigation code is unchanged from the installed navigation cases above.

The saved UI preferences were Cmd/Ctrl+C and Markdown dollar delimiters; they
were read without modification. The selection's Copy Markdown button produced
`$(R,\theta)$`, confirmed by pasting into a script-free local input. The browser
tool's shortcut convenience path was separately observed to emit only an
untrusted synthetic `copy`, without the preceding `keydown`; its native TeX
fallback is not evidence of a product shortcut failure. Replaying the complete
keydown→copy sequence in the installed Chrome runtime produced the configured
dollar-delimited TeX. This is explicitly **synthetic event replay**, not physical
keyboard sign-off. Do not change shortcut ownership to hijack context-menu or
copy-only events just to make that tooling path pass.

Evidence: `formula-copy.json`, `copy-final-window-data.json`,
`complete-keyboard-copy-replay.json` and the event/snapshot traces in that
directory. After reload, raw CDP became unavailable on one reused page; a fresh
diagnostic tab supplied the loaded-script hash and public DOM event traces.
No private React state, credentials or conversation API were read.

A native clipboard experiment initially selected an original tab sharing the
same conversation URL and pasted only the known test formula into its empty
composer. That test text was removed and **no message was sent**. Subsequent
native checks used a uniquely marked test URL and checked the actual window
before input. System TextEdit launch also blocked for an unusually long time;
its test document was finally saved to the local evidence directory as
`native-clipboard-verification.rtf`, and the temporary iCloud `Untitled.rtf`
was verified absent. Its paste is not counted as a successful keyboard test.
The editor was quit, all agent-created browser tabs were closed, the localhost
server was stopped, and all temporary DOM attributes/listeners/breakpoints
were removed. Saved bookmarks, settings and conversation messages were not
changed. A browser-session clipboard reset is not a claim that every system
clipboard format was restored.
