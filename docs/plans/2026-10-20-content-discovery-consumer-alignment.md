# ChatGPT discovery and consumer alignment

Status: implementation, full automated checks, dual build and installed Chrome
admission/Directory/bookmark/Reader acceptance passed. Delivery limits for the
extra clipboard/download probes are recorded below. Work stays on
`codex/unify-workflow-pages`; no main merge or publication is authorized.

## Scope and working tree

- The current branch contains the nine post-6.2.0 implementation commits.
  `codex/refine-export-dialog-style` is its ancestor. The older compact-controls
  branch shares the implementation through `78ce7d36` and adds only an acceptance
  documentation commit; it is not another unmerged implementation.
- Preserve the 17 existing uncommitted width/settings files. Their initial patch
  is retained outside the repository. Do not stage them as part of this repair.
- No extra observer, content pool, conversation request, consumer DOM discovery,
  automatic page refresh, storage migration or weakened bookmark identity check.

## Native reproduction and cause

- The user's current Chrome conversation has three completed assistant replies
  and three message toolbars, but only two Directory entries. The third toolbar
  permits Markdown copy and Reader while its bookmark button is disabled.
- Extension-only, read-only diagnostics show two obtained turns, four dirty IDs,
  no compiler rejection and 50 then 52 `identity-conflict` admission rejections.
  Native screenshot and redacted diagnostics are stored in the task artifact
  directory `discovery-chain-2026-10-20`.
- Inspection of extension ownership metadata (no message bodies) identifies the
  third stable user slot's stored assistant owner as `fallback-turn-2`; its live
  DOM already has a real assistant ID. A window-local streaming placeholder had
  reserved the slot and blocked the final identity.
- Toolbar display and temporary read-only actions can use a pending Surface
  entry. Directory and bookmark writes require obtained canonical content.
  Therefore working copy/word count did not demonstrate successful admission.

## Repair boundaries

1. Reject `fallback-turn-*` and `client-created-root` as semantic message IDs in
   round projections and topology proofs. The raw PageIndex may retain display
   coordinates for observation, but the Repository must not acquire them.
2. Recognize modern retained `data-turn-key` owners for identity transitions,
   including replacement of a child assistant unit. Replacing the whole owner
   element, even with the same key, does not prove continuity.
3. Permit replacement of a proved, not-yet-compiled identity as well as an
   obtained turn. Validate document, user, exact slot, sole previous owner and
   unique incoming body transactionally. Retired IDs must leave the dirty set.
   Producer-only ownership reads do not extend the public consumer interface.
4. Keep all consumers on the existing Source/Surface contracts. Refresh Reader
   for rich-block-only changes; use the shared canonical current-item projection
   when ready, retaining the pending read-only fallback.
5. Verify the related page-to-canonical promotion wakeup separately; do not
   capture a previous conversation into a new canonical conversation.

Initial page promotion now resumes capture and preserves PageIndex owner evidence.
After entering a canonical conversation, later routes alone cannot authorize
recapture; real New Chat host mutations continue through the existing observer.
Tests reject both A→B and A→home→B with unchanged old DOM.

## Regression evidence

- Before fixes: four native temporary/fallback ID × same/replaced child tests
  fail admission; modern-owner replacement event fails, whole-owner remount
  rejection passes. Eight pending Repository replacement tests fail. Two real
  Runtime integration cases fail against a temporary HEAD baseline.
- Reader rich-sidecar-only updates have four failing regressions before its fix.
- After initial producer repair, source, Surface, navigation and Reader
  projections publish the same third turn and read token. Follow-up dirty-set
  assertions caught a retired-ID leak and are retained.
- Producer/source/Reader focused run: 5 files / 160 tests passed; subsequent
  Repository/PageIndex checks: 2 / 83 passed. Consumer + copy/producer suites:
  7 / 99 passed. Page promotion lifecycle: 7 / 7 passed.
- The first full run found nine pre-existing workflow-window failures. Isolated
  `HEAD` baseline reproduced the same 9 failures / 103 passes across four suites.
  Current documented inline selects, flat materials and async copy state needed
  test adaptation; an actual Reader Escape bubble-boundary failure also existed.
