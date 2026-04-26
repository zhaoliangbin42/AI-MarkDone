# Changelog

# 4.2.0
2026-04-26

After reading user feedback, I realized that Gemini, DeepSeek, and Claude have each started to accumulate platform-specific compatibility issues. Given the time and energy I can realistically put into this project, I would rather focus deeply on ChatGPT than try to keep building a large, all-in-one extension. ChatGPT already has enough efficiency problems worth solving, and it is also the platform I use most in daily work, so my own understanding is much deeper there.

Practice is the real test. I believe I can only build truly useful productivity features when I have felt the workflow pain myself. There are also already other projects that cover some of these cross-platform needs. After thinking it through, I have decided to gradually step back from active Gemini, DeepSeek, and Claude development and return AI-MarkDone to its original focus: ChatGPT.

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
