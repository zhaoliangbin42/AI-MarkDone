# ADR-0007 ChatGPT Conversation Fact Reducer

## Status

Superseded by `ADR-0009-conversation-content-port-v1.md`, then by ADR-0017.

This ADR records the reducer-era design for historical context. The reducer and
engine implementation have been removed; ADR-0017's baseline-and-host-tail
`ConversationContentRepository` and the V1 ports are the only production
semantic path. Keep this document as a historical record, not an implementation
contract.

Supersedes `ADR-0005-chatgpt-canonical-conversation-index.md`.

## Context

ChatGPT 的长对话 DOM 是宿主按需 materialize 的窗口，不能证明完整历史；但空白页发出的第一轮通常也不会产生完整 conversation `GET`。因此单纯 graph-first 会在新对话首次生成时没有启动基线，而“重试读取 bridge、DOM 只补 graph 尾部、各消费者自行恢复”的组合只会反复读取同一个空状态。目录、Reader、导出、书签和工具栏最终会各自停在不同的占位状态。

内容发现需要一个能够同时覆盖“已有对话的完整历史”和“扩展亲历的新对话诞生”的统一证明模型，而且不能增加主动内部请求、认证信息读取、生成响应观察或启发式 DOM 完整性判断。

## Decision

- Canonical snapshot 只接受两种完整性根证明：
  - `observed-graph`：page bridge 被动观察到宿主自己的 same-origin 完整当前分支 graph。
  - `birth-epoch`：扩展亲历无 conversation ID、零 typed turn 的 route epoch，并连续观察首轮从 streaming 到正式完成。
- `ChatGPTConversationReducer` 是唯一状态归约器。它消费 route、graph 和 typed DOM turn facts，发布一个带单调 `routeEpoch` 与 `revision` 的不可变 `ConversationState`。Engine 只负责当前 epoch 的协调、single-flight flush、bridge 内存读取和状态订阅。
- Snapshot 只发布从 position 1 开始连续、身份唯一、assistant Markdown 非空的稳定完成前缀。第一轮 streaming 期间保持 `collecting + null`；官方完成操作栏已挂载、停止 streaming 且规范 Markdown 非空后才一次发布。
- 完整 graph 决定完整分支、绝对顺序和 typed identity。Birth 只能从零开始并沿连续 successor 推进；晚接入但没有 birth/graph 时必须 `blocked: unproven-history`。
- 同 lineage 的旧 pending/空 graph 不得回滚已经由 DOM 完成证明发布的正文；后到非空 graph 重新取得正文权威。Graph 与 birth 冲突时 graph 原子替换状态。
- 任何已发布 round 与当前 materialized typed identity 冲突时，状态立即进入 `blocked: identity-conflict` 并撤下旧 snapshot，直到完整 graph 重新校准。Prompt 文本、DOM-local position 和元素包含关系都不能证明语义身份。
- `ChatGPTDomTurnFactSource` 复用唯一 `ChatGPTPageIndex` observer 与共享 Markdown copy service。空白 route 为见证 birth 立即激活；晚接入 `/c/:id` 在取得 graph 证明前保持休眠，避免扫描一段无论如何都不能证明完整历史的 DOM。Graph 建立后再激活以完成 pending tail 和观察连续 successor。完成事实必须包含唯一 typed identity、非 streaming 状态、官方完成操作栏和非空规范 Markdown；同一逻辑回复的多个 assistant segment 必须合并。
- PageIndex observer 只观察必要 `childList` 和 typed identity attributes，不观察 `characterData`。Mutation batch 只触发一次 facts 归约；不得创建第二个内容发现 observer。
- Page bridge 继续只被动观察宿主自己的 same-origin conversation `GET`。它不主动请求 conversation/session，不观察 generation POST/SSE，不读取 Cookie、Token、认证请求头或请求体。Capture 只通知 conversation ID 与单调 sequence；content world 每次只读一次 bridge 内存。
- 同一 epoch 的无参数 `ensureReady()` 共用 single-flight，并由 Engine 自行决定必要的 PageIndex/bridge 内存 flush。Route epoch 不匹配的 graph、DOM facts 和 Promise 结果全部丢弃；不再有退避重试、5 秒轮询或 visibility rebuild，调用方也不能选择发现策略。
- `ChatGPTConversationIndex` 只把 semantic round 投影到当前 materialized anchor；它绑定 Source 后直接读取当前 immutable snapshot，不保存 canonical snapshot 副本。目录与导航消费者只读 Index；正文消费者只读 `readerContentSource`。被动 UI 使用无副作用的当前投影，Reader、导出、复制和书签只在真实用户动作前最多调用一次 fresh 入口。消费者不得拥有恢复重试、正文 fallback 或独立 snapshot 写入权。

## Consequences

- 空白新对话的首轮可以在没有 graph capture 时可靠进入 `ready`，已有或刷新的长对话仍由完整 graph 提供虚拟化之外的全部轮次。
- 正常生成期间继续提供之前的稳定前缀，新轮完成后只增加一次 revision；重复 facts 不重复通知消费者。
- Regenerate/编辑分支的身份冲突会暂时撤下内容能力，而不是继续导出旧分支。完整 graph 到达后原子恢复。
- 严格晚接入策略意味着：没有亲历 birth epoch、也没有完整 graph 时能力不可用。不得增加“可见轮次似乎齐全”之类启发式规则。
- 内容发现的性能成本集中在一个限定范围的 observer、一次 facts batch 和一个 reducer；RouteWatcher 仍使用全站共享的 500ms route lifecycle，不新增 background protocol 或权限。
- 安装态验收必须分别覆盖空白新对话首轮、继续对话、硬刷新、长对话和 regenerate，并区分自动化证据与真实浏览器验收。

## Implementation Status

Consumer control-plane convergence is implemented:

- `readerContentSource` is the sole `ReaderItem[]` projection boundary, with a passive current read and one fresh user-action read.
- Fresh ChatGPT content captures the typed start identity before confirmation, permits one post-confirmation lookup for a newly materialized node, and returns additive `ready / unavailable / target-unresolved` status without changing the legacy empty-result surface.
- Normalized ChatGPT content is cached only by source revision and snapshot identity; each caller receives a mutable compatibility view so consumer metadata decoration cannot alter the cached source projection.
- `ChatGPTConversationIndex` is source-bound, reads the current immutable snapshot directly, and stores only navigation subscribers rather than a canonical snapshot copy.
- The in-page Reader follows source revisions through `ChatGPTConversationReaderBinding`; it appends exact successors, atomically replaces corrected content, and closes when the snapshot is withdrawn.
- Word count and bookmark-active queries are passive. Copy, PNG, Reader open, export, and bookmark commands confirm once through the fresh Reader source.
- Save Messages closes on any source revision change; bookmark dialogs validate the captured route epoch, revision, and conversation ID before writing.
- Detached Reader refresh and in-page annotation focus revalidate the captured source revision at their final asynchronous commit points and fail closed when it changes.
