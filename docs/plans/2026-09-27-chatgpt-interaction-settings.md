# ChatGPT 交互升级与设置分类草案（2026-09-27）

状态：六项需求均已实施，Pin 交互已按用户后续反馈改为设置中的集中配置，自动化与组件浏览器验证已完成；已安装扩展的真实会话回归仍待重新加载后验证。分支 `codex/chatgpt-interaction-settings-upgrade`。

本轮从当前 `DEFAULT_SETTINGS` 重新读取，共 67 个 schema 叶节点（数组整体计一个字段，包含内部状态与遗留字段，不等于 67 个界面控件）。以下清单核对现有可配置能力；不得减少字段、删去已有用户入口、重置用户值或把开关状态误当作功能删除。

## 建议分类与区分方式

保留现有八个主类及搜索，在类内按用户任务分组。分组只改变界面组织，不新增存储域，不复制配置。

| 主类 | 子分组 | 呈现原则 |
|---|---|---|
| 外观与布局 | 界面；ChatGPT 页面 | 主题、语言、字号与页面宽度分开 |
| 阅读与导航 | 页面目录；Reader；阅读位置 | 目录开关与目录参数同组，Reader 参数单独一组 |
| 输入与 Prompt | 输入增强；公式助手；Prompt | 总开关在前，子项在后；总开关关闭只暂停，保留子项 |
| 标记与注释 | 注释保存与显示；注释输出 | 持久化与显示、模板与顺序明确分组 |
| 复制与导出 | Markdown 复制；公式工具栏按钮；公式图片；消息长图 | 公式动作开关写明“显示…按钮”；字号/宽度/倍率有单位与作用对象 |
| 按钮与快捷键 | 回复工具栏；选区工具栏；右下角抽屉；键盘 | 显示开关与快捷键分组；Pin 表示收起时仍显示，不代替功能开关 |
| 数据与备份 | 排序；本地备份；Google Drive；存储用量 | 管理动作不伪装成设置开关 |
| 高级与诊断 | 扩展启用；导航调参；诊断与提示重置 | 保留既有低频能力 |

所有现有默认值先保持不变：目录默认关闭，输入增强默认开启，注释持久化默认关闭，公式资产五个按钮默认关闭。旧文档中“目录默认开启”等描述需要按当前代码纠正。

### 已确认的设置边界

1. 选区动作：复制、注释、高亮三项开关，默认全开；页面与 Reader 共用。高亮整体控制蓝/黄/红三个按钮。保留现有页面工具栏总开关的页面限定范围，Reader 仍保留 Stick。
2. 公式预览导出：预览框始终提供当前浏览器支持的导出按钮；正文公式工具栏单独沿用现有五项开关及默认全关。两处共用同一资产生成链路。

新增字段为 `reader.selectionToolbar.{copy,annotation,highlight}`、`chatgptBehavior.showInputEnhancementControl`、`chatgptBehavior.pinnedPageControls`。旧字段全部保留，schema 叶节点由 67 增至 72（数组作为一个字段）。前四个默认 true，pins 默认空数组。旧蓝色仍是合法色块值，新默认品牌色为 `#3b5bdb`。

### Pin、输入增强与颜色

- 固定配置统一位于“设置 → 按钮与快捷键 → 右下角抽屉 → 固定常用按钮”。弹窗以复选列表集中选择，保存才生效，取消不写入。普通抽屉不显示逐按钮 Pin，避免干扰常用动作。固定动作刷新后保留；默认不固定任何动作。
- 抽屉收起显示已固定动作，展开显示完整动作集合。由同一组动作与状态驱动，避免复制 click handler 或创建第二套业务控制器。被设置隐藏的动作即使已固定也不显示；重新开启后恢复固定偏好。
- 将输入增强入口放进抽屉。当前生产代码已移除旧输入增强弹层，现有控件位于 Settings；新弹层复用同一配置与保存边界，失败回滚，不产生第二份状态。
- 输入增强弹层按“运行开关／编辑／列表／公式”排列，复用当前 Shadow DOM、surface、开关与 token 体系。
- 颜色采用更沉静的宝石蓝 `#3b5bdb`，只更换默认品牌蓝与其状态阶梯；保留用户主动选择的已有色值以及语义高亮颜色。必须核对浅色、深色与文字对比度。

