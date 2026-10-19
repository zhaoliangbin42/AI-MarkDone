# Browser Compatibility (Chrome MV3 / Firefox MV2)

本文档是 AI-MarkDone 的浏览器兼容性权威说明。正式目标为 Chrome MV3 和 Firefox MV2；2026-10-12 起永久停止 Safari 适配、构建、验证和分发。清理记录见 [6.2.0 发布审查](../reviews/2026-10-12-6.2.0-release-readiness.md)。

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
- manifest 生成入口：`scripts/generate-manifest.ts`
- dist 资源准备入口：`scripts/prepare-extension-target.ts`

Chrome 与 Firefox manifest 都把 `content-features.js`、`content-feature-chunks/*.js` 与 `export-renderer.html` 声明为受支持 host 可访问的 extension resources。classic `content.js` 只能以 `browser.runtime.getURL()` 解析固定 feature facade；真实图片动作进入 lazy feature 后，host client 才能用同一固定 asset contract 解析 renderer URL。模块构建使用相对 base，使 Vite preload 以 `import.meta.url` 解析到 `chrome-extension://` 或 `moz-extension://`，而不是当前网页 origin。Export renderer 的 entry、capability chunks 与 worker 由 iframe 内部从 extension origin 加载，不扩大 host-facing resource allowlist。`scripts/verify-extension-entry-format.sh` 同时验证 classic entries、全部 module chunks、export renderer/worker，以及 facade callable exports；旧的 `scripts/verify-extension-bundle-size.ts` 仅用于历史体积比较，不属于构建门禁。

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
- ChatGPT page bridge 的 request/response 在 Firefox 使用 JSON string `CustomEvent.detail`，Chrome/Chromium 使用 object detail；Graph capture 在两端都使用 JSON string detail。bridge 双端必须同时支持 object 与 string detail，浏览器差异只能停留在 transport encode/decode 层，不允许扩散到 Reader、Bookmark、Copy 或 ChatGPT snapshot 业务逻辑。Bridge 不观察 POST、generation stream 或 resource timing。
- ChatGPT page bridge 只能被动观察宿主自身的 same-origin conversation `GET` 响应；不得读取 Cookie、Token、认证请求头，不得调用 session endpoint，也不得由扩展主动重放 conversation 请求。
- ChatGPT 原子选区不做 Chrome/Firefox、Word 或 Office 版本分支，也不生成扩展自定义的富剪贴板 payload。schema 6 的 `shortcuts` 是可配置按键的 SSOT；旧 `chatgptBehavior.atomicMarkdownCopyShortcut` 的 `none` / `mod-c` / `mod-shift-c` 保留迁移与兼容映射。真实平台原生主修饰键 `C` 仍由一次 `keydown → copy` 意图驱动，其他绑定由合法选区的用户手势直接写入 canonical Markdown；Mac 自定义 Control+C 不能误当作原生 Command+C。输入控件和非完整选区必须 fail-open；DevTools 抢占快捷键时允许浏览器优先处理，不保证扩展拦截。该入口不创建反向 selection action，也不调用 programmatic native copy。单公式 MathML 资产复制继续由独立 capability detection 与 fallback 负责，不属于原子选区合同。
- 页面、页内 Reader 与独立 Reader 共用物理 `KeyboardEvent.code` 匹配，不依赖 Shift 或布局生成的字符；不做浏览器名称分支。`primary` 在 Mac 映射 Command，其余平台映射 Control。默认采用 B/Y/R（蓝/黄/红）、H（高亮）、N（注释）和 P（候选）的语义字母：Mac 为实际 Control+Shift，Windows/Linux 的正文有效选区使用 Shift+字母、输入框候选使用 Alt+Shift+P，以避开浏览器 Ctrl+Shift+B/R/P 等动作。页面声明相同 accesskey 时 Alt+Shift 命令让行。复制保留 Primary+Shift+C，导航保留裸左右键，提示词库默认空；显式用户绑定优先于新预设。IME、229、Dead/Process、长按重复不录制或执行；非 Mac 的 Control+Alt 为 AltGraph 保留，录入时拒绝；导入的 Mac Command+Option 或浏览器保留组合保留配置，但在该平台不执行。Mac Option 不因 Firefox 的 AltGraph 表示而被一概拒绝。
- 快捷键录入、重新启用和恢复默认共用作用范围/双平台冲突检查；页面选区与导航视为重叠，composer 与正文场景互斥。检查只证明插件内绑定以及已知保留按键的兼容性；系统自定义绑定、浏览器自定义行为和其他扩展无法由页面完整枚举，不承诺全局无冲突，也不新增浏览器 `commands` 权限或改键接口。
- Shadow DOM 样式注入不得假设 `shadowRoot.adoptedStyleSheets` 在所有浏览器中都是普通数组。共享样式路径应先安全读取并验证必要数组能力；若读取、构造样式表、`replaceSync` 或重新赋值失败，必须降级到 root-scoped `<style data-aimd-style-id>` 注入。
- 构造样式表共享缓存仍是支持浏览器的首选性能路径；fallback 只用于不支持或行为不兼容的 runtime，不应引入浏览器名称分支。
- 站点 toolbar anchor、header anchor 与 message discovery 仍由 adapter contract 管理。Firefox runtime 兼容修复不得通过修改 ChatGPT DOM selector、添加正文 fallback、长期轮询或 aggressive retry 来绕过底层 API 错误。

回归验证建议：

- Firefox-like `adoptedStyleSheets` 非普通数组或缺少必要数组 helper 时，`ensureStyle(..., { cache: 'shared' })` 不应抛错，并应插入 root-scoped `<style>`。
- Chrome-like `adoptedStyleSheets: CSSStyleSheet[]` 时，共享样式缓存应继续跨 ShadowRoot 复用同一个 `CSSStyleSheet`。
- 延迟扫描与公式增量处理应覆盖 Firefox receiver binding 场景，确保 idle callback 和 cancel callback 均以 `window` 作为 `this`。
- ChatGPT snapshot bridge 应覆盖 object detail 与 JSON string detail 两条 transport，确保 Firefox 不因 content/page 隔离边界丢失 snapshot。


## Retired-target cleanup boundaries (2026-10-14)

Production code and build configuration contain no Safari-specific branch. The
unused About/Feedback card-hiding parameters are removed; existing callers always
showed those cards, so their content, order and actions remain unchanged. Keep
Chromium's WebKit-prefixed CSS and real user-agent samples, unsupported-origin
rejection tests, and ignore patterns for legacy local outputs: they do not enable
Safari support. Dated changelogs, release records and benchmark measurements are
historical evidence. Active guidance must not require a retired wrapper or runbook.
Feedback subjects use the shared Chrome/Firefox detector; unknown environments
retain the generic subject without inventing a browser or attaching conversation data.


Verification: 330 files / 2719 core checks, 63 final focused checks, both production
builds and entry/boundary checks pass. Production-component replay confirms both
browser subjects, unchanged email copying and card visibility; Firefox identity
is emulated in Chromium. The installed Chrome link had the generic subject before
this edit, so an older Safari-titled mail's origin is not claimed as reproduced.
