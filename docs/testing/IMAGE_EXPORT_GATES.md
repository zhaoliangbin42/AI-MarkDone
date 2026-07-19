# Image Export Gates

This document is the executable acceptance contract for message PNG and formula asset export. It supplements `CURRENT_TEST_GATES.md`; it does not replace the repository-wide build, smoke, acceptance, or release gates.

## Current Status (2026-07-19)

The production message path uses the proven content-side `message-card-v1` renderer and restores one-long-PNG output with conservative Canvas scaling. The trusted-TeX formula path still uses the extension renderer. Streaming encoder and built-renderer fixtures remain useful lower-level experiments, but they are not the production message-delivery architecture. This document remains the target gate, not a claim that every row is green.

- **Green evidence:** Chromium/Firefox short fixtures are pixel-identical to their checked-in new-renderer goldens. Three canonical 60k runs produced one decodable 1x PNG per engine with no remote request or final full-height Canvas: Chromium rendered 480×60,114px in 6.27/6.17/6.11s (6.17s median), while Firefox rendered 480×64,523px in 17.59/17.51/17.61s (17.59s median). The validator used at most a 480×256 Canvas. A 67,061px fixture produces the mathematically minimum two 1x parts (65,512 + 1,549px). Real Chromium/Firefox formula PNG jobs covering CJK underbrace, mhchem and NewCM output are decodable, and focused protocol/planner/encoder/host/delivery tests are green.
- **Non-blocking performance evidence:** three-run short-image medians are 275.1/127.8ms cold/warm on Chromium and 3,025/3,000ms on Firefox. Chromium clears the warm target and the 60k file-time target is green on both engines; Firefox does not clear the former 20% short-warm target. Reported 60k band-raster wall-time peaks are about 615ms on Chromium and 2,090ms on Firefox; this includes asynchronous SVG-image decode and is not a browser Long Task measurement. These timing thresholds are diagnostic targets, not release blockers: correctness, decodability, bounded memory, cancellation, and deterministic hard-limit fallback are the required stability gates. All message jobs use the existing safe 8M-pixel band ceiling directly; a second 2M preference threshold was rejected because a real Firefox 800px/3x fixture repeated the fixed foreignObject setup 14 times and took 29.32s, versus 4 bands and 9.18s at the same output dimensions and pixels. Message output must still never be lowered below 1x merely to force success.
- **Red semantic-fragment gate:** production currently uses semantic-boundary-aware pixel bands. Independent code-line fragments, repeated table headers, and ordered-list `start` reconstruction are not implemented.
- **Red E2E/golden scope:** the built-renderer harness exercises retained lower-level renderer assets directly over MessageChannel; it does not represent the production content-side message trigger and does not replace installed-extension Clipboard/Download checks. Formula visual goldens are still missing.

## 1. Locked Product Contract

- Entrypoints remain current-message Copy PNG, Save Messages PNG, and formula PNG/SVG/MathML copy/save.
- Message input is fresh `ReaderItem[] -> ChatTurn[] -> ExportDocumentV1`; formula input is authoritative TeX or explicit `dom-only` compatibility source.
- Selected messages produce one long PNG whenever the hard budget permits. Multipart ZIP is only the minimum-part fallback at 1x.
- Message effective pixel ratio may step down by 0.5 but never below 1x. Formula PNG may scale below 1x to preserve one complete formula; SVG remains the lossless formula output.
- Markdown file export, PDF delivery, Reader canonical content, settings schema, control placement, clipboard/download behavior, and Safari surface policy do not change.
- Renderer work stays local and offline. No new browser permission, background renderer, Offscreen Document, service, CDP/debugger path, or remote asset proxy is allowed.

## 2. Focused Automated Gates

Run the affected files from this set during development:

- semantic document/profile: `messageExportDocument`, `messageCardProfile`, selection ordering, empty/duplicate indices
- protocol/client/lifecycle: `exportRenderHostProtocol`, `exportRenderHostClient`, transferable chunk order, FIFO, queued/active cancellation, 120-second teardown, one reconnect retry
- output planning: `messagePngOutputPlan`, `messagePngFilenames`, `messageBandPlanner`
- encoder/ZIP: `streamingPngEncoder`, PNG signature/IHDR/IDAT/CRC/IEND, exact RGBA decode, cancel, gap/overlap rejection, `zipBlobs`
- host capability: `messagePngCapability`, one-live-canvas behavior, band dimensions, image placeholder and formula/overflow policy
- delivery services: `copy-turn-png`, `saveMessagesFacade`, `SaveMessagesDialog`
- real triggers: toolbar Copy PNG, Save Messages multi-selection, formula hover copy/save, Safari hidden-copy/visible-save policy
- formula source boundary: authoritative TeX SVG/PNG/MathML parity and `dom-only` PNG-only / `SOURCE_UNAVAILABLE` behavior