## 行为契约与验证方向

- 代码框内的局部选区按原文复制，保留空白与换行，不补围栏、不重写类似公式的字符；完整代码块保留围栏。选中公式的一小部分也输出完整公式源码。跨块残缺结构不能通过整个选区的纯文本兜底悄悄丢格式。
- 真实 ChatGPT 页面滚动容器当前是 `flex-direction: column-reverse`，阅读位置可为负数，底部为 0。恢复位置不能强制非负；保留既有锚点、用户操作退出和恢复预算，不增加轮询。
- 目录条与预览作为同一交互区域：离开其中一者不立即收缩，移入另一者取消关闭；全部离开 400ms 后一起收起；键盘焦点位于其中时保留，Escape/外部点击关闭。
- 输入公式预览由输入光标触发，移除鼠标坐标查找与 hover 计时路径；导出复用现有 MathJax 资产生成和剪贴板/下载边界，不截图预览 DOM。
- 验证覆盖：复制快捷键及工具栏 pointerdown→click；语法高亮跨 text node、空白、完整块、局部公式、跨消息和 streaming；正向/反向滚动及底部、主动退出；目录与预览往返、键盘焦点、外部点击；中文 IME、公式异步结果失效；设置迁移、搜索、全开/全关、两处同步；Pin 隐藏/恢复与窄屏；Chrome MV3 与 Firefox MV2 构建。

## 当前字段、默认值与保留去向

## 外观与布局

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 界面主题 | 跟随页面，也可以固定浅色或深色。 | `appearance.themeMode` | "auto" |
| 界面字号 | 调整资料库、设置和扩展界面的文字。 | `appearance.fontSizePx` | 16 |
| 主题色 | 沿用当前五种主题色；高亮颜色单独管理。 | `appearance.accentColor` | null |
| ChatGPT 页面宽度 | 同步调整对话正文与输入条的宽度。 | `chatgptBehavior.pageWidthScale` | 100 |
| 界面语言 | 切换扩展界面的显示语言。 | `language` | "auto" |

## 阅读与导航

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 页面目录 | 在 ChatGPT 右侧显示消息目录。 | `chatgptDirectory.enabled` | false |
| 目录显示方式 | 预览模式更轻，展开模式直接展示消息标题。 | `chatgptDirectory.mode` | "preview" |
| 目录标题内容 | 只显示开头，或同时保留开头与结尾。 | `chatgptDirectory.promptLabelMode` | "head" |
| 隐藏 ChatGPT 官方导航 | 启用扩展目录时，减少重复的导航入口。 | `chatgptDirectory.hideOfficialNavigation` | true |
| 目录右侧边距 | 调整目录与窗口右边缘的距离。 | `chatgptDirectory.rightInsetPx` | 0 |
| 目录悬浮预览长度 | 控制鼠标停留时显示的摘要长度。 | `chatgptDirectory.previewMaxChars` | 600 |
| 发送后保持阅读位置 | 发送消息后，尽量留在刚才阅读的位置。 | `chatgptBehavior.restorePositionAfterSend` | true |
| Reader 打开方式 | 选择全屏阅读或页面内窗口。 | `reader.defaultOpenMode` | "fullscreen" |
| Reader 正文字号 | 只影响阅读器正文。 | `reader.bodyFontSizePx` | 16 |
| Reader 正文最大宽度 | 控制长段文字的行宽。 | `reader.contentMaxWidthPx` | 1000 |
| 渲染代码块 | 在 Reader 中显示代码块格式。 | `reader.renderCodeInReader` | true |
| Reader 标题大纲 | 按标题快速浏览长回复。 | `reader.showOutlineInReader` | true |

