# ADR-0005-chatgpt-canonical-conversation-index

## Status

Accepted

## Context

ChatGPT 会按滚动位置水合和卸载长对话轮次。当前 DOM 因而只表示正在 materialize 的窗口，不能证明完整轮次、绝对顺序或 conversation identity。历史实现同时从 backend graph、React props、内部 store 和 DOM 产生语义 snapshot，并用 DOM-local position 连接完整 snapshot；来源降级、SPA 路由竞态和虚拟窗口替换会造成目录缺项、错误定位以及 Reader/导出内容风险。

## Decision

- `ChatGPTConversationEngine` 只接受 conversation ID 一致、current leaf 存在、父链无缺失且无环，并终止于无 message 结构根的 conversation graph，生成 Canonical conversation snapshot；带 message 的 `parent:null` 节点视为局部水合窗口而 fail closed。
- page bridge 以 manifest `document_start` 在页面主执行环境安装，只被动旁路观察 ChatGPT 页面自身发出的 same-origin `GET /backend-api/conversation/<id>` 响应。AI-MarkDone 不主动发起 conversation/session 请求，不读取 Cookie、Token 或认证请求头，也不构造认证信息；bridge 仅在内存中保留有界 conversation graph，并只向 content world 发布规范化 snapshot。
- `ChatGPTConversationEngine` 是唯一 semantic SSOT；Reader、Copy、Save Messages、消息词数、书签 prompt 与书签正文通过 canonical round / `readerContentSource` 消费它的 Canonical conversation snapshot。
- `ChatGPTConversationIndex` 是唯一 navigation projection；绝对顺序只来自 Engine snapshot，`ChatGPTPageIndex` 只缓存当前 connected anchors。
- 语义轮次与 DOM anchor 只能通过 typed Round identity 连接。Prompt 文本和 DOM-local position 不得作为 identity。
- React props、内部 bundle/store discovery 与 DOM Markdown 不再作为 ChatGPT 完整正文 fallback。完整 graph 暂不可用时保留同 conversation/branch 的最后 verified snapshot，或 fail closed。
- Directory、Stepper、Reader locate、Bookmark Go 与 pending navigation 共用 identity-based navigation；未挂载目标只能通过有界、可取消的 materialization seek 定位，精确 identity 命中后才算成功。
- Chrome object detail 与 Firefox JSON detail 只属于 page-bridge transport Adapter，不改变上述 Interface。

## Consequences

- ChatGPT 宿主结构变化集中在 graph 与 DOM identity 两个 Adapter，提升 Conversation Index 的 Locality 与所有消费者的 Leverage。
- Reader、Copy、Save Messages 与书签正文继续共享 `readerContentSource -> ReaderItem[]`，不新增 formatter、存储 schema 或平台分支。
- 首次 graph 获取失败时，AI-MarkDone 不再用局部 DOM 伪装完整内容；对应能力会暂时不可用，而不是输出不完整或错误结果。
- 若 bridge 未能在宿主 hydration 前安装或 ChatGPT 不再通过已验证的 conversation graph 响应提供内容，能力必须 fail closed；不得通过认证探测、主动重放宿主请求或规则堆砌绕过该边界。
- Graph shape、typed identity、branch replacement、route isolation、虚拟窗口替换与 materialization seek 必须保持自动化测试和真实长对话回归。
