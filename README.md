<div align="center">
  <img src="./public/icons/icon128.png" alt="AI-MarkDone Logo" width="100" height="100">
  <h1>AI-MarkDone -- An extension for ChatGPT and Gemini.</h1>
  <p><strong>The ultimate immersive reading extension for students, researchers, and AI power users. ✨</strong></p>
  <p><em>Reading Mode, One-Click Markdown Copy, Deep Research Parser, Word Count, and Bookmarks—all in one place.</em></p>
  <p><em>Built by researchers, for researchers. 😉</em></p>

  [中文文档](./README.zh.md) | English
</div>

---

<p align="center">
  <img src="imgs/Top.png" style="max-width:600px;width:100%;" />
</p>

---

## 🤔 Is This For You?

- **Hate losing your place?** Tired of dragging scrollbars back and forth while switching between messages, never quite finding where you left off?
- **Want focus?** Do you wish for a stable reading environment instead of being forced to scroll to the bottom every time you type?
- **Broken math?** Are you frustrated by AI-generated LaTeX formulas that break when copied?
- **Single formula?** Do you often need to copy just *one* specific formula from a long paragraph?
- **Deep Research nightmare?** Does the "disastrous" source code from Deep Research outputs make you want to smash your keyboard?
- **Lost chats?** Do you wish you could bookmark important conversations so they never get lost?
- **Word count?** Need precise word counts to control your article length?

If any of these sound familiar, **AI-MarkDone** is built exactly for you.

---

## Interface

<p align="center">
  <img src="imgs/ScreenShot-Toolbar-en.png" style="max-width:800px;width:100%;" />
</p>
<p align="center">
  <img src="imgs/ScreenShot-Reader-en.png" style="max-width:800px;width:100%;" />
</p>

---

## ✨ Core Features

### 📚 Immersive Reading Mode
- **Focus Mode**: A dedicated reader that renders full Markdown syntax. Use `Left` / `Right` arrow keys to navigate messages instantly—no more scrolling lag.
- **Quick Send**: Send messages directly from Reading Mode without losing context or focus.
- **Deep Research Parser**: Special optimization for "Deep Research" outputs. We parse the chaotic source code and restore it into clean, readable Markdown, **fixing broken math formulas instantly**.

### 📋 True Markdown Copy
- **Standard Syntax**: Unlike the official "copy" button, we extract **standard Markdown**.
- **Editor Ready**: Paste directly into Typora, Obsidian, or VS Code with perfect rendering.
- **Auto-Cleaning**: Automatically removes citation tags, hyperlinks, and other AI generation noise.

### 📝 One-Click LaTeX Copy
- **Click-to-Copy**: Just click on any math formula to copy its LaTeX code. No manual selection needed.
- **Research Savior**: Supports both inline (`$...$`) and block (`$$...$$`) formulas. A massive time-saver for paper writing.

### 📚 Bookmarks & Live Preview
- **One-Click Save**: Bookmark any important message instantly.
- **Live Preview**: Preview saved bookmarks directly in the panel without jumping back to the original chat.
- **Smart Jump**: Click a bookmark to instantly scroll the chat window to the exact location of the message.
- **Folder Management**: Organize your insights with custom folders.

### 📊 Word Count
- **Real-time Stats**: Accurately counts words and characters for the current message, excluding code blocks and noise.

---

## 🌐 Platform Support

| Platform | Status |
| :--- | :--- |
| **ChatGPT** | ✅ Fully Supported |
| **Gemini** | ✅ Fully Supported |
| **Claude** | 🔜 Planned |
| **DeepSeek** | 🔜 Planned |

---

## 🚀 Installation

### 🏬 Chrome Web Store (Recommended)

👉 **[Install from Chrome Web Store](https://chromewebstore.google.com/detail/ai-markdone/bmdhdihdbhjbkfaaainidcjbgidkbeoh)**

Secure, verified, and auto-updated.

### 📦 Manual Installation (Developer Mode)

1. Download the latest ZIP file from [GitHub Releases](././releases).
2. Unzip the file.
3. Open Chrome and go to `chrome://extensions/`.
4. Enable **Developer mode** in the top right corner.
5. Click **Load unpacked** and select the unzipped `dist/` folder.
6. Refresh your ChatGPT or Gemini page and enjoy! 🎉

---

## 💻 Development & Contribution

Contributions are welcome!

If you are using LLMs for development, please refer to our [GEMINI.md](./GEMINI.md) for coding standards.

```bash
# Install dependencies
npm install

# Dev mode
npm run dev

# Build
npm run build
```

## 📅 Changelog (Latest)

### v2.5.0
- **✨ New**: Comprehensive Settings System (Behavior, Storage, Data).
- **✨ New**: Sponsor support (WeChat / Buy Me a Coffee).
- **✨ New**: Unified Accessible Dialog System.
- **✨ New**: Smart merge & duplicate detection for bookmark imports.
- **⚡️ Perf**: Massive performance boost for batch operations.
- **🎨 UI**: Unified design language and enhanced visual details.

[Full Changelog](./CHANGELOG.md)

## ☕️ Support the Author

If this extension saves you time, consider buying me a coffee to support future updates!

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


## 📜 License & Contact

This project is licensed under the [MIT License](./LICENSE).

We welcome all forms of contribution and discussion! If you have any questions, ideas, or just want to chat about AI or research, feel free to open an [Issue](https://github.com/zhaoliangbin42/AI-MarkDone/issues) or reach out.

Happy coding! 🚀
