# ChatGPT Conversation Virtualization Design

Date: 2026-03-26

Status: Proposed

Scope: ChatGPT only in the first rollout

Authoring intent: formal design for reducing ChatGPT long-thread UI cost while preserving message recovery, toolbar correctness, and existing repository layering rules.

## 1. Problem Statement

AI-MarkDone currently improves ChatGPT long threads with folding, but the shipped implementation is still fundamentally a visibility toggle, not a DOM cost reduction mechanism.

Current behavior:

- Old ChatGPT turns can be folded through `ChatGPTFoldingController`
- Folded turns are hidden with `display: none`
- The underlying DOM, KaTeX subtree, and most page-owned runtime cost remain allocated

Observed on a real ChatGPT thread during investigation:

- Total DOM nodes: about 73k
- Assistant subtree nodes: about 71.5k
- KaTeX-related nodes: about 68.5k
- Largest single assistant message subtree: about 15k nodes
- Replacing offscreen assistant messages with placeholders reduced total nodes from about 73k to about 23.6k
- That experiment removed about 67.8% of total DOM nodes while preserving the ability to restore nodes later

This indicates:

1. The dominant problem is offscreen heavy message DOM, especially KaTeX-heavy assistant messages
2. Folding alone is symptom relief, not a complete solution
3. DOM virtualization is technically feasible on the live ChatGPT site
4. Initial page load also needs mitigation because ChatGPT fetches the full conversation payload up front

## 2. Goals

Primary goals:

- Make long ChatGPT threads materially smoother after load
- Reduce DOM size by unloading offscreen heavy messages instead of only hiding them
- Preserve old-message recovery with minimal visual disruption
- Keep the current extension architecture aligned with adapter and dependency rules
- Add early-load mitigation for the first render phase without depending on unsupported network APIs

User experience goals:

- Scrolling should feel stable
- Old content must never feel lost
- Recent context must remain immediately visible
- Streaming and active conversation actions must remain reliable
- Recovery of old messages should happen automatically when useful and manually when needed

Non-goals for the first rollout:

- Cross-platform rollout beyond ChatGPT
- Full interception and permanent rewriting of ChatGPT response payloads
- Changing ChatGPT server behavior
- Replacing ChatGPT’s own React rendering pipeline

## 3. Constraints And Architectural Rules

This design must respect current repository rules:

- Platform selectors stay in `src/drivers/content/adapters/sites/*`
- UI must not own platform selectors
- Services must not branch on platform ids for DOM behavior
- Runtime should orchestrate lifecycle, not hold platform-specific selectors

Implication:

- This feature cannot live entirely inside the ChatGPT adapter
- The adapter should expose only platform-specific detection and anchoring primitives
- Shared unloading, placeholder, and recovery mechanics should live in driver/service/runtime layers

## 4. Design Decision Summary

Recommended solution:

1. Keep ChatGPT-specific selector knowledge in the adapter layer
2. Introduce a shared conversation virtualization pipeline in content driver/runtime layers
3. Keep fold bars as stable anchors and replace only folded-offscreen group bodies with height-preserving placeholders
4. Restore groups near viewport on demand
5. Treat ChatGPT early-load mitigation as an earlier hidden-only phase in the normal shipping path, while keeping `content-early` and response rewriting experimental
6. Preserve a small, stable tail window of real messages for active chat continuity
7. Treat very heavy math messages as first-class optimization targets

This is a hybrid of:

- early hidden folding during the normal content runtime
- post-stable runtime windowing
- heavy-message-aware unloading
- optional early pruning as a later experiment

This is preferred over:

- pure CSS hiding
- full fetch-response rewriting by default

## 5. Why This Is Not Adapter-Only

### 5.1 Adapter responsibilities

ChatGPT adapter should own only the following:

- conversation root selectors
- assistant/user message selectors
- turn root resolution
- scroll-root discovery hook if ChatGPT requires a custom rule
- message identity and grouping hints
- streaming state detection

