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

当问题只发生在 ChatGPT，不要只盯 DOM selector。当前 ChatGPT shipping path 还依赖 payload/store-first 与目录条锚点链路，需要额外检查：

1. `ChatGPTConversationEngine` 是否还能拿到完整 snapshot
   - 如果 Reader 只能看到当前 hydration 的几条消息，先检查 bridge/store，而不是先改 Reader UI
2. `ChatGPTDirectoryController` 是否还能建立当前页面的 skeleton/container anchors
   - 目录条 click、Reader locate、ChatGPT 书签 Go/pending navigation 都依赖这条锚点链路
3. 如果目录条能跳、Reader 或书签不能跳
   - 先检查对应入口是否仍走 `src/ui/content/chatgptDirectory/navigation.ts`
   - 不要直接改全平台共享 bookmark navigation，除非确认是跨平台语义问题
4. 如果 ChatGPT 工具栏书签高亮或保存位置漂移
   - 先检查 `MessageToolbarOrchestrator` 是否仍通过 `resolveChatGPTSkeletonPositionForMessage()` 解析绝对轮次
   - 不要为了修复 ChatGPT 动态加载窗口里的局部 position 而修改 bookmark storage key/schema
5. 如果 payload 完整但同页跳转失败
   - 检查 `[data-turn-id-container]` / `section[data-turn]` 的宿主结构是否变化
   - 再检查目录条 helper 是否正确回退到了共享 bookmark navigation

## Related Documents

- `docs/antigravity/platform/ADAPTER_CONTRACT.md`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/BLUEPRINT.md`

## Exit Criteria

- 确认失效点位于 adapter/driver，而不是 UI 或 service 层
- 相关契约或能力矩阵在必要时同步更新
