# ChatGPT Folding Feature Notes

> Purpose: 为后续维护提供 ChatGPT 消息折叠功能的实现边界与配置说明。
> Scope: `src/content/features/chatgpt-folding.ts`, `src/content/components/ChatGPTFoldBar.ts`, `src/content/components/ChatGPTFoldDock.ts`

---

## 功能概要

| 功能点 | 说明 |
|:---|:---|
| 折叠模式 | `off` / `all` / `keep_last_n` |
| 默认展开条数 | `defaultExpandedCount`，仅在 `keep_last_n` 生效 |
| 右侧快捷按钮 | 固定在视窗右侧中部，提供“全部折叠/全部展开” |
| 按需显示 | 由 `showFoldDock` 控制是否展示右侧按钮 |

---

## 设置项（ChatGPT 专属）

所有设置均归属 `chatgpt` 分组：

| Key | 类型 | 默认值 | 说明 |
|:---|:---:|:---:|:---|
| `chatgpt.foldingMode` | string | `off` | 折叠策略 |
| `chatgpt.defaultExpandedCount` | number | `8` | 默认保留展开的最近条数 |
| `chatgpt.showFoldDock` | boolean | `true` | 是否显示右侧折叠快捷按钮 |

迁移规则：旧版 `performance.chatgptFoldingMode` 与 `performance.chatgptDefaultExpandedCount` 在 SettingsManager v3 自动迁移到上述新键。

---

## 关键实现约束

| 约束 | 说明 |
|:---|:---|
| 非侵入 DOM | 折叠条作为消息同级节点插入，不改写平台消息结构 |
| 折叠资源释放 | 折叠时对消息根节点设置 `display: none`，减少渲染开销 |
| 按钮稳定性 | Dock 采用“可见性校验 + DOM 观察”机制，防止平台重渲染后消失 |
| 样式规范 | 仅使用 `--aimd-*` Token，不使用 `!important` |

---

## 回归检查建议

1. ChatGPT 长对话页面中切换设置：`off/all/keep_last_n` 行为一致。  
2. `showFoldDock` 打开/关闭后，右侧按钮即时出现/消失。  
3. 页面流式刷新、打开设置、切换主题后，右侧按钮仍存在且可点击。  
4. Chrome / Firefox 构建通过，且 UI 不遮挡正文主内容。  