The adapter should not own:

- virtual window policy
- placeholder lifecycle
- cache of unloaded nodes
- scroll-anchor compensation
- restore scheduling
- early-load orchestration policy

Reason:

- Those behaviors are product logic, not host-selector logic
- Keeping them in the adapter would create a large ChatGPT-specific controller blob and weaken the existing layering direction

### 5.2 Shared driver/runtime responsibilities

Shared content driver/runtime layers should own:

- offscreen range calculation
- placeholder insertion and restoration
- anchor-preserving scroll compensation
- mutation-aware scheduling
- phased restore strategy
- fail-open recovery
- integration with folding settings and toolbar lifecycle

### 5.3 Optional service responsibilities

Pure DOM virtualization does not require a service layer by default, but a small content-facing service is justified if we want shared policy normalization and scoring:

- heavy message scoring
- retention policy calculation
- virtualization policy normalization from settings

This remains platform-agnostic if it consumes abstract adapter-provided message refs.

## 6. Proposed Layered Architecture

### 6.1 New or expanded modules

#### Adapter layer

Files:

- `src/drivers/content/adapters/base.ts`
- `src/drivers/content/adapters/sites/chatgpt.ts`

Add optional adapter hooks:

- `getConversationScrollRoot(): HTMLElement | null`
- `getConversationGroupRefs(): ConversationGroupRef[]`
- `isVirtualizationEligibleMessage(el: HTMLElement): boolean`

`ConversationGroupRef` should be adapter-owned shape describing:

- group id
- assistant root
- optional user root
- stable restore anchor
- current visibility relevance

This keeps selectors and host structure inside the adapter.

#### Driver layer

New directory proposal:

- `src/drivers/content/virtualization/*`

Suggested modules:

- `conversationWindow.ts`
  - computes desired mounted groups for a viewport
- `offscreenPlaceholderStore.ts`
  - owns unloaded DOM node records and placeholder metadata
- `scrollAnchorManager.ts`
  - preserves visual position when trimming/restoring
- `heavyMessageScore.ts`
  - measures node count, KaTeX density, text size
- `earlyLoadGuard.ts`
  - ChatGPT-only early-load hook orchestration

#### Runtime/UI orchestration layer

Files:

- `src/runtimes/content/entry.ts`
- `src/ui/content/controllers/ChatGPTFoldingController.ts`
- possibly a new controller:
  - `src/ui/content/controllers/ConversationVirtualizationController.ts`

Recommended controller split:

- `ChatGPTFoldingController`
  - remains a ChatGPT feature policy/UI controller
  - owns fold bars, fold dock, fold state
- `ConversationVirtualizationController`
  - shared orchestration for trim/restore behavior
  - activated only when adapter exposes required capabilities

This avoids merging folding UI behavior with heavy DOM lifecycle code.

#### Settings/core policy layer

New proposal:

- `src/core/conversationVirtualization/policy.ts`

Owns normalized settings such as:

- enabled
- preserveRecentAssistantCount
- viewportOverscanPx
- heavyMessageNodeThreshold
- heavyMessageKatexThreshold
- earlyPruneEnabled
- debugPlaceholderStyle

## 7. Runtime Behavior

### 7.1 Grouping model

Virtualization unit should be a conversation group, not an individual arbitrary node.

For ChatGPT first rollout:

- one assistant message plus its preceding user turn if present
- preserve the existing fold-group mental model where practical

Reason:

- user and assistant content should recover together
- toolbar and fold actions already reason in turn/group terms
- replacing only random assistant internals is too fragile

### 7.2 Mount policy

Always keep mounted:

- viewport groups
- overscan groups above and below viewport
- most recent 4 to 6 assistant groups
- currently streaming group
- groups containing focused elements
- target group for bookmark jump until stabilization completes

Everything else becomes eligible for placeholder replacement.

### 7.3 Heavy message scoring