The current focused command should include all existing files below plus any new formula-source or worker-client test introduced by the change:

```sh
npx vitest run \
  tests/unit/core/export/streamingPngEncoder.test.ts \
  tests/unit/services/export/messageExportDocument.test.ts \
  tests/unit/services/export/messageCardProfile.test.ts \
  tests/unit/services/export/messageCardProfile.stress.test.ts \
  tests/unit/services/export/messagePngOutputPlan.test.ts \
  tests/unit/services/export/messagePngFilenames.test.ts \
  tests/unit/services/export/messageBandPlanner.test.ts \
  tests/unit/services/export/exportRenderHostProtocol.test.ts \
  tests/unit/services/export/exportRenderHostClient.test.ts \
  tests/unit/services/export/exportTaskScheduler.test.ts \
  tests/unit/services/export/exportRenderer.test.ts \
  tests/unit/services/export/messagePngRenderer.test.ts \
  tests/unit/runtimes/export-renderer/messageBandScene.test.ts \
  tests/unit/runtimes/export-renderer/messagePngCapability.test.ts \
  tests/unit/runtimes/export-renderer/workerPngEncoderClient.test.ts \
  tests/unit/runtimes/export-renderer/formulaAssetCapability.test.ts \
  tests/unit/runtimes/export-renderer/formulaMathJax.test.ts \
  tests/unit/runtimes/export-renderer/formulaSvgRasterizer.test.ts \
  tests/unit/runtimes/export-renderer/entry.test.ts \
  tests/unit/services/copy/copy-turn-png.test.ts \
  tests/unit/services/export/saveMessagesFacade.test.ts \
  tests/unit/services/math/formulaAssetRenderer.test.ts \
  tests/unit/services/math/formulaAssetActions.test.ts \
  tests/unit/drivers/content/export/renderFormulaDomAsset.test.ts \
  tests/unit/drivers/content/export/zipBlobs.test.ts \
  tests/unit/governance/content-feature-boundary.test.ts \
  tests/unit/runtimes/content/lazyContentFeatures.test.ts \
  tests/unit/runtimes/content/entry.test.ts \
  tests/unit/runtimes/content/formulaOnlyRuntime.test.ts \
  tests/unit/ui/content/messageToolbarOrchestrator.copy-png.test.ts \
  tests/unit/ui/content/messageToolbarOrchestrator.safariSurface.test.ts \
  tests/unit/ui/content/formulaAssetHoverController.safariSurface.test.ts \
  tests/unit/ui/export/saveMessagesDialog.test.ts
```

## 3. PNG And Band Correctness

The encoder must prove:

- RGBA8, non-interlaced IHDR
- adaptive PNG row filters
- one zlib stream across all bands and multiple consecutive IDAT chunks
- valid CRC32 and final IEND ordering
- equal-width bands with strictly continuous Y, no overlap, no gap
- exact decoded RGBA for known fixtures
- cancellation stops new chunks and never reaches clipboard/download

The band planner and host must prove:

- first and last row coverage with no duplicated or missing row
- preferred breaks at message and top-level Markdown block boundaries
- line-safe tall code, repeated-header table rows, list-item boundaries and ordered-list continuity
- pixel clipping only for a single block that cannot be split semantically
- code long-line wrap, fixed-width wrapping tables, container-bounded images and proportional display-formula fitting
- broken/timeout images use the existing placeholder
- KaTeX CSS/fonts are prepared once per job and injected once per band
- no band exceeds 8,000,000 device pixels or 8,192px on either side
- at most one large canvas is live; it is released immediately after RGBA transfer

The current boundary-aware pixel implementation proves row coverage, hard budgets, band-local scene projection with safe fallback, off-band subtree filtering, and one-live-canvas behavior. The closed message-card capture profile uses a fixed 126-property computed-style allowlist, and the PNG-only root removes KaTeX's hidden MathML accessibility mirror while retaining the visual KaTeX HTML. Chromium and Firefox short goldens remain pixel-identical after both optimizations. The code-line reconstruction, repeated-header, ordered-list continuity, and semantic-only fallback rows above remain red until production code and non-mocked seam tests exist; numeric planner tests alone are insufficient.

## 4. Fixed Corpus And Visual Goldens

The target stable corpus must include Chinese and English, emoji, RTL, GFM, a thousand-line code block, a wide table, long URLs, CJK underbrace, hundreds of formulas, and broken images. Keep Chromium and Firefox goldens separately. The deterministic stress corpus covers these compiler/profile inputs, while the default built-renderer visual run remains the smaller multilingual fixture; a real-browser stress golden and formula visual golden are still red.

