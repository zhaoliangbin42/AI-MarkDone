# AGENTS.md — MV3 Chrome Extension Engineering Playbook (v2)

> This file is the authoritative operational guide for Codex and contributors.
> Keep this file **stable, short, and enforceable**. Put long procedures into `codex/prompts/*.md` and `docs/*`.
> If reality diverges from this file, update this file in the same PR.

---

## 0) Project Identity
- Name: AI-MarkDone
- Type: Chrome Extension (Manifest V3)
- Primary language: TypeScript (preferred), plus HTML/CSS
- Privileged runtime: MV3 Service Worker
- UI surfaces:
  - Popup: none (not declared in `manifest.json`)
  - Options: none (not declared in `manifest.json`)
  - Content scripts: `src/content/`
- Manifest: `manifest.json`

---

## 1) Operating Principles (Non-Negotiable)
### 1.1 Least Privilege
- Do not expand `permissions` / `host_permissions` without:
  - ADR in `docs/adr/`
  - Update `docs/security/permissions.md`
  - Explicit PR summary noting user-facing permission prompts

### 1.2 Trust Boundaries (MV3)
- Content scripts are **untrusted**. Treat inbound messages as attacker-controlled.
- Validate message payloads at receiver boundary.
- Privileged actions must live in the service worker (or trusted extension pages), not in content scripts.

### 1.3 CSP / No Dynamic Code
- No `eval`, no dynamic script creation, no remote scripts.
- No unsafe HTML injection. If rendering rich text/Markdown, sanitize and test injection attempts.

### 1.4 Small PRs, Minimal Diff
- Avoid unrelated formatting churn, broad renames, drive-by refactors.
- If scope grows, split into PR slices.

### 1.5 Definition of Done Includes Evidence + Docs
Every PR must include:
- Verification commands executed + summarized results
- Triggered doc updates (see Section 6)

---

## 2) Repo Map (Where Things Live)
- Manifest: `manifest.json`
- Service worker: `src/background/service-worker.ts`
- Content scripts: `src/content/`
- UI:
  - Popup: `src/ui/popup/`
  - Options: `src/ui/options/`
- Shared (preferred location for pure logic):
  - Utilities/helpers: `src/utils/`
  - Types: `src/types/`
- Context Pack (project memory):
  - `docs/project/REPO_OVERVIEW.md`
  - `docs/project/ARCHITECTURE_MAP.md`
  - `docs/project/DEV_COMMANDS.md`
  - `docs/project/RISKS_AND_DEBTS.md`
- Product/Design docs:
  - PRD: `docs/prd/PRD-*.md`
  - SPEC: `docs/spec/SPEC-*.md`
  - ADR: `docs/adr/ADR-*.md`
- Security:
  - `docs/security/permissions.md`
- Tests:
  - Unit: `tests/unit/`
  - E2E: `tests/e2e/`

---

## 3) Canonical Commands (Single Source of Truth)
> These must match `package.json` scripts. If missing, add TODO in `docs/project/DEV_COMMANDS.md`.

- Install: `npm install` (or `npm ci`)
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
- Typecheck: `npm run type-check`
- Unit: `npm run test:unit`

### Required one-shot gate before finalizing a PR
- No aggregate `check` script is defined yet. Run:
  - `npm run type-check`
  - `npm run test:unit`

---

## 4) How Codex Should Work in This Repo (Default Workflow)
### 4.1 Start-of-task preflight (required)
Before making changes, Codex must:
1) Read: `docs/project/REPO_OVERVIEW.md` + `docs/project/ARCHITECTURE_MAP.md`
2) Identify relevant entry points from `manifest.json`
3) Identify verification commands from Section 3 / `docs/project/DEV_COMMANDS.md`

### 4.2 Preferred commands (project SOP)
- Refresh project memory (no business code changes):
  - `/prompts:init_refresh MODE=refresh`
- New feature (docs-first):
  - PRD → SPEC → plan → implement slices → review → release prep
- Implementation must use the Implement SOP:
  - `/prompts:implement <SPEC> SLICE=1 ...`

> Keep prompts in `codex/prompts/*.md` (or `$CODEX_HOME/prompts`) and version them with the repo.

---

## 5) Engineering Standards (What “Good” Looks Like)
### 5.1 Messaging
- Define message names + payload types in `src/shared/messaging.ts`.
- Validate at boundary:
  - discriminant/type
  - required fields and types
  - reject/ignore unknown fields when feasible