- Reader's existing capture handler now routes eligible Escape through the
  existing close priority, using shared topmost/transient/defaultPrevented/IME
  guards. OverlaySession defaults are unchanged. Real header→export→confirmation
  order, nested settings/template focus return and IME safety remain asserted.
  Those four suites now pass all 112 checks.
- Final `npm run test:core`: 340 files / 3116 tests passed, 41.14 s.
- Final `npm run build`: Chrome and Firefox passed, including entry-format and
  the single-pool ChatGPT content/Surface boundary checks. `git diff --check`
  passed. Only docs changed after these gates; implementation/tests are frozen.
- Final Chrome content hash:
  `1012de32d327f2054abdde85d17e2e59c2376782b9029bbd38390567bbd672c0`.
  The original reported page had the older `a14dc9e2...` script. The user reloaded
  the development extension; the accepted mathematical page subsequently proved
  the exact new hash. No automatic refresh of the original conversation occurred.
- All 14 original nonshared width/settings files retain their exact original
  diffs. The three shared documentation files retain the original width work
  plus the explicitly added discovery records. No unrelated changes were reset.

## Live follow-up

- The user completed extension reload. Initial automated-page replies displayed
  the host's `This response couldn’t load` message; those are not successful
  content acceptance. No empty/error reply is counted as a successful math answer.
- Process correction: the user rejected meaningless test-label prompts. Continue
  with ordinary mathematics: quadratic-formula derivation, negative discriminant
  and complex roots, then a parameterized equation and its classification table.
- The user supplied the now-rendered mathematical conversation
  `6ad6c5f0-e58c-83ec-b381-6438ab1c8c45`. Its first reply has real formulas,
  interactive learning blocks, a table, an 847-character toolbar and one Directory
  entry. Follow-up questions are sent in that approved conversation.
- A native input attempt landed in the omnibox and was cancelled without
  submitting or navigating. Subsequent input uses the exact approved tab and
  `Ask ChatGPT` textbox locator; never rely on an unverified native input focus.
- Continued with actual mathematics in the user-approved page: negative
  discriminant/complex roots, then `x²−2tx+t+2=0` and its classification table.
  The two new replies completed without a page refresh. Directory grew
  **1→2→3**; toolbar counts were 847, 1099 and 686 characters.
- The third reply's bookmark was enabled. Saved
  `含参数二次方程：判别式与根的分类` using the existing default `Signal processing`
  folder. Reopening Library showed the new entry and the previous FFT bookmark;
  its excerpt contains the third reply's actual equation and LaTeX derivation.
  The toolbar and Reader both reported bookmark active `1`.
- Reader opened at **3/3** with the correct question, formulas and classification
  table. A real header Escape closed it after its closing animation. Existing
  static rich-block representation was retained, not a claim of interactive
  widget fidelity.
- The installed page's exact content-script hash matches the final build. Its
  read-only diagnostic snapshot reports `ready`, three obtained turns,
  `dirtyAssistantCount: 0`, `compileRejections: {}` and
  `admissionRejections: {}`. Saved as `after-math-diagnostics.json`.
- Current-message Export opened with **selected 1 / 3**, selecting message 3.
  An additional Markdown download probe timed out waiting for its delivery event
  and interrupted the automation session. The native page remained intact; no
  repeat Save was issued and no delivered file is counted as verified.
- Copy displayed its success feedback, but the browser clipboard broker returned
  no items/text. This is not a verified native OS clipboard round trip; clipboard
  correctness remains supported by the real-trigger automated copy tests.
- Artifacts include `after-third-toolbar-directory.png`,
  `after-library-saved-math.png`, `after-reader-third.png`,
  `after-export-third-selected.png` and the redacted diagnostics. No original
  bookmark was removed and no original conversation was refreshed automatically.

## Acceptance

- New replies: old turns remain, count grows once, IDs/positions are unique,
  Directory updates and the completed turn becomes bookmarkable through the same
  `readTurn` interface. No placeholder is saved or published.
- Regeneration: replace the same owned reply without growing the count; reject
  unrelated owner/user/document reuse and discard obsolete work.
- Reader/export/selection: one document and token, canonical rich/source content,
  no stale visual sidecar, pending content remains read-only.
- Run focused tests, full core and dual-browser build. Installed Chrome must use
  the new content script after extension reload; automated passes alone are not
  live acceptance. Preserve the user's existing conversation and data.