For ordinary message fixtures, compare decoded pixels with channel tolerance 8. No more than 0.5% of pixels may exceed that tolerance. A deliberate profile change requires an explicit golden review; updating a golden may not be used to hide clipping, missing glyphs, reordered messages, or semantic Markdown drift.

Formula fixtures must include CJK, underbrace, `mhchem`, NewCM/script glyphs, and long horizontal and vertical formulas. Authoritative TeX migration passes only when:

- no glyph is missing or clipped
- foreground color remains consistent
- PNG and SVG preserve natural proportions
- width/height ratio differs from the approved baseline by no more than 3%
- `dom-only` SVG/MathML returns `SOURCE_UNAVAILABLE` rather than an incorrect asset

## 5. Length, Budget, And Performance

Maintain 12k, 30k, 60k, and over-65,535px message fixtures.

- 12k/30k/60k fixtures stay at effective ratio >= 1 when within the 64,000,000-pixel file budget.
- The 60k fixture must produce one decodable PNG without a final full-height canvas; 20 seconds on the benchmark machine is the performance target, not a correctness blocker.
- Over-limit fixtures must choose the mathematically minimum part count and name parts `*-part-001-of-N.png`.
- A single selected message keeps `*-message-001.png`; a budget-safe multi-selection uses `*-messages.png`; multipart delivery uses `*-png.zip`.
- 30k live canvas pixels must be at least 40% below the pre-refactor baseline.
- A short cold regression of at most 10% and short warm improvement of at least 20% remain tuning targets.
- A 250ms renderer/main-thread band target remains diagnostic until measured by a direct Long Tasks or heartbeat probe.
- After cancellation, no new band may be scheduled and no clipboard/download write may occur after 500ms.

For performance tuning or release evidence, run the ChatGPT and image-export benchmarks three times and use the median. During ordinary development, one real-browser run of the affected 30k or 60k fixture is sufficient when it proves a stable, decodable result and the visual/correctness gates remain green. Reasoning or mocked Canvas timing is not performance evidence.

`npm run verify:image-export-structure` is only a fast 4px-wide planner/encoder/decode verifier. It must never be reported as DOM/render performance. Real renderer timing commands are:

```sh
npm run benchmark:image-export
npm run benchmark:image-export:30k
npm run benchmark:image-export:60k
```

Use `--browser=chromium` or `--browser=firefox` with `npm run harness:image-export -- ...` for per-engine diagnosis. `--long-width-css-px=360..1200` and `--long-pixel-ratio=1..3` reproduce the production settings envelope; the latter accepts 0.5 steps. The report records those options, band count, renderer duration, and harness-only PNG decode/pixel-scan time separately.

The canonical 60k command uses `--long-repeat=171`, which keeps the engine-specific output height between 60,000 and 65,535px. The harness validates PNG signature, IHDR, consecutive IDAT chunks, CRC32, IEND, browser decode, and foreground pixels in reusable 480×256 tiles; it must not allocate a validation Canvas at the exported image height. Treat `bandRasterWallMs` only as phase wall time until a browser Long Tasks/heartbeat probe directly establishes main-thread occupancy.

## 6. Runtime, Bundle, And Browser Gates

- Startup, idle, streaming, toolbar recovery, Reader open, and Bookmarks open must not preload message PNG implementation, the formula renderer, or MathJax asset capability.
- The first message PNG action may load its content feature chunk but must not create `export-renderer.html`; the first authoritative formula asset action may create the iframe, whose capability chunks resolve only from extension origin.
- Message export must not load the formula MathJax capability; formula export must not load Markdown/highlight capability.
- Copy PNG and Save Messages PNG must share `ExportDocumentV1`, `message-card-v1`, and `renderPngBlob()` across Chrome MV3, Firefox MV2 (minimum 128), and Safari WebExtension.
- Formula host jobs remain FIFO and cancellable; connection cache and 120-second idle teardown apply only to the formula renderer path.
- Manifests add no `offscreen`, `downloads`, `debugger`, or new host permission.
- Safari hides binary PNG/SVG copy surfaces but retains MathML copy and PNG/SVG/Save Messages download surfaces.

## 7. Final Closeout

The image-export refactor is complete only after all applicable focused tests pass and these gates run successfully:

```sh
npm run test:core
npm run test:smoke
npm run test:acceptance
npm run build:all:webext
npm run perf:chatgpt
npm run verify:image-export-structure
npm run benchmark:image-export
npm run benchmark:image-export:30k
npm run benchmark:image-export:60k
git diff --check
```

Also record:

- three-run ChatGPT and image-export benchmark evidence
- Chromium and Firefox visual-golden results
- real Toolbar Copy PNG, Save Messages multi-select, and formula hover copy/save checks
- Safari surface-policy check
- bundle proof that startup contains none of the renderer capabilities and no host-origin chunk request occurs
