<div align="center">
  <img src="./public/icons/icon128.png" alt="AI-MarkDone Logo" width="100" height="100">
  <h1>AI-MarkDone — ChatGPT 从未如此顺手。</h1>
  <p>
    <a href="https://chromewebstore.google.com/detail/ai-markdone/bmdhdihdbhjbkfaaainidcjbgidkbeoh">
      <img src="https://img.shields.io/chrome-web-store/v/bmdhdihdbhjbkfaaainidcjbgidkbeoh?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white" alt="Chrome Web Store">
    </a>
    <a href="./LICENSE">
      <img src="https://img.shields.io/github/license/zhaoliangbin42/AI-MarkDone?label=License" alt="License">
    </a>
    <br/>
    <img src="https://img.shields.io/badge/Platforms-ChatGPT%20%7C%20Gemini%20%7C%20Claude%20%7C%20DeepSeek-10A37F" alt="Platforms">
    <a href="https://github.com/zhaoliangbin42/AI-MarkDone">
      <img src="https://img.shields.io/github/stars/zhaoliangbin42/AI-MarkDone?style=social" alt="GitHub stars">
    </a>
  </p>
  <p><strong>阅读、收藏、导出，沉浸在与大模型的对话中。</strong></p>
  <p><em>阅读模式、一键复制 Markdown、书签管理、精美 PDF 导出，以及针对 Deep Research 的可读性优化。</em></p>

  中文文档 | [English](./README.md)
</div>

---

<p align="center">
  <img src="imgs/Top.png" style="max-width:600px;width:100%;" />
</p>

---

## 🤔 是否适合我？

- ChatGPT 变慢、页面变重，长对话越聊越难翻？
- 滚动条拖到手酸，还是找不到刚才那段关键内容？
- 你需要一个稳定的阅读视图：读得清楚，也能继续聊，不丢上下文？不然每次发送消息，自动跳到底部，难受得很！
- 你想要干净的 Markdown（Obsidian/Typora），或一份精美 PDF？
- 你希望能把重要内容“存下来并整理”，之后随时找得到？
- 你经常被 Deep Research 的“源码堆”劝退，希望输出能更可读、更可用？

上面这些痛点，但凡占一个，这款插件都无比适合你。

---

## 界面展示

<p align="center">
  <img src="imgs/ScreenShot-Toolbar-zh.png" style="max-width:800px;width:100%;" />
</p>
<p align="center">
  <img src="imgs/ScreenShot-Reader-zh.png" style="max-width:800px;width:100%;" />
</p>

---

## ✨ 核心特性

### 📚 阅读模式（专注视图）
- **稳定上下文**：完整渲染 Markdown，读起来更清晰。
- **快速切换**：左右方向键切换消息，减少反复滚动。
- **边读边聊**：在阅读模式中继续发送消息，不丢焦点。

### 📦 导出与复制（Markdown + PDF）
- **标准 Markdown**：一键复制可直接粘贴到 Obsidian、Typora、VS Code。
- **智能降噪**：自动清理引用标记、超链接等干扰信息。
- **精美 PDF**：需要可分享的输出时，直接导出成排版友好的 PDF（支持消息部分选中）。
- **Deep Research 清理**：把“源码堆”整理成更可读的 Markdown。

### 🔖 书签系统（可整理）
- **一键收藏**：把重要内容存下来，随时回看。
- **文件夹分类**：按项目/主题整理，井井有条。
- **预览与跳转**：书签面板内预览，并一键跳回原对话位置。

### 🧮 LaTeX 公式点击复制
- **点一下就复制**：支持行内 (`$...$`) 与块级 (`$$...$$`) 公式。
- **无需框选**：需要哪一个公式就取哪一个，不破坏正文。

### 📊 对话字数统计
- **实时统计**：字数与字符数实时显示，并过滤代码噪音。

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

👉 **[前往 Chrome Web Store 安装](https://chromewebstore.google.com/detail/ai-markdone/bmdhdihdbhjbkfaaainidcjbgidkbeoh)**


### 📦 手动安装（开发者模式）

1. 前往 GitHub [Releases](https://github.com/zhaoliangbin42/AI-MarkDone/releases) 下载最新 ZIP 包。
2. 解压 ZIP 文件。
3. Chrome 地址栏输入 `chrome://extensions/`，开启右上角 **开发者模式**。
4. 点击“加载已解压的扩展程序”，选择解压后的 `dist/` 文件夹。
5. 刷新页面即可使用 🎉

---

## 💻 开发与贡献

欢迎提交 PR 或 Issue！

如果你采用大模型进行开发，详细开发规范请参考 [GEMINI.md](./GEMINI.md)。

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

## 📅 更新日志 (Latest)

### v2.9.5
- **🌍 改进**: 插件支持双语（英文/中文）。
- **✨ 改进**: ChatGPT 工具栏注入时机与生命周期清理更稳定，减少动态页面更新时的错位风险。
- **🐛 修复**: 阅读模式分页边界场景与纯代码回复字数统计的加载状态问题。
- **🐛 修复**: 无文件夹时书签面板空状态样式异常。

[查看完整更新日志](./CHANGELOG.md)

## ☕️ 请作者喝杯咖啡

如果觉得这个插件对你有帮助，欢迎请我喝杯咖啡，支持我继续开发更多功能！

<div align="center">
  <div style="display: flex; justify-content: center; gap: 20px;">
    <div style="display: flex; flex-direction: column; align-items: center;">
      <p><strong>Buy me a coffee</strong></p>
      <img src="imgs/bmc_qr.png" alt="Buy Me A Coffee" width="200" style="border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    </div>
    <div style="display: flex; flex-direction: column; align-items: center;">
      <p><strong>微信 (WeChat)</strong></p>
      <img src="imgs/wechat_qr.png" alt="WeChat Reward" width="200" style="border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    </div>
  </div>
</div>

## ✅ TODO

- ChatGPT 历史消息折叠
- 全文书签
- 消息正文评论
- More...

## 📜 许可证与交流

本项目基于 [MIT License](./LICENSE) 发布。

欢迎任何形式的贡献与交流！如果你有任何问题、建议，或者想探讨 AI 与科研话题，欢迎提交 [Issue](https://github.com/zhaoliangbin42/AI-MarkDone/issues) 或直接联系我。

Happy coding! 🚀
