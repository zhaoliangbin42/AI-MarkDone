<div align="center">
  <img src="./public/icons/icon128.png" alt="AI-MarkDone Logo" width="100" height="100">
  <h1>AI-MarkDone — ChatGPT Productivity Suite</h1>
  <p>
    <a href="https://chromewebstore.google.com/detail/ai-markdone/bmdhdihdbhjbkfaaainidcjbgidkbeoh">
      <img src="https://img.shields.io/chrome-web-store/v/bmdhdihdbhjbkfaaainidcjbgidkbeoh?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white" alt="Chrome Web Store">
    </a>
    <a href="./LICENSE">
      <img src="https://img.shields.io/github/license/zhaoliangbin42/AI-MarkDone?label=License" alt="License">
    </a>
    <img src="https://img.shields.io/badge/Version-6.1.0-10A37F" alt="Version 6.1.0">
    <br>
    <img src="https://img.shields.io/badge/Browsers-Chrome%20%7C%20Firefox-10A37F" alt="Browsers">
    <img src="https://img.shields.io/badge/Primary%20Platform-ChatGPT-10A37F" alt="Primary Platform">
    <a href="https://github.com/zhaoliangbin42/AI-MarkDone">
      <img src="https://img.shields.io/github/stars/zhaoliangbin42/AI-MarkDone?style=social" alt="GitHub stars">
    </a>
  </p>
  <p><strong>阅读、整理、导出，继续你的对话。</strong></p>
  <p>消息目录、独立阅读器、公式输入辅助、提示词、书签与注释。</p>

  [官网](https://zhaoliangbin42.github.io/ai-markdone/en/) | 中文文档 | [English](./README.md)
</div>

AI-MarkDone 是一个面向 ChatGPT 的开源浏览器扩展。用消息目录定位回复，在阅读器里看长文，用高亮、注释和书签整理内容，再复制或导出到笔记工具。

6.1.0 重新整理了工具栏和设置：常用按钮可以固定显示，功能全览帮你找到用途和入口。写公式时，还可以在输入框里预览并导出图片。

## 界面展示

<p align="center"><img src="imgs/FeatureOverview.png" alt="功能全览：分组查看功能、用途和入口" style="max-width:900px;width:100%;" /></p>
<p align="center"><img src="imgs/Reader.png" alt="阅读器" style="max-width:800px;width:100%;" /></p>

## 核心功能

### 消息目录与导航
- 在“设置 → 阅读与消息”开启消息目录，按提问摘要找到回复，悬停条目可以预览内容。
- 浏览到旧消息时，目录会继续补入新加载的回复。
- 用页面右下角的上一条／下一条按钮或左右方向键切换消息；输入时方向键照常移动光标。
- 发送消息时自动恢复阅读位置，方便接着看前文。

### 阅读器与独立阅读器
- 从回复底部工具栏打开阅读器，查看标题、列表、表格、代码和公式。
- 标题大纲帮助你定位长回复中的段落；同页内记住每条回复的阅读位置。
- 将选中片段暂存到摘录区，边读边对照，也可以在阅读器里继续提问。
- 官网长对话滚动卡顿时，从 ChatGPT 网站右下角工具栏打开独立阅读器，在单独标签页阅读。
- 在设置中选择链接和代码块的呈现方式，统一应用到阅读器、整条回复复制和消息导出。

### 复制与导出
- 复制回复或选区的 Markdown，保留标题、列表、表格、代码和公式，粘贴后继续编辑。
- 部分代码选区只复制所选片段；公式按完整公式复制。
- 悬停消息复制按钮，上方可复制 PNG，下方可将提问和回复一起复制。
- 选择一条或多条回复，保存为 Markdown、PNG，或通过浏览器打印窗口保存为 PDF；多张 PNG 可打包为 ZIP。
- 按分享场景设置图片宽度和清晰度，整理 Deep Research 内容后用于笔记或分享。

### 输入与公式
- Enter 换行，Cmd/Ctrl + Enter 发送；支持加粗快捷键和编号、项目符号列表辅助。
- 光标进入公式时显示预览；输入反斜杠调用 LaTeX 命令片段，用 Tab 切换填空位置。
- 在公式预览中直接复制或导出 PNG、SVG、MathML；回复中的公式可以点击复制 LaTeX 源码。

### 提示词、注释与高亮
- 保存常用提示词，在官网输入框或阅读器发送框中输入反斜杠和触发词即可调用。
- 用光标标记指定提示词插入后的填写位置，也可以将提示词与当前对话注释一起插入草稿。
- 选中原文写注释，或用三种高亮颜色标出重点。在资料库中搜索、编辑和归档这些内容。
- 高亮自动保存；开启“保存新建的注释”后，刷新页面也能继续查看注释。
- 用注释模板组合原文、意见和提示词，复制或插入发送框继续追问。

### 书签与备份
- 保存消息及对应提问，或收藏对话链接；用文件夹、搜索和批量操作整理资料。
- 打开消息书签查看保存的内容，复制文字或返回原对话。
- 导出资料库到本地文件，或连接 Google Drive（实验性功能）后手动备份；导入和恢复时可以先看合并预览。
- 配置文件用于导入、导出设置偏好，换浏览器时继续使用熟悉的配置。

### 自定义界面
- 浅色、深色、跟随页面，多款主题色和自定义色值。
- 在“设置 → 按钮”管理按钮显示与固定状态，通过预览查看效果。
- 设置按八个分类整理，支持搜索；功能全览提供功能说明、入口和快捷键。

## 浏览器与平台

支持 Chrome（MV3）和 Firefox（MV2）。主要功能用于 ChatGPT；Gemini、Claude 和 DeepSeek 提供公式复制与导出。

## 安装

### Chrome

从 [Chrome Web Store](https://chromewebstore.google.com/detail/ai-markdone/bmdhdihdbhjbkfaaainidcjbgidkbeoh) 安装，后续通过商店更新。

手动安装：
1. 从 [GitHub Releases](https://github.com/zhaoliangbin42/AI-MarkDone/releases) 下载 AI-MarkDone-v6.1.0-chrome.zip 并解压。
2. 打开 chrome://extensions/，开启开发者模式。
3. 点击“加载已解压的扩展程序”，选择包含 manifest.json 的解压目录。
4. 刷新 ChatGPT 页面。

### Firefox

Firefox 包为 AI-MarkDone-v6.1.0-firefox.zip。开发调试时，解压后打开 about:debugging#/runtime/this-firefox，点击“临时载入附加组件”，选择 manifest.json。

## 💻 开发与贡献

欢迎提交 PR 或 Issue。

如果你使用 Codex 或其他大模型参与开发，请以 [AGENTS.md](./AGENTS.md) 作为仓库入口规范，并以 [docs/README.md](./docs/README.md) 作为系统权威文档入口。

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 快速回归冒烟测试（关键路径）
npm run test:smoke

# 核心可靠性门禁（导入/存储/渲染/消息边界）
npm run test:core

# 构建
npm run build
```

## 📅 最新更新

### 6.1.0
- 加固消息目录，浏览旧消息时继续补全目录。
- 常用工具栏按钮可固定显示，设置提供分类、搜索与按钮预览。
- 新增功能全览、更多主题色和自定义颜色。
- 公式预览跟随输入光标，可直接导出 PNG／SVG 等格式。
- 增加内容呈现选项和悬浮按钮开关，修复发送后的阅读位置恢复。

[完整更新日志](./CHANGELOG.md)
[版本说明](./RELEASE_NOTES.md)

## ☕️ 支持作者

如果这个扩展帮你节省了时间，欢迎请作者喝杯咖啡，支持后续更新。

<div align="center">
  <div style="display: flex; justify-content: center; gap: 20px;">
    <div style="display: flex; flex-direction: column; align-items: center;">
      <p><strong>Buy Me a Coffee</strong></p>
      <img src="imgs/bmc_qr.png" alt="Buy Me A Coffee" width="200" style="border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    </div>
    <div style="display: flex; flex-direction: column; align-items: center;">
      <p><strong>WeChat</strong></p>
      <img src="imgs/wechat_qr.png" alt="WeChat Reward" width="200" style="border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    </div>
  </div>
</div>

## 🙏 Acknowledgements

感谢所有贡献者、提供反馈的朋友，以及本项目使用的开源工具。

## ⭐ Star History

<p align="center">
  <a href="https://www.star-history.com/#zhaoliangbin42/AI-MarkDone&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=zhaoliangbin42/ai-markdone&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=zhaoliangbin42/ai-markdone&type=Date" />
      <img alt="AI-MarkDone GitHub star 增长趋势" src="https://api.star-history.com/svg?repos=zhaoliangbin42/ai-markdone&type=Date" />
    </picture>
  </a>
</p>

## 📜 许可与联系

本项目基于 [MIT License](./LICENSE) 开源。

欢迎通过 [Issue](https://github.com/zhaoliangbin42/AI-MarkDone/issues) 提出问题、建议或讨论想法。
