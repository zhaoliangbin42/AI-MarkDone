# ADR-0027: ChatGPT bounded monotonic navigation

## Status

Accepted for implementation

## Context

The Directory and Bookmark Go actions already carry a canonical ChatGPT turn
identity from the Conversation Surface. A target can therefore be present in
the accumulated pool while its body is outside the current virtualized DOM
window. `scrollIntoView()` cannot locate an element that is not mounted, and a
canonical ordinal cannot safely be converted to a page-height ratio because
message heights and `scrollHeight` change while ChatGPT loads history.

Live inspection confirms that the direct assistant `data-message-id` remains
stable while older history is loaded. The outer
`data-turn-id-container` is a useful host-slot identity, but hydrated pages may
repeat its marker on nested wrappers; navigation must use the adapter's
deduplicated slot collection and never treat `conversation-turn-N` as identity.

## Decision

### Identity and order

- The target is resolved by the existing typed identity in the Conversation
  Surface. Public navigation inputs and results do not change.
- A mounted target uses its exact Surface anchor. A unique typed host slot is
  the preferred coarse anchor for an unmounted target.
- If no trustworthy target slot exists, the navigation driver uses the
  ordered obtained turns as a one-dimensional order oracle. It selects the
  mounted turn nearest the conversation scroll-root center as the current
  cursor and compares target ordinal with cursor ordinal. It never uses total
  height, DOM index, lexical UUID order, or `conversation-turn-N`.

### Bounded monotonic seeker

- The seeker performs one bounded native scroll on the adapter-owned
  conversation scroll root, waits for the existing Surface/PageIndex signals or
  one short settle window, and re-reads the current cursor.
- The initial step is viewport-sized and capped. If the sign of
  `targetOrdinal - cursorOrdinal` changes, the target has been crossed; the
  seeker reverses direction and halves the step. This is a bracketed
  monotonic seek with backtracking, not pixel interpolation.
- The operational step budget is at most 200 seeks, with each step clamped to
  120–2000 CSS pixels. The existing 15-second materialization deadline remains
  the outer bound, so the larger step budget cannot create an unbounded wait.
- Progress is proven by scroll movement, a changed mounted identity, a changed
  Surface frame, a reduced ordinal distance, or exact target hydration. A
  stalled root, reached boundary, route/projection change, user takeover,
  abort signal, maximum step count, or deadline terminates the attempt.
- Success is reported only after the exact target identity is connected and
  the existing bounded alignment verifies its anchor. Scrolling without exact
  identity is never success.
- Browser/native scroll anchoring is allowed to preserve the current visible
  identity while history is prepended. The seeker re-measures identity and
  direction after every settle; it does not maintain a second observer or a
  permanent timer.

### Scope and compatibility

- This behavior is only entered by an explicit same-page Directory, Stepper,
  Reader locate, Bookmark Go, or pending-navigation action. It does not scan
  content, create placeholders, trigger discovery on its own, or issue network
  requests.
- Directory and Bookmark Go continue to use the same navigation port and
  existing typed interface. No consumer, storage schema, runtime protocol,
  adapter contract, or content discovery rule changes.
- If the target is not in the current content pool and has no canonical
  identity, navigation fails closed; it does not fabricate a position.

## Consequences

- Navigation works from the initial latest-message window and from arbitrary
  user scroll positions when the target is already in the pool.
- Dynamic message height, prepended history, virtualized unmounts, and batch
  loading are handled by repeated identity re-measurement rather than a
  fragile global height formula.
- A failed or stalled seek is bounded and observable as the existing
  unavailable/timeout navigation result; it cannot spin forever or silently
  land on a neighboring message.
- The implementation remains local to the existing ChatGPT navigation driver;
  the content discovery pipeline remains untouched.
