# Third-Party Notices

## LaTeX Workshop completion data

The formula-authoring catalog in `public/vendor/latex-workshop/formula-snippets.json`
contains a filtered subset of command and environment completion records from
[LaTeX Workshop](https://github.com/James-Yu/LaTeX-Workshop), fixed to commit
`d4b1410b82cc634fef18989dfc53db58a55484c9`.

LaTeX Workshop is distributed under its
[MIT License](https://github.com/James-Yu/LaTeX-Workshop/blob/d4b1410b82cc634fef18989dfc53db58a55484c9/LICENSE.txt).
Its `data/README.md` states
that package completion JSON is generated from TeXStudio CWL completion files;
TeXStudio is distributed under
[GPL-3.0](https://github.com/texstudio-org/texstudio/blob/master/COPYING).
AI-MarkDone excludes LaTeX Workshop's
`at-suggestions.json` and `unimathsymbols.json`; the runtime provides no `@`
shortcut syntax.

The generated catalog records its exact upstream files and commit. Run
`npm run generate:latex-snippets` to refresh it deliberately; normal builds do
not access the network.

## Lezer Markdown parser

AI-MarkDone uses [`@lezer/markdown`](https://github.com/lezer-parser/markdown)
to identify CommonMark list structure in the ChatGPT composer. Lezer
Markdown is distributed under the
[MIT License](https://github.com/lezer-parser/markdown/blob/main/LICENSE).

## CodeMirror Markdown command semantics

AI-MarkDone's list Enter and ordered-list Backspace behavior adapt the
continuation, list-marker deletion, and sibling-renumbering semantics from
[`@codemirror/lang-markdown` 6.5.0](https://github.com/codemirror/lang-markdown/tree/6.5.0/src),
which is distributed under the
[MIT License](https://github.com/codemirror/lang-markdown/blob/6.5.0/LICENSE).
AI-MarkDone does not bundle the CodeMirror editor; its second Backspace uses the
product-specific direct-join behavior documented in this repository.


## Reader document theme references

Reader adapts the light/dark palette and familiar Markdown presentation of
[github-markdown-css](https://github.com/sindresorhus/github-markdown-css), and
the light/dark palettes of [Solarized](https://ethanschoonover.com/solarized/),
[Nord](https://www.nordtheme.com/docs/colors-and-palettes/) and
[Dracula](https://draculatheme.com/spec). Reference date: 2026-10-28.
The implementation is scoped to the existing Reader and the AI-MarkDone token
system; no upstream stylesheet, JavaScript, font or image is loaded at runtime.
The Paper text/link colors and divider, supporting dark-theme text, and Nord
code colors are adjusted for reading contrast on the local surfaces.

MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Copyright (c) 2011 Ethan Schoonover

Copyright (c) 2016-present Sven Greb <development@svengreb.de> (https://www.svengreb.de)

Copyright (c) 2023 Dracula Theme

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
