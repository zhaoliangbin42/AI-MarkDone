# Highlight recoloring and mixed selections

Status: complete. Implementation, automated gates and installed Chrome acceptance
passed. Changes stay on the current branch; no main merge or release authorized.

## Scope and decisions

- Fix recoloring before extending selection eligibility. Chrome reproduced
  `INVALID_REQUEST: Highlight target cannot change`: storage returned
  `textPosition` as `{ end, start }`, while the incoming record used
  `{ start, end }`. JSON serialization order must not define selector equality.
- Keep one highlight ID/color/revision and the existing background-owned bundle
  and write queue. Existing highlights and annotations are not migrated.
- A mixed highlight may carry optional bounded text fragments. Each fragment
  has its own exact quote and surrounding context, scoped to the same assistant
  identity. No DOM nodes, renderer IDs, assets, or private host state persist.
- Page and Reader share capture/restore policy. Text in paragraphs, headings,
  lists and table cells is eligible. Opaque visuals, code editors, controls and
  special blocks are skipped. An unresolved/ambiguous fragment does not become
  a guessed range or a range spanning an omitted block.
- Copy and annotation source projection remain unchanged. Highlight excerpts
  for newly segmented text are readable escaped text; legacy whole selections
  retain their existing source Markdown and formula behavior.

## Execution order

1. Reproduce Chrome recoloring and lock down storage-order regression.
2. Replace whole-selection rejection by bounded text-only fragment admission.
3. Validate optional fragments, exact shared restoration and backup round trips.
4. Verify real Chrome creation, recolor, table/mixed selection, refresh and Reader.
5. Run appropriate gates/builds, synchronize authorities and commit locally.

## Evidence

Dedicated synthetic ChatGPT conversation:
`6ad0c0f5-2448-83ec-9444-eaf5527b139e`, assistant
`54797868-226c-479c-b78b-d51292421256`. Host generated paragraphs, headings,
lists, table, editable code, math and icon-bearing DIL cards. Initial installed
content script hash matched `0f9fb109b0e195123a80ca2ac025a948962abff304bba948a3f5c5e384862bd2`.

Recolor regression: failed before field comparison (1/6 failed), passed after
the focused fix (6/6).

## Follow-up checks

- The Reader trigger regression exposed a code language label outside `pre`;
  the existing `.reader-code-block` shell is excluded as one boundary.
- A dedicated failing restoration test proved that Reader's textual rich-block
  fallback also needs exclusion. `[data-aimd-rich-block]` now shares the visual
  boundary; its explanatory text never shifts the eligible-text axis.
- A failing geometry test proved that the old 8px rectangle merging could bridge
  a skipped small icon. Independent fragment text rectangles now stay separate;
  ordinary annotation/highlight rectangles keep their existing merging behavior.
- Focused regression: 9 files / 118 tests passed, including unchanged atomic
  Markdown copy tests; the final geometry correction then passed 4 / 73 focused
  tests. An earlier full run passed 334 files / 2904 tests
  before the final fallback correction; it is not the final-build core evidence.
- Final `release:verify` passed smoke (8 / 63), default concurrent acceptance
  (34 / 497), Chrome/Firefox builds, entry formats and single-pool boundaries.
  Content script hash: `031022f94c13e42311643bb8e6a0a84974b0b6f74917648c78c0210964e97b24`;
  background hash: `42d9596dcd57e46ab7be495c5d5e9640d6b4ecb130631fc85eb980d57efe9cde`.
- The frozen final implementation passed full core: 334 files / 2906 tests,
  2026-10-15 20:37:51, 231.47 seconds. The intermediate 2904/2905 runs are
  retained separately, not substituted for this final result. Diff check passed.

Initial installed Chrome follow-up (before the fallback-only final build):

- Existing baseline highlight `highlight-89b07e9f-c740-4b31-918b-abcf3b7999ca`
  recolored blue → red, revision 1 → 2, ID unchanged.
- Table partial text `中文` persisted as one fragment and painted a 29px × 17px
  text rectangle, not the cell bounding box.
- Mixed selection spanning a native code editor persisted five text fragments;
  neither its Python label nor code body entered the quote. Opening the real
  Reader restored the same five areas, together with the old prose and table mark.
- A second host response (`53988fce-0bcb-4d6f-878d-733158fa0a3a`) generated an
  actual `<img data-d-component="svg">` between unique B7/C9 paragraphs and
  icon-bearing comparison cards. Saving across the SVG produced exactly B7/C9
  fragments, with no visual source. Final-build visual-boundary checks are pending.

Temporary browser diagnostics only intercepted this synthetic conversation's
`highlights:update` messages. Original functions and diagnostic globals were
restored immediately. No credentials, private React state or active conversation
API requests were read or introduced.

