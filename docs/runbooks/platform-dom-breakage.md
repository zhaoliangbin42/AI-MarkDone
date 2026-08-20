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

当问题只发生在 ChatGPT，不要只盯 DOM selector。先区分 canonical semantic snapshot 与当前 materialized anchors：

1. `ConversationContentRepository` 是否已由可信 Graph 或稳定 DOM 批次建立当前 conversation ID 的唯一消息池
   - bridge 必须在 `document_start` 只被动观察 ChatGPT 页面自身成功的 same-origin `GET`；候选 URL 精确携带当前 ID，JSON payload 在 4 层/256 对象预算内具备合法 Graph。不得固定 endpoint、观察 POST、读取认证信息或主动重放 session/conversation 请求
   - 检查 page bridge graph parser 与 content-world DTO validator；缺节点、环、route/ID/branch/identity 不一致必须 fail closed
   - 不要用 React props、内部 store 或消费者侧 DOM fallback 补齐正文；生成中的 assistant 不进入基线，稳定、可编译的新 DOM 消息才追加到唯一缓存
   - 缓存中的消息默认可消费；不再把消息标记为 `partial` 或把整条会话置为 `stale`。单条 DOM 编译失败只保留该 assistant identity 的 dirty 状态，等待下一次真实 host signal 重试
   - canonical conversation 没有 Graph 时，完整且稳定的 DOM rounds 应原子建立 `host` pool；后到的可信 Graph 必须包含当前池全部 typed identity 并保持相对顺序，才能按完整 envelope 汇合隐藏 prefix/middle/tail，保留已有 strong 正文，仅允许 ADR-0019 weak-sealed 正文升级。无 canonical identity 时同一批 rounds 也应直接以 page identity 发布；仅书签与跨页能力等待正式 ID
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
