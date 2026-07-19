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
3. Verify version alignment across `package.json`, `package-lock.json`, `CHANGELOG.md`, and all generated manifest files:
   - `manifest.chrome.json`
   - `manifest.firefox.json`
4. Run the minimum release gates in order:
   - `npm run release:verify`
   - This expands to smoke tests, acceptance tests, and the Chrome/Firefox production build.
   - For broad behavior changes or risky refactors, also run `npm run test:core` separately after confirming required local mock fixtures are present.
5. Confirm all web extension build targets are complete:
   - `dist-chrome/`
   - `dist-firefox/`
   - copied manifest, icons, popup, locales, and KaTeX assets
6. Confirm entry format verification passed for Chrome and Firefox.
7. Package release artifacts under the repository `release/` directory:
   - Use the existing flat naming convention: `release/AI-MarkDone-v<version>-<target>.zip`.
   - Keep checksums version-scoped, for example `release/AI-MarkDone-v<version>-SHA256SUMS.txt`.
   - Do not place formal release packages under `release-artifacts/`; that directory is only for ignored local scratch output.
8. Update `CHANGELOG.md` and any user-facing release references.
   - Update the latest release summary in `README.md` and `README.zh.md` when the highlighted version changes.
   - Review the main feature bullets, release summary, and manual-install wording in `README.md` and `README.zh.md` so they still match the shipped release artifacts and feature set.
   - Update `RELEASE_NOTES.md` if the repository still uses it as a user-facing release summary.
   - If the release changes bookmarks information pages, review and update the relevant files under `src/ui/content/bookmarks/content/`.
   - At minimum, explicitly check `changelog.zh.md`, `changelog.en.md`, `faq.zh.md`, `faq.en.md`, `about.zh.md`, and `about.en.md` before submission.
9. Perform maintainer manual review for all release-facing copy before finishing.
   - `CHANGELOG.md`
   - `README.md`
   - `README.zh.md`
   - `RELEASE_NOTES.md`
   - any touched files under `src/ui/content/bookmarks/content/`
   - This manual review is required even if tests and build already pass.
10. If the release changes adapters, runtime protocol, or browser support behavior, update the corresponding docs before finishing.
11. Merge the verified release commit into `main` before tagging.
   - The release tag must point to the commit that is on `main`, not to an integration or feature branch commit that has not been merged.
   - Prefer a fast-forward merge when `main` has not diverged; otherwise resolve the merge and rerun the relevant release gates before tagging.
   - Push `main` first, then create and push the annotated release tag from the `main` HEAD.

## References

- `.codex/rules/changelog.md`
- `.codex/rules/documentation.md`
- `docs/testing/E2E_REGRESSION_GUIDE.md`
- `docs/architecture/BROWSER_COMPATIBILITY.md`

## Done When

- Version identifiers are aligned.
- User-facing docs are up to date.
- Release-facing copy has been manually reviewed by the maintainer.
- `npm run release:verify` has run successfully.
- Chrome and Firefox targets produce loadable artifacts with verified entry format.
- Formal release packages are placed under `release/` using `AI-MarkDone-v<version>-<target>` names, with version-scoped checksums.
- `npm run build` succeeds.
- The verified release commit is on `main`.
- The annotated version tag points at the `main` release commit.
