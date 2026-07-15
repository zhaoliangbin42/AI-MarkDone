# Image Export Gates

This document is the executable acceptance contract for message PNG and formula asset export. It supplements `CURRENT_TEST_GATES.md`; it does not replace the repository-wide build, smoke, acceptance, or release gates.

## Current Status (2026-07-15)

The architecture, protocol, streaming encoder, long-PNG output policy, shared high-memory scheduler, trusted-TeX formula path, and Chromium/Firefox built-renderer harness are implemented. This document remains the target gate, not a claim that every row is green.

- **Green evidence:** Chromium/Firefox short fixtures are pixel-identical to their checked-in new-renderer goldens; a 480×61,210 PNG is produced as one decodable 1x artifact with no remote request or final full-height Canvas. A 67,061px fixture produces the mathematically minimum two 1x parts (65,512 + 1,549px). Real Chromium/Firefox formula PNG jobs covering CJK underbrace, mhchem and NewCM output are decodable, and focused protocol/planner/encoder/host/delivery tests are green.
- **Red performance gate:** the final Chromium 61,210px renderer run is 42.89 seconds, above the locked 20-second target. Three-run short-image medians are 467.1/358.5ms cold/warm on Chromium and 3,082/2,995ms on Firefox; Chromium clears the 20% warm target, Firefox does not. Do not lower message output below 1x or silently relax either target to make this green.
- **Red semantic-fragment gate:** production currently uses semantic-boundary-aware pixel bands. Independent code-line fragments, repeated table headers, and ordered-list `start` reconstruction are not implemented.
- **Red E2E/golden scope:** the browser harness exercises built renderer assets directly over MessageChannel; it does not replace an installed-extension trigger/Clipboard/Download check. Current message goldens are new-renderer baselines, not pre-refactor captures, and formula visual goldens are still missing.

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

The current boundary-aware pixel implementation proves row coverage, hard budgets, off-band subtree pruning, and one-live-canvas behavior. The code-line reconstruction, repeated-header, ordered-list continuity, and semantic-only fallback rows above remain red until production code and non-mocked seam tests exist; numeric planner tests alone are insufficient.

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
- The 60k fixture must produce one decodable PNG without a final full-height canvas in no more than 20 seconds on the benchmark machine.
- Over-limit fixtures must choose the mathematically minimum part count and name parts `*-part-001-of-N.png`.
- A single selected message keeps `*-message-001.png`; a budget-safe multi-selection uses `*-messages.png`; multipart delivery uses `*-png.zip`.
- 30k live canvas pixels must be at least 40% below the pre-refactor baseline.
- Short cold median may regress by at most 10%; short warm median must improve by at least 20%.
- One band may not occupy the renderer/main thread for more than 250ms.
- After cancellation, no new band may be scheduled and no clipboard/download write may occur after 500ms.

Run the ChatGPT performance benchmark three times and use the median. Run the image-export benchmark three times for cold-short, warm-short, 30k, and 60k fixtures and record both individual runs and median. If the repository does not yet expose a dedicated image-export benchmark command, the implementation must provide a checked-in harness or direct reproducible command before this gate can be marked green; reasoning or mocked Canvas timing is not performance evidence.

`npm run verify:image-export-structure` is only a fast 4px-wide planner/encoder/decode verifier. It must never be reported as DOM/render performance. Real renderer timing commands are:

```sh
npm run benchmark:image-export
npm run benchmark:image-export:30k
npm run benchmark:image-export:60k
```

Use `--browser=chromium` or `--browser=firefox` with `npm run harness:image-export -- ...` for per-engine diagnosis. The report separates renderer duration from harness-only PNG decode/pixel-scan time.

## 6. Runtime, Bundle, And Browser Gates

- Startup, idle, streaming, toolbar recovery, Reader open, and Bookmarks open must request no export renderer, MathJax asset capability, Markdown export capability, or PNG worker.
- The first real image action may load `export-renderer.html`; capability chunks and worker must resolve only from extension origin.
- Message export must not load the formula MathJax capability; formula export must not load Markdown/highlight capability.
- Only one high-memory job runs per tab. Queued work is FIFO; cancelling a queued job removes it without creating the iframe.
- While the connection is alive, completed cache entries use a 120-second TTL. The 120-second idle teardown removes iframe/worker ownership and clears that completed cache.
- Chrome MV3, Firefox MV2 (minimum 109), and Safari WebExtension use the same host/protocol/worker/`fflate` implementation.
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
