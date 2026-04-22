# FAQ

## Which platforms does this extension support?

ChatGPT is still the main platform I build and test against. That is where AI-MarkDone is the most complete and the most thoroughly tested. The extension also supports Gemini, Claude, and DeepSeek.

That said, those other three are not the platforms I use every day, so the test coverage is not always as deep as it is on ChatGPT. If you run into issues there, feel free to email me at zhaoliangbin42@gmail.com

## What does the extension actually do, and where do I find each feature?

- Reader: toolbar -> Reader
- Source copy: toolbar -> Copy Markdown
- Click to copy formulas: just click the formula inside the message
- Save bookmark: toolbar -> Bookmark
- Export messages: toolbar -> Export
- Word count: toolbar stats area
- ChatGPT conversation directory: right-side directory rail on ChatGPT pages
- Dynamic Annotation: select content inside Reader -> floating annotation button
- Copy annotations: Reader top bar -> Copy annotations
- Insert annotations: above the send box in Reader -> Insert annotations
- Bookmark management: click the extension icon -> bookmarks panel
- Feature toggles and settings: bookmarks panel -> Settings

## The original page already looks fine. Why make a Reader?

Because the original page is built for chatting, not necessarily for reading carefully.

Once a conversation gets long, the page starts competing for your attention. Buttons, references, long scroll ranges, streaming UI, and side navigation all add up. Reader is meant to give you a calmer surface so you can actually read.

To make that useful in practice, Reader also includes fullscreen mode, message switching, quick previews, send actions, and toolbar shortcuts. You do not have to keep bouncing back to the host page just to continue working.

It also includes two features I personally rely on a lot: source-aware copy and Dynamic Annotation.

## I heard there is something called Dynamic Annotation. What is it actually for?

If you often ask ChatGPT to revise writing, this will probably feel familiar: you get a long answer, but only parts of it need work.

The old way is tedious. You copy one sentence, add a note, copy another sentence, add another note, and eventually you end up with a messy prompt that took too much effort to assemble.

Dynamic Annotation is meant to make that workflow less annoying. In Reader, you can select any sentence or paragraph, click the floating annotation button, and write what you want changed. Once you have annotated everything you care about, the "Copy annotations" action in the Reader header gives you a clean way to export everything in one structured block.

You can paste that back into ChatGPT and ask for a batch revision. If you want an even shorter path, you can also insert the compiled result directly into the send box in the lower-left corner of Reader.

## Can I customize the structured text that gets copied after annotation?

Yes.

The relevant settings are here:

- Settings -> Reader -> User prompts
- Settings -> Reader -> Annotations copy template

They do different jobs:

- User prompts are reusable prompt headers, such as "Please revise the following passages" or "Rewrite this in a more academic tone"
- Annotations copy template controls how each annotated item is assembled, for example whether the selected source appears before your note or after it

If you want a simple setup that works well, I would start with:

- two or three reusable prompt headers for your common use cases
- a very plain template that shows the original text first and your annotation second

That usually gives the model the clearest context.

## When should I switch to Reader instead of staying on the original page?

If you are only skimming, the original page is fine. But once you move into "I need to actually work with this" mode, Reader is usually the better place to be.

Reader rebuilds the content from the page source and then renders it again in a more controlled surface. One practical upside is that formulas that fail to render cleanly on the host page can sometimes render correctly in Reader. I cannot promise that every time, but it does help in real use.

The other reason is performance. Long ChatGPT threads can get sluggish fast. Reader uses a lighter rendering path, so reading, previewing, and switching messages tends to feel smoother.

## I do not want to copy a whole message. Can I copy Markdown source for just part of it?

Yes. That is one of the strongest Reader features.

Inside Reader, I rebuilt the Markdown rendering path so the visible surface stays much closer to the underlying structure. In practice, that means you can select almost any range inside Reader and copy it as source-aware Markdown instead of getting a flattened chunk of rendered text.

If you take notes, quote paragraphs, revise drafts, or only want part of a formula, list, or code example, this is much more usable than copying from the original page.

## How do I use click-to-copy for formulas?

This one is straightforward. You do not need to open Reader first.

