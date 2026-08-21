# ChatGPT DOM Content Discovery Gates

This file is the executable acceptance contract for the active ChatGPT content
discovery lifecycle. It must not contain conversation text, credentials,
request bodies, or private host state.

## Active contract

The production lifecycle is defined by
[ADR-0024](../adr/ADR-0024-chatgpt-dom-authoritative-content-pool.md):

- `ChatGPTConversationContentRuntime` owns route identity and lifecycle wakes.
- `ChatGPTPageIndex` is the only content-related DOM observer.
- An assistant is eligible when it has a message ID, non-empty body, connected
  official action row, and no active generation state.
- `ChatGPTConversationHostMonitor` uses one page-level debounce, clones the
  assistant body once, and invokes the existing Markdown Adapter once.
- `ConversationContentRepository` is the only semantic pool. It keeps one
  in-memory pool per conversation key for this tab lifecycle.
- `ChatGPTConversationSurface` remains the only join of pool content and current
  DOM anchors. Public consumer ports are unchanged.
- Formula click, PNG, SVG and MathML actions parse the operated formula DOM
  directly and do not depend on repository admission.
- The extension issues zero conversation GET/POST requests and has no page
  bridge, Graph decoder, polling, synthetic scrolling or per-message retry
  timer.

## Pool rules

- Runtime initialization scans official action rows already on the page.
- Relevant mutations and `pageshow`/`resume`/visible lifecycle wakes schedule
  one coalesced scan. There is no fixed load timeout.
- New assistant IDs enter in current DOM order. The preceding user prompt is
  best effort and may be empty.
- Equal Markdown for the same ID is a no-op; changed Markdown replaces the body
  and changes `contentToken` once.
- DOM virtualization never removes obtained content.
- SPA A→B→A switches and restores separate pools. A page reload clears them.
- `historyStatus` is always `partial`; hidden or unloaded history is not
  inferred.

## Required scenarios

| Scenario | Required evidence |
|---|---|
| Existing page | Runtime startup discovers completed messages whose official action rows already exist |
| Delayed load | An action row appearing after an arbitrary delay triggers capture without a timeout window |
| Generation | Streaming content is not admitted; generation completion plus the action row admits it once |
| First assistant | A message with no preceding user prompt enters with empty user text |
| Incremental load | Newly mounted messages append while older obtained messages remain available |
| Virtualization | Unmount/remount does not shrink the pool or churn content tokens |
| Same ID update | Changed DOM replaces the body once; unchanged DOM publishes nothing |
| Lifecycle wake | `pageshow`, `resume`, and visible wake coalesce and rescan current DOM |
| SPA pools | A→B→A restores A and refreshes it from currently mounted DOM |
| Formula independence | A formula outside the content pool still supports click copy and enabled PNG/SVG/MathML actions |
| Pressure | 1,000 relevant mutation signals coalesce; there is one observer and no poll/retry ladder |
| Safety | No extension conversation GET/POST, page bridge resource, extra permission or credential access |
| Browser parity | Shared runtime tests pass and Chrome MV3 plus Firefox MV2 build manifests contain no bridge resource |

## Consumer invariants

- Directory, Toolbar and Stepper consume the atomic Conversation Surface.
- Reader, whole-message copy, export, bookmark and word count consume the
  existing Content Port.
- Precise local Markdown selection and annotations continue to require
  independent `SurfaceProjection` proof.
- Bookmark persistence still requires canonical conversation ID/URL.
- Consumers cannot initiate content acquisition or add DOM fallbacks.

## Automated commands

```text
npm run test:chatgpt-discovery
npm run test:core
npm run test:smoke
npm run test:acceptance
npm run perf:chatgpt
npm run type-check
npm run build
git diff --check
```

Installed Chrome MV3 and Firefox MV2 acceptance is recorded separately and is
never inferred from Vitest or build output.