Each assistant group receives a score based on:

- subtree node count
- KaTeX subtree node count
- text length
- block count

ChatGPT-specific evidence shows KaTeX-heavy groups dominate cost, so groups above thresholds should be prioritized for trimming first.

Initial thresholds:

- total subtree nodes over 3000, or
- KaTeX subtree nodes over 2000

### 7.4 Placeholder behavior

A placeholder must preserve:

- height
- relative document position
- group identity
- restore anchor continuity

The fold bar, not the placeholder itself, should remain the primary user-facing recovery affordance.

Placeholder UI should stay layout-oriented and lightweight.

Placeholder UI should not:

- impersonate the original content
- suggest that content has been deleted

### 7.5 Restore behavior

Two restore paths:

- automatic restore when a folded group re-enters the restore margin
- manual restore when the user clicks the virtualized fold bar

Restore should be staged:

- restore nearby groups before they enter viewport
- restore one heavy group per frame or idle slice
- compensate scroll anchor after restore

### 7.6 Fail-open behavior

If any of the following occurs:

- selector mismatch
- repeated restore error
- placeholder-anchor inconsistency
- unexpected mutation pattern that invalidates mapping

Then:

- restore all unloaded groups
- disable virtualization for the current page session
- leave folding UI functional

This prioritizes content trust over aggressive optimization.

## 8. Early-Load Strategy

This section documents a future experiment only. It is not part of the current default shipping path.

### 8.1 What we verified

During early-load browser experiments:

- the full conversation response was fetched at page startup
- the conversation payload size was about 2 MB for the investigated thread
- injecting a `document_start` script and replacing old assistant messages as soon as they mounted reduced the DOM to the same reduced range as runtime trimming

### 8.2 Recommended early-load approach

Use a ChatGPT-only early-load guard built on top of shared virtualization primitives:

- injected at `document_start`
- implemented in main world because it must observe page-owned `fetch`
- it should not rewrite the fetch response by default
- it should only observe early conversation fetch and start a first-pass DOM prune as soon as messages appear

Behavior:

1. detect conversation page
2. watch for full conversation fetch
3. watch for first real assistant nodes
4. once assistant nodes materialize, immediately preserve the tail window and placeholder the rest

This is safer than response rewriting because:

- it avoids depending on ChatGPT’s internal mapping semantics
- it avoids handing the page a synthetic partial conversation tree
- it still materially reduces the first meaningful render cost

### 8.3 Why full response rewriting is not the default

More aggressive approach:

- intercept `fetch('/backend-api/conversation/<id>')`
- construct a pruned `mapping`
- return a synthetic response to the page

This is not recommended as the default because:

- it is fragile against backend schema changes
- it risks breaking current node, parent/child graph, share behavior, and follow-up turns
- it raises the maintenance burden sharply
- it belongs to an experimental path, not the primary product path

Recommended product stance:

- runtime folding + virtualization is the default shipping path
- early DOM prune remains an opt-in follow-up experiment only after the stable runtime path is proven
- fetch-response rewrite is optional experimental mode only after separate validation

## 9. UX Requirements

The experience must feel smooth, not merely correct.

Required UX rules:

- recent context remains fully visible
- old content never appears lost
- placeholders restore before they visibly enter viewport
- scroll position remains stable after trim and restore
- active generation is never virtualized
- restore all is always available

Recommended UX specifics:

- preserve recent 4 assistant groups by default
- overscan 1200 to 1800 px
- keep the fold bar visible as the restore affordance
- keep placeholder UI layout-only and non-interactive
- allow one-click restore-all in fold dock or settings debug menu

## 10. Integration With Existing Folding

Current folding should become policy input, not final rendering behavior.

Recommended interpretation:

- fold state means “eligible for virtualization when offscreen”
- unfold state means “prefer real mount unless strongly offscreen and not in preserved window”

Practical rollout option:

