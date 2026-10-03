# AI-MarkDone 6.1.0 发布准备快照

准备日期：2026-10-02（Asia/Shanghai）

## 材料

- 中文发布文案：`RELEASE_NOTES.md` 的 6.1.0 中文部分，以及管理面板内的 `changelog.zh.md`。保留作者原有开场、段落、八条更新和感谢名单，只修正语法、重复字和少量不顺的表达。
- 英文说明：`changelog.en.md` 与 `RELEASE_NOTES.md`。
- 中英文 README：更新当前功能、安装方式、6.1.0 摘要和界面示例；移除旧的全量加载承诺与过时说明。
- 版本：package、lockfile、生成的 manifest 与构建产物均为 6.1.0。旧目标 manifest 仅同步版本以满足仓库一致性校验；正式包为 Chrome 和 Firefox。

## 自动校验

- `npm run release:verify`：烟雾 55 项、验收 442 项通过，Chrome／Firefox 生产构建及入口、内容边界检查通过。
- `npm run test:core -- --maxWorkers=2`：305 个文件、2418 项通过。
- 更新提示测试与阅读器旧标签断言已同步到当前版本和术语。
- 两个 ZIP 各含 108 个文件，manifest 位于包根目录，资源齐全，ZIP 完整性与 SHA-256 校验通过。
- `git diff --check` 通过。

## 安装包

- `release/AI-MarkDone-v6.1.0-chrome.zip`
- `release/AI-MarkDone-v6.1.0-firefox.zip`
- `release/AI-MarkDone-v6.1.0-SHA256SUMS.txt`

安装包取自当前 6.1.0 工作区，功能代码基线为 `3de026df`；本轮版本与发布文档改动尚待提交。

## 打包时的待办（2026-10-02）

- 维护者审读中文轻改稿，以及 README、英文说明和管理面板内信息页。
- 在重新加载的 Chrome 与 Firefox 安装包上完成发布相关人工验收。此前已完成的官网发送保位检查可作为功能证据，但不替代新包的完整安装验收。
- 将确认后的发布提交合入 main，再按发版指南推送主线、创建并推送带注释的 v6.1.0 标签。
- 上传 GitHub／商店并确认提交结果。

截至 2026-10-02 的准备检查，发布材料与自动校验已完成，当时尚未合并主线、打标签、推送或上传。本文件记录打包时的检查结果；后续 main 与 v6.1.0 的状态以 Git 远端引用为准，上传状态以 GitHub／商店记录为准。
