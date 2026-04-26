<div align="center">
  <img src="./public/icons/icon128.png" alt="AI-MarkDone Logo" width="100" height="100">
  <h1>AI-MarkDone — Focused Enhancement Extension for ChatGPT</h1>
  <p>
    <a href="https://chromewebstore.google.com/detail/ai-markdone/bmdhdihdbhjbkfaaainidcjbgidkbeoh">
      <img src="https://img.shields.io/chrome-web-store/v/bmdhdihdbhjbkfaaainidcjbgidkbeoh?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white" alt="Chrome Web Store">
    </a>
    <a href="./LICENSE">
      <img src="https://img.shields.io/github/license/zhaoliangbin42/AI-MarkDone?label=License" alt="License">
    </a>
    <img src="https://img.shields.io/badge/Version-4.2.0-10A37F" alt="Version 4.2.0">
    </br>
    <img src="https://img.shields.io/badge/Browsers-Chrome%20%7C%20Firefox%20%7C%20Safari-10A37F" alt="Browsers">
    <img src="https://img.shields.io/badge/Primary%20Platform-ChatGPT-10A37F" alt="Primary Platform">
    <a href="https://github.com/zhaoliangbin42/AI-MarkDone">
      <img src="https://img.shields.io/github/stars/zhaoliangbin42/AI-MarkDone?style=social" alt="GitHub stars">
    </a>
  </p>
  <p><strong>Read, save, export. Stay in flow.</strong></p>
  <p><em>ChatGPT directory navigation, Reader source copy, Dynamic Annotation, bookmarks, PNG export, and beautiful PDF export.</em></p>

  [中文文档](./README.zh.md) | English
</div>

---

<p align="center">
  <img src="imgs/Top.png" style="max-width:600px;width:100%;" />
</p>

---

## 🤔 Is This For You?

- **ChatGPT threads are hard to navigate?** Incremental loading can make older messages slower to revisit.
- **Scroll fatigue?** You keep losing the exact paragraph you need.
- **Need a conversation map?** You want a live outline that previews messages and jumps back to the right turn quickly.
- **Need a stable view?** You want to read and keep chatting without losing context.
- **Need real deliverables?** Clean Markdown for Obsidian/Typora, a beautiful PDF, or a PNG image you can share.
- **Knowledge keeps disappearing?** You want a bookmark system that actually helps you organize.
- **Deep Research looks like a dump?** You want AI output cleaned up so it is readable and reusable.

If any of these sound familiar, **AI-MarkDone** is built exactly for you.

---

## Interface

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

## ✨ Core Features

### ⚡ ChatGPT Directory
- **Right-side outline**: See a live directory of the current ChatGPT conversation without leaving the native page.
- **Message previews**: Scan compact previews, or switch to expanded mode when you want to see every summary at once.
- **Directory toggle**: Hide the directory when you want the native page to stay clean.
- **Direct jump**: Click an item to return to the target turn through the same stable anchor path used by ChatGPT bookmarks and Reader locate.
- **Built for the new ChatGPT page**: Replaces the old folding workflow, which is no longer stable under ChatGPT's incremental loading model.

### 📚 Reading Mode (Focus View)
- **Stable context**: A dedicated reader that renders full Markdown syntax.
- **Full-thread recovery on ChatGPT**: Reader can discover the whole conversation again under ChatGPT's incremental loading model.
- **Fast navigation**: Use `Left` / `Right` arrow keys to jump between messages.
- **Source-aware copy**: Copy formulas, code blocks, tables, images, and other closed Markdown units as source directly inside Reader.
- **Partial source selection**: Select only the part you need; Reader maps closed units back to their original Markdown boundaries and rebuilds the copied result in selection order.
- **Dynamic Annotation**: Mark exact passages, leave revision notes, and compile them into structured follow-up input.
- **Annotation cleanup**: Delete annotations when they are no longer needed.
- **Annotation insertion**: Insert compiled annotations into the Reader send box with your chosen prompt, without manually copying and pasting.
- **Keep chatting**: Send messages from Reading Mode without losing your place.

### 📦 Export & Copy (Markdown + PDF + PNG)
- **Clean Markdown**: Copy standard Markdown, ready for Obsidian, Typora, or VS Code.
- **Beautiful PDF**: Export a print-ready PDF when you need something shareable.
- **Copy as PNG**: Turn the current message into a shareable image directly from the hover toolbar.
- **Batch PNG export**: Export selected messages as one PNG each; multiple messages are packed together as a ZIP.
- **Image settings**: Configure PNG width and image scale from Settings to fit the target sharing platform.
- **Deep Research cleanup**: Restore messy Deep Research outputs into readable Markdown.

### 🔖 Bookmarks That Actually Help
- **One-click save**: Bookmark any important message instantly.
- **Organize**: Use folders to keep projects and topics separate.
- **Preview + jump**: Preview a bookmark and jump back to its original chat position, with improved ChatGPT positioning for both saving and navigation.
- **Built-in info pages**: Check Changelog, FAQ, and About directly inside the bookmarks panel.

### 🧮 One-Click LaTeX Copy
- **Click-to-copy**: Copy LaTeX from inline (`$...$`) and block (`$$...$$`) formulas.
- **No selection hassle**: Grab exactly one formula without breaking the text.

### 📊 Word Count
- **Real-time stats**: Words and characters for the current message, minus code noise.

---

## 🌐 Browser Support

| Browser | Status |
| :--- | :--- |
| **Chrome** | ✅ Fully supported, MV3 build |
| **Firefox** | ✅ Supported, MV2 build |
| **Safari** | ✅ Supported, Safari Web Extension build |

## 🤖 AI Platform Direction

| Platform | Status |
| :--- | :--- |
| **ChatGPT** | ✅ Primary focus and actively tested |
| **Gemini** | ⚠️ Maintenance only; active feature work is being phased out |
| **Claude** | ⚠️ Maintenance only; active feature work is being phased out |
| **DeepSeek** | ⚠️ Maintenance only; active feature work is being phased out |

AI-MarkDone is returning to a ChatGPT-first direction. Gemini, Claude, and DeepSeek support may remain usable for existing flows, but new feature work and deeper compatibility fixes will focus on ChatGPT.

For Gemini, consider [Gemini Voyager](https://github.com/Nagi-ovo/gemini-voyager). For cross-platform bookmark workflows, [Timeline](https://github.com/houyanchao/Timeline) is also a project I like.

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
6. Refresh your ChatGPT page and enjoy.

### 🧩 Firefox And Safari

Firefox and Safari builds are prepared from the same source code with browser-specific manifests and adapters:

```bash
npm run build:firefox
npm run build:safari:webext
```

Safari distribution uses a Safari Web Extension wrapper. Release packaging is documented in [docs/runbooks/safari-extension-release.md](./docs/runbooks/safari-extension-release.md).

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

### v4.2.0
- Added Safari and Firefox build support with shared browser adapters and generated target manifests.
- Added Copy as PNG and batch PNG export for sharing ChatGPT messages as images.
- Added PNG width and image-scale settings.
- Added expanded directory mode and a directory visibility toggle.
- Fixed Settings layout issues, clearer invalid bookmark filename messages, and ChatGPT directory jump drift under incremental loading.
- Clarified the project direction: ChatGPT is now the primary focus; Gemini, Claude, and DeepSeek support will gradually move to maintenance mode.

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
