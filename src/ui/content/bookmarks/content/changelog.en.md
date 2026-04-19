# Changelog

# 4.1.0
2026-04-16

In Reader, copying a selection now gives you the original source instead of flattened rendered text. This release also introduces Dynamic Annotation: you can read through a response, mark the parts you want to revise, add your own notes inline, and then export everything as structured input for another model. Compared with one-sentence-at-a-time review flows, this is much better for article-level rewriting, bulk polishing, and targeted replies, so you spend fewer turns and usually get more precise results.

- Reader now lets you add annotations directly to selected content. When you select text, floating copy and annotate actions appear nearby.
- Annotations stay linked to the original selection and remain highlighted inside Reader.
- Existing annotations can be reopened, reviewed, and edited at any time.
- Added an annotation export template that you can configure in `Settings > Reader > Annotations copy template`.
- Added a Prompt Library so you can manage multiple reusable prompt headers in `Settings > Reader > User prompts`.
- Annotation results can now be copied in one click from the Reader header whenever the page already has annotations.
- Annotation results can also be inserted directly above the send box in the lower-left Reader input area.
- Reader now supports source-aware selection and copying for code, formulas, tables, images, and other closed units. The copied result stays as close as possible to standard Markdown instead of collapsing into plain rendered text.
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