## 输入与 Prompt

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 启用输入增强 | 换行、加粗、列表与公式助手的统一运行开关。 | `chatgptBehavior.inputEnhancement.enabled` | true |
| Enter 换行 | 使用 ⌘ / Ctrl + Enter 发送；输入法组合输入保持原样。 | `chatgptBehavior.inputEnhancement.enterKeyNewline` | true |
| 加粗快捷键 | ⌘ / Ctrl + B 添加或移除可见的 ** 标记。 | `chatgptBehavior.inputEnhancement.boldShortcut` | true |
| 智能列表 | 自动续写、拆分和退出列表。 | `chatgptBehavior.inputEnhancement.lists.enabled` | true |
| 有序列表 | 支持 1.、2.、3. 的续写与编号。 | `chatgptBehavior.inputEnhancement.lists.ordered` | true |
| 无序列表 | 支持项目符号列表的续写与退出。 | `chatgptBehavior.inputEnhancement.lists.unordered` | true |
| 公式片段联想 | 在公式环境中输入反斜杠，查找 LaTeX 片段。 | `chatgptBehavior.inputEnhancement.formulaSuggestions` | true |
| 输入公式预览 | 在独立浮层预览公式，不改变原始输入文字。 | `chatgptBehavior.inputEnhancement.formulaPreview` | true |
| Prompt 自动联想 | 输入反斜杠调出常用 Prompt；关闭后仍可手动管理。 | `chatgptBehavior.promptAutocomplete` | true |
| Prompt 管理 | 管理触发词、内容、启用状态与光标位置。 | `action.prompts` | 现有管理动作 |

## 标记与注释

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 保存新建注释 | 关闭后，新注释仅保留到页面刷新。已保存的注释不受影响。 | `reader.persistAnnotations` | false |
| 显示页面注释 | 控制页面注释工具条、标记和管理入口；不会删除已保存内容。 | `chatgptBehavior.pageAnnotationsEnabled` | true |
| Prompt 插入位置 | 注释组合文本中，Prompt 放在注释前或注释后。 | `reader.commentExport.promptPosition` | "top" |
| 注释输出顺序 | 复制与插入注释时采用同一顺序。 | `reader.commentExport.sortMode` | "created" |
| 注释输出模板 | 组合原文与注释内容，页面和 Reader 共享。 | `reader.commentExport.template` | 结构化模板 |

## 复制与导出

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 仅保存上下文 | 沿用现有保存范围选项；正式迁移保留首次确认机制。 | `behavior.saveContextOnly` | false |
| 点击公式复制源码 | 单击公式复制 LaTeX / Markdown。 | `formula.clickCopyMarkdown` | true |
| 单个公式复制格式 | 只控制点击单个公式时的输出。 | `formula.clickCopyFormulaFormat` | "markdown-dollar" |
| 全文 Markdown 公式格式 | 用于 Reader、工具栏、书签和选区复制。 | `formula.markdownCopyFormulaFormat` | "markdown-dollar" |
| 复制公式 PNG | 控制公式悬浮菜单中的这个动作。 | `formula.assetActions.copyPng` | false |
| 复制公式 SVG | 控制公式悬浮菜单中的这个动作。 | `formula.assetActions.copySvg` | false |
| 复制公式 MathML | 控制公式悬浮菜单中的这个动作。 | `formula.assetActions.copyMathml` | false |
| 保存公式 PNG | 控制公式悬浮菜单中的这个动作。 | `formula.assetActions.savePng` | false |
| 保存公式 SVG | 控制公式悬浮菜单中的这个动作。 | `formula.assetActions.saveSvg` | false |
| 公式图片字号 | 只影响单公式 PNG、SVG 和 MathML 导出。 | `formula.assetFontSizePx` | 36 |
| 消息图片宽度 | 选择手机、平板、桌面或自定义宽度。 | `export.pngWidthPreset` | "desktop" |
| 自定义图片宽度 | 在宽度选择“自定义”时生效。 | `export.pngCustomWidth` | 800 |
| 图片导出倍率 | 超长图仍由现有导出器按安全预算调整实际倍率。 | `export.pngPixelRatio` | 1 |

