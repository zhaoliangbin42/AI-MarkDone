# Changelog

# 4.4.6
2026-05-24

This is a revision release for the Chrome submission package title.

## Changed
- Updated the extension title to "AI-MarkDone — ChatGPT 导航、阅读与知识整理插件".

# 4.4.5
2026-05-24

This release focuses on formula copy, long-message reading in Reader, toolbar stability, and ChatGPT page performance.

## Added
- Added one-click formula copy as Office-compatible MathML.
- Added support for rendering formulas inside tables. Thanks to Xiaohongshu user @小红薯67542.
- Added a global status toast for short feedback such as "Copied successfully".
- Added Sticky mode in Reader. Select text in the main content and pin it on the left side, so long articles no longer require scrolling back and forth to find the same passage.
- Reader now supports Up and Down arrow key scrolling inside messages. Thanks to Xiaohongshu user @如果你也对吃感兴趣.

## Changed
- Upgraded Reader's new-page refresh logic. When you send a message from Reader, newly added pages can finally appear in Reader.
- Upgraded toolbar insertion logic, so toolbar injection should be more stable now (a little mysterious, but useful).
- Upgraded the directory refresh logic and significantly improved performance.
- Upgraded toolbar and directory rendering behavior when the current page width changes.
- Because some users reported that formula hover buttons could cover the text they were reading, this release turns those hover buttons off by default and simplifies their shape. If you need them, you can turn them on from Settings. Thanks to Xiaohongshu user @如果你也对吃感兴趣.

## Fixed
- Fixed tooltip display issues, such as formula copy feedback being covered.
- Fixed an issue where Copy as Markdown could treat links inside code blocks as noise and remove them. Thanks to Email user @童硕.

## How it works

The main performance improvement in this release is not about refreshing the page faster. It is about refreshing less often when nothing meaningful has changed. ChatGPT continuously loads, replaces, hydrates, and relayouts parts of the page. If the extension treats every DOM change as a reason to analyze the whole conversation again, long conversations can become unnecessarily expensive.

The directory now judges more carefully whether a page change really affects the conversation structure. If only local buttons, toolbar nodes, or unrelated elements change, it avoids a full rebuild. That means when you open a long conversation, wait for a message to continue generating, or let ChatGPT hydrate its own controls, the directory does not keep repeating the same work.

Toolbar and page-width handling follow the same idea. While you drag the browser width, the page can emit many layout updates in a row, and those updates used to compete with toolbar and directory rendering. The new flow waits for width changes to settle before resuming related UI refreshes, which reduces jitter and repeated calculation while resizing.

Reader's new-page refresh path was also upgraded. When you continue sending messages from Reader, new content can enter the Reader pages more reliably without closing and reopening Reader. The overall goal is to behave more calmly on ChatGPT's dynamic page: interrupt less, wait a bit more, and update only when the update is actually useful.

# 4.4.1
2026-05-15

This release focuses on personalization, a cleaner style system, and smoother long-message reading in ChatGPT.

## Added
- Added a global interface font size control in Settings -> Advanced Settings. It stays within 12px-20px, uses stepper buttons instead of free text input, and refreshes extension surfaces live.
- Added theme color swatches in Settings -> Advanced Settings, so the extension can share one accent color across primary actions, links, focus rings, selected states, and the unsupported-page popup.
- Added an internal Reader heading outline for long Markdown responses, making it easier to jump within a single long message. Thanks to Xiaohongshu users @Hiahiaaa and @小红薯67542EF1.
- Added a Reader setting to hide the internal heading outline when you prefer a cleaner reading surface.
- 导航栏中，对已经加入书签的消息，会有不同的颜色以作区分，方便快速定位书签消息。

## Changed
- Streamlined the style system so Reader, settings, bookmarks, toolbar, dialogs, and popovers follow a more unified token-based visual language.

## Fixed
- The latest ChatGPT Reader page now refreshes from the live conversation snapshot when opened or revisited. You can switch away from the final Reader page and come back to keep up with an actively generating response without closing Reader.

# 4.4.0
2026-05-12

Thanks to GitHub user @LTong-g for contributing code. This release significantly improves Export as PNG.

## How it works

Previously, PNG export rendered the content and split the work by height. In practice, a block with many formulas, code blocks, tables, or images can still be expensive even when it is not visually very tall, because the underlying DOM tree is complex. @LTong-g's approach keeps the height-based split and also considers DOM complexity, so complex messages are rendered in smaller work units before the final image is assembled. This reduces long browser stalls during Copy as PNG and batch PNG export.

