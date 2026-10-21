# AI-MarkDone 6.2.5 发布准备

准备日期：2026-10-20；发版日期：2026-10-21（Asia/Shanghai）

## 授权与候选范围

- 维护者已于 2026-10-21 明确授权合并 main、推送、创建 v6.2.5 标签并打包。本轮不上传 GitHub Release，也不提交商店。
- 候选来源：`codex/unify-workflow-pages`，包含 main 后九个既有提交、页面宽度修复、内容发现/消费者对齐及本轮版本与文案更新。发布提交经验证后采用快进方式进入 main，保留既有提交历史。
- 当前 main 基线为 `3cdce2de`，候选分支现有提交为 `c3cf00fb`；发版前已重新 fetch，远端 main 与本地 main 一致，且为候选分支祖先；远端无 v6.2.5 标签。
- package、lockfile 的根版本及 Chrome/Firefox 静态 manifest 已同步为 6.2.5。依赖版本不变，没有新增权限。
- 中英文 README、RELEASE_NOTES、插件内 Changelog 和 FAQ 已核对；About 双语内容适用本次版本，无需改动。README 明确区分源码标签与安装包分发、商店上架。
- 中文发布文案中 qds19100、Serein、短片、neuromaancer、Jar Sin 的感谢括号逐字保留。旧版 Changelog 逐字保留。
- 反斜杠联想在维护者指定的原“解释LRV文件”页面实际出现；本轮没有修改联想逻辑，也不宣称修复了一个尚未复现的故障。

## 验证进度

- 发布门禁：smoke 63、acceptance 506，Chrome/Firefox 构建及入口格式、单一内容池边界检查通过。
- 发布说明相关测试：旧版提示文案断言更新后，3 个文件 / 73 项通过，保留一次性提示、确认和 Reader/Library 共享确认的行为检查。
- 版本、中文感谢、双语说明与插件内内容一致性、旧版日志保留及 30 个本地文档链接/图片路径检查通过。
- 全部修改冻结后的最终核心 340 个文件 / 3116 项通过（121.64 秒），随后 `release:verify` 再次通过：smoke 63、acceptance 506、Chrome/Firefox 构建及入口与内容边界检查。类型检查通过；语言夹具与性能脚本另有 22、38 项收尾检查通过。
- Chromium 完整矩阵 492 项通过，Settings / Library 各 41 项通过；修正注释夹具的全局语言初始化后，其 41 项复跑通过，中文“更多”截图已人工核对。
- Firefox 完整矩阵首轮 491 / 492 通过。一个 Reader 场景的截图显示本地 404，visual bridge 没有状态；该 Reader 页面全部 41 项重跑通过。注释页语言修正后 41 项、Settings 与 Library 各 41 项均通过。
- 最终有效视觉覆盖为每端 574 个场景，共 1148 个；含针对性复跑共执行 1271 次。首轮异常记录保留，没有静默跳过失败。
- README 中英文设置截图已更新为当前输入框和加减按钮，Reader 截图已核查并保留。消息导出、注释及 Reader 的桌面和窄屏截图已人工抽查。
- 性能脚本原来固定发送 Control+Shift+C，在 macOS 上与默认 Command+Shift+C 不符，已改用 Playwright 的 ControlOrMeta。原剪贴板、MIME、选择和性能预算均保留。200 轮、200 次变更、3 组对照通过，p95/max 拖选增量均约 0.6ms。
- 所有运行源文件、配置、测试及夹具的冻结哈希保存在 `output/release-6.2.5/source-freeze.json`；除明确记录的夹具语言及性能脚本修正外，验证期间未改变生产实现。

## 2026-10-21 发版复核

- 将 6.2.5 的中英文更新日志与发布说明日期统一为 2026-10-21，更新对应提示测试；生产逻辑与上一轮冻结版本一致。
- 再次通过 `release:verify`：smoke 63、acceptance 506、Chrome/Firefox 生产构建及入口格式、内容边界检查。更新提示相关 3 个文件 / 73 项通过。
- 最终包已重新生成，包内文件逐项与本次 dist 字节核对，版本与资源声明检查通过。旧候选包保留在系统临时备份目录。
- 关键边界覆盖沿用已通过的核心测试：宽度 50%/100%/500%、25% 步进、非法输入/失焦/中文输入，以及新回复占位身份转正和 Reader 关闭事件。

## Chrome 安装验证与手工边界

- 已从当前 `dist-chrome/` 重载开发扩展，Chrome 扩展管理页确认版本 6.2.5。
- 真实设置入口显示 6.2.5 更新提示、日期与全部感谢括号。确认更新后可以正常读取两个已有书签，打开数学书签 Reader，显示公式和分类表格；Escape 成功关闭 Reader。
- 新开数学及 LRV 会话页时，官网显示“Could not load this ChatGPT conversation”。未将这些失败页面计为新回复准入、目录或原页导出验收，也未自动刷新用户原有会话。
- 新回复准入/Directory/书签/Reader 的冻结生产实现实机证据见 [内容发现对齐记录](../docs/plans/2026-10-20-content-discovery-consumer-alignment.md)。本轮原生 Firefox 扩展与原生 PDF 打印未重新验收，Firefox 视觉夹具通过不等于扩展实装通过。
- 原“解释LRV文件”的反斜杠联想在接手后已出现；测试字符已清除，本轮未修改该功能实现。
- 设计文档中旧的自动草稿 UI 表述已同步为维护者明确的“显式保存、关闭丢弃未保存修改”决定，未重新启用旧草稿模块。

完整结果与截图索引：[验证摘要](../output/release-6.2.5/verification-summary.json)。

## 安装包与发布边界

正式包使用 `release/AI-MarkDone-v6.2.5-chrome.zip`、`release/AI-MarkDone-v6.2.5-firefox.zip` 和 `release/AI-MarkDone-v6.2.5-SHA256SUMS.txt`。
两个 ZIP 各 111 个运行文件，排除构建目录的 Finder `.DS_Store` 元数据；包内每项与最终 dist 字节一致，静态/包内 manifest 与声明资源均通过校验。

| 包 | 字节数 | SHA-256 |
| --- | ---: | --- |
| Chrome | 7124945 | `1abd5e7a8c44b071319bdd7fb2502664e1055b1758d986d87e820e456b18c316` |
| Firefox | 7124545 | `878e868f3ed0fab0fdbbf85994fec382b10e629c775299dcefc955847e82debc` |

Firefox ZIP 不代表已签名 XPI，也不代表已经提交 Firefox Add-ons。
[双语文案](../RELEASE_NOTES.md) 与 [商店材料](AI-MarkDone-v6.2.5-STORE_NOTES.md) 已完成核对。main、标签与包的最终状态以远端引用和版本校验文件为准；GitHub Release 上传及商店提交由维护者另行进行。