If all you want is a specific formula, just click the formula itself inside the original message. The extension will try to copy the corresponding LaTeX source, so you do not have to copy the whole block first and then dig the formula back out by hand.

I use this a lot when I am taking notes or moving formulas into Typora, Obsidian, or other editors. It is much faster when the goal is just one formula, not an entire paragraph around it.

If you need more than a single formula, for example a mixed range that includes normal text, formulas, code, or lists, then Reader and source-aware partial copy are still the better option.

## What is the bookmarks feature actually for?

For me, the biggest risk with useful AI output is not "I cannot generate it again." It is "I know it was good, but now I cannot find it."

Bookmarks are there for that exact problem. You can save useful messages, organize them into folders, and come back later without digging through an endless chat history.

A few real examples:

- keep strong prompt examples in one folder
- save writing fragments you may want to reuse later
- collect technical explanations worth keeping
- keep project discussions and solution drafts separated

Used that way, the bookmarks panel becomes less like a favorites list and more like a working archive.

## What is the fastest way to manage bookmarks once I have a lot of them?

The simplest workflow is: save first, organize later.

Click the extension icon to open the bookmarks panel. From there you can:

- search bookmarks
- filter by platform
- create folders
- move items
- import or export
- delete in batches

Each bookmark also has a preview path. You can open it, review it, move across nearby bookmarks, and jump back to the source conversation when needed.

That is why I see the bookmarks system less as a place to "store favorites" and more as a working library for answers, prompts, drafts, and references you may want to come back to.

## How does export work, and when should I use it?

The goal is simple: sharing and saving messages should not depend on a platform link.

Sometimes you want to send something to someone else, archive it, keep it in your notes, or move it into another tool. In those cases, export is a lot more practical than a chat share link.

The basic flow is:

- click Export in the toolbar
- choose the messages you want
- export as Markdown or PDF

Markdown is the better choice if you want to keep editing, take notes, or store the result in a knowledge base. PDF is better if you want something closer to a finished document that is easy to share.

And yes, batch export is supported.

## Some toolbar buttons are not useful to me. Can I turn them off?

Yes.

Click the extension icon to open the bookmarks panel, then go to Settings. From there you can turn individual features on or off. That includes toolbar actions as well as Reader and annotation-related options.

I do not like tools that dump every feature on every user, so this part is meant to stay flexible.

## How do I use the ChatGPT conversation directory?

Open a ChatGPT conversation. The directory appears on the right side of the page.

Each item represents one user round. Hover an item to preview that part of the conversation, then click it to jump back to that position.

The directory is currently available on ChatGPT only.

## How does word count work?

It is meant to be practically useful, not academically perfect.

The current rules are:

- CJK characters such as Chinese, Japanese, and Korean count as 1 word each, and 2 chars each
- Latin text is split into words, then punctuation is stripped before counting
- fenced code blocks are excluded
- math formulas are excluded
- inline code is excluded

So the number is best treated as a quick reading signal: how long this reply is, and roughly how dense it feels.

One extra detail: if a message is basically code only, the toolbar will show `0 Words / 0 Chars` instead of pretending there is meaningful prose to count.

## Is this extension paid?

**It has to stay free.**

I built this project to solve problems I ran into all the time in my own daily use. As a graduate student, I spend a lot of time working with ChatGPT, and some of the missing pieces kept bothering me: copying source cleanly, annotating specific lines, exporting messages, saving useful content, and getting formulas into a format I actually want to keep.

Sometimes the copied math is not in the form I want. Sometimes there are strange line breaks. Sometimes rendering fails in the original page. And when I want ChatGPT to revise a long passage, the default workflow is awkward. There is no built-in way to annotate sentence by sentence and send those comments back in one structured pass. My old workaround was to copy each sentence manually and reply one by one. It worked, but it was slow and honestly kind of miserable.

That is where AI-MarkDone came from.

In a way, this extension is tailored to how I work. But I do not think I am the only person who works this way, so I would rather share it than keep it to myself.

If you find it useful, you are very welcome to **buy me a coffee**, **drop by on social media and leave a like**, or **leave a kind review** on the extension page. Support like that really does keep me going. And if you run into bugs or have ideas, I would be happy to hear from you.