PNG export also now shows progress feedback. Copy as PNG uses a cancellable progress panel, and Save Messages shows both the current message progress and the total export progress. The goal is simple: when an export takes time, the UI should say what is happening instead of making the button look stuck.

Feedback and code contributions are welcome. I want future updates to keep sharing the reasoning behind changes, both to satisfy curiosity and to make it easier for more people to participate.

## Changed
- Improved PNG export performance and added visible progress feedback. Thanks to GitHub user @LTong-g.
- Updated ChatGPT content discovery so Reader and export can recover more than the last few visible messages again. Thanks to Xiaohongshu users @Jim and @全是恶意.

# 4.3.1
2026-05-07

This patch focuses on Firefox toolbar stability and cleaner Reader output for citation-heavy ChatGPT content.

## Fixed
- Fixed Firefox toolbar insertion failures on ChatGPT. Thanks to Xiaohongshu user @圆桶烤肉拌厚切三文鱼.
- Further reduced hyperlink and file citation noise in Reader copy and export output. Thanks to GitHub user @LTong-g.

# 4.3.0
2026-05-05

This release improves formula image export, Dynamic Annotation copy output, and ChatGPT directory readability, while also addressing user-reported export and toolbar stability issues.

## Added
- Added single-formula image export with PNG and SVG support, making it easier to prepare presentation slides without rebuilding formulas by hand.
- Added settings to choose which formula image copy and save buttons appear on hover under Toolbar & Page Actions.
- Dynamic Annotation can now place the selected user prompt before or after copied annotations. Thanks to Xiaohongshu user @momo.
- Expanded ChatGPT directory mode can now show the first 15 and last 15 prompt characters from Settings, making messages easier to distinguish when many prompts start the same way.
- Grouped toolbar, formula, and export controls together in Settings, and added a v4.5.0 notice that Gemini, Claude, and DeepSeek support will be retired.

## Fixed
- Fixed a case where numbered formulas could overlap text in PDF exports. Thanks to GitHub user @LTong-g.
- Improved message bottom toolbar injection stability. Thanks to Xiaohongshu user @去码头整点橙汁.

# 4.2.3
2026-04-29

This release focuses on small but useful Reader and ChatGPT navigation improvements, plus two polish fixes reported by users.

## Added
- Added a Reader panel width control at the bottom of Advanced Settings for users who want to tune the reading layout. Thanks to Xiaohongshu user @Z..（研一版）.
- Added previous and next message shortcuts in the lower-right page controls for faster ChatGPT conversation navigation. Thanks to Xiaohongshu user @特立独行的猫之工程师.

## Fixed
- Fixed duplicate `Copy annotations` buttons in the Reader header. Thanks to GitHub user @LTong-g.
- Fixed overlapping numbered formulas in PDF exports. Thanks to GitHub user @LTong-g.

# 4.2.2
2026-04-27

This patch continues the ChatGPT content discovery and right-side directory stability work, while also reducing citation noise in Reader copy output.

## Fixed
- Removed link citation references from Reader Markdown copy output so copied content is cleaner. Thanks to GitHub user @LTong-g.
- Further improved right-side directory stability by sharing the same discovered user-round model across previews, jumps, and scroll positioning. Thanks to GitHub user @LTong-g.
- Fixed missing round discovery on Deep Research pages. The right-side directory can now discover Deep Research rounds and jump correctly. Reader content remains empty for Deep Research when ChatGPT only exposes research skeleton nodes, because the official Deep Research reading experience is already strong; feedback is welcome if dedicated Reader support is needed.
- Fixed a v4.2.1 regression where Reader could fail to load ChatGPT content. Thanks to Xiaohongshu user @小红薯67542EF1.

# 4.2.1
2026-04-27

This patch fixes ChatGPT directory positioning after a recent ChatGPT page update.

## Fixed
- Fixed cases where the right-side directory could show the right list but fail to jump or highlight the correct conversation position.

## How it works
- ChatGPT stopped consistently exposing the old turn container we used before.
- The directory could count messages from one source but locate them with another.
- The new flow builds one shared user-round position model from ChatGPT's structured turns.

# 4.2.0
2026-04-26

