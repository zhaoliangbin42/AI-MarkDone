# Browser Compatibility (Chrome MV3 / Firefox MV2)

本文档是 AI-MarkDone 的浏览器兼容性权威说明。当前正式支持范围只有 Chrome MV3 与 Firefox MV2。仓库中遗留的 Safari 构建代码不属于产品支持、发布门禁或发布产物，后续功能不需要为其适配。

---

## 1. 支持范围

| Browser | Manifest | Background runtime | 状态 |
|:--|:--:|:--|:--:|
| Chrome | MV3 | Service Worker (`background.js` ← `src/runtimes/background/entry.ts`) | ✅ |
| Firefox | MV2 | Background Script (`background.js` ← `src/runtimes/background/entry.ts`) | ✅ |

当前最低版本为 Chrome 111 与 Firefox 128。该基线用于保证 ChatGPT 内容 bridge 能以静态 `document_start` 脚本直接运行在页面主执行环境，避免动态注入晚于宿主 hydration 的竞态。

---

## 2. 组件分工（按运行时边界）

| Component | Chrome | Firefox | 共享策略 |
|:--|:--|:--|:--|
| Content Script | `content.js`（由 `src/runtimes/content/entry.ts` 编译） | 同上 | ✅ 100% |
| Lazy content features | `content-features.js` + `content-feature-chunks/*.js` ES modules | 同上 | 与 `reader.js` 共用一个 Rollup graph；只从 extension origin 按真实用户动作加载 |
| Image export renderer | `export-renderer.html` + `export-renderer.js` + capability chunks + `png-encoder-worker.js` | 同上 | 两端共享 extension-origin iframe、MessageChannel、worker 与 `fflate`；不使用 background/offscreen renderer |
| Background | `src/runtimes/background/entry.ts`（编译） | 同上（用 MV2 manifest + polyfill 兼容） | ✅ 100% |
| Manifest | `manifest.chrome.json` | `manifest.firefox.json` | 由 `config/extension/*` + `scripts/generate-manifest.ts` 生成 |
| Google Drive Backup | `identity` + manifest `oauth2` + WebAuth fallback | `identity.launchWebAuthFlow` + configured Web OAuth client | 云端副作用统一在 background provider，UI 只能走 `cloudBackup:*` 协议 |
| Popup | `src/popup/popup.html`（复制） | 同上 | ✅ 100% |
| Icons/locales/KaTeX/page bridges | `public/*`/`vendor/*`（复制） | 同上 | 共用核心资源 |

为什么 background 入口保持共享（可审计性优先）：

- runtime API 差异已通过 `drivers/shared/browser.ts`、`drivers/shared/browserApi/*` 与 runtime detection 收敛
- 同一份 handler（protocol 路由 + write authority）更易审计、更少分叉漂移
- Chrome MV3 的 lifecycle 约束通过“幂等 + 落盘 + best-effort recovery”满足（例如 bookmarks journal replay）

---

## 3. 构建与产物（Build Artifacts）

脚本入口：`package.json`

- `npm run build:chrome` → `dist-chrome/`
- `npm run build:firefox` → `dist-firefox/`
- `npm run build` 与 `npm run build:all:webext` 均构建全部正式支持目标，也就是 Chrome + Firefox

产物结构（摘要）：

