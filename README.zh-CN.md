<div align="center">
  <img src="./public/icons/icon128.png" alt="AI-MarkDone Logo" width="100" height="100">
  <h1>AI-MarkDone</h1>
  <p><strong>AI-MarkDone —— 为你的ChatGPT和Gemini加上对话复制、阅读模式、书签系统。✨</strong></p>
  <p><em>从此你再也不用受公式渲染失败的烦恼，并且能轻易找到任何一条以前的重要消息。</em></p>

  中文文档 | [English](./README.md)
</div>

---

<p align="center">
  <img src="imgs/Compact.png" style="max-width:600px;width:100%;" />
</p>

---

## 🤔 是否适合我？

- 你是否经常因为**复制出来的数学公式总是出错**而抓耳挠腮？
- 你是否经常需要单独复制段落内的**单个数学公式**？
- 你是否经常想**复制部分内容**而非全部？
- 你是否经常因为页面中部分公式渲染失败导致的整体段落难以阅读（特别是 **Deep Research** 的长文输出）而几次想砸掉电脑？

上面这些痛点，但凡占一个，这款插件都无比适合你。😉

---

## 界面

<p align="center">
  <img src="imgs/ScreenShot.png" style="max-width:800px;width:100%;" />
</p>

---

## ✨ 特性一览

### 📐 数学公式点击复制

- 支持在对话**实时流式输出时**，点击复制单个公式（Click-to-copy）
- 自动从 AI 回复中提取 LaTeX 公式
- 同时支持**行内公式**（`$...$`）和**块级公式**（`$$...$$`）
- 复制出来的内容直接适配 Typora、Obsidian 等常见 Markdown 编辑器

### 🧾 ChatGPT & Gemini 对话一键格式化复制（Markdown）

- 一键复制当前完整对话的 **Markdown 源码**
- 自动用 `$...$` 和 `$$...$$` 包裹公式
- 尝试将 `\[...\]`、`\(...\)` 等包裹的公式用 `$...$` 和 `$$...$$` 重新包裹
- 自动去除 ChatGPT 或 Gemini 生成内容中的引用标记、超链接等噪音内容，让 Markdown 更干净

### 🪟 Markdown 源码展示面板

- 将当前对话的 Markdown 源码以面板形式**直接展示**
- 想复制多少就复制多少，自由框选、分段复制
- 适合只想复制“其中一小段”的精细操作场景

### 🔄 Live Preview 实时重渲染预览

- 解析出 Markdown 后，在面板中进行**二次重渲染**
- 对 **Deep Research** 长文、公式/表格/文本混排等“灾难现场”，进行一次“重置阅读体验”
- 尤其是原页面中有部分公式渲染失败、大片飘红时，预览区依然能正常渲染
- 支持**全屏显示**，专注阅读不被页面打断

### 📊 字数 & 字符统计（中英都算得明明白白）

- 针对中日韩（CJK）做了特殊处理：`1 个 CJK 字 = 1 word + 2 chars`
- 实时统计当前对话的字数、字符数
- 自动排除代码块、数学公式等内容，统计更贴近真实“正文长度”

### 🔖 书签与文件夹管理

- 一键将单条 AI 回复保存为书签
- 在专用面板中管理书签，并按文件夹分类整理
- 支持跨平台的书签搜索与筛选，快速回到目标内容

---

## 🌐 平台支持

| 平台 | 状态 | 功能 |
| :--- | :--- | :--- |
| **ChatGPT** | ✅ 完全支持 | 所有功能可用，包括 Deep Research |
| **Gemini** | ✅ 完全支持 | 所有功能可用，包括 Deep Research |
| **Claude** | 🔜 即将推出 | 计划中 |

---

## 🚀 安装方式

### 🏬 Chrome 商店（推荐）

- 正在上架中，审核通过后会在此更新链接～

### 📦 手动安装（本地加载）

1. 前往 GitHub 页面，下载最新版本的打包压缩包：[Releases](././releases)
2. 解压 ZIP 文件
3. 打开 Chrome，地址栏输入：`chrome://extensions/`
4. 在右上角开启 **开发者模式（Developer mode）**
5. 点击“加载已解压的扩展程序（Load unpacked）”，选择解压后的 `dist/` 文件夹
6. 加载成功后，打开 ChatGPT 或 Gemini 页面即可开始使用 🎉

## 🏗️ 项目架构

本扩展基于现代 Web 技术栈构建：

- **TypeScript** —— 更安全的类型系统与开发体验
- **Chrome Manifest V3** —— 最新的扩展平台标准
- **Shadow DOM** —— UI 与页面样式完全隔离，避免样式冲突
- **多平台适配** —— 目前支持 ChatGPT 和 Gemini（包括 Deep Research），后续将适配更多平台

---

## 💻 开发

欢迎一起来折腾这个插件，如果你想在本地跑起来或做二次开发，可以按下面步骤操作。

### 环境要求

- Node.js `18+`
- npm

### 开发步骤

```bash

# 安装依赖
npm install

# 开发模式 (带有热重载)
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run type-check
```

## 🙏 致谢

特别感谢 AITimeline 项目对本项目的启发与参考。

## 📜 许可证

本项目基于 [MIT License](./LICENSE) 发布。
