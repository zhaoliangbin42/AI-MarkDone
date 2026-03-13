# Commenting

Comments should capture information that cannot be reliably inferred from the code itself.

## Use Comments For

- Why a behavior exists.
- Constraints imposed by host platforms, browser APIs, or runtime lifecycles.
- Compatibility trade-offs across ChatGPT, Gemini, Claude, and DeepSeek.
- Public contract semantics that are easy to misuse.
- Directive reasons, such as `@ts-expect-error` or `eslint-disable-next-line`.

## Avoid

- Explaining what the code already says.
- Long implementation narratives.
- Temporary debug notes in shipped code.
- TODO or FIXME comments without an owner and exit criteria.

## Required Formats

- Code comments must be in English.
- Directive comments must include a reason on the same line or the next line.
- TODO and FIXME must use `TODO(owner): ...` or `FIXME(owner): ...`.

## Review Checks

- Could better naming or extraction remove this comment?
- Does the comment describe why, a constraint, or a contract rather than what?
- Does every directive comment include a reason?
