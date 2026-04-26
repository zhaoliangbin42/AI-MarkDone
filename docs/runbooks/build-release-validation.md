# Build And Release Validation Runbook

适用场景：`npm run build` 通过，但浏览器扩展实际加载、入口执行或发布前验证出现异常。

## Checks

1. 确认 `dist-chrome/` 与 `dist-firefox/` 产物都已生成；release 验证时同时确认 `dist-safari/`
2. 确认 manifest、icons、popup、locales、KaTeX 资源均已复制
3. 确认 entry format verification 已通过
4. 在目标浏览器中加载打包产物，验证 content 与 background 均可运行
5. Release 阶段额外确认 Safari 包装与分发产物：
   - `npm run package:safari:xcode` 已生成 `safari-build/`
   - 免费 DMG 由签名后的 `AI-MarkDone.app` 通过 `SAFARI_APP_PATH="/path/to/AI-MarkDone.app" npm run package:safari:dmg` 生成
   - App Store Connect 付费版使用同一版本、同一功能代码与同一 Safari WebExtension 输入
6. 若是 runtime 问题，优先检查：
   - `src/runtimes/content/entry.ts`
   - `src/runtimes/background/entry.ts`
   - `docs/architecture/BROWSER_COMPATIBILITY.md`

## Related Documents

- `docs/testing/E2E_REGRESSION_GUIDE.md`
- `docs/architecture/BROWSER_COMPATIBILITY.md`
- `docs/runbooks/safari-extension-release.md`

## Exit Criteria

- 问题被定位到构建产物、运行时入口或浏览器兼容边界之一
- 如涉及门禁缺口，补充到测试或文档中
- Release 验证时，Safari 的 WebExtension、Xcode wrapper、DMG 或 App Store Connect 阶段不能被静默跳过；缺证书、缺签名、缺账号时必须作为 blocker 记录
