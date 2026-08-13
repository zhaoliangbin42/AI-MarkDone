# ChatGPT Content Discovery Gates

This file is the executable acceptance contract for the active ChatGPT content
discovery lifecycle. It must not contain conversation text, cookies,
authorization values, tokens, raw request headers, request bodies, or raw Graph
payloads.

## Active contract

The production lifecycle is defined by
[ADR-0018](../adr/ADR-0018-chatgpt-identity-proven-single-content-pool.md):

- `ChatGPTConversationContentRuntime` is the only lifecycle owner. It handles
  initial synchronization, PageIndex facts, page/canonical identity, valid
  Graph captures, History `pushState`/`replaceState`, `popstate`, `hashchange`,
  and `pageshow`; the content chain has no polling route watcher.
- `ChatGPTPageIndex` is the only content-related DOM observer. It emits typed
  rounds, current URL, surface epoch, completion/materialization facts, and
  assistant-only remounts.
- `ConversationContentRepository` is the only semantic message pool. A stable
  DOM batch or one passive Graph may establish it; all consumers read the same
  Content Port.
- `ChatGPTConversationSurface` is the only production join of that pool and
  current PageIndex facts. Directory, Toolbar and Stepper subscribe only to its
  atomic Frame; the compatibility Materialization Port is projected from it.
- The former Discovery Coordinator, Conversation Index, standalone
  Conversation Materialization module, source-only V2 integration harness, and
  their dedicated tests are absent. Governance fails if a consumer reintroduces
  those projections or joins Content and PageIndex itself.
- Removal of a marked extension-owned Directory, Stepper, or Toolbar host is a
  Surface-only PageIndex fact. It must reattach through the same Frame without
  another observer, content read, or content-token change. Character-stream
  mutations must not rebuild Surface topology before stable commit.
- A message has only two user meanings: not obtained, or obtained. Every
  obtained body is dense and `complete`; streaming, debounce, compilation, and
  retry are internal timing states.
- The extension issues zero conversation GET/POST requests, observes no POST,
  reads no request body or credentials, and never forces virtualization by
  scrolling.

## Identity and passive Graph proof

- On the exact supported ChatGPT hosts, a canonical conversation route is a
  safe token immediately following a semantic `c` or `conversation` path
  segment at any depth. `/c/:id`, `/conversation/:id`,
  `/g/.../c/:id`, and future equivalent prefixes use this one rule.
- `/g/:gptId`, `/share/:id`, query-only identity, unsafe tokens, and a
  URL-stable anonymous page are not canonical Conversation Documents. The
  latter still has a non-persisted Runtime page identity for local content use.
- An eligible baseline response must be a successful website-owned same-origin
  `GET`; its decoded path/query tokens must contain the current canonical ID
  exactly, and its Content-Type must be JSON.
- Within at most four wrapper levels and 256 ordinary objects, the payload must
  expose `mapping + current_node`. A payload identity, when present, must match;
  active branch, parent chain, roles, message identities, and complete
  user/assistant rounds must validate.
- Endpoint names are not identity proof. Cross-origin requests, POST, SSE,
  wrong IDs, deep wrappers, malformed branches, and Graph-shaped decoys are
  ignored without changing website behavior.
- The bridge reads only `response.clone()` and stores the latest valid evidence
  in page memory. Chrome object transport and Firefox JSON-string transport
  must yield the same repository behavior.

## Pool admission rules

- Graph first: one valid Graph establishes a `source/complete` pool and closes
  the epoch gate. Later Graph captures and `refresh()` cannot change it.
- DOM first: one stable, compiler-verified batch atomically establishes a
  `host/complete` pool while the baseline gate remains open.
- Graph after DOM: the first trustworthy Graph may add only unseen turns before
  the first host turn when typed identity and order overlap exactly. Existing
  Markdown, digest, and assistant identity are never overwritten. One accepted
  prefix produces one snapshot and one content-token change, then closes the
  gate.
- A Graph with no overlap, conflicting identity, conflicting order, or arrival
  after gate closure does not mutate the pool. Baseline failure never demotes a
  host-ready pool.
- The same assistant identity is idempotent. A new assistant identity appends
  at the tail; uncertain ordering or one compiler failure defers only that
  identity and leaves obtained messages available.
- Before canonical identity, stable typed rounds publish against the Runtime's
  page identity. Formal identity promotes the same projection without changing
  bodies, projection ID or content token; canonical A→B immediately fences old
  staging and old compiler results.
- A same-URL id-less new conversation resets only after the old typed turns are
  explicitly cleared and a later first-round generation-start fact appears. A root
  replacement or virtualized unmount alone cannot clear the pool.
- Virtualized unmount/remount changes only materialization. An assistant-only
  surface can reconnect an already cached assistant but cannot invent a user
  message or semantic body.

## Required scenarios

