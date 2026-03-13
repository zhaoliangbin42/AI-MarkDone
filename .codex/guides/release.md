# Release Guide

## Applies To

- Version preparation
- Store submission preparation
- Release-note finalization

## Start Here

- Read `.codex/rules/changelog.md`
- Read `docs/testing/CURRENT_TEST_GATES.md`
- Read `docs/testing/E2E_REGRESSION_GUIDE.md`
- Read `docs/architecture/BROWSER_COMPATIBILITY.md`

## Workflow

1. Confirm the release scope and the user-visible changes that must appear in `CHANGELOG.md`.
2. Scan for unresolved blockers and release-hostile leftovers.
   - `rg -n "console\\.log" src tests`
   - `rg -n "!important" src`
3. Verify version alignment across `package.json`, `package-lock.json`, and both manifest files.
4. Run the minimum release gates in order:
   - `npm run test:smoke`
   - `npm run test:core`
   - `npm run build`
5. Confirm both build targets are complete:
   - `dist-chrome/`
   - `dist-firefox/`
   - copied manifest, icons, popup, locales, and KaTeX assets
6. Confirm entry format verification passed for both targets.
7. Update `CHANGELOG.md` and any user-facing release references.
8. If the release changes adapters, runtime protocol, or browser support behavior, update the corresponding docs before finishing.

## References

- `.codex/rules/changelog.md`
- `.codex/rules/documentation.md`
- `docs/testing/E2E_REGRESSION_GUIDE.md`
- `docs/architecture/BROWSER_COMPATIBILITY.md`

## Done When

- Version identifiers are aligned.
- User-facing docs are up to date.
- Smoke, core, and build gates have run successfully.
- Both browser targets produce loadable artifacts with verified entry format.
- `npm run build` succeeds.
