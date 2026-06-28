# Runtime Protocol (Content ↔ Background)

本文档定义 AI-MarkDone 当前 content runtime 与 background runtime 之间的协议边界。代码权威定义在 `src/contracts/protocol.ts`，本文档负责解释语义与约束。

---

## 1. Source Of Truth

- Code contract: `src/contracts/protocol.ts`
- Background entry: `src/runtimes/background/entry.ts`
- Content entry: `src/runtimes/content/entry.ts`

本文档不重复 `BLUEPRINT.md` 的高层架构原则，只描述协议本身。

---

## 2. Message Shape

每个 request 必须包含：

- `v`
  - 当前协议版本，必须等于 `PROTOCOL_VERSION`
- `id`
  - request id，用于追踪与响应匹配
- `type`
  - 消息类型
- `payload`
  - 仅在需要时出现，且必须是可序列化数据

每个 response 必须包含：

- `v`
- `id`
- `type`
- `ok`
- `data` 或 `error`

---

## 3. Serialization Rules

- 只允许传输可序列化数据
- 禁止传输 DOM 节点、函数、类实例
- payload 应保持最小，不把页面状态对象整体跨 runtime 传递

---

## 4. Error Model

当前协议错误码：

- `UNKNOWN_TYPE`
- `UNTRUSTED_SENDER`
- `INVALID_REQUEST`
- `INTERNAL_ERROR`
- `QUOTA_EXCEEDED`
- `INVALID_IMPORT`
- `MIGRATION_IN_PROGRESS`
- `NOT_FOUND`
- `INVALID_PATH`
- `CONFLICT`
- `SOURCE_UNAVAILABLE`

规则：

- 对于已通过协议校验并进入 handler 的请求，background 必须返回稳定错误码
- 对于非法或非扩展消息，当前 background entry 采用静默忽略，而不是回发结构化 `INVALID_REQUEST` / `UNTRUSTED_SENDER`
- 对于面向 tab 的 Chrome 生命周期竞态（例如 `No tab with id`、`Receiving end does not exist`、`Could not establish connection`），background entry 采用 best-effort 静默降级，不把它们作为协议错误返回
- 调用方应基于错误码决定降级、提示或重试
- 新增错误码时，必须同步更新本文档与代码契约

---

## 5. Current Request Families

### Connectivity

- `ping`
- `content:ready`

用途：

- content 与 background 之间的协议可用性确认
- content runtime 在 supported 页面完成初始化后向 background 发送 `content:ready`，payload 为 `{ platform, url }`
- background 以 `sender.tab.id` 为权威更新该 tab 的 action icon/popup 状态；没有 sender tab id 时返回 `{ ready: false }`，不记录长期 tab registry

### UI intent

- `ui:toggle_toolbar`

用途：

- background action click 对 supported hosts 发送 `ping`；成功后才发送 `ui:toggle_toolbar` 通知 content 切换主面板入口
- ChatGPT full runtime 处理该 intent 时打开完整 BookmarksPanel；Gemini、Claude、DeepSeek formula runtime 处理该 intent 时打开全局书签管理面板
- 如果 tab 已关闭、discard/freeze 恢复中，或 content script 暂不可达，background 将该次点击视为生命周期竞态并静默跳过；页面恢复后由 `content:ready` 重新接回

### Detached Reader session

- `readerSession:create`
- `readerSession:get`
- `readerSession:refresh`
- `readerSession:draft`
- `readerSession:beforeSend`
- `readerSession:send`
- `readerSession:locate`
- `readerSession:close`

用途：

- ChatGPT content runtime 打开独立扩展页 `reader.html`，并把当前 fresh `ReaderItem[]` 序列化为 `ReaderSessionSnapshot`
- detached Reader 页按 `sessionId` 读取快照，复用现有 ReaderPanel 渲染、bookmark、复制、评论与 Sticky 基础能力
- detached Reader 页请求 refresh/draft/beforeSend/send/locate 时，background 按 session 记录把请求路由回原 `sourceTabId`，由源 content runtime 调用既有 `collectFreshReaderContent`、`readComposer(adapter)` / `writeComposer(adapter, text)`、发送前 position restore arm、`sendText(adapter, text)` 与 ChatGPT same-page navigation helper

关键语义：

