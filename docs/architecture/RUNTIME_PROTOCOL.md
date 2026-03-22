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
- 调用方应基于错误码决定降级、提示或重试
- 新增错误码时，必须同步更新本文档与代码契约

---

## 5. Current Request Families

### Connectivity

- `ping`

用途：

- content 与 background 之间的协议可用性确认

### UI intent

- `ui:toggle_toolbar`

用途：

- background action click 通知 content 切换主面板入口

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

用途：

- 书签数据读写、批量操作、folder 操作、storage usage 读取、UI state 持久化

关键语义：

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
