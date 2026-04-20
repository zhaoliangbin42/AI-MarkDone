<div align="center">
  <img src="./public/icons/icon128.png" alt="AI-MarkDone Logo" width="100" height="100">
  <h1>AI-MarkDone — Enhancement Extension for ChatGPT, Gemini & More</h1>
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
  <p><em>ChatGPT Message Folding, Reader source copy, Dynamic Annotation, bookmarks, and beautiful PDF export.</em></p>

  [中文文档](./README.zh.md) | English
</div>

---

<p align="center">
  <img src="imgs/Top.png" style="max-width:600px;width:100%;" />
</p>

---

## 🤔 Is This For You?

- **ChatGPT feels slow?** Long answers make the page heavy and annoying to navigate.
- **Scroll fatigue?** You keep losing the exact paragraph you need.
- **Page getting sluggish?** Dozens of messages piling up slow down ChatGPT noticeably — you just want to focus on the latest few.
- **Need a stable view?** You want to read and keep chatting without losing context.
- **Need real deliverables?** Clean Markdown for Obsidian/Typora, or a beautiful PDF you can share.
- **Knowledge keeps disappearing?** You want a bookmark system that actually helps you organize.
- **Deep Research looks like a dump?** You want AI output cleaned up so it is readable and reusable.

If any of these sound familiar, **AI-MarkDone** is built exactly for you.

---

## Interface

<p align="center">
  <img src="imgs/Toolbar.png" style="max-width:800px;width:100%;" />
</p>
<p align="center">
  <img src="imgs/Fold.png" style="max-width:800px;width:100%;" />
</p>

---

## ✨ Core Features

### ⚡ Conversation Folding (ChatGPT Speed Boost)
- **Collapse old messages**: Fold earlier exchanges into a slim bar — the page renders faster and feels lighter instantly.
- **Quick dock**: A fixed right-side control lets you collapse or expand all messages in one click.
- **Smart defaults**: Set how many recent messages stay expanded automatically, so you always see what matters.
- **Manual control**: Fold or unfold any individual message at any time.

### 📚 Reading Mode (Focus View)
- **Stable context**: A dedicated reader that renders full Markdown syntax.
- **Fast navigation**: Use `Left` / `Right` arrow keys to jump between messages.
- **Source-aware copy**: Copy formulas, code blocks, tables, images, and other closed Markdown units as source directly inside Reader.
- **Partial source selection**: Select only the part you need; Reader maps closed units back to their original Markdown boundaries and rebuilds the copied result in selection order.
- **Dynamic Annotation**: Mark exact passages, leave revision notes, and compile them into structured follow-up input.
- **Annotation insertion**: Insert compiled annotations into the Reader send box with your chosen prompt, without manually copying and pasting.
- **Keep chatting**: Send messages from Reading Mode without losing your place.

### 📦 Export & Copy (Markdown + PDF)
- **Clean Markdown**: Copy standard Markdown, ready for Obsidian, Typora, or VS Code.
- **Beautiful PDF**: Export a print-ready PDF when you need something shareable.
- **Deep Research cleanup**: Restore messy Deep Research outputs into readable Markdown.

### 🔖 Bookmarks That Actually Help
- **One-click save**: Bookmark any important message instantly.
- **Organize**: Use folders to keep projects and topics separate.
- **Preview + jump**: Preview a bookmark and jump back to its exact spot in chat.
- **Built-in info pages**: Check Changelog, FAQ, and About directly inside the bookmarks panel.

### 🧮 One-Click LaTeX Copy
- **Click-to-copy**: Copy LaTeX from inline (`$...$`) and block (`$$...$$`) formulas.
- **No selection hassle**: Grab exactly one formula without breaking the text.

### 📊 Word Count
- **Real-time stats**: Words and characters for the current message, minus code noise.

---

## 🌐 Platform Support

| Platform | Status |
| :--- | :--- |
| **ChatGPT** | ✅ Fully Supported |
| **Gemini** | ✅ Fully Supported |
| **Claude** | ✅ Fully Supported |
| **DeepSeek** | ✅ Fully Supported |

---

## 🚀 Installation

### 🏬 Chrome Web Store (Recommended)

👉 **[Install from Chrome Web Store](https://chromewebstore.google.com/detail/ai-markdone/bmdhdihdbhjbkfaaainidcjbgidkbeoh)**

Secure, verified, and auto-updated.

### 📦 Manual Installation (Developer Mode)

1. Download the latest ZIP file from [GitHub Releases](https://github.com/zhaoliangbin42/AI-MarkDone/releases).
2. Unzip the file.
3. Open Chrome and go to `chrome://extensions/`.
4. Enable **Developer Mode** in the top right corner.
5. Click **Load unpacked** and select the unzipped extension folder that contains `manifest.json`.
6. Refresh your ChatGPT or Gemini page and enjoy! 🎉

---

## 💻 Development & Contribution

Contributions are welcome.

If you are using Codex or another LLM for development, use [AGENTS.md](./AGENTS.md) for the repository entrypoint and [docs/README.md](./docs/README.md) for the authoritative system documents.

```bash
# Install dependencies
npm install

# Dev mode
npm run dev

# Fast regression smoke suite (critical paths)
npm run test:smoke

# Core reliability gate (import/storage/render/message guards)
npm run test:core

# Build
npm run build
```

## 📅 Changelog (Latest)

### v4.1.1
- Reader source copy now happens directly inside Reader, with better preservation for formulas, code blocks, tables, and other closed Markdown units.
- Dynamic Annotation is now available for article-level revision workflows.
- The bookmarks panel now includes built-in Changelog, FAQ, and About pages.
- Fixed annotation insertion from the Reader send popover so choosing a prompt no longer closes the popover before the compiled text is inserted.

[Full Changelog](./CHANGELOG.md)
[Release Notes](./RELEASE_NOTES.md)

## ☕️ Support the Author

If this extension saves you time, consider buying me a coffee to support future updates.

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

Built with [Tailwind CSS](https://tailwindcss.com/). Thanks to the Tailwind team.

## 📜 License & Contact

This project is licensed under the [MIT License](./LICENSE).

We welcome all forms of contribution and discussion. If you have questions or ideas, open an [Issue](https://github.com/zhaoliangbin42/AI-MarkDone/issues).
