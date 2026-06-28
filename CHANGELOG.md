# Changelog

All notable changes to AI-MarkDone will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Bookmarks: Added ChatGPT page-level bookmarks from the lower-right page controls. Page bookmarks save the current conversation URL and title, appear in the existing bookmark manager, and can be filtered separately from message bookmarks.
- Prompts: Added a unified local Prompt Library with ChatGPT composer `\` autocomplete, four default prompts for Humanizer Skill polishing, prompt optimization, Skill Creator generation, and natural translation, a lower-right Prompts button, shared Reader prompt management, safe Reader prompt migration, and Reader annotation export that reuses the same prompts.
- Prompts: Added a portable JSON Prompt Library model and safe merge planner for future manual backup or sync work, without adding Prompt cloud sync in this version.
- Settings: Added an optional ChatGPT “Enter inserts a new line” toggle. When enabled, plain Enter creates a newline in the ChatGPT composer, while the send button and Cmd/Ctrl + Enter still send.
- Settings: Added a ChatGPT chat-width slider that can widen the conversation area from normal up to 200%.
- Settings: Added a slider for ChatGPT directory right spacing so users can add extra room when browser scrollbars overlap the right-side rail.
- Settings: Added a Buttons & Entrypoints subpage that centralizes all visible button toggles, including message toolbar actions, lower-right ChatGPT buttons, and formula hover actions.
- Settings: Added Reader workflow controls to the bookmark settings page while keeping Reader-only display controls inside the Reader settings dialog.
- Formula: Added separate formula source format choices for clicking a single formula and for copying or saving Markdown source, with Markdown dollar, LaTeX bracket, raw LaTeX, equation, and equation* formats.

### Changed
- Bookmarks: Removed the obsolete platform filter from the bookmarks manager and kept search, page/message filtering, sorting, and import/export actions on one toolbar row.
- ChatGPT: The AI-MarkDone directory rail now defaults on and can still be turned off from Settings.
- Prompts: Prompt triggers are now saved and shown as plain text while still matching ChatGPT composer `\` autocomplete.
- Prompts: Built-in default prompts are now fixed English seed records, including the OpenAI Codex Skill Creator GitHub reference for the Skill Creator default.
- Prompts: Disabled prompts now stay in the manager, keep their trigger reserved, and are hidden from composer autocomplete and the Reader prompt picker until re-enabled.
- Prompts: The Prompt manager is wider and taller, keeps editor actions visible with an internal scroll area, supports bounded prompt-content resizing, supports page-session drag placement, and keeps drag-handle ordering reused by autocomplete and Reader prompt lists.
- Prompts: Unmodified built-in prompts stay managed and can receive default seed updates, including same-version pre-release text changes, while edited defaults become user-owned prompts and are no longer overwritten.
- Prompts: The Skill Creator default now points to the full OpenAI Codex sample Skill package and asks for one self-contained code-block prompt that embeds every generated Skill file, while legacy Reader migration keeps the point-by-point annotation prompt without restoring the other untouched Reader defaults.
- Reader: The Reader content width control is now a bounded slider instead of a numeric field.
- Formula: Markdown copy and Markdown export now apply the selected formula source format at the source-output boundary without changing Reader display or PDF/PNG rendering.

### Fixed
- Prompts: The Settings, Reader, Detached Reader, and lower-right ChatGPT entries now open the same Prompt manager, row clicks edit prompts consistently, stale legacy Reader prompt counts are gone, and the manager stays fixed-width with internal scrolling so it is not clipped by the bottom of the page or by a resized editor textarea.
- Prompts: Reader annotation copy and Reader Send popover comment insertion now fetch enabled prompts directly from the shared Prompt Library on demand; legacy `reader.commentExport.prompts` is migration-only and no longer acts as a runtime prompt snapshot.
- Prompts: Improved ChatGPT composer prompt autocomplete positioning so the suggestion popover anchors to the current text cursor and keeps short lists close to the cursor.
- Prompts: ChatGPT composer `\` autocomplete now claims Enter as prompt confirmation as soon as the candidate box is open, without requiring the Enter-newline setting.
- Prompts: Fixed the Prompt manager appearing at the top-left of ChatGPT during page load when theme settings sync before the composer is ready.
- ChatGPT: Lower-right page controls now follow live light/dark theme updates, keeping button icons readable in dark mode.
- Reader: Reader and Detached Reader Send popovers now support the shared `\` Prompt autocomplete, with suggestions anchored to the textarea cursor and detached when the popover closes.
- Reader: Detached Reader sending now uses the full SendPort flow, prepares the source ChatGPT page before submit, and activates the source tab before triggering the official send action.
- Reader: Selecting text inside code blocks, inline code, or tables now keeps copy, annotations, and sticky pins limited to the exact selected text instead of expanding to the whole Markdown block.

## [4.6.0] - 2026-06-18

大家好啊，这次更新酝酿了很久，也做了一次比较大幅度的升级。

这段时间我一直想解决一个很具体、也很烦人的问题：ChatGPT 长对话真的太容易卡了。我自己是 Pro 用户，用 Pro 模型时，每一条消息都很长。实际用下来，超过三条长消息之后，网页就已经明显卡得动不了了；哪怕打开阅读器，也只能缓解，不能从根本上解决。

从原理上讲，问题并不神秘。ChatGPT 页面本身要渲染非常重的 Markdown，尤其是公式很多的时候，渲染压力会非常大。只要你还在 ChatGPT 页面里操作，不管是滚动、点击、复制，还是打开插件界面，都多少会被这个页面的渲染压力拖住。ChatGPT 官方其实也做过优化。大概从 4 月底开始，网页逐渐变成增量加载模式，旧消息会被适当卸载，以降低整体渲染压力。但即便如此，长消息本身带来的渲染压力还是没有办法彻底消失。

所以这次我换了一个思路：既然 ChatGPT 页面本身卡，那能不能跳出这个页面？

### 原理解析

AI-MarkDone 原本就有阅读器能力：在 ChatGPT 页面中发现消息、提取内容、整理结构，然后在阅读器里重新渲染。既然已经能提取消息，那么我就在想，能不能把这份阅读器内容放到一个独立的扩展页里打开？

查了一圈浏览器扩展文档之后，我发现这是可行的。扩展页可以通过浏览器 runtime 和原始 ChatGPT 页面建立桥接。也就是说，独立页负责渲染一个完整的阅读器，原 ChatGPT 页面负责提供内容、发送、刷新、定位等能力；两边通过浏览器内部通信保持连接。

这样一来，阅读本身就不再受 ChatGPT 官方网页的 DOM 和 Markdown 渲染压力影响。独立阅读器跑在扩展自己的页面里，页面更干净，渲染压力也更可控。你仍然可以刷新、发送、定位原文，但主要阅读体验已经从卡顿的 ChatGPT 页面里抽离出来了。

当然，真正做起来并不是把阅读器搬过去这么简单。因为涉及原页面和独立页之间的桥接、会话、刷新、发送、定位、书签、主题、公式样式等一整套对齐，所以这次重写和补齐了不少底层链路。既然都叫阅读器了，我也顺手把一些原本藏在设置里的阅读功能搬回阅读器内部：现在可以直接调节字号、宽度和显示方式。

说实话，我现在自己更喜欢在阅读器里继续对话。它既能避开长网页卡顿，又有注释、Sticky、复制、书签等一堆顺手的小功能。还没试过阅读器的朋友，尤其是经常读长对话的朋友，真的建议试试。

### 隐私说明

AI-MarkDone 当前没有任何联网功能，代码也全部公开在 GitHub 上。如果你不放心，可以把 GitHub 链接发给 ChatGPT，让它帮你一起看代码。

插件里的内容发现链路，本质上是为了复制 Markdown、导航栏、阅读器、书签和导出这些功能服务的。只有能读取当前页面里的内容，才可能支撑这些能力。新的独立阅读器也是一样：它是在浏览器管理的扩展页里运行，通过浏览器内部通道和原 ChatGPT 标签页通信，不会把内容传到任何外部服务器。关闭独立页后，这次打开的会话也就结束了，不会额外长期保存。

### 也介绍一下我的 iOS App：好友迹

接下来我要图穷匕见了。现在已经是毕业季，很多朋友可能都要各奔东西。我自己一直希望有一个方便的地方，能够把朋友的家乡、工作地点、常去的城市记录下来。正因为这个真实需求，我开发了一个 iOS App，叫“好友迹”。

它的定位是好友地图通讯录。你可以在里面创建人物，为每个人添加很多地点，并给地点打上标签。这些人和地点会在地图上展示出来。每次和朋友聊天聊到某个地方，就顺手记一下。久而久之，地图会一点点丰满起来，你会发现，原来身边这么多朋友已经散落在天南地北。

以后再次见面时，你不会因为忘记 TA 的家乡、学校或工作地点而尴尬；到了某座城市，打开地图，也许就会想起某个朋友正在这里落脚，不如约着见一面。软件整体非常容易上手，也尽量做得简洁好看。

![好友迹 - 好友地图通讯录](./public/icons/mappamory-changelog-4.6.0.png)

这个 App 刚刚上架。**在 2026 年 6 月 30 日之前下载的朋友，可以联系我的小红书，我会为每人赠送一个一年的兑换码。** 也希望大家多提意见、多多支持、多多宣传。我真的很喜欢大家一起群策群力，把一件事情越做越好的感觉。

另外也说明一下：**好友迹不是社交 App，不需要联网，也不需要账号。所有记录下来的内容都只会保存在本地。** 感兴趣的朋友欢迎下载体验。

**下载地址：**[**https://apps.apple.com/cn/app/mappamory/id6769453796**](https://apps.apple.com/cn/app/mappamory/id6769453796?l=en-GB)

再次感谢大家。AI-MarkDone 不会打任何第三方广告，但我自己的作品还是想在这里宣传一下，哈哈哈，~\(≥▽≤)/~，希望没有打扰到大家。

### 每日 Tips

- 页面内支持使用左右方向键切换上一条 / 下一条消息，前提是光标没有停在输入框里。简单说，先点击页面空白处，再按左右方向键即可。如果不能切换，可以在设置里单独开启。
- 当前绝大多数功能都可以在设置里单独开启或关闭。如果你觉得某个功能打扰到你，可以打开设置，找到对应开关后关闭。
- 你的评分和反馈是我持续完善插件的动力，欢迎多多支持，也欢迎继续交流。插件也有小红书用户群，欢迎在“关于我”里面扫码关注我，并加入群聊，保持后续交流。

### Added
- Reader: Added a detached ChatGPT Reader tab that reuses the existing Reader rendering and content source while routing refresh, send, locate, and close actions back through the original ChatGPT tab.
- Reader: Added a lower-right Split View button for detached Reader, a first-use experimental notice, fullscreen default opening, Reader-local display settings, live Reader font-size controls, and centered panel resizing.
- Settings: Added a master Message Toolbar toggle that removes existing per-message toolbar hosts and stops future toolbar injection when disabled.
- Formula: Added a setting for formula click-copy to include Markdown math delimiters by default, copying inline formulas as `$...$` and display formulas as `$$...$$`.
- Formula: Added a setting for single-formula PNG/SVG export font size, defaulting to 36px for consistent paper-ready output.

### Changed
- Reader annotation export now uses a multiline template with explicit `【选中文字】` and `【用户注释】` placeholders instead of separate prompt-1/2/3 fields, while keeping a separate user prompt header for LLM-ready output.
- Formula: Changed single-formula PNG/SVG export to capture the already-rendered page formula DOM first, matching page-rendered Chinese underbraces and other complex formulas while keeping MathJax as a fallback and for MathML.
- UI Contracts: Promoted transient-root outside-click handling into a shared UI contract and introduced a reusable overlay session wrapper, then moved Save Messages and shared modal flows onto the same overlay slot model.
- Modal Stability: Mounted shared modals into explicit overlay modal roots and switched them onto the shared keyboard-scope stack so nested dialogs close and restore focus more reliably.
- Sending/Toolbar: Moved Send Modal back onto the shared overlay-host route and renamed toolbar pseudo tokens to the formal `--aimd-toolbar-*` component contract without changing placement behavior.
- UI: Rebalanced panel typography so settings groups, sponsor sections, bookmark folders, reader content, toolbar stats, send status, and folding controls follow a clearer shared size hierarchy.

### Fixed
- ChatGPT: Removed component block wrappers such as writing blocks from Reader, copy, export, and bookmark content while preserving the actual message body.
- Bookmarks/Modal: Added shared input-event isolation for rename, confirm, and save dialogs so host-page handlers are less likely to intercept modal interactions.
- Bookmarks: Batch delete now removes checked folders themselves, along with their descendant folders and saved items.
- Bookmarks: Fixed the ChatGPT folding settings dropdown so clicking its trigger again closes it inside the shadow-hosted panel, and corrected the expanded-count stepper arrows to use the proper up/down affordances.
- Bookmarks: Brightened dark-mode platform toggles and added clearer spacing between platform icons and labels in settings so the platform section reads more cleanly against the dark panel surface.
- Bookmarks: Fixed the Sponsor GitHub star CTA to render as a real external link with the expected target and rel attributes instead of relying on a button-only click action.
- Formula: Fixed formula SVG/PNG copy and save for formulas containing Chinese text by stabilizing fallback text fonts and SVG dimensions before rasterization.
- Formula: Made single-formula PNG copy and save more reliable for large formulas by scaling the one-shot canvas output within browser-safe limits without slicing or stitching formulas.
- Formula: Fixed SVG/PNG copy for formulas with stretch glyphs such as underbraces and NewCM script/calligraphic glyphs by preserving nested SVG glyphs inside the single exported formula SVG.
- Reader: Kept detached Reader sessions in extension session storage only, avoiding persistent local storage for conversation snapshots.
- Reader: Closing a detached Reader from inside the Reader page now cleans up its session and closes the detached extension page.
- Reader: Detached Reader now syncs the extension page theme and token overrides before rendering, and only stores first-use notice acknowledgement after the detached session is created successfully.
- Reader: Formula rendering now registers KaTeX font faces at the document layer while keeping KaTeX layout CSS inside the Reader shadow surface, so detached Reader pages do not lose math styling when the source ChatGPT page is no longer providing global formula fonts.
- Reader: Detached Reader send now uses the same tokenized SendPopover as the in-page Reader instead of a native browser prompt.
- Reader: Detached Reader send now opens through the same SendPort draft hydration path as the in-page Reader, including async source draft loading without overwriting local typing.
- Reader: Detached Reader send now opens with the current ChatGPT composer draft from the source tab, matching the in-page Reader send popover.
- Reader: Detached Reader send now writes cancelled draft edits back to the source ChatGPT composer and arms the same send-position restore before submitting.
- Reader: Detached Reader now shows the same bookmark action as the in-page Reader, reuses the bookmark save dialog, and can locate the source ChatGPT message without closing the detached tab.
- Reader: The in-page Reader header refresh now uses the same fresh Reader content source as detached Reader refresh, while keeping the user on the matching current page when possible.
- Reader: Fullscreen Reader now opens with a fade-only motion instead of briefly inheriting the centered panel transform from the top-left area.
- Reader: Fixed external-open affordances so the header action now hides when no conversation target exists, and rendered markdown links open with explicit safe external-link attributes.
- ChatGPT: Hiding Previous/Next message buttons no longer hides the detached Reader Split View entry.

## [4.5.1] - 2026-06-07

### Added
- Bookmarks panel: Added a bottom Feedback tab that groups the support email actions and the AI-MarkDone website link.
- Formula: Restored formula copy on Gemini, Claude, and DeepSeek pages. These hosts now support single-formula LaTeX click-copy and any formula PNG/SVG/MathML copy/save actions the user has enabled.
- Settings: Added per-platform toggles for Gemini, Claude, and DeepSeek formula copy.
- ChatGPT: Restored the optional right-side directory rail, default off, with Settings controls for display mode and prompt labels; enabling the AI-MarkDone rail also hides ChatGPT’s own conversation navigation when detected.

### Fixed
- Firefox: Fixed ChatGPT snapshot bridge transport so Reader, copy, export, and bookmark saves can read ChatGPT content across Firefox's content-script/page-script boundary.
- Reader: Cleaned ChatGPT snapshot-only entity and GenUI math annotations before Reader, copy, export, and bookmark content are rendered.
- Formula: Restored the active extension action state on Gemini, Claude, and DeepSeek so the extension icon no longer falls back to the unsupported-page popup.
- Formula: Kept DeepSeek think-content formulas outside the restored formula copy roots.
- Formula: Reconnected Gemini, Claude, and DeepSeek to their legacy formula parser chain for formula recognition, LaTeX extraction, and display-mode detection.
- ChatGPT: Improved official conversation navigation hiding by targeting ChatGPT’s delayed fixed right child inside the conversation highlight root, with a CSS guard plus observer refresh instead of broad navigation semantics.

### Changed
- ChatGPT: The directory rail no longer owns lower-right Previous/Next controls; adjacent message stepping remains in the standalone message stepper.

## [4.5.0] - 2026-06-05

### Added
- ChatGPT: Added a lightweight lower-right message stepper with Previous/Next controls, now with a Settings toggle to hide the buttons, plus optional Left/Right arrow-key message navigation that stays out of text inputs and can be disabled separately.
- Google Drive Backup: Reworked authorization around the browser's real OAuth capability. Google Chrome uses browser-managed `getAuthToken` with the manifest Chrome Extension OAuth client; WebAuth-compatible browsers use `launchWebAuthFlow` with the configured Web OAuth client and exact extension redirect URI.
- Google Drive Backup: Kept refresh tokens out of extension storage; browser identity handles the long-lived authorization experience, and short-lived access tokens are cached only until expiry for service-worker recovery.
- ChatGPT: Added an optional Settings toggle to restore your reading position after sending a message from older conversation history. The restore guard only runs after an intentional send and stops on manual scrolling or explicit navigation.
- Added an optional Google Drive bookmark backup entry under Settings → Data Management, with browser-extension OAuth configuration, resumable verified snapshot upload, and safe-merge restore.

### Fixed
- ChatGPT: Improved recovery after Chrome suspends the extension background or restores long-idle tabs. The extension icon now uses a lightweight ping before toggling the panel, and stale tab lifecycle errors are handled without unchecked runtime errors.

### Changed
- AI-MarkDone now focuses on ChatGPT as the only active AI page runtime. Gemini, Claude, and DeepSeek page injection, host permissions, adapters, settings toggles, popup links, and copy parity fixtures have been retired.
- Existing saved bookmarks and backups from Gemini, Claude, and DeepSeek remain available in the bookmarks library for viewing, search, page/message filtering, export, local import, and Google Drive backup/restore.
- Save Messages now opens with only the current message selected by default instead of selecting every message in the conversation.
- ChatGPT: Temporarily retired the AI-MarkDone right-side directory rail because ChatGPT now provides native conversation navigation; Reader locate and bookmark navigation still use the shared positioning helper.
- Google Drive backup now gives OAuth sign-in and Drive backup/restore requests longer RPC timeouts so the UI does not report a timeout while the Google authorization flow is still in progress.
- Google Drive backup now shows immediate staged progress with a timeout-budget countdown, uses a custom long-name-safe restore picker, and attempts to delete a just-created Drive file when upload verification fails.
- Google Drive backup is now labeled experimental, confirms before starting OAuth, recommends exporting a local backup first, keeps the gear menu focused on status, test connection, privacy, and cloud backup management, reuses the local import merge review for Drive restore preview, and moves user-managed Drive backup files to trash instead of permanently deleting them.
- Google Drive backup now uses a split official OAuth chain: Google Chrome uses the manifest Chrome Extension OAuth client with browser-managed identity, WebAuth-compatible browsers use WebExtension `launchWebAuthFlow` with the Web OAuth client, and Safari stays hidden until a verified auth path exists.

## [4.4.6] - 2026-05-28
### Fixed
- ChatGPT Directory hover previews now respond more smoothly when moving through long conversations.
- Toolbar Copy now uses the same content path as Reader Copy, fixing cases where the toolbar copy button could fail in the previous release. Thanks to Xiaohongshu user @momo.

## [4.4.5] - 2026-05-24
### Added
- Reader: Added a temporary Sticky workspace for selected Markdown excerpts, with wider resizable page-lifetime blocks that can be reordered or deleted while paging through long responses or closing and reopening Reader.
- Reader: Added Up and Down arrow key scrolling inside Reader messages. Thanks to Xiaohongshu user @如果你也对吃感兴趣.
- Formula hover actions can now copy a single formula as MathML, using the existing LaTeX extraction path and MathJax renderer for Office-friendly equation paste workflows.
- UI feedback now uses a shared tokenized tooltip and top-center toast layer for clearer hover labels and short operation results.

### Changed
- Reader: The one-time update changelog notice now also appears when opening Reader, sharing the same acknowledgement state as the bookmarks panel so users only see it once per version.
- Formula: Formula image hover actions now default to off and can be enabled from Settings. Existing stored formula action choices are preserved during migration.
- Safari: App Store builds now omit the sponsor tab, payment QR assets, sponsor copy, social follow card, and binary PNG/SVG clipboard copy actions while Chrome and Firefox keep the existing support surfaces.
- About: Added a dedicated support contact card with an email feedback link and copy-email action; Safari keeps this support surface while sponsor/social surfaces remain hidden.

### Fixed
- ChatGPT Directory: Reduced startup and hydration-time page stalls by making the directory use passive snapshot updates, filtered DOM mutation rebuilds, and no-op rail rendering when the conversation index has not changed.
- ChatGPT Directory: Restored complete prompt labels for virtualized middle rounds by running a bounded on-demand snapshot refresh only when DOM-discovered directory items still show fallback `Message N` labels.
- ChatGPT: Reduced resize jank by temporarily suspending AI-MarkDone directory and action-row toolbar chrome while the browser viewport width is being dragged, then restoring state after resize settles without rebuilding or collapsing toolbar layout.
- ChatGPT: Improved bottom toolbar stability when the official action row hydrates after the assistant message, avoiding routine full-page rescans for that case.
- Copy Markdown: Fixed an issue where links inside code blocks could be treated as citation noise and removed. Thanks to Email user @童硕.

## [4.4.1] - 2026-05-15
### Added
- Settings: Added a global interface font size control in Advanced Settings, limited to 12px–20px with stepper buttons and live token-based refresh across extension surfaces.
- Settings: Added theme color swatches in Advanced Settings, with live token-based refresh for primary actions, links, focus rings, selected states, and the unsupported-page popup.
- Settings: Added a Reader toggle to hide the right-side heading outline while keeping Markdown rendering unchanged.
- ChatGPT Directory: Added a tokenized rainbow marker for bookmarked messages in the right-side conversation directory.
- 导航栏中，对已经加入书签的消息，会有不同的颜色以作区分，方便快速定位书签消息。
- Reader: Added an internal heading outline for long Markdown responses so readers can jump within the current Reader page more easily. Thanks to Xiaohongshu users @Hiahiaaa and @小红薯67542EF1.

### Changed
- UI: Streamlined the style system so extension surfaces share a more consistent visual language and tokenized customization path.

### Fixed
- Reader: Limited long-conversation pagination to a compact window with ellipsis gaps, preventing the footer pager from crowding or being clipped.
- Reader: Refreshes the latest ChatGPT Reader page from the live conversation snapshot when opened or revisited, while keeping earlier Reader pages frozen for stable reading.
- Reader: Preserved rendered formulas inside HTML table cells when converting page content back to Markdown, so Reader can render those table formulas with KaTeX instead of flattening them to visible text.

## [4.4.0] - 2026-05-12
### Added
- Export: Copy as PNG now replaces the generic working status with a progress panel that shows render progress and a cancel button.
- Export: Save Messages PNG export now shows both the current message render progress and the total export progress while exporting multiple messages.

### Changed
- Export: Copy as PNG and Save Messages PNG export now split dense rendered content by DOM complexity as well as height, reducing long browser stalls on messages with many formulas, code blocks, tables, or images. Thanks to GitHub user @LTong-g.

### Fixed
- Export: Closing the Save Messages dialog during PNG export now cancels the in-progress export instead of only hiding the dialog.
- Reader: Fixed ChatGPT content discovery after recent page structure changes so Reader and export can recover more than the last few visible messages again. Thanks to Xiaohongshu users @Jim and @全是恶意.

## [4.3.1] - 2026-05-07

### Fixed
- Firefox: Fixed toolbar insertion failures on ChatGPT. Thanks to Xiaohongshu user @圆桶烤肉拌厚切三文鱼.
- Reader: Further reduced hyperlink and file citation noise in copied and exported content. Thanks to GitHub user @LTong-g.

## [4.3.0] - 2026-05-05

### Added
- Formula hover actions can now copy or save a single formula as PNG or SVG, making it easier to prepare presentation slides without rebuilding formulas by hand.
- Settings: Added formula PNG/SVG copy and save controls under Toolbar & Page Actions.
- Reader annotations can now place the selected user prompt before or after copied annotations. Thanks to Xiaohongshu user @momo.
- ChatGPT directory expanded mode can now show the first 15 and last 15 prompt characters from Settings, helping distinguish messages when many prompts start the same way.
- Settings: Grouped toolbar, formula, and export controls together and added a v4.5.0 platform support notice for Gemini, Claude, and DeepSeek.

### Fixed
- Export: Fixed a case where numbered formulas could overlap text in PDF exports. Thanks to GitHub user @LTong-g.
- ChatGPT: Improved message bottom toolbar injection stability. Thanks to Xiaohongshu user @去码头整点橙汁.

## [4.2.3] - 2026-04-29

### Added
- Settings: Added a Reader panel width control at the bottom of Advanced Settings for users who want to tune the reading layout. Thanks to Xiaohongshu user @Z..（研一版）.
- ChatGPT: Added previous and next message shortcuts in the lower-right page controls for faster conversation navigation. Thanks to Xiaohongshu user @特立独行的猫之工程师.

### Fixed
- Reader: Fixed duplicate `Copy annotations` buttons in the Reader header. Thanks to GitHub user @LTong-g.
- Export: Fixed overlapping numbered formulas in PDF exports. Thanks to GitHub user @LTong-g.

## [4.2.2] - 2026-04-27

### Fixed
- Reader: Removed ChatGPT link citation noise from extracted Markdown so copied Reader content is cleaner. Thanks to GitHub user @LTong-g.
- ChatGPT: Further improved right-side directory stability by using DOM-discovered user rounds as the shared source for prompts, anchors, and navigation. Thanks to GitHub user @LTong-g.
- ChatGPT: Fixed Deep Research content discovery so the right-side directory can discover the full round list and jump correctly. Reader content for Deep Research remains empty when ChatGPT only exposes research skeleton nodes, because the official Deep Research reading experience is already strong; feedback is welcome if dedicated Reader support is needed.
- Reader: Fixed a v4.2.1 regression where ChatGPT Reader content could fail to load after DOM text fallback flattened formulas and Markdown structure. Thanks to Xiaohongshu user @小红薯67542EF1.

## [4.2.1] - 2026-04-27

### Fixed
- ChatGPT: Fixed right-side directory positioning after recent ChatGPT page updates. Directory clicks now use adapter-owned user-round anchors, and scroll highlighting follows the visible user/assistant round range instead of mixing message counts with separate DOM lookup rules.

## [4.2.0] - 2026-04-26

### Added
- Release: Added Safari free DMG packaging guidance and an explicit `package:safari:dmg` command for signed wrapper apps, alongside the existing Safari App Store Connect path.
- Export: Added PNG export to Save Messages. A single selected message downloads as one PNG, while multiple selected messages render one PNG per message and download together as a ZIP.
- Export: Added in-dialog PNG export progress feedback so long-running multi-message renders now report the current step and item count instead of looking stalled.
- Settings: Added a global PNG export width preference with `Mobile`, `Tablet`, `Desktop`, and `Custom` options in the Bookmarks panel Settings tab.
- Settings: Added a global PNG image scale preference so users can tune export sharpness up to a guarded 3x pixel ratio.
- Settings: Added ChatGPT directory controls so users can hide the right-side directory or switch between compact preview and expanded list modes.
- Toolbar: Added `Copy as PNG` as a hover secondary action above the message `Copy Markdown` button, so the current message can be copied directly to the clipboard as a PNG without opening export flows.

### Changed
- Export: PDF and PNG now share the same sanitized Markdown document builder and align their Markdown presentation with the Reader theme, while keeping PDF and PNG media-specific rendering rules separate.
- Export: Save Messages now consumes the global PNG width preference from Settings instead of editing PNG width inside the export dialog.
- Export: Long PNG rendering now caps the effective clarity ratio by a total pixel budget so very tall images no longer request impractically large canvases.
- Export: Tall PNG rendering now splits large message DOM into conservative 2000px block-level chunks before stitching the final image, avoiding oversized SVG data URLs.
- Export: The default PNG image scale is now 1x, while Settings clearly keeps 3x as the maximum manual scale.
- ChatGPT: Reduced live directory refresh polling and cached failed backend conversation payload lookups so unavailable payload endpoints no longer get retried every second.

### Fixed
- Bookmarks: Folder and bookmark title validation now reports specific naming problems, including forbidden title characters, slash-separated single folder names, traversal names, and control characters.
- ChatGPT: Reader now ignores hidden, tool, and non-final structured messages inside assistant turns so uploaded file context is not exposed as assistant markdown.
- ChatGPT: Reader now opens on the message that launched it instead of falling back to the last message when DOM and payload message ids differ.
- ChatGPT: Conversation snapshots now refresh on conversation route changes and conversation payload fetches, improving full-history recovery after in-app navigation.
- ChatGPT: Conversation discovery now prefers backend conversation payloads and platform-owned turn groups before falling back to assistant-node scanning, improving Reader, directory, navigation, and export coverage across varied ChatGPT page shapes.
- ChatGPT: Directory rail rows now keep their index, label, and active marker inside a stable grid when long histories introduce vertical scrolling.
- ChatGPT: Directory jumps now re-align after host-side hydration shifts while yielding to manual user scrolling or pointer input.
- ChatGPT: Reader, Copy Markdown, and Save Messages now remove source citation controls, citation markers, and hyperlink URLs from extracted assistant markdown.
- ChatGPT: Save Messages export now uses the same Reader content source as Reader, so exported content no longer depends on the currently hydrated DOM range.
- Export: PNG rendering now caps the effective pixel ratio before hitting browser canvas limits, making long-image quality degradation explicit and stable instead of relying on renderer auto-scaling.
- Reader: Source-aware selection now preserves Markdown for fully selected headings, list items, blockquotes, and dividers while keeping partial text selections precise.
- Reader: Made closed-unit annotation best-effort so structural selection metadata can no longer interrupt rendered Markdown, formulas, or block content in the Reader.
- Toolbar: Copy Markdown tooltips now render in a toolbar-owned body-level layer so adjacent messages cannot cover them.
- Export: PNG formula rendering now embeds bundled KaTeX fonts as data URLs instead of relying on extension font URLs inside the rendered image.
- Safari: Page-level header brand icon injection is disabled on Safari while Chrome and Firefox continue to use the bundled PNG logo.
- Toolbar: Copy as PNG now downloads the rendered PNG when the browser rejects image clipboard writes, preserving the rendered output instead of ending with a generic failure.
- Toolbar: Kept the `Copy as PNG` hover action icon-only with a 30px rounded-square target, local tooltips, and a small hover bridge so moving from Copy to PNG does not collapse the action.

## [4.1.2] - 2026-04-22

### Added
- ChatGPT: Added a right-side conversation directory with live previews and direct jump actions for users who prefer staying on the native page.
- Reader: Restored full-thread discovery on ChatGPT by redesigning the content discovery engine for the new incremental-loading page model.

### Changed
- ChatGPT: Removed the old message folding feature after the platform switched to incremental loading and inactive-node unloading, making the old fold-bar path both less necessary and less stable.

### Fixed
- Reader: Dynamic Annotations now support deleting existing annotations.
- Bookmarks: Restored bookmark item renaming through the shared prompt dialog and existing save path.
- ChatGPT Bookmarks: Fixed bookmark save, highlight, and jump positioning on dynamically loaded ChatGPT conversations.
- Reader and Sending: Fixed prompt insertion inside the Reader send box.
- Bookmarks: Improved jump-to-original positioning on ChatGPT by routing ChatGPT bookmark jumps through the same directory anchor path used by the right-side conversation directory.

## [4.1.1] - 2026-04-20

### Fixed
- Sending: Fixed Reader annotation insertion from the send popover so choosing an annotation prompt no longer closes the popover before the compiled text is inserted.

## [4.1.0] - 2026-04-19

### Added
- Reader: Added atomic closed-unit selection handling for inline math, display math, inline code, code blocks, tables, and images so these units can be copied as source without changing normal text-selection behavior.
- Reader: Added page-lifetime inline annotations with selection-linked highlights, right-gutter anchors, editable annotation popovers, and source-based annotation export.
- Settings: Added a Reader settings section for reusable annotation-export prompts and a persistent annotations copy template, while keeping the Reader export popover focused on previewing and copying the final result.
- Reader and Sending: Added prompt-picker driven annotation export actions so Reader copy now starts by choosing a prompt and Send popovers can insert compiled annotation text at the local textarea caret.
- Bookmarks: Added dedicated `Changelog`, `About`, and `FAQ` information tabs, with sponsor/support content now folded into a more editorial About page.
- Settings: Added built-in English starter prompts, a structured default annotation template, and restore-default actions for both Reader prompt presets and the annotations copy template.

### Changed
- Reader and toolbar source access now rely on the Reader markdown copy and atomic source-selection flow, replacing the retired standalone source panel entry points.
- Reader source copy now keeps formulas, code blocks, tables, images, and other closed Markdown units tied to their original source boundaries, so copying inside Reader preserves structure instead of flattening rendered content.
- Bookmarks: Rewrote the About page copy around the author's real workflow pain points, added a direct feedback email entry, and expanded the support section with a Xiaohongshu contact card.
- Bookmarks: Clarified the About and FAQ copy around formula-copy workflows, including the click-to-copy formula shortcut and the older pain point of having to copy a whole block just to extract one formula.

### Fixed
- Reader: Fixed keyboard copy inside the reader so `Ctrl/Cmd+C` now exports markdown source for selected reader content instead of the rendered visible text.
- Reader: Strengthened atomic closed-unit selection feedback with clearer square-edged highlights that stay visually noticeable without shifting Reader layout or markdown spacing.
- Reader: Refined annotation selection controls so only assistant markdown body selections trigger floating actions, top-edge selections no longer cover the first line, and floating copy/annotation buttons keep an opaque hover surface above content.
- Sending: Fixed the Reader send popover so prompt insertion stays available even before any annotations are added, allowing the same entry point to work as a lightweight prompt launcher.
- UI: Fixed outside-dismiss behavior so dragging a text selection from inside popovers, modals, or overlay panels and releasing on the backdrop no longer closes the active surface accidentally.
- Settings: Reworked Reader annotation-export prompts into an ordered prompt library without built-in/default prompt state, including drag reordering and placeholder-menu based template editing.

## [4.0.0] - 2026-04-02

### Added
- ChatGPT and DeepSeek: Added an adapter-driven header bookmark icon entry backed by a shared runtime orchestrator.
- ChatGPT: Added a toolbar collapse action so foldable assistant messages can collapse their current turn group directly from the official message toolbar.

### Changed
- Platform adapters now own page-header icon anchors and injection rules, keeping runtime lifecycle logic platform-agnostic.
- ChatGPT: Removed the experimental folding power mode and restored the folding runtime to a pure hidden-only path.
- ChatGPT: Moved the toolbar collapse action to the far right of the official toolbar action row, keeping the word-count stats at the end of the surface.
- Unified the runtime style pipeline around shared reference tokens, semantic tokens, and stable UI exports.
- Overlay panels and modal surfaces now share a documented title typography contract, with Reader, bookmarks, save dialogs, and sending surfaces aligned to the same tokenized chrome/control system.
- Reader, source, bookmarks, export dialogs, and modal/popover controls now share one canonical panel chrome token contract for header/footer/button sizing.
- Reader, bookmarks, toolbar, folding, and save dialogs now inherit the default UI font instead of shipping separate sans-serif stacks.
- UI text surfaces now use a shared ChatGPT-aligned sans token inside Shadow DOM, while source/code views keep a dedicated mono token.
- Reader and bookmark panels now use rebuilt mock-aligned shells, with the reader footer showing the current page and long pagination sets wrapping inside a capped scroll area.
- Source panels now use the rebuilt mock-aligned shell and shared overlay host pipeline while keeping raw markdown copy behavior intact.
- Reader pagination now uses shared iconography and legacy-aligned preview cards for a cleaner, more consistent control bar.
- Reader pagination now renders long-range gaps as a dedicated three-dot separator instead of a plain text ellipsis, keeping long conversation navigation cleaner.
- Reader, bookmarks, export dialogs, folding controls, and math-copy feedback now share a single blue-on-white tooltip system instead of mixing browser titles and ad hoc popovers.
- Interactive markdown styling now uses one shared tokenized theme layer across reader and bookmark detail surfaces.
- Markdown rendering now runs through one shared unified pipeline for reader, bookmarks, mocks, and PDF export, with GFM, KaTeX math, syntax highlighting, and sanitization handled in one pass.
- Reader send popovers now use the rebuilt mock-aligned surface and sync drafts through the shared composer bridge when the platform composer is available.
- Shared confirm, prompt, alert, and custom modals now use a rebuilt mock-aligned dialog shell with dedicated shared styling instead of relying on bookmark-panel-local modal CSS.
- Bookmarks: Refined the Sponsor tab into a calmer editorial card layout and realigned its copy with the simpler v3 support wording for GitHub stars and donation channels.
- Bookmarks: Rebuilt the family around a shared shell/view/overlay stack so the panel shell, settings tab, sponsor tab, tree viewport, and save dialog now share one ownership model instead of mixing shell-local and dialog-local implementations.
- Bookmarks: Consolidated settings dropdowns and steppers around family-scoped primitives so panel dismiss logic no longer depends on child-specific selectors.

### Fixed
- Reader: Fixed cross-entry reader drift by moving toolbar-reader and bookmark-preview entrypoints onto named surface-owned profiles, keeping footer chrome and action rails more consistent.
- Bookmarks: Fixed the save dialog title field so IME composition no longer collapses while typing, keeping focus local to the bookmark save panel instead of rebuilding the active input on each keystroke.
- Bookmarks: Added a local input-event boundary to the management panel so internal search, settings, and tree interactions are less likely to leak to host-page or third-party page handlers.
- Bookmarks: Unified panel and save-dialog modal handling around the same shared overlay session so rename, move, folder-pick, and nested root-folder flows no longer drift between separate interaction stacks.
- Modal Motion: Shared dialogs and overlay panels now open and close through two shared motion families (`panel-window` and `modal-dialog`), including exit animations that complete before the surface unmounts.
- UI: Fixed hover and active contrast drift across shared panel chrome, bookmark dialogs, bookmarks management, send surfaces, and the message toolbar so light and dark themes keep clearer interaction feedback.
- UI: Deepened dark-mode surfaces, borders, and hover layers across bookmarks, the reader pager, sending surfaces, folding controls, and the toolbar so controls separate more clearly from the background.
- Toolbar: Fixed shared tooltips for icon-only toolbar buttons so hover/focus on nested SVG nodes shows the expected tooltip again.
- Gemini and DeepSeek: Restored the top-level header bookmark entry on current layouts by adding adapter fallbacks for the latest header structure.
- Runtime: Fixed the content script entry so markdown enhancement experiments no longer emit module-split imports that break toolbar injection at runtime.
- Markdown: Removed the experimental Mermaid runtime path so content-script stability and bundle size no longer depend on a heavy diagram renderer.
- Markdown: Fixed renderer drift between reader, mock panels, and PDF export by removing the mixed `marked`/`MathJax`/post-highlight paths.
- ChatGPT: Reworked conversation folding so collapsed groups hide the full user/assistant turn sections, removing leaked action rows, thought blocks, source chips, and the old expanded-state left guide.
- ChatGPT: Fixed fold bars and the right-side fold dock so both now follow light/dark theme surfaces instead of staying pinned to a white UI.
- Gemini: Fixed the message toolbar position so it stays aligned with the official action row on the latest layout.
- Claude: Fixed the message toolbar and header bookmark icon injection after the latest layout update.
- ChatGPT: Fixed the toolbar width jumping wider while a response is still streaming.
- Sending: Fixed the send popover so typing now stays local to the popover draft until close or send, avoiding host-composer focus conflicts while editing.
- Math: Restored inline formula hover feedback by resolving the shared interactive highlight token the same way as the legacy v3 path.
- Reader: Fixed the header title truncation, restored larger hover previews, and added a footer shortcut back to the current conversation turn.
- Reader: Fixed rebuilt panel positioning so zoomed or short viewports keep the reader surface inside the visible window.
- Bookmarks: Fixed folder-path and folder-name prompts still using hardcoded placeholders instead of localized UI strings.
- Bookmarks: Fixed the panel empty state so existing folders no longer fall back to the misleading `No folders yet` message.
- Bookmarks: Removed the repair and refresh toolbar icons from the panel surface without changing the underlying maintenance actions.
- Bookmarks: Fixed folder selection, counts, expansion, and empty-folder checkbox behavior in the rebuilt bookmarks tree.
- Bookmarks: Fixed restored folder scopes so tree expansion is driven by explicit state, allowing selected branches to collapse normally instead of being forced open on every render.
- Runtime: Fixed disabled platform settings so page-level toolbar and header injection stop, while the extension action can still open the bookmarks panel.
- ChatGPT: Folding group discovery now consumes adapter-owned conversation groups instead of expanding UI-owned host selector logic, keeping the shipping path aligned with the documented adapter boundary.
- Bookmarks: Restored bookmark row reader previews, added platform icons, added a move action, and updated hover/date layout to match the latest panel design.
- Bookmarks: Fixed rebuilt row actions, outside-click dismiss behavior, and backdrop handling so the panel controls behave consistently with the new shell.
- Bookmarks: Restored shared tooltips in the rebuilt panel and unified input focus/placeholder behavior across bookmark, modal, and send surfaces.
- Source: Rebuilt the raw source panel with the mock-aligned header/body layout while preserving copy, close, outside-click, and escape handling.

## [3.0.0] - 2026-02-18

### Added
- **ChatGPT Conversation Folding**: Added fold bars for ChatGPT conversations with per-thread collapse/expand controls.
- **ChatGPT Quick Dock**: Added a fixed right-side quick control for "Collapse all" and "Expand all".
- **ChatGPT Settings Section**: Added a dedicated ChatGPT settings group with folding mode, default expanded count, and dock visibility toggle.

### Fixed
- Gemini: Fixed Deep Research embedded reader button not extracting content correctly (now uses the same pipeline as the toolbar reader button).

## [2.9.5] - 2026-02-06

### Added
- **ChatGPT Conversation Folding**: Added fold bars for ChatGPT conversations with per-thread collapse/expand controls.
- **ChatGPT Quick Dock**: Added a fixed right-side quick control for "Collapse all" and "Expand all".
- **ChatGPT Settings Section**: Added a dedicated ChatGPT settings group with folding mode, default expanded count, and dock visibility toggle.

### Changed
- **ChatGPT Dock UI**: Refined the right-side dock to a slimmer vertical layout with compact `-` / `+` controls to reduce reading intrusion.
- **ChatGPT Visual Guide**: Updated expanded-message left guide color to a neutral gray style for better consistency.

### Fixed
- Claude: Fixed the header bookmark button not appearing after a site layout update.
- Claude: Fixed header bookmark icon hover alignment.
- ChatGPT: Fixed toolbar appearing outside the message bubble while responses are streaming (now shown after the official action bar is ready).
- ChatGPT: Fixed toolbar being anchored to code-block "Copy" buttons in some messages, causing it to appear near the page edge.
- Bookmarks: Fixed broken empty-state styling in the bookmark panel when no folders exist.
- **ChatGPT Quick Dock**: Fixed the dock disappearing after page re-renders and ensured the full half-area is clickable/highlighted on hover.
- **ChatGPT Reader Pagination**: Fixed thinking-only articles being counted as separate pages in Reader mode
- **ChatGPT Word Count**: Fixed word count getting stuck in loading state for code-only responses (now shows `0 Words / 0 Chars`).
- **Reader Mode Copy**: Copy button now shows feedback after copying markdown.
- **Bookmark Panel**: Fixed remaining hardcoded dialog/button labels so localization is consistently applied.
- **Bookmark Panel**: Fixed several hardcoded dialog/button labels to fully respect localization settings.

### Improved
- **Toolbar Injection Stability**: More robust streaming completion detection and safer activation timing to reduce misplacement during SPA re-renders.
- **Resource Cleanup**: Improved cleanup on navigation to avoid accumulating toolbar listeners and injected DOM nodes across long sessions.
- **Reader Pagination**: Pagination controls now wrap gracefully for long conversations, keeping navigation arrows aligned with the page indicators.
- **Internationalization (i18n)**: Comprehensive localization coverage for English and Simplified Chinese
  - Settings Panel
  - Save Messages Dialog
  - Save Messages Export
  - Batch Delete Dialog
  - Sidebar Tabs
  - Module Prefixes
- **Formula Rendering**: Improved stability by loading KaTeX styles from bundled local assets (no external CDN dependency).
- **Bookmark Reliability**: Improved i18n fallback behavior to avoid raw placeholder keys in initialization race conditions.
- **Build Repeatability**: Removed mixed dynamic/static import patterns to keep packaging deterministic across browser targets.
- **Logging Hygiene**: Reduced high-frequency content-path logging and replaced snippet logs with metadata-only diagnostics.
- **Bookmark Reliability**: Improved i18n fallback behavior to avoid raw placeholder keys in edge initialization races.
- **Build Repeatability**: Eliminated mixed dynamic/static import warnings for a more deterministic packaging pipeline.
- **Logging Hygiene**: Reduced high-frequency content-path logs and removed snippet-style parser logging to better protect conversation privacy.

## [2.9.0] - 2026-02-03

### Added
- **Firefox Browser Support**: Full Firefox compatibility with separated architecture
  - Chrome: MV3 with `service-worker.ts` using `chrome.*` API
  - Firefox: MV2 with `background-firefox.js` using `browser.*` API
  - Content Script: 100% shared code (43,384 lines)
  - Dual-manifest system: `manifest.chrome.json` (MV3) and `manifest.firefox.json` (MV2)
  - Dual-build system: `npm run build:chrome` and `npm run build:firefox`

- **Toolbar Toggle Settings**: Allow users to show/hide individual toolbar buttons
  - Settings schema upgraded from v1 to v2 with automatic migration
  - Added toggles for View Source, Save Messages, Word Count buttons
  - Added platform-specific enable/disable toggles (ChatGPT, Gemini, Claude, Deepseek)
- **Reader Actions**: Added Bookmark, Copy, and View Source buttons to the Reader panel header for quick access.
- **Bookmark Sort Direction Toggle**: Click same sort button twice to toggle ascending/descending order
  - Time sort: Newest first ↔ Oldest first
  - Alphabetical sort: A→Z ↔ Z→A
  - Icons change dynamically to show arrow direction
  - Settings migrated from 2-state to 4-state model with backward compatibility
  
### Changed
- **Reader Visuals**: Updated pagination dots to show bookmarked status with a square indicator.
- **Button Styling**: Enhanced bookmark button with gradient background for clearer active state.
- **Reader Fullscreen**: Fullscreen button icon now toggles between maximize/minimize to reflect current state

### Fixed
- **Reader View Source**: Fixed "View Source" button in Reader panel not displaying modal (missing CSS styles replaced with reusable Modal component)
- **Modal z-index**: Fixed Modal being hidden behind Reader panel by updating z-index from `--aimd-z-modal` (1050) to `--aimd-z-dialog` (9500)
- **Modal ESC Key**: Fixed ESC key closing both Modal and Reader panel simultaneously by using capture phase event listener
- **FloatingInput Sync**: Fixed bidirectional sync with native input - now syncs empty state as well (closing with empty content clears native input)
- **Bookmark Highlight**: Fixed toolbar highlight not showing after page refresh due to async createUI race condition
- **Settings Path**: Fixed `saveContextOnly` setting path from `storage.*` to `behavior.*`
- **Design Tokens**: Standardized CSS token usage in Reader panel styles to comply with design system.
- **Reader Pagination**: Fixed bookmark status indicator offset in pagination dots.
- **Markdown Paragraphs**: Fixed excessive blank lines between paragraphs when copying Markdown (3+ newlines compressed to 2)


### Technical Details
- Separated architecture: Background scripts are browser-specific, Content Script is shared
- Added `ready` Promise and `pendingBookmarkState` pattern to handle async toolbar creation
- Settings migration test suite with 7 test cases

## [2.8.0] - 2026-01-22

### Added
- **Claude Support**: Full support for `claude.ai`, including:
  - **Toolbar Injection**: Toolbar now appears on Claude messages with Markdown handling.
  - **Reader Mode**: Dedicated reader view for focused reading of Claude conversations.
  - **Bookmarks**: Save and manage bookmarks directly from Claude chat history.
  - **Message Extraction**: Accurate parsing of Claude's message structure and artifacts.
- **Deepseek Support**: Full support for `chat.deepseek.com` (Deepseek-V3), including:
  - **Fluid Input**: Synchronized floating input box for seamless typing.
  - **Code Block Formatting**: Normalization of Deepseek's code blocks for standard rendering.
  - **Reliable Sending**: Robust "Anti-Fragile" send button detection logic.
- **Export Conversations**: New Export button in toolbar to download conversations as Markdown files.
- **Header Bookmark Button**: Quick-access bookmark panel button added to page header for Claude and Deepseek platforms.

### Fixed
- **Theme System**: Fixed theme detection regression to ensure toolbar colors match the platform theme (Dark/Light).
- **ChatGPT Formula Extraction**: Fixed inline formulas that failed to render correctly, restoring underscores that were incorrectly converted to italics.
- **Block Math Formatting**: Normalized block math output to remove extra blank lines between `$$` delimiters.
- **Reader Formula Rendering**: Fixed long block formulas not rendering in Reader mode due to chunk splitting during Markdown processing.
- **Floating Input**: Fixed newline characters lost when syncing between floating input and native platform input.
- **Floating Input**: Fixed Shift+Enter triggering host page send action instead of creating newline in Reader's floating input.
- **Reader Panel**: Fixed last page content not reloading when navigating back from other pages.
- **PDF Export**: Fixed cross-platform typography inconsistencies (paragraph margins, heading spacing) between ChatGPT and Gemini.
- **PDF Export**: Fixed Chinese font rendering in print context by adding explicit font stack.
- **Export Dialog**: Fixed tooltip animation appearing from wrong direction.
- **Popup Icon**: Fixed incorrect Deepseek icon.

### Changed
- **Export Icon**: Updated toolbar export button icon from download to file-box for better clarity.
- **Export Title**: Truncated long conversation titles to 100 characters (prevents overflow from verbose Gemini titles).
- **Export Timing**: Replaced setTimeout with requestAnimationFrame for more reliable print timing.

## [2.5.0] - 2026-01-10

### Added
- **Settings System**: Comprehensive settings panel with behavior and storage controls.
  - **Behavior Settings**: Toggle code block rendering in Reader Mode and math formula click-to-copy.
  - **Storage Settings**: Context-only save mode (500 chars: 250 front + 250 back) with confirmation dialog.
  - **Data & Storage Management**: Visual storage usage progress bar with detailed stats and uninstallation data-loss warning.
  - **One-Click Export**: Quick access button in settings to export all bookmarks as a backup.
  - **Persistence**: Settings sync across devices via `chrome.storage.sync`.
  - **UI**: Modern card-style interface with iOS-inspired toggle switches.
- **Sponsor Section**: New donation options for "Buy Me a Coffee" and WeChat.
- **Dialog System**: Unified `DialogManager` and `DialogHost` for accessible, Shadow DOM-based alerts, confirms, and prompts.
- **Bookmark Import**: Duplicate detection and merge dialog for imports.
- **Storage Warning**: Storage quota warning system (95%/98% threshold alerts).

### Changed
- **UI**: Settings panel layout and style now strictly align with Sponsor page design language (shared spacing, tokens, behavior).
- **UI**: Renamed bookmark panel header to "AI-MarkDone".
- **Architecture**: Redesigned Z-Index architecture to use a rational hierarchy (1-10000) instead of `z-max`, fixing layering issues.
- **Performance**: Significantly improved bookmark batch import speed (10-50x).
- **Performance**: Significantly improved bookmark batch delete speed (25-75x).
- **UI**: Changed import dialog interface to English.

### Fixed
- **Scrollbar**: Fixed settings panel scrolling behavior to match Sponsor tab (scrollbar on container edge).
- **Reader UI**: Hidden redundant bubble button within the Reader view.
- **Bookmarks**: Fixed duplicate handling logic during bookmark import.
- **Bookmarks**: Fixed detailed count display in import success message.
- **Storage**: Corrected storage limit constant (5MB → 10MB).

## [2.2.0] - 2026-01-08

### Added
- **StreamingDetector**: Cross-platform streaming completion detection (`src/content/adapters/streaming-detector.ts`)
- **FloatingInput Size Memory**: Window size persists within session
- **Reader Panel Navigation Fix**: Arrow states update correctly after new messages

### Changed
- **GEMINI.md 3.0**: Streamlined following Claude Code best practices
- **Documentation Architecture**: Established "Documentation as Contract" system

### Fixed
- Trigger button state sync issue
- Last message content not refreshing on re-entry

## [2.1.0] - 2026-01-04

### Added
- Reader Mode for focused reading
- Bookmark management system

## [0.5.0] - 2025-12-08

### 🎉 Initial Release

#### Added
- **Math Formula Extraction**
  - Extract LaTeX from KaTeX `<annotation>` tags
  - Click-to-copy individual formulas with live highlighting
  - Support for streaming messages (formulas detected in real-time)
  - Inline: `$...$`, Block: `$$\n...\n$$`
  - Handles consecutive formulas like `$a$、$b$`

- **Table Conversion**
  - HTML tables → GitHub Flavored Markdown
  - Extract formulas from table cells (placeholder mechanism)
  - Handles ChatGPT's table wrapper classes

- **Code Block Formatting**
  - Auto-detect programming languages
  - Triple-backtick fences with language tags
  - Preserves syntax highlighting

- **Toolbar UI**
  - Shadow DOM for style isolation
  - Icon-only buttons with tooltips
  - Copy Markdown, View Source, Preview buttons
  - Real-time word/character count on right side

- **Word & Character Count**
  - CJK support: 1 character = 1 word + 2 chars
  - Latin: 1 word = word.length chars
  - Excludes code blocks and math formulas

- **Re-render Panel**
  - Preview Markdown with marked.js + KaTeX
  - Fullscreen toggle
  - GitHub-style CSS
  - Iframe isolation

- **Platform Support**
  - ChatGPT (chat.openai.com, chatgpt.com)
  - Gemini (gemini.google.com) - basic support

#### Technical
- Manifest V3 Chrome extension
- TypeScript 5.6 strict mode
- Vite 5.4 build system
- Adapter pattern for multi-platform
- MutationObserver for streaming detection
- Interval polling for toolbar injection (15s timeout)

#### Performance
- Debounced MutationObserver (200ms)
- WeakSet/WeakMap for memory efficiency
- Shadow DOM prevents CSS conflicts
- Lazy toolbar injection

---

## Roadmap

### Planned for v0.6
- Keyboard shortcuts (Cmd+C override)
- Export entire conversation
- Settings panel (theme, format options)
- Support for Claude

### Planned for v1.0
- Firefox support
- Edge support
- Batch export
- Custom templates

---

## [2.0.0] - 2025-12-20

### Changed
- Wire the rebuilt bookmarks settings panel to live runtime behavior for platform enablement, Reader code rendering, and click-to-copy updates.
- Show real bookmark storage usage in settings with a live progress bar driven by background quota data.
- Refactor injected UI styles to use shared tokens and remove inline overrides in
  bookmark dialogs.
- Localize the rebuilt bookmarks, send, save, and source surfaces so language changes apply immediately without page reloads.

### Fixed
- Dark mode rendering for duplicate bookmarks dialog and export confirm button.
- Remove remaining hardcoded English strings from the rebuilt bookmarks panel and send popover, including import review copy and settings labels.
- Restore native send-popover composer wiring for DeepSeek, Gemini, and Claude by completing their site-adapter send contracts without changing the shared sending infrastructure.
- Close the send popover automatically when clicking outside the surface, while keeping in-popover interactions intact.
- Restore native title tooltips on message toolbar and header icon controls, while keeping preview-style tooltips only where they are actually needed.
- Re-align Claude message toolbar injection to the trailing slot of the official action row and restore DeepSeek's top icon placement next to the title on current layouts.
- Restore copy feedback in the source panel and unify Reader/Source copy confirmation with the shared ephemeral tooltip interaction.
- Tighten responsive footer behavior in the Reader so narrow widths compress the pager first instead of reflowing the surrounding controls.
- Refine the mobile bookmarks tab rail into an even three-column strip so top tabs stay readable and do not overflow on narrow screens.

---

[2.0.0]: https://github.com/zhaoliangbin42/AI-MarkDone/releases/tag/v2.0.0
[0.5.0]: https://github.com/zhaoliangbin42/AI-MarkDone/releases/tag/v0.5.0