- session identity 由 `sessionId + sourceTabId + readerTabId` 绑定；所有 reader 发起的 `get/refresh/draft/send/locate` 请求必须来自绑定的 `readerTabId`
- `readerSession:create` 只能由带有 `sender.tab.id` 的源 content runtime 发起；source tab id 以浏览器 sender 为准，不从 payload 信任
- `reader.html#sessionId=...` 中的 hash 只作为 Reader 页启动时的 session lookup key；它不能绕过 background 的 `readerTabId` sender 校验，不能单独授权读取 snapshot 或触发 refresh/draft/send/locate
- `readerSession:draft` 是 detached Reader 与源 ChatGPT composer 的草稿桥：不带 `text` 时读取源 composer 当前文本，带 `text` 时把 detached 发送浮层关闭/取消时的本地草稿写回源 composer；它不做实时双向同步
- `readerSession:beforeSend` 是 detached Reader SendPort 的发送前准备桥：只在源 content runtime arm 发送后位置恢复，不写 composer、不触发发送
- `readerSession:send` 在转发给源 content runtime 前会 best-effort 激活源 ChatGPT tab，让官方 composer 发送尽量匹配官网内 Reader 的可见/焦点条件；源 content runtime 随后调用 `sendText(adapter, text)`
- `readerSession:locate` 在转发给源 content runtime 前会 best-effort 激活源 ChatGPT tab；定位成功或失败都不得关闭 detached Reader tab，只有用户显式关闭 Reader tab 或 Reader 内 close action 才清理该 session
- detached Reader bookmark 不新增 reader-session 私有协议；它复用 `bookmarks:positions` 标记当前页保存状态，创建时复用 bookmark save dialog，再通过 `bookmarks:save` / `bookmarks:remove` 写入同一套 bookmarks storage/index
- session 状态只写入 `chrome.storage.session` / `browser.storage.session`，不 fallback 到 `storage.local`，不依赖 MV3 service worker 全局变量；service worker 休眠后，下一次用户动作可从 session storage 重新读取并继续路由；如果当前浏览器目标不提供 session storage，`readerSession:create` 必须稳定失败，不能把对话快照持久化到 local storage
- v1 不做实时 tail sync、不强制保活、不设置 tab `autoDiscardable=false`；detached Reader 启动时拿一次 fresh snapshot，用户可手动 refresh
- source tab 关闭时，background 监听 `tabs.onRemoved(sourceTabId)`，删除 session 并 best-effort 关闭对应 `readerTabId`
- reader tab 关闭时，只删除 session，不关闭官方 ChatGPT 页；detached Reader 页内的 Reader close action 会发送 `readerSession:close` 并关闭当前扩展页
- source tab frozen/discarded、content script 不可达或扩展重载导致 session 丢失时，调用方应展示只读快照、source unavailable 或 session expired 状态，不抛 unchecked runtime error
- 当前合规边界接受 `src/contracts/protocol.ts` 对 `ReaderSessionSnapshot` 的外层结构校验配合 background sender-tab binding、Reader Markdown sanitize、extension session storage 共同作为 v1 防线；更细的 item-level schema/size validation 或 source URL 复核可以作为后续防御深度增强，但不是当前协议可用性的前置条件

### Prompt library

- `prompts:list`
- `prompts:save`
- `prompts:delete`
- `prompts:restoreDefaults`
- `prompts:reorder`
- `prompts:recordUse`

用途：

