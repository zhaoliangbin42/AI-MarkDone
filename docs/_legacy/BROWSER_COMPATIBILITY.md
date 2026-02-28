# Browser Compatibility Guide

This document describes the browser compatibility architecture for AI-MarkDone.

---

## Supported Browsers

| Browser | Manifest Version | Background Script | Support Status |
|:--------|:-----------------|:------------------|:---------------|
| Chrome | V3 | `service-worker.ts` | ✅ Full |
| Firefox | V2 | `background-firefox.js` | ✅ Full |

---

## Architecture

### Code Sharing

| Component | Chrome | Firefox | Shared? |
|:----------|:-------|:--------|:--------|
| Content Script | `content.js` | `content.js` | ✅ 100% |
| Background Script | `service-worker.ts` | `background-firefox.js` | ❌ Separate |
| Manifest | `manifest.chrome.json` | `manifest.firefox.json` | ❌ Separate |
| Icons | `public/icons/` | `public/icons/` | ✅ 100% |
| Popup | `popup.html` | `popup.html` | ✅ 100% |

### Why Separate Background Scripts?

1. **API Naming**: Chrome uses `chrome.action`, Firefox MV2 uses `browser.browserAction`
2. **Service Worker**: Chrome MV3 uses Service Worker which has import restrictions
3. **Stability**: Separation avoids runtime detection and conditional logic
4. **Simplicity**: Each file is self-contained and easy to maintain

---

## Build System

### Commands

```bash
# Build both browsers
npm run build

# Build Chrome only
npm run build:chrome

# Build Firefox only
npm run build:firefox
```

### Output

```
dist-chrome/
├── background.js      # Compiled from service-worker.ts
├── content.js         # Compiled from content/index.ts
├── manifest.json      # Copied from manifest.chrome.json
├── icons/
└── src/popup/

dist-firefox/
├── background.js      # Copied from background-firefox.js (pure JS)
├── content.js         # Compiled from content/index.ts
├── manifest.json      # Copied from manifest.firefox.json
├── icons/
└── src/popup/
```

---

## Development Guidelines

### When Adding New Background Functionality

Update **both** files:
- `src/background/service-worker.ts` (Chrome, uses `chrome.*`)
- `src/background/background-firefox.js` (Firefox, uses `browser.*`)

### When Adding New Content Script Functionality

Update only Content Script files. They share 100% code via `webextension-polyfill`.

### API Mapping

| Chrome MV3 | Firefox MV2 |
|:-----------|:------------|
| `chrome.action` | `browser.browserAction` |
| `chrome.tabs` | `browser.tabs` |
| `chrome.runtime` | `browser.runtime` |
| `chrome.storage` | `browser.storage` |

---

## Testing

### Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → Select `dist-chrome/`

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select `dist-firefox/manifest.json`

---

## Lessons Learned

1. **Don't modify working code unnecessarily** - The original Chrome background script worked fine
2. **Service Worker is special** - Avoid complex imports in Service Worker
3. **Separation > Abstraction** - For simple files like background scripts, duplication is better than abstraction
4. **Content Script is the core** - 99% of the code is shared via Content Script
