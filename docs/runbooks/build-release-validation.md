# Build And Release Validation Runbook

适用场景：`npm run build` 通过，但浏览器扩展实际加载、入口执行或发布前验证出现异常。

## Checks

1. 确认 `dist-chrome/` 与 `dist-firefox/` 产物都已生成
2. 确认 manifest、icons、popup、locales、KaTeX 资源均已复制
3. 确认 entry format verification 已通过
4. 在目标浏览器中加载打包产物，验证 content 与 background 均可运行
5. 若是 runtime 问题，优先检查：
   - `src/runtimes/content/entry.ts`
   - `src/runtimes/background/entry.ts`
   - `docs/architecture/BROWSER_COMPATIBILITY.md`

## Related Documents

- `docs/testing/E2E_REGRESSION_GUIDE.md`
- `docs/architecture/BROWSER_COMPATIBILITY.md`

## Exit Criteria

- 问题被定位到构建产物、运行时入口或浏览器兼容边界之一
- 如涉及门禁缺口，补充到测试或文档中
