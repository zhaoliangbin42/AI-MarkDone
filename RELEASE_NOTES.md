# Release Notes

## v4.2.1 (2026-04-27)

### Fixed
- Fixed ChatGPT directory positioning after recent ChatGPT page structure changes.

### How it works
- ChatGPT no longer consistently exposes the old turn container we used before.
- The directory could count messages from one source but locate them with another.
- The new flow builds one shared user-round position model from ChatGPT's structured turns.
- Clicks use that round's jump anchor; scrolling uses that round's visible user/assistant range.
- The directory keeps the active item nearby without taking over while you are using the rail.

## v4.1.2 (2026-04-22)

### Added
- Added a right-side ChatGPT conversation directory with live previews and direct jump actions.
- Reader Dynamic Annotations now support deleting existing annotations.

### Changed
- Reworked ChatGPT conversation discovery for the new incremental-loading page model so Reader and export can recover full-thread content again.
- Removed the old ChatGPT message folding feature because the current ChatGPT page dynamically loads and unloads message nodes.

### Fixed
- Fixed bookmark renaming from the bookmarks panel.
- Fixed ChatGPT bookmark save, highlight, and jump positioning under incremental loading.
- Fixed Reader prompt insertion from the send box.

## v4.1.1 (2026-04-20)

### Fixed
- Fixed Reader annotation insertion from the send popover so choosing an annotation prompt no longer closes the popover before the compiled text is inserted.

## v4.1.0 (2026-04-19)

### Added
- Added Dynamic Annotation in Reader so you can mark exact passages, attach revision notes, and export them as structured follow-up input.
- Added dedicated Changelog, FAQ, and About pages inside the bookmarks panel.

### Changed
- Removed the standalone source panel and moved source copying directly into Reader.
- Reader copy now preserves formulas, code blocks, tables, images, and other closed Markdown units as source instead of flattening them into rendered text.

### Improved
- Expanded the Reader-centered workflow so source copy, annotation export, and prompt reuse now stay in one place.

## v2.0.0 (2025-12-20)

### 改进
- 统一注入 UI 的样式 tokens，减少内联样式覆盖
- 书签面板相关弹窗样式与按钮状态一致化

### 修复
- 深色模式下重复书签对话框与导出确认按钮显示问题

## v1.0.0 (2025-12-09)

### 改进
- 列表缩进改为2空格,兼容更多Markdown编辑器
- Preview全屏模式优化阅读体验
- 优化数学公式点击复制功能

### 修复
- 修复流式输出后工具栏问题
- 修复字数统计显示错误
- 修复代码块识别问题

---

## v0.5.0 (2025-12-08)

初始发布版本
