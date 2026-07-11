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
| Lazy content features | `content-features.js` + `content-feature-chunks/*.js` ES modules | 同上 | 同上（待 Safari 实机验证） | 与 `reader.js` 共用一个 Rollup graph；只从 extension origin 按真实用户动作加载 |
| Background | `src/runtimes/background/entry.ts`（编译） | 同上（用 MV2 manifest + polyfill 兼容） | 同上（待 Safari 实机验证） | ✅ 100% |
| Manifest | `manifest.chrome.json` | `manifest.firefox.json` | `manifest.safari.json` | 由 `config/extension/*` + `scripts/generate-manifest.ts` 生成 |
| Google Drive Backup | `identity` + manifest `oauth2` + WebAuth fallback | `identity.launchWebAuthFlow` + configured Web OAuth client | 不展示入口 | 云端副作用统一在 background provider，UI 只能走 `cloudBackup:*` 协议 |
| Popup | `src/popup/popup.html`（复制） | 同上 | 同上 | ✅ 100% |
| Icons/locales/KaTeX/page bridges | `public/*`/`vendor/*`（复制） | 同上 | App Store 合规 allowlist（无 sponsor/social 资源） | 共享核心资源；Safari target 有合规裁剪 |

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
  content-features.js, content-feature-chunks/*.js
  reader.js       (shared feature graph entry)
  manifest.json   (from manifest.chrome.json)
  icons/, _locales/, vendor/katex/, src/popup/

dist-firefox/
  background.js   (from src/runtimes/background/entry.ts)
  content.js      (from src/runtimes/content/entry.ts)
  content-features.js, content-feature-chunks/*.js
  reader.js       (shared feature graph entry)
  manifest.json   (from manifest.firefox.json)
  icons/, _locales/, vendor/katex/, src/popup/

dist-safari/
  background.js   (from src/runtimes/background/entry.ts)
  content.js      (from src/runtimes/content/entry.ts)
  content-features.js, content-feature-chunks/*.js
  reader.js       (shared feature graph entry)
  manifest.json   (from manifest.safari.json)
  icons/, _locales/, page-bridges/, vendor/katex/, src/popup/
```

---

## 4. 配置与生成规则

- 版本号唯一来源：`package.json.version`
- 支持网站唯一来源：`config/extension/hosts.ts`
- icons、popup、web accessible resources、entry 文件名唯一来源：`config/extension/assets.ts`
- target 差异唯一来源：`config/extension/targets.ts`
- target surface policy 唯一来源：`config/extension/surface.ts`
- manifest 生成入口：`scripts/generate-manifest.ts`
- dist 资源准备入口：`scripts/prepare-extension-target.ts`

三端 manifest 都把 `content-features.js` 与 `content-feature-chunks/*.js` 声明为受支持 host 可访问的 extension resources。classic `content.js` 只能以 `browser.runtime.getURL()` 解析固定 facade URL；模块构建使用相对 base，使 Vite preload 以 `import.meta.url` 解析到 `chrome-extension://` / `moz-extension://` / Safari extension origin，而不是当前网页 origin。`scripts/verify-extension-entry-format.sh` 同时验证 classic entries、全部 module chunks，以及 facade 的五个 callable exports；`scripts/verify-extension-bundle-size.ts` 对启动 entry 和完整共享 feature graph 分别设预算。

Safari App Store target 的 surface policy 是合规差异，不是功能 fork：Chrome/Firefox 继续保留 sponsor tab、Buy Me Coffee 二维码、GitHub 支持 CTA、赞助感谢名单、About 小红书关注卡，以及 PNG/SVG 二进制剪贴板 copy 动作；Safari 在 build-time 关闭 sponsor tab、社交关注卡和 binary clipboard copy surfaces，并在 dist 阶段裁剪 `bmc_qr.png`、`wechat_qr.png`、`xiaohongshu_card.png` 以及对应 sponsor/social locale keys。Safari 的 Save/Export PNG/SVG 下载动作继续保留，底部 Feedback tab 的官网卡片、反馈邮箱与 support contact card 也继续保留。

Google Drive Backup v1 是浏览器兼容性边界内的显式差异：Google Chrome 使用 `chrome.identity.getAuthToken()` 与 manifest `oauth2.client_id/scopes`，由浏览器托管授权缓存；支持 WebAuth 的浏览器使用 `identity.launchWebAuthFlow()` 与 `identity.getRedirectURL()`，并要求 Google Cloud Web OAuth client 配置 exact redirect URI；Firefox 使用同一 WebAuth 代码路径，必要时把 Firefox allizom redirect 转成 MDN 允许的 loopback redirect。Safari v1 不展示 Google Drive Backup，直到有可验证的 Safari auth 路径。所有 target 都不得把 refresh token、client secret、cookie、Google account id 或 Drive 文件内容写入协议响应、snapshot 或 `storage.sync`。

---

## 5. 开发规则（与蓝图/契约一致）

- 新增/修改 background 行为：以 `src/runtimes/background/entry.ts` 为共享入口，并同步验证 Chrome 与 Firefox 产物；Safari 相关变更应额外运行 `npm run build:safari:webext`
- 新增/修改 content 行为：优先走 `src/drivers/shared/browser.ts` 的统一 API（避免直接依赖 `chrome.*`）
- 新增重型 content surface：必须通过现有 lazy feature facade / typed port 接入，并同步更新三端 web-accessible resource、module export、bundle budget 与真实 trigger-path gate；不得静态带回 `content.js`
- UI 与 service 层不得新增浏览器 target 分支；浏览器差异只能位于 `config/extension/*` 或 `src/drivers/shared/browser*`
- 所有跨 runtime 通信：必须收敛到“单点协议定义”（见 `docs/architecture/BLUEPRINT.md` 的 protocol 章节）

---

## 6. Content Runtime Web API 兼容规则

Content runtime 共享同一份 TypeScript 源码，但浏览器对部分 Web API 的容错程度不同。兼容差异应在共享底层 helper 或 runtime utility 中收敛，不应扩散到 ChatGPT adapter、UI 组件或业务 service。

当前长期规则：

- `requestIdleCallback` / `cancelIdleCallback` 必须以 `window` 作为 receiver 调用。Firefox 对裸函数调用会执行 WebIDL receiver 校验，裸调用可能抛出 `called on an object that does not implement interface Window`，从而中断扫描调度、公式增量增强或其他延迟任务。
- ChatGPT page bridge 的 Firefox content/page script 通信必须使用 JSON string `CustomEvent.detail`；Chrome/Chromium 继续使用 object detail。bridge 双端必须同时支持 object 与 string detail，浏览器差异只能停留在 transport encode/decode 层，不允许扩散到 Reader、Bookmark、Copy 或 ChatGPT snapshot 业务逻辑。
- Shadow DOM 样式注入不得假设 `shadowRoot.adoptedStyleSheets` 在所有浏览器中都是普通数组。共享样式路径应先安全读取并验证必要数组能力；若读取、构造样式表、`replaceSync` 或重新赋值失败，必须降级到 root-scoped `<style data-aimd-style-id>` 注入。
- 构造样式表共享缓存仍是支持浏览器的首选性能路径；fallback 只用于不支持或行为不兼容的 runtime，不应引入浏览器名称分支。
- 站点 toolbar anchor、header anchor 与 message discovery 仍由 adapter contract 管理。Firefox runtime 兼容修复不得通过修改 ChatGPT DOM selector、添加正文 fallback、长期轮询或 aggressive retry 来绕过底层 API 错误。

回归验证建议：

- Firefox-like `adoptedStyleSheets` 非普通数组或缺少必要数组 helper 时，`ensureStyle(..., { cache: 'shared' })` 不应抛错，并应插入 root-scoped `<style>`。
- Chrome-like `adoptedStyleSheets: CSSStyleSheet[]` 时，共享样式缓存应继续跨 ShadowRoot 复用同一个 `CSSStyleSheet`。
- 延迟扫描与公式增量处理应覆盖 Firefox receiver binding 场景，确保 idle callback 和 cancel callback 均以 `window` 作为 `this`。
- ChatGPT snapshot bridge 应覆盖 object detail 与 JSON string detail 两条 transport，确保 Firefox 不因 content/page 隔离边界丢失 snapshot。
