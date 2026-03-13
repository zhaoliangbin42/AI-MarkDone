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

## Related Documents

- `docs/antigravity/platform/ADAPTER_CONTRACT.md`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/BLUEPRINT.md`

## Exit Criteria

- 确认失效点位于 adapter/driver，而不是 UI 或 service 层
- 相关契约或能力矩阵在必要时同步更新
