# FAQ

## Where can I use AI-MarkDone?

The full workspace is available on ChatGPT, including the in-page Reader and separate Reader. Formula copying is also available on Gemini, Claude, and DeepSeek. Previously saved bookmarks from those platforms remain available.

## Where do I find each feature?

- Library and Settings: click the extension icon to open the management panel
- Feature overview: below the Settings categories, find features, instructions, and shortcuts
- Copy, bookmark, Reader, and export: expand the toolbar below a reply
- Annotate and highlight: select text, then choose Annotate or a color
- Formula copy: click a formula
- Message navigation: use the previous/next buttons at the lower right of the page
- Backup: Settings → Data & backup

## Can the management panel fill the screen?

Yes. Choose Full screen beside Close at the management panel’s upper right to expand the panel; choose Exit full screen to restore its window. This keeps the current category, search, and selection.

## Why use Reader?

Read long replies in a window or full screen, use the heading outline to find a section, and switch between messages. You can copy Markdown, add annotations, and write a follow-up. Copy or wrap individual code blocks, and keep passages in the excerpt tray for comparison.

Excerpts stay on the current page and clear after a refresh. To read in another tab, open a separate Reader from the page controls. Refresh its content manually, and keep the original ChatGPT tab open to refresh, send, or locate replies.

## What are annotations for?

Select a passage and choose Annotate. You can copy the passage and annotation together, or insert them into the input box for a follow-up. Review the draft before sending; insertion does not send it.

## Can I customize annotation templates?

Open the annotation copy template from Reader’s upper-right settings. The template controls the order and format of each passage and note.

Manage reusable prompts under Settings → Writing & prompts. When copying annotations, choose a prompt and place it before or after the annotations.

## Are annotations and highlights saved?

Highlights save automatically in the current browser profile. Save new annotations is off by default in Reader settings. When off, new annotations last for the current page session; when on, they remain after a refresh. Previously saved annotations stay available.

Browse annotations and highlights by conversation in Library, or open their source pages.

## What happens to unfinished annotations?

Typing does not save automatically. Clicking outside lets you keep reading while the annotation window and its text stay open. Choose Save to submit the annotation. Closing, pressing Escape, discarding edits or refreshing the page discards unsaved changes.

If saving fails, the window retains your text for retry. Saved annotations still follow Save new annotations, which is off by default for new records. Previously persisted annotations are unaffected by that setting.

## Can I copy just part of a reply as Markdown?

Select text on ChatGPT or in Reader and choose Copy Markdown. Text, formulas, code, and lists keep their Markdown formatting. Selected formulas copy in full; partial code selections copy only the selected text.

ChatGPT’s default shortcut is Cmd/Ctrl + Shift + C; existing custom combinations take priority. Change or disable it under Settings → Buttons & shortcuts → Keyboard shortcuts. Reader also uses the effective combination shown there.

## Can I customize keyboard shortcuts?

Yes. Under Settings → Buttons & shortcuts → Keyboard shortcuts, select a combination to record new keys, disable a command or restore defaults. Checks cover extension conflicts and known reserved keys, not every system, browser or other-extension binding. Reading navigation pauses while you type.

## How do backslash prompt suggestions work?

Type `\` at the start of the ChatGPT composer or Reader send box, or after whitespace, to see matching prompts and continue filtering by trigger text. Automatic suggestions include enabled prompts with a trigger; backslashes inside formulas belong to the formula assistant.

The automatic-suggestion switch is under Settings → Buttons & shortcuts → Keyboard shortcuts. When automatic suggestions are off, an enabled Open prompt suggestions shortcut remains available; manual candidates also include prompts without triggers. Check Settings for your effective combination.

## How do I copy a formula?

Click it in the original reply. Inline formulas use `$...$` and display formulas use `$$...$$` by default. Set separate formats for single formulas and whole-message Markdown under Settings → Copy & export.

Enable image actions under Settings → Buttons → Formula to copy PNG, SVG, or MathML, or save PNG or SVG. SVG and MathML require available formula source. The input formula preview also offers these actions.

## What can bookmarks save?

Bookmarks save a conversation link or a reply. Page bookmarks keep a name and link; message bookmarks save the question and reply for reading and copying. Folders organize bookmarks into up to four levels.

With Save only bookmark excerpts enabled, questions and replies longer than 500 characters each keep 250 from the start and 250 from the end. Open the original conversation for the full text.

## How do I manage many bookmarks?

Choose a folder on the left, or search. Lists show 20 items per page. Use the row buttons to rename, move or delete a bookmark; use the folder menu for folder actions. Filters, sorting, import, export and selection controls sit beside the Library heading.

“Select this page” selects the current page. “Select all bookmarks” and “Invert bookmarks” apply across all results matching the current filters. Paging preserves selection; changing the folder, type or search clears it. A single folder must be empty before deletion. Bulk folder deletion includes its bookmarks and subfolders, with counts shown before confirmation.

## How do I export messages?

Open Export below a reply or in a directory preview, select messages, and choose a format. Markdown remains editable. PDF opens the browser’s print dialog, where you can choose Save as PDF. PNG saves long images, with a ZIP when multiple image files are needed. During image generation, you can view progress or cancel.

Choose an offline Markdown ZIP to keep supported diagrams or cards with image attachments. PDF and PNG can use static images or text placeholders. Unavailable images retain readable descriptions; offline files do not preserve interactive controls.

## Can I hide buttons or change the theme?

Use Settings → Buttons & shortcuts → Buttons to configure page, reply, formula, selection, and directory buttons, and keep common page or reply actions visible. Theme, font size, and accent color are under Appearance & layout. Follow the page or use light or dark mode, and choose a preset or custom accent color. Search finds controls across all eight categories.

Conversation and input width is also under Appearance & layout: use the numeric field or minus/plus buttons for 50%–500% in 25% steps. At 100%, the official width is restored; actual width remains constrained by the window and native parent containers.

## Where does Google Drive backup save my data?

The experimental backup flow stores your saved bookmarks, highlights, annotations, and their folders in your own Drive under `AI-MarkDone/Backups/bookmarks`. It excludes unsaved annotations, excerpts, prompts, extension settings, and OAuth credentials. A full local Library export contains the same saved items. Older bookmark-only files still import and affect bookmarks alone.

Backup checks the uploaded file. Before restoring, review the merge preview: local-only items remain, duplicates are skipped, and conflicts keep the local copy by default. Backups run when you start them; they do not sync changes automatically.

Manage cloud files or test the connection under Data & backup. Trashing a Drive backup does not delete local Library data. Sign out disconnects AI-MarkDone from Drive and clears cached authorization. An interrupted upload can leave a file in Drive; failed verification reports whether cleanup is needed.

## How do message navigation and the directory work?

Use the page’s lower-right previous/next buttons. Left and right arrow keys also navigate when you are not typing, if enabled.

The directory is on by default for new installations; existing settings stay unchanged. Under Settings → Reading & messages, turn it on or off, choose compact previews or an expanded list, and adjust summaries, preview length, and right spacing. Regular messages join the directory as they load; unloaded history may be missing. Official navigation visibility is in the same category; navigation shortcuts are under Buttons & shortcuts, and jump distance is under Advanced.

## What does the character count include?

The count is weighted: common Chinese, Japanese, and Korean characters count as two; English letters A–Z and a–z, digits, and underscores count as one. Spaces and other characters do not count. Recognized code and formulas are skipped.

The optional time below the count comes from the website's message metadata: update time first, creation time otherwise. It is omitted when unavailable.

## Is AI-MarkDone paid?

AI-MarkDone is free. Feedback, reviews and optional support help its development.
