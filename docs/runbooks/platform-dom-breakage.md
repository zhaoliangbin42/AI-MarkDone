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
3. ChatGPT：检查 `ChatGPTPageIndex` 是否仍输出 typed assistant surface；其他平台再检查 `MessageToolbarOrchestrator` 的本地扫描
4. 检查 adapter 是否仍能提供经过验证的官方 action anchor；ChatGPT 不允许 content-body fallback
5. 检查主题探测是否仍输出有效 theme

### ChatGPT-specific checks

当问题只发生在 ChatGPT，先区分当前内容池与当前 materialized anchors：

1. `ConversationContentRepository` 是否已从完成消息 DOM 建立当前 conversation key 的标签页内消息池
   - 检查对应 assistant 是否有稳定 `data-message-id`、非空正文、已连接的官方操作栏，且当前不在生成中
   - 检查唯一 `ChatGPTPageIndex` 是否在初始化、相关 mutation 或页面恢复时发布事实；不得增加第二个 observer、轮询或主动 conversation 请求
   - 正文只从 assistant DOM clone 后经 Markdown Adapter 获取；不读取 React props、内部 store 或网络响应
   - 相同 assistant ID 正文变化时应覆盖，相同正文应幂等忽略；DOM 虚拟化移除不得删除已入池内容
   - 未加载历史不属于内容池，`historyStatus` 应保持 `partial`
2. 比较 `ChatGPTConversationSurface.readFrame()` 的全部 obtained turns 与 `ChatGPTPageIndex` 的当前 connected anchors
   - DOM hydration window 变小只应减少 anchors，不能减少目录/stepper count 或已缓存消息
   - typed `roundId` / `userMessageId` / `assistantMessageId` 无法唯一连接时，应修复 adapter/driver identity，不得使用 prompt 或 DOM-local position 猜测
3. 如果正文完整但 Reader/Copy/Save Messages 不完整
   - 检查入口是否仍统一经过 `readerContentSource -> ConversationContentSourceV1 -> ReaderItem[]`；已进入缓存的 host-rendered 消息也必须进入该链路
4. 如果目录能显示但同页跳转失败
   - 检查 `ChatGPTConversationNavigation` 是否对未挂载目标执行有界、可取消、projection-safe 的 materialization seek，并只在 exact identity 命中后成功；URL 文本本身不是取消边界
   - UI `chatgptDirectory/navigation.ts` 只负责命中后的视觉对齐，不得恢复第二套 selector 或 bookmark fallback
5. 如果工具栏 Reader/书签映射漂移
   - 检查 clicked element 是否通过当前 Surface Materialization Port 唯一解析为 obtained turn；显式 element 无法映射时必须 fail closed
   - 不要为了兼容 ChatGPT 动态窗口修改 bookmark storage key/schema

## Related Documents

- `src/drivers/content/adapters/base.ts`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/BLUEPRINT.md`

## Exit Criteria

- 确认失效点位于 adapter/driver，而不是 UI 或 service 层
- 相关契约或能力矩阵在必要时同步更新
