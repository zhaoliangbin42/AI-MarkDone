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
    <img src="https://img.shields.io/badge/Version-4.8.1-10A37F" alt="Version 4.8.1">
    </br>
    <img src="https://img.shields.io/badge/Browsers-Chrome%20%7C%20Firefox%20%7C%20Safari-10A37F" alt="Browsers">
    <img src="https://img.shields.io/badge/Primary%20Platform-ChatGPT-10A37F" alt="Primary Platform">
    <a href="https://github.com/zhaoliangbin42/AI-MarkDone">
      <img src="https://img.shields.io/github/stars/zhaoliangbin42/AI-MarkDone?style=social" alt="GitHub stars">
    </a>
  </p>
  <p><strong>Read, save, export. Stay in flow.</strong></p>
  <p><em>ChatGPT 消息导航、阅读器源码复制、灵动注释、书签管理、Google Drive 备份、PNG 导出与精美 PDF 导出。</em></p>

  [官网](https://zhaoliangbin42.github.io/ai-markdone/en/) | 中文文档 | [English](./README.md)
</div>

AI-MarkDone 是一个开源 ChatGPT 浏览器扩展，面向长对话阅读、对话目录导航、源码级复制、书签整理、Markdown 导出、PDF 导出与 PNG 图片分享。它帮助用户把 ChatGPT 输出整理成可阅读、可复用、可归档的知识内容，同时尽量不打断原本的对话流程。

**适合用于：** ChatGPT 阅读模式、消息导航、Markdown 复制、LaTeX 公式复制、公式 PNG/SVG 导出、消息书签、可选 Google Drive 备份、Deep Research 清洗、PDF 导出与可分享的 PNG 截图。

---

<p align="center">
  <img src="imgs/Top.png" style="max-width:600px;width:100%;" />
</p>

---

## 🤔 适合谁使用？

- **ChatGPT 长对话不好定位？** 增量加载让旧消息回看更容易出现延迟。
- **总是找不到刚才那一段？** 滚动很久才能回到关键内容。
- **需要对话目录？** 希望一边留在原生页面，一边用实时预览快速跳回目标轮次。
- **需要稳定阅读视图？** 希望一边继续聊天，一边保留清晰上下文。
- **需要可复用输出？** 想把结果整理成标准 Markdown、PDF，或者适合分享的 PNG 图片。
- **知识总是散落？** 需要真正能帮你整理内容的书签系统。
- **Deep Research 输出太乱？** 希望清洗成更适合阅读和复用的结构化内容。

如果这些问题你都遇到过，**AI-MarkDone** 就是为此而做。

---

## 🔎 搜索友好摘要

| 需求 | AI-MarkDone 提供什么 |
| :--- | :--- |
| ChatGPT 长对话导航 | 可选右侧目录条、右下角上一条/下一条按钮、可选左右方向键导航，以及回到目标轮次的稳定跳转 |
| ChatGPT 阅读模式 | 独立阅读视图、Markdown 渲染与键盘切换 |
| 复制 ChatGPT 回答为 Markdown | 对公式、代码块、表格、图片与局部选区进行源码级复制 |
| 导出 ChatGPT 消息 | Markdown、PDF、PNG 与 ZIP 打包导出流程 |
| 保存重要 AI 回答 | 支持文件夹、预览、回到原文位置的消息书签 |
| 整理研究笔记 | Deep Research 清洗、公式图片资产、灵动注释与结构化追问输入 |

---

## 界面展示

<p align="center">
  <img src="imgs/Toolbar.png" style="max-width:800px;width:100%;" />
</p>
<p align="center">
  <img src="imgs/Reading.png" style="max-width:800px;width:100%;" />
</p>
<p align="center">
  <img src="imgs/Bookmark.png" style="max-width:800px;width:100%;" />
</p>
---

## ✨ 核心功能

### ⚡ ChatGPT 消息导航
- **可选目录条**：如果你的 ChatGPT 页面没有官方导航，或者你更喜欢插件导航，可以重新开启 AI-MarkDone 右侧目录条。
- **自动隐藏官方导航**：开启插件目录条后，会默认隐藏 ChatGPT 官方对话导航，避免两个导航条同时出现。
- **右下角 Stepper**：无需打开右侧目录条，也能快速切换上一条/下一条消息。
- **可选方向键**：非输入状态下可用 `Left` / `Right` 切换消息；也可以在 ChatGPT 设置中关闭。
- **稳定跳转**：导航复用与书签、阅读器定位一致的锚点链路。
- **适配新版 ChatGPT**：在 ChatGPT 增量加载模型下保持轻量；右侧目录条默认关闭，需要时再开启。

### 📚 阅读模式（Focus View）
- **稳定上下文**：独立阅读面板完整渲染 Markdown。
- **ChatGPT 全量识别恢复**：针对 ChatGPT 增量加载重新设计内容发现能力，阅读器可以重新识别完整对话。
- **快速导航**：支持 `Left` / `Right` 键切换消息，也支持 `Up` / `Down` 键滚动当前阅读器消息。
- **按源码复制闭合内容**：公式、代码块、表格、图片等内容可以直接在阅读器里按源码复制。
- **局部源码选中**：只选中需要的部分即可复制；阅读器会把公式、代码块、表格、图片等闭合内容映射回原始 Markdown 边界，再按选区顺序重新拼接。
- **灵动注释**：对具体段落做标注、写修改意见，再整理成结构化输入继续发给模型。
- **删除注释**：不再需要的灵动注释可以直接删除。
- **注释插入发送框**：选择提示词后，可以把整理好的注释内容直接插入阅读器发送框，减少手动复制粘贴。
- **不中断聊天**：阅读模式下也能发送消息。

### 📦 导出与复制（Markdown + PDF + PNG）
- **标准 Markdown**：可直接用于 Obsidian、Typora、VS Code。
- **精美 PDF**：导出适合分享或归档的 PDF。
- **复制为 PNG**：在消息悬浮工具栏中直接将当前消息复制为适合分享的图片。
- **公式资产**：支持将单个公式复制为 Office 兼容的 MathML，也可以在公式悬浮菜单中复制或保存为 PNG / SVG。
- **批量导出 PNG**：将选中的多条消息分别渲染为 PNG，多选时会打包成 ZIP。
- **图片参数设置**：可在设置中调整 PNG 宽度和清晰度，适配不同分享平台的视觉宽度。
- **Deep Research 清洗**：把杂乱内容恢复成可读的 Markdown。

### 🔖 真正有用的书签
- **一键保存**：重要消息即时收藏。
- **分组整理**：支持文件夹管理不同主题。
- **预览与跳转**：从书签预览并回到原始聊天位置；ChatGPT 下的保存定位和跳转定位都做了针对性优化。
- **内置信息页**：可直接在书签面板里查看更新日志、常见问题和关于我。

### ☁️ Google Drive 备份（实验性功能）
- **可选云端备份**：将经过校验的书签快照保存到你自己的 Google Drive。
- **安全恢复**：先预览安全合并详情，二次确认后只新增远端独有书签。
- **本地优先提醒**：由于功能仍处于实验阶段，备份到 Google Drive 前建议先导出一份本地副本。
- **用户数据归用户**：AI-MarkDone 不会收集你的 Google 账号、token、密码或书签。

### 🧮 一键复制 LaTeX
- **点击即复制**：支持行内公式与块级公式。
- **无需手动选区**：精确提取单个公式。
- **公式图片复制**：鼠标悬浮到公式上方即可复制或保存为 PNG / SVG，同时保留原来的点击复制源码行为。
- **公式设置**：可单独控制公式点击是否复制 Markdown，以及悬浮菜单中显示哪些 PNG / SVG 复制或保存动作。

### 📊 字数统计
- **实时统计**：显示当前消息的字数与字符数，并排除代码噪音。

---

## 🌐 浏览器支持

| 浏览器 | 状态 |
| :--- | :--- |
| **Chrome** | ✅ 完全支持，MV3 构建 |
| **Firefox** | ✅ 已支持，MV2 构建 |
| **Safari** | ✅ 已支持，Safari Web Extension 构建 |

## 🤖 AI 平台方向

| 平台 | 状态 |
| :--- | :--- |
| **ChatGPT** | ✅ 已支持 |
| **Gemini** | 仅支持公式识别 |
| **Claude** | 仅支持公式识别 |
| **DeepSeek** | 仅支持公式识别 |

AI-MarkDone 的完整运行时会继续聚焦 ChatGPT。Gemini、Claude 和 DeepSeek 保留公式级能力，支持点击复制 LaTeX，以及已开启的公式 PNG / SVG / MathML 动作。你过去保存的这些平台书签和备份仍会保留，可以继续查看、搜索、按页面/消息筛选、导出和备份。

---

## 🚀 安装方式

### 🏬 Chrome 商店（推荐）

👉 **[从 Chrome Web Store 安装](https://chromewebstore.google.com/detail/ai-markdone/bmdhdihdbhjbkfaaainidcjbgidkbeoh)**

安全、已审核、支持自动更新。

### 📦 手动安装（开发者模式）

1. 前往 GitHub [Releases](https://github.com/zhaoliangbin42/AI-MarkDone/releases) 下载最新 ZIP 包。
2. 解压文件。
3. 打开 Chrome，进入 `chrome://extensions/`。
4. 开启右上角“开发者模式”。
5. 点击“加载已解压的扩展程序”，选择解压后包含 `manifest.json` 的扩展目录。
6. 刷新 ChatGPT 页面即可开始使用。

### 🧩 Firefox 与 Safari

Firefox 和 Safari 由同一套源码生成，通过浏览器专属 manifest 和适配层区分：

```bash
npm run build:firefox
npm run build:safari:webext
```

Safari 需要通过 Safari Web Extension wrapper 分发，具体流程见 [docs/runbooks/safari-extension-release.md](./docs/runbooks/safari-extension-release.md)。

---

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

### 4.8.1
- 修复阅读器正文、Sticky 列表和内部目录在深色模式下仍然显示浅色滚动条的问题。

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

本项目使用了 [Tailwind CSS](https://tailwindcss.com/)，感谢 Tailwind 团队。

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