| Scenario | Required evidence |
|---|---|
| Generic route matrix | `/c/:id`, `/conversation/:id`, `/g/.../c/:id`, arbitrary prefixes, mixed safe tokens, `/g/:gptId` rejection |
| Generic passive baseline | Fixed and arbitrary GET paths/query locations admit the same valid Graph; cross-origin, POST, SSE, wrong identity, deep wrapper and pseudo-Graph fail closed |
| DOM-first canonical conversation | With no Graph, one stable typed batch immediately yields `host/complete`; toolbar word count, Reader, copy, formula, bookmark and export consume it when canonical identity is present |
| First turn without identity | One stable round immediately yields `host/complete`; toolbar numeric word count, Directory, Stepper, Reader, copy, formula and export work while bookmark save/remove is never called |
| Identity promotion | A later formal ID preserves bodies, projection ID and content token, then re-enables the existing bookmark path without changing its data/protocol |
| DOM first, Graph later | Only a verified historical prefix is prepended; strong existing bodies are byte-for-byte preserved and weak-sealed bodies are upgraded by their overlapping Graph turns (ADR-0019); exactly one token update |
| Invalid or failed baseline | No overlap, order/identity conflict, or baseline failure leaves the host-ready pool unchanged and still consumable |
| Existing Graph-backed conversation | Baseline provides virtualized history; second/third/fourth completed DOM turns append once and every consumer count agrees |
| Streaming pressure | 1,000 mutations compile zero times before completion/quiet and at most once after stability; no bridge replay and no content-only Surface topology scan |
| Split hydration and completion | Persistent user/assistant slots may hydrate across separate mutation batches; action anchor, generation end, or a later typed round is a strong completion signal, while an otherwise complete turn uses one bounded 2-second quiet confirmation |
| Tail order ambiguity | A unique mounted pool tail anchors append order; a generated candidate before it or beyond an unresolved round is deferred, while a generated tail can anchor to the cached tail when only older history is mounted |
| Consumer host replacement | Removing a marked Directory rail, Stepper or message toolbar emits one Surface-only fact and reattaches the consumer with the same obtained content; official controls remain untouched |
| URL-independent lifecycle | Stable DOM content continues to append when the URL is unchanged; URL/hash text alone neither resets the pool nor cancels navigation, while a changed Surface projection does |
| Epoch fencing | `pushState`, `replaceState`, `popstate`, `hashchange`, A→B→A, hard refresh, BFCache/pageshow, root replacement and stale compiler completion never mix pools |
| Same-URL id-less reset | Explicit old-turn clear plus a later first-round generation start atomically replaces the projection only after compilation; virtualization and root replacement alone preserve it |
| Virtualization | Unmount/remount preserves content token and ordinal; assistant-only remount produces one toolbar and a numeric word count |
| Complex content | Formula, code and table use canonical host Markdown through toolbar, Reader, local selection, bookmark and export entrypoints |
| Browser parity | Chrome object and Firefox JSON transport produce equivalent baseline admission; both extension targets build |

## Consumer and safety invariants

- `ConversationContentSourceV1` and `ConversationSurfacePortV1` are the only
  production consumer seams. Directory, Toolbar and Stepper consume one Surface
  Frame; Reader, whole-message copy, word count, formula and export consume the
  same Content Port. None parse Graphs, rediscover body DOM, or infer content
  availability from URL.
- Without canonical ID/URL, bookmark actions are unavailable and make zero
  save/remove calls. Promotion restores the existing bookmark chain; bookmark
  types, protocol, storage, migrations and compatibility data remain unchanged.
- Precise local Markdown selection joins a current Range to the canonical pool
  through `SurfaceProjection`. A content/materialization/surface token change
  fails open; the next user selection may establish fresh proof.
- A pending surface cannot enable content-dependent toolbar actions or mutate
  the official action row. Exact `readTurn()` availability, a connected
  official action anchor, and a non-streaming assistant are required for the
  obtained toolbar; the action anchor is not required for prior content-pool
  admission. Official action and send state remain owned by ChatGPT.
- `proof.basis` is diagnostic only: `source | hybrid | host`. `complete`
  describes obtained messages, not hidden history that neither a trustworthy
  Graph nor the DOM exposed.
- No consumer may issue recovery requests, replay Bridge memory, read React
  private stores, inspect credentials/request bodies, create a second content
  repository, or add another content observer.

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

The focused gate includes route parsing, passive bridge transport, Adapter,
Repository, PageIndex, Host Monitor, Conversation Surface and its compatibility
Materialization projection, Reader/export/bookmark/selection consumers, the
real Directory/Toolbar/Stepper lifecycles, and content-runtime composition.
Performance success requires every assertion to pass; browser launch alone is
not a green gate.

Installed Chrome acceptance must use the logged-in profile and cover ordinary
`/c/...` plus `/g/.../c/...` pages without fabricating or replaying POST. A user
must manually send any test prompt. Installed Firefox acceptance remains a
separate manual gate; automated JSON transport and dual-target build evidence
cannot be reported as installed-browser proof.

Extension re-enable mid-page, shared links, Temporary Chat, and complex
historical branch replacement remain out of scope for this contract. URL-stable
id-less conversations are in scope for page-local discovery and consumers, but
not for bookmark persistence or cross-page navigation.
