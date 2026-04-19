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
   - Update the latest release summary in `README.md` and `README.zh.md` when the highlighted version changes.
   - If the release changes bookmarks information pages, review and update the relevant files under `src/ui/content/bookmarks/content/`.
   - At minimum, explicitly check `changelog.zh.md`, `changelog.en.md`, `faq.zh.md`, `faq.en.md`, `about.zh.md`, and `about.en.md` before submission.
8. Perform maintainer manual review for all release-facing copy before finishing.
   - `CHANGELOG.md`
   - `README.md`
   - `README.zh.md`
   - any touched files under `src/ui/content/bookmarks/content/`
   - This manual review is required even if tests and build already pass.
9. If the release changes adapters, runtime protocol, or browser support behavior, update the corresponding docs before finishing.

## References

- `.codex/rules/changelog.md`
- `.codex/rules/documentation.md`
- `docs/testing/E2E_REGRESSION_GUIDE.md`
- `docs/architecture/BROWSER_COMPATIBILITY.md`

## Done When

- Version identifiers are aligned.
- User-facing docs are up to date.
- Release-facing copy has been manually reviewed by the maintainer.
- Smoke, core, and build gates have run successfully.
- Both browser targets produce loadable artifacts with verified entry format.
- `npm run build` succeeds.
