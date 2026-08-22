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
  bridge, Graph decoder, polling, or per-message retry timer. Explicit
  same-page navigation may use a short-lived, bounded native scroll seeker;
  that seeker is not content discovery and never runs without a user navigation
  action.

## Pool rules

- Runtime initialization scans official action rows already on the page.
- Relevant mutations and `pageshow`/`resume`/visible lifecycle wakes schedule
  one coalesced scan. There is no fixed load timeout.
- The full observed outer `data-turn-id-container` sequence maintains a private
  slot skeleton. Mounted assistant bodies enter at their containing slot; the
  preceding user prompt is best effort and may be empty.
- A whole-sequence prefix/tail extension grows the skeleton, a mounted
  subwindow cannot shrink it, and a conflict cannot reorder it. Empty-slot-only
  growth neither compiles a body nor changes the public content token.
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
| Incremental load | New tails append, while hydrated historical slots fill their original prefix positions and older obtained messages remain available |
| Direct pagination jump | An initial ten-slot suffix remains ordered after one observed jump to the complete 62-slot topology |
| Empty slots | Topology updates without body clone/Markdown conversion or public token churn |
| Virtualized subwindow | A smaller mounted slot sequence never shrinks the retained topology or obtained turns |
| Host conflict | Reordered, unrelated, or conflicting slot/body bindings preserve the last authoritative order |
| Virtualization | Unmount/remount does not shrink the pool or churn content tokens |
| Same ID update | Changed DOM replaces the body once; unchanged DOM publishes nothing |
| Lifecycle wake | `pageshow`, `resume`, and visible wake coalesce and rescan current DOM |
| SPA pools | A→B→A restores A and refreshes it from currently mounted DOM |
| Formula independence | A formula outside the content pool still supports click copy and enabled PNG/SVG/MathML actions |
| Pressure | 1,000 relevant mutation signals coalesce; there is one observer and no poll/retry ladder |
| Safety | No extension conversation GET/POST, page bridge resource, extra permission or credential access |
| Browser parity | Shared runtime tests pass and Chrome MV3 plus Firefox MV2 build manifests contain no bridge resource |

## Same-page navigation contract

Directory, Stepper, Reader locate, Bookmark Go and pending navigation submit the
same typed target. Navigation must prove the following before reporting success:

- a stable direct `data-message-id` identity matches the canonical target;
- a unique outer host slot is used when available, with nested duplicate
  `data-turn-id-container` markers excluded;
- otherwise, the current mounted turn is selected by scroll-root geometry and
  the target/current ordinal relation drives a bounded monotonic seek;
- a relation sign flip reverses direction and reduces the step, while a stall,
  boundary, route/projection change, user takeover or deadline terminates;
- the exact connected target anchor remains stable through the final alignment.

The navigation tests must cover initial latest-window navigation, arbitrary
current scroll position, target above and below, batch history insertion,
overshoot/backtrack, dynamic height/scroll-root movement, missing slot topology,
user cancellation, projection changes, long-distance seeks beyond the old
20-step budget, timeout and exact-identity failure. The production seeker is
bounded to 200 steps; its configured initial stride is 1000–5000 CSS pixels in
400-pixel increments, with adaptive halving and the existing total deadline
still enforced.
Navigation may trigger the page's ordinary scroll-driven hydration, but it must
not issue conversation requests, create placeholders, or modify the discovery
observer/pool contract.

The explicit fast-top control must be tested separately from Directory: one
click performs an immediate native top operation; a delayed height/top jump
causes another bounded top attempt; a stable top completes within the quiet
window; the default deadline is 20 seconds; a second click, wheel, or
keyboard event stops the action; mouse movement, pointer press, and touchstart
do not stop it; and dispose removes the button,
listeners, and timer. The test must prove this path does not add a content
observer, network acquisition, or consumer refresh.

## Consumer invariants

- Directory and Stepper consume the atomic Conversation Surface. Toolbar uses
  its host facts but can mount before Repository publication.
- Cross-message Reader/export and bookmarks consume the existing Content Port;
  current-message Copy/Reader/Export/word count read the corresponding mounted
  DOM when pool content is unavailable.
- Precise local Markdown selection and annotations prefer independent
  `SurfaceProjection` proof, then may use the still-connected owning message DOM
  at the explicit action boundary when pool evidence is unavailable or stale.
- Bookmark persistence still requires canonical conversation ID/URL.
- Consumers cannot initiate page scans, network acquisition or a second pool;
  DOM-local current-message actions do not count as accumulated acquisition.

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
