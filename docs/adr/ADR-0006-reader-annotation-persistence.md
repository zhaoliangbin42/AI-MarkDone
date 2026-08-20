# ADR-0006 — Reader 注释本地持久化与管理

## Status

Accepted and shipped as the v1 architecture.

## Context

Reader 注释目前只存在于各自 Reader runtime 的内存 `Map` 中。页面刷新、扩展重载或浏览器重启会丢失记录，官网 Reader 与 detached Reader 也不会共享记录。现有注释已经采集了 DOM range、TextPosition、TextQuote 和 atomic selectors，但恢复没有形成可持久化的语义身份与可靠的重锚流程。

注释需要跨 ChatGPT 页面入口和 Reader runtime 保持稳定，但不应演变成独立笔记系统。现有仓库已经有 Conversation Engine、background storage queue、typed runtime protocol、`ModalHost` 与 Reader shared surface，可作为最小实现基础。

## Decision

1. **产品范围**
   - v1 只对 ChatGPT 的 `chatgpt.com` 与 `chat.openai.com` 提供持久化注释。
   - 全局范围是同一浏览器扩展 profile 的本地注释集合，不读取 ChatGPT 账号或 workspace 身份。
   - Gemini、Claude、DeepSeek 与无 verified document identity 的 Reader 入口继续使用现有页面内存行为。
   - 不新增注释导出、导入、备份、云同步、标签、文件夹或分享；管理模态框提供轻量批量选择/删除，现有 Copy annotations、发送插入、模板与设置保持不变。

2. **语义身份**
   - 注释文档身份为 `{ platform: 'chatgpt', conversationId }`。
   - canonical key 为 `chatgpt:conversation:<normalized-conversation-id>`。
   - `assistantMessageId` 是注释目标的必要身份；`roundId`、`userMessageId` 和 position 只作一致性校验、展示或兼容提示。
   - hostname、完整 URL、query、hash、项目路径前缀和 Reader session ID 不参与去重。
   - URL 只作为经过 exact-host 校验的最近导航提示；`chat.com` 只作跳转别名，不增加页面权限。

3. **持久化与 runtime 边界**
   - Background 是唯一写入权威；in-page Reader、detached Reader 和注释管理模态框只通过共享 annotation client 使用 typed protocol。
   - 使用 `storage.local`，每个 conversation 一个 canonical bundle key：`{ schemaVersion: 1, document, annotations[] }`。
   - 不建立全局持久化 index、数据库、journal、跨 key transaction 或 `storage.sync`。全局查询通过读取 annotation namespace 后在内存中搜索、分组和排序。
   - 每条注释保留轻量 `revision`；更新携带 expected revision，冲突时保留草稿并提示刷新，不做自动合并。
   - `storage.onChanged` 只用于失效通知，收到通知后重新读取 background canonical 数据。
   - Reader session snapshot 继续只保存临时正文快照和源 tab 路由，不复制注释数据。
   - `reader.persistAnnotations` 是显式 opt-in 设置，默认关闭，但只控制未来新建注释是否写入 durable bundle。已有 durable 注释始终读取和展示，其编辑/删除继续由 background 持久化；关闭期间新建的 runtime-only 注释不会在重新开启后自动迁移。

4. **锚点与失败语义**
   - 重锚顺序为：校验后的 DOM/atomic 快路径 → 校验 exact quote 的 TextPosition → 使用 prefix/suffix 消歧的 exact TextQuote → `unanchored`。
   - 选区上下文必须来自真实选区 offset，不得用全文第一次 `indexOf()` 推导 prefix/suffix。
   - v1 不做编辑距离、AI 匹配或相似文本自动迁移。无法唯一确认时保留注释、显示未定位，不静默绑定到其他内容。

5. **用户界面与导航**
   - 继续使用 Reader 内的单一注释管理模态框，切换“当前会话 / 全部注释”。
   - 全部注释支持“按会话 / 时间线”两种内存视图；搜索在 UI view-model 中匹配会话标题、引用和注释正文。
   - 同一会话直接定位并打开既有注释编辑器；其他会话创建新 ChatGPT tab，使用 tab-scoped `storage.session` 导航意图，在目标 conversation 与 assistant identity 验证后自动打开 Reader 并聚焦注释。
   - 删除需要一次确认，并在持久化成功后才从列表移除；不提供撤销或回收站。
   - 原文条目最多展示前后各 50 个 Unicode 字符，中间以单个省略号压缩；批量编辑只作用于当前可见筛选结果，提供全选和一次确认的批量删除。

## Consequences

- 注释能跨页面刷新、Reader runtime 和浏览器重启恢复，并共享同一份本地数据。
- conversation bundle 避免跨 key 原子性问题；全局首次读取需要扫描有限的 `storage.local` 数据，需按现有 Chrome 低版本配额基线做压力验收。
- 只支持 ChatGPT 的 verified semantic identity，减少平台适配和错误归属风险；其他平台不获得新的持久化承诺。
- 未定位记录不会自动消失，用户可以从当前或全部视图继续查看、编辑或删除。
- 实现新增 annotation contract、background protocol、Reader document descriptor 与 UI manager；实际协议和当前状态文档已与 v1 代码同步，后续扩展仍需保持本 ADR 的简洁边界。

## Amendment — ChatGPT page-level annotation entry

2026-08 追加：在不改变本 ADR 的 canonical bundle、语义身份与 background 权威写模型的前提下，增加官网页面级注释入口 `ChatGPTPageAnnotationController`。它与 Reader 共用同一 `ReaderAnnotationDocument` / `ReaderAnnotationRecord` / `readerAnnotationsClient` 持久化链路，`persistAnnotations` 开关语义保持一致（关闭时页面新建注释仅页面 runtime 有效，已有 durable 注释始终展示并继续持久化编辑/删除）。

关键约束：

- **同源内容提取**：页面注释的 `sourceMarkdown` 必须来自与官网局部 Markdown 复制相同的 `ContentSurfaceAdapter → SurfaceProjection` canonical Markdown（共享 `buildPageMarkdownSelectionSnapshot`），禁止退回 DOM→Markdown 重建；快照为 `null`（无 evidence / stale / ambiguous / reconstructed / 跨消息 / 流式）时不显示工具条，与复制 fail-open 一致。
- **水合重锚**：注入节点带 `AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE`，由 `contentSource`/`materialization` Surface 对账重建，不新增全局 MutationObserver；重锚经 domRange→textPosition→textQuote 回退，锚不上标记 `unanchored` 且不静默误绑。
- **管理页**：页面入口默认当前会话，提供当前/全部视图、搜索、定位编辑、单条删除，并只在当前会话提供注释插入；Reader surface 继续拥有注释复制、Prompt 选择和批量导出语义。
- **总开关与入口**：`chatgptBehavior.pageAnnotationsEnabled`（默认开启）控制整套页面注释行为（工具条、锚点、输入框内入口、管理页）；入口嵌入 ChatGPT 输入框、位于 Markdown 增强按钮右侧并显示注释数量。页面普通插入复用 Reader `buildCommentsExport` 但不带隐式 Prompt；Prompt 联想中按右方向键才把当前 Prompt 与当前会话注释组合插入。关闭总开关只隐藏页面 UI，不删除任何已保存数据。
- **锚点几何**：锚点按钮位于选中内容垂直居中高度、正文列右侧留白（阅读器同款 gutter），正文列占满视口（无留白）时隐藏按钮，用户仍可通过输入框内入口与管理页访问。