## Final installed Chrome sign-off

The user reloaded the unpacked extension. A fresh page and its subsequent reload
both loaded the exact final content hash above (debugger script 401 on reload).
The synthetic conversation was the only data modified during acceptance.

| Check | Observed result |
| --- | --- |
| Existing mark restore | All four baseline IDs restored after page reload. |
| Recolor | The two-fragment SVG-adjacent mark changed red → blue through the real side marker and color button; ID remained unchanged. |
| Decorative icons | The native learning card contained three SVG icons. Selecting it saved six text fragments and painted text without the icons. |
| Page → Reader | The prose, partial table, five-part code-skipping selection and six-part card highlight all restored in Reader. |
| Reader → page | Reader's real swatch saved partial table text `重点`, ID `highlight-9869aae5-9ac8-4187-8945-e7c6da151e7f`; closing Reader showed the same ID/color at the matching native table text. |
| Opaque visual → Reader fallback | The native SVG became a `SPAN[data-aimd-rich-block]` textual placeholder. Exactly the two blue B7/C9 text areas restored; the placeholder stayed unhighlighted. |
| Fresh-page persistence | A separate page loaded both assistant messages without host errors and restored all six test IDs, including the new Reader mark. |

Selections were set through public DOM Range for repeatability; creation,
recoloring, Reader entry, pagination and closing used the actual installed UI.
One cold page temporarily showed the host's `This response couldn't load` message.
Stored records remained intact and no erroneous anchors were drawn. A deliberate
reload of this dedicated test tab restored the host content and the marks; this
is test operation, not an automatic production refresh fallback.

Screenshots and logs live in the task artifact directory
`highlight-acceptance-2026-10-15`: `final-svg-restored.jpg`,
`final-decorative-card.jpg`, `final-reader-table.jpg`, `final-reader-svg.jpg`,
`final-reader-to-page.jpg`, `final-signoff.json` and the final core/release logs.
Temporary debugger breakpoints were removed. No source code changed after the
frozen final gates. Firefox build parity passed; Firefox native UI was not tested.

## Supported-subset follow-up

User correction: the presence of an unsupported block must not suppress colors
for supported selected content. Investigation found partial math/inline-code
whole-selection rejection, whitespace-only admission and capture-limit-driven
button hiding. Three initial tests failed before implementation; an additional
test reproduced complete math disappearing when selected alongside a visual.

Decisions:

- Page and Reader share one cheap bounded availability policy and one complete
  explicit-action capture policy. Supported content offers colors even if other
  content is omitted. Save limits remain; failures explain retry and never
  silently trim a selected group.
- Partial inline code is ordinary selected text. Partial math is omitted without
  expanding to unselected glyphs; prose on either side remains eligible.
- New complete source-bearing formulas use an optional formula fragment, whether
  standalone or mixed. Authoritative source and adjacent ordinary text prove
  identity across renderer glyph/wrapper changes. Duplicate/changed formulas fail
  closed. This leaves the old text-index axis and all existing records unchanged.
- Formula rectangles use the existing atomic-unit geometry; text rectangles keep
  their independent ranges. Existing copy and annotation policies are untouched.
- Keep the existing single background writer, record IDs, grouped color/revision,
  backup routes, settings and browser targets. No observer or content pool added.

Follow-up automated verification passed:

- Targeted service, real page/Reader trigger, copy, storage/backup and i18n
  regressions: 10 files / 166 tests; the added atomic-paint geometry regression
  then passed with the 18-test anchoring file.
- Frozen full core: 334 files / 2924 tests, 2026-10-15 21:57:19, 225.55 seconds.
- `release:verify`: smoke 8 / 63, concurrent acceptance 34 / 497 and both builds.
- Final `npm run build` after all test edits passed Chrome/Firefox entry-format
  and single-pool boundary checks; diff check passed. Source/test fingerprint:
  `767244686e3b8aee8d193ae7c6b7b7adb24c512a8f4e0d33bf3f8776e7e4c85e`.
- Chrome content hash: `cc8b4fb7f1cf350bc9bcd9f73629401f0c300ae0523f43ce90d46c2aecf40096`;
  background hash: `df9987ae14539a8649c07e63cebba75509f8f8f597b70c621c961da5d700fd2a`.
  Logs are in the task artifact directory `highlight-supported-subset-2026-10-15`.

Baseline installed Chrome evidence above belongs to commit `8fe06e56`; this
follow-up was verified through automated production-trigger/renderer checks and
builds, not a freshly reloaded installed Chrome. No source changes followed the
frozen full-core run. Existing stored records require no migration.
