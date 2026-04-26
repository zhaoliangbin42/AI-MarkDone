# Safari WebExtension Build And Distribution Runbook

适用场景：准备或验证 AI-MarkDone 的 Safari WebExtension 产物。仓库负责生成 `dist-safari/`、生成 Xcode 包装工程、记录 DMG 打包命令；Xcode project、证书、Apple Team、App Store Connect 账号、notarytool 凭据仍属于发布者本机/Apple 账户配置，不提交到仓库。

## Build

1. 生成 Safari WebExtension 产物：

   ```bash
   npm run build:safari:webext
   ```

2. 确认 `dist-safari/` 包含：
   - `manifest.json`
   - `background.js`
   - `content.js`
   - `icons/`
   - `_locales/`
   - `page-bridges/`
   - `vendor/katex/`
   - `src/popup/popup.html`

## Xcode / Local Packaging Path

每次明确执行 Release 流程时，都要使用 Apple 的 Safari Web Extension converter 生成本地 Xcode 包装工程：

```bash
npm run package:safari:xcode
```

生成后在 Xcode 中配置 Team、signing、archive。Apple Team ID、证书、App Store 文案、截图与隐私问卷不写入仓库。

脚本会使用 `--copy-resources --no-open --no-prompt --force`，让 release 阶段可以重复生成 `safari-build/`，且不会依赖 converter 自动打开 Xcode。

如果本机缺少 Xcode、Command Line Tools、`xcrun safari-web-extension-converter` 或 signing 配置，Release 流程必须停下来报告具体 blocker；不要把 Safari packaging 当作可静默跳过的步骤。

## Free DMG Path

免费 DMG 是直接分发渠道，功能必须和 App Store 付费版完全一致。区别只在分发渠道、签名方式和商店价格，不在代码分支。

1. 完成 WebExtension 与 Xcode wrapper：

   ```bash
   npm run build:safari:webext
   npm run package:safari:xcode
   ```

2. 在 Xcode 中打开 `safari-build/AI-MarkDone/AI-MarkDone.xcodeproj`，配置 Team、bundle signing、Hardened Runtime，并使用 Developer ID 路线 Archive / Export 一个签名后的 `AI-MarkDone.app`。

3. 从签名后的 `.app` 生成 DMG：

   ```bash
   SAFARI_APP_PATH="/path/to/AI-MarkDone.app" npm run package:safari:dmg
   ```

   默认输出：

   ```text
   release-artifacts/safari/AI-MarkDone-<package.version>-free.dmg
   ```

4. 如果需要脚本自动提交 notarization 并 stapler，使用 keychain profile：

   ```bash
   SAFARI_NOTARIZE=1 \
   SAFARI_NOTARY_PROFILE="AI-MarkDone-Notary" \
   SAFARI_APP_PATH="/path/to/AI-MarkDone.app" \
   npm run package:safari:dmg
   ```

   也可以使用 `APPLE_ID`、`APPLE_TEAM_ID`、`APPLE_APP_SPECIFIC_PASSWORD` 环境变量，但不要把这些值写进仓库、脚本或文档示例的真实内容里。

5. 发布前在一台未开发配置污染的 macOS 上打开 DMG，拖拽安装，启动 App，启用 Safari 扩展，完成 Required Manual Checks。

## Paid App Store Connect Path

App Store 付费版使用同一份 `dist-safari/` 和同一套功能代码。付费不是代码开关，而是在 App Store Connect 里设置价格。

1. 使用同一个版本号与构建输入：
   - `package.json.version`
   - `manifest.safari.json`
   - Xcode target 的 marketing version / build number
   - App Store Connect build metadata

2. 在 Xcode 中选择 App Store Connect 分发方式 Archive / Upload，上传到 App Store Connect。

3. 在 App Store Connect 中补齐：
   - Paid app price
   - App information and category
   - Privacy nutrition labels
   - Age rating
   - Screenshots and preview assets
   - Review notes, including Safari extension enablement instructions

4. 通过 TestFlight 或本机安装验证同一套 Required Manual Checks，再提交审核。

免费 DMG 与 App Store 付费版可以同时存在，但 release 记录里必须明确同一版本号对应的两个 Safari 渠道产物：一个 DMG 文件，一个 App Store Connect build。

## Required Manual Checks

- 安装与启用扩展
- 目标站点权限授权
- 浏览器图标点击打开/关闭主面板
- Reader 打开、复制、跳转
- 书签保存、删除、恢复与跨页 Go To
- 设置持久化与重载恢复
- 文本复制与 PNG 复制
- Save Messages 导出
- ChatGPT page bridge 数据读取与目录定位

## Current Boundary

`npm run build` 仍只覆盖 Chrome + Firefox。release 阶段先使用 `npm run release:verify` 生成三端 WebExtension 产物，再运行 `npm run package:safari:xcode` 生成 Safari Xcode 包装工程。DMG 需要签名后的 `.app`，所以 `npm run package:safari:dmg` 是 release 阶段的显式后置步骤，不进入普通开发构建。

## Apple References

- Safari Web Extension creation: https://developer.apple.com/documentation/safariservices/creating-a-safari-web-extension
- Safari Web Extension distribution: https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension
- Xcode distribution methods: https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases
- macOS notarization: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- App Store Connect pricing: https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/
