# Changelog

# 4.6.0
2026-06-18

Hi everyone. This update has been brewing for a long time, and it is a fairly large one.

For a while now, I have wanted to solve a very specific and very annoying problem: long ChatGPT conversations can become painfully slow. I am a Pro user, and when I use Pro models, each answer can be very long. In my own daily use, once a conversation has more than three very long messages, the page can already feel heavy. Even Reader could only ease the problem before; it could not remove the underlying pressure completely.

The reason is not mysterious. ChatGPT's page has to render a lot of heavy Markdown, especially when a response contains many formulas. When that rendering pressure is high, everything you do inside the ChatGPT page can become slower: scrolling, clicking, copying, and even opening extension UI. ChatGPT has already optimized this. Around the end of April, the page started moving toward incremental loading, where older messages can be unloaded to reduce the total rendering cost. Even so, the rendering pressure of very long messages does not disappear.

So this time I tried a different route: if the ChatGPT page itself is slow, can we step outside that page?

## How it works

This is my favorite part.

AI-MarkDone already had Reader. On the ChatGPT page, it discovers messages, extracts the content, normalizes the structure, and renders everything again inside Reader. Since AI-MarkDone can already extract the messages, I started wondering whether the same Reader could be opened in an independent extension page.

After checking the browser extension APIs, I found that this is possible. An extension page can build a bridge with the original ChatGPT tab through the browser runtime. In other words, the independent page renders the full Reader, while the original ChatGPT tab still provides content, refresh, send, locate, and source-position actions. The two sides stay connected through browser-internal messaging.

This means the main reading experience no longer depends on ChatGPT's own DOM and Markdown rendering load. The detached Reader runs in the extension's own page, with a cleaner environment and more controllable rendering cost. You can still refresh, send, and locate the original message, but the reading surface has been pulled out of the slow page.

In practice, this was not just a matter of moving the Reader somewhere else. The bridge, session lifecycle, refresh, send, locate, bookmarks, themes, and formula styling all had to line up across the original page and the independent page. Since this is now a real Reader, I also moved several reading controls back into the Reader itself: font size, width, and display preferences can now be adjusted directly while reading.

Honestly, I now prefer continuing conversations from Reader myself. It avoids long-page lag and gives me annotations, Sticky, copy, bookmarks, and other small conveniences in one place. If you often read long conversations and have not tried Reader yet, I really recommend giving it a try.

## Privacy

I also want to be very clear about privacy.

AI-MarkDone currently has no networking capability, and all of the code is public on GitHub. If you are unsure, you can send the GitHub link to ChatGPT and ask it to help inspect the code with you.

The content discovery path exists to support Copy Markdown, navigation, Reader, bookmarks, and export. These features need to read the current page content before they can work. The new detached Reader follows the same principle: it runs inside a browser-managed extension page and talks to the original ChatGPT tab through an internal browser channel. It does not send your content to any external server. When you close the detached page, that session ends as well; it is not saved as an extra long-term copy.

## ==A small introduction to my iOS app: Mappamory==

==Now comes the part where I reveal my little personal agenda. Graduation season is here, and many friends are heading to different places. I have always wanted a simple place to remember friends' hometowns, workplaces, schools, and cities they often visit. Because of that real need, I built an iOS app called “好友迹”, with the English name Mappamory.==

==It is a friends map contact book. You can create people, add multiple places for each person, and tag those places. The people and places then appear on a map. Every time a friend mentions a place, you can quickly record it. Over time, the map slowly fills up, and you may realize how many people around you have scattered across different cities.==

==When you meet again, you will not have to feel awkward because you forgot someone's hometown, school, or workplace. When you arrive in a city, you can open the map and remember that a friend is living there, and maybe decide to meet. The app is designed to be easy to use, simple, and pleasant.==

![Mappamory - friends map contacts](icons/mappamory-changelog-4.6.0.png)

==The app has just launched. If you download it before June 30, 2026, please contact me on Xiaohongshu or X, and I will give each person a one-year redemption code. I would also love your feedback, support, and help sharing it. I really enjoy the feeling of people working together to make something better.==

==One more note: Mappamory is not a social app. It does not require an account or network access. Everything you record stays local on your device. If you are interested, you are very welcome to try it.==

