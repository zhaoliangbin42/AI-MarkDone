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
