# Composer preview and bookmark search repair

Status: Library search implementation verified automatically; composer preview
investigation and installed acceptance pending. No main merge or website edits.

## Authorization and isolation

The user authorized this AI-MarkDone task from the website task to investigate
and repair plugin problems discovered during screenshot capture. Preserve the
website's FFT tab `44092515`, its conversation
`6ad0ed00-a7c4-83ec-a35a-0eaf365f3519`, and existing bookmarks. Use separate QA
tabs; do not modify the website checkout or change its screenshot preferences.

## Composer preview

- Installed Chrome baseline content hash:
  `031022f94c13e42311643bb8e6a0a84974b0b6f74917648c78c0210964e97b24`.
  The workspace is on `d985643d`; distinguish installed/build versions.
- A fraction typed into the real ChatGPT composer reproduces the unavailable
  preview on both an existing conversation and an isolated home page. Test
  formulas remain unsent drafts.
- A temporary wrapper around this QA controller's own renderer captured
  `ExportRenderHostError`, code `RENDER_FAILED`, message
  `Export renderer timed out.`. Reader's KaTeX rendering is a separate pipeline.
- Renderer/MathJax/service unit checks pass (3 files / 25 tests), but this does not
  establish installed iframe correctness. Current investigation distinguishes
  resource load, iframe initialization and private channel liveness.
- Temporary runtime wrappers are removed after each probe. No credentials,
  private React state or user-authored conversation source are logged.
- A cold trace observed the renderer's `src` being superseded by empty `srcdoc`,
  with no private-port response before timeout. There is no `srcdoc` writer in
  this repository. The actor is not yet identified; do not assume MathJax or
  change the renderer/security boundary without confirming the cause.
- Browser control later stopped with an explicit other-extension-UI gate.
  The user has been asked to dismiss/complete that UI. Reloading the isolated
  page cleared the old diagnostic wrappers; subsequent diagnostic iframes must
  also be removed before completing acceptance. The FFT source tab is untouched.

## Bookmark search

- The real input callback calls `clearSelection()` before reading its value.
  The synchronous redraw uses `document.activeElement`, which is the Shadow DOM
  host, and replaces the new input with the previous query.
- Failing production-view input regressions reproduce this for English and
  Chinese composition input. Clearing stays supported.
- Capture the event's value before controller callbacks and check focus through
  the input's own Document/ShadowRoot. No storage/query model or filter semantics
  change. Focused View/Panel checks pass: 2 files / 53 tests.

## Remaining gates

1. Prove the preview failure boundary with installed Chrome evidence and a failing
   regression before changing its implementation.
2. Run targeted tests, build both targets and update the relevant authorities.
3. Request extension reload explicitly when the final build is ready; coordinate
   through this task's visible result so website capture can resume safely.
4. Verify fractions, the FFT display formula, caret cancellation/IME, failure
   recovery and actual search filtering in a separate Chrome tab.

## Automated verification (2026-10-16)

- Search reproducer before implementation: 2 failures / 22 tests; English and
  Chinese input were replaced with the previous empty query.
- After implementation: Bookmarks View/Panel, 2 files / 53 tests passed.
- Formula/asset/export baseline: 3 files / 25 tests passed. This proves local
  renderer functions, not installed iframe initialization.
- Full core: 334 files / 2927 tests passed (37.56 s).
- `npm run build`: Chrome and Firefox passed, including entry-format and single
  ChatGPT content-pool boundary checks. `git diff --check` passed.
- Chrome content build hash remains
  `cc8b4fb7f1cf350bc9bcd9f73629401f0c300ae0523f43ce90d46c2aecf40096`;
  Library is lazy feature code. Do not infer installed feature freshness from
  the content-entry hash. Final installed reload/search acceptance is pending.
- The user was asked to refresh only isolated QA tab `44092532`, manually try
  the fraction without concurrent automation, and report the result. This also
  clears remaining diagnostic iframes. Do not operate around the explicit
  extension-UI browser gate. Preserve FFT tab `44092515`.
