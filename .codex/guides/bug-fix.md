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
6. Confirm the root cause before editing.
7. Apply the smallest fix that restores behavior.
8. Update or expand tests until the reproducer passes.
9. Update docs if the bug exposed incorrect documented behavior or changed a contract.
10. Finish with `npm run build`.

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
