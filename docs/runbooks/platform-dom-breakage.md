# Platform DOM Breakage Runbook

适用场景：站点 DOM 变化后，工具栏注入、消息采集、阅读面板入口或复制链路失效。

## Symptoms

- 工具栏不出现
- 只在部分消息出现
- Reader/Copy/Bookmark 入口消失
- 平台切换主题后 UI 异常

## Checks

1. 确认当前站点是否仍被对应 adapter 匹配
2. 检查 `src/drivers/content/adapters/sites/*` 中的选择器与锚点是否失效
3. 检查 `MessageToolbarOrchestrator` 是否仍能扫描到 assistant message roots
4. 检查 action bar fallback 是否触发
5. 检查主题探测是否仍输出有效 theme

### ChatGPT-specific checks

当问题只发生在 ChatGPT，不要只盯 DOM selector。先区分 canonical semantic snapshot 与当前 materialized anchors：

1. `ChatGPTConversationEngine` 是否发布了当前 conversation ID 的完整 verified graph snapshot
   - bridge 必须在 `document_start` 被动观察 ChatGPT 页面自身的 same-origin conversation `GET` 响应；不得读取认证信息或主动重放 session/conversation 请求
   - 检查 page bridge graph parser 与 content-world DTO validator；缺节点、环、route/ID/branch/identity 不一致必须 fail closed
   - 不要用 React props、内部 store 或可见 DOM 补齐正文
2. 比较 `ChatGPTConversationIndex` 的完整 canonical rounds 与 `ChatGPTPageIndex` 的当前 connected anchors
   - DOM hydration window 变小只应减少 anchors，不能减少目录/stepper count
   - typed `roundId` / `userMessageId` / `assistantMessageId` 无法唯一连接时，应修复 adapter/driver identity，不得使用 prompt 或 DOM-local position 猜测
3. 如果正文完整但 Reader/Copy/Save Messages 不完整
   - 检查入口是否仍统一经过 `readerContentSource -> ChatGPTConversationEngine -> ReaderItem[]`
4. 如果目录能显示但同页跳转失败
   - 检查 `ChatGPTConversationNavigation` 是否对未挂载目标执行有界、可取消、route-safe 的 materialization seek，并只在 exact identity 命中后成功
   - UI `chatgptDirectory/navigation.ts` 只负责命中后的视觉对齐，不得恢复第二套 selector 或 bookmark fallback
5. 如果工具栏 Reader/书签映射漂移
   - 检查 clicked element 是否通过 ConversationIndex 唯一解析为 canonical round；显式 element 无法映射时必须 fail closed
   - 不要为了兼容 ChatGPT 动态窗口修改 bookmark storage key/schema

## Related Documents

- `src/drivers/content/adapters/base.ts`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/BLUEPRINT.md`

## Exit Criteria

- 确认失效点位于 adapter/driver，而不是 UI 或 service 层
- 相关契约或能力矩阵在必要时同步更新