- background 持有 Prompt Library 的 local-storage 写入权，正文存储在 `browser.storage.local` 的 `aimd:prompts:library:v1`
- content runtime 和 Reader 只通过 `prompts:*` protocol 读取或修改 Prompt，不直接访问 storage
- 首次读取时会 seed 4 条固定英文 v4 默认 Prompt（Humanize Text With a Skill、Turn Rough Ideas Into Prompts、Create a Reusable Skill、Translate Naturally），其中 Skill Creator 默认指向 OpenAI Codex `skill-creator` sample 目录，并要求最终输出一个自包含代码块 Prompt 来封装所有生成的 Skill 文件；默认 seed 不随界面语言切换；未修改过的默认 Prompt 由 `managedDefaultId` 继续接管，读取时会通过历史默认快照识别未编辑默认 Prompt，即使 `defaultPromptSetVersion` 未变化也会随当前默认 seed 升级；用户改过的默认 Prompt 会转为用户接管并不再覆盖；真实持久化过的 Reader 旧 `commentExport.prompts` 会迁移进同一个 shared library，其中旧 Reader 未改默认只保留 `Point-by-Point Revision` 作为普通可管理 Prompt，其余未改旧默认跳过；Reader 的 `promptPosition` 和 comment template 仍保留在 reader settings 中
- `prompts:list` 继续兼容 `context: "composer" | "readerComment" | "all"`、`query` 与 `includeDisabled` 参数，但 Prompt 本身不再按场景分库；Reader 与 ChatGPT manager 读取同一套 prompts
- `prompts:list`/library load 是纯读取：已规范化的 library 不会因读取被写回，已有 `updatedAt` 不会被刷新；只有默认集迁移、旧 Reader prompt 迁移或坏数据修复需要落盘
- `prompts:save` 会规范化 title、纯文本 triggerText（保存时去掉旧 `\`/`/` 前缀）、兼容字段与 timestamps；空正文返回 `INVALID_REQUEST`；同一非空 triggerText 在不同 prompt 之间冲突时返回 `CONFLICT`
- `prompts:reorder` 接收 Prompt id 顺序并写回 library 数组顺序；`prompts:list` 不再按 last-used 时间重排，manager、autocomplete 与 Reader picker 消费同一 storage 顺序
- `prompts:restoreDefaults` 只补回缺失的内置 Prompt，不删除用户 Prompt，也不覆盖用户改过的默认 Prompt
- `prompts:recordUse` 只记录 `lastUsedAt`，不上传、不同步、不改变 prompt 内容，也不刷新 `updatedAt`
- `reader.commentExport.prompts` 只作为旧设置迁移输入和兼容字段；Reader picker、SendPopover、Settings、Reader 设置和 detached Reader 设置中的 Prompt 管理入口不得再把它当作运行时 Prompt 来源、数量来源或旧 Reader-only 编辑器入口
- portable Prompt JSON import/export helpers 属于 `src/core/prompts/promptLibrary.ts` 的 core-only 合同，不新增 runtime protocol，不让 UI 直连 storage，也不改变 `prompts:*` 作为唯一运行时读写入口

关键语义：

- Prompt Library 是私有、本地能力；v1 不做云同步、团队共享、公共市场、文件夹或 prompt chain
- 当前 Google Drive backup 只处理书签，不读取或写入 `aimd:prompts:library:v1`；未来如增加手动导入/导出或 Drive 同步，应消费 portable JSON 模型，而不是直接暴露完整 local storage record
- Prompt 本身统一；ChatGPT 官方 composer 使用 Prompt 时只插入 Prompt 内容，Reader picker 与 Reader SendPopover 按需通过 `prompts:list({ context: "readerComment" })` 获取当前 enabled Prompt，再按 Reader comment template 与 `promptPosition` 拼接注释
- triggerText 以纯文本保存和展示，用于 ChatGPT composer 与 Reader SendPopover textarea 的 `\` 联想匹配；没有 triggerText 的 Prompt 仍可在 Reader 中使用，也会出现在 Prompt manager 中；是否自动打开 `\` 联想由 settings 的 `chatgptBehavior.promptAutocomplete` 控制，不属于 Prompt Library record 或 `prompts:*` 协议状态
- Prompt 内容里的 `{{cursor}}` 是 content runtime 本地插入标记，写入 ChatGPT composer 或 Reader SendPopover textarea 时会被移除并用于设置光标位置；Reader 导出会清理该标记；background 不解释该标记

### Settings

- `settings:getAll`
- `settings:getCategory`
- `settings:setCategory`
- `settings:reset`

用途：

- settings 读取、分类更新、重置
- `chatgptBehavior` 是 ChatGPT page-behavior / input-behavior 类开关的 settings SSOT；background 只通过 `settings:setCategory` 持久化该 category，content runtime 与 Reader runtime 读取规范化后的 settings 并把 `chatgptBehavior.promptAutocomplete` 同步给 `ChatGPTPromptAutocompleteController`
- `chatgptBehavior.promptAutocomplete` 默认开启，只控制 ChatGPT composer 与 Reader SendPopover 输入 `\` 时是否自动显示候选；关闭后不读取或写入 Prompt Library，不改变 Prompt 启用状态、triggerText、排序或手动 Prompt manager 入口

### Bookmarks

- `bookmarks:list`
- `bookmarks:positions`
- `bookmarks:save`
- `bookmarks:remove`
- `bookmarks:bulkRemove`
- `bookmarks:bulkMove`
- `bookmarks:export`
- `bookmarks:exportSelected`
- `bookmarks:import`
- `bookmarks:repair`
- `bookmarks:folders:list`
- `bookmarks:folders:create`
- `bookmarks:folders:delete`
- `bookmarks:folders:rename`
- `bookmarks:folders:move`
- `bookmarks:storageUsage`
- `bookmarks:uiState:get`
- `bookmarks:uiState:set`
- `bookmarks:changelogNotice:get`
- `bookmarks:changelogNotice:ack`
- `cloudBackup:status`
- `cloudBackup:diagnostics`
- `cloudBackup:connect`
- `cloudBackup:disconnect`
- `cloudBackup:backupNow`
- `cloudBackup:listSnapshots`
- `cloudBackup:previewRestore`
- `cloudBackup:applyRestore`
- `cloudBackup:deleteSnapshot`

用途：

- 书签数据读写、批量操作、folder 操作、storage usage 读取、UI state 持久化
- changelog install/update notice 的本地读取与确认
- Google Drive 书签备份/恢复；Settings/UI 只能发送协议请求，不能直接调用 Google Drive provider、Chrome identity 或 WebExtension identity
- Google Drive Backup UI 使用 operation-specific RPC timeout：`status`/`diagnostics` 8s，`connect` 300s，`disconnect` 60s，`backupNow` 180s，`listSnapshots`/`deleteSnapshot` 60s，`previewRestore` 120s，`applyRestore` 180s。`connect` 必须覆盖用户完成 Google OAuth 测试/授权页的交互时间，不能复用通用 8s timeout。
- Google Drive OAuth 的账号隔离边界：OAuth client ID 是 AI-MarkDone 的公开应用标识，不是开发者账号凭据；runtime 不请求 `identity.email`，不把 OAuth token 写入协议响应或 snapshot。连接成功后可返回/保存 Drive `about.get` 的账号摘要（邮箱、显示名、头像 URL）供用户确认，不能保存 refresh token、cookie 或 Google account id。Chromium build 以 manifest `oauth2` 作为 `getAuthToken` 的 SSOT，浏览器 identity cache 管理长期授权体验；WebAuth fallback 使用 Web application OAuth client 与 `identity.getRedirectURL()`；provider 只把短期 access token 缓存在 extension local storage，过期前用于抗 service worker 重启。用户安装后授权的是当前浏览器/profile 中自己的 Google 账号。

关键语义：

- `cloudBackup:status`
  - 返回本地保存的连接/最近备份状态，并附带 provider 的只读配置诊断；其中 `connectedAccount` 表示用户曾连接的 Google Drive 账号摘要，`sessionState` 表示当前 provider 策略是否可继续执行用户触发的 Drive 操作
  - `sessionState` 可为 `unknown`、`readyInThisSession`、`needsConfirmation`、`error`。UI 不应把 `connected=true` 解读为长期 token 可用；当 `connectedAccount` 存在但 session 未 ready 时，下一次用户触发的 Drive 操作可以自然进入 Google 确认流程
  - Google Drive provider 会在不触发登录的前提下检查当前认证策略：Chromium build 要求 `identity` permission、manifest `oauth2.client_id/scopes`、Web OAuth client ID、Google API host permission、`getAuthToken` 或 `launchWebAuthFlow/getRedirectURL` 与稳定 extension ID；Firefox 要求 `launchWebAuthFlow`、`getRedirectURL` 与已配置 Web OAuth client ID；Firefox allizom redirect 会转成 MDN 允许的 loopback redirect 后再传给 Google OAuth
  - 缺少当前认证策略配置、Client ID 格式明显错误、或 identity API 不可用时，UI 应显示配置错误，不应直接触发 Google 授权
- `cloudBackup:diagnostics`
  - 返回当前 extension ID、期望的 Chrome Web Store Item ID、ID 是否匹配、`browserFamily`、identity permission、Google API host permission、manifest OAuth client/scope 检查、`getAuthToken` 可用性、`launchWebAuthFlow/getRedirectURL` 可用性、WebAuth redirect URL、OAuth client ID、sanitized OAuth request preview、`usesManifestOAuthClient`、`usesWebOAuthClient`、`authStrategy` 与 `ready`
  - `browserFamily` 使用能力语义：`googleChrome`、`webAuthCompatible`、`firefox` 或 `unsupported`；不按具体浏览器品牌维护授权分支
  - `authStrategy` 可为 `browserManagedGoogleIdentity`、`webExtensionAccessToken` 或 `unsupported`
  - 不返回 OAuth token、cookie、Drive 文件内容或浏览器 profile 数据
  - 该协议保留为开发者/错误排障能力；用户常规设置面板不常驻展示诊断按钮
- `cloudBackup:connect`
  - 只能由用户显式点击连接/重新连接触发 interactive auth；provider 先复用未过期本地 token，再尝试 `getAuthToken({ interactive: false })`，需要确认时调用 `getAuthToken({ interactive: true })`；若 browser-managed identity 不可用或失败，再使用 Web OAuth client 调用 `launchWebAuthFlow({ interactive: true })`
  - 成功后调用 Drive `about.get?fields=user(displayName,emailAddress,photoLink)`，返回并保存账号摘要、`connectedAccount`、`sessionState=readyInThisSession`、`authStrategy` 与 `lastVerifiedAt`
- `cloudBackup:backupNow` / `cloudBackup:listSnapshots` / `cloudBackup:previewRestore` / `cloudBackup:applyRestore` / `cloudBackup:deleteSnapshot`
  - 这些请求来自用户显式点击的备份、恢复或管理操作；provider 先复用未过期本地 token，再按能力调用 `getAuthToken({ interactive: false })` / `getAuthToken({ interactive: true })`，最后 fallback 到 `launchWebAuthFlow({ interactive: true })`；Drive 401 时移除 browser cached token 和本地 token cache 后重试一次
  - 该 fallback 不适用于 `status` / `diagnostics`，避免设置页渲染或只读诊断触发登录
- `cloudBackup:disconnect`
  - 必须清除 background 保存的连接状态和账号摘要，并尽量取得当前 token 调用 Google OAuth revoke endpoint 取消服务器侧授权；若浏览器提供 `clearAllCachedAuthTokens` 或 `removeCachedAuthToken`，可 best-effort 清理 identity 缓存
- `bookmarks:bulkRemove`
  - payload 现在支持：
    - `items`
      - 需要删除的 bookmark 选中项
    - `folderPaths?`
      - 可选；需要一并删除的 folder path 列表
  - 语义是“批量删除选中项”，而不再只是“批量删除书签”
  - background handler 负责：
    - 删除显式选中的书签
    - 递归删除命中的 folder 与其后代
    - 删除这些 folder 下的书签
    - 修正相关 folder index 与 bookmarks UI state

- `cloudBackup:backupNow`
  - 在 `backgroundStorageQueue` 中捕获一致的本地书签集合
  - 复用现有 `exportBookmarks(..., preserveStructure: true)` 生成 v2.0 export payload
  - 包装为 `CloudBackupSnapshotV1`，上传到 Google Drive 可见文件夹 `AI-MarkDone/Backups/bookmarks`
  - 使用 Drive resumable upload，上传成功后回读并校验 `snapshotId` 与 `payloadHash`
- `cloudBackup:previewRestore`
  - 下载并校验 snapshot
  - 复用 `parseImportData` 解析书签 payload
  - 生成可驱动共享导入合并详情页的安全合并预览；不写本地 storage，不传播删除
- `cloudBackup:applyRestore`
  - 仅支持 v1 `safeMerge`
  - 必须由 UI 在 `previewRestore` 后经用户明确确认触发
  - 写入前先创建本地 emergency export snapshot，并写入 extension local storage
  - 通过 `backgroundStorageQueue` 写入 bookmarks storage/index；只新增云端独有书签，跳过重复项，本地独有项保留，冲突项保持本地版本不变，不传播删除
- `cloudBackup:deleteSnapshot`
  - 将用户选中的云端 snapshot 移到 Google Drive 回收站，返回 `{ trashed: true }`；不会永久删除 Drive 文件夹，也不会修改本地书签

---

## 6. Compatibility Rules

- `v` 变化代表协议版本变化，不能悄悄修改 shape
- 增加新的 `type`、错误码、payload 语义时，必须同步：
  - `src/contracts/protocol.ts`
  - 本文档
  - 对应 handler
  - 相关测试

---

## 7. Ownership Boundaries

- content runtime 负责收集用户意图和页面上下文
- background runtime 负责敏感副作用与持久化
- UI 不应绕过协议直接变成敏感副作用的权威执行者

---

## 8. Related Documents

- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/BLUEPRINT.md`
- `docs/architecture/BROWSER_COMPATIBILITY.md`
- `docs/testing/TESTING_BLUEPRINT.md`