- Prefer structured error objects `{ code, message }` rather than throwing raw errors across boundaries.

### 5.2 Storage
- Access via `src/shared/storage.ts`.
- Storage keys centralized in `src/shared/storage_keys.ts`.
- Schema changes require explicit migration strategy (documented).

### 5.3 UI / Rendering
- No direct unsanitized `innerHTML`.
- Any rich rendering (e.g., Markdown) must:
  - sanitize output
  - define allowlist policy (elements/attributes/URL schemes)
  - include negative tests for injection attempts

---

## 6) Knowledge Base Update Contract (Triggers → Required Updates)
> This is the critical “project memory” rule set. If a trigger occurs, docs MUST be updated in the same PR.

### 6.1 Manifest changes (permissions/host_permissions/CSP/contexts)
Trigger:
- Any change in `manifest.json` involving permissions, host permissions, CSP, or extension pages/contexts

Required updates:
- `docs/security/permissions.md`
- `docs/adr/ADR-*.md` (if permission/CSP/contexts changed)
- `docs/project/ARCHITECTURE_MAP.md` (if boundaries/contexts changed)

### 6.2 Messaging contracts / handlers
Trigger:
- Message names/types/payload schemas, `onMessage` routing/handlers, validation logic

Required updates:
- Relevant `docs/spec/SPEC-*.md` (contracts section)
- `docs/project/ARCHITECTURE_MAP.md` (messaging map)
- Tests covering malformed payloads

### 6.3 Storage schema/keys
Trigger:
- New keys, changed types, migrations, new storage module patterns

Required updates:
- Relevant `docs/spec/SPEC-*.md` (storage schema + migration notes)
- `docs/project/ARCHITECTURE_MAP.md` (storage map)
- Tests for default/missing values and migrations (if applicable)

### 6.4 Build/Test/CI changes
Trigger:
- Changes to scripts, tooling, or CI workflows

Required updates:
- `docs/project/DEV_COMMANDS.md`
- CI workflow must call the canonical check command

### 6.5 Refactors / boundary shifts
Trigger:
- Moving responsibilities across SW/UI/content scripts, adding shared layers, changing data flow

Required updates:
- `docs/project/ARCHITECTURE_MAP.md`
- `docs/project/RISKS_AND_DEBTS.md` (risk/debt delta)

### 6.6 Gaps / deferred work
Trigger:
- Unable to run verification, missing tests, unresolved security concerns, deferred risky items

Required updates:
- `docs/project/RISKS_AND_DEBTS.md` with explicit TODOs and follow-up plan

---

## 7) AUTOGEN vs MANUAL Doc Editing Policy
When Codex updates docs, preserve manual sections by using markers:
- `<!-- BEGIN AUTOGEN --> ... <!-- END AUTOGEN -->`
- `<!-- BEGIN MANUAL NOTES --> ... <!-- END MANUAL NOTES -->`

Codex should overwrite **only AUTOGEN blocks** unless explicitly instructed otherwise.

---

## 8) PR Requirements (What Must Appear in Every PR)
PR description must include:
- Summary (what/why)
- Permissions impact: “No changes” or explicit list
- Risk assessment (security/MV3 lifecycle)
- Verification evidence:
  - commands run
  - pass/fail summary
- UI evidence (screenshots/GIF) for UI changes

---

## 9) Code Review Checklist (Minimum)
- Correctness: edge cases, MV3 lifecycle, no reliance on SW persistent state
- Security: no permission creep; boundary validation; sanitization; CSP compatibility
- Maintainability: clear module boundaries, explicit types, minimal diff
- Tests: acceptance criteria covered; negative tests included where relevant

---

## 10) Stop Conditions (Do Not Guess)
Codex must STOP and propose options (with pros/cons + required doc updates) if:
- a permission/host permission change seems necessary
- CSP changes might be required
- the SPEC is missing/ambiguous or conflicts with current architecture
- scope cannot be kept PR-sized
- verification commands cannot be executed (explain why + propose smallest fix)

---

## 11) Recommended Directory Overrides (For Growth)
If the repo grows, add narrower rules:
- `src/background/AGENTS.override.md` (SW-specific constraints)
- `src/ui/AGENTS.override.md` (UI/testing expectations)
- `src/content_scripts/AGENTS.override.md` (content script safety rules)

---