- keep current folding UI
- when a group is folded and offscreen, unload it instead of only hiding it
- when a group is unfolded, let runtime policy decide based on viewport and preservation rules

This keeps existing user-facing semantics while upgrading the actual performance mechanism.

## 11. Verification Strategy

We should verify with explicit metrics, not intuition.

### 11.1 Primary metrics

- total DOM nodes before and after trim
- assistant subtree node count before and after trim
- KaTeX subtree node count before and after trim
- time to first interactive-feeling thread state
- scroll stutter during long-thread navigation
- restore latency for heavy placeholders

### 11.2 Required regression checks

- streaming response remains visible
- toolbar still binds to mounted messages
- bookmark jump restores target region correctly
- fold/unfold still works
- copy markdown still works after restore
- reader view still works after restore
- route changes restore all and do not leak cached nodes

### 11.3 Test layers

Unit:

- policy normalization
- heavy message scoring
- window range computation
- placeholder store lifecycle
- scroll anchor compensation

Integration:

- ChatGPT fixture with heavy math messages
- trim and restore around viewport movement
- fold plus virtualization interaction
- route change cleanup

Manual or E2E:

- real ChatGPT thread with large KaTeX-heavy content
- initial page load
- scrolling near restored placeholders
- continuing chat after trim

## 12. Rollout Plan

### Phase 1

- add heavy-message scoring and placeholder store
- add runtime virtualization controller
- trim only offscreen folded groups
- no early-load logic yet

Reason:

- lowest product risk
- easiest to integrate with current fold feature

### Phase 2

- expand runtime virtualization to non-folded offscreen groups
- preserve tail window and streaming groups
- add restore-near-viewport behavior

### Phase 3

- add ChatGPT-only early-load guard at `document_start`
- prune aggressively once first assistant nodes mount

### Phase 4

- optional experimental fetch-response rewrite validation behind a hidden flag

## 13. File-Level Ownership Proposal

ChatGPT-only additions:

- `src/drivers/content/adapters/sites/chatgpt.ts`
  - add virtualization-related selector and grouping hooks

Shared additions:

- `src/core/conversationVirtualization/policy.ts`
- `src/drivers/content/virtualization/conversationWindow.ts`
- `src/drivers/content/virtualization/offscreenPlaceholderStore.ts`
- `src/drivers/content/virtualization/scrollAnchorManager.ts`
- `src/drivers/content/virtualization/heavyMessageScore.ts`
- `src/drivers/content/virtualization/earlyLoadGuard.ts`
- `src/ui/content/controllers/ConversationVirtualizationController.ts`

Integration points:

- `src/runtimes/content/entry.ts`
- `src/ui/content/controllers/ChatGPTFoldingController.ts`
- `src/ui/content/controllers/MessageToolbarOrchestrator.ts`

Possible docs updates after implementation:

- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/BLUEPRINT.md`
- `docs/architecture/DEPENDENCY_RULES.md`
- `docs/FEATURES.md`
- `docs/testing/CURRENT_TEST_GATES.md` if test requirements change

## 14. Risks

### High

- host DOM changes in ChatGPT can break grouping or anchor assumptions
- overly aggressive early trimming could conflict with page-owned startup transitions

### Medium

- restore may cause visible layout jump if anchor compensation is wrong
- cached detached nodes could leak memory if not cleared on route change
- toolbar rebinding may become inconsistent around restoration moments

### Low

- placeholder styling mismatch
- fold dock language or status labeling needing refinement

## 15. Recommendation

Proceed with a layered implementation:

- adapter for platform-specific grouping and scroll-root discovery
- shared driver/runtime modules for trim/restore behavior
- fold UI retained as product entrypoint
- early DOM prune added for initial-load mitigation

Do not make response rewriting the mainline solution.

The recommended mainline is:

- early DOM prune
- runtime windowing
- heavy-message-aware unload
- fail-open recovery

This delivers the highest practical performance win while staying aligned with the current repository architecture and keeping risk acceptable.
