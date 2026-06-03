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
- content runtime 在 ChatGPT 页面完成初始化后向 background 发送 `content:ready`，payload 为 `{ platform: "chatgpt", url }`
- background 以 `sender.tab.id` 为权威更新该 tab 的 action icon/popup 状态；没有 sender tab id 时返回 `{ ready: false }`，不记录长期 tab registry

### UI intent

- `ui:toggle_toolbar`

用途：

- background action click 先向当前 ChatGPT tab 发送 `ping`；成功后才发送 `ui:toggle_toolbar` 通知 content 切换主面板入口
- 如果 tab 已关闭、discard/freeze 恢复中，或 content script 暂不可达，background 将该次点击视为生命周期竞态并静默跳过；页面恢复后由 `content:ready` 重新接回

### Settings

- `settings:getAll`
- `settings:getCategory`
- `settings:setCategory`
- `settings:reset`

用途：

- settings 读取、分类更新、重置

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
- Chrome v1 Google Drive 书签备份/恢复；Settings/UI 只能发送协议请求，不能直接调用 Google Drive provider 或 Chrome identity
- Google Drive Backup UI 使用 operation-specific RPC timeout：`status`/`diagnostics` 8s，`connect` 300s，`disconnect` 60s，`backupNow` 180s，`listSnapshots`/`deleteSnapshot` 60s，`previewRestore` 120s，`applyRestore` 180s。`connect` 必须覆盖用户完成 Google OAuth 测试/授权页的交互时间，不能复用通用 8s timeout。
- Google Drive OAuth 的账号隔离边界：manifest `oauth2.client_id` 是 AI-MarkDone Chrome Extension 的公开应用标识，不是开发者账号凭据；runtime 不请求 `identity.email`，不返回 Google 邮箱/账号 ID，不把 OAuth token 写入协议响应、storage 或 snapshot。用户安装后通过 Chrome identity 授权的是当前浏览器 profile 中自己的 Google 账号。

关键语义：

- `cloudBackup:status`
  - 返回本地保存的连接/最近备份状态，并附带 provider 的只读配置诊断
  - Chrome Google Drive provider 会在不触发登录的前提下检查当前加载的 manifest 是否具备 `identity` permission、`oauth2.client_id`、`drive.file` scope 与 Google API host permission
  - 缺少当前 manifest OAuth 配置、Client ID 格式明显错误、或 Chrome identity 不可用时，UI 应显示配置错误，不应直接触发 Google 授权
- `cloudBackup:diagnostics`
  - 返回 extension ID、manifest OAuth/permission/scope/host 检查结果、Chrome identity API 可用性与当前 manifest OAuth client ID
  - 不返回 OAuth token、Google 账号、cookie、Drive 文件内容或浏览器 profile 数据
  - UI 用它区分“代码/构建缺失”和“Chrome 仍加载旧 manifest，需要移除旧 unpacked 实例并重新加载 `dist-chrome`”
- `cloudBackup:disconnect`
  - 必须清除 background 保存的连接状态，并先用当前 cached token 调用 Google OAuth revoke endpoint 取消服务器侧授权，再调用 `chrome.identity.clearAllCachedAuthTokens()` 清理 Chrome identity 缓存；老 Chrome 环境才退回单 token `removeCachedAuthToken`
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
