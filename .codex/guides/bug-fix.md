# Bug Fix Guide

## Applies To

- Regressions
- Production bugs
- Mismatches between expected and actual behavior

## Start Here

- Reproduce the bug or collect enough evidence to define the failure mode.
- Read the relevant contract, architecture, or capability document.
- Confirm whether the fix must preserve an existing public or cross-runtime contract.

## Workflow

1. Capture expected behavior, actual behavior, and reproduction steps.
2. Add a failing reproducer test first whenever the bug is testable in this repository.
3. Identify the failing boundary: UI, service, driver, contract, or build/runtime packaging.
4. If the user identifies a known-good release, compare the current path against that release before editing. Treat the known-good release as evidence, not anecdote.
5. For focus, input, or keyboard regressions, include IME or composition-mode coverage when the affected surface accepts text input. Do not sign off on a fix based only on plain Latin-character typing.
6. For overlay, modal, popover, panel, menu, or transient-surface regressions, include a test that follows the real browser event order (`pointerdown` before `click`) for the user-facing trigger path. Do not rely only on synthetic `.click()` when outside-dismiss logic is involved.
7. When the failure depends on external runtime state that local fixtures cannot faithfully model, gather live-environment evidence before editing. Typical cases include host-page DOM contracts, browser event ordering, hydration/virtualization behavior, extension permission boundaries, and third-party API payload shape. Keep this as a judgment call: explain why fixtures are insufficient, what live probes prove, and which source or contract boundary the fix relies on.
8. Confirm the root cause before editing.
9. Apply the smallest fix that restores behavior.
10. Update or expand tests until the reproducer passes.
11. Update docs if the bug exposed incorrect documented behavior or changed a contract.
12. Finish with `npm run build`.

## References

- `.codex/rules/critical-rules.md`
- `.codex/rules/logging.md`
- `docs/testing/TESTING_BLUEPRINT.md`
- `docs/architecture/BROWSER_COMPATIBILITY.md`

## Done When

- The original failure mode is covered by evidence or tests.
- No public or cross-runtime contract was silently broken.
- `npm run build` succeeds.
- Remaining edge cases and recommended follow-up tests are explicit.
