---
description: Commenting - keep only why/constraints/contracts
---

# 🗒️ Commenting

## Goal

Make code as self-explanatory as possible. Comments should only capture information that cannot be reliably inferred from code (why/constraints/risks/compatibility trade-offs/external contracts).

## Principles

| Principle | Description |
|:--|:--|
| **Prefer code changes over comments** | Improve naming, split functions, extract constants, and strengthen types/assertions to remove the need for explanatory comments. |
| **Only write non-derivable information** | E.g., why this is required, known pitfalls, compatibility constraints, performance trade-offs, or external API contracts. |
| **Comments must be verifiable** | Readers should be able to trace the reason (links, keywords, reproduction steps, constraint source). |
| **Comments must be maintainable** | Avoid repeating what the code already says; avoid “forever TODOs”; avoid long paragraphs. |
| **Comments must be in English** | All code comments (including JSDoc/TSDoc, `//` comments, and directive reasons) must be written in English. |

## Allowed comment types (by priority)

### 1) Why / constraints / trade-offs (recommended)

When to use:
- SPA re-render/hydration replaces injected DOM.
- Platform differences (ChatGPT/Gemini/Claude/Deepseek) in DOM structure.
- Performance/stability trade-offs (e.g., debounce, microtask, WeakSet).
- Explicit invariants or ordering constraints (“must do A before B, otherwise C happens”).

Requirements:
- Prefer 1–3 lines; avoid long paragraphs.
- Include a trigger condition or a reproducible description when possible.

### 2) JSDoc/TSDoc for public contracts (public API)

Scope:
- Exported classes/functions/types (cross-module/public contracts).
- Adapter contracts (cross-platform adapter interfaces and key return semantics).

Requirements:
- Write semantics only (what input means, what output guarantees, how failures surface).
- Do not repeat information already present in types/signatures.
- Add examples only when the API is easy to misuse or misunderstand.

### 3) Directive comments (must include a reason)

Includes (not limited to):
- `// eslint-disable-next-line ...`
- `// @ts-expect-error ...`
- `/* istanbul ignore next */`

Requirements:
- The same line (or the next line) must include the **reason** (why), for example:
  - `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- DOM callback arg type is browser-defined`
  - `// @ts-expect-error -- upstream type bug: <link>`

### 4) TODO / FIXME (allowed but must be traceable)

Format requirements (mandatory):
- `TODO(owner): ...` or `FIXME(owner): ...`
- If there is a corresponding issue/PR: append `(#123)` or a short link (prefer issue numbers).
- Must describe completion/exit criteria; avoid vague “check later”.

Examples:
- `// TODO(benko): remove microtask queue once adapters expose stable container selector (#412)`
- `// FIXME(team): handle Gemini streaming edge-case when action bar is injected late (repro: ... )`

## Prohibited comment types

| Prohibited | Reason |
|:--|:--|
| **“What” comments** | They duplicate the code and quickly go stale (e.g., “Loop through items”, “Set x to 1”). |
| **Long implementation narratives** | Hard to maintain; should be expressed via structure and naming. |
| **TODOs without owner/exit criteria** | Not traceable and accumulate as noise. |
| **Temporary debug notes in shipped code** | E.g., “debug only”, “temp fix” without a reason and exit criteria. |

## Review checklist (before shipping)

- [ ] Can a rename/split/extract eliminate the comment?
- [ ] Are remaining comments only why/constraints/trade-offs/contracts?
- [ ] Are there any “what” comments that can be deleted?
- [ ] Do `eslint-disable` / `@ts-expect-error` directives include a reason?
- [ ] Do `TODO/FIXME` entries include an owner and exit criteria (preferably with an issue)?
