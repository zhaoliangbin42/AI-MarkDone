# Browser Compatibility (Chrome MV3 / Firefox MV2 / Safari WebExtension Preview)

本文档是 AI-MarkDone 的浏览器兼容性“权威说明”，定义 Chrome MV3、Firefox MV2 与 Safari WebExtension preview target 的运行时差异、代码分工与构建产物形态。

---

## 1. 支持范围

| Browser | Manifest | Background runtime | 状态 |
|:--|:--:|:--|:--:|
| Chrome | MV3 | Service Worker (`background.js` ← `src/runtimes/background/entry.ts`) | ✅ |
| Firefox | MV2 | Background Script (`background.js` ← `src/runtimes/background/entry.ts`) | ✅ |
| Safari | MV2 WebExtension preview | Background Script (`background.js` ← `src/runtimes/background/entry.ts`) | 🧪 web extension 产物可构建；上架前需 Safari 实机验证 |

---

## 2. 组件分工（按运行时边界）

| Component | Chrome | Firefox | Safari | 共享策略 |
|:--|:--|:--|:--|:--|
| Content Script | `content.js`（由 `src/runtimes/content/entry.ts` 编译） | 同上 | 同上 | ✅ 100% |
| Background | `src/runtimes/background/entry.ts`（编译） | 同上（用 MV2 manifest + polyfill 兼容） | 同上（待 Safari 实机验证） | ✅ 100% |
| Manifest | `manifest.chrome.json` | `manifest.firefox.json` | `manifest.safari.json` | 由 `config/extension/*` + `scripts/generate-manifest.ts` 生成 |
| Popup | `src/popup/popup.html`（复制） | 同上 | 同上 | ✅ 100% |
| Icons/locales/KaTeX/page bridges | `public/*`/`vendor/*`（复制） | 同上 | 同上 | ✅ 100% |

为什么 background 入口保持共享（可审计性优先）：

- runtime API 差异已通过 `drivers/shared/browser.ts`、`drivers/shared/browserApi/*` 与 runtime detection 收敛
- 同一份 handler（protocol 路由 + write authority）更易审计、更少分叉漂移
- Chrome MV3 的 lifecycle 约束通过“幂等 + 落盘 + best-effort recovery”满足（例如 bookmarks journal replay）

---

## 3. 构建与产物（Build Artifacts）

脚本入口：`package.json`

- `npm run build:chrome` → `dist-chrome/`
- `npm run build:firefox` → `dist-firefox/`
- `npm run build:safari:webext` → `dist-safari/`（不包含 Xcode/App Store 包装）
- `npm run build` 仍只构建 Chrome + Firefox
- `npm run build:all:webext` 构建 Chrome + Firefox + Safari web extension 产物

产物结构（摘要）：

```
dist-chrome/
  background.js   (from src/runtimes/background/entry.ts)
  content.js      (from src/runtimes/content/entry.ts)
  manifest.json   (from manifest.chrome.json)
  icons/, _locales/, vendor/katex/, src/popup/

dist-firefox/
  background.js   (from src/runtimes/background/entry.ts)
  content.js      (from src/runtimes/content/entry.ts)
  manifest.json   (from manifest.firefox.json)
  icons/, _locales/, vendor/katex/, src/popup/

dist-safari/
  background.js   (from src/runtimes/background/entry.ts)
  content.js      (from src/runtimes/content/entry.ts)
  manifest.json   (from manifest.safari.json)
  icons/, _locales/, page-bridges/, vendor/katex/, src/popup/
```

---

## 4. 配置与生成规则

- 版本号唯一来源：`package.json.version`
- 支持网站唯一来源：`config/extension/hosts.ts`
- icons、popup、web accessible resources、entry 文件名唯一来源：`config/extension/assets.ts`
- target 差异唯一来源：`config/extension/targets.ts`
- manifest 生成入口：`scripts/generate-manifest.ts`
- dist 资源准备入口：`scripts/prepare-extension-target.ts`

---

## 5. 开发规则（与蓝图/契约一致）

- 新增/修改 background 行为：以 `src/runtimes/background/entry.ts` 为共享入口，并同步验证 Chrome 与 Firefox 产物；Safari 相关变更应额外运行 `npm run build:safari:webext`
- 新增/修改 content 行为：优先走 `src/drivers/shared/browser.ts` 的统一 API（避免直接依赖 `chrome.*`）
- UI 与 service 层不得新增浏览器 target 分支；浏览器差异只能位于 `config/extension/*` 或 `src/drivers/shared/browser*`
- 所有跨 runtime 通信：必须收敛到“单点协议定义”（见 `docs/architecture/BLUEPRINT.md` 的 protocol 章节）