==Download: [https://apps.apple.com/cn/app/mappamory/id6769453796](https://apps.apple.com/cn/app/mappamory/id6769453796?l=en-GB)==

==Thank you again. AI-MarkDone will not run any third-party ads, but I hope you will not mind me introducing my own app here. Haha, ~\(>=▽<=)/~==

## Added

- Added detached Reader view mode, which opens Reader in an independent extension page to avoid ChatGPT long-message page lag. The entry is in the lower-right corner of the ChatGPT page.
- Added a setting to open Reader fullscreen by default.
- Added Reader-local display controls such as font size and width, making long reading sessions more comfortable.
- Added an option for formula click-copy to include `$...$` or `$$...$$` math delimiters automatically. Thanks to Email user @Jiangpeng.

## Improved

- Reworked the single-formula PNG/SVG/MathML export path. Formula image export now prefers the formula DOM already rendered on the page, so Chinese text, underbraces, matrices, and other complex formulas should be more stable. Thanks to Xiaohongshu users @千载角黍 and @小红薯67542EF1.
- Aligned detached Reader with in-page Reader for refresh, send, locate, bookmarks, theme, and formula rendering.

## Fixed

- Fixed Markdown parsing where inline `$$...$$` could be treated as display math. Thanks to Xiaohongshu user @花花有点坏.
- Fixed cases where formula image export could fail, render Chinese text incorrectly, or become unstable for larger formulas.
- Fixed ChatGPT component wrappers leaking into Reader, copy, export, and bookmark content.

## Daily Tips

- You can use the Left and Right arrow keys on the page to switch between previous and next messages, as long as the cursor is not inside the input box. In short: click an empty area first, then press the arrow keys. If it does not work, you can enable it separately in Settings.
- Most features can be turned on or off individually from Settings. If something feels distracting, open Settings, find the matching switch, and turn it off.
- Your ratings and feedback are what keep me improving AI-MarkDone. You are also welcome to leave me a message on X: https://x.com/Benkozhao.

# 4.5.1
2026-06-07

Friends, thank you for waiting, and thank you for all the support. A few days ago, ChatGPT started rolling out its own conversation navigation rail, so in the previous version I removed the AI-MarkDone navigation rail. What I did not expect was that many people reached out and told me their ChatGPT page did not have that official rail. It now looks like the official navigation is probably a staged rollout rather than something available to everyone.

So in this version, the AI-MarkDone navigation rail is back. When you enable the plugin rail, AI-MarkDone will hide ChatGPT's official rail by default so the two do not appear at the same time. Some people also told me they prefer the plugin rail, so this version gives that choice back to you.

This release also includes several fixes. The ==website== built specifically for AI-MarkDone is now mostly ready as well. You are very welcome to visit it and help share it. It contains many practical guides for using the extension, and because I also want to help people understand how things work, I have added some notes about extension development too. There is still a lot to improve on the site, because the workload is not small, but if you are interested, feel free to bookmark it early.

If AI-MarkDone is useful to you, a five-star rating and a short review in the extension store would help a lot. Sharing it with more people is also very welcome, so the extension can reach others who need it.

## Restored

- Restored the ChatGPT right-side navigation rail. Since some users already have ChatGPT's official rail, enabling the AI-MarkDone rail now hides the official one by default. Thanks to everyone on Xiaohongshu who kept asking for it.
- Restored formula recognition support for DeepSeek, Claude, and Gemini. Some users said removing these platforms also removed a high-frequency formula workflow. After weighing the complexity of formula recognition against how often these websites change, I decided to restore formula recognition only. Other features on those platforms will not be maintained. Thanks to Xiaohongshu user @蝴蝶译梦机.

## Fixed

- Reader extraction now correctly handles new ChatGPT noise content. Previously, formulas or underlined text could sometimes turn into strange characters in Reader or copied Markdown source. In short, these are ChatGPT's new generative UI blocks or internal annotations; AI-MarkDone now cleans them before Reader, copy, export, and bookmark save. Thanks to Xiaohongshu user @momo.
- Fixed Firefox content discovery failures that could break bookmark saving, Copy Markdown, Reader, and related features. Thanks to Xiaohongshu user @老年人.

## Website and Support

- The ==website== is mostly ready: https://zhaoliangbin42.github.io/ai-markdone/en/
- If you like the extension, ratings, reviews, and sharing are all very welcome. They help AI-MarkDone reach more people who may need it.

# 4.5.0
2026-06-05

Thanks for waiting. I wanted this update to feel like a real meal, so I spent a lot of time in the kitchen. I believe good food is worth the wait, and I think this release is one of those good meals. It adds several practical features, fixes a number of rough edges, and finally brings AI-MarkDone its own product website.

## Google Drive Backup

The biggest and most time-consuming feature in this release is Google Drive Backup. You can find it in Settings. The authorization flow is intentionally direct: click the button, follow Google's authorization page, and you are ready to back up.

AI-MarkDone itself does not collect your information. Your data stays on this device, or, after you authorize Google Drive, in your own Drive. Once connected, you can back up your bookmarks to Google Drive and restore them on another device.

Restore does not write immediately. It first shows a preview of the merge result. The restore path uses safe merge: it keeps your existing local bookmarks and only adds remote-only items. This feature is still experimental, though, so before using it for the first time, please export a local copy of your bookmarks.

## Position Restore and Message Switching

This release also adds two practical ChatGPT improvements.

First, after sending a message, AI-MarkDone can keep you near your current reading position instead of letting ChatGPT force you to the bottom every time. Second, you can use the Left and Right arrow keys to move between messages. If you do not like keyboard navigation, you can turn it off from Settings.

Both features are small on the surface, but they solve real reading pain: staying focused, moving faster, and landing on the right message more precisely.

## Platform and Navigation Cleanup

AI-MarkDone now retires DeepSeek, Claude, and Gemini page adaptation. Existing bookmarks from those platforms stay in the bookmarks panel and will not be deleted. I am focusing maintenance on ChatGPT, because I want the ChatGPT path to be as polished, reliable, and useful as possible.

The old AI-MarkDone right-side navigation rail is also gone for now. It was originally a useful replacement when ChatGPT did not provide its own navigation. Now that ChatGPT has an official navigation experience, I think our old rail no longer needs to stay on the page. I will continue watching feedback.

## Website

One more piece of good news: the long-delayed product website is finally online.

Website: https://zhaoliangbin42.github.io/ai-markdone/en/

The site is still not perfect, but I hope it helps AI-MarkDone reach more people who have the same workflow pain. The extension will stay free. If you like it, ratings in the extension store and stars on GitHub are both very welcome.

## How it works

This time I want to explain a bug that made the extension feel disconnected after a ChatGPT tab had been open for a long time.

The reason is related to how modern Chrome extensions work. Under Manifest V3, the background runtime is not a page that stays alive forever. It is an event-driven service worker. When the browser thinks it has nothing to do, it may stop that worker and wake it again later.

At the same time, a ChatGPT tab left in the background for a long time may be frozen, discarded, or restored lazily by the browser. When the extension background tries to send a message to that tab, the tab may already be closed, its id may be stale, or the content script inside the page may not be ready yet. That is when errors like "No tab with id" or "Receiving end does not exist" can appear.

The fix is not to keep the background alive forever. That would waste resources and fight the browser. Instead, AI-MarkDone now treats those lifecycle failures as normal: before toggling the UI, it pings the page first; if the page is not ready, it does not force the command. When the ChatGPT page becomes available again, the content script sends a ready signal back to the background, and the background updates state using the real tab id.

In short: no polling, no artificial keep-alive, and no background busywork. The page and background simply reconnect when the browser wakes them. I will keep watching this path, but I think this is the right direction: recover when needed without quietly burning system resources.

## Added

- Added Google Drive Backup and Restore (experimental). Please send feedback, and export a local copy before using it for the first time. Thanks to GitHub user @eagleshang5-lang and Xiaohongshu user @Lunas.
- Added restore-position-after-send, so sending a message does not always pull you to the bottom. Thanks to Xiaohongshu user @不歸.
- Added Left / Right arrow-key message navigation for the lower-right stepper. Both the buttons and keyboard navigation can be turned off in Settings.
- Launched the product website. Sharing, store ratings, and GitHub stars are very welcome.

## Improved

- Save Messages from the toolbar now selects only the current message by default instead of selecting the whole conversation. Thanks to Xiaohongshu user @momo and Email user @Johan Song.
- The lower-right stepper is now horizontal, which better matches the Previous / Next message action.
- During page-width changes, the extension enters temporary resize suspend more quickly to reduce repeated rendering while dragging the window.

## Changed

- Retired DeepSeek, Claude, and Gemini page adaptation. Existing bookmarks from those platforms remain in the bookmarks panel.
- Removed the old AI-MarkDone right-side navigation rail for now, while keeping the lighter lower-right Previous / Next message stepper.

## Fixed

- Improved recovery when a ChatGPT tab has been open for a long time and the extension needs to reconnect.

# 4.4.6
2026-05-28

This update continues the Google Drive Backup rollout and makes the backup lifecycle easier to understand: the feature is marked experimental, restore preview uses the same detailed merge review as local import, Drive backup files can be moved to trash from the settings panel, and the connected Google Drive account is shown without turning the settings panel into a console.

## Fixed
- Fixed stutter in the ChatGPT navigation rail.
- Fixed a split between toolbar Copy and Reader Copy. In the previous release, the toolbar copy button could sometimes fail because it did not follow the same content path as Reader. Thanks to Xiaohongshu user @momo.

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
- Added a Prompt Library so you can manage reusable prompts in `Settings > Reader > Prompts`.
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
