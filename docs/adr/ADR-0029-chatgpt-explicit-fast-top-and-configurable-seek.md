# ADR-0029: ChatGPT explicit fast top and configurable seek

## Status

Superseded on 2026-08-26 by the `?message=` official-navigation trigger and
single-target DOM materialization rules in [ADR-0024](ADR-0024-chatgpt-dom-authoritative-content-pool.md).
The configurable same-page seek portion remains historical context; the
explicit fast-top control and its setting are no longer shipped.

## Context

ChatGPT uses a dedicated conversation scroll root. Its history loader may
prepend older slots asynchronously after the root has already reached the
top, and the page does not expose a stable loading indicator that the
extension can use. Incremental pixel scrolling is visibly slow and is not
needed for a user-requested "go to top" action.

The existing Directory, Bookmark Go, Reader locate and Stepper actions already
share the bounded monotonic seeker. Its fallback path is reliable but its
initial stride is intentionally conservative, so long-distance navigation can
feel slower than necessary.

## Decision

### Explicit fast top

- Add one independent ChatGPT content control at the lower-right: an upward
  arrow. It is a user-triggered action and does not belong to Directory
  visibility or the content pool.
- Insert the button into the existing `ChatGPTMessageStepperController` host,
  immediately before Previous/Next. The top-scroll controller owns only the
  behavior; it does not create a second fixed host or a second button row.
- The action resolves the adapter-owned conversation scroll root and performs
  an immediate native `scrollTo({ top: 0, behavior: 'auto' })`.
- While the action is active, a short-lived 100ms state machine compares the
  mounted `data-message-id` / `data-turn-id-container` topology as its progress
  signature. It seeks the official top boundary, waits for a changed topology
  to settle for 300ms, retreats 1000px, and seeks the top again. This cycle
  repeats for each new topology; ChatGPT's official top boundary allows a small
  scroll-padding residue. A 3-second quiet window is used only to conclude
  that no next batch arrived. The default deadline is 20 seconds; Settings
  exposes a bounded 5–60 second value in 5-second steps.
- A second click cancels the action. Wheel, click, and keyboard events outside
  AI-MarkDone UI also cancel it. Mouse movement, pointer press, and touchstart
  do not cancel it. The sampler and event
  listeners are released on completion, cancellation, runtime disable, and
  dispose. No network request, private React state, observer, or permanent
  timer is introduced.
- The control remains available when Directory or message-stepper navigation
  is hidden. Its only page effect is the explicit top operation and ordinary
  ChatGPT scroll-driven hydration.

### Configurable same-page seek

- Add a ChatGPT behavior setting for the fallback monotonic seek stride. The
  allowed values are 1000–5000 CSS pixels, in 400-pixel increments; the
  default is 3000 pixels.
- The configured value is the initial maximum stride only. Existing direction
  reversal halves the stride for overshoot correction, and existing stall,
  boundary, route/projection, user-takeover, step-count and deadline limits
  remain authoritative.
- The setting is passed only to the existing ChatGPT navigation driver. Exact
  stable-slot navigation, Conversation Surface identity, Directory/Bookmark/
  Reader/Stepper interfaces, content discovery, and consumer semantics do not
  change.

## Consequences

- The visible jump to the top is immediate while delayed history insertion is
  still handled within a bounded, measurable window.
- Users can trade long-distance navigation speed against overshoot correction
  without changing the navigation algorithm or adding a second path.
- The only new runtime work is dormant until an explicit click or a seek
  action. Settings normalization makes old stored settings receive safe
  defaults.

## Compatibility

No runtime protocol, storage schema, content discovery contract, adapter
selector contract, permission, network behavior, or public consumer API
changes.
