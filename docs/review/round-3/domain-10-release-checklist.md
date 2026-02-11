# Domain 10 Checklist：跨浏览器兼容与发布工程

> 目标：把“能 build”升级为“可发布且可回归”。

## A. Manifest 结构一致性（自动）

- [x] `npm run test:release` 通过
- [x] Chrome 使用 MV3 且仅包含 `background.service_worker` + `action`
- [x] Firefox 使用 MV2 且仅包含 `background.scripts` + `browser_action`
- [x] 两端 `web_accessible_resources` 资源列表一致
- [x] 两端 icon 路径与尺寸键一致

## B. Host 与入口一致性（自动）

- [x] Chrome/Firefox `SUPPORTED_HOSTS` 完全一致
- [x] popup 支持平台链接被 `SUPPORTED_HOSTS` 全覆盖
- [x] 四主平台（ChatGPT/Gemini/Claude/DeepSeek）存在且可点击

## C. 构建产物一致性（自动）

- [x] `npm run build:chrome` 通过
- [x] `npm run build:firefox` 通过
- [x] `dist-chrome/background.js` 无顶层 `import`
- [x] `dist-chrome/content.js` 无顶层 `import`
- [x] `scripts/verify-extension-entry-format.sh` 两端检查通过

## D. 发布前人工抽检（手工）

- [ ] Chrome 加载 unpacked 后无启动报错
- [ ] Firefox 临时加载后无启动报错
- [ ] 在四个平台页面点击扩展图标行为一致
- [ ] popup 文案与链接平台集合一致