## 按钮与快捷键

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 消息工具栏 | 在回复的官方操作区域显示扩展按钮。 | `behavior.showMessageToolbar` | true |
| 保存消息入口 | 显示批量选择和导出消息的入口。 | `behavior.showSaveMessages` | true |
| 字数统计 | 显示回复的字数信息。 | `behavior.showWordCount` | true |
| 抽屉：收藏当前页面 | 保留页面书签的一键入口。 | `chatgptBehavior.showPageBookmarkControl` | true |
| 抽屉：独立 Reader | 在独立窗口阅读当前会话。 | `chatgptBehavior.showDetachedReaderControl` | true |
| 抽屉：Prompt 管理 | 随时管理常用提示词。 | `chatgptBehavior.showPromptControl` | true |
| 抽屉：上一条 / 下一条 | 快速切换消息。 | `chatgptBehavior.showMessageStepper` | true |
| 左右方向键切换消息 | 输入区之外的键盘导航。 | `chatgptBehavior.enableArrowKeyMessageNavigation` | true |
| 选区浮动按钮 | 控制“复制 Markdown / 添加注释”，不关闭其他注释能力。 | `chatgptBehavior.showPageSelectionToolbar` | true |
| 选区 Markdown 复制快捷键 | 独立于浮动按钮，可按自己的工具习惯配置。 | `chatgptBehavior.atomicMarkdownCopyShortcut` | "mod-shift-c" |

## 数据与备份

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 默认书签排序 | 保留现有时间与标题四种排序方式。 | `bookmarks.sortMode` | "alpha-asc" |
| 本地导出与导入 | 保留当前完整资料备份与旧格式兼容。 | `action.localBackup` | 现有管理动作 |
| Google Drive 备份 | 保留当前实验性资料备份、恢复预览与合并入口。 | `action.drive` | 现有管理动作 |
| 本机存储用量 | 按书签、注释和高亮解释数据范围。 | `action.storage` | 现有管理动作 |

## 高级与诊断

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 在 ChatGPT 启用扩展 | 只保留 ChatGPT 的启用控制。 | `platforms.chatgpt` | true |
| 导航搜索步长 | 查找尚未挂载的消息时使用；不作为保存位置。 | `chatgptBehavior.navigationSeekStepPx` | 3000 |
| 重置 Reader 提示 | 再次展示独立 Reader 的说明。 | `action.notice` | 现有管理动作 |
| 内容发现诊断 | 查看和复制不含正文的运行诊断。 | `action.diagnostics` | 现有管理动作 |

## 内部与遗留字段

| 字段 | 去向 |
|---|---|
| `version` | 内部 schema 版本；不显示为设置。 |
| `platforms.gemini` | 遗留平台，按 ChatGPT-only 决策移出新 UI；旧字段清理另行实施。 |
| `platforms.claude` | 遗留平台，按 ChatGPT-only 决策移出新 UI；旧字段清理另行实施。 |
| `platforms.deepseek` | 遗留平台，按 ChatGPT-only 决策移出新 UI；旧字段清理另行实施。 |
| `behavior.enableClickToCopy` | 仅迁移/兼容输入；当前公式复制真相是 formula.clickCopyMarkdown。 |
| `behavior._contextOnlyConfirmed` | 内部确认状态；由确认动作维护。 |
| `reader.panelSizeRatio.widthRatio` | Reader 窗口拖动后的记忆状态，非通用设置条目。 |
| `reader.panelSizeRatio.heightRatio` | Reader 窗口拖动后的记忆状态，非通用设置条目。 |
| `reader.detachedNoticeConfirmed` | 内部提示确认状态；高级设置提供重置动作。 |
| `reader.commentExport.prompts` | 旧设置与 Reader 兼容字段；当前 Prompt library 有独立持久化及管理器，不创建第二套编辑器。 |
| `chatgptBehavior.inputEnhancement.available` | 原入口可用性同时参与 available && enabled 运行门控；继续保留 available && enabled 门控及所有子项，不能重新开启旧关闭用户。 |


