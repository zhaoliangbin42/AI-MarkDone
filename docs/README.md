# AI-MarkDone Documentation Hub (Authoritative)

`docs/` is the long-lived source of truth for architecture, contracts, refactor planning, testing strategy, and governance. It is not the entrypoint for day-to-day editing behavior; use [AGENTS.md](../AGENTS.md) and `.codex/*` for that layer.

## Documentation Layers

- `AGENTS.md`
  - repository entrypoint and minimum repository-wide constraints
- `.codex/rules/*`
  - cross-cutting engineering rules
- `.codex/guides/*`
  - activity guides for development, bug fixing, review, release, and adaptation
- `docs/*`
  - stable system knowledge and contracts

## Authoritative Documents

### Architecture

- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/BLUEPRINT.md`
- `docs/architecture/DEPENDENCY_RULES.md`
- `docs/architecture/RUNTIME_PROTOCOL.md`
- `docs/architecture/BROWSER_COMPATIBILITY.md`

### Refactor

These are transition-execution documents, not long-lived architecture authority:

- `docs/refactor/REFACTOR_CHECKLIST.md`
- `docs/rewrite/PROGRAM.md`
- `docs/rewrite/FEATURE_PARITY.md`

### Contracts

- `docs/antigravity/platform/ADAPTER_CONTRACT.md`
- `docs/antigravity/platform/CAPABILITY_MATRIX.md`
- `docs/FEATURES.md`

### Governance

- `docs/governance/DOCS_GOVERNANCE.md`
- `docs/DEVLOG.md`

### Decisions

- `docs/adr/README.md`
- `docs/adr/ADR-0005-tailwind-alias-overlay-boundary.md`

### Style

- `docs/style/STYLE_SYSTEM.md`
- `docs/style/STYLE_ARCHITECTURE.md`
- `docs/style/ARIAKIT_EXAMPLES_STYLE_REFERENCE.md`
  - historical reference only; not an active authority for new modules

### Testing

- `docs/testing/CURRENT_TEST_GATES.md`
- `docs/testing/TESTING_BLUEPRINT.md`
- `docs/testing/E2E_REGRESSION_GUIDE.md`

### Runbooks

- `docs/runbooks/platform-dom-breakage.md`
- `docs/runbooks/build-release-validation.md`
- `docs/runbooks/documentation-drift-check.md`

## Maintenance Rules

- Keep one authoritative location per contract or rule.
- Move repeated behavioral guidance into `.codex/rules/*` or `.codex/guides/*`, not into `docs/`.
- Remove or archive stale documents once their content has been absorbed into a current authoritative file.
- Do not add references to non-existent documents.
- Treat `docs/style/STYLE_SYSTEM.md` + `docs/style/STYLE_ARCHITECTURE.md` + active ADRs as the authority for UI style direction.

## Suggested Reading Order

1. `docs/architecture/CURRENT_STATE.md`
2. `docs/architecture/BLUEPRINT.md`
3. `docs/FEATURES.md`
4. `docs/architecture/RUNTIME_PROTOCOL.md`
5. `docs/testing/CURRENT_TEST_GATES.md`

## Read By Change Type

- Current implementation boundaries
  - `docs/architecture/CURRENT_STATE.md`
- Target architecture or dependency direction
  - `docs/architecture/BLUEPRINT.md`
  - `docs/architecture/DEPENDENCY_RULES.md`
- Content/background messaging
  - `docs/architecture/RUNTIME_PROTOCOL.md`
- Platform adapters and support level
  - `docs/antigravity/platform/ADAPTER_CONTRACT.md`
  - `docs/antigravity/platform/CAPABILITY_MATRIX.md`
- Testing and release gates
  - `docs/testing/CURRENT_TEST_GATES.md`
  - `docs/testing/TESTING_BLUEPRINT.md`
  - `docs/testing/E2E_REGRESSION_GUIDE.md`
- Style-system and UI workflow changes
  - `docs/style/STYLE_SYSTEM.md`
  - `docs/style/STYLE_ARCHITECTURE.md`
  - `docs/adr/ADR-0005-tailwind-alias-overlay-boundary.md`