```
dist-chrome/
  background.js   (from src/runtimes/background/entry.ts)
  content.js      (from src/runtimes/content/entry.ts)
  content-features.js, content-feature-chunks/*.js
  export-renderer.html, export-renderer.js, export-renderer-chunks/*.js
  png-encoder-worker.js
  reader.js       (shared feature graph entry)
  manifest.json   (from manifest.chrome.json)
  icons/, _locales/, vendor/katex/, src/popup/

dist-firefox/
  background.js   (from src/runtimes/background/entry.ts)
  content.js      (from src/runtimes/content/entry.ts)
  content-features.js, content-feature-chunks/*.js
  export-renderer.html, export-renderer.js, export-renderer-chunks/*.js
  png-encoder-worker.js
  reader.js       (shared feature graph entry)
  manifest.json   (from manifest.firefox.json)
  icons/, _locales/, vendor/katex/, src/popup/

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

Chrome 与 Firefox manifest 都把 `content-features.js`、`content-feature-chunks/*.js` 与 `export-renderer.html` 声明为受支持 host 可访问的 extension resources。classic `content.js` 只能以 `browser.runtime.getURL()` 解析固定 feature facade；真实图片动作进入 lazy feature 后，host client 才能用同一固定 asset contract 解析 renderer URL。模块构建使用相对 base，使 Vite preload 以 `import.meta.url` 解析到 `chrome-extension://` 或 `moz-extension://`，而不是当前网页 origin。Export renderer 的 entry、capability chunks 与 worker 由 iframe 内部从 extension origin 加载，不扩大 host-facing resource allowlist。`scripts/verify-extension-entry-format.sh` 同时验证 classic entries、全部 module chunks、export renderer/worker，以及 facade callable exports；`scripts/verify-extension-bundle-size.ts` 对启动 entry、共享 feature graph 与 renderer capability 分别设预算。

Google Drive Backup v1 是浏览器兼容性边界内的显式差异：Google Chrome 使用 `chrome.identity.getAuthToken()` 与 manifest `oauth2.client_id/scopes`，由浏览器托管授权缓存；Firefox 使用 `identity.launchWebAuthFlow()` 与 `identity.getRedirectURL()`，必要时把 Firefox allizom redirect 转成 MDN 允许的 loopback redirect。两端都不得把 refresh token、client secret、cookie、Google account id 或 Drive 文件内容写入协议响应、snapshot 或 `storage.sync`。

图片导出不允许出现浏览器专用 renderer fork：Chrome MV3 不使用 Offscreen Document，Firefox MV2 不使用 background canvas。两端统一依赖普通 extension page iframe、`MessageChannel` transferable chunks、static worker、共享高内存 scheduler 和 `fflate` zlib/ZIP；无法跨 iframe 传递 Element 的 `dom-only` 公式 PNG 共用同一 content-side compatibility adapter。该架构不新增 `offscreen`、`downloads`、`debugger` 或远程资源权限，也不依赖 `CompressionStream`。

---

## 5. 开发规则（与蓝图/契约一致）

- 新增/修改 background 行为：以 `src/runtimes/background/entry.ts` 为共享入口，并同步验证 Chrome 与 Firefox 产物
- 新增/修改 content 行为：优先走 `src/drivers/shared/browser.ts` 的统一 API（避免直接依赖 `chrome.*`）
- 新增重型 content surface：必须通过现有 lazy feature facade / typed port 接入，并同步更新两端 web-accessible resource、module export、bundle budget 与真实 trigger-path gate；不得静态带回 `content.js`
- 新增/修改图片导出 capability：必须复用 `export-renderer.html` 与共享协议，验证两端产物、启动期零 renderer 请求、Firefox 128 baseline，以及 `docs/testing/IMAGE_EXPORT_GATES.md`；不得新增 target-specific renderer 或权限
- UI 与 service 层不得新增浏览器 target 分支；浏览器差异只能位于 `config/extension/*` 或 `src/drivers/shared/browser*`
- 所有跨 runtime 通信：必须收敛到“单点协议定义”（见 `docs/architecture/BLUEPRINT.md` 的 protocol 章节）

---

## 6. Content Runtime Web API 兼容规则

Content runtime 共享同一份 TypeScript 源码，但浏览器对部分 Web API 的容错程度不同。兼容差异应在共享底层 helper 或 runtime utility 中收敛，不应扩散到 ChatGPT adapter、UI 组件或业务 service。

当前长期规则：

- `requestIdleCallback` / `cancelIdleCallback` 必须以 `window` 作为 receiver 调用。Firefox 对裸函数调用会执行 WebIDL receiver 校验，裸调用可能抛出 `called on an object that does not implement interface Window`，从而中断扫描调度、公式增量增强或其他延迟任务。
- ChatGPT page bridge 的 Firefox content/page script 通信必须使用 JSON string `CustomEvent.detail`；Chrome/Chromium 继续使用 object detail。bridge 双端必须同时支持 object 与 string detail，浏览器差异只能停留在 transport encode/decode 层，不允许扩散到 Reader、Bookmark、Copy 或 ChatGPT snapshot 业务逻辑。
- ChatGPT page bridge 只能被动观察宿主自身的 same-origin conversation `GET` 响应；不得读取 Cookie、Token、认证请求头，不得调用 session endpoint，也不得由扩展主动重放 conversation 请求。
- Shadow DOM 样式注入不得假设 `shadowRoot.adoptedStyleSheets` 在所有浏览器中都是普通数组。共享样式路径应先安全读取并验证必要数组能力；若读取、构造样式表、`replaceSync` 或重新赋值失败，必须降级到 root-scoped `<style data-aimd-style-id>` 注入。
- 构造样式表共享缓存仍是支持浏览器的首选性能路径；fallback 只用于不支持或行为不兼容的 runtime，不应引入浏览器名称分支。
- 站点 toolbar anchor、header anchor 与 message discovery 仍由 adapter contract 管理。Firefox runtime 兼容修复不得通过修改 ChatGPT DOM selector、添加正文 fallback、长期轮询或 aggressive retry 来绕过底层 API 错误。

回归验证建议：

- Firefox-like `adoptedStyleSheets` 非普通数组或缺少必要数组 helper 时，`ensureStyle(..., { cache: 'shared' })` 不应抛错，并应插入 root-scoped `<style>`。
- Chrome-like `adoptedStyleSheets: CSSStyleSheet[]` 时，共享样式缓存应继续跨 ShadowRoot 复用同一个 `CSSStyleSheet`。
- 延迟扫描与公式增量处理应覆盖 Firefox receiver binding 场景，确保 idle callback 和 cancel callback 均以 `window` 作为 `this`。
- ChatGPT snapshot bridge 应覆盖 object detail 与 JSON string detail 两条 transport，确保 Firefox 不因 content/page 隔离边界丢失 snapshot。
