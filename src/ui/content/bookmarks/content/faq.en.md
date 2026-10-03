# FAQ

## Which platforms does this extension support?

New features target ChatGPT, including the in-page Reader and separate reader. Previously saved bookmarks from other platforms remain available.

## Where do I find each feature?

- Library and Settings: click the extension icon to open the management panel
- Feature overview: below the Settings categories, browse grouped features, entry points, and shortcuts
- Copy, bookmark, Reader and export: expand the capsule below an assistant reply
- Annotation and highlight: select text, then choose the annotation button or a color
- Formula copy: click a formula
- Message navigation: use the previous/next buttons at the lower right of the page
- Backup: Settings → Data & backup

## Can the management panel fill the screen?

Yes. Choose Full screen beside Close at the management panel’s upper right to expand the panel; choose Exit full screen to restore its window. This keeps the current category, search, and selection.

## Why use Reader?

Reader makes long replies easier to read, with full screen or window modes, a heading outline, page navigation, Markdown copying, annotations, and follow-up questions. Copy or wrap individual code blocks, and keep important passages in the excerpt tray on the left for comparison.

Excerpts last for the current page session and clear after a refresh. Open a separate reader from the page’s lower-right controls; refresh its content manually, and keep the original ChatGPT tab open for sending and locating replies.

## What are annotations for?

Select a passage and add a note. You can then copy the selected text and notes together, or insert them into the composer for a follow-up. Inserting does not send the message.

## Can I customize annotation templates?

Open the annotation copy template from Reader’s upper-right settings, or Library → Annotations → Details → Templates. The template controls the order and format of each passage and note.

Prompts are reusable instructions managed under Settings → Writing & prompts. When copying annotations, choose a prompt and place it before or after the notes.

## Are annotations and highlights saved?

Highlights are always saved in the current browser profile. Save new annotations is off by default in Reader settings: when off, new notes last only for this page session; when on, they remain after a refresh. Previously saved annotations stay available.

Browse annotations and highlights by conversation in Library, or open their source pages.

## Can I copy just part of a reply as Markdown?

Select text on the ChatGPT page or in Reader and choose Copy. Text, formulas, code, and lists keep their Markdown formatting; selected formulas copy as complete formulas, while partial code selections copy only the selected text.

ChatGPT’s default shortcut is Cmd/Ctrl + Shift + C; change it to Cmd/Ctrl + C or turn it off in Settings → Advanced. Reader uses Cmd/Ctrl + C.

## How do I copy a formula?

Click it in the original reply. Inline formulas use `$...$` and display formulas use `$$...$$` by default. Set separate formats for single formulas and whole-message Markdown under Settings → Copy & export.

Enable image actions under Settings → Buttons → Formula to copy PNG, SVG, or MathML, or save PNG or SVG. SVG and MathML require available formula source. The input formula preview also offers these actions.

## What can bookmarks save?

Bookmarks save a conversation link or a reply. Page bookmarks keep a name and link; message bookmarks save the question and reply for reading and copying. Folders organize bookmarks into up to four levels.

With Save only bookmark excerpts enabled, questions and replies longer than 500 characters each keep 250 from the start and 250 from the end. Open the original conversation for the full text.

## How do I manage many bookmarks?

Choose a folder on the left, or search. Lists show 20 items per page. Use the row buttons to rename, move or delete a bookmark; use the folder menu for folder actions. Filters, sorting, import, export and selection controls sit beside the Library heading.

“Select this page” selects the current page. “Select all bookmarks” and “Invert bookmarks” apply across all results matching the current filters. Paging preserves selection; changing the folder, type or search clears it. A single folder must be empty before deletion. Bulk folder deletion includes its bookmarks and subfolders, with counts shown before confirmation.

## How does export work?

Open Export below a reply or in a directory preview, select messages, and choose Markdown, PDF, or PNG. Markdown stays editable; PDF uses the browser’s print dialog with Save as PDF; PNG creates long images, and multiple images can be packed in a ZIP. Batch selection is supported, with progress and cancellation during image generation.

## Can I hide buttons or change the theme?

Use Settings → Buttons to configure page, reply, formula, selection, and directory buttons, and keep common page or reply actions visible. Theme, font size, and accent color are under Appearance & layout. Follow the page or use light or dark mode, and choose a preset or custom accent color. Search finds controls across all eight categories.

## Where does Google Drive backup save my data?

The experimental backup flow stores your saved bookmarks, highlights, annotations, and their folders in your own Drive under `AI-MarkDone/Backups/bookmarks`. It excludes unsaved annotations, excerpts, prompts, extension settings, and OAuth credentials. A full local Library export contains the same saved items. Older bookmark-only files still import and affect bookmarks alone.

Backup verifies the uploaded snapshot. Restore shows a merge preview: local-only items remain, duplicates are skipped, and conflicts keep the local copy by default. This is not real-time synchronization.

Manage cloud files or test the connection under Data & backup. Trashing a Drive backup does not delete local Library data. Sign out revokes the current Drive grant and clears its cached authorization. An interrupted upload can leave a file in Drive; failed verification reports whether cleanup is needed.

## How do message navigation and the directory work?

Use the page’s lower-right previous/next buttons. Left and right arrow keys also navigate when you are not typing, if enabled.

Enable the directory under Settings → Reading & messages, choose compact previews or an expanded list, and adjust summaries, preview length, and right spacing. Regular messages join the directory as they load; unloaded history may be missing. Official navigation visibility is in the same category; navigation shortcuts and jump distance are under Advanced.

## What does the character count include?

The existing Chars calculation counts each CJK character as two and Latin text by its counted characters after punctuation handling. Fenced code, inline code and formulas are excluded. A reply containing only code shows zero.

The optional time below the count comes from the website's message metadata: update time first, creation time otherwise. It is omitted when unavailable.

## Is AI-MarkDone paid?

AI-MarkDone is free. Feedback, reviews and optional support help its development.
