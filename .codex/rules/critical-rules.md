# Critical Rules

These are repository-wide hard constraints. Violating them means the change is incomplete.

## Do Not

- Do not use bulk `sed` replacement as an editing strategy.
- Do not use destructive rollback commands such as `git checkout --` or `git reset --hard`.
- Do not assume a file, symbol, selector, or contract exists without searching first.
- Do not hardcode product UI colors, spacing, radius, or z-index values when an `--aimd-*` token exists.
- Do not introduce `!important` outside print-specific rules.
- Do not report completion for repo-tracked code changes without running `npm run build`, unless the user explicitly asks to skip it.

## Always

- Search before editing. Prefer `rg` for text and file discovery.
- Keep changes minimal and aligned with the existing runtime and layer boundaries.
- Update the relevant authoritative docs when contracts, platform support, architecture boundaries, or test gates change.
- Preserve dual-browser compatibility for Chrome MV3 and Firefox MV2.
- Treat user corrections as process feedback that must change your approach, not as isolated patch instructions.
- For testable bug fixes, create a failing reproducer test before implementation changes.
- If the request is materially ambiguous, clarify before coding.
- After code changes, report edge cases and recommended tests instead of assuming coverage is complete.
