<div align="center">
  <img src="./public/icons/icon128.png" alt="AI-MarkDone Logo" width="100" height="100">
  <h1>AI-MarkDone — ChatGPT、Gemini 等平台增强扩展</h1>
  <p>
    <a href="https://chromewebstore.google.com/detail/ai-markdone/bmdhdihdbhjbkfaaainidcjbgidkbeoh">
      <img src="https://img.shields.io/chrome-web-store/v/bmdhdihdbhjbkfaaainidcjbgidkbeoh?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white" alt="Chrome Web Store">
    </a>
    <a href="./LICENSE">
      <img src="https://img.shields.io/github/license/zhaoliangbin42/AI-MarkDone?label=License" alt="License">
    </a>
    </br>
    <img src="https://img.shields.io/badge/Platforms-ChatGPT%20%7C%20Gemini%20%7C%20Claude%20%7C%20DeepSeek-10A37F" alt="Platforms">
    <a href="https://github.com/zhaoliangbin42/AI-MarkDone">
      <img src="https://img.shields.io/github/stars/zhaoliangbin42/AI-MarkDone?style=social" alt="GitHub stars">
    </a>
  </p>
  <p><strong>Read, save, export. Stay in flow.</strong></p>
  <p><em>阅读模式、一键 Markdown 复制、书签管理与精美 PDF 导出。</em></p>

  中文文档 | [English](./README.md)
</div>

---

<p align="center">
  <img src="imgs/Top.png" style="max-width:600px;width:100%;" />
</p>

---

## 🤔 适合谁使用？

- **ChatGPT 变慢了？** 长对话让页面越来越重，阅读和定位都变得很难受。
- **总是找不到刚才那一段？** 滚动很久才能回到关键内容。
- **页面越来越卡？** 消息越积越多，渲染越来越慢，你只想专注最近几轮。
- **需要稳定阅读视图？** 希望一边继续聊天，一边保留清晰上下文。
- **需要可复用输出？** 想把结果整理成标准 Markdown 或直接导出为 PDF。
- **知识总是散落？** 需要真正能帮你整理内容的书签系统。
- **Deep Research 输出太乱？** 希望清洗成更适合阅读和复用的结构化内容。

如果这些问题你都遇到过，**AI-MarkDone** 就是为此而做。

---

## 界面展示

<p align="center">
  <img src="imgs/ScreenShot-Toolbar-en.png" style="max-width:800px;width:100%;" />
</p>
<p align="center">
  <img src="imgs/ScreenShot-Folding.png" style="max-width:800px;width:100%;" />
</p>
<p align="center">
  <img src="imgs/ScreenShot-Reader-en.png" style="max-width:800px;width:100%;" />
</p>

---

## ✨ 核心功能

### ⚡ 对话折叠（ChatGPT 加速）
- **折叠旧消息**：把前面的对话压缩成细条，页面渲染更轻、更快。
- **快速控制**：右侧固定控制栏支持一键全部折叠或展开。
- **智能默认值**：可配置默认保留展开的最近消息数量。
- **手动控制**：任意消息都可以单独折叠或展开。

### 📚 阅读模式（Focus View）
- **稳定上下文**：独立阅读面板完整渲染 Markdown。
- **快速导航**：支持 `Left` / `Right` 键切换消息。
- **不中断聊天**：阅读模式下也能发送消息。

### 📦 导出与复制（Markdown + PDF）
- **标准 Markdown**：可直接用于 Obsidian、Typora、VS Code。
- **精美 PDF**：导出适合分享或归档的 PDF。
- **Deep Research 清洗**：把杂乱内容恢复成可读的 Markdown。

### 🔖 真正有用的书签
- **一键保存**：重要消息即时收藏。
- **分组整理**：支持文件夹管理不同主题。
- **预览与跳转**：从书签预览并回到原始聊天位置。

### 🧮 一键复制 LaTeX
- **点击即复制**：支持行内公式与块级公式。
- **无需手动选区**：精确提取单个公式。

### 📊 字数统计
- **实时统计**：显示当前消息的字数与字符数，并排除代码噪音。

---

## 🌐 平台支持

| 平台 | 状态 |
| :--- | :--- |
| **ChatGPT** | ✅ 完全支持 |
| **Gemini** | ✅ 完全支持 |
| **Claude** | ✅ 完全支持 |
| **DeepSeek** | ✅ 完全支持 |

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
5. 点击“加载已解压的扩展程序”，选择解压后的 `dist/` 文件夹。
6. 刷新 ChatGPT 或 Gemini 页面即可开始使用。

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

### v4.0.0
- **✨ 新增**：共享 overlay 面板、保存弹窗与书签界面现在统一到同一套 shell 与动效契约。
- **🧭 改进**：ChatGPT 折叠、阅读器、书签、源码视图与发送界面现在围绕统一的 token 化 UI 系统对齐。
- **🐛 修复**：书签保存弹窗在输入法 composition 期间不再中途丢失焦点。

[完整更新日志](./CHANGELOG.md)

## ☕️ 支持作者

如果这个扩展帮你节省了时间，欢迎请作者喝杯咖啡，支持后续更新。

<div align="center">
  <div style="display: flex; justify-content: center; gap: 20px;">
    <div style="display: flex; flex-direction: column; align-items: center;">
      <p><strong>Buy me a coffee</strong></p>
      <img src="imgs/bmc_qr.png" alt="Buy Me A Coffee" width="200" style="border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    </div>
    <div style="display: flex; flex-direction: column; align-items: center;">
      <p><strong>WeChat</strong></p>
      <img src="imgs/wechat_qr.png" alt="WeChat Reward" width="200" style="border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    </div>
  </div>
</div>

## ✅ TODO

- 书签全文搜索
- 消息评论
- 更多功能...

## 📜 许可与联系

本项目基于 [MIT License](./LICENSE) 开源。

欢迎通过 [Issue](https://github.com/zhaoliangbin42/AI-MarkDone/issues) 提出问题、建议或讨论想法。
