# Repository Guidelines

> Audience: AI agents (Claude/Gemini/GPT) and human contributors.
> Version: 4.0.0

---

## Command Restrictions

- The project runs in a blacklist mode for critical CLI commands.
- You must obtain explicit approval from the user before running any `git` or `rm` commands.
- Other commands can proceed with standard safety precautions.

---

## Project Overview

| Field | Value |
|:--|:--|
| Project | AI-MarkDone |
| Type | Chrome extension (Manifest V3) |
| Targets | ChatGPT, Gemini |
| Stack | TypeScript, Vite, Shadow DOM |
| Core Features | LaTeX copy, Markdown export, live preview, word count, bookmarks |

---

## Rule Files (Read First)

| Rule | File | Notes |
|:--|:--|:--|
| Critical rules | `.agent/rules/critical-rules.md` | Must not be violated |
| Changelog | `.agent/rules/changelog.md` | Format rules; no sensitive info |
| Style guide | `.agent/rules/style-guide.md` | CSS & design tokens |
| Logging | `.agent/rules/logging.md` | Log levels and formats |

---

## Workflows

Use slash commands to follow the required workflow:

| Command | Workflow | Purpose |
|:--|:--|:--|
| `/develop` | `.agent/workflows/development.md` | New features |
| `/bugfix` | `.agent/workflows/bug-fix.md` | Bug fixes |
| `/review` | `.agent/workflows/code-review.md` | Code review |
| `/style` | `.agent/workflows/style-modification.md` | Styling changes |
| `/release` | `.agent/workflows/release-preparation.md` | Release prep |

---

## Thinking Budget Keywords

| Keyword | Budget | Use Case |
|:--|:--|:--|
| `think` | ~4k tokens | Quick analysis |
| `think deeply` | ~10k tokens | Reviews, bug analysis |
| `ultrathink` | ~32k tokens | Architecture, refactors |

---

## Architecture & Module Layout

```
src/
├── content/          # Content-script entry
│   ├── adapters/     # Platform adapters (ChatGPT/Gemini)
│   ├── features/     # Feature modules
│   └── parsers/      # Markdown parsing pipeline
├── bookmarks/        # Bookmark module
├── renderer/         # Markdown renderer
├── styles/           # Styles and tokens
└── utils/            # Shared utilities
```

Shadow DOM is required for UI components to avoid CSS collisions. Use design tokens (`var(--aimd-*)`) for consistent theming.

---

## Build, Test, and Dev Commands

```bash
npm install
npm run dev
npm run build
npm run type-check
npm run test
npm run test:ui
```

Notes:
- `npm run dev` uses Vite HMR; reload the extension manually in `chrome://extensions/`.
- `npm run build` compiles TypeScript, bundles with Vite, and copies assets to `dist/`.

---

## Pre-Submit Checklist

- `npm run build` succeeds.
- Interface changes update `.agent/workflows/platform-adaptation.md`.
- `CHANGELOG.md` updated under `[Unreleased]` and written in English.

---

## Reference Docs

- `.agent/workflows/platform-adaptation.md` — platform integration manual (SOP & Contract)
- `docs/antigravity/platform/CAPABILITY_MATRIX.md` — platform support matrix
- `GEMINI.md` — AI agent development standards