After reading user feedback, I realized that Gemini, DeepSeek, and Claude have each started to accumulate platform-specific compatibility issues. Given the time and energy I can realistically put into this project, I would rather focus deeply on ChatGPT than try to keep building a large, all-in-one extension. ChatGPT already has enough efficiency problems worth solving, and it is also the platform I use most in daily work, so my own understanding is much deeper there.

Practice is the real test. I believe I can only build truly useful productivity features when I have felt the workflow pain myself. There are also already other projects that cover some of these cross-platform needs. After thinking it through, I have decided to retire Gemini, DeepSeek, and Claude support starting in v4.5.0 and return AI-MarkDone to its original focus: ChatGPT as the only supported platform.

Of course, there are good alternatives for those platforms.

For Gemini, the best extension I know today is [Gemini Voyager](https://github.com/Nagi-ovo/gemini-voyager).

For cross-platform bookmark workflows, one extension I used before and liked a lot is [Timeline](https://github.com/houyanchao/Timeline).

I believe these two projects should cover most needs on the other platforms. On the ChatGPT side, I will keep moving along the original direction: restrained, unobtrusive, and genuinely useful from the perspective of an engineering graduate student who uses ChatGPT heavily. The goal is still to fill in the last mile of the ChatGPT experience and make daily work smoother.

This release also adds two practical features: exporting messages as images and an expanded directory mode. Image export is one of my personal favorites. ChatGPT sharing usually happens through links or screenshots, but longer answers often require long screenshots, which quickly becomes awkward. To better support real sharing scenarios, AI-MarkDone now supports one-click copy as image and batch export as image.

The directory also gets an expanded mode. The previous accordion behavior looked nice, but it was not always practical. When a conversation has dozens of messages, it is hard to find the target message at a glance. Expanded mode makes all message summaries visible at once, so navigation is faster.

## Added
- Added support for Safari and Firefox.
- Added batch message rendering to PNG. Thanks to Xiaohongshu user @小锋iDyll.
- Added direct Copy as PNG for quickly sharing a message with friends. Thanks to Xiaohongshu user @小锋iDyll.
- Added settings for PNG width and image scale, so exported images can better match the visual width of the target sharing platform.
- Added expanded directory mode so all message summaries can be reviewed at once.
- Added a directory toggle so users can hide the right-side directory.

## Fixed
- Fixed layout issues in the Settings panel.
- Improved invalid bookmark filename messages so naming problems are clearer. Thanks to Xiaohongshu user @Colin的AI杠杆.
- Fixed a directory issue where one click could fail to land on the target message. Thanks to Xiaohongshu user @谦卑于世.

## How it works
- Previously, clicking a directory item would jump to the target message position, but that jump could trigger ChatGPT's incremental loading. Once new content loaded, the page layout shifted and the target position drifted. That is why a second click was sometimes needed after the page settled. The new flow first jumps to the target, then watches for coordinate changes caused by incremental loading, and performs a second correction jump. The correction is almost unnoticeable to the user.

# 4.1.2
2026-04-22

In the early hours of April 22, 2026, ChatGPT rolled out a major update that changed page loading from full-thread loading to incremental loading. That broke the original message-discovery algorithm entirely. The impact included, but was not limited to, the fold bar failing outright and Reader only being able to see the final 4 to 5 rendered messages.

The original goal of the fold bar was to improve loading speed and reduce rendering pressure. Now that ChatGPT officially supports incremental loading and automatically unloads inactive nodes, overall performance is already much better. At the same time, ChatGPT's new dynamic loading model makes the fold bar much harder to maintain and significantly less stable. After weighing the trade-offs, I decided to remove the fold bar feature.

As for Reader, the current ChatGPT page now loads only the 4 to 5 messages inside the viewport by default, so the previous approach for collecting stable in-page nodes no longer works. Reader could no longer display the whole conversation at once. To solve that, I redesigned the content discovery engine specifically for ChatGPT. Reader can now discover all messages again after you enter a conversation.

On the official page itself, I also found a few rough edges in the new dynamic loading behavior. For example, when you drag the scrollbar quickly, content can appear with a delay, which makes older messages harder to review. To better support users who prefer staying on the native page, I extracted the new low-level capability into a right-side directory view. After you enter a conversation, the directory appears on the right, supports live message previews, and lets you jump directly to the part you want.

## Added
- Dynamic Annotations in Reader now support deleting annotations. Thanks to Xiaohongshu user @Z.. (研一版).
- Added a right-side ChatGPT directory so you can jump to any conversation segment in one click.

## Changed
- Redesigned the ChatGPT content discovery engine so Reader can recover full-thread visibility under the new incremental-loading page model.
- Adjusted ChatGPT bookmark save, highlight, and jump behavior around the new dynamic loading path so bookmarks use the same stable conversation position model as the right-side directory.

## Fixed
- Fixed bookmark renaming. Thanks to Xiaohongshu user @Z.. (研一版).
- Fixed ChatGPT bookmark save, highlight, and jump positioning under incremental loading.
- Fixed Reader content discovery on ChatGPT so full-thread collection works again. Thanks to Xiaohongshu user @沐霖.
- Fixed the insert-prompt action inside the Reader send box.
- Improved bookmark jump positioning so ChatGPT bookmarks use the same stable anchor path as the right-side directory. Thanks to Xiaohongshu user @Z.. (研一版).

## Removed
- Removed ChatGPT message folding.

# 4.1.1
2026-04-20

This release fixes annotation insertion from the Reader send popover. Choosing a prompt no longer gets treated as an outside click, so the send popover stays open long enough to insert the compiled annotation text.

## Fixed
- Fixed annotation insertion from the Reader send popover so choosing a prompt no longer gets treated as an outside click.

# 4.1.0
2026-04-19

This release is centered around three changes. First, the standalone source panel is gone, and source copying now lives directly inside Reader. Second, Dynamic Annotation is now available, so you can read through a response, mark the exact parts you want to revise, add your own notes, and compile everything into structured input for another model. Third, the bookmarks panel now includes dedicated Changelog, About, and FAQ pages to make version history, project background, and usage guidance easier to find.

The hardest part here was moving source copy into Reader without falling back to the browser's default rendered-text copy. Formulas, code blocks, tables, and images are not ordinary text spans. They behave more like closed units that need to be copied as a whole. If Reader simply copied the visible selection, much of the original Markdown structure would be lost. The new flow first maps those closed units back to their source boundaries, then rebuilds the copied result from the original Markdown fragments in selection order. That is what lets Reader return source-shaped output instead of flattened page text.

## Added
- Source copying is now available directly inside Reader, so you no longer need a separate source panel.
- Reader now supports source-aware selection and copying for formulas, code blocks, tables, images, and other closed Markdown units.
- Reader now lets you add Dynamic Annotations directly to selected content. When you select text, floating copy and annotate actions appear nearby.
- Annotations stay linked to the original selection, remain highlighted inside Reader, and can be reopened and edited later.
- Added an annotation export template that you can configure in `Settings > Reader > Annotations copy template`.
- Added a Prompt Library so you can manage multiple reusable prompt headers in `Settings > Reader > User prompts`.
- Annotation results can now be copied in one click or inserted directly above the send box in the lower-left Reader input area.
- The bookmarks panel now includes dedicated Changelog, About, and FAQ pages.

## Changed
- Moved source copying into Reader and retired the standalone source panel flow.
- Cleaned up the popup shown on unsupported pages with a clearer layout and less redundant copy.

## Removed
- Removed the standalone source panel as a separate workflow.

# 4.0.0
2026-04-05

## Changed
- Completed a major architecture refactor, making the extension more stable today and easier to extend later.
- Unified the visual language across the main panels, popovers, buttons, and inline hints.
- Header bookmark entry points and toolbar interactions became more consistent across supported platforms.
- Consolidated the Markdown rendering pipeline so code, formulas, and tables behave more consistently across surfaces.

## Fixed
- Fixed a ChatGPT message capture bug that could truncate long responses.
- Fixed unstable toolbar injection on Claude and Gemini.
- Fixed synchronization issues between the send popover and the host input field.
- Fixed a range of Reader, bookmarks, and popover issues to make the overall flow feel smoother.

# 3.0.0
2026-02-19

## Added
- Supports the major AI chat platforms: ChatGPT, Gemini, Claude, and DeepSeek.
- Introduced a dedicated Reader mode for turning long chats into a calmer reading surface.
- Added structured Markdown copying so exported content is easier to reuse and archive.
- Added word count support for quickly judging message length and density.
- Introduced a built-in bookmarks system for saving and organizing important chats.
- Added a settings panel for controlling Reader, bookmarks, and toolbar behavior.
- Added Markdown and PDF export for easier sharing and archiving.
- Added ChatGPT message folding, including older-message collapse and one-click expand or collapse actions.
