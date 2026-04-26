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
   - `manifest.safari.json`
4. Run the minimum release gates in order:
   - `npm run release:verify`
   - This expands to smoke tests, acceptance tests, and `npm run build:all:webext`.
   - For broad behavior changes or risky refactors, also run `npm run test:core` separately after confirming required local mock fixtures are present.
5. Confirm all web extension build targets are complete:
   - `dist-chrome/`
   - `dist-firefox/`
   - `dist-safari/`
   - copied manifest, icons, popup, locales, and KaTeX assets
6. Confirm entry format verification passed for Chrome, Firefox, and Safari.
7. Package release artifacts under the repository `release/` directory:
   - Use the existing flat naming convention: `release/AI-MarkDone-v<version>-<target>.zip`.
   - Keep checksums version-scoped, for example `release/AI-MarkDone-v<version>-SHA256SUMS.txt`.
   - Do not place formal release packages under `release-artifacts/`; that directory is only for ignored local scratch output.
8. Run Safari Xcode packaging:
   - Every explicit release flow must run Safari Xcode packaging with `npm run package:safari:xcode`.
   - Confirm `safari-build/` is generated.
   - The script uses `--copy-resources --no-open --no-prompt --force` so the release step is repeatable and does not depend on Xcode opening automatically.
   - If `xcrun safari-web-extension-converter` or Xcode signing tooling is unavailable, stop and report the blocker instead of silently skipping Safari packaging.
   - Configure Apple Team/signing in Xcode manually when preparing an actual Safari submission; do not write certificates, Team ID, or App Store credentials into the repository.
9. Produce the Safari free DMG release artifact from the signed exported Safari wrapper app:
   - Archive/export the Safari wrapper app from Xcode with Developer ID signing for direct distribution.
   - Run `SAFARI_APP_PATH="/path/to/AI-MarkDone.app" npm run package:safari:dmg`.
   - The default output is `release/AI-MarkDone-v<version>-free.dmg`.
   - For notarization, prefer a saved notarytool keychain profile and run `SAFARI_NOTARIZE=1 SAFARI_NOTARY_PROFILE="<profile>" SAFARI_APP_PATH="/path/to/AI-MarkDone.app" npm run package:safari:dmg`.
   - If the signed `.app`, Developer ID certificate, notarization profile, or Xcode archive is missing, stop and report the blocker. Do not silently replace the DMG step with an unsigned local-debug artifact.
10. Prepare the Safari paid App Store channel from the same source and feature set:
   - Use the same `dist-safari/`, Xcode wrapper, user-visible version, and feature behavior as the free DMG channel.
   - Archive in Xcode and distribute with the App Store Connect method.
   - Configure price, screenshots, privacy answers, age rating, and review notes in App Store Connect; paid pricing is a store-setting decision, not a code fork.
   - Do not commit Apple Team IDs, certificates, App Store credentials, App Store copy secrets, or notarization passwords.
11. Update `CHANGELOG.md` and any user-facing release references.
   - Update the latest release summary in `README.md` and `README.zh.md` when the highlighted version changes.
   - Review the main feature bullets, release summary, and manual-install wording in `README.md` and `README.zh.md` so they still match the shipped release artifacts and feature set.
   - Update `RELEASE_NOTES.md` if the repository still uses it as a user-facing release summary.
   - If the release changes bookmarks information pages, review and update the relevant files under `src/ui/content/bookmarks/content/`.
   - At minimum, explicitly check `changelog.zh.md`, `changelog.en.md`, `faq.zh.md`, `faq.en.md`, `about.zh.md`, and `about.en.md` before submission.
12. Perform maintainer manual review for all release-facing copy before finishing.
   - `CHANGELOG.md`
   - `README.md`
   - `README.zh.md`
   - `RELEASE_NOTES.md`
   - any touched files under `src/ui/content/bookmarks/content/`
   - This manual review is required even if tests and build already pass.
13. If the release changes adapters, runtime protocol, or browser support behavior, update the corresponding docs before finishing.

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
- Chrome, Firefox, and Safari web extension targets produce loadable artifacts with verified entry format.
- Formal release packages are placed under `release/` using `AI-MarkDone-v<version>-<target>` names, with version-scoped checksums.
- Safari Xcode packaging has run with `npm run package:safari:xcode`, or a concrete local-tooling blocker has been reported.
- Safari free DMG packaging has run with `SAFARI_APP_PATH="/path/to/AI-MarkDone.app" npm run package:safari:dmg`, or a concrete signing/export/notarization blocker has been reported.
- Safari paid App Store Connect archive/upload readiness has been confirmed, including price-setting ownership and required store metadata blockers.
- `npm run build` succeeds.
