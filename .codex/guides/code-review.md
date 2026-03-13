# Code Review Guide

## Purpose

Reviews focus on correctness, regressions, risk, and missing verification before stylistic polish.

## Review Pass

1. Verify the stated scope matches the changed files.
2. Check for behavioral regressions, not just local correctness.
3. Check architecture and contract alignment.
4. Check logging, comments, and style-rule compliance where relevant.
5. Check whether tests and docs moved with the change.
6. Confirm build verification was run when required.
7. Check whether the change documents edge cases or leaves important untested paths unstated.

## Static Checks

Useful repository checks:

```bash
rg -n "console\\.log" src tests
rg -n "!important" src
rg -n "//\\s*(TODO|FIXME)(?!\\([^)]+\\):)" -P src tests
rg -n "//\\s*@ts-expect-error(?!.*--)" -P src tests
rg -n "//\\s*eslint-disable-next-line(?!.*--)" -P src tests
npm run build
```

## References

- `.codex/rules/critical-rules.md`
- `.codex/rules/commenting.md`
- `.codex/rules/style-guide.md`
- `docs/architecture/DEPENDENCY_RULES.md`
- `docs/testing/TESTING_BLUEPRINT.md`

## Done When

- Findings are ordered by severity.
- Missing tests or docs are called out explicitly.
- Verification status is stated, not assumed.