## 最终验证记录

- `npm run test:core -- --maxWorkers=2`：296 个文件，2235 个测试通过。
- `npm run test:smoke`：55 个测试通过。
- `npm run test:acceptance -- --maxWorkers=2`：412 个测试通过。
- `npm run test:chatgpt-discovery -- --maxWorkers=2`：469 个测试通过。
- `npm run build`：Chrome MV3、Firefox MV2 均通过，包括入口格式与单一内容池边界检查。
- `git diff --check` 通过；语言目录额外验证通过。
- Chrome 真实组件：已查看设置分组、固定配置弹窗并成功保存输入增强为固定动作；关闭设置后，收起的抽屉只有该动作，普通抽屉无 Pin 小图标。输入增强浅色/深色和窄视口均可用；公式预览的五个支持动作可见，点击保存 SVG 命中正确预览且保留输入焦点；相关浏览器 console 无错误。
- 真实 ChatGPT 页面仅做只读结构核对：确认反向滚动容器的负 scrollTop，以及 pre/code/span 代码结构。没有发送测试消息，没有重载用户正在编辑的会话，也未对已安装扩展执行重载。因此组件验收不等于安装态全流程验收。

安装态建议回归：部分代码的空白/多行与局部公式复制；正向/反向滚动、位于底部以及主动滚动中止；中文 IME 与光标跨出公式；保存固定配置后刷新、隐藏/重新启用固定动作；页面与 detached Reader 的三项开关同步；Chrome/Firefox 公式图片实际复制与下载。

## 设置文案复查（2026-09-27）

设置页保留八个分类与全部现有配置，只更新中英文名称、说明与少量纯界面的子分组提示。更短的侧栏名称避免英文分类在现有侧栏宽度下裁切。书签“只保存内容开头”从“复制与导出”移到“数据与备份”，保存字段、默认值和写入路径未变。

| 之前容易误解的说法 | 现在的用户视角 |
|---|---|
| 选区工具栏 | 选中文字后出现的按钮；区分 ChatGPT 页面总开关与页面／阅读器共用的复制、注释、高亮开关 |
| 公式复制 PNG / PNG 图片宽度 | 回复中公式上方的“复制 PNG”按钮 / 整条消息 PNG 的宽度 |
| 持久化注释 | 保存新建的注释；明确关闭后只保留到页面结束，已保存注释不受影响 |
| 输入增强 / 输入增强入口 | 在输入框中使用输入增强 / 显示右下角的“输入增强”按钮 |
| 目录跳转速度 | 查找尚未加载消息时的滚动步长，说明通常保持默认即可 |

文案原则参照 [Apple Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles) 对受控内容及层级的说明、[Material Settings](https://m1.material.io/patterns/settings.html) 对短辅助说明的用法，以及 [Microsoft toggle switch guidance](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/toggles) 对开关短标签的建议。具体中文与英文以本产品实际操作位置为准，没有照搬第三方措辞。

本轮继续检查设置文案：把“选区工具栏”写成“选中文字后出现的按钮”，分别说清页面总开关与页面／阅读器共用的三个按钮；把公式上方按钮、单个公式图片、整条消息 PNG 分开命名；输入增强的运行开关与右下角入口开关分别说明；新注释保存、发送后位置、目录显示方式及高级导航参数改用操作结果描述。分类名称保持足够短，避免英文侧栏出现横向裁切。设置搜索支持“公式 PNG”这类跨分组与具体条目的多词查询，不改变任何存储字段、默认值或写入路径。

文案复查验证：57 个相关设置、翻译和输入弹层测试通过；Chrome MV3 与 Firefox MV2 的 `npm run build` 通过；在真实设置组件中核对了英文与中文、浅色与深色、窄视口，以及“公式 PNG”和“书签只保存”搜索结果。此前 2235 项核心测试的记录对应这次文案复查前的功能版本，本次只针对变更范围重跑相关测试。
