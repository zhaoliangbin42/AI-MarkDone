# AI-MarkDone Engineering Guide

This repository uses a Codex-first engineering guide for day-to-day development. Keep this file short, stable, and focused on entrypoints.

## Project Facts

| Item | Value |
|:--|:--|
| Product | AI-MarkDone |
| Type | Browser extension |
| Targets | Chrome MV3, Firefox MV2 |
| Runtime surfaces | content runtime, background runtime, extension UI |
| Stack | TypeScript, Vite, Shadow DOM |
| Core constraints | platform adapters, tokenized UI, dual-browser build parity |

## Read Order

1. This file for repository-wide expectations.
2. `.codex/rules/*` for cross-cutting engineering rules.
3. `.codex/guides/*` for task-oriented guidance.
4. [docs/README.md](docs/README.md) for the long-lived system of record.
5. The specific contract or architecture document for the area you are changing.

## Common Commands

- `npm install`
- `npm run test:smoke`
- `npm run test:core`
- `npm run build`

## Non-Negotiables

- Search before editing. Do not assume files, symbols, selectors, or contracts exist.
- Do not use destructive rollback commands such as `git checkout --`, `git reset --hard`, or bulk `sed` replacements.
- UI changes must use the established `--aimd-*` token system. Do not hardcode colors, spacing, radius, or z-index values in shipped UI.
- Do not use `!important` outside explicit print-only rules.
- Keep architecture changes aligned with the authoritative docs in `docs/`.
- Any repo-tracked code change must be verified with `npm run build` before completion unless the user explicitly waives it.

## Required Engineering Behaviors

- Treat user corrections as process failures, not one-off mistakes.
  - State what was wrong.
  - Adjust the plan or rule you are following.
  - Do not repeat the same mistake silently.
- For bug fixes, reproduce the bug with a failing test before changing implementation whenever the bug is testable in this repository.
  - If it is not realistically testable, state why and add the closest practical regression check.
  - For overlay, modal, popover, panel, or shared-primitive regressions, do not stop at direct surface tests.
    Also add or update at least one test that enters through the real user-facing trigger path.
- Before writing code for a materially ambiguous request, ask clarifying questions instead of guessing.
- After any code change, explicitly list important edge cases and suggest the tests that should cover them.
- Do not claim success from reasoning alone.
  - Use commands, tests, or build output as evidence.
- Prefer the smallest safe change that satisfies the request and preserves current contracts.

## Where Rules Live

- `.codex/rules/critical-rules.md`
  - hard constraints that apply across all work
- `.codex/rules/commenting.md`
  - comment policy for why, contracts, and directive reasons
- `.codex/rules/logging.md`
  - log shape, level selection, and sensitive-data guardrails
- `.codex/rules/style-guide.md`
  - UI token, Shadow DOM, and selector rules
- `.codex/rules/changelog.md`
  - user-facing changelog policy
- `.codex/rules/documentation.md`
  - when and how to update `docs/*`

## Where Guides Live

- `.codex/guides/development.md`
  - new behavior, refactors, and feature work
- `.codex/guides/bug-fix.md`
  - reproduce, diagnose, fix, and verify bugs
- `.codex/guides/code-review.md`
  - review expectations, findings format, and verification
- `.codex/guides/release.md`
  - release preparation and validation
- `.codex/guides/platform-adaptation.md`
  - adding or extending platform support
- `.codex/guides/style-modification.md`
  - style-system specific workflow

## Source Of Truth

`docs/` remains the long-lived system of record for architecture, contracts, testing, and governance.

Start here:

- [docs/README.md](docs/README.md)
- [docs/architecture/CURRENT_STATE.md](docs/architecture/CURRENT_STATE.md)
- [docs/architecture/BLUEPRINT.md](docs/architecture/BLUEPRINT.md)
- [docs/architecture/DEPENDENCY_RULES.md](docs/architecture/DEPENDENCY_RULES.md)
- [docs/architecture/RUNTIME_PROTOCOL.md](docs/architecture/RUNTIME_PROTOCOL.md)
- [docs/architecture/BROWSER_COMPATIBILITY.md](docs/architecture/BROWSER_COMPATIBILITY.md)
- [docs/antigravity/platform/ADAPTER_CONTRACT.md](docs/antigravity/platform/ADAPTER_CONTRACT.md)
- [docs/antigravity/platform/CAPABILITY_MATRIX.md](docs/antigravity/platform/CAPABILITY_MATRIX.md)
- [docs/style/STYLE_SYSTEM.md](docs/style/STYLE_SYSTEM.md)
- [docs/testing/CURRENT_TEST_GATES.md](docs/testing/CURRENT_TEST_GATES.md)
- [docs/testing/TESTING_BLUEPRINT.md](docs/testing/TESTING_BLUEPRINT.md)
- [docs/governance/DOCS_GOVERNANCE.md](docs/governance/DOCS_GOVERNANCE.md)

## Change Routing

- Adapter or platform behavior
  - read `docs/antigravity/platform/ADAPTER_CONTRACT.md`
- Architecture or layer boundaries
  - read `docs/architecture/CURRENT_STATE.md`
  - read `docs/architecture/BLUEPRINT.md`
  - read `docs/architecture/DEPENDENCY_RULES.md`
- Runtime messaging or background/content boundaries
  - read `docs/architecture/RUNTIME_PROTOCOL.md`
- Style-system or theme changes
  - read `docs/style/STYLE_SYSTEM.md`
- Testing or release gates
  - read `docs/testing/CURRENT_TEST_GATES.md`
  - read `docs/testing/TESTING_BLUEPRINT.md`

## Minimum Verification

- Run `npm run build` after repo-tracked code changes.
- Update the relevant authoritative docs when contracts, platform support, architecture boundaries, or testing gates change.
- Update `CHANGELOG.md` in English when the change affects end users.
- For version prep or store submission, also follow `.codex/guides/release.md`, including README / release-notes sync, bookmarks information-page checks, and maintainer manual review of release-facing copy.

## Scope Note

This guide is for Codex-based collaboration in this repository. It intentionally does not document tool-specific artifact workflows, slash commands, or prompt rituals.
