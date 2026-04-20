# Changelog

# 4.1.1
2026-04-20

This release fixes annotation insertion from the Reader send popover. Choosing a prompt no longer gets treated as an outside click, so the send popover stays open long enough to insert the compiled annotation text.

# 4.1.0
2026-04-19

This release is centered around three changes. First, the standalone source panel is gone, and source copying now lives directly inside Reader. Second, Dynamic Annotation is now available, so you can read through a response, mark the exact parts you want to revise, add your own notes, and compile everything into structured input for another model. Third, the bookmarks panel now includes dedicated Changelog, About, and FAQ pages to make version history, project background, and usage guidance easier to find.

The hardest part here was moving source copy into Reader without falling back to the browser's default rendered-text copy. Formulas, code blocks, tables, and images are not ordinary text spans. They behave more like closed units that need to be copied as a whole. If Reader simply copied the visible selection, much of the original Markdown structure would be lost. The new flow first maps those closed units back to their source boundaries, then rebuilds the copied result from the original Markdown fragments in selection order. That is what lets Reader return source-shaped output instead of flattened page text.

- Source copying is now available directly inside Reader, so you no longer need a separate source panel.
- Reader now supports source-aware selection and copying for formulas, code blocks, tables, images, and other closed Markdown units.
- Reader now lets you add Dynamic Annotations directly to selected content. When you select text, floating copy and annotate actions appear nearby.
- Annotations stay linked to the original selection, remain highlighted inside Reader, and can be reopened and edited later.
- Added an annotation export template that you can configure in `Settings > Reader > Annotations copy template`.
- Added a Prompt Library so you can manage multiple reusable prompt headers in `Settings > Reader > User prompts`.
- Annotation results can now be copied in one click or inserted directly above the send box in the lower-left Reader input area.
- The bookmarks panel now includes dedicated Changelog, About, and FAQ pages.
- The popup shown on unsupported pages has been cleaned up with a clearer layout and less redundant copy.

# 4.0.0
2026-04-05

- Completed a major architecture refactor, making the extension more stable today and easier to extend later.
- Unified the visual language across the main panels, popovers, buttons, and inline hints.
- Header bookmark entry points and toolbar interactions became more consistent across supported platforms.
- Consolidated the Markdown rendering pipeline so code, formulas, and tables behave more consistently across surfaces.
- Fixed a ChatGPT message capture bug that could truncate long responses.
- Fixed unstable toolbar injection on Claude and Gemini.
- Fixed synchronization issues between the send popover and the host input field.
- Fixed a range of Reader, bookmarks, and popover issues to make the overall flow feel smoother.

# 3.0.0
2026-02-19

- Supports the major AI chat platforms: ChatGPT, Gemini, Claude, and DeepSeek.
- Introduced a dedicated Reader mode for turning long chats into a calmer reading surface.
- Added structured Markdown copying so exported content is easier to reuse and archive.
- Added word count support for quickly judging message length and density.
- Introduced a built-in bookmarks system for saving and organizing important chats.
- Added a settings panel for controlling Reader, bookmarks, and toolbar behavior.
- Added Markdown and PDF export for easier sharing and archiving.
- Added ChatGPT message folding, including older-message collapse and one-click expand or collapse actions.
