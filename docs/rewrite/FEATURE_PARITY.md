# Feature Parity Backlog (Authoritative)

目的：定义“重写要实现什么”。该清单是重写过程的功能边界与验收参考，完成一个条目必须同时具备测试与回归证据。

说明：具体平台覆盖与支持状态以 `docs/antigravity/platform/CAPABILITY_MATRIX.md` 为准；这里定义重写阶段的交付顺序与验收粒度。

---

## 1. 全局能力（跨平台）

- [x] Toolbar 注入与基础操作（出现/消失、按钮状态、主题同步）
- [x] Markdown 提取与复制（含噪声过滤、normalizeDOM 前处理）
- [x] LaTeX 公式提取与复制（KaTeX/annotation 路径与回退）
- [x] Code block 提取与复制（语言识别与稳定输出）
- [x] 表格提取/渲染（HTML→Markdown 规则一致）
- [ ] 字数统计（CJK 感知）
- [ ] i18n（语言选择/迁移/无 raw key）

---

## 2. Reader（预览/分页/复制/发送）

- [x] ReaderPanel 打开/关闭（稳定生命周期）
- [x] 分页导航（Prev/Next + index/total）
- [x] 渲染链路（markdown/code/math/table 混排）
- [x] Copy（从 Reader 复制 markdown）
- [ ] Message sending（输入框同步/发送按钮模拟/完成检测）

---

## 3. Bookmarks（保存/管理/导入导出/恢复）

- [ ] 保存书签（含 context-only 选项）
- [ ] 书签面板（搜索/筛选/排序/批量操作）
- [ ] 文件夹树（创建/重命名/移动/删除/判重）
- [ ] 导入导出（大文件/异常文件/部分失败恢复）
- [ ] Storage 生命周期可靠性（幂等、迁移、回滚/修复）

---

## 4. 平台特性（按需）

- [ ] ChatGPT Folding（折叠模式、dock、健康降级）
- [ ] Gemini Deep Research 处理

---

## 5. Release & Compatibility

- [ ] Chrome MV3 build 产物一致性
- [ ] Firefox MV2 build 产物一致性
- [ ] supported hosts 一致性（manifest / background / popup links）
- [ ] web_accessible_resources 完整性（KaTeX assets/locales/icons）
