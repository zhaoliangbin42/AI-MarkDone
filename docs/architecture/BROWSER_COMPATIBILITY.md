# Browser Compatibility (Chrome MV3 / Firefox MV2)

本文档是 AI-MarkDone 的浏览器兼容性“权威说明”，定义 Chrome MV3 与 Firefox MV2 的运行时差异、代码分工与构建产物形态。

历史版本已归档：`docs/_legacy/BROWSER_COMPATIBILITY.md`

---

## 1. 支持范围

| Browser | Manifest | Background runtime | 状态 |
|:--|:--:|:--|:--:|
| Chrome | MV3 | Service Worker (`background.js` ← `src/background/service-worker.ts`) | ✅ |
| Firefox | MV2 | Background Script (`background.js` ← `src/background/background-firefox.js`) | ✅ |

---

## 2. 组件分工（按运行时边界）

| Component | Chrome | Firefox | 共享策略 |
|:--|:--|:--|:--|
| Content Script | `content.js`（由 `src/content/index.ts` 编译） | 同上 | ✅ 100% |
| Background | `src/background/service-worker.ts`（编译） | `src/background/background-firefox.js`（直接复制） | ❌ 分离 |
| Manifest | `manifest.chrome.json` | `manifest.firefox.json` | ❌ 分离 |
| Popup | `src/popup/popup.html`（复制） | 同上 | ✅ 100% |
| Icons/locales/KaTeX assets | `public/*`/`vendor/*`（复制） | 同上 | ✅ 100% |

为什么 background 分离（稳定性优先）：

- API 命名差异（Chrome `chrome.action` vs Firefox `browser.browserAction`）
- Chrome MV3 service worker 的模块初始化/生命周期约束更强
- 少量重复代码优于大量运行时分支（降低维护与审计复杂度）

---

## 3. 构建与产物（Build Artifacts）

脚本入口：`package.json`

- `npm run build:chrome` → `dist-chrome/`
- `npm run build:firefox` → `dist-firefox/`

产物结构（摘要）：

```
dist-chrome/
  background.js   (from src/background/service-worker.ts)
  content.js      (from src/content/index.ts)
  manifest.json   (from manifest.chrome.json)
  icons/, _locales/, vendor/katex/, src/popup/

dist-firefox/
  background.js   (copied from src/background/background-firefox.js)
  content.js      (from src/content/index.ts)
  manifest.json   (from manifest.firefox.json)
  icons/, _locales/, vendor/katex/, src/popup/
```

---

## 4. 开发规则（与蓝图/契约一致）

- 新增/修改 background 行为：必须同时更新 Chrome 与 Firefox 两个 background 文件，并更新相关协议/契约文档
- 新增/修改 content 行为：优先走 `src/utils/browser.ts` 的统一 API（避免直接依赖 `chrome.*`）
- 所有跨 runtime 通信：必须收敛到“单点协议定义”（见 `docs/architecture/BLUEPRINT.md` 的 protocol 章节）

