# AI-MarkDone Product Context

This file defines the short, shared vocabulary used in product discussion, implementation, and documentation. Detailed behavior remains authoritative in `docs/FEATURES.md` and `docs/architecture/CURRENT_STATE.md`.

## ChatGPT Input Enhancement

- **Input Enhancement**: the complete optional authoring layer attached to the official ChatGPT composer. It does not replace the composer or render rich text inside it.
- **Availability switch**: `chatgptBehavior.inputEnhancement.available`, shown in bookmark Settings. Turning it off hides the composer button and pauses every enhancement while preserving detailed preferences.
- **Runtime master switch**: `chatgptBehavior.inputEnhancement.enabled`, shown in the composer popover. It controls whether the button is highlighted and whether any child capability runs.
- **Enter-newline**: intercepts ordinary Enter outside lists. Cmd/Ctrl + Enter remains the send shortcut; Shift + Enter remains host-owned.
- **List enhancement**: the parent capability for CommonMark-aware list authoring. Ordered and unordered lists are independently selectable beneath it, while each list type keeps its own complete behavior set.
- **Bold shortcut**: Cmd/Ctrl + B inserts or removes visible `**` markers; it is not rich-text rendering.
- **Formula suggestions**: formula-local LaTeX snippet completion for `\\` tokens inside `$...$` or `$$...$$`.
- **Formula preview**: lightweight anchored rendering for inline and display formulas. It never rewrites or renders inside the source composer.

Both master switches preserve child values when disabled. Effective capability state is always derived from availability, runtime master, and the corresponding child switch.
